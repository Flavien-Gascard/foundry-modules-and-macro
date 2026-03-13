import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Tone prompts
const TONE = {
  menacing:  "You are a dark and terrifying creature. Speak with cold, predatory menace.",
  taunting:  "You are a cruel and mocking creature. Speak with gleeful contempt for your enemy.",
  dramatic:  "You are a dramatic villain. Speak with theatrical flair and grandiosity.",
  comedic:   "You are a bumbling but dangerous monster. Speak with unintentional comic menace.",
};

app.post('/npc-taunt', async (req, res) => {
  const { attackerName, attackerType, attackName, damage, targetName, hit, tone = 'menacing' } = req.body;

  const toneInstruction = TONE[tone] || TONE.menacing;

  const situation = hit
    ? `You just struck ${targetName} with your ${attackName} for ${damage} damage.`
    : `You just missed ${targetName} with your ${attackName}.`;

  const prompt = `${toneInstruction}
You are ${attackerName}, a ${attackerType}.
${situation}
Say something in character — 1 short sentence, max 20 words.
No quotation marks. No stage directions. Just the spoken words.`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }],
    });

    res.json({ text: message.content[0].text.trim() });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`DM Panic Button AI server running on http://localhost:${PORT}`);
  console.log(`API key: ${process.env.ANTHROPIC_API_KEY ? 'loaded' : 'MISSING — check your .env file'}`);
});
