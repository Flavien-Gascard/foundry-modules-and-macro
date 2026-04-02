// === APPLY BLOODIED — chat announcement only ===
// dnd5e handles applying the effect. This macro just posts the chat message.
// actor and token are injected by Triggler.

const BLOODIED_ICON = "https://assets.forge-vtt.com/650a12e4c6ef680ef6c51e25/Assets/conditions/bloodied.png";

if (!actor) return;

const tokenName = token?.name ?? actor.name;
const speaker   = ChatMessage.getSpeaker({ actor, token: token?.document ?? token });

ChatMessage.create({
  speaker,
  content: `<div style="display:flex;align-items:center;gap:10px">
    <img src="${BLOODIED_ICON}" style="width:36px;height:36px;border:none;border-radius:4px" />
    <div>
      <strong style="color:#cc2200">${tokenName}</strong> is <strong style="color:#cc2200">Bloodied!</strong>
      <div style="font-size:0.85em;color:#888;margin-top:2px">HP dropped to or below 50%.</div>
    </div>
  </div>`
});
