
/* =================================================
 * TOKEN HUD BUTTON (renderTokenHUD hook for Foundry v13)
================================================= */

Hooks.on("renderTokenHUD", (hud, html, token) => {
  if (!game.user.isGM) return;
  // Avoid duplicate buttons
    if ($(html).find(".panic-token-btn").length) return;
  // Create Panic Button
  const panicBtn = $(
    `<button type="button" class="control-icon panic-token-btn" title="DM Panic Button">
      <i class="fas fa-fire"></i>
    </button>`
  );
  // Custom style for visibility and order
  panicBtn.css({ order: -100, marginBottom: "4px", background: "#fff", color: "#c00", border: "2px solid #c00" });
  panicBtn.on("click", () => {
    const existing = Object.values(ui.windows)
      .find(w => w instanceof globalThis.DMPanicButton);
    if (existing) {
      existing.bringToTop();
    } else {
      new globalThis.DMPanicButton().render(true);
    }
  });
  // Always prepend to the right column
  $(html).find(".col.right").prepend(panicBtn);
});
/*************************************************
 * DM PANIC BUTTON
 * World Control Console (V13 Stable)
 *************************************************/

console.log("🔥 DM Panic Button Loaded");


/* =================================================
 * APPLICATION
================================================= */

export class DMPanicButton extends Application {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dm-panic-button",
      title: "DM Panic Button",
      template: "modules/dm-panic-button/panic.html",
      width: 520,
      height: 650,
      popOut: true,
      resizable: true
    });
  }
}

Hooks.once("ready", () => {
  globalThis.DMPanicButton = DMPanicButton;
});


/* =================================================
 * HOTKEY
================================================= */

Hooks.once("setup", () => {

  game.keybindings.register("dm-panic-button", "open", {
    name: "Open DM Panic Button",
    editable: [{ key: "Space", modifiers: ["CONTROL"] }],

    onDown: () => {

      const existing = Object.values(ui.windows)
        .find(w => w instanceof globalThis.DMPanicButton);

      if (existing) {
        existing.close();
        return true;
      }

      new globalThis.DMPanicButton().render(true);
      return true;
    }
  });
});


/* =================================================
 * STATE
================================================= */

let pendingSpawnEntry = null;


/* =================================================
 * HELPERS
================================================= */

function getSelectedActor() {
  return canvas.tokens.controlled[0]?.actor ?? null;
}


/* =================================================
 * FUZZY SEARCH
================================================= */

function fuzzyScore(query, target) {

  query = query.toLowerCase();
  target = target.toLowerCase();

  let score = 0;
  let qi = 0;

  for (let i = 0; i < target.length && qi < query.length; i++) {
    if (target[i] === query[qi]) {
      score += 2;
      qi++;
    } else {
      score -= 0.25;
    }
  }

  if (qi === query.length) score += 5;

  return score;
}


/* =================================================
 * WORLD SEARCH
================================================= */

function searchDocuments(query) {

  const results = [];

  const scan = (collection, type) => {
    collection.contents.forEach(doc => {

      if (!doc?.name) return;

      const score = fuzzyScore(query, doc.name);

      if (score > 0) {
        results.push({
          name: doc.name,
          type,
          document: doc,
          score
        });
      }
    });
  };

  scan(game.actors,"Actor");
  scan(game.items,"Item");
  scan(game.journal,"Journal");
  scan(game.scenes,"Scene");
  scan(game.tables,"RollTable");
  scan(game.macros,"Macro");

  return results.sort((a,b)=>b.score-a.score);
}


/* =================================================
 * SPAWN PLACEMENT
================================================= */

function startSpawnPlacement(entry) {

  pendingSpawnEntry = entry;

  ui.notifications.info(
    "Click on the map to place the token."
  );

  canvas.stage.once("pointerdown", handleSpawnClick);
}


async function handleSpawnClick(event) {

  if (!pendingSpawnEntry) return;

  const scene = game.scenes.current;
  if (!scene) return;

  const actor = pendingSpawnEntry.document;
  if (!actor) return;

  const tokenDoc = await actor.getTokenDocument();

  const world = canvas.stage.worldTransform.applyInverse(
    event.data.global
  );

  // ✅ V13+ safe grid snapping
  let snapped = { x: world.x, y: world.y };
  try {
    if (canvas?.grid?.getSnappedPoint) {
      // Only pass x and y for Foundry v13 compatibility
      snapped = canvas.grid.getSnappedPoint({ x: world.x, y: world.y }) || snapped;
    }
  } catch (err) {
    console.error("DM Panic Button: getSnappedPoint failed", err);
    // fallback to unsnapped coordinates
  }

  tokenDoc.updateSource({
    x: snapped.x,
    y: snapped.y
  });

  await scene.createEmbeddedDocuments("Token", [
    tokenDoc.toObject()
  ]);

  ui.notifications.info(`${actor.name} spawned.`);

  pendingSpawnEntry = null;
}


/* =================================================
 * ACTION ENGINE
================================================= */

async function runContextAction(action, entry) {

  console.log("PANIC ACTION:", action, entry);  // cancel placement if another action used
  pendingSpawnEntry = null;

  const actor = getSelectedActor();
  const doc = entry.document;

  switch (action) {

    /* ---------- Generic ---------- */

    case "open":
      doc.sheet?.render(true);
      break;

    case "chat":
      ChatMessage.create({
        content: `<b>${doc.name}</b>`
      });
      break;


    /* ---------- Actor ---------- */

    case "spawn":
      startSpawnPlacement(entry);
      break;



    /* ---------- Item, Feature, Spell, Effect ---------- */

    case "give-item":
  if (!actor) return;
  // Handle Items (including spells/features)
  if (doc.documentName === "Item" || doc instanceof Item) {
    await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
    ui.notifications.info(`${doc.name} added to ${actor.name}`);
  }
  // Handle Active Effects
  else if (doc.documentName === "ActiveEffect" || doc instanceof ActiveEffect) {
    await actor.createEmbeddedDocuments("ActiveEffect", [doc.toObject()]);
    ui.notifications.info(`Effect '${doc.name}' added to ${actor.name}`);
  }
  break;


    /* ---------- Scene ---------- */

    case "view-scene": {
      const scene = game.scenes.get(doc.id);
      if (!scene) return;
      await scene.view();
      break;
    }

    case "switch-scene": {
      const scene = game.scenes.get(doc.id);
      if (!scene) return;
      await scene.activate();
      break;
    }
  }
}


/* =================================================
 * UI RENDER
================================================= */

Hooks.on("renderDMPanicButton",(app,html)=>{

  const input = html.find("#panic-search");
  const resultsDiv = html.find("#panic-results");


  function renderResults(list){

    resultsDiv.empty();


    const actorSelected = getSelectedActor();

    list.forEach(entry=>{
      const isActive =
        entry.type === "Scene" &&
        entry.document.active;

      // Allow Give for Items, Spells, Features, Effects
      const canGive = actorSelected && (entry.type === "Item" || entry.type === "ActiveEffect");

      const actions = `
        <div class="panic-actions">
          <button class="panic-btn" data-action="open">👁 Open</button>
          <button class="panic-btn" data-action="chat">💬 Chat</button>
          ${entry.type==="Actor"
            ? `<button class="panic-btn" data-action="spawn">🧙 Spawn</button>`
            : ""}
          ${entry.type==="Scene"
            ? `
              <button class="panic-btn" data-action="view-scene">👁 View</button>
              <button class="panic-btn" data-action="switch-scene">🗺 Switch</button>
            `
            : ""}
          ${canGive
            ? `<button class="panic-btn" data-action="give-item">➕ Give</button>`
            : ""}
        </div>
      `;

      const el=$(`
        <div class="panic-result">
          <div class="panic-main">
            <strong>
              ${entry.name}
              ${isActive ? " ⭐" : ""}
            </strong>
            <div class="panic-type">${entry.type}</div>
          </div>
          ${actions}
        </div>
      `);

      el.find(".panic-btn").on("click", async ev=>{
        ev.stopPropagation();
        await runContextAction(
          ev.currentTarget.dataset.action,
          entry
        );
      });

      resultsDiv.append(el);
    });
  }


  input.on("input", ev=>{

    const query = ev.target.value.trim();

    if(!query){
      resultsDiv.empty();
      return;
    }

    renderResults(searchDocuments(query));
  });

  setTimeout(()=>input.focus(),50);
});