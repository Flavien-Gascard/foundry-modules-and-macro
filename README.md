# 🧙 DM Panic Button
*A Foundry VTT Command Palette for Dungeon Masters*

DM Panic Button is a **world-aware control interface** for Foundry VTT that allows Game Masters to quickly **search, navigate, and create world content** without using Foundry sidebars.

The goal is simple:

> Reduce friction between DM intention and world action.

Instead of navigating directories, dragging actors, or switching tabs, the GM can perform common tasks from a single searchable interface.

---

## ✨ Philosophy

DM Panic Button is **not** a combat automation tool.

Foundry already excels at combat management.

This module focuses on:

- ⚡ Preparation
- 🧭 Navigation
- 🧱 Creation
- 📖 Lookup

It acts as a **GM command console** layered on top of Foundry.

---

## ✅ Current Features (v0.8)

### 🔎 World Search
Searches **only world documents** (no compendiums):

- Actors
- Items
- Journals
- Scenes
- RollTables
- Macros

This ensures results are curated, customized, and safe to use.

---

### 🧙 Actor Spawning
Spawn actors directly from search.

Workflow:

Open Panic Button
→ Search Actor
→ Click Spawn
→ Click map location


Features:

- Click-to-place spawning
- Grid snapping
- Uses actor prototype token settings
- Works with customized artwork & configs

---

### 🗺 Scene Control

Two scene interaction modes:

#### 👁 View Scene
- GM-only view
- Players remain on current scene
- Ideal for preparation

#### 🗺 Switch Scene
- Activates scene
- Moves all players
- Session transition tool

Active scenes are marked with ⭐.

---

### 📦 Item Interaction

If a token is selected:

- ➕ Give Item → adds item directly to actor inventory

---

### 💬 Quick Chat Reference

Post document names directly to chat for quick reference.

---

### 🎨 Fantasy UI Theme

Custom-styled interface designed to feel like an **arcane codex** rather than a utility window.

---

## 🏗 Application Structure
dm-panic-button/
│
├── module.json # Foundry module definition
├── panic.js # Main application + logic
├── panic.html # UI layout
├── styles.css # Fantasy theme styling
└── README.md


---

## 🧠 Architecture Overview

### 1. Application Layer

`DMPanicButton` extends Foundry's `Application`.

Responsible for:
- Window rendering
- UI lifecycle
- Input focus

---

### 2. Search Engine

Central dispatcher:

runContextAction(action, entry)

All interactions pass through this function.

Benefits:

Single responsibility

Easy feature expansion

Clean debugging

4. Spawn Placement System

Two-phase workflow:

Spawn Requested
→ Placement Mode
→ Canvas Click
→ Token Creation

Handled via:

startSpawnPlacement()
handleSpawnClick()
5. Scene Control

Uses native Foundry Scene document methods:

scene.view()
scene.activate()

Central dispatcher:

runContextAction(action, entry)

All interactions pass through this function.

Benefits:

Single responsibility

Easy feature expansion

Clean debugging

4. Spawn Placement System

Two-phase workflow:

Spawn Requested
→ Placement Mode
→ Canvas Click
→ Token Creation

Handled via:

startSpawnPlacement()
handleSpawnClick()
5. Scene Control

Uses native Foundry Scene document methods:

scene.view()
scene.activate()