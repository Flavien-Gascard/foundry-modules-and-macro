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
  // Register configurable item pile icon setting
  game.settings.register("dm-panic-button", "itemPileIcon", {
    name: "Item Pile Icon URL",
    hint: "URL or relative path for the icon used for item piles placed by the Panic Button. Example: modules/dm-panic-button/data/images/chest.png",
    scope: "world",
    config: true,
    type: String,
    default: "modules/dm-panic-button/data/images/chest.png"
  });
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
      const snapArg = { x: world.x, y: world.y };
      const snapResult = canvas.grid.getSnappedPoint(snapArg);
      if (snapResult && typeof snapResult.x === "number" && typeof snapResult.y === "number") {
        snapped = snapResult;
      } else {
        // fallback silently if snapResult is invalid
      }
    }
  } catch (err) {
    // Only log if not a known harmless error
    if (!(err instanceof TypeError)) {
      console.error("DM Panic Button: getSnappedPoint failed", err);
    }
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
 * ITEM PLACEMENT (Loot Token)
================================================= */

function startItemPlacement(entry) {
  console.log("DM Panic Button: startItemPlacement called", entry);
  pendingSpawnEntry = entry;
  ui.notifications.info("Click on the map to place the item as loot.");
  canvas.stage.once("pointerdown", handleItemPlaceClick);
}

async function handleItemPlaceClick(event) {
  console.log("DM Panic Button: handleItemPlaceClick called", event);
  if (!pendingSpawnEntry) {
    console.warn("DM Panic Button: No pendingSpawnEntry in handleItemPlaceClick");
    return;
  }
  const scene = game.scenes.current;
  if (!scene) {
    console.warn("DM Panic Button: No current scene in handleItemPlaceClick");
    return;
  }
  const item = pendingSpawnEntry.document;
  if (!item) {
    console.warn("DM Panic Button: No item in pendingSpawnEntry");
    return;
  }
  console.log("DM Panic Button: Item image used for placement:", item.img);
  console.log("DM Panic Button: handleItemPlaceClick item", item);
  console.log("DM Panic Button: handleItemPlaceClick scene", scene);

  const world = canvas.stage.worldTransform.applyInverse(event.data.global);
  let snapped = { x: world.x, y: world.y };
  try {
    if (canvas?.grid?.getSnappedPoint) {
      const snapArg = { x: world.x, y: world.y };
      const snapResult = canvas.grid.getSnappedPoint(snapArg);
      if (snapResult && typeof snapResult.x === "number" && typeof snapResult.y === "number") {
        snapped = snapResult;
      }
    }
  } catch (err) {
    if (!(err instanceof TypeError)) {
      console.error("DM Panic Button: getSnappedPoint failed", err);
    }
  }

  // Convert spells to scrolls for loot placement
  let lootItem = item;
  if (item.type === "spell") {
    // Create a scroll item from the spell
    lootItem = await Item.create({
      name: `Scroll of ${item.name}`,
      type: "consumable",
      img: item.img || "icons/commodities/paper/paper-script-spiral-tan.webp",
      data: {
        description: item.system?.description || item.data?.description || {},
        consumableType: "scroll",
        uses: { value: 1, max: 1, per: "charges" },
        rarity: item.system?.rarity || item.data?.rarity || "common",
        // Embed spell data if your system supports it
        spell: item.toObject()
      }
    }, { temporary: true });
    console.log("DM Panic Button: Converted spell to scroll", lootItem);
  }

  const lootData = {
    name: lootItem.name,
    type: "npc",
    img: lootItem.img,
    flags: { "dm-panic-button": { loot: true } },
    items: [lootItem.toObject()],
    prototypeToken: {
      name: lootItem.name,
      img: lootItem.img,
      actorLink: false,
      disposition: 0,
      scale: 1,
      vision: false,
      flags: { "dm-panic-button": { loot: true } }
    }
  };
  console.log("DM Panic Button: Loot actor image:", lootItem.img);
  const actor = await Actor.create(lootData);
  if (!actor) {
    ui.notifications.error("Failed to create loot actor.");
    pendingSpawnEntry = null;
    return;
  }
  const tokenDoc = await actor.getTokenDocument();
  tokenDoc.updateSource({ x: snapped.x, y: snapped.y });
  const createdTokens = await scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]);
  ui.notifications.info(`Loot '${lootItem.name}' placed.`);

  // Control the newly placed token
  if (createdTokens && createdTokens.length > 0) {
    const placedToken = canvas.tokens.get(createdTokens[0].id);
    if (placedToken) {
      placedToken.control();
      // Find macro by name
      const macro = game.macros.getName("TurnToItemPile");
      if (macro) {
        macro.execute();
        ui.notifications.info("Macro 'TurnToItemPile' executed on placed token.");
      } else {
        ui.notifications.warn("Macro 'TurnToItemPile' not found.");
      }
    } else {
      ui.notifications.warn("Placed token not found on canvas.");
    }
  } else {
    ui.notifications.warn("No token was created for item placement.");
  }
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

    case "place-item":
      startItemPlacement(entry);
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
  const typeFilter = html.find("#panic-type-filter");
  const resultsDiv = html.find("#panic-results");
  const typeOptions = [
    { value: "Actor", label: "Actors" },
    { value: "Item", label: "Items" },
    { value: "Scene", label: "Scenes" },
    { value: "Journal", label: "Journals" },
    { value: "RollTable", label: "RollTables" },
    { value: "Macro", label: "Macros" }
  ];

  function renderResults(list){
    resultsDiv.empty();
    const actorSelected = getSelectedActor();
    list.forEach(entry=>{
      const isActive = entry.type === "Scene" && entry.document.active;
      const canGive = actorSelected && (entry.type === "Item" || entry.type === "ActiveEffect");
      const canPlace = entry.type === "Item";
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
          ${canPlace
            ? `<button class="panic-btn" data-action="place-item">🪙 Place Item</button>`
            : ""}
        </div>
      `;
      const el=$( 
        `<div class="panic-result">
          <div class="panic-main">
            <strong>
              ${entry.name}
              ${isActive ? " ⭐" : ""}
            </strong>
            <div class="panic-type">${entry.type}</div>
          </div>
          ${actions}
        </div>`
      );
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

  function doSearch() {
    const query = input.val().trim();
    console.log("doSearch called", { query, typeFilter: typeFilter.val() }); // Debug log
    if(!query){
      resultsDiv.empty();
      typeFilter.hide();
      return;
    }
    let results = searchDocuments(query);
    // Only update dropdown options if search input changed, not on dropdown change
    if (document.activeElement === input[0]) {
      const uniqueTypes = [...new Set(results.map(r => r.type))];
      let optionsHtml = '<option value="all">All</option>';
      const presentTypes = uniqueTypes;
      typeOptions.forEach(opt => {
        if (presentTypes.includes(opt.value)) {
          optionsHtml += `<option value="${opt.value}">${opt.label}</option>`;
        }
      });
      typeFilter.html(optionsHtml);
      // Show/hide dropdown
      if (presentTypes.length <= 1) {
        typeFilter.hide();
        if (presentTypes.length === 1) typeFilter.val(presentTypes[0]);
      } else {
        typeFilter.show();
      }
    }
    const type = typeFilter.val();
    console.log("Filtering results", { type, resultsCount: results.length }); // Debug log
    if (type && type !== "all") {
      results = results.filter(r => r.type === type);
      console.log("Filtered results", results); // Debug log
    }
    renderResults(results);
  }

  input.on("input", doSearch);
  typeFilter.on("change", function() {
    setTimeout(() => {
      console.log("Dropdown changed", typeFilter.val()); // Debug log
      doSearch();
    }, 0);
  });

  setTimeout(()=>input.focus(),50);
});