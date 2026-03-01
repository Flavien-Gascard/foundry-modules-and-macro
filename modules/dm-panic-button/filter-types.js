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
        light: "Light",
        medium: "Medium",
        heavy: "Heavy",
        shield: "Shield",
        trinket: "Trinket",
        clothing: "Clothing"
      },
      consumable: {
        ammo: "Ammunition",
        food: "Food",
        poison: "Poison",
        potion: "Potion",
        scroll: "Scroll",
        wand: "Wand",
        rod: "Rod",
        trinket: "Trinket"
      },
      tool: {
        art: "Artisan's Tools",
        game: "Gaming Set",
        music: "Musical Instrument",
        vehicle: "Vehicle"
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
