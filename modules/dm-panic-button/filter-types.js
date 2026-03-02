/**
 * Filter type configurations for DM Panic Button
 * Add new categories, subtypes, and sub-subtypes here
 */

export const FILTER_CONFIG = {
  // ═══════════════════════════════════════════════════════════════════
  // ITEM FILTERS
  // ═══════════════════════════════════════════════════════════════════
  Item: {
    // Sub-subtype definitions keyed by parent subtype
    subSubtypes: {
      weapon: {
        // Key is the system value (e.g., system.type.value), label is display name
        simpleM: "Simple Melee",
        simpleR: "Simple Ranged",
        martialM: "Martial Melee",
        martialR: "Martial Ranged",
        natural: "Natural",
        improv: "Improvised",
        siege: "Siege"
      },
      armor: {
        light: "Light Armor",
        medium: "Medium Armor",
        heavy: "Heavy Armor",
        shield: "Shield",
        trinket: "Trinket",
        clothing: "Clothing"
      },
      equipment: {
        // Equipment types - key matches system.type.value
        light: "Light Armor",
        medium: "Medium Armor",
        heavy: "Heavy Armor",
        shield: "Shield",
        ring: "Ring",
        rod: "Rod",
        wand: "Wand",
        wondrous: "Wondrous Item",
        trinket: "Trinket",
        clothing: "Clothing",
        vehicle: "Vehicle",
        staff: "Staff",
        amulet: "Amulet",
        belt: "Belt",
        boots: "Boots",
        bracers: "Bracers",
        cloak: "Cloak",
        gloves: "Gloves",
        hat: "Hat",
        helm: "Helm"
      },
      consumable: {
        ammo: "Ammunition",
        food: "Food",
        poison: "Poison",
        potion: "Potion",
        scroll: "Scroll",
        wand: "Wand",
        rod: "Rod",
        trinket: "Trinket",
        explosive: "Explosive",
        spell: "Spell Scroll",
        gear: "Adventuring Gear"
      },
      tool: {
        art: "Artisan's Tools",
        game: "Gaming Set",
        music: "Musical Instrument",
        vehicle: "Vehicle"
      },
      loot: {
        gear: "Adventuring Gear",
        art: "Art Object",
        gem: "Gemstone",
        material: "Material",
        resource: "Resource",
        junk: "Junk",
        treasure: "Treasure"
      },
      container: {
        backpack: "Backpack",
        bag: "Bag",
        pouch: "Pouch",
        chest: "Chest",
        basket: "Basket",
        sack: "Sack",
        case: "Case",
        quiver: "Quiver",
        holster: "Holster"
      },
      spell: {
        // Spell levels - key matches system.level value
        0: "0",
        1: "1st",
        2: "2nd",
        3: "3rd",
        4: "4th",
        5: "5th",
        6: "6th",
        7: "7th",
        8: "8th",
        9: "9th"
      },
      feat: {
        // Feat types - key matches system.type.value
        class: "Class Feature",
        monster: "Monster Feature",
        race: "Species Feature",
        background: "Background Feature",
        feat: "Feat",
        origin: "Origin Feat",
        general: "General Feat",
        fighting: "Fighting Style",
        fightingStyle: "Fighting Style",
        metamagic: "Metamagic",
        eldritchInvocation: "Eldritch Invocation",
        pact: "Pact Boon",
        maneuver: "Maneuver",
        artificerInfusion: "Artificer Infusion",
        rune: "Rune",
        supernaturalGift: "Supernatural Gift",
        epicBoon: "Epic Boon"
      }
    },
    // Spell schools - separate dimension, key matches system.school
    spellSchools: {
      abj: "Abjuration",
      con: "Conjuration",
      div: "Divination",
      enc: "Enchantment",
      evo: "Evocation",
      ill: "Illusion",
      nec: "Necromancy",
      trs: "Transmutation"
    },
    // Spell classes - key matches system.sourceClass or identifier
    spellClasses: {
      artificer: "Artificer",
      bard: "Bard",
      cleric: "Cleric",
      druid: "Druid",
      paladin: "Paladin",
      ranger: "Ranger",
      sorcerer: "Sorcerer",
      warlock: "Warlock",
      wizard: "Wizard"
    },
    // Which subtypes cannot be "placed" as loot (Give only)
    noPlacement: ["natural"]
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACTOR FILTERS
  // ═══════════════════════════════════════════════════════════════════
  Actor: {
    subSubtypes: {
      npc: {
        // CR ranges for quick filtering
        "cr0": "CR 0",
        "cr0.125": "CR 1/8",
        "cr0.25": "CR 1/4",
        "cr0.5": "CR 1/2",
        "cr1-4": "CR 1-4",
        "cr5-10": "CR 5-10",
        "cr11-16": "CR 11-16",
        "cr17+": "CR 17+"
      }
    },
    // Optional: creature types for another filter dimension
    creatureTypes: {
      aberration: "Aberration",
      beast: "Beast",
      celestial: "Celestial",
      construct: "Construct",
      dragon: "Dragon",
      elemental: "Elemental",
      fey: "Fey",
      fiend: "Fiend",
      giant: "Giant",
      humanoid: "Humanoid",
      monstrosity: "Monstrosity",
      ooze: "Ooze",
      plant: "Plant",
      undead: "Undead"
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // SCENE FILTERS
  // ═══════════════════════════════════════════════════════════════════
  Scene: {
    // Custom tags you can use to categorize scenes
    tags: {
      combat: "Combat Map",
      exploration: "Exploration",
      social: "Social/RP",
      dungeon: "Dungeon",
      wilderness: "Wilderness",
      urban: "Urban",
      interior: "Interior"
    }
  }
};

/**
 * Get the friendly label for a sub-subtype value
 * @param {string} category - "Item", "Actor", or "Scene"
 * @param {string} subtype - e.g., "weapon", "npc"
 * @param {string} value - e.g., "martialM", "cr5-10"
 * @returns {string} The label or the value if not found
 */
export function getSubSubtypeLabel(category, subtype, value) {
  return FILTER_CONFIG[category]?.subSubtypes?.[subtype]?.[value] || value;
}

/**
 * Get all sub-subtype options for a category/subtype combo
 * @param {string} category
 * @param {string} subtype
 * @returns {Object} Key-value pairs of value -> label
 */
export function getSubSubtypeOptions(category, subtype) {
  return FILTER_CONFIG[category]?.subSubtypes?.[subtype] || {};
}

/**
 * Check if a sub-subtype should prevent placement (Give only)
 * @param {string} category
 * @param {string} subSubtype
 * @returns {boolean}
 */
export function isNoPlacement(category, subSubtype) {
  return FILTER_CONFIG[category]?.noPlacement?.includes(subSubtype) || false;
}
