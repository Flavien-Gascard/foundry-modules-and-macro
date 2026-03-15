import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Session cost tracker ──────────────────────────────────────────────
const COSTS = {
  taunt:  0.000025,   // Claude Haiku ~80 tokens
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
  'beast', 'monstrosity', 'ooze', 'plant', 'swarm',
]);

// Tone prompts for speaking creatures
const TONE = {
  menacing:  "You are a dark and terrifying creature. Speak with cold, predatory menace.",
  taunting:  "You are a cruel and mocking creature. Speak with gleeful contempt for your enemy.",
  dramatic:  "You are a dramatic villain. Speak with theatrical flair and grandiosity.",
  comedic:   "You are a bumbling but dangerous monster. Speak with unintentional comic menace.",
};

const SIZE_LABEL = { tiny:'tiny', sm:'small', med:'medium', lg:'large', huge:'huge', grg:'gargantuan' };

function buildPrompt(data) {
  const {
    attackerName, attackerType, attackName, targetName, hit, tone = 'menacing',
    hpPct = 100, cr = null, alignment = '', intScore = 10, chaScore = 10,
    immunities = [], resistances = [], conditionImmunities = [],
    languages = [], size = 'med', specialAbilities = [],
  } = data;

  const isBeast = BEAST_TYPES.has(attackerType?.toLowerCase());
  const situation = hit
    ? `It just struck ${targetName} with its ${attackName}.`
    : `It just missed ${targetName} with its ${attackName}.`;

  // Build context notes
  const contextLines = [];
  if (cr !== null)  contextLines.push(`Challenge Rating: ${cr} (${cr >= 10 ? 'apex predator — utterly confident' : cr >= 5 ? 'dangerous and experienced' : 'scrappy and aggressive'})`);
  if (hpPct <= 25)  contextLines.push(`HP: ${hpPct}% — critically wounded, cornered and furious`);
  else if (hpPct <= 50) contextLines.push(`HP: ${hpPct}% — bloodied, fighting harder`);
  else              contextLines.push(`HP: ${hpPct}% — fresh and dominant`);
  if (alignment)    contextLines.push(`Alignment: ${alignment}`);
  if (SIZE_LABEL[size]) contextLines.push(`Size: ${SIZE_LABEL[size]}`);
  if (immunities.length)  contextLines.push(`Immune to: ${immunities.join(', ')} (can mock enemies who use these)`);
  if (resistances.length) contextLines.push(`Resistant to: ${resistances.join(', ')}`);
  if (conditionImmunities.length) contextLines.push(`Cannot be: ${conditionImmunities.join(', ')} (utterly untouchable by those)`);
  if (specialAbilities.length) contextLines.push(`Special abilities: ${specialAbilities.join(', ')}`);
  if (languages.length && !isBeast) contextLines.push(`Speaks: ${languages.join(', ')}`);
  if (intScore <= 6)  contextLines.push(`INT ${intScore}: very low — speak simply, no complex vocabulary`);
  else if (intScore >= 16) contextLines.push(`INT ${intScore}: highly intelligent — can be eloquent or cunning`);
  if (chaScore <= 6)  contextLines.push(`CHA ${chaScore}: brutish — crude, blunt, no flair`);
  else if (chaScore >= 16) contextLines.push(`CHA ${chaScore}: magnetic — commanding, theatrical presence`);

  const contextBlock = contextLines.length ? `\nCreature context:\n${contextLines.map(l => `- ${l}`).join('\n')}\n` : '';

  if (isBeast) {
    const beastMood = hpPct <= 25 ? 'wounded and desperate' : hpPct <= 50 ? 'bloodied and frenzied' : 'dominant';
    return `You are narrating the behavior of ${attackerName}, a ${attackerType} that cannot speak.
${situation}
Creature is ${beastMood}.${contextBlock}
Describe 1 brief animalistic reaction — a sound, posture, or instinctive behavior (max 15 words).
Write in third person. No dialogue. Make it visceral and specific to this creature type.
Examples: "It snaps its jaws and lets out a guttural snarl." or "It recoils, hissing, eyes locked on its prey."`;
  }

  const toneInstruction = TONE[tone] || TONE.menacing;
  const speakSituation = hit
    ? `You just struck ${targetName} with your ${attackName}.`
    : `You just missed ${targetName} with your ${attackName}.`;
  const moodHint = hpPct <= 25 ? 'You are gravely wounded — rage or desperation bleeds through your words.'
    : hpPct <= 50 ? 'You are bloodied but unbowed.' : '';

  return `${toneInstruction}
You are ${attackerName}, a ${attackerType}.
${speakSituation}
${moodHint}${contextBlock}
Say something in character — 1 short sentence, max 20 words.
Reference your nature (abilities, what you're immune to, your power) if it fits naturally.
No quotation marks. No stage directions. Just the spoken words.`;
}

app.post('/npc-taunt', async (req, res) => {
  const { attackerName = 'unknown' } = req.body;
  const prompt = buildPrompt(req.body);

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    logCost(`Taunt for "${attackerName}"`, COSTS.taunt);
    res.json({ text });
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
    messages: [{ role: 'user', content: `Write a Stable Diffusion image prompt (max 40 words) for a D&D fantasy illustration of ${subject}.${bio ? ` Context: ${bio.slice(0, 150)}` : ''} Style: detailed fantasy art, dramatic lighting. Output only the prompt.` }],
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
    form.append('output_format', 'jpeg');

    const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
        'Accept': 'image/*',
      },
      body: form,
    });

    if (!stabilityRes.ok) {
      const errText = await stabilityRes.text();
      console.error('Stability AI error:', errText);
      return res.status(500).json({ error: `Stability AI ${stabilityRes.status}: ${errText}` });
    }

    const buffer = await stabilityRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    logCost(`Image for "${name}"`, COSTS.imgPrompt + COSTS.image);

    res.json({ image: `data:image/jpeg;base64,${base64}`, prompt: imagePrompt });

  } catch (err) {
    console.error('Image generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── /generate-map — top-down battle map from room description ─────────
const SPACE_LABELS = {
  room:     'enclosed stone dungeon room',
  cavern:   'natural cave cavern with rough rocky walls',
  corridor: 'narrow dungeon corridor passage',
  open:     'open area with minimal walls',
  chamber:  'large grand chamber hall',
};

app.post('/generate-map', async (req, res) => {
  const { roomName, description, spaceType = 'room', exits = [] } = req.body;

  if (!process.env.STABILITY_API_KEY) {
    return res.status(500).json({ error: 'STABILITY_API_KEY not configured in .env' });
  }

  const spaceLabel = SPACE_LABELS[spaceType] || 'dungeon room';
  const exitDesc = exits.length > 0
    ? 'Exits: ' + exits.map(e => `${e.doorType.replace(/-/g,' ')} on ${e.direction} wall (${e.state})`).join(', ')
    : '';

  try {
    const promptMsg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{ role: 'user', content: `Write a Stable Diffusion image prompt (max 50 words) for a top-down D&D battle map. Location: "${roomName}" (${spaceLabel}). Context: ${(description || '').slice(0, 150)}${exitDesc ? '. ' + exitDesc : ''}. Style: top-down bird's eye view, grid-aligned dungeon tiles, detailed floor texture, no characters, fantasy tabletop RPG map. Output only the prompt.` }],
    });
    const mapPrompt = promptMsg.content[0].text.trim();
    console.log(`🗺 Generating battle map for "${roomName}": ${mapPrompt}`);

    const form = new FormData();
    form.append('prompt', mapPrompt);
    form.append('output_format', 'jpeg');
    form.append('aspect_ratio', '1:1');

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
    logCost(`Battle map for "${roomName}"`, COSTS.imgPrompt + COSTS.image);

    res.json({ image: `data:image/jpeg;base64,${base64}`, prompt: mapPrompt });

  } catch (err) {
    console.error('Map generation error:', err.message);
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

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`DM Panic Button AI server running on http://localhost:${PORT}`);
  console.log(`Anthropic API key: ${process.env.ANTHROPIC_API_KEY ? 'loaded' : 'MISSING'}`);
  console.log(`Stability API key: ${process.env.STABILITY_API_KEY ? 'loaded' : 'not configured (image gen disabled)'}`);
});
