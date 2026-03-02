# Foundry VTT Item Attribute Reference (dnd5e)

This file documents common attributes for Item documents in the dnd5e system, based on observed JSON and in-game structure.

## Top-Level Item Fields
- `name`: The item's name (string)
- `type`: The item's broad category (e.g., "weapon", "equipment", "consumable")
- `img`: Image URL for the item
- `system`: Object containing system-specific data (see below)
- `flags`: Object for module/system flags
- `effects`: Array of active effects
- `folder`: Folder ID (if any)
- `_stats`: Metadata (creation, modification, etc.)
- `ownership`: Permissions object

## Common `system` Fields
- `description.value`: HTML description
- `price.value`: Numeric price
- `price.denomination`: Currency (e.g., "gp")
- `identified`: Boolean, is the item identified?
- `quantity`: How many of this item
- `weight.value`: Numeric weight
- `rarity`: Rarity string
- `attunement`: Attunement requirements
- `attuned`: Boolean, is the item attuned?
- `equipped`: Boolean, is the item equipped?
- `type.value`: Subtype/category (e.g., "martialM", "simpleR", "shield")
- `type.baseItem`: Base item type (e.g., "glaive", "shield")
- `armor.value`: Armor class bonus (for armor/shields)
- `hp.value`: Hit points (for objects)
- `uses.max`: Max uses (for consumables)
- `uses.spent`: Uses spent
- `properties`: Array of item properties (e.g., for weapons)
- `identifier`: Unique string identifier

## Weapon-Specific
- `system.type.value`: Weapon subtype (e.g., "martialM", "simpleR")
- `system.type.baseItem`: Weapon base type (e.g., "glaive", "longsword")
- `system.properties`: Array of weapon properties (e.g., ["finesse", "reach"])

## Armor/Shield-Specific
- `system.armor.value`: Armor class bonus
- `system.type.value`: Should be "shield" or armor type

## Example: Accessing Weapon Subtype
```js
item.system.type.value // e.g., "martialM"
item.system.type.baseItem // e.g., "glaive"
```

## Example: Accessing Shield Type
```js
item.system.type.value // "shield"
item.system.type.baseItem // "shield"
```

## Item Subsection: Weapons

This section documents weapon-specific attributes and their subtypes for dnd5e Items.

### Weapon Pill Format
- **Name**: The weapon's name (e.g., "Abyssal Glaive")
- **Type**: Always "weapon"
- **Subtype**: `system.type.value` (e.g., "martialM", "simpleR")
- **Base Item**: `system.type.baseItem` (e.g., "glaive", "longsword")
- **Properties**: `system.properties` (array, e.g., ["finesse", "reach"])
- **Other Key Fields**: damage, weight, rarity, etc.

### Weapon Subtypes Drilldown
- **Subtype** (`system.type.value`):
  - "simpleM": Simple Melee Weapon
  - "simpleR": Simple Ranged Weapon
  - "martialM": Martial Melee Weapon
  - "martialR": Martial Ranged Weapon
  - (Add more as you discover them)
- **Base Item** (`system.type.baseItem`):
  - The specific weapon type, e.g., "glaive", "dagger", "longbow"

#### Example Pill
| Name           | Type    | Subtype  | Base Item | Properties         |
|----------------|---------|----------|-----------|-------------------|
| Abyssal Glaive | weapon  | martialM | glaive    | ["heavy","reach"] |

---
Add more weapon subtypes and base items as you encounter them in your world or compendium.
