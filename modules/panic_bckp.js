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
  const resultsDiv = html.find("#panic-results");
  const typeOptions = [
    { value: "all", label: "All" },
    { value: "Actor", label: "Actors" },
    { value: "Item", label: "Items" },
    { value: "Scene", label: "Scenes" },
    { value: "Journal", label: "Journals" },
    { value: "RollTable", label: "RollTables" },
    { value: "Macro", label: "Macros" }
  ];

  // Insert category menu
    let menuHtml = `<div id="panic-category-menu" class="panic-category-menu" style="margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 5px;">`;
    typeOptions.forEach(opt => {
      menuHtml += `<button class="panic-category-btn panic-pill" data-type="${opt.value}" style="
        background: linear-gradient(135deg, #232526 0%, #414345 100%);
        border: 1.5px solid #bfa046;
        border-radius: 12px;
        padding: 3px 12px;
        font-family: 'Papyrus', 'IM Fell English', 'Cinzel Decorative', serif;
        font-size: 0.98em;
        font-weight: bold;
        color: #e7d7a1;
        text-shadow: 0 0 4px #bfa046, 0 0 1px #000;
        box-shadow: 0 1px 4px #000a;
        cursor: pointer;
        width: auto;
        min-width: 0;
        letter-spacing: 0.5px;">
        ${opt.label}</button>`;
    });
    menuHtml += `</div>`;
    input.parent().before($(menuHtml));
    // Always insert a horizontal line between filters and search bar
    html.find('#panic-type-search-hr').remove();
    html.find('#panic-category-menu').after('<hr id="panic-type-search-hr" style="border:0;border-top:1.5px solid #bfa046;margin:8px 0 4px 0;">');

  let selectedType = "all";
  let selectedItemSubtype = "all";
  function updateCategoryMenu() {
    html.find(".panic-category-btn").each(function() {
      const btn = $(this);
      if (btn.data("type") === selectedType) {
        btn.css({ background: "#c00", color: "#fff", borderColor: "#c00" });
      } else {
        btn.css({ background: "#eee", color: "#222", borderColor: "#bbb" });
      }
    });

    // Remove old subtype menu
    html.find("#panic-subtype-menu").remove();
    // Show subtype pills if Item selected
    if (selectedType === "Item") {
      // Get all unique item types (e.g., weapon, armor, consumable, tool, loot, container)
      let allItems = game.items.contents;
      let subtypes = [...new Set(allItems.map(i => i.type || i.system?.type?.value || ""))].filter(Boolean);
      if (subtypes.length) {
        let subtypeHtml = `<div id="panic-subtype-menu" style="margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 5px;">`;
        const pillStyle = `background: linear-gradient(135deg, #232526 0%, #414345 100%); border: 1.5px solid #bfa046; border-radius: 12px; padding: 3px 12px; font-family: 'Papyrus', 'IM Fell English', 'Cinzel Decorative', serif; font-size: 0.98em; font-weight: bold; color: #e7d7a1; text-shadow: 0 0 4px #bfa046, 0 0 1px #000; box-shadow: 0 1px 4px #000a; cursor: pointer; width: auto; min-width: 0; letter-spacing: 0.5px;`;
        subtypeHtml += `<button class="panic-subtype-btn panic-pill" data-subtype="all" style="${pillStyle} background:#eee;color:#222;border:1.5px solid #bbb;">All</button>`;
        subtypes.forEach(st => {
          subtypeHtml += `<button class="panic-subtype-btn panic-pill" data-subtype="${st}" style="${pillStyle}">${st}</button>`;
        });
        subtypeHtml += `</div>`;
        html.find("#panic-type-search-hr").after($(subtypeHtml));
        html.find(".panic-subtype-btn").on("click", function() {
          selectedItemSubtype = $(this).data("subtype");
          updateCategoryMenu();
          doSearch();
        });
        html.find(`.panic-subtype-btn[data-subtype='${selectedItemSubtype}']`).css({ background: "#c00", color: "#fff", borderColor: "#c00" });
      }
    }
  }
  html.find(".panic-category-btn").on("click", function() {
    selectedType = $(this).data("type");
    selectedItemSubtype = "all";
    updateCategoryMenu();
    doSearch();
  });
  updateCategoryMenu();


  function renderResults(list){
    resultsDiv.empty();
    const actorSelected = getSelectedActor();
    list.forEach(entry=>{
          const isActive = entry.type === "Scene" && entry.document.active;
          const canGive = actorSelected && (entry.type === "Item" || entry.type === "ActiveEffect");
          const canPlace = entry.type === "Item";
      let detailsHtml = "";
      if (entry.type === "Item") {
        const doc = entry.document;
        const img = doc.img || "icons/svg/item-bag.svg";
            const type = doc.type || doc.system?.type?.value || "";
            const subtype = doc.system?.type?.value || "";
            const rarity = doc.system?.rarity || "";
            const attunement = doc.system?.attunement === "required" ? "Requires Attunement" : "";
            let desc = doc.system?.description?.value || doc.data?.description?.value || "";
            desc = desc.replace(/<[^>]+>/g, "").slice(0, 120) + (desc.length > 120 ? "..." : "");
            detailsHtml = `
              <div class="panic-item-details" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:4px;">
                <img src="${img}" alt="item" style="width:38px;height:38px;object-fit:contain;border-radius:6px;border:1.5px solid #bfa046;background:#222;">
                <div style="flex:1;min-width:0;">
                  <div style="font-size:1.1em;font-weight:bold;">${entry.name}</div>
                  <div style="font-size:0.95em;color:#bfa046;">${type}${subtype && subtype !== type ? ` (${subtype})` : ""}${rarity ? ` | ${rarity}` : ""}${attunement ? ` | ${attunement}` : ""}</div>
                  <div style="font-size:0.93em;color:#bbb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${desc}</div>
                </div>
              </div>
            `;
      }
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
          ${detailsHtml || `<div class="panic-main">
            <strong>
              ${entry.name}
              ${isActive ? " ⭐" : ""}
            </strong>
            <div class="panic-type">${entry.type}</div>
          </div>`}
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
    let results = [];
    // If no query, show all of the selected type (or all types)
    if (!query) {
      // Gather all documents of the selected type
      const addAll = (collection, type) => {
        collection.contents.forEach(doc => {
          if (!doc?.name) return;
          // If Item, filter by subtype if set
          if (type === "Item" && selectedType === "Item" && selectedItemSubtype !== "all") {
            let docType = doc.type || doc.system?.type?.value || "";
            if (docType !== selectedItemSubtype) return;
          }
          results.push({
            name: doc.name,
            type,
            document: doc,
            score: 1 // default score for sorting
          });
        });
      };
      if (selectedType === "all") {
        addAll(game.actors, "Actor");
        addAll(game.items, "Item");
        addAll(game.journal, "Journal");
        addAll(game.scenes, "Scene");
        addAll(game.tables, "RollTable");
        addAll(game.macros, "Macro");
      } else if (selectedType === "Actor") {
        addAll(game.actors, "Actor");
      } else if (selectedType === "Item") {
        addAll(game.items, "Item");
      } else if (selectedType === "Journal") {
        addAll(game.journal, "Journal");
      } else if (selectedType === "Scene") {
        addAll(game.scenes, "Scene");
      } else if (selectedType === "RollTable") {
        addAll(game.tables, "RollTable");
      } else if (selectedType === "Macro") {
        addAll(game.macros, "Macro");
      }
    } else {
      results = searchDocuments(query);
      if (selectedType && selectedType !== "all") {
        results = results.filter(r => r.type === selectedType);
      }
      // If Item, filter by subtype if set
      if (selectedType === "Item" && selectedItemSubtype !== "all") {
        results = results.filter(r => {
          let docType = r.document.type || r.document.system?.type?.value || "";
          return docType === selectedItemSubtype;
        });
      }
    }
    renderResults(results);
  }

  // Remove the old dropdown if present
  html.find("#panic-type-filter").remove();
  input.on("input", doSearch);
  setTimeout(()=>input.focus(),50);
});