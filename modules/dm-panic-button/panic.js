import { FILTER_CONFIG, getSubSubtypeLabel, getSubSubtypeOptions, isNoPlacement } from './filter-types.js';

// Module-level map: spell identifier/name → array of class identifiers
let spellClassMap = null;
let spellClassMapLoading = false;

// Helper to get spell school labels
function getSpellSchoolLabel(schoolCode) {
  return FILTER_CONFIG.Item?.spellSchools?.[schoolCode] || schoolCode;
}

// Helper to get spell class labels
function getSpellClassLabel(classCode) {
  return FILTER_CONFIG.Item?.spellClasses?.[classCode] || classCode;
}

/**
 * Builds the spell-class mapping from CONFIG.DND5E.SPELL_LISTS
 * Each spell list is a journal page with system.identifier (class name) and system.spells (Set of UUIDs)
 */
async function buildSpellClassMap() {
  if (spellClassMap || spellClassMapLoading) return spellClassMap;
  spellClassMapLoading = true;
  
  const map = new Map(); // key: spell identifier or name, value: Set of class identifiers
  
  // Only include these core classes (skip subclass/racial/etc spell lists)
  const knownClasses = new Set(Object.keys(FILTER_CONFIG.Item?.spellClasses || {}));
  
  try {
    const spellListUuids = CONFIG.DND5E?.SPELL_LISTS || [];
    
    // First pass: load all class spell list pages in parallel
    const pages = await Promise.all(
      spellListUuids.map(uuid => fromUuid(uuid).catch(() => null))
    );
    
    // Collect all unique spell UUIDs and their class associations
    const spellToClasses = new Map(); // spellUuid -> Set of classIds
    
    for (const page of pages) {
      if (!page?.system?.identifier || !page.system.spells) continue;
      if (page.system.type !== "class") continue;
      
      const classId = page.system.identifier.toLowerCase();
      if (!knownClasses.has(classId)) continue;
      
      for (const spellUuid of page.system.spells) {
        if (!spellToClasses.has(spellUuid)) {
          spellToClasses.set(spellUuid, new Set());
        }
        spellToClasses.get(spellUuid).add(classId);
      }
    }
    
    // Second pass: load all spells in parallel batches (50 at a time to avoid overwhelming)
    const spellUuids = [...spellToClasses.keys()];
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < spellUuids.length; i += BATCH_SIZE) {
      const batch = spellUuids.slice(i, i + BATCH_SIZE);
      const spells = await Promise.all(
        batch.map(uuid => fromUuid(uuid).catch(() => null))
      );
      
      for (let j = 0; j < spells.length; j++) {
        const spell = spells[j];
        const spellUuid = batch[j];
        const classIds = spellToClasses.get(spellUuid);
        
        if (!spell || !classIds) continue;
        
        // Use identifier as primary key, name as fallback
        const key = (spell.system?.identifier || spell.name || "").toLowerCase();
        if (key) {
          if (!map.has(key)) map.set(key, new Set());
          classIds.forEach(c => map.get(key).add(c));
        }
        
        // Also add by name for matching world items that might not have identifier
        const nameKey = spell.name?.toLowerCase();
        if (nameKey && nameKey !== key) {
          if (!map.has(nameKey)) map.set(nameKey, new Set());
          classIds.forEach(c => map.get(nameKey).add(c));
        }
      }
    }
    
    spellClassMap = map;
    console.log(`DM Panic Button: Loaded spell-class mappings for ${map.size} spells`);
  } catch (e) {
    console.error("DM Panic Button: Failed to build spell class map", e);
    spellClassMap = new Map();
  }
  
  spellClassMapLoading = false;
  return spellClassMap;
}

// Helper to get spell's class associations using the pre-built map
function getSpellClasses(doc) {
  if (!spellClassMap) return [];
  
  // Try identifier first, then name
  const identifier = (doc.system?.identifier || "").toLowerCase();
  const name = (doc.name || "").toLowerCase();
  
  const classes = new Set();
  
  if (identifier && spellClassMap.has(identifier)) {
    spellClassMap.get(identifier).forEach(c => classes.add(c));
  }
  
  if (name && spellClassMap.has(name)) {
    spellClassMap.get(name).forEach(c => classes.add(c));
  }
  
  return [...classes];
}

/**
 * Returns a Foundry VTT dnd5e item data template.
 * @param {Object} overrides - Properties to override in the template.
 * @returns {Object} Item data object
 */
function createItemTemplate(overrides = {}) {
  const base = {
    name: "Item Name",
    type: "weapon", // or "equipment", "consumable", etc.
    img: "icons/svg/item-bag.svg",
    system: {
      description: { value: "<p>Description here</p>" },
      price: { value: 0, denomination: "gp" },
      identified: true,
      quantity: 1,
      weight: { value: 0 },
      rarity: "common",
      attunement: 0,
      attuned: false,
      equipped: false,
      type: { value: "martialM", baseItem: "glaive" },
      armor: { value: 0 },
      hp: { value: 0 },
      uses: { max: 0, spent: 0 },
      properties: [],
      identifier: "unique-id"
    },
    flags: {},
    effects: [],
    folder: null,
    _stats: {},
    ownership: {}
  };
  return foundry.utils.mergeObject(base, overrides, { inplace: false });
}
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
      width: 720,
      height: 650,
      popOut: true,
      resizable: true
    });
  }
}

Hooks.once("ready", async () => {
  globalThis.DMPanicButton = DMPanicButton;
  
  // Build spell-class mapping from CONFIG.DND5E.SPELL_LISTS
  await buildSpellClassMap();
  
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
    // Create a scroll item from the spell using the template function
    const scrollData = createItemTemplate({
      name: `Scroll of ${item.name}`,
      type: "consumable",
      img: item.img || "icons/commodities/paper/paper-script-spiral-tan.webp",
      system: {
        description: item.system?.description || item.data?.description || {},
        consumableType: "scroll",
        uses: { value: 1, max: 1, per: "charges" },
        rarity: item.system?.rarity || item.data?.rarity || "common",
        spell: item.toObject()
      }
    });
    lootItem = await Item.create(scrollData, { temporary: true });
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

    case "chat": {
      // Post the document's description to chat with working roll macros
      let description = "";
      
      // Try to get description from various document types
      if (doc.system?.description?.value) {
        description = doc.system.description.value; // Items, Spells, Features
      } else if (doc.content) {
        description = doc.content; // Journal entries (page content)
      } else if (doc.pages?.size > 0) {
        // Journal with pages - get first page content
        const firstPage = doc.pages.contents[0];
        description = firstPage?.text?.content || firstPage?.content || "";
      } else if (doc.description) {
        description = doc.description; // Actors, some other docs
      }
      
      // Fallback to name if no description found
      if (!description || description.trim() === "") {
        description = `<i>No description available for ${doc.name}</i>`;
      }
      
      // Enrich the HTML to make [[/attack]], [[/damage]], etc. work
      // For Items, we need to provide rollData and the item as context
      let enrichedDescription = description;
      try {
        const enrichContext = {
          rollData: doc.getRollData ? doc.getRollData() : {},
          relativeTo: doc
        };
        enrichedDescription = await TextEditor.enrichHTML(description, enrichContext);
      } catch (err) {
        console.warn("DM Panic Button: Failed to enrich HTML, using raw description", err);
        enrichedDescription = description;
      }
      
      ChatMessage.create({
        content: `<h3>${doc.name}</h3>${enrichedDescription}`,
        speaker: ChatMessage.getSpeaker()
      });
      break;
    }


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
    // Inject CSS to ensure .panic-category-btn and .panic-subtype-btn look identical
    if (!document.getElementById('panic-pill-style')) {
      const style = document.createElement('style');
      style.id = 'panic-pill-style';
      style.innerHTML = `
        .panic-category-btn.panic-pill, .panic-subtype-btn.panic-pill {
          background: linear-gradient(135deg, #232526 0%, #414345 100%) !important;
          border: 1.5px solid #bfa046 !important;
          border-radius: 12px !important;
          padding: 3px 12px !important;
          font-family: 'Papyrus', 'IM Fell English', 'Cinzel Decorative', serif !important;
          font-size: 0.98em !important;
          font-weight: bold !important;
          color: #e7d7a1 !important;
          text-shadow: 0 0 4px #bfa046, 0 0 1px #000 !important;
          box-shadow: 0 1px 4px #000a !important;
          cursor: pointer !important;
          white-space: nowrap !important;
          flex-shrink: 0 !important;
          letter-spacing: 0.5px !important;
          margin-bottom: 0 !important;
        }
        .panic-category-btn.panic-pill.selected, .panic-subtype-btn.panic-pill.selected {
          background: #c00 !important;
          color: #fff !important;
          border-color: #c00 !important;
        }
        .panic-category-btn.panic-pill:not(.selected), .panic-subtype-btn.panic-pill:not(.selected) {
          background: #eee !important;
          color: #222 !important;
          border-color: #bbb !important;
        }
      `;
      document.head.appendChild(style);
    }
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

  // Insert filter rows container - each filter group gets its own row
    let menuHtml = `<div id="panic-filter-container" style="margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px;">`;
    menuHtml += `<div id="panic-category-menu" class="panic-category-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
    typeOptions.forEach(opt => {
      menuHtml += `<button class="panic-category-btn panic-pill" data-type="${opt.value}">${opt.label}</button>`;
    });
    menuHtml += `</div>`;
    menuHtml += `<div id="panic-subtype-container"></div>`;
    menuHtml += `<div id="panic-subsubtype-container"></div>`;
    menuHtml += `</div>`;
    input.parent().before($(menuHtml));
    // Always insert a horizontal line between filters and search bar
    html.find('#panic-type-search-hr').remove();
    html.find('#panic-filter-container').after('<hr id="panic-type-search-hr" style="border:0;border-top:1.5px solid #bfa046;margin:8px 0 4px 0;">');

  let selectedType = "all";
  let selectedItemSubtype = "all";
  let selectedItemSubSubtype = "all"; // Third-tier filter (e.g., martialM, martialR, natural, spell level)
  let selectedSpellSchool = "all"; // Fourth-tier filter for spell school
  let selectedSpellClass = "all"; // Fifth-tier filter for spell class

  function updateCategoryMenu() {
    html.find(".panic-category-btn").each(function() {
      const btn = $(this);
      btn.removeClass('selected');
      if (btn.data("type") === selectedType) {
        btn.addClass('selected');
      }
    });

    // Clear subtype and sub-subtype containers
    html.find("#panic-subtype-container").empty();
    html.find("#panic-subsubtype-container").empty();

    // Show subtype pills if Item selected
    if (selectedType === "Item") {
      // Get all unique item types (e.g., weapon, armor, consumable, tool, loot, container)
      let allItems = game.items.contents;
      let subtypes = [...new Set(allItems.map(i => i.type || ""))].filter(Boolean);
      if (subtypes.length) {
        let subtypeHtml = `<div id="panic-subtype-menu" class="panic-item-subtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
        subtypeHtml += `<button class="panic-subtype-btn panic-pill" data-subtype="all">All</button>`;
        subtypes.forEach(st => {
          subtypeHtml += `<button class="panic-subtype-btn panic-pill" data-subtype="${st}">${st}</button>`;
        });
        subtypeHtml += `</div>`;
        html.find("#panic-subtype-container").html(subtypeHtml);
        html.find(".panic-subtype-btn").on("click", function() {
          const clickedSubtype = $(this).data("subtype");
          // Toggle logic: clicking again on the selected chip turns it off (back to 'all')
          if (selectedItemSubtype === clickedSubtype) {
            selectedItemSubtype = "all";
          } else {
            selectedItemSubtype = clickedSubtype;
          }
          selectedItemSubSubtype = "all"; // Reset sub-subtype when subtype changes
          selectedSpellSchool = "all"; // Reset spell school when subtype changes
          selectedSpellClass = "all"; // Reset spell class when subtype changes
          updateCategoryMenu();
          doSearch();
        });
        html.find('.panic-subtype-btn').removeClass('selected');
        html.find(`.panic-subtype-btn[data-subtype='${selectedItemSubtype}']`).addClass('selected');
      }

      // Show sub-subtype pills if "weapon" is selected (for martialM, martialR, simpleM, simpleR, natural, etc.)
      if (selectedItemSubtype === "weapon") {
        let weaponItems = allItems.filter(i => i.type === "weapon");
        let subSubtypes = [...new Set(weaponItems.map(i => i.system?.type?.value || ""))].filter(Boolean);
        if (subSubtypes.length) {
          let subSubtypeHtml = `<div id="panic-subsubtype-menu" class="panic-item-subsubtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
          subSubtypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="all">All</button>`;
          subSubtypes.forEach(sst => {
            // Get friendly label from filter-types config
            const label = getSubSubtypeLabel("Item", "weapon", sst);
            subSubtypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="${sst}">${label}</button>`;
          });
          subSubtypeHtml += `</div>`;
          html.find("#panic-subsubtype-container").html(subSubtypeHtml);
          html.find(".panic-subsubtype-btn").on("click", function() {
            const clickedSubSubtype = $(this).data("subsubtype");
            // Toggle logic
            if (selectedItemSubSubtype === clickedSubSubtype) {
              selectedItemSubSubtype = "all";
            } else {
              selectedItemSubSubtype = clickedSubSubtype;
            }
            updateCategoryMenu();
            doSearch();
          });
          html.find('.panic-subsubtype-btn').removeClass('selected');
          html.find(`.panic-subsubtype-btn[data-subsubtype='${selectedItemSubSubtype}']`).addClass('selected');
        }
      }
      
      // Show sub-subtype pills if "feat" is selected (for class, monster, race, feat, etc.)
      if (selectedItemSubtype === "feat") {
        let featItems = allItems.filter(i => i.type === "feat");
        let featTypes = [...new Set(featItems.map(i => i.system?.type?.value || ""))].filter(Boolean);
        if (featTypes.length) {
          let featTypeHtml = `<div id="panic-subsubtype-menu" class="panic-item-subsubtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
          featTypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="all">All Types</button>`;
          featTypes.forEach(ft => {
            const label = getSubSubtypeLabel("Item", "feat", ft);
            featTypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="${ft}">${label}</button>`;
          });
          featTypeHtml += `</div>`;
          html.find("#panic-subsubtype-container").html(featTypeHtml);
          html.find(".panic-subsubtype-btn").on("click", function() {
            const clickedFeatType = $(this).data("subsubtype");
            if (selectedItemSubSubtype === clickedFeatType) {
              selectedItemSubSubtype = "all";
            } else {
              selectedItemSubSubtype = clickedFeatType;
            }
            updateCategoryMenu();
            doSearch();
          });
          html.find('.panic-subsubtype-btn').removeClass('selected');
          html.find(`.panic-subsubtype-btn[data-subsubtype='${selectedItemSubSubtype}']`).addClass('selected');
        }
      }
      
      // Show sub-subtype pills if "consumable" is selected (for potion, poison, scroll, etc.)
      if (selectedItemSubtype === "consumable") {
        let consumableItems = allItems.filter(i => i.type === "consumable");
        let consumableTypes = [...new Set(consumableItems.map(i => i.system?.type?.value || ""))].filter(Boolean);
        if (consumableTypes.length) {
          let consumableTypeHtml = `<div id="panic-subsubtype-menu" class="panic-item-subsubtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
          consumableTypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="all">All Types</button>`;
          consumableTypes.forEach(ct => {
            const label = getSubSubtypeLabel("Item", "consumable", ct);
            consumableTypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="${ct}">${label}</button>`;
          });
          consumableTypeHtml += `</div>`;
          html.find("#panic-subsubtype-container").html(consumableTypeHtml);
          html.find(".panic-subsubtype-btn").on("click", function() {
            const clickedConsumableType = $(this).data("subsubtype");
            if (selectedItemSubSubtype === clickedConsumableType) {
              selectedItemSubSubtype = "all";
            } else {
              selectedItemSubSubtype = clickedConsumableType;
            }
            updateCategoryMenu();
            doSearch();
          });
          html.find('.panic-subsubtype-btn').removeClass('selected');
          html.find(`.panic-subsubtype-btn[data-subsubtype='${selectedItemSubSubtype}']`).addClass('selected');
        }
      }
      
      // Show sub-subtype pills if "equipment" is selected (for ring, wondrous, armor, etc.)
      if (selectedItemSubtype === "equipment") {
        let equipmentItems = allItems.filter(i => i.type === "equipment");
        let equipmentTypes = [...new Set(equipmentItems.map(i => i.system?.type?.value || ""))].filter(Boolean);
        if (equipmentTypes.length) {
          let equipmentTypeHtml = `<div id="panic-subsubtype-menu" class="panic-item-subsubtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
          equipmentTypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="all">All Types</button>`;
          equipmentTypes.forEach(et => {
            const label = getSubSubtypeLabel("Item", "equipment", et);
            equipmentTypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="${et}">${label}</button>`;
          });
          equipmentTypeHtml += `</div>`;
          html.find("#panic-subsubtype-container").html(equipmentTypeHtml);
          html.find(".panic-subsubtype-btn").on("click", function() {
            const clickedEquipmentType = $(this).data("subsubtype");
            if (selectedItemSubSubtype === clickedEquipmentType) {
              selectedItemSubSubtype = "all";
            } else {
              selectedItemSubSubtype = clickedEquipmentType;
            }
            updateCategoryMenu();
            doSearch();
          });
          html.find('.panic-subsubtype-btn').removeClass('selected');
          html.find(`.panic-subsubtype-btn[data-subsubtype='${selectedItemSubSubtype}']`).addClass('selected');
        }
      }
      
      // Show sub-subtype pills if "tool" is selected (for artisan, gaming, musical, vehicle)
      if (selectedItemSubtype === "tool") {
        let toolItems = allItems.filter(i => i.type === "tool");
        let toolTypes = [...new Set(toolItems.map(i => i.system?.type?.value || ""))].filter(Boolean);
        if (toolTypes.length) {
          let toolTypeHtml = `<div id="panic-subsubtype-menu" class="panic-item-subsubtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
          toolTypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="all">All Types</button>`;
          toolTypes.forEach(tt => {
            const label = getSubSubtypeLabel("Item", "tool", tt);
            toolTypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="${tt}">${label}</button>`;
          });
          toolTypeHtml += `</div>`;
          html.find("#panic-subsubtype-container").html(toolTypeHtml);
          html.find(".panic-subsubtype-btn").on("click", function() {
            const clickedToolType = $(this).data("subsubtype");
            if (selectedItemSubSubtype === clickedToolType) {
              selectedItemSubSubtype = "all";
            } else {
              selectedItemSubSubtype = clickedToolType;
            }
            updateCategoryMenu();
            doSearch();
          });
          html.find('.panic-subsubtype-btn').removeClass('selected');
          html.find(`.panic-subsubtype-btn[data-subsubtype='${selectedItemSubSubtype}']`).addClass('selected');
        }
      }

      // Show sub-subtype pills if "loot" is selected (for gear, art, gem, etc.)
      if (selectedItemSubtype === "loot") {
        let lootItems = allItems.filter(i => i.type === "loot");
        let lootTypes = [...new Set(lootItems.map(i => i.system?.type?.value || ""))].filter(Boolean);
        if (lootTypes.length) {
          let lootTypeHtml = `<div id="panic-subsubtype-menu" class="panic-item-subsubtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
          lootTypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="all">All Types</button>`;
          lootTypes.forEach(lt => {
            const label = getSubSubtypeLabel("Item", "loot", lt);
            lootTypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="${lt}">${label}</button>`;
          });
          lootTypeHtml += `</div>`;
          html.find("#panic-subsubtype-container").html(lootTypeHtml);
          html.find(".panic-subsubtype-btn").on("click", function() {
            const clickedLootType = $(this).data("subsubtype");
            if (selectedItemSubSubtype === clickedLootType) {
              selectedItemSubSubtype = "all";
            } else {
              selectedItemSubSubtype = clickedLootType;
            }
            updateCategoryMenu();
            doSearch();
          });
          html.find('.panic-subsubtype-btn').removeClass('selected');
          html.find(`.panic-subsubtype-btn[data-subsubtype='${selectedItemSubSubtype}']`).addClass('selected');
        }
      }

      // Show sub-subtype pills if "container" is selected (for bag, backpack, etc.)
      if (selectedItemSubtype === "container") {
        let containerItems = allItems.filter(i => i.type === "container");
        let containerTypes = [...new Set(containerItems.map(i => i.system?.type?.value || ""))].filter(Boolean);
        if (containerTypes.length) {
          let containerTypeHtml = `<div id="panic-subsubtype-menu" class="panic-item-subsubtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
          containerTypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="all">All Types</button>`;
          containerTypes.forEach(ct => {
            const label = getSubSubtypeLabel("Item", "container", ct);
            containerTypeHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="${ct}">${label}</button>`;
          });
          containerTypeHtml += `</div>`;
          html.find("#panic-subsubtype-container").html(containerTypeHtml);
          html.find(".panic-subsubtype-btn").on("click", function() {
            const clickedContainerType = $(this).data("subsubtype");
            if (selectedItemSubSubtype === clickedContainerType) {
              selectedItemSubSubtype = "all";
            } else {
              selectedItemSubSubtype = clickedContainerType;
            }
            updateCategoryMenu();
            doSearch();
          });
          html.find('.panic-subsubtype-btn').removeClass('selected');
          html.find(`.panic-subsubtype-btn[data-subsubtype='${selectedItemSubSubtype}']`).addClass('selected');
        }
      }

      // Show sub-subtype pills if "spell" is selected (for spell level and school)
      if (selectedItemSubtype === "spell") {
        let spellItems = allItems.filter(i => i.type === "spell");
        
        // Spell Level row
        let spellLevels = [...new Set(spellItems.map(i => i.system?.level))].filter(l => l !== undefined).sort((a,b) => a - b);
        if (spellLevels.length) {
          let levelHtml = `<div id="panic-spelllevel-menu" class="panic-item-subsubtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
          levelHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="all">All Levels</button>`;
          spellLevels.forEach(lvl => {
            const label = getSubSubtypeLabel("Item", "spell", lvl);
            levelHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="${lvl}">${label}</button>`;
          });
          levelHtml += `</div>`;
          html.find("#panic-subsubtype-container").html(levelHtml);
          html.find(".panic-subsubtype-btn").on("click", function() {
            const clickedLevel = $(this).data("subsubtype");
            if (selectedItemSubSubtype === clickedLevel) {
              selectedItemSubSubtype = "all";
            } else {
              selectedItemSubSubtype = clickedLevel;
            }
            updateCategoryMenu();
            doSearch();
          });
          html.find('.panic-subsubtype-btn').removeClass('selected');
          html.find(`.panic-subsubtype-btn[data-subsubtype='${selectedItemSubSubtype}']`).addClass('selected');
        }
        
        // Spell School row (add a new container for it)
        let spellSchools = [...new Set(spellItems.map(i => i.system?.school || ""))].filter(Boolean).sort();
        if (spellSchools.length) {
          // Add school container if not present
          if (!html.find("#panic-spellschool-container").length) {
            html.find("#panic-subsubtype-container").after('<div id="panic-spellschool-container"></div>');
          }
          let schoolHtml = `<div id="panic-spellschool-menu" class="panic-item-spellschool-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto; margin-top: 6px;">`;
          schoolHtml += `<button class="panic-spellschool-btn panic-pill" data-school="all">All Schools</button>`;
          spellSchools.forEach(sch => {
            const label = getSpellSchoolLabel(sch);
            schoolHtml += `<button class="panic-spellschool-btn panic-pill" data-school="${sch}">${label}</button>`;
          });
          schoolHtml += `</div>`;
          html.find("#panic-spellschool-container").html(schoolHtml);
          html.find(".panic-spellschool-btn").on("click", function() {
            const clickedSchool = $(this).data("school");
            if (selectedSpellSchool === clickedSchool) {
              selectedSpellSchool = "all";
            } else {
              selectedSpellSchool = clickedSchool;
            }
            updateCategoryMenu();
            doSearch();
          });
          html.find('.panic-spellschool-btn').removeClass('selected');
          html.find(`.panic-spellschool-btn[data-school='${selectedSpellSchool}']`).addClass('selected');
        }
        
        // Spell Class row (add a new container for it)
        // Add class container if not present
        if (!html.find("#panic-spellclass-container").length) {
          html.find("#panic-spellschool-container").after('<div id="panic-spellclass-container"></div>');
        }
        
        // Check if spell class map is still loading
        if (spellClassMapLoading || !spellClassMap) {
          html.find("#panic-spellclass-container").html(
            `<div id="panic-spellclass-menu" class="panic-item-spellclass-menu" style="display: flex; gap: 5px; margin-top: 6px;">
              <span class="panic-pill" style="opacity: 0.6;"><i class="fas fa-spinner fa-spin"></i> Loading classes...</span>
            </div>`
          );
          // Re-check when map might be ready
          if (spellClassMapLoading) {
            setTimeout(() => {
              if (selectedItemSubtype === "spell") updateCategoryMenu();
            }, 500);
          }
        } else {
          // Gather all classes that have spells in the world
          let allSpellClasses = new Set();
          spellItems.forEach(spell => {
            getSpellClasses(spell).forEach(cls => allSpellClasses.add(cls));
          });
          let spellClassList = [...allSpellClasses].sort();
          if (spellClassList.length) {
            let classHtml = `<div id="panic-spellclass-menu" class="panic-item-spellclass-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto; margin-top: 6px;">`;
            classHtml += `<button class="panic-spellclass-btn panic-pill" data-class="all">All Classes</button>`;
            spellClassList.forEach(cls => {
              const label = getSpellClassLabel(cls);
              classHtml += `<button class="panic-spellclass-btn panic-pill" data-class="${cls}">${label}</button>`;
            });
            classHtml += `</div>`;
            html.find("#panic-spellclass-container").html(classHtml);
            html.find(".panic-spellclass-btn").on("click", function() {
              const clickedClass = $(this).data("class");
              if (selectedSpellClass === clickedClass) {
                selectedSpellClass = "all";
              } else {
                selectedSpellClass = clickedClass;
              }
              updateCategoryMenu();
              doSearch();
            });
            html.find('.panic-spellclass-btn').removeClass('selected');
            html.find(`.panic-spellclass-btn[data-class='${selectedSpellClass}']`).addClass('selected');
          } else {
            html.find("#panic-spellclass-container").empty();
          }
        }
      } else {
        // Clear spell school and class containers if not spell
        html.find("#panic-spellschool-container").empty();
        html.find("#panic-spellclass-container").empty();
      }
    }
    
    // Resize window to fit filter content
    resizeToFitFilters();
  }

  // Resize the window width based on filter rows content
  function resizeToFitFilters() {
    // Wait a tick for DOM to update
    setTimeout(() => {
      const filterContainer = html.find("#panic-filter-container")[0];
      if (!filterContainer) return;
      
      // Measure each filter row's natural width
      const rows = filterContainer.querySelectorAll('[id$="-menu"]');
      let maxWidth = 400; // minimum width
      
      rows.forEach(row => {
        // scrollWidth gives the full content width even if overflow is hidden/auto
        const rowWidth = row.scrollWidth + 40; // add padding for container margins
        if (rowWidth > maxWidth) maxWidth = rowWidth;
      });
      
      // Also check spell school container
      const schoolContainer = html.find("#panic-spellschool-container [id$='-menu']")[0];
      if (schoolContainer) {
        const schoolWidth = schoolContainer.scrollWidth + 40;
        if (schoolWidth > maxWidth) maxWidth = schoolWidth;
      }
      
      // Also check spell class container
      const classContainer = html.find("#panic-spellclass-container [id$='-menu']")[0];
      if (classContainer) {
        const classWidth = classContainer.scrollWidth + 40;
        if (classWidth > maxWidth) maxWidth = classWidth;
      }
      
      // Cap at reasonable max and add window chrome padding
      maxWidth = Math.min(maxWidth + 50, 1200);
      maxWidth = Math.max(maxWidth, 500);
      
      // Get current position and resize
      app.setPosition({ width: maxWidth });
    }, 10);
  }

  html.find(".panic-category-btn").on("click", function() {
    const clickedType = $(this).data("type");
    // Toggle logic: clicking again on the selected chip turns it off (back to 'all')
    if (selectedType === clickedType) {
      selectedType = "all";
      selectedItemSubtype = "all";
      selectedItemSubSubtype = "all";
      selectedSpellSchool = "all";
      selectedSpellClass = "all";
    } else {
      selectedType = clickedType;
      selectedItemSubtype = "all";
      selectedItemSubSubtype = "all";
      selectedSpellSchool = "all";
      selectedSpellClass = "all";
    }
    updateCategoryMenu();
    doSearch();
  });
  updateCategoryMenu();


  async function renderResults(list){
    resultsDiv.empty();
    const actorSelected = getSelectedActor();
    for (const entry of list) {
      const isActive = entry.type === "Scene" && entry.document.active;
      const canGive = actorSelected && (entry.type === "Item" || entry.type === "ActiveEffect");
      
      // Determine if item can be placed as loot
      // Check filter-types config for noPlacement rules
      let canPlace = entry.type === "Item";
      // Feats and spells can't be placed as loot
      if (canPlace && ["feat", "spell", "class", "subclass", "background", "race"].includes(entry.document.type)) {
        canPlace = false;
      }
      if (canPlace && entry.document.type === "weapon") {
        const weaponCategory = entry.document.system?.type?.value || "";
        if (isNoPlacement("Item", weaponCategory)) {
          canPlace = false;
        }
      }
      
      let detailsHtml = "";
      if (entry.type === "Item") {
        const doc = entry.document;
        const img = doc.img || "icons/svg/item-bag.svg";
        const type = doc.type || doc.system?.type?.value || "";
        const subtype = doc.system?.type?.value || "";
        const rarity = doc.system?.rarity || "";
        const attunement = doc.system?.attunement === "required" ? "Requires Attunement" : "";
        
        // Build spell-specific details
        let spellDetails = "";
        if (type === "spell") {
          const sys = doc.system || {};
          const level = sys.level === 0 ? "Cantrip" : `Level ${sys.level}`;
          const school = getSpellSchoolLabel(sys.school || "");
          
          // Activation/casting time
          const activation = sys.activation || {};
          let castTime = "";
          if (activation.type) {
            const actValue = activation.value || 1;
            const actType = activation.type;
            const actTypes = { action: "Action", bonus: "Bonus Action", reaction: "Reaction", minute: "Minute", hour: "Hour" };
            castTime = `${actValue > 1 ? actValue + " " : ""}${actTypes[actType] || actType}${actValue > 1 && actType !== "action" && actType !== "bonus" && actType !== "reaction" ? "s" : ""}`;
          }
          
          // Range
          const range = sys.range || {};
          let rangeStr = "";
          if (range.units === "self") rangeStr = "Self";
          else if (range.units === "touch") rangeStr = "Touch";
          else if (range.value) rangeStr = `${range.value} ${range.units || "ft"}`;
          
          // Duration
          const duration = sys.duration || {};
          let durationStr = "";
          if (duration.units === "inst") durationStr = "Instantaneous";
          else if (duration.units === "perm") durationStr = "Permanent";
          else if (duration.units === "spec") durationStr = "Special";
          else if (duration.value) {
            const durUnits = { minute: "min", hour: "hr", day: "day", round: "rd", turn: "turn" };
            durationStr = `${duration.value} ${durUnits[duration.units] || duration.units}${duration.value > 1 ? "s" : ""}`;
            if (duration.concentration) durationStr = `Conc. ${durationStr}`;
          } else if (duration.concentration) durationStr = "Concentration";
          
          // Components
          const props = sys.properties || new Set();
          let components = [];
          if (props.has?.("vocal") || props.includes?.("vocal")) components.push("V");
          if (props.has?.("somatic") || props.includes?.("somatic")) components.push("S");
          if (props.has?.("material") || props.includes?.("material")) components.push("M");
          const compStr = components.join(", ");
          
          // Build details line
          const details = [level, school, castTime, rangeStr, durationStr, compStr].filter(Boolean);
          spellDetails = `<div style="font-size:0.9em;color:#8cb4d9;margin-top:2px;">${details.join(" | ")}</div>`;
        }
        
        // Build item-specific details (non-spell)
        let itemDetails = "";
        if (type !== "spell") {
          const sys = doc.system || {};
          let detailParts = [];
          
          // Weight (handle both object {value, units} and number formats)
          const weightObj = sys.weight;
          const weight = typeof weightObj === 'object' ? weightObj?.value : weightObj;
          if (weight) detailParts.push(`${weight} lb`);
          
          // Price (format large numbers with commas)
          const price = sys.price;
          if (price?.value) {
            const formattedPrice = price.value.toLocaleString();
            detailParts.push(`${formattedPrice} ${price.denomination || "gp"}`);
          }
          
          // Weapon-specific: damage, properties
          if (type === "weapon") {
            // Damage
            const damage = sys.damage?.base || sys.damage;
            if (damage?.number && damage?.denomination) {
              let dmgStr = `${damage.number}d${damage.denomination}`;
              const dmgTypes = { bludgeoning: "bludg.", piercing: "pierc.", slashing: "slash.", fire: "fire", cold: "cold", lightning: "light.", thunder: "thund.", acid: "acid", poison: "poison", necrotic: "necro.", radiant: "radiant", force: "force", psychic: "psych." };
              if (damage.types?.length) {
                dmgStr += ` ${damage.types.map(t => dmgTypes[t] || t).join("/")}`;
              }
              detailParts.unshift(dmgStr); // Put damage first
            }
            
            // Weapon properties
            const props = sys.properties || new Set();
            const propLabels = [];
            const propMap = { fin: "Finesse", hvy: "Heavy", lgt: "Light", rch: "Reach", thr: "Thrown", two: "Two-Handed", ver: "Versatile", amm: "Ammunition", lod: "Loading" };
            for (const [key, label] of Object.entries(propMap)) {
              if (props.has?.(key) || props.includes?.(key) || props[key]) propLabels.push(label);
            }
            if (propLabels.length) detailParts.push(propLabels.join(", "));
            
            // Range for ranged/thrown
            const range = sys.range;
            if (range?.value) {
              let rangeStr = `${range.value}`;
              if (range.long) rangeStr += `/${range.long}`;
              rangeStr += " ft";
              detailParts.push(rangeStr);
            }
          }
          
          // Armor/Equipment-specific: AC, stealth
          if (type === "equipment") {
            // Equipment type label
            const equipType = sys.type?.value;
            const equipLabels = { ring: "Ring", wondrous: "Wondrous", rod: "Rod", wand: "Wand", staff: "Staff", amulet: "Amulet", belt: "Belt", boots: "Boots", bracers: "Bracers", cloak: "Cloak", gloves: "Gloves", hat: "Hat", helm: "Helm", light: "Light Armor", medium: "Medium Armor", heavy: "Heavy Armor", shield: "Shield", clothing: "Clothing", trinket: "Trinket", vehicle: "Vehicle" };
            if (equipType && equipLabels[equipType]) {
              detailParts.unshift(equipLabels[equipType]);
            }
            
            const armor = sys.armor;
            if (armor?.value) {
              let acStr = `AC ${armor.value}`;
              if (armor.dex !== null && armor.dex !== undefined) {
                if (armor.dex === 0) acStr += " (no Dex)";
                else if (armor.dex < 10) acStr += ` (+${armor.dex} Dex max)`;
              }
              detailParts.push(acStr);
            }
            
            // Stealth disadvantage
            const props = sys.properties || new Set();
            if (props.has?.("stealthDisadvantage") || props.stealthDisadvantage) {
              detailParts.push("Stealth Disadv.");
            }
            
            // Magical property
            if (props.has?.("mgc") || props.includes?.("mgc") || (Array.isArray(props) && props.includes("mgc"))) {
              detailParts.push("Magical");
            }
            
            // Strength requirement
            if (sys.strength) detailParts.push(`Str ${sys.strength}`);
            
            // Uses/Charges with recovery
            const uses = sys.uses;
            if (uses?.max) {
              const spent = uses.spent || 0;
              const max = typeof uses.max === 'string' ? parseInt(uses.max) || uses.max : uses.max;
              const remaining = typeof max === 'number' ? max - spent : uses.max;
              let useStr = `${remaining}/${max} charges`;
              // Recovery method
              if (uses.recovery?.length) {
                const recovery = uses.recovery[0];
                const recTypes = { sr: "SR", lr: "LR", dawn: "Dawn", dusk: "Dusk", day: "Day" };
                if (recovery.period && recTypes[recovery.period]) {
                  useStr += ` (${recTypes[recovery.period]})`;
                }
              }
              detailParts.push(useStr);
            }
          }
          
          // Consumable-specific: uses
          if (type === "consumable") {
            const uses = sys.uses;
            if (uses?.max) {
              const spent = uses.spent || 0;
              const remaining = uses.max - spent;
              detailParts.push(`${remaining}/${uses.max} uses`);
            }
            // Consumable subtype
            const consumableType = sys.type?.value;
            const consumableLabels = { potion: "Potion", poison: "Poison", food: "Food", scroll: "Scroll", wand: "Wand", rod: "Rod", trinket: "Trinket" };
            if (consumableType && consumableLabels[consumableType]) {
              detailParts.unshift(consumableLabels[consumableType]);
            }
          }
          
          // Tool-specific
          if (type === "tool") {
            // Tool type label
            const toolType = sys.type?.value;
            const toolLabels = { art: "Artisan's Tools", game: "Gaming Set", music: "Musical Instrument", vehicle: "Vehicle" };
            if (toolType && toolLabels[toolType]) {
              detailParts.unshift(toolLabels[toolType]);
            }
            
            const ability = sys.ability;
            const abilityLabels = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
            if (ability && abilityLabels[ability]) {
              detailParts.push(abilityLabels[ability]);
            }
          }
          
          // Loot-specific
          if (type === "loot") {
            // Loot type label
            const lootType = sys.type?.value;
            const lootLabels = { gear: "Adventuring Gear", art: "Art Object", gem: "Gemstone", material: "Material", resource: "Resource", junk: "Junk", treasure: "Treasure" };
            if (lootType && lootLabels[lootType]) {
              detailParts.unshift(lootLabels[lootType]);
            }
          }
          
          // Container-specific: capacity
          if (type === "container") {
            // Container type label
            const containerType = sys.type?.value;
            const containerLabels = { backpack: "Backpack", bag: "Bag", pouch: "Pouch", chest: "Chest", basket: "Basket", sack: "Sack", case: "Case", quiver: "Quiver", holster: "Holster" };
            if (containerType && containerLabels[containerType]) {
              detailParts.unshift(containerLabels[containerType]);
            }
            
            const capacity = sys.capacity;
            if (capacity?.value) {
              detailParts.push(`Capacity: ${capacity.value} ${capacity.type || "items"}`);
            }
          }
          
          // Feat-specific details
          if (type === "feat") {
            // Feat category (class, origin, general, epic boon, fighting style, etc.)
            const featType = sys.type?.value;
            const featLabels = { class: "Class Feature", monster: "Monster Feature", race: "Species Feature", background: "Background Feature", feat: "Feat", origin: "Origin Feat", general: "General Feat", fighting: "Fighting Style", fightingStyle: "Fighting Style", metamagic: "Metamagic", eldritchInvocation: "Eldritch Invocation", pact: "Pact Boon", maneuver: "Maneuver", artificerInfusion: "Artificer Infusion", rune: "Rune", supernaturalGift: "Supernatural Gift", epicBoon: "Epic Boon" };
            if (featType && featLabels[featType]) {
              detailParts.unshift(featLabels[featType]);
            }
            
            // Prerequisites
            const prereqs = sys.prerequisites?.value || sys.requirements;
            if (prereqs) detailParts.push(`Prereq: ${prereqs}`);
            
            // Activation (if active feat)
            const activation = sys.activation || {};
            if (activation.type && activation.type !== "none") {
              const actTypes = { action: "Action", bonus: "Bonus Action", reaction: "Reaction", minute: "Minute", hour: "Hour", special: "Special" };
              const actLabel = actTypes[activation.type] || activation.type;
              detailParts.push(actLabel);
            }
            
            // Uses (if limited)
            const uses = sys.uses;
            if (uses?.max) {
              const spent = uses.spent || 0;
              const remaining = uses.max - spent;
              let useStr = `${remaining}/${uses.max} uses`;
              // Recovery method
              if (uses.recovery?.length) {
                const recovery = uses.recovery[0];
                const recTypes = { sr: "SR", lr: "LR", dawn: "Dawn", dusk: "Dusk" };
                if (recovery.period && recTypes[recovery.period]) {
                  useStr += ` (${recTypes[recovery.period]})`;
                }
              }
              detailParts.push(useStr);
            }
          }
          
          if (detailParts.length) {
            itemDetails = `<div style="font-size:0.9em;color:#8cb4d9;margin-top:2px;">${detailParts.join(" | ")}</div>`;
          }
        }
        
        detailsHtml = `
          <div class="panic-item-details" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:4px;">
            <img src="${img}" alt="item" style="width:38px;height:38px;object-fit:contain;border-radius:6px;border:1.5px solid #bfa046;background:#222;">
            <div style="flex:1;min-width:0;">
              <div class="panic-desc-toggle" style="font-size:1.1em;font-weight:bold;cursor:pointer;user-select:none;" title="Click to expand description">
                <span class="panic-arrow" style="color:#bfa046;font-size:0.7em;margin-right:4px;">▶</span>${entry.name}
              </div>
              <div style="font-size:0.95em;color:#bfa046;">${type}${subtype && subtype !== type ? ` (${subtype})` : ""}${rarity ? ` | ${rarity}` : ""}${attunement ? ` | ${attunement}` : ""}</div>
              ${spellDetails}
              ${itemDetails}
            </div>
          </div>
        `;
      }
      
      // Build description HTML (for items only, placed after actions)
      let descHtml = "";
      if (entry.type === "Item") {
        const doc = entry.document;
        let desc = doc.system?.description?.value || doc.data?.description?.value || "";
        let enrichedDesc = desc;
        try {
          const enrichContext = {
            rollData: doc.getRollData ? doc.getRollData() : {},
            relativeTo: doc
          };
          enrichedDesc = await TextEditor.enrichHTML(desc, enrichContext);
        } catch (err) {}
        descHtml = `<div class="panic-item-desc" style="font-size:0.93em;color:#bbb;display:none;margin-top:6px;padding-left:48px;border-top:1px solid #444;padding-top:6px;">${enrichedDesc}</div>`;
      }
      
      const actions = `
        <div class="panic-actions">
          <button class="panic-btn panic-pill" data-action="open">👁 Open</button>
          <button class="panic-btn panic-pill" data-action="chat">💬 Chat</button>
          ${entry.type==="Actor"
            ? `<button class="panic-btn panic-pill" data-action="spawn">🧙 Spawn</button>`
            : ""}
          ${entry.type==="Scene"
            ? `
              <button class="panic-btn panic-pill" data-action="view-scene">👁 View</button>
              <button class="panic-btn panic-pill" data-action="switch-scene">🗺 Switch</button>
            `
            : ""}
          ${canGive
            ? `<button class="panic-btn panic-pill" data-action="give-item">➕ Give</button>`
            : ""}
          ${canPlace
            ? `<button class="panic-btn panic-pill" data-action="place-item">🪙 Place Item</button>`
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
          ${descHtml}
        </div>`
      );
      el.find(".panic-btn").on("click", async ev=>{
        ev.stopPropagation();
        await runContextAction(
          ev.currentTarget.dataset.action,
          entry
        );
      });
      // Toggle description collapse/expand (clicking the title)
      el.find(".panic-desc-toggle").on("click", function(ev) {
        ev.stopPropagation();
        const titleDiv = $(this);
        const arrow = titleDiv.find(".panic-arrow");
        const descDiv = titleDiv.closest(".panic-result").find(".panic-item-desc");
        if (descDiv.is(":visible")) {
          descDiv.slideUp(150);
          arrow.text("▶");
        } else {
          descDiv.slideDown(150);
          arrow.text("▼");
        }
      });
      resultsDiv.append(el);
    }
  }


  async function doSearch() {
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
            let docType = doc.type || "";
            if (docType !== selectedItemSubtype) return;
          }
          // If weapon, filter by sub-subtype (martialM, martialR, etc.) if set
          if (type === "Item" && selectedItemSubtype === "weapon" && selectedItemSubSubtype !== "all") {
            let weaponCategory = doc.system?.type?.value || "";
            if (weaponCategory !== selectedItemSubSubtype) return;
          }
          // If feat, filter by sub-subtype (class, monster, race, etc.) if set
          if (type === "Item" && selectedItemSubtype === "feat" && selectedItemSubSubtype !== "all") {
            let featType = doc.system?.type?.value || "";
            if (featType !== selectedItemSubSubtype) return;
          }
          // If consumable, filter by sub-subtype (potion, poison, scroll, etc.) if set
          if (type === "Item" && selectedItemSubtype === "consumable" && selectedItemSubSubtype !== "all") {
            let consumableType = doc.system?.type?.value || "";
            if (consumableType !== selectedItemSubSubtype) return;
          }
          // If equipment, filter by sub-subtype (ring, wondrous, armor, etc.) if set
          if (type === "Item" && selectedItemSubtype === "equipment" && selectedItemSubSubtype !== "all") {
            let equipmentType = doc.system?.type?.value || "";
            if (equipmentType !== selectedItemSubSubtype) return;
          }
          // If tool, filter by sub-subtype (art, game, music, vehicle) if set
          if (type === "Item" && selectedItemSubtype === "tool" && selectedItemSubSubtype !== "all") {
            let toolType = doc.system?.type?.value || "";
            if (toolType !== selectedItemSubSubtype) return;
          }
          // If loot, filter by sub-subtype (gear, art, gem, etc.) if set
          if (type === "Item" && selectedItemSubtype === "loot" && selectedItemSubSubtype !== "all") {
            let lootType = doc.system?.type?.value || "";
            if (lootType !== selectedItemSubSubtype) return;
          }
          // If container, filter by sub-subtype (backpack, bag, etc.) if set
          if (type === "Item" && selectedItemSubtype === "container" && selectedItemSubSubtype !== "all") {
            let containerType = doc.system?.type?.value || "";
            if (containerType !== selectedItemSubSubtype) return;
          }
          // If spell, filter by level and/or school
          if (type === "Item" && selectedItemSubtype === "spell") {
            if (selectedItemSubSubtype !== "all") {
              let spellLevel = doc.system?.level;
              if (String(spellLevel) !== String(selectedItemSubSubtype)) return;
            }
            if (selectedSpellSchool !== "all") {
              let spellSchool = doc.system?.school || "";
              if (spellSchool !== selectedSpellSchool) return;
            }
            if (selectedSpellClass !== "all") {
              let spellClasses = getSpellClasses(doc);
              if (!spellClasses.includes(selectedSpellClass)) return;
            }
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
          let docType = r.document.type || "";
          return docType === selectedItemSubtype;
        });
      }
      // If weapon, filter by sub-subtype if set
      if (selectedItemSubtype === "weapon" && selectedItemSubSubtype !== "all") {
        results = results.filter(r => {
          let weaponCategory = r.document.system?.type?.value || "";
          return weaponCategory === selectedItemSubSubtype;
        });
      }
      // If feat, filter by sub-subtype if set
      if (selectedItemSubtype === "feat" && selectedItemSubSubtype !== "all") {
        results = results.filter(r => {
          let featType = r.document.system?.type?.value || "";
          return featType === selectedItemSubSubtype;
        });
      }
      // If consumable, filter by sub-subtype if set
      if (selectedItemSubtype === "consumable" && selectedItemSubSubtype !== "all") {
        results = results.filter(r => {
          let consumableType = r.document.system?.type?.value || "";
          return consumableType === selectedItemSubSubtype;
        });
      }
      // If equipment, filter by sub-subtype if set
      if (selectedItemSubtype === "equipment" && selectedItemSubSubtype !== "all") {
        results = results.filter(r => {
          let equipmentType = r.document.system?.type?.value || "";
          return equipmentType === selectedItemSubSubtype;
        });
      }
      // If tool, filter by sub-subtype if set
      if (selectedItemSubtype === "tool" && selectedItemSubSubtype !== "all") {
        results = results.filter(r => {
          let toolType = r.document.system?.type?.value || "";
          return toolType === selectedItemSubSubtype;
        });
      }
      // If loot, filter by sub-subtype if set
      if (selectedItemSubtype === "loot" && selectedItemSubSubtype !== "all") {
        results = results.filter(r => {
          let lootType = r.document.system?.type?.value || "";
          return lootType === selectedItemSubSubtype;
        });
      }
      // If container, filter by sub-subtype if set
      if (selectedItemSubtype === "container" && selectedItemSubSubtype !== "all") {
        results = results.filter(r => {
          let containerType = r.document.system?.type?.value || "";
          return containerType === selectedItemSubSubtype;
        });
      }
      // If spell, filter by level and/or school
      if (selectedItemSubtype === "spell") {
        if (selectedItemSubSubtype !== "all") {
          results = results.filter(r => {
            let spellLevel = r.document.system?.level;
            return String(spellLevel) === String(selectedItemSubSubtype);
          });
        }
        if (selectedSpellSchool !== "all") {
          results = results.filter(r => {
            let spellSchool = r.document.system?.school || "";
            return spellSchool === selectedSpellSchool;
          });
        }
        if (selectedSpellClass !== "all") {
          results = results.filter(r => {
            let spellClasses = getSpellClasses(r.document);
            return spellClasses.includes(selectedSpellClass);
          });
        }
      }
    }
    await renderResults(results);
  }

  // Remove the old dropdown if present
  html.find("#panic-type-filter").remove();
  input.on("input", doSearch);
  setTimeout(()=>input.focus(),50);
});