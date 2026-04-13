import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Session cost tracker ──────────────────────────────────────────────
const COSTS = {
  taunt:  0.000050,   // Claude Haiku ~200 tokens (taunt + whisper JSON)
  brief:  0.00015,    // Claude Haiku ~300 tokens
  imgPrompt: 0.00005, // Claude Haiku ~100 tokens (image prompt build)
  image:  0.03,       // Stability Core per image
};
let sessionTotal = 0;
function logCost(label, cost) {
  sessionTotal += cost;
  console.log(`💰 ${label} — ~$${cost.toFixed(5)} | Session total: ~$${sessionTotal.toFixed(4)}`);
}

// Creature types that cannot speak — describe their sounds/behavior instead
const BEAST_TYPES = new Set([
  'beast', 'ooze', 'plant', 'swarm',
]);

// Monstrosities and aberrations MAY speak if INT >= this threshold
const SPEECH_INT_THRESHOLD = 8;

// Tone prompts for speaking creatures
const TONE = {
  menacing:  "You are a dark and terrifying creature. Speak with cold, predatory menace.",
  taunting:  "You are a cruel and mocking creature. Speak with gleeful contempt for your enemy.",
  dramatic:  "You are a dramatic villain. Speak with theatrical flair and grandiosity.",
  comedic:   "You are a bumbling but dangerous monster. Speak with unintentional comic menace.",
};

const SIZE_LABEL = { tiny:'tiny', sm:'small', med:'medium', lg:'large', huge:'huge', grg:'gargantuan' };

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value instanceof Set) return [...value].filter(Boolean).map(String);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    // Handles serialized Set-like objects or keyed dictionaries.
    return Object.values(value).filter(Boolean).map(String);
  }
  return [];
}

function normalizeNumber(value, fallback = 0, { min = -Infinity, max = Infinity } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function buildPrompt(data) {
  const {
    attackerName, attackerType, attackName, hit, tone = 'menacing',
    hpPct = 100, cr = null, alignment = '', intScore = 10, chaScore = 10,
    immunities = [], resistances = [], conditionImmunities = [],
    languages = [], size = 'med', specialAbilities = [],
    isCritical = false,
    target = {}, party = [], combat = null, resources = {},
    roundSummary = null,
  } = data;

  const type = attackerType?.toLowerCase();
  const isBeast = BEAST_TYPES.has(type)
    || ((type === 'monstrosity' || type === 'aberration') && intScore < SPEECH_INT_THRESHOLD);

  const immunityList = normalizeList(immunities);
  const resistanceList = normalizeList(resistances);
  const conditionImmunityList = normalizeList(conditionImmunities);
  const languageList = normalizeList(languages);
  const specialAbilityList = normalizeList(specialAbilities);

  const hpPctNum = normalizeNumber(hpPct, 100, { min: 0, max: 100 });
  const crNum = cr == null ? null : normalizeNumber(cr, 0, { min: 0 });
  const intScoreNum = normalizeNumber(intScore, 10, { min: 1, max: 30 });
  const chaScoreNum = normalizeNumber(chaScore, 10, { min: 1, max: 30 });
  const legendaryActionsMax = normalizeNumber(resources.legendaryActions?.max, 0, { min: 0 });
  const legendaryActionsRemaining = normalizeNumber(resources.legendaryActions?.remaining, 0, { min: 0 });
  const legendaryResistancesMax = normalizeNumber(resources.legendaryResistances?.max, 0, { min: 0 });
  const legendaryResistancesRemaining = normalizeNumber(resources.legendaryResistances?.remaining, 0, { min: 0 });
  const hasLairActions = !!resources.hasLairActions;
  const lairInitiative = normalizeNumber(resources.lairInitiative, 20, { min: 1, max: 99 });

  // ── Creature context ──
  const contextLines = [];
  if (crNum !== null)  contextLines.push(`CR: ${crNum} (${crNum >= 10 ? 'apex predator' : crNum >= 5 ? 'dangerous' : 'scrappy'})`);
  if (hpPctNum <= 25)       contextLines.push(`NPC HP: ${hpPctNum}% — critically wounded, cornered`);
  else if (hpPctNum <= 50)  contextLines.push(`NPC HP: ${hpPctNum}% — bloodied, fighting harder`);
  else                      contextLines.push(`NPC HP: ${hpPctNum}% — dominant`);
  if (alignment)         contextLines.push(`Alignment: ${alignment}`);
  if (SIZE_LABEL[size])  contextLines.push(`Size: ${SIZE_LABEL[size]}`);
  if (immunityList.length)            contextLines.push(`Immune to: ${immunityList.join(', ')}`);
  if (resistanceList.length)          contextLines.push(`Resistant to: ${resistanceList.join(', ')}`);
  if (conditionImmunityList.length)   contextLines.push(`Cannot be: ${conditionImmunityList.join(', ')}`);
  if (specialAbilityList.length)      contextLines.push(`Special: ${specialAbilityList.join(', ')}`);
  if (!isBeast && languageList.length) contextLines.push(`Speaks: ${languageList.join(', ')}`);
  if (intScoreNum <= 6)   contextLines.push(`INT ${intScoreNum}: very low — speak simply`);
  else if (intScoreNum >= 16) contextLines.push(`INT ${intScoreNum}: highly intelligent`);
  if (chaScoreNum <= 6)   contextLines.push(`CHA ${chaScoreNum}: brutish`);
  else if (chaScoreNum >= 16) contextLines.push(`CHA ${chaScoreNum}: commanding presence`);

  // ── NPC resources ──
  const resLines = [];
  if (legendaryActionsMax > 0)
    resLines.push(`Legendary Actions: ${legendaryActionsRemaining}/${legendaryActionsMax} remaining`);
  if (legendaryResistancesMax > 0)
    resLines.push(`Legendary Resistance: ${legendaryResistancesRemaining}/${legendaryResistancesMax} remaining`);
  if (hasLairActions)
    resLines.push(`Lair Actions: YES (fires at initiative ${lairInitiative})`);

  // ── Battle state ──
  const battleLines = [];
  if (combat) {
    battleLines.push(`Combat round: ${combat.round}`);
    if (combat.defeatedCombatants?.length)
      battleLines.push(`Defeated this fight: ${combat.defeatedCombatants.join(', ')}`);
  }
  if (target.name) {
      const tParts = [
        `Target: ${target.name}`,
        `${normalizeNumber(target.hpPct, 100, { min: 0, max: 100 })}% HP`,
        `AC ${normalizeNumber(target.ac, 10, { min: 0 })}`
      ];
    if (target.conditions?.length)  tParts.push(`[${target.conditions.join(', ')}]`);
    if (target.concentration)       tParts.push('CONCENTRATING');
    battleLines.push(tParts.join(' | '));
  }
  if (party.length) {
    const partySummary = party.map(p => {
      const conds = p.conditions?.length ? ` [${p.conditions.join(',')}]` : '';
      return `${p.name} ${normalizeNumber(p.hpPct, 100, { min: 0, max: 100 })}%${conds}${p.concentration ? ' CONC' : ''}`;
    }).join(' | ');
    battleLines.push(`Party: ${partySummary}`);
  }

  // ── Whisper tactical hints ──
  const whisperHints = [];
  if (party.length) {
    const dying   = party.filter(p => normalizeNumber(p.hpPct, 100, { min: 0, max: 100 }) <= 25);
    const injured = party.filter(p => {
      const pct = normalizeNumber(p.hpPct, 100, { min: 0, max: 100 });
      return pct > 25 && pct <= 50;
    });
    const concs   = party.filter(p => p.concentration);
    if (dying.length) {
      whisperHints.push(`Near-death: ${dying.map(p => `${p.name} (${normalizeNumber(p.hpPct, 100, { min: 0, max: 100 })}% HP)`).join(', ')}`);
    }
    if (injured.length) {
      whisperHints.push(`Bloodied: ${injured.map(p => `${p.name} (${normalizeNumber(p.hpPct, 100, { min: 0, max: 100 })}% HP)`).join(', ')}`);
    }
    if (concs.length)   whisperHints.push(`Concentrating: ${concs.map(p => p.name).join(', ')} — breaking their spell could shift the fight`);
  }
  if (legendaryActionsRemaining > 0)
    whisperHints.push(`${legendaryActionsRemaining} legendary action(s) available — use at end of a PC's turn`);
  if (legendaryResistancesRemaining > 0)
    whisperHints.push(`${legendaryResistancesRemaining} legendary resistance(s) banked — save for a fight-ending save`);
  if (hasLairActions)
    whisperHints.push(`Lair action fires at initiative ${lairInitiative} — use for environmental drama`);
  if (normalizeNumber(combat?.round, 0, { min: 0 }) >= 10)
    whisperHints.push(`Round ${normalizeNumber(combat?.round, 0, { min: 0 })} — late fight, consider escalating, fleeing, or offering surrender`);

  // ── Assemble blocks ──
  const contextBlock  = contextLines.length  ? `\nCreature:\n${contextLines.map(l => `- ${l}`).join('\n')}` : '';
  const resBlock      = resLines.length      ? `\nResources:\n${resLines.map(l => `- ${l}`).join('\n')}` : '';
  const battleBlock   = battleLines.length   ? `\nBattle:\n${battleLines.map(l => `- ${l}`).join('\n')}` : '';
  const whisperBlock  = whisperHints.length  ? `\nDM tactical context:\n${whisperHints.map(l => `- ${l}`).join('\n')}` : '';

  const summaryHits = normalizeNumber(roundSummary?.hits, 0, { min: 0 });
  const summaryMisses = normalizeNumber(roundSummary?.misses, 0, { min: 0 });
  const summaryCrits = normalizeNumber(roundSummary?.crits, 0, { min: 0 });
  const summaryTotal = normalizeNumber(roundSummary?.totalAttacks, 0, { min: 0 });
  const summaryTargets = normalizeList(roundSummary?.targets);
  const summaryAttacks = normalizeList(roundSummary?.attacks);
  const hasRoundSummary = summaryTotal > 0;

  const hitWord = isCritical ? 'CRITICAL HIT on' : hit ? 'hit' : 'missed';
  const attackSummary = hasRoundSummary
    ? `${attackerName} finished their turn: ${summaryTotal} attack(s), ${summaryHits} hit(s), ${summaryMisses} miss(es), ${summaryCrits} critical(s).`
    : `${attackerName} ${hitWord} ${target.name || 'the target'} with ${attackName}.`;

  const roundSummaryBlock = hasRoundSummary
    ? `\nTurn recap:\n- Attacks used: ${summaryAttacks.join(', ') || attackName || 'attack'}\n- Targets pressured: ${summaryTargets.join(', ') || target.name || 'the party'}\n- Result: ${summaryHits} hits, ${summaryMisses} misses, ${summaryCrits} criticals`
    : '';

  const JSON_INSTRUCTION = `\nReturn ONLY raw JSON — no markdown, no code fences, no explanation:\n{"taunt":"...","whisper":"..."}`;

  // ── Beast branch (no speech) ──
  if (isBeast) {
    const beastMood = hpPctNum <= 25 ? 'wounded and desperate' : hpPctNum <= 50 ? 'bloodied and frenzied' : 'dominant';
    return `You are narrating D&D 5e combat for a Dungeon Master.
${attackSummary} ${attackerName} is a ${attackerType} (${beastMood}) that cannot speak.${contextBlock}${battleBlock}${roundSummaryBlock}${resBlock}${whisperBlock}

"taunt": 1 brief third-person animalistic reaction — sound, posture, or behavior. Max 15 words.
"whisper": 1-2 punchy tactical suggestions for the DM. Max 35 words. No roleplay, just tactical.${JSON_INSTRUCTION}`;
  }

  // ── Speaking creature branch ──
  const toneInstruction = TONE[tone] || TONE.menacing;
  const moodHint = hpPctNum <= 25 ? 'You are gravely wounded — rage or desperation bleeds through your words.'
    : hpPctNum <= 50 ? 'You are bloodied but unbowed.' : '';
  const critHint = isCritical ? ' This was a devastating critical hit — let triumph ring in your voice.' : '';
  const summaryHint = hasRoundSummary
    ? 'This line is an end-of-turn recap taunt; reference the turn outcomes, keep it sharp and short.'
    : '';

  return `${toneInstruction}
You are ${attackerName}, a ${attackerType}. ${attackSummary}
${moodHint}${critHint}${summaryHint}${contextBlock}${battleBlock}${roundSummaryBlock}${resBlock}${whisperBlock}

"taunt": your in-character speech, max 20 words, no quotation marks, no stage directions.
"whisper": tactical DM advice (out of character), max 35 words, no roleplay.${JSON_INSTRUCTION}`;
}

app.post('/npc-taunt', async (req, res) => {
  const { attackerName = 'unknown' } = req.body;
  const prompt = buildPrompt(req.body);

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].text.trim();
    // Strip markdown code fences if the model wraps its JSON response
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let taunt = '', whisper = '';
    try {
      const parsed = JSON.parse(cleaned);
      taunt   = parsed.taunt?.trim()   || '';
      whisper = parsed.whisper?.trim() || '';
    } catch {
      // Fallback: treat whole response as taunt if JSON parse fails
      taunt = cleaned;
      console.warn('AI server | JSON parse failed, using raw text as taunt');
    }

    logCost(`Taunt+Whisper for "${attackerName}"`, COSTS.taunt);
    res.json({ taunt, whisper });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── /brief — DM roleplay briefing for any document type ──
const BRIEF_PROMPTS = {
  Actor: (name, subtype, bio) => `You are a D&D 5e expert helping a Dungeon Master run a game at the table right now.
Give a concise DM briefing for the NPC/creature "${name}" (${subtype || "creature"}).
${bio ? `Here is some background on this creature:\n${bio}\n` : "Draw on your D&D/fantasy knowledge of this creature."}
Cover in 3-4 short bullet points:
• Personality & motivations
• How it speaks or sounds (voice, tone, vocabulary)
• Combat behavior & tactics
• One memorable quirk or trait to make it feel alive
Keep it punchy — this is a quick reference card, not an essay.`,

  Item: (name, subtype, bio) => `You are a D&D 5e expert helping a Dungeon Master describe an item to players.
Give a concise DM briefing for the item "${name}" (${subtype || "item"}).
${bio ? `Item description:\n${bio}\n` : "Draw on your D&D/fantasy knowledge."}
Cover in 3-4 short bullet points:
• What it looks like and feels like when held
• Its history or origin (1 sentence of lore)
• How to describe its effect dramatically at the table
• Any interesting RP hooks or quirks`,

  Scene: (name, _subtype, bio) => `You are a D&D 5e expert helping a Dungeon Master set a scene.
Give a concise DM briefing for the location "${name}".
${bio ? `Location notes:\n${bio}\n` : "Draw on your D&D/fantasy knowledge."}
Cover in 3-4 short bullet points:
• Atmosphere: sights, sounds, smells
• Mood and tone to convey to players
• Key details to emphasize
• Potential dangers or points of interest`,

  default: (name, subtype, bio) => `You are a D&D 5e expert helping a Dungeon Master.
Give a concise briefing for "${name}" (${subtype || "unknown type"}).
${bio ? `Background:\n${bio}\n` : "Draw on your D&D/fantasy knowledge."}
Cover in 3-4 short bullet points relevant to using this at the table right now.`,
};

app.post('/brief', async (req, res) => {
  const { name, category, subtype, bio } = req.body;

  const promptFn = BRIEF_PROMPTS[category] || BRIEF_PROMPTS.default;
  const prompt = promptFn(name, subtype, bio ? bio.slice(0, 400) : '');

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    logCost(`Brief for "${name}"`, COSTS.brief);
    res.json({ text });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── /generate-image — AI art via Stability AI ────────────────────────
async function buildImagePrompt(name, category, subtype, bio) {
  const subject = category === 'Actor' ? `a ${subtype || 'creature'} named ${name}`
    : category === 'Item'  ? `a fantasy item called ${name} (${subtype || 'item'})`
    : `a fantasy scene: ${name}`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{ role: 'user', content: `Write a Stable Diffusion image prompt (max 50 words) for a traditional D&D fantasy illustration of ${subject}.${bio ? ` Context: ${bio.slice(0, 150)}` : ''} Style: official D&D 5e Monster Manual art style, painterly fantasy illustration, dramatic lighting, rich colors, detailed, high fantasy. No photorealism, no anime. Output only the prompt.` }],
  });

  return message.content[0].text.trim();
}

app.post('/generate-image', async (req, res) => {
  const { name, category, subtype, bio } = req.body;

  if (!process.env.STABILITY_API_KEY) {
    return res.status(500).json({ error: 'STABILITY_API_KEY not configured in .env' });
  }

  try {
    const imagePrompt = await buildImagePrompt(name, category, subtype, bio);
    console.log(`🎨 Generating image for "${name}": ${imagePrompt}`);

    const form = new FormData();
    form.append('prompt', imagePrompt);
    form.append('negative_prompt', 'photorealistic, photograph, anime, manga, cartoon, 3D render, CGI, modern, sci-fi, watermark, text, blurry, low quality');
    form.append('output_format', 'png');

    const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`, 'Accept': 'image/*' },
      body: form,
    });

    if (!stabilityRes.ok) {
      const errText = await stabilityRes.text();
      console.error('Stability AI error:', errText);
      return res.status(500).json({ error: `Stability AI ${stabilityRes.status}: ${errText}` });
    }

    // Remove background → transparent PNG
    const genBuffer = await stabilityRes.arrayBuffer();
    const bgForm = new FormData();
    bgForm.append('image', new Blob([genBuffer], { type: 'image/png' }), 'art.png');
    bgForm.append('output_format', 'png');

    const bgRes = await fetch('https://api.stability.ai/v2beta/stable-image/edit/remove-background', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`, 'Accept': 'image/*' },
      body: bgForm,
    });

    const finalBuffer = bgRes.ok ? await bgRes.arrayBuffer() : genBuffer;
    if (!bgRes.ok) console.warn('Remove-background failed, using original image');

    const base64 = Buffer.from(finalBuffer).toString('base64');
    logCost(`Image for "${name}"`, COSTS.imgPrompt + COSTS.image + 0.02);

    res.json({ image: `data:image/png;base64,${base64}`, prompt: imagePrompt });

  } catch (err) {
    console.error('Image generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── /generate-map — cinematic scene background from room description ───
app.post('/generate-map', async (req, res) => {
  const { roomName, description, hint } = req.body;

  if (!process.env.STABILITY_API_KEY) {
    return res.status(500).json({ error: 'STABILITY_API_KEY not configured in .env' });
  }

  try {
    const hintLine = hint ? ` Additional mood/style: ${hint}.` : '';
    const claudePrompt = `You are generating a Stable Diffusion prompt for a cinematic fantasy scene background image.
Room name: "${roomName}"
Description: ${(description || '').slice(0, 2500)}${hintLine}

Write a vivid Stable Diffusion prompt (max 80 words) for a wide cinematic establishing shot of this location.
Focus on atmosphere, lighting, mood, and key visual elements from the description.
Style: official D&D 5e environment art style, painterly high fantasy illustration, rich dramatic lighting, detailed stonework and textures, reminiscent of D&D sourcebook art by artists like Tyler Jacobson and Chris Rahn, no characters, no people.
Output only the prompt, nothing else.`;

    const promptMsg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: claudePrompt }],
    });
    const scenePrompt = promptMsg.content[0].text.trim();
    console.log(`🌄 Generating scene for "${roomName}": ${scenePrompt}`);

    const form = new FormData();
    form.append('prompt', scenePrompt);
    form.append('negative_prompt', 'photorealistic, photograph, anime, manga, cartoon, 3D render, CGI, modern, sci-fi, characters, people, monsters, text, watermark, blurry, low quality, diagram, map, top-down, isometric');
    form.append('output_format', 'jpeg');
    form.append('aspect_ratio', '16:9');

    const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`, 'Accept': 'image/*' },
      body: form,
    });

    if (!stabilityRes.ok) {
      const errText = await stabilityRes.text();
      console.error('Stability AI error:', errText);
      return res.status(500).json({ error: `Stability AI ${stabilityRes.status}: ${errText}` });
    }

    const buffer = await stabilityRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    logCost(`Scene for "${roomName}"`, COSTS.imgPrompt + COSTS.image);

    res.json({ image: `data:image/jpeg;base64,${base64}`, prompt: scenePrompt });

  } catch (err) {
    console.error('Map generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── /condense — summarize chat history into a compact block ──────────
app.post('/condense', async (req, res) => {
  const { messages = [] } = req.body;
  if (!messages.length) return res.status(400).json({ error: 'messages required' });
  const joined = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  try {
    const r = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [{ role: 'user', content: `Summarize this D&D assistant conversation in 3-5 bullet points, preserving key facts, decisions, rulings, and context the DM may need later:\n\n${joined}` }],
    });
    logCost('Chat condense', COSTS.brief);
    res.json({ summary: r.content[0].text.trim() });
  } catch (err) {
    console.error('Condense error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── /scene-prep — AI scene grouping + party hooks for session prep ────
app.post('/scene-prep', async (req, res) => {
  const { dungeonText, party = [], campaignNotes = '' } = req.body;
  if (!dungeonText) return res.status(400).json({ error: 'dungeonText required' });

  const partySection = party.length
    ? party.map(p => `**${p.name}**${p.class ? ` (${p.class})` : ''}:\n${p.background}`).join('\n\n---\n\n')
    : 'No party backgrounds provided.';

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `You are an expert D&D 5e Dungeon Master assistant specializing in Foundry VTT session prep. You analyze dungeon descriptions and break them into logical scene groupings, considering monster awareness, sound propagation, patrol routes, and party character hooks.

Always respond with ONLY valid JSON — no prose before or after.`,
      messages: [{
        role: 'user',
        content: `Analyze this dungeon description and break it into logical Foundry VTT scenes. Group areas by:
- Monster awareness and sound radius (what would hear combat nearby)
- Natural chokepoints, doors, and gates
- Logical encounter zones (areas that form a single combat space)

For each scene, generate specific hooks tied to each party member's background.

DUNGEON TEXT:
${dungeonText}

PARTY BACKGROUNDS:
${partySection}

${campaignNotes ? `CAMPAIGN NOTES / AD-LIB IDEAS:\n${campaignNotes}` : ''}

Return JSON:
{
  "scenes": [
    {
      "name": "Short scene name with area numbers e.g. Crystal Cavern (4d–4e)",
      "areas": ["4d", "4e"],
      "description": "2-3 sentence GM description of what this scene contains and its atmosphere",
      "alertChain": "Specific description: if combat starts here, which nearby creatures hear it, how far sound travels, how long before they respond",
      "gridSuggestion": "e.g. 40x30 squares",
      "partyHooks": [
        { "character": "Character name", "hook": "1-2 sentence hook connecting this scene to their background or secret" }
      ],
      "adlibSuggestions": [
        "A quick tailored ad-lib idea for this scene"
      ]
    }
  ]
}`,
      }],
    });

    const text = msg.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const data = JSON.parse(jsonMatch[0]);
    logCost('scene-prep', 0.003);
    res.json(data);
  } catch (err) {
    console.error('scene-prep error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── /chat — global DM assistant with intent detection ────────────────
const INTENT_IMAGE = /\b(draw|sketch|paint|picture|image|art|illustrate|visualize)\b/i;
const INTENT_BRIEF = /\b(brief me|briefing|give me a brief)\b/i;

app.post('/chat', async (req, res) => {
  const { messages = [], userMessage } = req.body;

  if (!userMessage) return res.status(400).json({ error: 'userMessage required' });

  try {
    // ── Image intent ──
    if (INTENT_IMAGE.test(userMessage)) {
      if (!process.env.STABILITY_API_KEY) {
        return res.status(500).json({ error: 'STABILITY_API_KEY not configured' });
      }

      const promptMsg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{ role: 'user', content: `Write a Stable Diffusion image prompt (max 40 words) for a D&D fantasy illustration based on this request: "${userMessage}". Style: detailed fantasy art, dramatic lighting. Output only the prompt.` }],
      });
      const imagePrompt = promptMsg.content[0].text.trim();
      console.log(`🎨 Chat image prompt: ${imagePrompt}`);

      const form = new FormData();
      form.append('prompt', imagePrompt);
      form.append('output_format', 'jpeg');

      const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`, 'Accept': 'image/*' },
        body: form,
      });

      if (!stabilityRes.ok) {
        const errText = await stabilityRes.text();
        return res.status(500).json({ error: `Stability AI ${stabilityRes.status}: ${errText}` });
      }

      const buffer = await stabilityRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      logCost(`Chat image`, COSTS.imgPrompt + COSTS.image);
      return res.json({ type: 'image', image: `data:image/jpeg;base64,${base64}`, prompt: imagePrompt });
    }

    // ── Brief intent ──
    if (INTENT_BRIEF.test(userMessage)) {
      const briefMsg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: `You are a D&D 5e expert helping a Dungeon Master run a game right now. The DM asked: "${userMessage}". Give a concise 3-4 bullet DM briefing covering the most useful table-ready info. Be punchy — this is a quick reference card.` }],
      });
      const text = briefMsg.content[0].text.trim();
      logCost(`Chat brief`, COSTS.brief);
      return res.json({ type: 'brief', text });
    }

    // ── Text / conversation ──
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: 'You are a helpful D&D 5e Dungeon Master assistant. Answer concisely. Help the DM run their game at the table right now.',
      messages: [...messages, { role: 'user', content: userMessage }],
    });
    const text = response.content[0].text.trim();
    logCost(`Chat text`, COSTS.brief);
    return res.json({ type: 'text', text });

  } catch (err) {
    console.error('Chat API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── /token/describe — Claude Vision only, returns character description for prompt editing
app.post('/token/describe', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'image required' });
  try {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mediaType  = (image.match(/^data:(image\/\w+);base64,/) || [])[1] || 'image/jpeg';
    const visionMsg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: 'Describe this character for a Stable Diffusion prompt. Focus on: race/species, gender, hair color and style, skin tone, clothing and armor colors and style, any weapons or accessories. Comma-separated descriptors only, no sentences. Max 50 words.' },
        ],
      }],
    });
    logCost('Token describe', COSTS.imgPrompt);
    res.json({ description: visionMsg.content[0].text.trim() });
  } catch (err) {
    console.error('Token describe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── /token — generate from prompt + remove background → transparent PNG
app.post('/token', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (!process.env.STABILITY_API_KEY) return res.status(500).json({ error: 'STABILITY_API_KEY not configured' });

  try {
    // Step 1 — Generate
    console.log(`🎨 Token generating: ${prompt.slice(0, 80)}...`);
    const genForm = new FormData();
    genForm.append('prompt', prompt);
    genForm.append('negative_prompt', 'frontal portrait, face close-up, side view, landscape, text, watermark, blurry');
    genForm.append('output_format', 'png');
    genForm.append('aspect_ratio', '1:1');

    const genRes = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`, 'Accept': 'image/*' },
      body: genForm,
    });
    if (!genRes.ok) {
      const errText = await genRes.text();
      return res.status(500).json({ error: `Stability generate ${genRes.status}: ${errText}` });
    }
    const genBuffer = Buffer.from(await genRes.arrayBuffer());
    logCost('Token generate', COSTS.image);

    // Step 2 — Remove background
    console.log('🎨 Token removing background...');
    const bgForm = new FormData();
    bgForm.append('image', new Blob([genBuffer], { type: 'image/png' }), 'token.png');
    bgForm.append('output_format', 'png');

    const bgRes = await fetch('https://api.stability.ai/v2beta/stable-image/edit/remove-background', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`, 'Accept': 'image/*' },
      body: bgForm,
    });
    if (!bgRes.ok) {
      console.warn('⚠ Background removal failed, returning flat image');
      return res.json({ image: `data:image/png;base64,${genBuffer.toString('base64')}` });
    }
    const finalBase64 = Buffer.from(await bgRes.arrayBuffer()).toString('base64');
    logCost('Token bg-remove', COSTS.image * 0.2);
    res.json({ image: `data:image/png;base64,${finalBase64}` });

  } catch (err) {
    console.error('Token generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`DM Panic Button AI server running on http://localhost:${PORT}`);
  console.log(`Anthropic API key: ${process.env.ANTHROPIC_API_KEY ? 'loaded' : 'MISSING'}`);
  console.log(`Stability API key: ${process.env.STABILITY_API_KEY ? 'loaded' : 'not configured (image gen disabled)'}`);
});
