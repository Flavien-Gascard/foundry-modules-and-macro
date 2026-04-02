// === REMOVE BLOODIED ===
// Called by Triggler when HP rises back above 50% of max.
// actor and token are injected into scope by Triggler.

const BLOODIED_ID   = "bloodied";
const BLOODIED_ICON = "systems/dnd5e/icons/svg/statuses/bloodied.svg";

if (!actor) { console.warn("remove-bloodied | no actor in scope"); return; }

const effect = actor.effects.find(e =>
  e.getFlag("core", "statusId") === BLOODIED_ID || e.statuses?.has(BLOODIED_ID)
);
if (!effect) return;

await effect.delete();

// Chat message
const tokenName = token?.name ?? actor.name;
const speaker   = ChatMessage.getSpeaker({ actor, token: token?.document ?? token });

ChatMessage.create({
  speaker,
  content: `<div style="display:flex;align-items:center;gap:10px">
    <img src="${BLOODIED_ICON}" style="width:36px;height:36px;border:none;border-radius:4px;opacity:0.4" />
    <div>
      <strong style="color:#4caf50">${tokenName}</strong> is no longer <strong style="color:#cc2200">Bloodied</strong>.
      <div style="font-size:0.85em;color:#888;margin-top:2px">HP recovered above 50%.</div>
    </div>
  </div>`,
  flags: { "flavien-condition-lab": { bloodied: false } }
});
