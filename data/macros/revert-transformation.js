// === REVERT TRANSFORMATION MACRO ===
// Reverts polymorphed/transformed tokens back to their original form.

const controlled = canvas.tokens.controlled;

if (!controlled.length) {
  ui.notifications.warn("Select one or more tokens to revert.");
  return;
}

async function revert(token) {
  const actor = token.actor;
  if (!actor) return false;

  // Try known dnd5e method names across versions
  if (typeof actor.revertPolymorphism === 'function') {
    await actor.revertPolymorphism();
    return true;
  }
  if (typeof actor.unpolymorph === 'function') {
    await actor.unpolymorph();
    return true;
  }

  // Manual fallback: restore original actor from flags
  const originalId = actor.getFlag("dnd5e", "originalActor")
    ?? actor.getFlag("dnd5e", "previousActorIds")?.[0];

  if (originalId) {
    await token.document.update({ actorId: originalId, actorLink: true, "actorData": {} });
    return true;
  }

  // Last resort: check if actor has transformData stored
  const transformData = actor.getFlag("dnd5e", "transformOptions");
  if (transformData) {
    const original = game.actors.get(transformData.originalActorId);
    if (original) {
      await token.document.update({ actorId: original.id, actorLink: true });
      return true;
    }
  }

  return false;
}

let reverted = 0;
let failed   = 0;

for (const token of controlled) {
  try {
    const ok = await revert(token);
    ok ? reverted++ : failed++;
  } catch (e) {
    console.error("Revert transformation error:", e);
    ui.notifications.error(`Failed to revert ${token.actor?.name ?? token.name}: ${e.message}`);
    failed++;
  }
}

if (reverted)
  ui.notifications.info(`✅ Reverted ${reverted} transformation${reverted !== 1 ? 's' : ''}.`);
if (failed && !reverted)
  ui.notifications.warn("Could not revert — token may not be transformed, or transformation method is unsupported. Try sharing the actor JSON for a targeted fix.");
