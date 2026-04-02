# Flavien Condition Lab - Module Structure Inventory

**Generated:** March 20, 2026  
**Module Path:** `modules/flavien-condition-lab/module/`  
**Total Files:** 12 JavaScript files  
**Total Lines:** 3,595 LOC

---

## Overview

The **flavien-condition-lab** module is a Foundry VTT enhancement that provides a condition mapping system with visual indicators, trigger-based automation, and extensive configuration options. The architecture is organized into three main areas:

1. **Core System** (4 files) - Initialization, settings registration, utility helpers, and libWrapper shim
2. **Enhanced Conditions** (6 files) - Main condition mapping UI and logic
3. **Triggler** (2 files) - Trigger-based automation system

---

## File Inventory

### CORE SYSTEM

#### 1. `flavien-condition-lab.js` (Main Entry Point)
- **Lines:** 355
- **Complexity:** High
- **Purpose:** Primary initialization file and hook handler orchestrator
- **Exports:** None (uses Hooks API)
- **Main Exports:** Hooks on `i18nInit`, `ready`, `updateActor`, `createActiveEffect`, `deleteActiveEffect`, `updateCombat`, `getSceneControlButtons`, `renderSceneControls`, `renderSettingsConfig`, `renderMacroConfig`, `renderChatLog`, `renderChatMessage`, `renderDialog`, `renderCombatTracker`, `renderConditionLab`

**Key Features:**
- Imports from all submodules to wire them together
- Registers keybindings for Condition Lab and Triggler
- Overrides `Token.prototype._refreshEffects` for custom effect sizing
- Handles Active Effect lifecycle (create/delete) with enhanced condition processing
- Processes combat turn changes for condition output
- Manages scene control buttons and chat message interactions
- Handles dialog rendering for save/restore operations

**Dependencies:**
- `libWrapper.js` - for method wrapping
- `settings.js` - for registering module settings
- `sidekick.js` - for utility methods
- `enhanced-conditions/enhanced-conditions.js` - core condition logic
- `enhanced-conditions/condition-lab.js` - UI for condition mapping
- `triggler/triggler.js` - trigger execution
- `triggler/triggler-form.js` - trigger UI

**Key Global State:**
- `game.clt` - namespace for Enhanced Conditions API
- `ui.clt` - UI namespace for applications

---

#### 2. `settings.js` (Configuration & Settings)
- **Lines:** 251
- **Complexity:** Medium (declarative structure)
- **Purpose:** Defines all module settings and creates settings menu registrations
- **Exports:** `registerSettings()` function

**Main Functions:**
- `registerSettings()` - Called on i18nInit hook

**Settings Registered (12 total):**

**Enhanced Conditions Settings:**
- `conditionsOutputToChat` - Output conditions to chat messages
- `conditionsOutputDuringCombat` - Output during combat turns
- `removeDefaultEffects` - Remove core status effects
- `defaultConditionsOutputToChat` - Default chat output for unmatched effects
- `enhancedConditionsMigrationVersion` - API-only migration tracking
- `showSortDirectionDialog` - Show dialog when saving sorted maps
- `defaultSpecialStatusEffects` - Core special status effects cache
- `specialStatusEffectMapping` - Mapping of special effects to conditions
- `coreStatusIcons` - Core status effect icons
- `conditionMapType` - Map type: "default", "custom", or "other"
- `defaultConditionMaps` - System default maps (objects by system ID)
- `activeConditionMap` - Currently loaded condition map

**Token Utility Settings:**
- `effectSize` - Effect display size: "small", "medium", "large", "xLarge"

**Triggler Settings:**
- `storedTriggers` - Array of stored trigger configurations
- `hasRunMigration` - Migration tracking flag
- `sceneControls` - Show buttons in scene controls

**UI Elements:**
- Creates settings menu for Condition Lab
- Creates settings menu for Triggler
- All settings use i18n keys for localization

**Dependencies:**
- `enhanced-conditions/condition-lab.js` - type for menu
- `enhanced-conditions/enhanced-conditions.js` - for update callbacks
- `triggler/triggler-form.js` - type for menu

---

#### 3. `libWrapper.js` (Method Hooking Shim)
- **Lines:** 90
- **Complexity:** Low (utility)
- **Purpose:** Fallback implementation of libWrapper library for method wrapping
- **Exports:** `libWrapper` class, `VERSIONS`, `TGT_SPLIT_RE`, `TGT_CLEANUP_RE` constants

**Key Features:**
- Provides fallback if libWrapper module not loaded
- Supports WRAPPER, MIXED, and OVERRIDE wrapping types
- Parses complex method paths (e.g., `Token.prototype._refreshEffects`)
- Handles property descriptors and configurable properties

**Public Methods:**
- `libWrapper.register(package_id, target, fn, type, options)` - Static method for registering wrappers

**No Dependencies**

---

#### 4. `sidekick.js` (Utility Helper Class)
- **Lines:** 161
- **Complexity:** Low (utility)
- **Purpose:** Collection of static helper methods used across the module
- **Exports:** `Sidekick` class with static methods

**Key Static Methods:**
- `fetchJsons(source, path)` - Fetch multiple JSON files via FilePicker
- `fetchJson(file)` - Fetch single JSON file with error handling
- `coerceType(value, type)` - Type coercion (number, string, boolean)
- `createId(existingIds, options)` - Generate unique random ID
- `generateUniqueSlugId(string, idList)` - Generate slug ID with uniqueness checking
- `getNameFromFilePath(path)` - Extract filename from path and titlecase
- `loadTemplates()` - Pre-load handlebars templates (3 templates)
- `toCamelCase(string, delimiter)` - Convert delimited string to camelCase

**No Dependencies** (except Foundry globals)

---

### ENHANCED CONDITIONS

#### 5. `enhanced-conditions/enhanced-conditions.js` (Core Logic)
- **Lines:** 819
- **Complexity:** Very High (main business logic)
- **Purpose:** Core condition mapping system, processing, and API
- **Exports:** `EnhancedConditions` class with extensive static API

**Static Properties:**
- `conditions` - Current condition map
- `conditionMapType` - Type of map loaded

**Static Methods (40+ methods):**

*Workers/Processing:*
- `_processActiveEffectChange(effect, type)` - Handle effect add/remove
- `_removeOtherConditions(entity, conditionId)` - Remove conditions except one
- `_toggleDefeated(entities, options)` - Mark/unmark combatants defeated
- `_processMacros(macroIds, entity)` - Execute macros with scope
- `updateConditionTimestamps()` - Update chat UI timestamps

*Helpers/Data Preparation:*
- `_prepareMap(conditionMap)` - Validate and prepare condition maps
- `_prepareStatusEffects(conditionMap)` - Convert conditions to status effects
- `_prepareActiveEffects(effects)` - Prepare effects for application
- `_lookupConditionByName(conditionName)` - Find condition by name
- `_createJournalEntry(condition)` - Create journal entries for conditions
- `_updateStatusEffects(conditionMap)` - Update CONFIG.statusEffects
- `_loadDefaultMaps()` - Load system default condition maps
- `lookupEntryMapping(effectIds)` - Find conditions by effect IDs
- `getConditionsMap()` - Get active condition map with optionals

*Chat Output:*
- `outputChatMessage(entity, entries, options)` - Output conditions to chat

*Public API Methods:*
- `applyCondition(...params)` - Deprecated alias for addCondition
- `addCondition(conditionName, entities, options)` - Apply conditions
- `removeCondition(conditionName, entities, options)` - Remove conditions
- `removeAllConditions(entities, options)` - Remove all conditions
- `getCondition(conditionName, map, options)` - Get single condition
- `getConditions(entities, options)` - Get all conditions on entity/entities
- `getConditionEffects(entities, map, options)` - Get condition ActiveEffect instances
- `hasCondition(conditionName, entities, options)` - Check if entity has condition
- `getConditionsByIcon(icon)` - Find conditions by effect icon path
- `getActiveEffects(conditions)` - Get effect data for conditions
- `getDefaultMap(defaultMaps)` - Get system default map
- `buildDefaultMap()` - Build map from core effects
- `mapFromJson(json)` - Parse condition map from JSON

**Constants:** None

**Key Features:**
- Handles core condition lifecycle
- Manages condition-to-effect mapping
- Executes linked macros on condition changes
- Available globally as `game.clt` after initialization

**Dependencies:**
- `../sidekick.js` - for utility methods

**Global Integration:**
- Uses `game.settings`, `CONFIG`, `ChatMessage`, `ActiveEffect`, `Actor`, `Token`
- Sets `game.clt.conditions` after ready hook
- Uses `ui.notifications` for user feedback

---

#### 6. `enhanced-conditions/condition-lab.js` (UI Form Application)
- **Lines:** 751
- **Complexity:** Very High (complex form handling)
- **Purpose:** Main dialog/form for managing condition mappings
- **Exports:** `ConditionLab` extends FormApplication

**Form Configuration:**
- Template: `modules/flavien-condition-lab/templates/condition-lab.hbs`
- Width: 780px, Height: 680px, Resizable

**Main Properties:**
- `data` - Form data cache
- `system` - Current game system ID
- `initialMapType` - Map type at form open
- `mapType` - Current map type ("default", "custom", "other")
- `initialMap` - Original condition map
- `map` - In-memory working map
- `displayedMap` - Filtered/sorted display map
- `filterValue` - Current filter string
- `sortDirection` - Sort order ("asc", "desc", or "")

**Key Methods:**

*Form Lifecycle:*
- `getData()` - Prepare template data
- `_updateObject(event, formData)` - Handle form submission
- `_processFormUpdate(formData)` - Process and validate submission
- `_getHeaderButtons()` - Add import/export buttons

*Data Processing:*
- `_buildSubmitData()` - Extract form data with IDs
- `_processFormData(formData)` - Convert form data to condition map
- `_saveMapping(newMap, mapType)` - Save to settings
- `_finaliseSave(preparedMap)` - Complete save operation

*Map Management:*
- `_restoreDefaults(options)` - Restore default map
- `_hasMapChanged()` - Check if map was modified
- `_hasEntryChanged(entry, existingEntry)` - Check single entry changes
- `_hasPropertyChanged(propertyName, original, comparison)` - Property comparison

*Import/Export:*
- `_exportToJSON()` - Export map to JSON file
- `_importFromJSONDialog()` - Show import dialog
- `_processImport(html)` - Process imported JSON

*Event Handlers (15+ handlers):*
- `_onChangeInputs(event)` - Input change handler
- `_onChangeFilter(event)` - Filter change
- `_onChangeMapType(event)` - Map type selection
- `_onClickActiveEffectConfig(event)` - Open effect config
- `_onChangeReferenceId(event)` - Reference link editing
- `_onOpenTrigglerForm(event)` - Open Triggler for trigger
- `_onAddRow(event)` - Add new condition row
- `_onRemoveRow(event)` - Remove condition row
- `_onChangeSortOrder(event)` - Move row up/down
- `_onClickSortButton(event)` - Toggle sort direction
- `_onRestoreDefaults(event)` - Restore defaults dialog
- `_onResetForm(event)` - Reset form to initial state
- `_onClickMacroConfig(event)` - Open macro configuration
- `_onClickTriggerConfig(event)` - Open trigger configuration
- `_onClickOptionConfig(event)` - Open option configuration
- `_onDrop(event)` - Handle drop for references
- `_onEditImage(event)` - Edit condition icon

*Filtering & Sorting:*
- `_filterMapByName(map, filter)` - Filter by condition name
- `_sortMapByName(map, direction)` - Sort alphabetically

*Hooks:*
- `static _onRender(app, html, data)` - Register app instance
- `static _onRenderSaveDialog(app, html, data)` - Customize save dialog
- `static _onRenderRestoreDefaultsDialog(app, html, data)` - Customize restore dialog

**Dependencies:**
- `../sidekick.js` - for ID generation
- `../triggler/triggler-form.js` - for trigger UI
- `enhanced-conditions.js` - for data operations
- `enhanced-condition-macro.js` - for macro config
- `enhanced-condition-option.js` - for option config
- `enhanced-condition-trigger.js` - for trigger config
- `enhanced-effect-config.js` - for effect config

**Global Integration:**
- Registers as `game.clt.conditionLab`
- Uses handlebars templates
- Uses FilePicker for image selection
- Uses TextEditor for reference enrichment

---

#### 7. `enhanced-conditions/enhanced-condition-macro.js` (Macro Config)
- **Lines:** 53
- **Complexity:** Low
- **Purpose:** Config dialog for linking macros to condition actions
- **Exports:** `EnhancedConditionMacroConfig` extends FormApplication

**Form Configuration:**
- Template: `modules/flavien-condition-lab/templates/enhanced-condition-macro-config.hbs`
- No specific sizing (inherits defaults)

**Key Methods:**
- `constructor(object, options)` - Setup with condition object
- `getData()` - Prepare macro choices and current selection
- `_updateObject(event, formData)` - Save macro selections

**Features:**
- Select macros for "apply" and "remove" trigger types
- Integrates with Condition Lab to update condition map

**Dependencies:**
- Foundry FormApplication
- Game macros system

---

#### 8. `enhanced-conditions/enhanced-condition-option.js` (Options Config)
- **Lines:** 169
- **Complexity:** Medium
- **Purpose:** Config dialog for condition options/flags
- **Exports:** `EnhancedConditionOptionConfig` extends FormApplication

**Form Configuration:**
- Template: `modules/flavien-condition-lab/templates/enhanced-condition-option-config.hbs`
- Width: 500px

**Key Methods:**
- `getData()` - Prepare option data and special status effects
- `activateListeners(html)` - Attach event listeners
- `_onCheckboxChange(event)` - Handle checkbox changes
- `_onSpecialStatusEffectToggle(event)` - Handle special status effect conflicts
- `_updateObject(event, formData)` - Save options
- `getSpecialStatusEffectByField(field)` - Map field to special effect (BLIND, INVISIBLE)
- `setSpecialStatusEffectMapping(effect, conditionId)` - Save special mapping

**Features:**
- Manage condition options (outputChat, removeOthers, markDefeated, overlay, etc.)
- Handle special status effects with conflict prevention
- Integration with Condition Lab map

**Dependencies:**
- `../sidekick.js` - for camelCase conversion

---

#### 9. `enhanced-conditions/enhanced-condition-trigger.js` (Trigger Config)
- **Lines:** 54
- **Complexity:** Low
- **Purpose:** Config dialog for linking triggers to conditions
- **Exports:** `EnhancedConditionTriggerConfig` extends FormApplication

**Form Configuration:**
- Template: `modules/flavien-condition-lab/templates/enhanced-condition-trigger-config.hbs`
- Width: 500px

**Key Methods:**
- `getData()` - Prepare trigger choices and current selections
- `_updateObject(event, formData)` - Save trigger selections

**Features:**
- Select apply/remove triggers for condition
- Integration with Triggler system

**No Dependencies** (besides FormApplication)

---

#### 10. `enhanced-conditions/enhanced-effect-config.js` (Effect Config)
- **Lines:** 62
- **Complexity:** Low
- **Purpose:** Enhanced Active Effect configuration sheet
- **Exports:** `EnhancedEffectConfig` extends ActiveEffectConfig

**Key Methods:**
- `get title()` - Custom title generation
- `getData(options)` - Prepare effect data with enriched description
- `_processSubmitData(event, form, data)` - Save effect data to condition

**Features:**
- Override default ActiveEffectConfig interface
- Handle backward compatibility for deprecated fields
- Integrate effect changes back into Condition Lab

**No Dependencies** (standard Foundry extension)

---

### TRIGGLER (Trigger System)

#### 11. `triggler/triggler.js` (Trigger Logic)
- **Lines:** 325
- **Complexity:** High
- **Purpose:** Trigger execution and evaluation system
- **Exports:** `Triggler` class with static methods

**Static Constants:**
- `OPERATORS` - Operator symbols: `=`, `≠`, `<`, `≤`, `>`, `≥`

**Static Methods:**

*Parsing & Preparation:*
- `triggersFromJson(json)` - Parse triggers from JSON file
- `_prepareTrigger(trigger)` - Validate and prepare trigger
- `_constructString(parts)` - Build human-readable trigger string

*Execution:*
- `_executeTrigger(trigger, target)` - Execute trigger actions
- `_processUpdate(entity, update, entryPoint1)` - Process actor updates for trigger matches

**Trigger Types:**
1. **Simple Triggers**: Property-based (e.g., `system.hp.value > 50`)
2. **Advanced Triggers**: Custom property paths

**Operators Supported:**
- `eq` (=) - Equality
- `ne` (≠) - Not equal
- `lt` (<) - Less than
- `lteq` (≤) - Less than or equal
- `gt` (>) - Greater than
- `gteq` (≥) - Greater than or equal

**Trigger Actions:**
- Apply linked conditions
- Remove linked conditions
- Execute linked macros

**Features:**
- Percentage-based comparisons (e.g., "HP > 50%")
- PC-only / NPC-only filters
- Zero-value skipping
- Multi-level token support (avoids clones)
- Support for actor and token updates

**Key Processing Flow:**
1. Check actor update for trigger properties
2. Evaluate condition with operator
3. Execute actions if matched

**Dependencies:**
- `../enhanced-conditions/enhanced-conditions.js` - for condition operations
- `../sidekick.js` - for type coercion

**Global Integration:**
- Triggered by updateActor hook in main file
- Uses game.settings for condition maps, macros
- Uses game.macros for macro execution

---

#### 12. `triggler/triggler-form.js` (Trigger Builder UI)
- **Lines:** 465
- **Complexity:** Very High (complex dynamic form)
- **Purpose:** Dialog/form for creating and editing triggers
- **Exports:** `TrigglerForm` extends FormApplication

**Form Configuration:**
- Template: `modules/flavien-condition-lab/templates/triggler-form.html`
- Width: 780px, Height: auto, Resizable

**Main Properties:**
- `data` - Trigger data
- `parent` - Parent form reference (Condition Lab)
- `noMerge` - Control data merging on render

**Trigger Type Support:**

*Simple Trigger Fields:*
- `triggerType` - "simple" or "advanced"
- `category` - Actor data category (system, attributes, etc.)
- `attribute` - Sub-category
- `property1` - Target property
- `property2` - Optional comparison property
- `operator` - Comparison operator
- `value` - Trigger value

*Advanced Trigger Fields:*
- `advancedName` - Trigger display name
- `advancedActorProperty` - Actor property path
- `advancedActorProperty2` - Optional second property
- `advancedTokenProperty` - Token property path
- `advancedTokenProperty2` - Optional second token property
- `advancedOperator` - Comparison operator
- `advancedValue` - Trigger value

*Filter Options:*
- `pcOnly` - Only trigger for player-controlled characters
- `npcOnly` - Only trigger for NPCs
- `notZero` - Skip if value is 0

**Key Methods:**

*Form Lifecycle:*
- `getData()` - Build template data with dynamic dropdowns
- `_render(force, options)` - Handle repositioning on show
- `_updateObject(event, formData)` - Save trigger to settings
- `_getHeaderButtons()` - Add import/export buttons

*Event Handlers (20+ handlers):*
- `triggerSelect` - Load existing trigger
- `deleteTrigger` - Delete trigger
- `categorySelect` - Update attributes
- `attributeSelect` - Update properties
- `property1Select`, `property2Select` - Update based on selection
- `operatorSelect` - Operator selection
- `valueInput` - Value input
- `triggerTypeRadio` - Toggle between simple/advanced
- `advancedNameInput`, `advancedActorPropertyInput`, etc. - Advanced mode fields
- `pcOnlyCheckbox`, `npcsOnlyCheckbox`, `notZeroCheckbox` - Filter options
- `cancelButton` - Close form

*Import/Export:*
- `_exportToJSON()` - Export triggers to JSON
- `_importFromJSONDialog()` - Show import dialog
- `_processImport(html)` - Process imported JSON

**Dynamic Form Features:**
- Automatic dropdown population from game actor model
- Category → Attribute → Property cascading dropdowns
- Switch between simple/advanced trigger modes
- Validation for required fields

**Dependencies:**
- `../sidekick.js` - for ID generation, type coercion
- `triggler.js` - for operator symbols and string construction

**Global Integration:**
- Reads game.model.Actor for form structure
- Uses game.settings for trigger storage
- Integrates with CONFIG.Actor
- FilePicker for JSON import
- Foundry FilePicker for system file dialogs

---

## Dependency Graph

```
flavien-condition-lab.js (ENTRY POINT)
├── libWrapper.js
├── settings.js
│   ├── enhanced-conditions/condition-lab.js
│   ├── enhanced-conditions/enhanced-conditions.js
│   └── triggler/triggler-form.js
├── sidekick.js
├── enhanced-conditions/enhanced-conditions.js
│   └── sidekick.js
├── enhanced-conditions/condition-lab.js
│   ├── sidekick.js
│   ├── triggler/triggler-form.js
│   ├── enhanced-conditions/enhanced-conditions.js
│   ├── enhanced-condition-macro.js
│   ├── enhanced-condition-option.js
│   ├── enhanced-condition-trigger.js
│   └── enhanced-effect-config.js
└── triggler/triggler.js
    ├── enhanced-conditions/enhanced-conditions.js
    └── sidekick.js

triggler/triggler-form.js
├── sidekick.js
└── triggler.js
```

---

## File Complexity Matrix

| File | Lines | Cyclomatic | Responsibility | Refactor Priority |
|------|-------|------------|-----------------|-------------------|
| enhanced-conditions.js | 819 | Very High | Core API, processing | **HIGH** (Large) |
| condition-lab.js | 751 | Very High | Form UI, data management | **HIGH** (Large + Complex) |
| triggler-form.js | 465 | High | Advanced form handling | Medium |
| flavien-condition-lab.js | 355 | High | Hook orchestration | Medium |
| triggler.js | 325 | High | Trigger evaluation | Medium |
| settings.js | 251 | Low | Configuration | LOW |
| sidekick.js | 161 | Low | Utilities | LOW |
| enhanced-condition-option.js | 169 | Medium | Config dialog | LOW |
| libWrapper.js | 90 | Low | Shim/Fallback | LOW |
| enhanced-condition-macro.js | 53 | Low | Config dialog | LOW |
| enhanced-condition-trigger.js | 54 | Low | Config dialog | LOW |
| enhanced-effect-config.js | 62 | Low | Extension override | LOW |

---

## Module Dependencies Summary

**External Dependencies (Foundry APIs):**
- FormApplication, ActiveEffectConfig, DocumentSheet
- game.settings, game.i18n, game.user, game.system
- CONFIG (statusEffects, specialStatusEffects, ActiveEffect)
- Hooks, ChatMessage, Actor, Token, ActiveEffect
- UI notifications, FilePicker, FileLoader
- TextEditor enrichment

**Internal Dependencies:**
- 100% of files depend on `sidekick.js`
- Enhanced Conditions system: `enhanced-conditions.js` is dependency hub
- Condition Lab: `condition-lab.js` imports all enhanced-condition-* files
- Main file: acts as import orchestrator

---

## Refactoring Opportunities

### High Priority
1. **Split `enhanced-conditions.js`** (819 LOC)
   - Separate API methods into distinct classes
   - Move chat output logic to separate module
   - Extract effect preparation into utilities

2. **Split `condition-lab.js`** (751 LOC)
   - Separate event handlers into mixin
   - Extract form data processing to separate class
   - Move import/export logic to utility

### Medium Priority
3. **Extract Trigger Engine** from `triggler.js`
   - Separate evaluation logic from trigger types
   - Create operator registry pattern

4. **Consolidate Config Dialogs**
   - Create base ConfigDialog class
   - Extract common patterns from macro/option/trigger configs

### Low Priority
5. **Create Settings Registry** from `settings.js`
   - Organize by functional domain
   - Reduce verbosity with registration helper

---

## Key Entry Points

| Entry Point | File | Hook | Purpose |
|------------|------|------|---------|
| Initialization | flavien-condition-lab.js | i18nInit | Register settings, keybinds, wrap methods |
| Ready Phase | flavien-condition-lab.js | ready | Load condition maps, set up timers |
| Condition Application | enhanced-conditions.js | API | Add/remove conditions on entities |
| UI Opening | condition-lab.js | Keybind/Button | Open condition mapping dialog |
| Trigger Evaluation | triggler.js | updateActor | Process actor updates for triggers |

---

## API Surface

### Public API (game.clt namespace)
All defined in `enhanced-conditions.js`:
- `addCondition(conditionName, entities, options)` - Add condition
- `removeCondition(conditionName, entities, options)` - Remove condition
- `removeAllConditions(entities, options)` - Remove all conditions
- `getCondition(conditionName, map, options)` - Get condition
- `getConditions(entities, options)` - Get entity conditions
- `hasCondition(conditionName, entities, options)` - Check condition
- `conditions` - Current condition map (reference property)
- `supported` - Boolean flag for module support status

### Settings API
Via `game.settings.get/set`:
- `flavien-condition-lab|activeConditionMap` - Current map
- `flavien-condition-lab|storedTriggers` - Trigger list
- And 18+ other configuration settings

