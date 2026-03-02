# 🧙 DM Panic Button

*A Foundry VTT Command Palette for Dungeon Masters*

**DM Panic Button** is a world-aware control interface for Foundry VTT that allows Game Masters to quickly **search, navigate, spawn, and manage world content** without navigating Foundry sidebars.

> **Goal:** Reduce friction between DM intention and world action.

---

## ✨ Philosophy

DM Panic Button is **not** a combat automation tool — Foundry already excels at that.

This module focuses on:
- ⚡ **Preparation** — Quick access to world content
- 🧭 **Navigation** — Scene switching & viewing
- 🧱 **Creation** — Spawn actors & place loot
- 📖 **Lookup** — Search & reference documents

It acts as a **GM command console** layered on top of Foundry.

---

## 📁 Module Structure

```
dm-panic-button/
├── module.json                  # Foundry module manifest
├── panic.js                     # Main logic (734 lines)
├── panic.html                   # UI template
├── styles.css                   # Fantasy theme styling (190 lines)
└── item-attribute-reference.md  # Dev reference for dnd5e item data
```

---

## ✅ Features

### 🔎 World Search

Fuzzy search across **world documents only** (no compendiums):
- Actors
- Items
- Journals
- Scenes
- RollTables
- Macros

Filter by category using pill buttons, with **item subtype filtering** (weapon, armor, consumable, etc.) when "Items" is selected.

---

### 🧙 Actor Spawning

Spawn actors directly from search results:

1. Open Panic Button (`Ctrl+Space` or Token HUD button)
2. Search for an Actor
3. Click **🧙 Spawn**
4. Click on the map to place the token

**Features:**
- Click-to-place with grid snapping (V13+ compatible)
- Uses actor's prototype token settings
- Works with custom artwork & configurations

---

### 🪙 Item Placement (Loot Tokens)

Place items directly on the map as loot:

1. Search for an Item
2. Click **🪙 Place Item**
3. Click on the map

**Features:**
- Creates an NPC actor as a loot container
- Automatically converts **spells → scrolls**
- Optionally runs the "TurnToItemPile" macro (if present)
- Uses the item's image as the token

---

### ➕ Give to Actor

If a token is selected, the **➕ Give** button appears:
- Adds Items directly to the actor's inventory
- Adds ActiveEffects to the actor

---

### 🗺 Scene Control

Two scene interaction modes:

| Action | Effect |
|--------|--------|
| **👁 View** | GM-only view; players stay on current scene |
| **🗺 Switch** | Activates scene and moves all players |

Active scenes are marked with ⭐.

---

### 💬 Quick Chat

Post document info directly to chat:
- Items post their full item card (if supported)
- Other documents post their name as a quick reference

---

### ⌨️ Hotkey & Token HUD

- **Ctrl+Space** — Toggle the Panic Button panel
- **Token HUD Button** — 🔥 icon appears on token HUD (GM only)

---

### 🎨 Fantasy UI Theme

Custom arcane/fantasy theme with:
- Dark gradient backgrounds
- Gold accent colors & glowing effects
- Pill-style filter buttons
- Animated search focus pulse
- Styled result cards with hover effects

---

## 🧠 Architecture Overview

### Application Layer

`DMPanicButton` extends Foundry's `Application` class:
- Manages window rendering & lifecycle
- Template: `panic.html`
- Registered globally as `globalThis.DMPanicButton`

### Key Functions

| Function | Purpose |
|----------|---------|
| `createItemTemplate()` | Builds dnd5e item data objects |
| `fuzzyScore()` | Simple fuzzy matching for search |
| `searchDocuments()` | Scans all world collections |
| `startSpawnPlacement()` / `handleSpawnClick()` | Actor token placement with grid snapping |
| `startItemPlacement()` / `handleItemPlaceClick()` | Loot token placement (spell→scroll conversion) |
| `runContextAction()` | Central action dispatcher |

### Action Engine

All interactions route through `runContextAction(action, entry)`:

| Action | Behavior |
|--------|----------|
| `open` | Opens the document's sheet |
| `chat` | Posts to chat |
| `spawn` | Initiates actor placement |
| `place-item` | Initiates item/loot placement |
| `give-item` | Adds item/effect to selected actor |
| `view-scene` | GM views scene |
| `switch-scene` | Activates scene for all |

### Hooks Used

- `renderTokenHUD` — Adds 🔥 button to token HUD
- `ready` — Registers global class & settings
- `setup` — Registers keybindings
- `renderDMPanicButton` — Builds dynamic UI

---

## ⚙️ Settings

| Setting | Description |
|---------|-------------|
| **Item Pile Icon URL** | Custom icon for placed item piles |

---

## 📋 Compatibility

- **Foundry VTT:** v13+
- **System:** dnd5e (item data structure)
- **APIs:** Modern Foundry V13 APIs (`canvas.grid.getSnappedPoint`, etc.)
