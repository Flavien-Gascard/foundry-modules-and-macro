/* =================================================
 * DM PANIC BUTTON — AI NPC CHATBOT
 * Hooks into dnd5e attack rolls and has NPCs taunt
 * their targets via Claude AI (local proxy server).
 * ================================================= */

console.log("🤖 DM Panic Button | AI NPC Chatbot module loaded");

// ── Settings ─────────────────────────────────────
Hooks.once("ready", () => {
  game.settings.register("dm-panic-button", "aiChatbotEnabled", {
    name: "NPC AI Chatbot",
    hint: "NPCs automatically say something after attacking. Requires the local AI server to be running.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register("dm-panic-button", "aiServerUrl", {
    name: "AI Server URL",
    hint: "URL of the local AI proxy server. Default: http://localhost:3001",
    scope: "world",
    config: true,
    type: String,
    default: "http://localhost:3001",
  });

  game.settings.register("dm-panic-button", "aiChatbotTone", {
    name: "NPC Chatbot Tone",
    hint: "Personality tone for NPC taunts.",
    scope: "world",
    config: true,
    type: String,
    default: "menacing",
    choices: {
      menacing: "Menacing",
      taunting: "Taunting",
      dramatic: "Dramatic",
      comedic:  "Comedic",
    },
  });

  game.settings.register("dm-panic-button", "aiChatbotWhisper", {
    name: "Whisper Taunts to GM Only",
    hint: "If enabled, AI taunts are only visible to the GM. Disable to post publicly.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
});

// ── Hook into attack rolls ────────────────────────
Hooks.on("createChatMessage", async (message) => {
  // Feature gate
  if (!game.settings.get("dm-panic-button", "aiChatbotEnabled")) return;

  // Only GM triggers the AI call (prevents duplicate calls per client)
  if (!game.user.isGM) return;

  // Must be a dnd5e attack roll
  const rollType = message.flags?.dnd5e?.roll?.type;
  if (rollType !== "attack") return;

  // Get the attacking actor
  const actorId = message.speaker?.actor;
  const actor = game.actors?.get(actorId);
  if (!actor) return;

  // Only NPCs speak
  if (actor.type !== "npc") return;

  // Gather context
  const attackerName = message.speaker?.alias || actor.name;
  const attackerType = actor.system?.details?.type?.subtype
    || actor.system?.details?.type?.value
    || "creature";
  const attackName   = message.flavor || "attack";
  const roll         = message.rolls?.[0];
  const rollTotal    = roll?.total ?? 0;

  // Determine hit vs miss (compare against first targeted token's AC)
  const targets      = Array.from(game.user.targets ?? []);
  const targetToken  = targets[0];
  const targetName   = targetToken?.name || "you";
  const targetAC     = targetToken?.actor?.system?.attributes?.ac?.value ?? 10;
  const hit          = rollTotal >= targetAC;

  const serverUrl    = game.settings.get("dm-panic-button", "aiServerUrl");
  const tone         = game.settings.get("dm-panic-button", "aiChatbotTone");
  const whisper      = game.settings.get("dm-panic-button", "aiChatbotWhisper");

  try {
    const res = await fetch(`${serverUrl}/npc-taunt`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attackerName,
        attackerType,
        attackName,
        damage:  0,       // damage not known yet at attack-roll time
        targetName,
        hit,
        tone,
      }),
    });

    if (!res.ok) {
      console.warn(`DM Panic Button | AI server responded ${res.status}`);
      return;
    }

    const { text } = await res.json();
    if (!text) return;

    // Post the taunt as a chat message
    await ChatMessage.create({
      content: `<span style="font-style:italic;color:#c9a84c">${attackerName}:</span> "${text}"`,
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper: whisper ? ChatMessage.getWhisperRecipients("GM") : [],
    });

  } catch (err) {
    console.error("DM Panic Button | AI chatbot error:", err);
  }
});
