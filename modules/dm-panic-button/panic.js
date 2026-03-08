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
  // Custom style for visibility and order - fades when not hovered
  panicBtn.css({ 
    order: -100, 
    marginBottom: "4px", 
    background: "#fff", 
    color: "#c00", 
    border: "2px solid #c00",
    opacity: 0.4,
    transition: "opacity 0.2s ease"
  });
  panicBtn.on("mouseenter", function() {
    $(this).css("opacity", 1);
  }).on("mouseleave", function() {
    $(this).css("opacity", 0.4);
  });
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
let placementPreview = null;


/* =================================================
 * HELPERS
================================================= */

function getSelectedActor() {
  return canvas.tokens.controlled[0]?.actor ?? null;
}

// Converts a pointer event to snapped world coordinates (V13+ safe)
function getSnappedWorldPoint(event) {
  const world = canvas.stage.worldTransform.applyInverse(event.data.global);
  let snapped = { x: world.x, y: world.y };
  try {
    if (canvas?.grid?.getSnappedPoint) {
      const snapResult = canvas.grid.getSnappedPoint({ x: world.x, y: world.y });
      if (snapResult && typeof snapResult.x === "number" && typeof snapResult.y === "number") {
        snapped = snapResult;
      }
    }
  } catch (err) {
    if (!(err instanceof TypeError)) {
      console.error("DM Panic Button: getSnappedPoint failed", err);
    }
  }
  return snapped;
}


function getDocumentDescription(doc) {
  if (doc.system?.description?.value) return doc.system.description.value;
  if (doc.content) return doc.content;
  if (doc.pages?.size > 0) {
    const firstPage = doc.pages.contents[0];
    return firstPage?.text?.content || firstPage?.content || "";
  }
  if (doc.description) return doc.description;
  return `<i>No description available for ${doc.name}</i>`;
}


function showPlacementPreview({ img = "", size = 1 } = {}) {
  hidePlacementPreview();
  const px = canvas.grid.size * size;
  const container = new PIXI.Container();
  container.eventMode = "none";

  const gfx = new PIXI.Graphics();
  gfx.lineStyle(2, 0x00ff88, 0.9);
  gfx.beginFill(0x00ff88, 0.15);
  gfx.drawRect(0, 0, px, px);
  gfx.endFill();
  container.addChild(gfx);

  if (img) {
    try {
      const sprite = new PIXI.Sprite(PIXI.Texture.from(img));
      sprite.width = px;
      sprite.height = px;
      sprite.alpha = 0.5;
      container.addChild(sprite);
    } catch (e) { /* ignore texture errors */ }
  }

  canvas.tokens.addChild(container);

  const onMove = (event) => {
    const snapped = getSnappedWorldPoint(event);
    container.position.set(snapped.x, snapped.y);
  };
  canvas.stage.on("pointermove", onMove);
  container._dmPanicMoveHandler = onMove;
  placementPreview = container;
}


function hidePlacementPreview() {
  if (!placementPreview) return;
  canvas.stage.off("pointermove", placementPreview._dmPanicMoveHandler);
  placementPreview.destroy({ children: true });
  placementPreview = null;
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

  const actor = entry.document;
  showPlacementPreview({
    img: actor?.prototypeToken?.texture?.src || actor?.img || "",
    size: actor?.prototypeToken?.width ?? 1
  });

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

  const snapped = getSnappedWorldPoint(event);

  tokenDoc.updateSource({
    x: snapped.x,
    y: snapped.y
  });

  hidePlacementPreview();

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
  showPlacementPreview({ img: entry.document?.img || "", size: 0.5 });
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

  const snapped = getSnappedWorldPoint(event);

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
    hidePlacementPreview();
    pendingSpawnEntry = null;
    return;
  }
  const tokenDoc = await actor.getTokenDocument();
  tokenDoc.updateSource({
    x: snapped.x,
    y: snapped.y,
    width: 0.5,
    height: 0.5,
    light: {
      alpha: 0.5,
      angle: 360,
      bright: 5,
      color: "#fff700",
      coloration: 1,
      dim: 1.5,
      attenuation: 0.5,
      luminosity: 0.5,
      saturation: 0,
      contrast: 0,
      shadows: 0,
      animation: {
        type: "starlight",
        speed: 5,
        intensity: 5,
        reverse: false
      },
      darkness: { min: 0, max: 1 },
      negative: false,
      priority: 0
    }
  });
  hidePlacementPreview();
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

async function runContextAction(action, entry, onRefresh) {

  console.log("PANIC ACTION:", action, entry);  // cancel placement if another action used
  hidePlacementPreview();
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
      const description = getDocumentDescription(doc);

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

    case "roll-table": {
      const table = game.tables.get(doc.id);
      if (!table) return;
      await table.draw();
      break;
    }

    case "show-art": {
      const ip = new ImagePopout(doc.img, { title: doc.name, shareable: true, uuid: doc.uuid });
      await ip.render(true);
      ip.shareImage();
      break;
    }

    case "delete": {
      const confirmed = await Dialog.confirm({
        title: "Delete",
        content: `<p>Permanently delete <strong>${doc.name}</strong>? This cannot be undone.</p>`,
        defaultYes: false
      });
      if (!confirmed) break;
      await doc.delete();
      onRefresh?.();
      break;
    }
  }
}

/* =================================================
 * CREATE DIALOGS
================================================= */

function openCreateItemDialog(onCreated) {
  const itemTypes = [
    { value: "weapon",     label: "Weapon" },
    { value: "equipment",  label: "Equipment" },
    { value: "consumable", label: "Consumable" },
    { value: "tool",       label: "Tool" },
    { value: "loot",       label: "Loot" },
    { value: "container",  label: "Container" },
    { value: "spell",      label: "Spell" },
    { value: "feat",       label: "Feature / Feat" }
  ];
  const rarities = [
    { value: "common",    label: "Common" },
    { value: "uncommon",  label: "Uncommon" },
    { value: "rare",      label: "Rare" },
    { value: "veryRare",  label: "Very Rare" },
    { value: "legendary", label: "Legendary" },
    { value: "artifact",  label: "Artifact" }
  ];

  function buildSubtypeOptions(type) {
    const opts = FILTER_CONFIG.Item.subSubtypes[type] || {};
    const entries = Object.entries(opts);
    if (!entries.length) return '<option value="">— None —</option>';
    return entries.map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  }

  const content = `
    <form class="panic-create-form" style="display:flex;flex-direction:column;gap:8px;padding:4px 0;">
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" placeholder="Item name" style="width:100%" autofocus />
      </div>
      <div class="form-group">
        <label>Type</label>
        <select name="itemType" id="panic-new-item-type">
          ${itemTypes.map(t => `<option value="${t.value}">${t.label}</option>`).join("")}
        </select>
      </div>
      <div class="form-group" id="panic-new-subtype-group">
        <label>Subtype</label>
        <select name="itemSubtype" id="panic-new-item-subtype">
          ${buildSubtypeOptions("weapon")}
        </select>
      </div>
      <div class="form-group">
        <label>Rarity</label>
        <select name="rarity">
          ${rarities.map(r => `<option value="${r.value}">${r.label}</option>`).join("")}
        </select>
      </div>
    </form>`;

  new Dialog({
    title: "Create New Item",
    content,
    buttons: {
      create: {
        icon: '<i class="fas fa-plus"></i>',
        label: "Create",
        callback: async (html) => {
          const form = html.find("form")[0];
          const name = form.name.value.trim() || "New Item";
          const itemType = form.itemType.value;
          const subtype = form.itemSubtype?.value || "";
          const rarity = form.rarity.value;

          const system = { rarity };
          if (itemType === "spell") {
            system.level = parseInt(subtype) || 0;
          } else if (subtype) {
            system.type = { value: subtype };
          }

          const item = await Item.create({ name, type: itemType, system });
          if (item) {
            item.sheet.render(true);
            onCreated?.();
          }
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "create",
    render: (html) => {
      html.find("#panic-new-item-type").on("change", function () {
        const opts = buildSubtypeOptions(this.value);
        html.find("#panic-new-item-subtype").html(opts);
        const hasSubtypes = Object.keys(FILTER_CONFIG.Item.subSubtypes[this.value] || {}).length > 0;
        html.find("#panic-new-subtype-group").toggle(hasSubtypes);
      });
    }
  }).render(true);
}


function openCreateActorDialog(onCreated) {
  const crValues = [0, 0.125, 0.25, 0.5,
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  const crLabel = cr => ({ 0.125: "1/8", 0.25: "1/4", 0.5: "1/2" }[cr] ?? String(cr));

  const content = `
    <form class="panic-create-form" style="display:flex;flex-direction:column;gap:8px;padding:4px 0;">
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" placeholder="Actor name" style="width:100%" autofocus />
      </div>
      <div class="form-group">
        <label>Type</label>
        <select name="actorType" id="panic-new-actor-type">
          <option value="npc">NPC</option>
          <option value="character">Character</option>
        </select>
      </div>
      <div class="form-group" id="panic-new-creature-type-group">
        <label>Creature Type</label>
        <select name="creatureType">
          ${Object.entries(FILTER_CONFIG.Actor.creatureTypes).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}
        </select>
      </div>
      <div class="form-group" id="panic-new-cr-group">
        <label>Challenge Rating</label>
        <select name="cr">
          ${crValues.map(cr => `<option value="${cr}">CR ${crLabel(cr)}</option>`).join("")}
        </select>
      </div>
    </form>`;

  new Dialog({
    title: "Create New Actor",
    content,
    buttons: {
      create: {
        icon: '<i class="fas fa-plus"></i>',
        label: "Create",
        callback: async (html) => {
          const form = html.find("form")[0];
          const name = form.name.value.trim() || "New Actor";
          const actorType = form.actorType.value;
          const system = actorType === "npc" ? {
            details: {
              type: { value: form.creatureType.value },
              cr: parseFloat(form.cr.value) || 0
            }
          } : {};

          const actor = await Actor.create({ name, type: actorType, system });
          if (actor) {
            actor.sheet.render(true);
            onCreated?.();
          }
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "create",
    render: (html) => {
      html.find("#panic-new-actor-type").on("change", function () {
        const isNpc = this.value === "npc";
        html.find("#panic-new-creature-type-group, #panic-new-cr-group").toggle(isNpc);
      });
    }
  }).render(true);
}


/* =================================================
 * UI RENDER
================================================= */

Hooks.on("renderDMPanicButton",(app,html)=>{
    // Make the app fade when not hovered
    const appElement = html.closest(".app");
    appElement.css({
      opacity: 0.4,
      transition: "opacity 0.3s ease"
    });
    appElement.on("mouseenter", function() {
      $(this).css("opacity", 1);
    }).on("mouseleave", function() {
      $(this).css("opacity", 0.4);
    });
    
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
        #dm-panic-button .window-content {
          overflow: hidden !important;
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

    // Create bar (inserted once between HR and search)
    if (!html.find('#panic-create-bar').length) {
      input.parent().before(`
        <div id="panic-create-bar" style="display:flex;gap:6px;margin:2px 0 6px 0;">
          <button id="panic-create-item-btn" class="panic-btn panic-pill" style="flex:1;">➕ New Item</button>
          <button id="panic-create-actor-btn" class="panic-btn panic-pill" style="flex:1;">➕ New Actor</button>
        </div>`);
    }

  let selectedType = "all";
  let selectedItemSubtype = "all";
  let selectedItemSubSubtype = "all"; // Third-tier filter (e.g., martialM, martialR, natural, spell level)
  let selectedSpellSchool = "all"; // Fourth-tier filter for spell school
  let selectedSpellClass = "all"; // Fifth-tier filter for spell class
  
  // Actor filter state
  let selectedActorSubtype = "all"; // npc, character, vehicle, etc.
  let selectedCreatureType = "all"; // dragon, humanoid, beast, etc.
  let selectedCRRange = "all"; // CR range for NPCs

  // ── CR range lookup (shared by pills + matchesFilters) ──────────────────
  const CR_RANGES = {
    "0":     { min: 0,     max: 0     },
    "0.125": { min: 0.125, max: 0.125 },
    "0.25":  { min: 0.25,  max: 0.25  },
    "0.5":   { min: 0.5,   max: 0.5   },
    "1-4":   { min: 1,     max: 4     },
    "5-10":  { min: 5,     max: 10    },
    "11-16": { min: 11,    max: 16    },
    "17+":   { min: 17,    max: 999   }
  };

  // ── Renders sub-subtype pill row into #panic-subsubtype-container ────────
  function renderSubSubtypePills(subtype, { allLabel = "All Types", getValue = i => i.system?.type?.value || "", sort = false } = {}) {
    const items = game.items.contents.filter(i => i.type === subtype);
    let values = [...new Set(items.map(getValue))].filter(v => v !== "" && v !== undefined && v !== null);
    if (sort) values = values.sort((a, b) => a - b);
    if (!values.length) return;

    let pillHtml = `<div id="panic-subsubtype-menu" class="panic-item-subsubtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
    pillHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="all">${allLabel}</button>`;
    values.forEach(v => {
      const label = getSubSubtypeLabel("Item", subtype, v);
      pillHtml += `<button class="panic-subsubtype-btn panic-pill" data-subsubtype="${v}">${label}</button>`;
    });
    pillHtml += `</div>`;

    html.find("#panic-subsubtype-container").html(pillHtml);
    html.find(".panic-subsubtype-btn").on("click", function() {
      const clicked = $(this).data("subsubtype");
      selectedItemSubSubtype = selectedItemSubSubtype === clicked ? "all" : clicked;
      updateCategoryMenu();
      doSearch();
    });
    html.find('.panic-subsubtype-btn').removeClass('selected');
    html.find(`.panic-subsubtype-btn[data-subsubtype='${selectedItemSubSubtype}']`).addClass('selected');
  }

  // ── Single source-of-truth predicate for all active filter state ─────────
  function matchesFilters(doc, type) {
    // Item subtype
    if (type === "Item" && selectedItemSubtype !== "all") {
      if ((doc.type || "") !== selectedItemSubtype) return false;
    }
    // Item sub-subtype (weapon / feat / consumable / equipment / tool / loot / container all use system.type.value)
    const TYPED_SUBTYPES = ["weapon", "feat", "consumable", "equipment", "tool", "loot", "container"];
    if (type === "Item" && TYPED_SUBTYPES.includes(selectedItemSubtype) && selectedItemSubSubtype !== "all") {
      if ((doc.system?.type?.value || "") !== selectedItemSubSubtype) return false;
    }
    // Spell filters
    if (type === "Item" && selectedItemSubtype === "spell") {
      if (selectedItemSubSubtype !== "all" && String(doc.system?.level) !== String(selectedItemSubSubtype)) return false;
      if (selectedSpellSchool !== "all" && (doc.system?.school || "") !== selectedSpellSchool) return false;
      if (selectedSpellClass !== "all" && !getSpellClasses(doc).includes(selectedSpellClass)) return false;
    }
    // Actor subtype
    if (type === "Actor" && selectedActorSubtype !== "all") {
      if ((doc.type || "") !== selectedActorSubtype) return false;
    }
    // NPC creature type
    if (type === "Actor" && selectedActorSubtype === "npc" && selectedCreatureType !== "all") {
      if ((doc.system?.details?.type?.value || "") !== selectedCreatureType) return false;
    }
    // NPC CR range
    if (type === "Actor" && selectedActorSubtype === "npc" && selectedCRRange !== "all") {
      const cr = doc.system?.details?.cr;
      if (cr === undefined || cr === null) return false;
      const range = CR_RANGES[selectedCRRange];
      if (!range || cr < range.min || cr > range.max) return false;
    }
    return true;
  }

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

      // Sub-subtype pills for typed item subtypes
      const TYPED_SUBTYPES_WITH_PILLS = ["weapon", "feat", "consumable", "equipment", "tool", "loot", "container"];
      if (TYPED_SUBTYPES_WITH_PILLS.includes(selectedItemSubtype)) {
        renderSubSubtypePills(selectedItemSubtype);
      }

      // Show sub-subtype pills if "spell" is selected (for spell level and school)
      if (selectedItemSubtype === "spell") {
        let spellItems = allItems.filter(i => i.type === "spell");
        
        // Spell Level row
        renderSubSubtypePills("spell", { allLabel: "All Levels", getValue: i => i.system?.level, sort: true });
        
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
    
    // Show Actor subtype pills if Actor selected
    if (selectedType === "Actor") {
      let allActors = game.actors.contents;
      let actorSubtypes = [...new Set(allActors.map(a => a.type || ""))].filter(Boolean);
      if (actorSubtypes.length) {
        let actorSubtypeHtml = `<div id="panic-actor-subtype-menu" class="panic-item-subtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
        actorSubtypeHtml += `<button class="panic-actor-subtype-btn panic-pill" data-subtype="all">All</button>`;
        actorSubtypes.forEach(st => {
          const label = st.charAt(0).toUpperCase() + st.slice(1);
          actorSubtypeHtml += `<button class="panic-actor-subtype-btn panic-pill" data-subtype="${st}">${label}</button>`;
        });
        actorSubtypeHtml += `</div>`;
        html.find("#panic-subtype-container").html(actorSubtypeHtml);
        html.find(".panic-actor-subtype-btn").on("click", function() {
          const clickedSubtype = $(this).data("subtype");
          if (selectedActorSubtype === clickedSubtype) {
            selectedActorSubtype = "all";
          } else {
            selectedActorSubtype = clickedSubtype;
          }
          selectedCreatureType = "all";
          selectedCRRange = "all";
          updateCategoryMenu();
          doSearch();
        });
        html.find('.panic-actor-subtype-btn').removeClass('selected');
        html.find(`.panic-actor-subtype-btn[data-subtype='${selectedActorSubtype}']`).addClass('selected');
      }
      
      // Show creature type and CR filters for NPCs
      if (selectedActorSubtype === "npc") {
        let npcActors = allActors.filter(a => a.type === "npc");
        
        // Creature Type row
        let creatureTypes = [...new Set(npcActors.map(a => a.system?.details?.type?.value || ""))].filter(Boolean).sort();
        if (creatureTypes.length) {
          let creatureHtml = `<div id="panic-creaturetype-menu" class="panic-item-subsubtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
          creatureHtml += `<button class="panic-creaturetype-btn panic-pill" data-creature="all">All Types</button>`;
          creatureTypes.forEach(ct => {
            const label = FILTER_CONFIG.Actor.creatureTypes[ct] || ct.charAt(0).toUpperCase() + ct.slice(1);
            creatureHtml += `<button class="panic-creaturetype-btn panic-pill" data-creature="${ct}">${label}</button>`;
          });
          creatureHtml += `</div>`;
          html.find("#panic-subsubtype-container").html(creatureHtml);
          html.find(".panic-creaturetype-btn").on("click", function() {
            const clickedType = $(this).data("creature");
            if (selectedCreatureType === clickedType) {
              selectedCreatureType = "all";
            } else {
              selectedCreatureType = clickedType;
            }
            updateCategoryMenu();
            doSearch();
          });
          html.find('.panic-creaturetype-btn').removeClass('selected');
          html.find(`.panic-creaturetype-btn[data-creature='${selectedCreatureType}']`).addClass('selected');
        }
        
        // CR Range row
        let crValues = npcActors.map(a => a.system?.details?.cr).filter(cr => cr !== undefined && cr !== null);
        if (crValues.length) {
          // Group CRs into ranges
          const crRanges = [
            { key: "0", label: "CR 0", min: 0, max: 0 },
            { key: "0.125", label: "CR 1/8", min: 0.125, max: 0.125 },
            { key: "0.25", label: "CR 1/4", min: 0.25, max: 0.25 },
            { key: "0.5", label: "CR 1/2", min: 0.5, max: 0.5 },
            { key: "1-4", label: "CR 1-4", min: 1, max: 4 },
            { key: "5-10", label: "CR 5-10", min: 5, max: 10 },
            { key: "11-16", label: "CR 11-16", min: 11, max: 16 },
            { key: "17+", label: "CR 17+", min: 17, max: 999 }
          ];
          
          // Only show ranges that have actors
          const availableRanges = crRanges.filter(range => 
            crValues.some(cr => cr >= range.min && cr <= range.max)
          );
          
          if (availableRanges.length) {
            // Create CR container if it doesn't exist
            if (!html.find("#panic-cr-container").length) {
              html.find("#panic-subsubtype-container").after('<div id="panic-cr-container"></div>');
            }
            let crHtml = `<div id="panic-cr-menu" class="panic-item-subsubtype-menu" style="display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto;">`;
            crHtml += `<button class="panic-cr-btn panic-pill" data-cr="all">All CRs</button>`;
            availableRanges.forEach(range => {
              crHtml += `<button class="panic-cr-btn panic-pill" data-cr="${range.key}">${range.label}</button>`;
            });
            crHtml += `</div>`;
            html.find("#panic-cr-container").html(crHtml);
            html.find(".panic-cr-btn").on("click", function() {
              const clickedCR = $(this).data("cr");
              if (selectedCRRange === clickedCR) {
                selectedCRRange = "all";
              } else {
                selectedCRRange = clickedCR;
              }
              updateCategoryMenu();
              doSearch();
            });
            html.find('.panic-cr-btn').removeClass('selected');
            html.find(`.panic-cr-btn[data-cr='${selectedCRRange}']`).addClass('selected');
          }
        }
      } else {
        // Clear CR container if not NPC
        html.find("#panic-cr-container").empty();
      }
    } else {
      // Clear CR container if not Actor
      html.find("#panic-cr-container").empty();
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
      
      // Measure each filter row's natural width (includes spell school/class/CR rows)
      const rows = filterContainer.querySelectorAll('[id$="-menu"]');
      let maxWidth = 400; // minimum width

      rows.forEach(row => {
        const rowWidth = row.scrollWidth + 40; // add padding for container margins
        if (rowWidth > maxWidth) maxWidth = rowWidth;
      });
      
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
      selectedActorSubtype = "all";
      selectedCreatureType = "all";
      selectedCRRange = "all";
    } else {
      selectedType = clickedType;
      selectedItemSubtype = "all";
      selectedItemSubSubtype = "all";
      selectedSpellSchool = "all";
      selectedSpellClass = "all";
      selectedActorSubtype = "all";
      selectedCreatureType = "all";
      selectedCRRange = "all";
    }
    updateCategoryMenu();
    doSearch();
  });
  updateCategoryMenu();

  html.find('#panic-create-item-btn').on('click', () => openCreateItemDialog(() => input.trigger("input")));
  html.find('#panic-create-actor-btn').on('click', () => openCreateActorDialog(() => input.trigger("input")));


  async function renderResults(list){
    resultsDiv.empty();
    const actorSelected = getSelectedActor();
    
    // Build folder tree structure for any document type
    // Each node: { id, name, sort, children: Map, items: [] }
    const buildFolderTree = (entries, docType) => {
      const root = { id: "__root__", name: "Root", sort: 0, children: new Map(), items: [] };
      const noFolder = { id: `__no_folder_${docType}__`, name: "No Folder", sort: Infinity, children: new Map(), items: [] };
      
      // First, build a map of all folders we need
      const folderNodes = new Map();
      
      for (const entry of entries) {
        if (entry.type !== docType) continue;
        const doc = entry.document;
        const folder = doc.folder;
        
        if (!folder) {
          noFolder.items.push(entry);
          continue;
        }
        
        // Walk up and ensure all ancestor folders exist in our tree
        const ancestors = [];
        let current = folder;
        while (current) {
          ancestors.unshift(current);
          current = current.folder;
        }
        
        // Build/link the folder chain
        let parentNode = root;
        for (const f of ancestors) {
          if (!folderNodes.has(f.id)) {
            folderNodes.set(f.id, {
              id: f.id,
              name: f.name,
              sort: f.sort ?? 0,
              children: new Map(),
              items: []
            });
          }
          const node = folderNodes.get(f.id);
          if (!parentNode.children.has(f.id)) {
            parentNode.children.set(f.id, node);
          }
          parentNode = node;
        }
        
        // Add entry to its direct parent folder
        parentNode.items.push(entry);
      }
      
      // Add "No Folder" if it has items
      if (noFolder.items.length > 0) {
        root.children.set(noFolder.id, noFolder);
      }
      
      return root;
    };
    
    // Separate entries by type
    const otherEntries = [];
    const journalEntries = [];
    const sceneEntries = [];
    const macroEntries = [];
    const rollTableEntries = [];
    
    for (const entry of list) {
      if (entry.type === "Journal") {
        journalEntries.push(entry);
      } else if (entry.type === "Scene") {
        sceneEntries.push(entry);
      } else if (entry.type === "Macro") {
        macroEntries.push(entry);
      } else if (entry.type === "RollTable") {
        rollTableEntries.push(entry);
      } else {
        otherEntries.push(entry);
      }
    }
    
    // Build folder trees
    const journalTree = buildFolderTree(journalEntries, "Journal");
    const sceneTree = buildFolderTree(sceneEntries, "Scene");
    const rollTableTree = buildFolderTree(rollTableEntries, "RollTable");
    
    // Helper to render a single entry
    const renderEntry = async (entry) => {
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
      
      // Actor-specific details
      if (entry.type === "Actor") {
        const doc = entry.document;
        const img = doc.img || "icons/svg/mystery-man.svg";
        const actorType = doc.type || "";
        const sys = doc.system || {};
        
        let actorDetails = [];
        
        // For NPCs, show CR, creature type, size
        if (actorType === "npc") {
          // CR
          const cr = sys.details?.cr;
          if (cr !== undefined && cr !== null) {
            let crDisplay = cr;
            if (cr === 0.125) crDisplay = "1/8";
            else if (cr === 0.25) crDisplay = "1/4";
            else if (cr === 0.5) crDisplay = "1/2";
            actorDetails.push(`CR ${crDisplay}`);
          }
          
          // Creature type
          const creatureType = sys.details?.type?.value;
          if (creatureType) {
            actorDetails.push(FILTER_CONFIG.Actor.creatureTypes[creatureType] || creatureType.charAt(0).toUpperCase() + creatureType.slice(1));
          }
          
          // Size
          const size = sys.traits?.size;
          const sizeLabels = { tiny: "Tiny", sm: "Small", med: "Medium", lg: "Large", huge: "Huge", grg: "Gargantuan" };
          if (size && sizeLabels[size]) {
            actorDetails.push(sizeLabels[size]);
          }
        }
        
        // HP and AC for all actors
        const hp = sys.attributes?.hp;
        if (hp?.max) {
          const hpCurrent = hp.value ?? hp.max;
          actorDetails.push(`HP ${hpCurrent}/${hp.max}`);
        }
        
        const ac = sys.attributes?.ac;
        if (ac?.flat || ac?.value) {
          actorDetails.push(`AC ${ac.flat || ac.value}`);
        }
        
        // Movement for NPCs
        const movement = sys.attributes?.movement;
        if (movement && actorType === "npc") {
          let speeds = [];
          if (movement.walk) speeds.push(`${movement.walk} ft`);
          if (movement.fly) speeds.push(`Fly ${movement.fly}`);
          if (movement.swim) speeds.push(`Swim ${movement.swim}`);
          if (movement.burrow) speeds.push(`Burrow ${movement.burrow}`);
          if (movement.climb) speeds.push(`Climb ${movement.climb}`);
          if (speeds.length > 0 && speeds.length <= 3) {
            actorDetails.push(speeds.join(", "));
          } else if (speeds.length > 0) {
            actorDetails.push(speeds[0] + (speeds.length > 1 ? "..." : ""));
          }
        }
        
        const actorDetailsHtml = actorDetails.length 
          ? `<div style="font-size:0.9em;color:#8cb4d9;margin-top:2px;">${actorDetails.join(" | ")}</div>` 
          : "";
        
        detailsHtml = `
          <div class="panic-actor-details" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:4px;">
            <img src="${img}" alt="actor" style="width:38px;height:38px;object-fit:contain;border-radius:6px;border:1.5px solid #bfa046;background:#222;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:1.1em;font-weight:bold;">${entry.name}</div>
              <div style="font-size:0.95em;color:#bfa046;">${actorType.charAt(0).toUpperCase() + actorType.slice(1)}</div>
              ${actorDetailsHtml}
            </div>
          </div>
        `;
      }
      
      // Journal-specific details with page list
      if (entry.type === "Journal") {
        const doc = entry.document;
        const img = doc.pages?.contents?.[0]?.src || "icons/svg/book.svg";
        const pageCount = doc.pages?.size || 0;
        const pageLabel = pageCount === 1 ? "1 page" : `${pageCount} pages`;
        
        // Build page list HTML
        let pageListHtml = "";
        if (pageCount > 0) {
          const pageItems = doc.pages.contents
            .sort((a, b) => a.sort - b.sort)
            .map(p => {
              const pageType = p.type || "text";
              const pageIcon = pageType === "image" ? "🖼" : pageType === "video" ? "🎬" : pageType === "pdf" ? "📄" : "📝";
              return `<div class="panic-page-row" style="display:flex;align-items:center;gap:6px;padding:3px 6px;margin:2px 0;border-radius:4px;background:rgba(191,160,70,0.1);font-size:0.9em;">
                <span class="panic-page-link" data-page-id="${p._id}" style="cursor:pointer;flex:1;" title="Open ${p.name}">${pageIcon} ${p.name}</span>
                <span class="panic-page-chat" data-page-id="${p._id}" style="cursor:pointer;opacity:0.7;" title="Send to chat">💬</span>
              </div>`;
            })
            .join("");
          pageListHtml = `<div class="panic-journal-pages" style="display:none;margin-top:6px;padding-left:10px;border-left:2px solid #bfa046;">${pageItems}</div>`;
        }
        
        detailsHtml = `
          <div class="panic-journal-details" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:4px;">
            <img src="${img}" alt="journal" style="width:38px;height:38px;object-fit:contain;border-radius:6px;border:1.5px solid #bfa046;background:#222;">
            <div style="flex:1;min-width:0;">
              <div class="panic-journal-toggle" style="font-size:1.1em;font-weight:bold;cursor:pointer;user-select:none;" title="Click to show pages">
                <span class="panic-arrow" style="color:#bfa046;font-size:0.7em;margin-right:4px;">▶</span>${entry.name}
              </div>
              <div style="font-size:0.95em;color:#bfa046;">${pageLabel}</div>
              ${pageListHtml}
            </div>
          </div>
        `;
      }
      
      // Build description HTML (for items only, placed after actions)
      let descHtml = "";
      if (entry.type === "Item") {
        const doc = entry.document;
        let enrichedDesc = getDocumentDescription(doc);
        try {
          const enrichContext = {
            rollData: doc.getRollData ? doc.getRollData() : {},
            relativeTo: doc
          };
          enrichedDesc = await TextEditor.enrichHTML(enrichedDesc, enrichContext);
        } catch (err) {}
        descHtml = `<div class="panic-item-desc" style="font-size:0.93em;color:#bbb;display:none;margin-top:6px;padding-left:48px;border-top:1px solid #444;padding-top:6px;">${enrichedDesc}</div>`;
      }
      
      const actions = `
        <div class="panic-actions">
          <button class="panic-btn panic-pill" data-action="open">👁 Open</button>
          <button class="panic-btn panic-pill" data-action="chat">💬 Chat</button>
          ${entry.type==="Actor"
            ? `
              <button class="panic-btn panic-pill" data-action="spawn">🧙 Spawn</button>
              <button class="panic-btn panic-pill" data-action="show-art">🖼 Show Art</button>
            `
            : ""}
          ${entry.type==="Scene"
            ? `
              <button class="panic-btn panic-pill" data-action="view-scene">👁 View</button>
              <button class="panic-btn panic-pill" data-action="switch-scene">🗺 Switch</button>
            `
            : ""}
          ${entry.type==="RollTable"
            ? `<button class="panic-btn panic-pill" data-action="roll-table">🎲 Roll</button>`
            : ""}
          ${canGive
            ? `<button class="panic-btn panic-pill" data-action="give-item">➕ Give</button>`
            : ""}
          ${canPlace
            ? `<button class="panic-btn panic-pill" data-action="place-item">🪙 Place Item</button>`
            : ""}
          <button class="panic-btn panic-pill" data-action="delete" style="color:#e05050;">🗑 Delete</button>
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
          entry,
          () => input.trigger("input")
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
      // Toggle journal pages list (clicking the journal title)
      el.find(".panic-journal-toggle").on("click", function(ev) {
        ev.stopPropagation();
        const titleDiv = $(this);
        const arrow = titleDiv.find(".panic-arrow");
        const pagesDiv = titleDiv.closest(".panic-journal-details").find(".panic-journal-pages");
        if (pagesDiv.is(":visible")) {
          pagesDiv.slideUp(150);
          arrow.text("▶");
        } else {
          pagesDiv.slideDown(150);
          arrow.text("▼");
        }
      });
      // Click on individual journal page to open to that page
      el.find(".panic-page-link").on("click", function(ev) {
        ev.stopPropagation();
        const pageId = $(this).data("page-id");
        const doc = entry.document;
        doc.sheet?.render(true, { pageId: pageId });
      });
      // Chat button for individual journal pages
      el.find(".panic-page-chat").on("click", async function(ev) {
        ev.stopPropagation();
        const pageId = $(this).data("page-id");
        const doc = entry.document;
        const page = doc.pages.get(pageId);
        if (!page) return;
        
        // Get page content based on type
        let content = "";
        if (page.type === "text") {
          content = page.text?.content || "";
          
          // Strip DM-only/secret content before posting to chat
          // Parse HTML and remove secret blocks
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = content;
          
          // Remove <section class="secret"> blocks
          tempDiv.querySelectorAll("section.secret, .secret, [data-visibility='gm']").forEach(el => el.remove());
          
          // Also remove elements with id starting with "secret-"
          tempDiv.querySelectorAll("[id^='secret-']").forEach(el => el.remove());
          
          content = tempDiv.innerHTML;
        } else if (page.type === "image") {
          content = `<img src="${page.src}" alt="${page.name}" style="max-width:100%;">`;
        } else if (page.type === "video") {
          content = `<p><em>Video: ${page.name}</em></p>`;
        } else if (page.type === "pdf") {
          content = `<p><em>PDF: ${page.name}</em></p>`;
        }
        
        // Enrich the HTML
        let enrichedContent = content;
        try {
          enrichedContent = await TextEditor.enrichHTML(content, { relativeTo: doc });
        } catch (err) {}
        
        ChatMessage.create({
          content: `<h3>${doc.name}: ${page.name}</h3>${enrichedContent}`,
          speaker: ChatMessage.getSpeaker()
        });
      });
      // Hover effect for page rows
      el.find(".panic-page-row").on("mouseenter", function() {
        $(this).css("background", "rgba(191,160,70,0.3)");
      }).on("mouseleave", function() {
        $(this).css("background", "rgba(191,160,70,0.1)");
      });
      // Hover effect for chat icon
      el.find(".panic-page-chat").on("mouseenter", function() {
        $(this).css("opacity", "1");
      }).on("mouseleave", function() {
        $(this).css("opacity", "0.7");
      });
      return el;
    };
    
    // Recursive function to render folder tree (generic for any document type)
    const renderFolderTree = async (node, depth = 0, itemLabel = "item", noFolderPrefix = "__no_folder") => {
      const container = $('<div class="panic-folder-tree"></div>');
      
      // Sort children folders alphabetically ("No Folder" last)
      const sortedChildren = [...node.children.values()].sort((a, b) => {
        if (a.id.startsWith(noFolderPrefix)) return 1;
        if (b.id.startsWith(noFolderPrefix)) return -1;
        return a.name.localeCompare(b.name);
      });
      
      for (const childFolder of sortedChildren) {
        const safeFolderId = childFolder.id.replace(/[^a-zA-Z0-9]/g, '_');
        const hasChildren = childFolder.children.size > 0;
        const hasItems = childFolder.items.length > 0;
        
        // Count total items in this folder and all subfolders
        const countItems = (n) => {
          let count = n.items.length;
          for (const c of n.children.values()) count += countItems(c);
          return count;
        };
        const totalItems = countItems(childFolder);
        
        // Create folder header with indentation based on depth
        const indent = depth * 16;
        const folderHeader = $(`
          <div class="panic-folder-header" data-folder-id="${safeFolderId}" style="display:flex;align-items:center;gap:8px;padding:6px 10px;padding-left:${10 + indent}px;margin:4px 0 2px 0;background:linear-gradient(90deg,rgba(191,160,70,${0.25 - depth * 0.05}) 0%,transparent 100%);border-left:3px solid #bfa046;cursor:pointer;user-select:none;">
            <span class="panic-folder-arrow" style="color:#bfa046;font-size:0.8em;">▶</span>
            <span style="font-size:${1.05 - depth * 0.05}em;font-weight:bold;color:#bfa046;">📁 ${childFolder.name}</span>
            <span style="font-size:0.85em;color:#888;margin-left:auto;">${totalItems} ${totalItems === 1 ? itemLabel : itemLabel + 's'}</span>
          </div>
        `);
        
        // Create container for this folder's contents (starts collapsed)
        const folderContents = $(`<div class="panic-folder-contents" data-folder-id="${safeFolderId}" style="display:none;"></div>`);
        
        // Add subfolders first (recursively)
        if (hasChildren) {
          const subfolderContainer = await renderFolderTree(childFolder, depth + 1, itemLabel, noFolderPrefix);
          folderContents.append(subfolderContainer);
        }
        
        // Add items in this folder
        if (hasItems) {
          const itemContainer = $(`<div class="panic-folder-items" style="padding-left:${indent + 16}px;"></div>`);
          childFolder.items.sort((a, b) => a.name.localeCompare(b.name));
          for (const entry of childFolder.items) {
            const el = await renderEntry(entry);
            itemContainer.append(el);
          }
          folderContents.append(itemContainer);
        }
        
        // Toggle folder collapse/expand
        const fid = safeFolderId;
        folderHeader.on("click", function(ev) {
          ev.stopPropagation();
          const arrow = $(this).find(".panic-folder-arrow");
          const contents = $(this).next(`.panic-folder-contents[data-folder-id="${fid}"]`);
          if (contents.is(":visible")) {
            contents.slideUp(150);
            arrow.text("▶");
          } else {
            contents.slideDown(150);
            arrow.text("▼");
          }
        });
        
        container.append(folderHeader);
        container.append(folderContents);
      }
      
      return container;
    };
    
    // Render other entries first (Items, Actors, etc.)
    for (const entry of otherEntries) {
      const el = await renderEntry(entry);
      resultsDiv.append(el);
    }
    
    // Render scene folder tree
    if (sceneTree.children.size > 0) {
      const sceneHeader = $(`<div style="margin:12px 0 6px 0;padding:6px 10px;font-size:1.1em;font-weight:bold;color:#bfa046;border-bottom:1px solid #bfa046;">🗺 Scenes</div>`);
      resultsDiv.append(sceneHeader);
      const sceneContainer = await renderFolderTree(sceneTree, 0, "scene", "__no_folder_Scene");
      resultsDiv.append(sceneContainer);
    }
    
    // Render journal folder tree
    if (journalTree.children.size > 0) {
      const journalHeader = $(`<div style="margin:12px 0 6px 0;padding:6px 10px;font-size:1.1em;font-weight:bold;color:#bfa046;border-bottom:1px solid #bfa046;">📖 Journals</div>`);
      resultsDiv.append(journalHeader);
      const journalContainer = await renderFolderTree(journalTree, 0, "journal", "__no_folder_Journal");
      resultsDiv.append(journalContainer);
    }
    
    // Render roll table folder tree
    if (rollTableTree.children.size > 0) {
      const rollTableHeader = $(`<div style="margin:12px 0 6px 0;padding:6px 10px;font-size:1.1em;font-weight:bold;color:#bfa046;border-bottom:1px solid #bfa046;">🎲 Roll Tables</div>`);
      resultsDiv.append(rollTableHeader);
      const rollTableContainer = await renderFolderTree(rollTableTree, 0, "table", "__no_folder_RollTable");
      resultsDiv.append(rollTableContainer);
    }
    
    // Render macro hotbar (all 5 pages)
    if (macroEntries.length > 0) {
      const hotbar = game.user.hotbar || {};
      const macroHeader = $(`<div style="margin:12px 0 6px 0;padding:6px 10px;font-size:1.1em;font-weight:bold;color:#bfa046;border-bottom:1px solid #bfa046;">⚡ Macro Hotbar</div>`);
      resultsDiv.append(macroHeader);
      
      // Create hotbar container
      const hotbarContainer = $('<div class="panic-macro-hotbar"></div>');
      
      for (let page = 1; page <= 5; page++) {
        // Page label
        const pageLabel = $(`<div style="font-size:0.9em;font-weight:bold;color:#bfa046;margin:${page > 1 ? '8px' : '4px'} 0 6px 0;">Page ${page}</div>`);
        hotbarContainer.append(pageLabel);
        
        // Create grid for 10 slots (2 rows of 5)
        const slotGrid = $(`<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;"></div>`);
        
        for (let slot = 1; slot <= 10; slot++) {
          const globalSlot = (page - 1) * 10 + slot;
          const macroId = hotbar[globalSlot];
          const macro = macroId ? game.macros.get(macroId) : null;
          
          const slotEl = $(`
            <div class="panic-hotbar-slot" data-slot="${globalSlot}" style="display:flex;flex-direction:column;align-items:center;padding:6px;background:rgba(0,0,0,0.3);border:1px solid ${macro ? '#bfa046' : '#444'};border-radius:6px;min-height:60px;cursor:${macro ? 'pointer' : 'default'};">
              <div style="font-size:0.7em;color:#888;margin-bottom:4px;">${slot}</div>
              ${macro 
                ? `<img src="${macro.img || 'icons/svg/dice-target.svg'}" style="width:32px;height:32px;border-radius:4px;border:1px solid #666;">
                   <div style="font-size:0.75em;color:#ccc;margin-top:4px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;" title="${macro.name}">${macro.name}</div>`
                : `<div style="width:32px;height:32px;border:1px dashed #555;border-radius:4px;"></div>
                   <div style="font-size:0.7em;color:#555;margin-top:4px;">Empty</div>`
              }
            </div>
          `);
          
          // Click to execute macro
          if (macro) {
            slotEl.on("click", async function(ev) {
              ev.stopPropagation();
              try {
                await macro.execute();
              } catch (err) {
                ui.notifications.error(`Failed to execute macro: ${err.message}`);
              }
            });
            slotEl.on("mouseenter", function() {
              $(this).css("border-color", "#fff700");
            }).on("mouseleave", function() {
              $(this).css("border-color", "#bfa046");
            });
          }
          
          slotGrid.append(slotEl);
        }
        
        hotbarContainer.append(slotGrid);
        
        // Add horizontal rule between pages (not after the last one)
        if (page < 5) {
          hotbarContainer.append($(`<hr style="border:none;border-top:1px solid #555;margin:10px 0;">`));
        }
      }
      
      resultsDiv.append(hotbarContainer);
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
          if (!matchesFilters(doc, type)) return;
          results.push({ name: doc.name, type, document: doc, score: 1 });
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
      results = results.filter(r => matchesFilters(r.document, r.type));
    }
    await renderResults(results);
  }

  // Remove the old dropdown if present
  html.find("#panic-type-filter").remove();
  input.on("input", doSearch);
  setTimeout(()=>input.focus(),50);
});