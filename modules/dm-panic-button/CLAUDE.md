# DM Panic Button — CLAUDE.md

## Module Overview
Foundry VTT module: a full-featured DM toolkit with fast document search, token/loot placement, AI-powered briefings/art/maps, NPC chatbot taunts, and a macro hotbar.

---

## File Map

| File | Purpose |
|---|---|
| `panic.js` | Entire module — `DMPanicButton` class + all hooks (~2100+ lines) |
| `filter-types.js` | `FILTER_CONFIG` — single source of truth for all filter categories/options |
| `panic.html` | Minimal shell template: search input + `#results` container |
| `styles.css` | Arcane-themed CSS (dark bg, gold accents, Papyrus font) |
| `module.json` | Foundry manifest — id, version, entry point, socket flag |
| `ai-server/server.js` | Express proxy (~33KB): `/brief`, `/generate-image`, `/generate-map`, `/taunt`, `/chat` |
| `ai-server/.env` | `ANTHROPIC_API_KEY` — gitignored, must exist for AI features |
| `ai-npc-chat.js` | Standalone NPC chatbot that hooks into `midi-qol.AttackRollComplete` |
| `item-attribute-reference.md` | Dev notes on dnd5e item attribute shapes |

---

## Load & Init Sequence

1. Foundry loads `panic.js` as an ES module (declared in `module.json`)
2. `panic.js` imports `filter-types.js`
3. **`Hooks.once("setup")`** — registers hotkey: **Ctrl+Space** toggles the window
4. **`Hooks.once("ready")`** — exposes `globalThis.DMPanicButton`, runs `buildSpellClassMap()`
5. **`Hooks.on("renderTokenHUD")`** — adds fire icon button to token HUD
6. **`Hooks.on("renderDMPanicButton")`** — builds the full UI after render

---

## Core Class

```js
class DMPanicButton extends Application
```
- Template: `panic.html`
- Default size: 720×650, resizable, popOut
- Global ref: `globalThis.DMPanicButton`
- Open/toggle: `new globalThis.DMPanicButton().render(true)`

---

## Key Functions (panic.js)

### Search & Filter
| Function | What it does |
|---|---|
| `searchDocuments(query)` | Main search — fuzzy matches across all doc types |
| `fuzzyScore(query, target)` | Scoring: match +2, mismatch −0.25, completion bonus +5 |
| `matchesFilters(doc, type)` | Applies all active filter state to a document |

### Filter State (module-level vars)
```
selectedType, selectedItemSubtype, selectedItemSubSubtype,
selectedSpellSchool, selectedSpellClass,
selectedActorSubtype, selectedCreatureType, selectedCRRange
```
Toggle logic: clicking the same filter pill again deselects it (back to "all").

### Spell Support
| Function | What it does |
|---|---|
| `buildSpellClassMap()` | Loads CONFIG.DND5E.SPELL_LISTS in batches of 50 |
| `getSpellClasses(doc)` | Returns classes that have this spell |
| `getSpellSchoolLabel() / getSpellClassLabel()` | Localization helpers |

### Spawn & Placement
| Function | What it does |
|---|---|
| `startSpawnPlacement(entry)` | Enters token-drop mode with PIXI preview |
| `handleSpawnClick(event)` | Places token on click, exits mode |
| `startItemPlacement(entry)` | Creates loot actor, enters placement mode |
| `handleItemPlaceClick(event)` | Places loot token on click |
| `getSnappedWorldPoint(event)` | Converts pointer to grid-snapped world coords (v13-safe) |
| `showPlacementPreview / hidePlacementPreview` | PIXI canvas preview helpers |

Loot actor settings: scale 0.5, disposition 0 (neutral), no actor link, yellow starlight animation.  
Spells are converted to consumable scrolls on-the-fly (no persistence).

### Context Actions (right-click menu)
```js
runContextAction(action, entry, onRefresh)
```
All button actions route through here. Supported `action` values:
`open`, `chat`, `spawn`, `show-art`, `view-scene`, `switch-scene`, `roll-table`,
`give-item`, `place-item`, `delete`, `edit`, `create`, `brief-me`, `generate-art`, `generate-map`

### UI / Results
| Function | What it does |
|---|---|
| `renderResults(list)` | Builds folder-tree HTML and injects into `#results` |
| `renderSubSubtypePills(subtype, opts)` | Renders pill buttons for sub-filters |
| `getDocumentDescription(doc)` | Extracts plain text from any doc type |
| `extractRoomsFromJournal(doc)` | Parses heading+paragraph blocks, strips `.secret` |

### AI Integration (calls ai-server)
| Endpoint | Triggered by |
|---|---|
| `/brief` | "Brief Me" context action |
| `/generate-image` | "Generate Art" context action — stores result in "Images" journal |
| `/generate-map` | "Generate Map" — extracts rooms from journal, illustrates one |
| `/chat` | Global AI chat panel (history condenses at 20 msgs, keeps last 4) |
| `/taunt` | NPC chatbot via `ai-npc-chat.js` after attack rolls |

### Creation Dialogs
| Function | What it does |
|---|---|
| `openCreateItemDialog(onCreated)` | Dynamic form → creates item doc |
| `openCreateActorDialog(onCreated)` | NPC/Character form with CR + creature type |

### Utilities
| Function | What it does |
|---|---|
| `getSelectedActor()` | First controlled token's actor |
| `getDocumentDescription(doc)` | Unified description extractor |
| `getSnappedWorldPoint(event)` | Grid-snap pointer event |

---

## filter-types.js — FILTER_CONFIG

Add/remove filter options here; never hardcode filter values in `panic.js`.

Structure:
```js
FILTER_CONFIG = {
  items: {
    subtypes: [...],          // weapon, armor, spell, feat, ...
    subSubtypes: { [subtype]: [...] }, // martialM, shield, potion, ...
    spellSchools: [...],      // 8 D&D schools
    spellClasses: [...],      // Artificer, Bard, Cleric, ...
  },
  actors: {
    crRanges: [...],
    creatureTypes: [...],
  },
  scenes: {
    tags: [...],              // combat, dungeon, wilderness, ...
  }
}
```

Helper exports:
- `getSubSubtypeLabel(category, subtype, value)` — friendly display label
- `getSubSubtypeOptions(category, subtype)` — all options for a filter
- `isNoPlacement(category, subSubtype)` — true for items that can only be "given" (e.g., natural weapons)

---

## Module Settings (registered by ai-npc-chat.js)

| Key | Default | Purpose |
|---|---|---|
| `dm-panic-button.aiChatbotEnabled` | false | Toggle NPC taunt feature |
| `dm-panic-button.aiServerUrl` | `http://localhost:3001` | AI server URL |
| `dm-panic-button.aiChatbotTone` | `menacing` | NPC personality |
| `dm-panic-button.aiChatbotWhisper` | false | GM-only vs public taunts |

---

## AI Server (ai-server/server.js)

- Runtime: Node.js + Express + `@anthropic-ai/sdk`
- Requires ngrok for HTTPS tunnel (The Forge blocks HTTP localhost)
- Costs logged per action type in session
- `ANTHROPIC_API_KEY` in `ai-server/.env`

---

## Theme / CSS Tokens

| Token | Value | Usage |
|---|---|---|
| Primary gold | `#c9a84c` | Headings, borders, accents |
| Dark bg | `#1a1208` | Window background |
| Accent red | `#c00` | Panic button |
| Body text | `#e7d7a1` | General text |
| Muted text | `#ccc0a0` | Descriptions |
| Font stack | `'Papyrus', 'IM Fell English', 'Cinzel Decorative'` | Headers |

---

## Deployment / Release

- GitHub Actions zip+release on version tags
- To release: `git tag dm-panic-button-v0.x.x && git push origin dm-panic-button-v0.x.x`
- `module.json` has `manifest` + `download` URLs pointing to GitHub releases

---

## Important Constraints

- **Single-file rule**: All Foundry-side JS must stay in `panic.js` — The Forge cannot serve extra module JS files. `ai-npc-chat.js` is the one exception (it was pre-existing).
- **No socket usage yet**: `module.json` declares `"socket": true` but it isn't wired up — infrastructure only.
- **Spell batch size**: Load spells in chunks of 50 (`Promise.all` batches) to avoid overwhelming the browser.
- **AI chat history**: Condenses at 20 messages, keeps last 4 to stay within context limits.
- **Placement preview**: Must clean up PIXI containers in all exit paths (click, Escape, close).
