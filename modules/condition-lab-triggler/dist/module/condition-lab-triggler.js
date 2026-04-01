// SPDX-License-Identifier: MIT

// A shim for the libWrapper library
let libWrapper = undefined;
const TGT_SPLIT_RE = new RegExp("([^.[]+|\\[('([^'\\\\]|\\\\.)+?'|\"([^\"\\\\]|\\\\.)+?\")\\])", "g");
const TGT_CLEANUP_RE = new RegExp("(^\\['|'\\]$|^\\[\"|\"\\]$)", "g");

// Main shim code
Hooks.once("init", () => {
	// Check if the real module is already loaded - if so, use it
	if (globalThis.libWrapper && !(globalThis.libWrapper.is_fallback ?? true)) {
		libWrapper = globalThis.libWrapper;
		return;
	}

	// Fallback implementation
	libWrapper = class {
		static get is_fallback() {
			return true;
		}

		static get WRAPPER() {
			return "WRAPPER";
		}
		static get MIXED() {
			return "MIXED";
		}
		static get OVERRIDE() {
			return "OVERRIDE";
		}

		static register(package_id, target, fn, type = "MIXED", { chain = undefined, bind = [] } = {}) {
			const is_setter = target.endsWith("#set");
			target = !is_setter ? target : target.slice(0, -4);
			const split = target.match(TGT_SPLIT_RE).map((x) => x.replace(/\\(.)/g, "$1").replace(TGT_CLEANUP_RE, ""));
			const root_nm = split.splice(0, 1)[0];

			let obj, fn_name;
			if (split.length == 0) {
				obj = globalThis;
				fn_name = root_nm;
			} else {
				const _eval = eval;
				fn_name = split.pop();
				obj = split.reduce((x, y) => x[y], globalThis[root_nm] ?? _eval(root_nm));
			}

			let iObj = obj;
			let descriptor = null;
			while (iObj) {
				descriptor = Object.getOwnPropertyDescriptor(iObj, fn_name);
				if (descriptor) break;
				iObj = Object.getPrototypeOf(iObj);
			}
			if (!descriptor || descriptor?.configurable === false)
				throw new Error(
					`libWrapper Shim: '${target}' does not exist, could not be found, or has a non-configurable descriptor.`,
				);

			let original = null;
			const wrapper =
				chain ?? (type.toUpperCase?.() != "OVERRIDE" && type != 3)
					? function (...args) {
							return fn.call(this, original.bind(this), ...bind, ...args);
					  }
					: function (...args) {
							return fn.call(this, ...bind, ...args);
					  };
			if (!is_setter) {
				if (descriptor.value) {
					original = descriptor.value;
					descriptor.value = wrapper;
				} else {
					original = descriptor.get;
					descriptor.get = wrapper;
				}
			} else {
				if (!descriptor.set) throw new Error(`libWrapper Shim: '${target}' does not have a setter`);
				original = descriptor.set;
				descriptor.set = wrapper;
			}

			descriptor.configurable = true;
			Object.defineProperty(obj, fn_name, descriptor);
		}
	};
});

/**
 * Provides helper methods for use elsewhere in the module (and has your back in a melee)
 */
class Sidekick {
	/**
	 * Use FilePicker to browse then Fetch one or more JSONs and return them
	 * @param {string} source
	 * @param {string} path
	 * @returns {Promise<JSON[]>}
	 */
	static async fetchJsons(source, path) {
		const extensions = [".json"];
		const fp = await FilePicker.browse(source, path, { extensions });
		const fetchedJsons = fp?.files?.length ? await Promise.all(fp.files.map((f) => Sidekick.fetchJson(f))) : [];
		const jsons = fetchedJsons.filter((j) => !!j);

		return jsons;
	}

	/**
	 * Fetch a JSON from a given file
	 * @param {File} file
	 * @returns {Promise<JSON> | null}
	 */
	static async fetchJson(file) {
		try {
			const jsonFile = await fetch(file);
			const json = await jsonFile.json();
			if (!(json instanceof Object)) throw new Error("Not a valid JSON!");
			return json;
		} catch(e) {
			console.warn(e.message);
			return null;
		}
	}

	/**
	 * Attempts to coerce a target value into the exemplar's type
	 * @param {string} value
	 * @param {string} type
	 * @returns {number | string | boolean} coercedValue
	 */
	static coerceType(value, type) {
		switch (type) {
			case "number":
				return Number(value);

			case "string":
				return value.toString();

			case "boolean":
				return value.toString().toLowerCase() === "true"
					? true
					: value.toString().toLowerCase() === "false"
						? false
						: value;

			default:
				return value;
		}
	}

	/**
	 * Get a random unique Id, checking an optional supplied array of ids for a match
	 * @param {string[]} existingIds
	 * @param {object} root0
	 * @param {number} root0.iterations
	 * @param {number} root0.length
	 * @returns {string}
	 */
	static createId(existingIds = [], { iterations = 10000, length = 16 } = {}) {
		for (let attempt = 0; attempt < iterations; attempt++) {
			const id = foundry.utils.randomID(length);
			if (!existingIds.includes(id)) {
				return id;
			}
		}

		throw new Error(
			`Combat Utility Belt - Sidekick | Tried to create a unique id over ${iterations} iterations and failed.`
		);
	}

	/**
	 * For a given string generate a slug, optionally checking a list of existing Ids for uniqueness
	 * @param {string} string
	 * @param {string[]} idList
	 * @returns {string}
	 */
	static generateUniqueSlugId(string, idList = []) {
		let slug = string.slugify();

		const existingIds = idList.filter((id) => id === slug);

		if (!existingIds.length) return slug;

		const uniqueIndex = existingIds.length > 1 ? Math.max(...existingIds.map((id) => id.match(/\d+/g)[0])) + 1 : 1;
		slug = slug.replace(/\d+$/g, uniqueIndex);

		return slug;
	}

	/**
	 * For a given file path, find the filename and then apply title case
	 * @param {string} path
	 * @returns {string}
	 */
	static getNameFromFilePath(path) {
		if (!path) return null;

		const file = path.split("\\").pop()
			.split("/")
			.pop();

		if (!file) return null;

		const filename = file.replace(/\.[^/.]+$/, "");

		if (!filename) return null;

		const name = filename.titleCase();
		return name;
	}

	/**
	 * Loads templates for partials
	 */
	static async loadTemplates() {
		const templates = [
			"modules/condition-lab-triggler/templates/partials/chat-card-condition-list.hbs",
			"modules/condition-lab-triggler/templates/partials/condition-lab-row.hbs",
			"modules/condition-lab-triggler/templates/partials/triggler-icon.hbs"
		];
		await loadTemplates(templates);
	}

	/**
	 * Converts the given string to camelCase using the provided delimiter to break up words
	 * @param {string} string
	 * @param {string} delimiter
	 * @returns {string} the converted string
	 * @example Sidekick.toCamelCase("my-cool-string", "-") // returns "myCoolString"
	 */
	static toCamelCase(string, delimiter) {
		const stringParts = string.split(delimiter);
		return stringParts instanceof Array
			? stringParts.reduce((camelString, part, index) => {
				return (camelString += index > 0 ? part.titleCase() : part);
			}, "")
			: stringParts;
	}
}

/**
 * Builds a mapping between status icons and journal entries that represent conditions
 */
class EnhancedConditions {
	conditions = null;

	conditionMapType = "default";

	get enhancedConditions() {
		return this;
	}

	/* -------------------------------------------- */
	/*                    Workers                   */
	/* -------------------------------------------- */

	/**
	 * Process the addition/removal of an Active Effect
	 * @param {ActiveEffect} effect  the effect
	 * @param {string} type  the type of change to process. "create" or "delete"
	 */
	static _processActiveEffectChange(effect, type = "create") {
		if (!(effect instanceof ActiveEffect)) return;

		const conditionId = effect.getFlag("condition-lab-triggler", "conditionId");
		const isDefault = !conditionId;
		const effectIds = conditionId ? [conditionId] : Array.from(effect.statuses);

		const conditions = effectIds.map((effectId) => ({
			...EnhancedConditions.lookupEntryMapping(effectId),
			effectId
		}));

		const toOutput = conditions.filter((condition) => (isDefault && game.settings.get("condition-lab-triggler", "defaultConditionsOutputToChat"))
			|| (game.settings.get("condition-lab-triggler", "conditionsOutputToChat") && condition?.options?.outputChat));
		const actor = effect.parent;

		if (toOutput.length) {
			EnhancedConditions.outputChatMessage(actor, toOutput, { type: type === "delete" ? "removed" : "added" });
		}

		if (isDefault) return;
		// If not default we only have one condition.
		const condition = conditions[0];
		let macros = [];

		switch (type) {
			case "create":
				macros = condition.macros?.filter((m) => m.type === "apply");
				if (condition.options?.removeOthers) EnhancedConditions._removeOtherConditions(actor, condition.id);
				if (condition.options?.markDefeated) EnhancedConditions._toggleDefeated(actor, { markDefeated: true });

				break;

			case "delete":
				macros = condition.macros?.filter((m) => m.type === "remove");
				if (condition.options?.markDefeated) EnhancedConditions._toggleDefeated(actor, { markDefeated: false });
				break;
		}

		const macroIds = macros?.length ? macros.filter((m) => m.id).map((m) => m.id) : null;

		if (macroIds?.length) EnhancedConditions._processMacros(macroIds, actor);
	}

	/**
	 * Checks statusEffect icons against map and returns matching condition mappings
	 * @param {string[] | string} effectIds  A list of effectIds, or a single effectId to check
	 * @returns {string[] | string | undefined}
	 */
	static lookupEntryMapping(effectIds) {
		if (!(effectIds instanceof Array)) {
			effectIds = [effectIds];
		}

		const conditionEntries = EnhancedConditions.getConditionsMap().filter((row) =>
			effectIds.includes(row.id ?? Sidekick.generateUniqueSlugId(row.name))
		);

		if (conditionEntries.length === 0) return;

		return conditionEntries.length > 1 ? conditionEntries : conditionEntries.shift();
	}

	/**
	 * Output one or more condition entries to chat
	 * @param {Actor|Token} entity
	 * @param {Array<Condition>} entries
	 * @param {object} options
	 * @param {string} options.type	"added", "removed", or "active"
	 * @todo refactor to use actor or token
	 */
	static async outputChatMessage(entity, entries, options = { type: "active" }) {
		const isActorEntity = entity instanceof Actor;
		// Turn a single condition mapping entry into an array
		entries = entries instanceof Array ? entries : [entries];

		if (!entity || !entries.length) return;

		const type = {};

		switch (options.type) {
			case "added":
				type.added = true;
				type.title = game.i18n.localize("CLT.ENHANCED_CONDITIONS.ChatCard.Title.Added");
				break;

			case "removed":
				type.removed = true;
				type.title = game.i18n.localize("CLT.ENHANCED_CONDITIONS.ChatCard.Title.Removed");
				break;

			case "active":
			default:
				type.active = true;
				type.title = game.i18n.localize("CLT.ENHANCED_CONDITIONS.ChatCard.Title.Active");
				break;
		}

		const chatUser = game.userId;
		// const token = token || this.currentToken;
		const chatType = CONST.CHAT_MESSAGE_STYLES.OTHER;
		const speaker = isActorEntity
			? ChatMessage.getSpeaker({ actor: entity })
			: ChatMessage.getSpeaker({ token: entity });
		const timestamp = type.active ? null : Date.now();

		// iterate over the entries and mark any with references and flags for use in the template
		const conditions = entries.map(({ reference, referenceId: rId, ...e }) => {
			let referenceId = rId;
			if (!rId && reference) {
				referenceId = `@UUID[${reference}]`;
			}
			if (referenceId && !referenceId.match(/\{.+\}/)) {
				referenceId = `${referenceId}{${e.name}}`;
			}
			const isDefault = !e.options;
			return ({
				...e,
				referenceId,
				hasReference: !!referenceId,
				hasButtons: !isDefault
					&& game.user.isGM
			});
		});

		// if the last message Enhanced conditions, append instead of making a new one
		const lastMessage = game.messages.contents[game.messages.contents.length - 1];
		const lastMessageSpeaker = lastMessage?.speaker;
		const sameSpeaker = isActorEntity
			? lastMessageSpeaker?.actor === speaker.actor
			: lastMessageSpeaker?.token === speaker.token;

		// hard code the recent timestamp to 30s for now
		const recentTimestamp = Date.now() <= (lastMessage?.timestamp ?? 0) + 30000;
		const enhancedConditionsDiv = lastMessage?.content.match("enhanced-conditions");

		if (!type.active && enhancedConditionsDiv && sameSpeaker && recentTimestamp) {
			let newContent = "";
			for (const condition of conditions) {
				condition.name = game.i18n.localize(condition.name);
				const newRow = await renderTemplate(
					"modules/condition-lab-triggler/templates/partials/chat-card-condition-list.hbs",
					{ condition, type, timestamp }
				);
				newContent += newRow;
			}
			const existingContent = lastMessage.content;
			const ulEnd = existingContent?.indexOf("</ul>");
			if (!ulEnd) return;
			const content = existingContent.slice(0, ulEnd) + newContent + existingContent.slice(ulEnd);
			await lastMessage.update({ content });
			EnhancedConditions.updateConditionTimestamps();
			ui.chat.scrollBottom();
		} else {
			const chatCardHeading = game.i18n.localize(
				type.active ? "CLT.ENHANCED_CONDITIONS.ChatCard.HeadingActive" : "CLT.ENHANCED_CONDITIONS.ChatCard.Heading"
			);

			const templateData = {
				chatCardHeading,
				type,
				timestamp,
				entityId: entity.id,
				alias: speaker.alias,
				conditions,
				isOwner: entity.isOwner || game.user.isGM
			};

			const content = await renderTemplate(
				"modules/condition-lab-triggler/templates/chat-conditions.hbs",
				templateData
			);

			await ChatMessage.create({
				speaker,
				content,
				type: chatType,
				user: chatUser
			});
		}
	}

	/**
	 * Marks a Combatants for a particular entity as defeated
	 * @param {Actor | Token} entities  the entity to mark defeated
	 * @param {object} options
	 * @param {boolean} options.markDefeated  an optional state flag (default=true)
	 */
	static _toggleDefeated(entities, { markDefeated = true } = {}) {
		const combat = game.combat;

		if (!entities) {
			// First check for any controlled tokens
			if (canvas?.tokens?.controlled.length) entities = canvas.tokens.controlled;
			else if (game.user.character) entities = game.user.character;
		}

		if (!entities) {
			return;
		}

		entities = entities instanceof Array ? entities : [entities];

		const tokens = entities.flatMap((e) =>
			e instanceof Token || e instanceof TokenDocument ? e : e instanceof Actor ? e.getActiveTokens() : null
		);

		const updates = [];

		// loop through tokens, and if there's matching combatants, add them to the update
		for (const token of tokens) {
			const combatants = combat
				? combat.combatants?.contents?.filter((c) => c.tokenId === token.id && c.defeated !== markDefeated)
				: [];

			if (!combatants.length) return;

			const update = combatants.map((c) => {
				return {
					_id: c.id,
					defeated: markDefeated
				};
			});

			updates.push(update);
		}

		if (!updates.length) return;

		// update all combatants at once
		combat.updateEmbeddedDocuments("Combatant", updates.length > 1 ? updates : updates.shift());
	}

	/**
	 * For a given entity, removes conditions other than the one supplied
	 * @param {*} entity
	 * @param {*} conditionId
	 */
	static async _removeOtherConditions(entity, conditionId) {
		const entityConditions = EnhancedConditions.getConditions(entity, { warn: false });
		let conditions = entityConditions ? entityConditions.conditions : [];
		conditions = conditions instanceof Array ? conditions : [conditions];

		if (!conditions.length) return;

		const removeConditions = conditions.filter((c) => c.id !== conditionId);

		if (!removeConditions.length) return;

		for (const c of removeConditions) await EnhancedConditions.removeCondition(c.name, entity, { warn: true });
	}

	/**
	 * Process macros based on given Ids
	 * @param {*} macroIds
	 * @param {*} entity
	 */
	static async _processMacros(macroIds, entity = null) {
		const scope = {};
		if (entity instanceof Token || entity instanceof TokenDocument) {
			scope.token = entity;
		} else if (entity instanceof Actor) {
			scope.actor = entity;
		}

		for (const macroId of macroIds) {
			const macro = game.macros.get(macroId);
			if (!macro) continue;

			await macro.execute(scope);
		}
	}

	/**
	 * Update condition added/removed timestamps
	 */
	static updateConditionTimestamps() {
		const conditionRows = document.querySelectorAll("ol#chat-log ul.condition-list li");
		for (const li of conditionRows) {
			const timestamp =
				typeof li.dataset.timestamp === "string" ? parseInt(li.dataset.timestamp) : li.dataset.timestamp;
			const iconSpanWrapper = li.querySelector("span.add-remove-icon");

			if (!timestamp || !iconSpanWrapper) continue;

			const type = li.dataset.changeType;
			iconSpanWrapper.title = `${type} ${foundry.utils.timeSince(timestamp)}`;
		}
	}

	/* -------------------------------------------- */
	/*                    Helpers                   */
	/* -------------------------------------------- */

	/**
	 * Returns the default maps supplied with the module
	 * @todo: map to entryId and then rebuild on import
	 * @returns {Promise<object[]>}
	 */
	static async _loadDefaultMaps() {
		const path = "modules/condition-lab-triggler/condition-maps";
		const jsons = await Sidekick.fetchJsons("data", path);

		const defaultMaps = jsons
			.filter((j) => !j.system.includes("example"))
			.reduce((obj, current) => {
				obj[current.system] = current.map;
				return obj;
			}, {});

		return defaultMaps;
	}

	/**
	 * Parse the provided Condition Map and prepare it for storage, validating and correcting bad or missing data where possible
	 * @param {*} conditionMap
	 * @returns {object[]}
	 */
	static _prepareMap(conditionMap) {
		const preparedMap = [];

		if (!conditionMap || !conditionMap?.length) {
			return preparedMap;
		}

		const outputChatSetting = game.settings.get("condition-lab-triggler", "conditionsOutputToChat");
		conditionMap = conditionMap.filter((c) => c.name && c.id);

		// Iterate through the map validating/preparing the data
		for (const condition of conditionMap) {
			condition.options = condition.options || {};
			if (condition.options.outputChat === undefined) condition.options.outputChat = outputChatSetting;
			preparedMap.push(condition);
		}

		return preparedMap;
	}

	/**
	 * Creates journal entries for any conditions that don't have one
	 * @param {string} condition the condition being evaluated
	 * @returns {*}
	 */
	static async _createJournalEntry(condition) {
		return await JournalEntry.create(
			{
				name: condition,
				permission: {
					default: CONST.DOCUMENT_PERMISSION_LEVELS.LIMITED
				}
			},
			{
				displaySheet: false
			}
		);
	}

	static getConditionsMap() {
		let conditions = game.settings.get("condition-lab-triggler", "activeConditionMap");
		if (!game.settings.get("condition-lab-triggler", "removeDefaultEffects")) {
			conditions = conditions.concat(game.clt.CoreStatusEffects);
		}
		return conditions;
	}

	/**
	 * Gets one or more conditions from the map by their name
	 * @param {string} conditionName  the condition to get
	 * @returns {string[] | string | undefined}
	 */
	static _lookupConditionByName(conditionName) {
		if (!conditionName) return;

		conditionName = conditionName instanceof Array ? conditionName : [conditionName];

		const conditions = EnhancedConditions.getConditionsMap().filter((c) => conditionName.includes(c.name)) ?? [];
		if (!conditions.length) return;

		return conditions.length > 1 ? conditions : conditions.shift();
	}

	/**
	 * Updates the CONFIG.statusEffect effects with Condition Map ones
	 * @param {*} conditionMap
	 */
	static _updateStatusEffects(conditionMap) {
		const removeDefaultEffects = game.settings.get("condition-lab-triggler", "removeDefaultEffects");
		const activeConditionMap = conditionMap || game.settings.get("condition-lab-triggler", "activeConditionMap");

		if (!removeDefaultEffects && !activeConditionMap) {
			return;
		}

		const activeConditionEffects = EnhancedConditions._prepareStatusEffects(activeConditionMap);

		if (removeDefaultEffects) {
			CONFIG.statusEffects = activeConditionEffects ?? [];
		} else if (activeConditionMap instanceof Array) {
			// add the icons from the condition map to the status effects array
			const coreEffects =
				CONFIG.defaultStatusEffects || game.clt.CoreStatusEffects;

			// Create a Set based on the core status effects and the Enhanced Condition effects. Using a Set ensures unique icons only
			CONFIG.statusEffects = coreEffects.concat(activeConditionEffects);
		}
	}

	/**
	 * Converts the given Condition Map (one or more Conditions) into a Status Effects array or object
	 * @param {object[] | object} conditionMap
	 * @returns {object[]} statusEffects
	 */
	static _prepareStatusEffects(conditionMap) {
		conditionMap = conditionMap instanceof Array ? conditionMap : [conditionMap];
		if (!conditionMap.length) return [];

		const existingIds = conditionMap.filter((c) => c.id).map((c) => c.id);

		const statusEffects = conditionMap.map((c) => {
			const id = c.id || Sidekick.createId(existingIds);
			const { activeEffect, duration, img, name, options } = c;

			return {
				id,
				statuses: [id],
				name,
				img,
				changes: activeEffect?.changes || [],
				description: activeEffect?.description || "",
				duration: duration || activeEffect?.duration || {},
				flags: {
					...activeEffect?.flags,
					core: {
						overlay: options?.overlay ?? false
					},
					"condition-lab-triggler": {
						conditionId: id
					}
				},
				get icon() {
					return this.img;
				},
				get label() {
					return this.name;
				},
				set label(value) {
					this.name = value;
				}
			};
		});

		return statusEffects;
	}

	/**
	 * Prepares one or more ActiveEffects from Conditions for placement on an actor
	 * @param {object[] | object} effects  a single ActiveEffect data object or an array of ActiveEffect data objects
	 * @returns {object[]}
	 */
	static _prepareActiveEffects(effects) {
		effects = effects instanceof Array ? effects : [effects];
		if (!effects) return [];

		for (const effect of effects) {
			const overlay = foundry.utils.getProperty(effect, "flags.condition-lab-triggler.core.overlay");
			// If the parent Condition for the ActiveEffect defines it as an overlay, mark the ActiveEffect as an overlay
			if (overlay) {
				effect.flags.core.overlay = overlay;
			}
		}

		return effects;
	}

	/**
	 * Retrieves a condition name by its mapped icon
	 * @param {*} icon
	 * @returns {string[]}
	 */
	static getConditionsByIcon(icon) {
		const conditionMap = game.settings.get("condition-lab-triggler", "activeConditionMap");

		if (!conditionMap || !icon) {
			return [];
		}

		if (conditionMap instanceof Array && conditionMap.length) {
			const filteredIcons = conditionMap.filter((c) => c.icon === icon).map((c) => c.name);
			if (!filteredIcons.length) {
				return [];
			}
			return filteredIcons;
		}

		return [];
	}

	/**
	 * Parses a condition map JSON and returns a map
	 * @param {*} json
	 * @returns {object[]}
	 */
	static mapFromJson(json) {
		if (json.system !== game.system.id) {
			ui.notifications.warn(game.i18n.localize("CLT.ENHANCED_CONDITIONS.MapMismatch"));
		}

		const map = json.map ? EnhancedConditions._prepareMap(json.map) : [];

		return map;
	}

	/**
	 * Returns the default condition map for a given system
	 * @param {object} defaultMaps
	 * @returns {object}}
	 */
	static getDefaultMap(defaultMaps = null) {
		const system = game.system.id;
		defaultMaps =
			defaultMaps instanceof Object
				? defaultMaps
				: game.settings.get("condition-lab-triggler", "defaultConditionMaps");
		let defaultMap = defaultMaps[system] || [];

		if (!defaultMap.length) {
			defaultMap = EnhancedConditions.buildDefaultMap();
		}

		return defaultMap;
	}

	/**
	 * Builds a default map for a given system
	 * @todo #281 update for active effects
	 * @returns {object[]}
	 */
	static buildDefaultMap() {
		const coreEffectsSetting = game.clt.CoreStatusEffects;
		const coreEffects = coreEffectsSetting && coreEffectsSetting.length
			? coreEffectsSetting
			: foundry.utils.duplicate(CONFIG.statusEffects);
		return EnhancedConditions._prepareMap(coreEffects);
	}

	/* -------------------------------------------- */
	/*                      API                     */
	/* -------------------------------------------- */

	/**
	 * Apply the named condition to the provided entities (Actors or Tokens)
	 * @deprecated
	 * @param  {...any} params
	 * @returns {*}
	 * @see EnhancedConditions#addCondition
	 */
	static async applyCondition(...params) {
		return await EnhancedConditions.addCondition(...params);
	}

	/**
	 * Applies the named condition to the provided entities (Actors or Tokens)
	 * @param {string[] | string} conditionName  the name of the condition to add
	 * @param {(Actor[] | Token[] | Actor | Token)} [entities=null] one or more Actors or Tokens to apply the Condition to
	 * @param {object} options
	 * @param {boolean} [options.allowDuplicates=false]  if one or more of the Conditions specified is already active on the Entity, this will still add the Condition. Use in conjunction with `replaceExisting` to determine how duplicates are handled
	 * @param {boolean} [options.replaceExisting=false]  whether or not to replace existing Conditions with any duplicates in the `conditionName` parameter. If `allowDuplicates` is true and `replaceExisting` is false then a duplicate condition is created. Has no effect is `keepDuplicates` is `false`
	 * @example
	 * // Add the Condition "Blinded" to an Actor named "Bob". Duplicates will not be created.
	 * game.clt.addCondition("Blinded", game.actors.getName("Bob"));
	 * @example
	 * // Add the Condition "Charmed" to the currently controlled Token/s. Duplicates will not be created.
	 * game.clt.addCondition("Charmed");
	 * @example
	 * // Add the Conditions "Blinded" and "Charmed" to the targeted Token/s and create duplicates, replacing any existing Conditions of the same names.
	 * game.clt.addCondition(["Blinded", "Charmed"], [...game.user.targets], {allowDuplicates: true, replaceExisting: true});
	 */
	static async addCondition(
		conditionName,
		entities = null,
		{ allowDuplicates = false, replaceExisting = false } = {}
	) {
		if (!entities) {
			// First check for any controlled tokens
			if (canvas?.tokens?.controlled.length) entities = canvas.tokens.controlled;
			else if (game.user.character) entities = game.user.character;
		}

		if (!entities) {
			ui.notifications.error(game.i18n.localize("CLT.ENHANCED_CONDITIONS.ApplyCondition.Failed.NoToken"));
			console.log(
				`Combat Utility Belt - Enhanced Conditions | ${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.ApplyCondition.Failed.NoToken"
				)}`
			);
			return;
		}

		let conditions = EnhancedConditions._lookupConditionByName(conditionName);

		if (!conditions) {
			ui.notifications.error(
				`${game.i18n.localize("CLT.ENHANCED_CONDITIONS.ApplyCondition.Failed.NoCondition")} ${conditionName}`
			);
			console.log(
				`Combat Utility Belt - Enhanced Conditions | ${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.ApplyCondition.Failed.NoCondition"
				)}`,
				conditionName
			);
			return;
		}

		conditions = conditions instanceof Array ? conditions : [conditions];
		const conditionNames = conditions.map((c) => c.name);

		let effects = EnhancedConditions.getActiveEffects(conditions);

		if (!effects) {
			ui.notifications.error(
				`${game.i18n.localize("CLT.ENHANCED_CONDTIONS.ApplyCondition.Failed.NoEffect")} ${conditions}`
			);
			console.log(
				`Condition Lab & Triggler | ${game.i18n.localize(
					"CLT.ENHANCED_CONDTIONS.ApplyCondition.Failed.NoEffect"
				)}`,
				conditions
			);
			return;
		}

		effects = EnhancedConditions._prepareActiveEffects(effects);

		if (entities && !(entities instanceof Array)) {
			entities = [entities];
		}

		for (let entity of entities) {
			const actor =
				entity instanceof Actor
					? entity
					: entity instanceof Token || entity instanceof TokenDocument
						? entity.actor
						: null;

			if (!actor) continue;

			const hasDuplicates = EnhancedConditions.hasCondition(conditionNames, actor, { warn: false });
			const newEffects = [];
			const updateEffects = [];

			// If there are duplicate Condition effects on the Actor take extra steps
			if (hasDuplicates) {
				// @todo #348 determine the best way to raise warnings in this scenario
				/*
				if (warn) {
					ui.notifications.warn(`${entity.name}: ${conditionName} ${game.i18n.localize("CLT.ENHANCED_CONDITIONS.ApplyCondition.Failed.AlreadyActive")}`);
					console.log(`Combat Utility Belt - Enhanced Conditions | ${entity.name}: ${conditionName} ${game.i18n.localize("CLT.ENHANCED_CONDITIONS.ApplyCondition.Failed.AlreadyActive")}`);
				}
				*/

				// Get the existing conditions on the actor
				let existingConditionEffects = EnhancedConditions.getConditionEffects(actor, { warn: false });
				existingConditionEffects =
					existingConditionEffects instanceof Array ? existingConditionEffects : [existingConditionEffects];

				// Loop through the effects sorting them into either existing or new effects
				for (const effect of effects) {
					// Scenario 1: if duplicates are allowed, but existing conditions are not replaced, everything is new
					if (allowDuplicates && !replaceExisting) {
						newEffects.push(effect);
						continue;
					}

					const conditionId = foundry.utils.getProperty(effect, `flags.condition-lab-triggler.${"conditionId"}`);
					const matchedConditionEffects = existingConditionEffects.filter(
						(e) => e.getFlag("condition-lab-triggler", "conditionId") === conditionId
					);

					// Scenario 2: if duplicates are allowed, and existing conditions should be replaced, add any existing conditions to update
					if (replaceExisting) {
						for (const matchedCondition of matchedConditionEffects) {
							updateEffects.push({ id: matchedCondition.id, ...effect });
						}
					}

					// Scenario 2 cont'd: if the condition is not matched, it must be new, so add to the new effects
					// Scenario 3: if duplicates are not allowed, and existing conditions are not replaced, just add the new conditions
					if (!matchedConditionEffects.length) newEffects.push(effect);
				}
			}

			// If the any of the conditions remove others, remove all conditions
			// @todo maybe add this to the logic above?
			if (conditions.some((c) => c?.options?.removeOthers)) {
				await EnhancedConditions.removeAllConditions(actor, { warn: false });
			}

			const createData = hasDuplicates ? newEffects : effects;
			const updateData = updateEffects;
			// If system is dnd3.5e, then prevent upstream updates to avoid condition being immediately removed
			const stopUpdates = game.system.id === "D35E";

			if (createData.length) await actor.createEmbeddedDocuments("ActiveEffect", createData, { stopUpdates });
			if (updateData.length) await actor.updateEmbeddedDocuments("ActiveEffect", updateData, { stopUpdates });
		}
	}

	/**
	 * Gets a condition by name from the Condition Map
	 * @param {*} conditionName
	 * @param {*} map
	 * @param {object} options
	 * @param {*} options.warn
	 * @returns {string[] | string | undefined}
	 */
	static getCondition(conditionName, map = null, { warn = false } = {}) {
		if (!conditionName) {
			if (warn) ui.notifications.error(game.i18n.localize("CLT.ENHANCED_CONDITIONS.GetCondition.Failed.NoCondition"));
		}

		return EnhancedConditions._lookupConditionByName(conditionName);
	}

	/**
	 * Retrieves all active conditions for one or more given entities (Actors or Tokens)
	 * @param {Actor | Token} entities  one or more Actors or Tokens to get Conditions from
	 * @param {object} options
	 * @param {boolean} options.warn  output notifications
	 * @returns {string[] | string | undefined}
	 * @example
	 * // Get conditions for an Actor named "Bob"
	 * game.clt.getConditions(game.actors.getName("Bob"));
	 * @example
	 * // Get conditions for the currently controlled Token
	 * game.clt.getConditions();
	 */
	static getConditions(entities = null, { warn = true } = {}) {
		if (!entities) {
			// First check for any controlled tokens
			if (canvas?.tokens?.controlled.length) entities = canvas.tokens.controlled;
			// Then check if the user has an assigned character
			else if (game.user.character) entities = game.user.character;
		}

		if (!entities) {
			if (warn) ui.notifications.error(game.i18n.localize("CLT.ENHANCED_CONDITIONS.GetConditions.Failed.NoToken"));
			console.log(
				`Combat Utility Belt - Enhanced Conditions | ${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.GetConditions.Failed.NoToken"
				)}`
			);
			return;
		}

		const map = game.settings.get("condition-lab-triggler", "activeConditionMap");

		if (!map || !map.length) {
			if (warn) ui.notifications.error(game.i18n.localize("CLT.ENHANCED_CONDITIONS.GetConditions.Failed.NoCondition"));
			console.log(
				`Combat Utility Belt - Enhanced Conditions | ${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.GetConditions.Failed.NoCondition"
				)}`
			);
			return;
		}

		if (!(entities instanceof Array)) {
			entities = [entities];
		}

		const results = [];

		for (let entity of entities) {
			const actor =
				entity instanceof Actor
					? entity
					: entity instanceof Token || entity instanceof TokenDocument
						? entity.actor
						: null;

			const effects = actor?.effects.contents;

			if (!effects) continue;

			const effectIds =
				effects instanceof Array
					? effects.map((e) => e.getFlag("condition-lab-triggler", "conditionId"))
					: effects.getFlag("condition-lab-triggler", "conditionId");

			if (!effectIds.length) continue;

			const entityConditions = {
				entity: entity,
				conditions: EnhancedConditions.lookupEntryMapping(effectIds)
			};

			results.push(entityConditions);
		}

		if (!results.length) {
			if (warn) ui.notifications.notify(game.i18n.localize("CLT.ENHANCED_CONDITIONS.GetConditions.Failed.NoResults"));
			console.log(
				`Combat Utility Belt - Enhanced Conditions | ${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.GetConditions.Failed.NoResults"
				)}`
			);
			return null;
		}

		return results.length > 1 ? results : results.shift();
	}

	/**
	 * Gets the Active Effect data (if any) for the given conditions
	 * @param {Array} conditions
	 * @returns {Array} statusEffects
	 */
	static getActiveEffects(conditions) {
		return EnhancedConditions._prepareStatusEffects(conditions);
	}

	/**
	 * Gets any Active Effect instances present on the entities (Actor/s or Token/s) that are mapped Conditions
	 * @param {string} entities  the entities to check
	 * @param {Array} map  the Condition map to check (optional)
	 * @param {boolean} warn  output notifications
	 * @returns {Map | object | undefined} A Map containing the Actor Id and the Condition Active Effect instances if any
	 */
	static getConditionEffects(entities, map = null, { warn = true } = {}) {
		if (!entities) {
			// First check for any controlled tokens
			if (canvas?.tokens?.controlled.length) entities = canvas.tokens.controlled;
			else if (game.user.character) entities = game.user.character;
		}

		if (!entities) {
			if (warn) ui.notifications.error(
				game.i18n.localize("CLT.ENHANCED_CONDITIONS.GetConditionEffects.Failed.NoEntity")
			);
			console.log(
				`Combat Utility Belt - Enhanced Conditions | ${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.RemoveCondition.Failed.NoToken"
				)}`
			);
			return;
		}

		entities = entities instanceof Array ? entities : [entities];

		if (!map) map = game.settings.get("condition-lab-triggler", "activeConditionMap");

		let results = new Collection();

		for (const entity of entities) {
			const actor =
				entity instanceof Actor
					? entity
					: entity instanceof Token || entity instanceof TokenDocument
						? entity.actor
						: null;
			const activeEffects = actor.effects.contents;

			if (!activeEffects.length) continue;

			const conditionEffects = activeEffects.filter((ae) => ae.getFlag("condition-lab-triggler", "conditionId"));

			if (!conditionEffects.length) continue;

			results.set(entity.id, conditionEffects.length > 1 ? conditionEffects : conditionEffects.shift());
		}

		if (!results.size) return null;

		return results.size > 1 ? results : results.values().next().value;
	}

	/**
	 * Checks if the provided Entity (Actor or Token) has the given condition
	 * @param {string | Array} conditionName  the name/s of the condition or conditions to check for
	 * @param {Actor | Token | Array} entities  the entity or entities to check (Actor/s or Token/s)
	 * @param {object} [options]  options object
	 * @param {boolean} [options.warn]  whether or not to output notifications
	 * @returns {boolean} hasCondition  Returns true if one or more of the provided entities has one or more of the provided conditions
	 * @example
	 * // Check for the "Blinded" condition on Actor "Bob"
	 * game.clt.hasCondition("Blinded", game.actors.getName("Bob"));
	 * @example
	 * // Check for the "Charmed" and "Deafened" conditions on the controlled tokens
	 * game.clt.hasCondition(["Charmed", "Deafened"]);
	 */
	static hasCondition(conditionName, entities = null, { warn = true } = {}) {
		if (!conditionName) {
			if (warn) ui.notifications.error(game.i18n.localize("CLT.ENHANCED_CONDITIONS.HasCondition.Failed.NoCondition"));
			console.log(
				`Combat Utility Belt - Enhanced Conditions | ${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.HasCondition.Failed.NoCondition"
				)}`
			);
			return false;
		}

		if (!entities) {
			// First check for any controlled tokens
			if (canvas?.tokens?.controlled.length) entities = canvas.tokens.controlled;
			// Then check if the user has an assigned character
			else if (game.user.character) entities = game.user.character;
		}

		if (!entities) {
			if (warn) ui.notifications.error(game.i18n.localize("CLT.ENHANCED_CONDITIONS.HasCondition.Failed.NoToken"));
			console.log(
				`Combat Utility Belt - Enhanced Conditions | ${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.HasCondition.Failed.NoToken"
				)}`
			);
			return false;
		}

		entities = entities instanceof Array ? entities : [entities];

		let conditions = EnhancedConditions._lookupConditionByName(conditionName);

		if (!conditions) {
			if (warn) ui.notifications.error(game.i18n.localize("CLT.ENHANCED_CONDITIONS.HasCondition.Failed.NoMapping"));
			console.log(
				`Combat Utility Belt - Enhanced Conditions | ${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.RemoveCondition.Failed.NoMapping"
				)}`
			);
			return false;
		}

		conditions = EnhancedConditions._prepareStatusEffects(conditions);
		conditions = conditions instanceof Array ? conditions : [conditions];

		for (let entity of entities) {
			const actor =
				entity instanceof Actor
					? entity
					: entity instanceof Token || entity instanceof TokenDocument
						? entity.actor
						: null;

			if (!actor.effects.size) continue;

			const conditionEffect = actor.effects.contents.some((ae) => {
				return conditions.some(
					(e) =>
						e?.flags["condition-lab-triggler"].conditionId
						=== ae.getFlag("condition-lab-triggler", "conditionId")
				);
			});

			if (conditionEffect) return true;
		}

		return false;
	}

	/**
	 * Removes one or more named conditions from an Entity (Actor/Token)
	 * @param {string} conditionName  the name of the Condition to remove
	 * @param {Actor | Token} entities  One or more Actors or Tokens
	 * @param {object} options  options for removal
	 * @param {boolean} options.warn  whether or not to raise warnings on errors
	 * @example
	 * // Remove Condition named "Blinded" from an Actor named Bob
	 * game.clt.removeCondition("Blinded", game.actors.getName("Bob"));
	 * @example
	 * // Remove Condition named "Charmed" from the currently controlled Token, but don't show any warnings if it fails.
	 * game.clt.removeCondition("Charmed", {warn=false});
	 */
	static async removeCondition(conditionName, entities = null, { warn = true } = {}) {
		if (!entities) {
			// First check for any controlled tokens
			if (canvas?.tokens?.controlled.length) entities = canvas.tokens.controlled;
			else if (game.user.character) entities = game.user.character;
			else entities = null;
		}

		if (!entities) {
			if (warn) ui.notifications.error(game.i18n.localize("CLT.ENHANCED_CONDITIONS.RemoveCondition.Failed.NoToken"));
			console.log(
				`Combat Utility Belt - Enhanced Conditions | ${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.RemoveCondition.Failed.NoToken"
				)}`
			);
			return;
		}

		if (!(conditionName instanceof Array)) conditionName = [conditionName];

		const conditions = EnhancedConditions._lookupConditionByName(conditionName);

		if (!conditions || (conditions instanceof Array && !conditions.length)) {
			if (warn) ui.notifications.error(
				`${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.RemoveCondition.Failed.NoCondition"
				)} ${conditionName}`
			);
			console.log(
				`Combat Utility Belt - Enhanced Conditions | ${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.RemoveCondition.Failed.NoCondition"
				)}`,
				conditionName
			);
			return;
		}

		let effects = EnhancedConditions.getActiveEffects(conditions);

		if (!effects) {
			if (warn) ui.notifications.error(game.i18n.localize("ENHANCED_CONDTIONS.RemoveCondition.Failed.NoEffect"));
			console.log(
				`Combat Utility Belt - Enhanced Condition | ${game.i18n.localize(
					"ENHANCED_CONDTIONS.RemoveCondition.Failed.NoEffect"
				)}`,
				conditionName
			);
			return;
		}

		if (!(effects instanceof Array)) effects = [effects];

		if (entities && !(entities instanceof Array)) entities = [entities];

		for (let entity of entities) {
			const actor =
				entity instanceof Actor
					? entity
					: entity instanceof Token || entity instanceof TokenDocument
						? entity.actor
						: null;
			const toRemove = actor.appliedEffects?.filter((e) => effects.find((r) => e.statuses.has(r.id)));

			if (!toRemove || (toRemove && !toRemove.length)) {
				if (warn) ui.notifications.warn(
					`${conditionName} ${game.i18n.localize(
						"CLT.ENHANCED_CONDITIONS.RemoveCondition.Failed.NotActive"
					)}`
				);
				console.log(
					`Combat Utility Belt - Enhanced Conditions | ${conditionName} ${game.i18n.localize(
						"CLT.ENHANCED_CONDITIONS.RemoveCondition.Failed.NotActive"
					)}")`
				);
				return;
			}

			await actor.deleteEmbeddedDocuments("ActiveEffect", toRemove.map((e) => e.id));
		}
	}

	/**
	 * Removes all conditions from the provided entities
	 * @param {Actors | Tokens} entities  One or more Actors or Tokens to remove Conditions from
	 * @param {object} options
	 * @param {boolean} options.warn  output notifications
	 * @example
	 * // Remove all Conditions on an Actor named Bob
	 * game.clt.removeAllConditions(game.actors.getName("Bob"));
	 * @example
	 * // Remove all Conditions on the currently controlled Token
	 * game.clt.removeAllConditions();
	 */
	static async removeAllConditions(entities = null, { warn = true } = {}) {
		if (!entities) {
			// First check for any controlled tokens
			if (canvas?.tokens?.controlled.length) entities = canvas.tokens.controlled;
			else if (game.user.character) entities = game.user.character;
		}

		if (!entities) {
			if (warn) ui.notifications.error(game.i18n.localize("CLT.ENHANCED_CONDITIONS.RemoveCondition.Failed.NoToken"));
			console.log(
				`Combat Utility Belt - Enhanced Conditions | ${game.i18n.localize(
					"CLT.ENHANCED_CONDITIONS.RemoveCondition.Failed.NoToken"
				)}`
			);
			return;
		}

		entities = entities instanceof Array ? entities : [entities];

		for (let entity of entities) {
			const actor =
				entity instanceof Actor
					? entity
					: entity instanceof Token || entity instanceof TokenDocument
						? entity.actor
						: null;

			let actorConditionEffects = EnhancedConditions.getConditionEffects(actor, { warn: false });

			if (!actorConditionEffects) continue;

			actorConditionEffects =
				actorConditionEffects instanceof Array ? actorConditionEffects : [actorConditionEffects];

			const effectIds = actorConditionEffects.map((ace) => ace.id);

			await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds);
		}
	}
}

/**
 * Handles triggers for other gadgets in the module... or does it?!
 */
class Triggler {
	static OPERATORS = {
		eq: "=",
		ne: "≠",
		lt: "<",
		lteq: "≤",
		gt: ">",
		gteq: "≥"
	};

	/**
	 * Parses triggers JSON and returns triggers
	 * @param {{}} json
	 * @returns {Array}
	 */
	static triggersFromJson(json) {
		if (json.system !== game.system.id) {
			ui.notifications.warn(game.i18n.localize("CLT.ENHANCED_CONDITIONS.MapMismatch"));
		}
		const triggers = [];
		if (json.triggers) {
			for (const trigger of json.triggers) {
				const processedTrigger = Triggler._prepareTrigger(trigger);
				if (processedTrigger) {
					triggers.push(processedTrigger);
				}
			}
			return triggers;
		}
		return [];
	}

	/**
	 * Parse the provided Condition Map and prepare it for storage, validating and correcting bad or missing data where possible
	 * @param {*} trigger
	 * @returns {boolean | object}
	 */
	static _prepareTrigger(trigger) {
		const { triggerType = "simple", id = null } = trigger;

		// const triggerType = formData?.triggerType;

		if (triggerType === "advanced" && !trigger.advancedName.length) {
			console.warn(
				`CLT | Trigger with ID "${id} is defined as an Advanced Trigger but has no Trigger Name.`
			);
			return false;
		}

		const triggers = game.settings.get("condition-lab-triggler", "storedTriggers");
		const text = triggerType === "simple" ? Triggler._constructString(trigger) : trigger.advancedName;

		if (!text) return false;

		const existingTrigger = triggers.find((t) => t.id === id);
		if (existingTrigger) {
			console.warn(`CLT | Trigger with ID "${id} already exists.`);
			return false;
		}
		return {
			id,
			...foundry.utils.duplicate(trigger),
			text
		};
	}

	/**
	 * Construct a string based on trigger parts
	 * @param {*} parts
	 * @returns {string}
	 */
	static _constructString(parts) {
		const triggerType = parts.triggerType;
		const operatorText = Triggler.OPERATORS[parts.operator];
		const advancedOperatorText = Triggler.OPERATORS[parts.advancedOperator];

		const pcOnly = parts.pcOnly ? " (PCs Only)" : "";
		const npcOnly = parts.npcOnly ? " (NPCs Only)" : "";
		const notZero = parts.notZero ? " (Not 0)" : "";
		if (triggerType === "simple") {
			const property2 = parts.property2 ? ` ${parts.category}.${parts.attribute}.${parts.property2}` : "";
			return `${parts.category}.${parts.attribute}.${parts.property1} ${operatorText} ${parts.value}${property2}${pcOnly}${npcOnly}${notZero}`;
		} else if (triggerType === "advanced") {
			const advancedProperty2 = parts.advancedProperty2 ? ` ${parts.advancedProperty2}` : "";
			return `${parts.advancedProperty} ${advancedOperatorText} ${parts.advancedValue}${advancedProperty2}${pcOnly}${npcOnly}${notZero}`;
		}
		return "";
	}

	/**
	 * Executes a trigger calling predefined actions
	 * @param {*} trigger
	 * @param {*} target
	 */
	static async _executeTrigger(trigger, target) {
		const actor =
			target instanceof Actor
				? target
				: target instanceof TokenDocument || target instanceof Token
					? target.actor
					: null;
		const token = target instanceof TokenDocument ? target : target instanceof Token ? target.document : null;
		const conditionMap = game.settings.get("condition-lab-triggler", "activeConditionMap");
		const matchedApplyConditions = conditionMap.filter((m) => m.applyTrigger === trigger.id);
		const matchedRemoveConditions = conditionMap.filter((m) => m.removeTrigger === trigger.id);
		const matchedMacros = game.macros.contents.filter(
			(m) => m.getFlag("condition-lab-triggler", "macroTrigger") === trigger.id
		);
		const applyConditionNames = matchedApplyConditions.map((c) => c.name);
		const removeConditionNames = matchedRemoveConditions.map((c) => c.name);

		if (applyConditionNames.length) {
			await EnhancedConditions.addCondition(applyConditionNames, target, { warn: false });
		}
		if (removeConditionNames.length) {
			await EnhancedConditions.removeCondition(removeConditionNames, target, { warn: false });
		}

		for (const macro of matchedMacros) {
			await macro.execute({ actor, token });
		}
	}

	/**
	 * Processes an entity update and evaluates triggers
	 * @param {*} entity
	 * @param {*} update
	 * @param {*} entryPoint1
	 */
	static async _processUpdate(entity, update, entryPoint1) {
		if (!entity || !update) return;

		const triggers = game.settings.get("condition-lab-triggler", "storedTriggers");

		/**
		 * Avoid issues with Multi-Level Tokens by ignoring clone tokens
		 * @see Issue #491
		 */
		if (foundry.utils.getProperty(entity, "flags.multilevel-tokens.stoken")) {
			return;
		}

		const hasPlayerOwner = entity.hasPlayerOwner;

		/**
		 * process each trigger in turn, checking for a match in the update payload,
		 * if a match is found, then test the values using the appropriate operator,
		 * if values match, apply any mapped conditions
		 * @todo reduce this down to just mapped triggers at least
		 */
		for (let trigger of triggers) {
			const triggerType = trigger.triggerType || "simple";
			const pcOnly = trigger.pcOnly;
			const npcOnly = trigger.npcOnly;
			const notZero = trigger.notZero;

			if ((pcOnly && !hasPlayerOwner) || (npcOnly && hasPlayerOwner)) {
				continue;
			}

			let matchString1;
			let matchString2;

			if (triggerType === "simple") {
				const baseMatchString = `${entryPoint1}${entryPoint1 ? "." : ""}${trigger.category}${
					trigger.attribute ? `.${trigger.attribute}` : ""
				}`;
				// example : actor.system.attributes.hp.value or actor.data.status.isShaken
				matchString1 = `${baseMatchString}${trigger.property1 ? `.${trigger.property1}` : ""}`;

				// example: actor.system.hp.max -- note this is unlikely to be in the update data
				matchString2 = `${baseMatchString}${trigger.property2 ? `.${trigger.property2}` : ""}`;
			} else if (triggerType === "advanced") {
				// entry point differs based on actor vs token
				matchString1 = trigger?.advancedActorProperty;
				matchString2 = trigger?.advancedActorProperty2;
				trigger.value = trigger.advancedValue;
				trigger.operator = trigger.advancedOperator;
			}

			// If the update doesn't have a value that matches the 1st property this trigger should be skipped
			if (!foundry.utils.hasProperty(update, matchString1)) {
				continue;
			}

			// Get a value from the update that matches the 1st property in the trigger
			const updateValue = foundry.utils.getProperty(update, matchString1);

			// If the trigger is not allowed to run when value is zero, skip
			if (updateValue === 0 && notZero) {
				continue;
			}

			// Get a value from the entity that matches the 2nd property in the trigger (if any)
			const property2Value = foundry.utils.getProperty(entity, matchString2);

			// We need the type later
			const updateValueType = typeof updateValue;

			// example: "="
			const operator = Triggler.OPERATORS[trigger.operator];

			// percent requires whole different handling
			const isPercent = trigger.value.endsWith("%");

			// example: "50" -- check if the value can be converted to a number
			const triggerValue = isPercent
				? Number(trigger.value.replace("%", ""))
				: Sidekick.coerceType(trigger.value, updateValueType);

			const triggers = [];

			/**
			 * Switch on the operator checking it against the predefined operator choices
			 * If it matches, then compare the values using the operator
			 * @todo bulkify refactor this to add matched triggers to an array then execut the array at the end
			 */
			switch (operator) {
				case Triggler.OPERATORS.eq:
					if (isPercent) {
						// example: (50 / 100) = 0.5;
						const divisor = triggerValue / 100;
						// if property 1 update value = 50% of property 2 value
						if (updateValue === property2Value * divisor) {
							triggers.push({ trigger, entity });
						}
						break;
					}
					if (updateValue === triggerValue) {
						// execute the trigger's condition mappings
						triggers.push({ trigger, entity });
					}
					break;

				case Triggler.OPERATORS.gt:
					if (isPercent) {
						// example: (50 / 100) = 0.5;
						const divisor = triggerValue / 100;
						// if property 1 update value = 50% of property 2 value
						if (updateValue > property2Value * divisor) {
							triggers.push({ trigger, entity });
						}
						break;
					}
					if (updateValue > triggerValue) {
						triggers.push({ trigger, entity });
					}
					break;

				case Triggler.OPERATORS.gteq:
					if (isPercent) {
						// example: (50 / 100) = 0.5;
						const divisor = triggerValue / 100;
						// if property 1 update value = 50% of property 2 value
						if (updateValue >= property2Value * divisor) {
							triggers.push({ trigger, entity });
						}
						break;
					}
					if (updateValue >= triggerValue) {
						triggers.push({ trigger, entity });
					}
					break;

				case Triggler.OPERATORS.lt:
					if (isPercent) {
						// example: (50 / 100) = 0.5;
						const divisor = triggerValue / 100;
						// if property 1 update value = 50% of property 2 value
						if (updateValue < property2Value * divisor) {
							triggers.push({ trigger, entity });
						}
						break;
					}
					if (updateValue < triggerValue) {
						triggers.push({ trigger, entity });
					}
					break;

				case Triggler.OPERATORS.lteq:
					if (isPercent) {
						// example: (50 / 100) = 0.5;
						const divisor = triggerValue / 100;
						// if property 1 update value = 50% of property 2 value
						if (updateValue <= property2Value * divisor) {
							triggers.push({ trigger, entity });
						}
						break;
					}
					if (updateValue <= triggerValue) {
						triggers.push({ trigger, entity });
					}
					break;

				case Triggler.OPERATORS.ne:
					if (isPercent) {
						// example: (50 / 100) = 0.5;
						const divisor = triggerValue / 100;
						// if property 1 update value = 50% of property 2 value
						if (updateValue !== property2Value * divisor) {
							triggers.push({ trigger, entity });
						}
						break;
					}
					if (updateValue !== triggerValue) {
						triggers.push({ trigger, entity });
					}
					break;
			}

			for (const { trigger, entity } of triggers) {
				await Triggler._executeTrigger(trigger, entity);
			}
		}
	}
}

class TrigglerForm extends FormApplication {
	constructor(object, options = { parent: null }) {
		super(object, options);
		this.data = object || {};
		this.parent = options.parent || null;
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: "cub-triggler-form",
			title: "Triggler",
			template: "modules/condition-lab-triggler/templates/triggler-form.html",
			classes: ["sheet", "triggler-form"],
			width: 780,
			height: "auto",
			resizable: true,
			closeOnSubmit: false
		});
	}

	getData() {
		const id = this.data.id;
		const triggers = game.settings.get("condition-lab-triggler", "storedTriggers");

		if (this.noMerge) {
			this.noMerge = false;
		} else if (id && triggers) {
			const trigger = triggers.find((t) => t.id === id);
			foundry.utils.mergeObject(this.data, trigger);
		}

		const {
			triggerType = "simple",
			category = null,
			attribute = null,
			property1 = null,
			operator = null,
			value = null,
			property2 = null,
			advancedName = null,
			advancedActorProperty = null,
			advancedActorProperty2 = null,
			advancedTokenProperty = null,
			advancedTokenProperty2 = null,
			advancedOperator = null,
			advancedValue = null,
			pcOnly = null,
			npcOnly = null,
			notZero = null
		} = this.data || {};
		const isSimpleTrigger = triggerType === "simple";
		const isAdvancedTrigger = triggerType === "advanced";
		let actorModel = game.model.Actor ?? {};
		const isEmpty = Object.values(actorModel).every((obj) => Object.keys(obj).length === 0);
		let mergedModel = null;
		if (isEmpty) {
			actorModel = CONFIG.Actor.dataModels ?? {};
			mergedModel = Object.keys(actorModel)
				.reduce((obj, key) =>
					foundry.utils.mergeObject(obj, new CONFIG.Actor.documentClass({ name: "CLT Actor", type: key }).toObject().system), {});
		} else {
			mergedModel = Object.keys(actorModel)
				.reduce((accumulator, key) => foundry.utils.mergeObject(accumulator, actorModel[key]), {});
		}
		const arrayToObj = (arr) => {
			return arr.reduce((obj, key) => {
				obj[key] = key;
				return obj;
			}, {});
		};
		const categories = mergedModel ? arrayToObj(Object.keys(mergedModel).sort()) : {};
		const attributes = category ? arrayToObj(Object.keys(mergedModel[category])) : {};
		const properties = category && attribute ? arrayToObj(Object.keys(mergedModel[category][attribute])) : {};
		const operators = Triggler.OPERATORS;

		const triggerSelected = !!(id && triggers);

		if (!categories) {
			ui.notifications.warn("Simple Trigger not supported. Try Advanced Trigger");
			// return false;
		}

		return {
			id,
			triggerSelected,
			triggers,
			isSimpleTrigger,
			isAdvancedTrigger,
			category,
			categories,
			attribute,
			attributes,
			property1,
			properties,
			operator,
			operators,
			value,
			property2,
			advancedName,
			advancedActorProperty,
			advancedActorProperty2,
			advancedTokenProperty,
			advancedTokenProperty2,
			advancedOperator,
			advancedValue,
			pcOnly,
			npcOnly,
			notZero
		};
	}

	async _render(force, options) {
		await super._render(force, options);
		this._originalTop = this.element[0].style.top;
		if (this._reposition && !this._repositioned) {
			this._repositioned = true;

			const el = this.element[0];
			const scaledHeight = el.offsetHeight;
			const tarT = (window.innerHeight - scaledHeight) / 2;
			const maxT = Math.max(window.innerHeight - scaledHeight, 0);
			this.setPosition({ top: Math.clamp(tarT, 0, maxT) });
		}
	}

	activateListeners(html) {
		super.activateListeners(html);

		const triggerSelect = html.find("select[name='triggers']");
		const deleteTrigger = html.find("a.delete");

		// Simple
		const categorySelect = html.find("select[name='category']");
		const attributeSelect = html.find("select[name='attribute']");
		const property1Select = html.find("select[name='property1']");
		const operatorSelect = html.find("select[name='operator']");
		const valueInput = html.find("input[name='value']");
		const property2Select = html.find("select[name='property2']");

		// Simple/Advanced Toggle
		const triggerTypeRadio = html.find("input[name='triggerType']");

		// Advanced
		const advancedNameInput = html.find("input[name='advancedName']");
		const advancedActorPropertyInput = html.find("input[name='advancedActorProperty']");
		const advancedActorProperty2Input = html.find("input[name='advancedActorProperty2']");
		const advancedTokenPropertyInput = html.find("input[name='advancedTokenProperty']");
		const advancedTokenProperty2Input = html.find("input[name='advancedTokenProperty2']");
		const advancedOperatorSelect = html.find("select[name='advancedOperator']");
		const advancedValueInput = html.find("input[name='advancedValue']");

		// Options
		const pcOnlyCheckbox = html.find("input[name='pcOnly']");
		const npcsOnlyCheckbox = html.find("input[name='npcOnly']");
		const notZeroCheckbox = html.find("input[name='notZero']");
		const cancelButton = html.find("button[name='cancel']");

		this.noMerge = true;

		triggerSelect.on("change", (event) => {
			this.data = {};
			this.data.id = event.target.value;
			this.noMerge = false;
			this.render();
		});
		deleteTrigger.on("click", async (event) => {
			const triggers = game.settings.get("condition-lab-triggler", "storedTriggers");
			const triggerIndex = triggers.findIndex((t) => t.id === this.data.id);
			if (triggerIndex === undefined) {
				return;
			}
			const updatedTriggers = foundry.utils.duplicate(triggers);

			updatedTriggers.splice(triggerIndex, 1);

			await game.settings.set("condition-lab-triggler", "storedTriggers", updatedTriggers);
			this.data = {};
			this.render();
		});

		// Simple
		categorySelect.on("change", (event) => {
			this.data.category = event.target.value;
			this.data.attribute = null;
			this.data.property1 = null;
			this.data.property2 = null;
			this.data.operator = null;
			this.data.value = null;

			this.render();
		});
		attributeSelect.on("change", (event) => {
			this.data.attribute = event.target.value;
			this.data.property1 = null;
			this.data.property2 = null;
			this.data.operator = null;
			this.data.value = null;

			this.render();
		});
		property1Select.on("change", (event) => {
			this.data.property1 = event.target.value;
			this.render();
		});
		property2Select.on("change", (event) => {
			this.data.property2 = event.target.value;
			this.render();
		});
		operatorSelect.on("change", (event) => {
			this.data.operator = event.target.value;
			this.render();
		});
		valueInput.on("change", (event) => {
			this.data.value = event.target.value;
			this.render();
		});

		// Simple/Advanced Toggle
		triggerTypeRadio.on("change", (event) => {
			this.data.triggerType = event.currentTarget.value;
			if (event.currentTarget.value === "advanced"
				&& this._originalTop === this.element[0].style.top
				&& !this._reposition) {
				this._reposition = true;
			}
			this.render();
		});

		// Advanced
		advancedNameInput.on("change", (event) => {
			this.data.advancedName = event.target.value;
			this.render();
		});
		advancedActorPropertyInput.on("change", (event) => {
			this.data.advancedActorProperty = event.target.value;
			this.render();
		});
		advancedActorProperty2Input.on("change", (event) => {
			this.data.advancedActorProperty2 = event.target.value;
			this.render();
		});
		advancedTokenPropertyInput.on("change", (event) => {
			this.data.advancedTokenProperty = event.target.value;
			this.render();
		});
		advancedTokenProperty2Input.on("change", (event) => {
			this.data.advancedTokenProperty2 = event.target.value;
			this.render();
		});
		advancedOperatorSelect.on("change", (event) => {
			this.data.advancedOperator = event.target.value;
			this.render();
		});
		advancedValueInput.on("change", (event) => {
			this.data.advancedValue = event.target.value;
			this.render();
		});

		// Options
		pcOnlyCheckbox.on("click", (event) => {
			this.data.pcOnly = event.target.checked;
			this.render();
		});
		npcsOnlyCheckbox.on("click", (event) => {
			this.data.npcOnly = event.target.checked;
			this.render();
		});
		notZeroCheckbox.on("click", (event) => {
			this.data.notZero = event.target.checked;
			this.render();
		});

		cancelButton.on("click", (event) => {
			this.close();
		});
	}

	async _updateObject(event, formData) {
		if (!formData.category && !formData.advancedActorProperty && !formData.advancedTokenProperty) {
			return;
		}

		const triggerType = formData?.triggerType;

		if (triggerType === "advanced" && !formData.advancedName.length) {
			ui.notifications.warn(game.i18n.localize("CLT.TRIGGLER.App.AdvancedTrigger.Name.Warning"));
			return false;
		}

		const triggers = game.settings.get("condition-lab-triggler", "storedTriggers");
		const existingIds = triggers ? triggers.map((t) => t.id) : null;
		const text = triggerType === "simple" ? Triggler._constructString(formData) : formData.advancedName;

		if (!text) return false;

		const id = this.data.id;
		const newData = foundry.utils.duplicate(formData);
		delete newData.triggers;

		const updatedTriggers = foundry.utils.duplicate(triggers);
		const existingTrigger = triggers.find((t) => t.id === id);
		const isNew = existingTrigger ? triggerType === "simple" || existingTrigger.advancedName !== text : true;

		if (!isNew) {
			const updatedTrigger = foundry.utils.mergeObject(existingTrigger, newData);
			updatedTrigger.text = text;
			updatedTriggers[triggers.indexOf(existingTrigger)] = updatedTrigger;
			this.data = updatedTrigger;
		} else {
			const newTrigger = {
				id: Sidekick.createId(existingIds),
				...newData,
				text
			};
			updatedTriggers.push(newTrigger);
			this.data = newTrigger;
		}

		const setting = await game.settings.set("condition-lab-triggler", "storedTriggers", updatedTriggers);
		if (!setting) ui.notifications.info(game.i18n.localize("CLT.TRIGGLER.App.SaveSuccessful"));

		this.render();
	}

	/**
	 * Exports the current map to JSON
	 */
	_exportToJSON() {
		const triggers = foundry.utils.duplicate(game.settings.get("condition-lab-triggler", "storedTriggers"));
		const data = {
			system: game.system.id,
			triggers
		};

		// Trigger file save procedure
		const filename = `cub-${game.world.id}-triggers.json`;
		saveDataToFile(JSON.stringify(data, null, 2), "text/json", filename);
	}

	/**
	 * Initiates an import via a dialog
	 * Borrowed from foundry.js Entity class
	 */
	async _importFromJSONDialog() {
		new Dialog({
			title: game.i18n.localize("CLT.TRIGGLER.ImportTitle"),
			// TODO change
			content: await renderTemplate("modules/condition-lab-triggler/templates/import-conditions.html", {}),
			buttons: {
				import: {
					icon: '<i class="fas fa-file-import"></i>',
					label: game.i18n.localize("CLT.WORDS.Import"),
					callback: (html) => {
						this._processImport(html);
					}
				},
				no: {
					icon: '<i class="fas fa-times"></i>',
					label: game.i18n.localize("Cancel")
				}
			},
			default: "import"
		}).render(true);
	}

	/**
	 * Process a Condition Map Import
	 * @param {*} html
	 * @returns {*}
	 */
	async _processImport(html) {
		const form = html.find("form")[0];

		if (!form.data.files.length) {
			return ui.notifications.error(game.i18n.localize("CLT.ENHANCED_CONDITIONS.Lab.Import.NoFile"));
		}

		const jsonFile = await readTextFromFile(form.data.files[0]);
		const json = JSON.parse(jsonFile);
		const triggers = Triggler.triggersFromJson(json);

		if (!triggers || !triggers?.length) {
			return;
		}

		const originalTriggers = game.settings.get("condition-lab-triggler", "storedTriggers");
		await game.settings.set("condition-lab-triggler", "storedTriggers", originalTriggers.concat(triggers));
		this.render();
	}

	/** @override */
	_getHeaderButtons() {
		let buttons = super._getHeaderButtons();

		buttons.unshift(
			{
				label: game.i18n.localize("CLT.WORDS.Import"),
				class: "import",
				icon: "fas fa-file-import",
				onclick: async (ev) => {
					await this._importFromJSONDialog();
				}
			},
			{
				label: game.i18n.localize("CLT.WORDS.Export"),
				class: "export",
				icon: "fas fa-file-export",
				onclick: async (ev) => {
					this._exportToJSON();
				}
			}
		);

		return buttons;
	}
}

/**
 * Enhanced Condition Macro Config Application
 */
class EnhancedConditionMacroConfig extends FormApplication {
	constructor(object, options) {
		super(object, options);

		this.object = this.object ?? {};
		this.object.macros = this.object.macros ?? [];

		this.initialObject = foundry.utils.duplicate(this.object);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: "cub-enhanced-condition-macro-config",
			title: game.i18n.localize("CLT.ENHANCED_CONDITIONS.MacroConfig.Title"),
			template: "modules/condition-lab-triggler/templates/enhanced-condition-macro-config.hbs",
			classes: ["sheet"],
			closeOnSubmit: false
		});
	}

	getData() {
		const conditionMacros = this.object.macros;
		const applyMacroId = conditionMacros.find((m) => m.type === "apply")?.id;
		const removeMacroId = conditionMacros.find((m) => m.type === "remove")?.id;

		const macroChoices = game.macros?.contents
			?.map((m) => {
				return { id: m.id, name: m.name };
			})
			.sort((a, b) => a.name.localeCompare(b.name));

		return {
			condition: this.object,
			applyMacroId,
			removeMacroId,
			macroChoices
		};
	}

	async _updateObject(event, formData) {
		this.object.macros = [];

		for (const field in formData) {
			const type = field.split("-").slice(-1)
				.pop() ?? "";
			const tempMacro = { id: formData[field], type: type };
			this.object.macros.push(tempMacro);
		}

		const map = game.clt.conditions;
		const newMap = foundry.utils.duplicate(map);

		let conditionIndex = newMap.findIndex((c) => c.id === this.object.id);
		newMap[conditionIndex] = this.object;
		await game.settings.set("condition-lab-triggler", "activeConditionMap", newMap);
		this.close();
	}
}

/**
 * Enhanced Condition Trigger Config Application
 */
class EnhancedConditionOptionConfig extends FormApplication {
	constructor(object, options) {
		super(object, options);

		this.initialObject = foundry.utils.duplicate(this.object);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: "cub-enhanced-condition-option-config",
			title: game.i18n.localize("CLT.ENHANCED_CONDITIONS.OptionConfig.Title"),
			template: "modules/condition-lab-triggler/templates/enhanced-condition-option-config.hbs",
			classes: ["sheet"],
			closeOnSubmit: false,
			width: 500
		});
	}

	getData() {
		return {
			condition: this.object,
			optionData: this.object.options,
			specialStatus: CONFIG.specialStatusEffects
		};
	}

	activateListeners(html) {
		const checkboxes = html.find("input[type='checkbox']");

		// for (const checkbox of checkboxes) {
		checkboxes.on("change", (event) => this._onCheckboxChange(event));
		// }
	}

	/**
	 * Checkbox change event handler
	 * @param {*} event
	 * @returns {*}
	 */
	_onCheckboxChange(event) {
		if (!event.target?.checked) return;
		const targetName = event.target?.name;
		const propertyName = Sidekick.toCamelCase(targetName, "-");
		const specialStatusEffectsProps = Object.values({
			blinded: { optionProperty: "blindToken" },
			invisible: { optionProperty: "markInvisible" }
		}).map((k) => k.optionProperty);

		if (!propertyName || !specialStatusEffectsProps) return;

		if (specialStatusEffectsProps.includes(propertyName)) {
			event.detail = event.detail && event.detail instanceof Object ? event.detail : {};
			event.detail.statusName = targetName;
			event.detail.statusLabel = event.target.nextElementSibling?.innerText;
			event.detail.conditionId = this.object.id;
			return EnhancedConditionOptionConfig._onSpecialStatusEffectToggle(event);
		}
	}

	/**
	 * Special Status Effect toggle handler
	 * @param {*} event
	 * @returns {*}
	 */
	static async _onSpecialStatusEffectToggle(event) {
		// is another condition already using this special status effect?
		const existingCondition = game.clt.conditions.find((c) => {
			const optionValue = foundry.utils.getProperty(
				c,
				`options.${Sidekick.toCamelCase(event.detail.statusName, "-")}`
			);
			return c.id !== event.detail.conditionId && optionValue;
		});
		if (existingCondition) {
			event.preventDefault();
			// raise a dialog asking for override
			const title = game.i18n.localize("CLT.ENHANCED_CONDITIONS.OptionConfig.SpecialStatusEffectOverride.Title");
			const content = game.i18n.format(
				"CLT.ENHANCED_CONDITIONS.OptionConfig.SpecialStatusEffectOverride.Content",
				{
					existingCondition: existingCondition.name,
					statusEffect: event.detail.statusLabel ?? event.detail.statusName
				}
			);
			const yes = () => { };
			const no = () => {
				return (event.target.checked = false);
			};
			const defaultYes = false;
			return Dialog.confirm({ title, content, yes, no, defaultYes }, {});
		}

		return event;
	}

	async _updateObject(event, formData) {
		this.object.options = {};
		const specialStatusEffectMapping = game.settings.get("condition-lab-triggler",
			"specialStatusEffectMapping"
		);
		const map = game.clt.conditionLab.map;
		const newMap = foundry.utils.deepClone(map);
		let conditionIndex = newMap.findIndex((c) => c.id === this.object.id);

		for (const field in formData) {
			const value = formData[field];
			const propertyName = Sidekick.toCamelCase(field, "-");
			const specialStatusEffect = this.getSpecialStatusEffectByField(field);

			if (specialStatusEffect) {
				const existingMapping = foundry.utils.getProperty(specialStatusEffectMapping, specialStatusEffect);
				if (existingMapping === this.object.id && value === false) {
					this.setSpecialStatusEffectMapping(specialStatusEffect);
				} else if (existingMapping !== this.object.id && value === true) {
					this.setSpecialStatusEffectMapping(specialStatusEffect, this.object.id);
					if (existingMapping) {
						const existingId = existingMapping.replace("condition-lab-triggler.", "");
						const existingConditionIndex = newMap.findIndex((c) => c.id === existingId);
						if (existingConditionIndex !== -1) {
							const existingCondition = newMap[existingConditionIndex];
							const options = existingCondition?.options;
							options[propertyName] = false;
							newMap[existingConditionIndex] = existingCondition;
						}
					}
				}
			}

			this.object.options[propertyName] = value;
		}

		newMap[conditionIndex] = this.object;
		await game.clt.conditionLab._saveMapping(newMap);
		await this.close();
	}

	/**
	 * Get the enum for a special status effect based on the field name
	 * @param {string} field
	 * @returns {string | undefined} BLIND, INVISIBLE, or DEFEATED
	 */
	getSpecialStatusEffectByField(field) {
		switch (field) {
			case "blind-token":
				return "BLIND";

			case "mark-invisible":
				return "INVISIBLE";
		}
	}

	/**
	 * Sets the special status effect to the provided condition Id
	 * @param {string} effect	Either BLIND, INVISIBLE, or DEFEATED
	 * @param {string} conditionId
	 */
	setSpecialStatusEffectMapping(effect, conditionId = null) {
		if (!Object.prototype.hasOwnProperty.call(CONFIG.specialStatusEffects, effect)) return;

		CONFIG.specialStatusEffects[effect] = conditionId;
		game.settings.set("condition-lab-triggler",
			"specialStatusEffectMapping",
			CONFIG.specialStatusEffects
		);
	}
}

/**
 * Enhanced Condition Trigger Config Application
 */
class EnhancedConditionTriggerConfig extends FormApplication {
	constructor(object, options) {
		super(object, options);

		this.object = this.object ?? {};

		this.initialObject = foundry.utils.duplicate(this.object);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: "cub-enhanced-condition-trigger-config",
			title: game.i18n.localize("CLT.ENHANCED_CONDITIONS.TriggerConfig.Title"),
			template: "modules/condition-lab-triggler/templates/enhanced-condition-trigger-config.hbs",
			classes: ["sheet"],
			closeOnSubmit: false,
			width: 500
		});
	}

	getData() {
		return {
			condition: this.object,
			applyTriggerId: this.object.applyTrigger,
			removeTriggerId: this.object.removeTrigger,
			triggerChoices: game.settings.get("condition-lab-triggler", "storedTriggers") ?? []
		};
	}

	/**
	 * Update Object on Form Submission
	 * @param {*} event
	 * @param {*} formData
	 */
	async _updateObject(event, formData) {
		this.object.macros = [];

		for (const field in formData) {
			const type = field.split("-").slice(-1)
				.pop() ?? "";
			this.object[`${type}Trigger`] = formData[field];
		}

		const map = game.clt.conditions;
		const newMap = foundry.utils.duplicate(map);

		let conditionIndex = newMap.findIndex((c) => c.id === this.object.id);
		newMap[conditionIndex] = this.object;
		game.settings.set("condition-lab-triggler", "activeConditionMap", newMap);
		this.close();
	}
}

class EnhancedEffectConfig extends ActiveEffectConfig {
	get title() {
		const reference = this.document.name ? ` ${game.i18n.localize(this.document.name)}` : "";
		return `${game.i18n.localize(this.document.constructor.metadata.label)}${reference}`;
	}

	/** @override */
	async getData(options = {}) {
		const context = await DocumentSheet.prototype.getData.call(this, options);
		context.descriptionHTML = await TextEditor.enrichHTML(this.object.description, {
			async: true,
			secrets: this.object.isOwner
		});
		const legacyTransfer = CONFIG.ActiveEffect.legacyTransferral;
		const labels = {
			transfer: {
				name: game.i18n.localize(`EFFECT.Transfer${legacyTransfer ? "Legacy" : ""}`),
				hint: game.i18n.localize(`EFFECT.TransferHint${legacyTransfer ? "Legacy" : ""}`)
			}
		};
		const data = {
			labels,
			effect: this.object, // Backwards compatibility
			data: this.object,
			isActorEffect: true,
			isItemEffect: false,
			submitText: "EFFECT.Submit",
			modes: Object.entries(CONST.ACTIVE_EFFECT_MODES).reduce((obj, e) => {
				obj[e[1]] = game.i18n.localize(`EFFECT.MODE_${e[0]}`);
				return obj;
			}, {})
		};
		return foundry.utils.mergeObject(context, data);
	}

	/**
	 * Override default update object behaviour
	 * @param {*} event
	 * @param {*} formData
	 * @override
	 */
	async _processSubmitData(_event, form, data) {
		const conditionIdFlag = this.document.getFlag(
			"condition-lab-triggler", "conditionId"
		);
		if (!conditionIdFlag) return;

		// find the matching condition row
		const map = ui.clt?.conditionLab?.map;

		if (!map && !map.length) return;

		const conditionId = conditionIdFlag.replace("condition-lab-triggler.", "");
		const condition = map.find((c) => c.id === conditionId);

		if (!condition) return;

		// update the effect data

		condition.activeEffect = condition.activeEffect
			? foundry.utils.mergeObject(condition.activeEffect, data)
			: data;

		this.document.updateSource(data);
		if (this._state === 2) await this.render();
		if (ui.clt.conditionLab) {
			ui.clt.conditionLab.map = ui.clt.conditionLab.updatedMap;
			// ui.clt.conditionLab.unsaved = true;
			ui.clt.conditionLab.render();
		}
	}
}

/**
 * Form application for managing mapping of Conditions to Icons and JournalEntries
 */
class ConditionLab extends FormApplication {
	constructor(object, options = {}) {
		super(object, options);
		game.clt.conditionLab = this;
		this.data = (game.clt.conditionLab ? game.clt.conditionLab.data : object) ?? null;
		this.system = game.system.id;
		this.initialMapType = game.settings.get("condition-lab-triggler", "conditionMapType");
		this.mapType = null;
		this.initialMap = game.settings.get("condition-lab-triggler", "activeConditionMap");
		this.map = null;
		this.displayedMap = null;
		this.maps = game.settings.get("condition-lab-triggler", "defaultConditionMaps");
		this.filterValue = "";
		this.sortDirection = "";
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: "cub-condition-lab",
			title: game.i18n.localize("CLT.ENHANCED_CONDITIONS.Lab.Title"),
			template: "modules/condition-lab-triggler/templates/condition-lab.hbs",
			classes: ["sheet", "condition-lab-form"],
			width: 780,
			height: 680,
			resizable: true,
			closeOnSubmit: false,
			scrollY: ["ol.condition-lab"],
			dragDrop: [{ dropSelector: "div.text-entry.reference" }]
		});
	}

	/**
	 * Get updated map by combining existing in-memory map with current formdata
	 * @returns {object[]}
	 */
	get updatedMap() {
		const submitData = this._buildSubmitData();
		const mergedMap = this._processFormData(submitData);
		return EnhancedConditions._prepareMap(mergedMap);
	}

	/**
	 * Gets data for the template render
	 * @returns {object}
	 */
	async getData() {
		const sortDirection = this.sortDirection;
		const sortTitle = game.i18n.localize(
			`CLT.ENHANCED_CONDITIONS.ConditionLab.SortAnchorTitle.${sortDirection ? sortDirection : "unsorted"}`
		);
		const filterTitle = game.i18n.localize("CLT.ENHANCED_CONDITIONS.ConditionLab.FilterInputTitle");
		const filterValue = this.filterValue;

		game.settings.get("condition-lab-triggler", "defaultConditionMaps");
		// const mappedSystems = Object.keys(defaultMaps) || [];
		const mappedSystems = [];
		const mapTypeChoices = game.settings.settings.get("condition-lab-triggler.conditionMapType").choices;

		// If there's no default map for this system don't provide the "default" choice
		if (!mappedSystems.includes(game.system.id)) {
			if (this.initialMap.length) {
				mapTypeChoices.default = game.i18n.localize("CLT.SETTINGS.EnhancedConditions.MapType.Choices.inferred");
			} else {
				delete mapTypeChoices.default;
			}
		}

		this.mapType ||= this.initialMapType || "other";
		const conditionMap = (this.map ||= foundry.utils.duplicate(this.initialMap));
		const triggers = game.settings.get("condition-lab-triggler", "storedTriggers").map((t) => {
			return [t.id, t.text];
		});

		const isDefault = this.mapType === "default";
		const outputChatSetting = game.settings.get("condition-lab-triggler", "conditionsOutputToChat");
		const disableChatOutput = isDefault || !outputChatSetting;

		for (const condition of conditionMap) {
			condition.name = game.i18n.localize(condition.name ?? condition.label);
			condition.img ??= condition.icon;
			// Check if the row exists in the saved map
			const existingEntry = this.initialMap.find((e) => e.id === condition.id) ?? null;
			condition.isNew = !existingEntry;
			condition.isChanged = condition.isNew || this._hasEntryChanged(condition, existingEntry);

			// Set the Output to Chat checkbox
			condition.options = condition.options ?? {};
			condition.enrichedReference = condition.reference
				? await TextEditor.enrichHTML(`@UUID[${condition.reference}]`, { documents: true })
				: "";

			// Default all entries to show
			condition.hidden = condition.hidden ?? false;
		}

		// Pre-apply any filter value
		this.displayedMap = filterValue
			? this._filterMapByName(conditionMap, filterValue)
			: foundry.utils.duplicate(conditionMap);

		// Sort the displayed map based on the sort direction
		if (sortDirection) {
			this.displayedMap = this._sortMapByName(this.displayedMap, sortDirection);
		}

		const displayedMap = this.displayedMap;
		const conditionMapLength = displayedMap.length - 1;

		let unsavedMap = false;
		if (
			this.mapType !== this.initialMapType
			|| conditionMap?.length !== this.initialMap?.length
			|| conditionMap.some((c) => c.isNew || c.isChanged)
		) {
			unsavedMap = true;
		}

		// Prepare final data object for template
		const data = {
			sortTitle,
			sortDirection,
			filterTitle,
			filterValue,
			mapTypeChoices,
			mapType: this.mapType,
			conditionMap,
			displayedMap,
			conditionMapLength,
			triggers,
			isDefault,
			disableChatOutput,
			unsavedMap
		};

		this.data = data;
		return data;
	}

	/**
	 * Enriches submit data with existing map to ensure continuity
	 * @returns {object}
	 */
	_buildSubmitData() {
		const map = this.sortDirection ? this._sortMapByName(this.map) : this.map;
		const data =
			map?.reduce((acc, entry, index) => {
				acc[`id-${index}`] = entry.id;
				return acc;
			}, {}) ?? {};
		return this._getSubmitData(data);
	}

	/**
	 * Processes the Form Data and builds a usable Condition Map
	 * @param {object} formData
	 * @returns {object}
	 */
	_processFormData(formData) {
		let ids = [];
		let conditions = [];
		let icons = [];
		let references = [];
		let newMap = [];
		const rows = [];
		const existingMap = this.map ?? game.settings.get("condition-lab-triggler", "activeConditionMap");

		// need to tighten these up to check for the existence of digits after the word
		const conditionRegex = /condition/i;
		const idRegex = new RegExp(/^id/, "i");
		const iconRegex = /icon/i;
		const referenceRegex = /reference/i;
		const rowRegex = new RegExp(/\d+$/);

		// write it back to the relevant condition map
		// @todo: maybe switch to a switch
		for (let e in formData) {
			const rowMatch = e.match(rowRegex);
			const row = rowMatch ? rowMatch[0] : null;

			if (!row) {
				continue;
			}

			rows.push(row);

			if (e.match(idRegex)) {
				ids[row] = formData[e];
			} else if (e.match(conditionRegex)) {
				conditions[row] = formData[e];
			} else if (e.match(iconRegex)) {
				icons[row] = formData[e];
			} else if (e.match(referenceRegex)) {
				references[row] = formData[e];
			}
		}

		const uniqueRows = [...new Set(rows)];

		for (let i = 0; i < uniqueRows.length; i++) {
			const id = ids[i] ?? null;
			const name = conditions[i];
			const existingCondition = existingMap && id ? existingMap.find((c) => c.id === id) : null;
			const {
				activeEffect = null,
				applyTrigger = null,
				removeTrigger = null,
				macros = null,
				options = {}
			} = existingCondition || {};

			const condition = {
				id,
				name,
				img: icons[i],
				reference: references[i],
				applyTrigger,
				removeTrigger,
				activeEffect,
				macros,
				options
			};
			for (const [oldKey, newKey] of Object.entries({ label: "name", icon: "img" })) {
				const msg = `StatusEffectConfig#${oldKey} has been deprecated in favor of StatusEffectConfig#${newKey}`;
				Object.defineProperty(condition, oldKey, {
					get() {
						foundry.utils.logCompatibilityWarning(msg, { since: 12, until: 14, once: true });
						return this[newKey];
					},
					set(value) {
						foundry.utils.logCompatibilityWarning(msg, { since: 12, until: 14, once: true });
						this[newKey] = value;
					},
					enumerable: false,
					configurable: true
				});
			}

			newMap.push(condition);
		}

		return newMap;
	}

	/**
	 * Restore defaults for a mapping
	 * @param {object} options
	 * @param {boolean} options.clearCache
	 */
	async _restoreDefaults({ clearCache = false } = {}) {
		const system = this.system;
		let defaultMaps = game.settings.get("condition-lab-triggler", "defaultConditionMaps");

		if (clearCache) {
			defaultMaps = await EnhancedConditions._loadDefaultMaps();
			game.settings.set("condition-lab-triggler", "defaultConditionMaps", defaultMaps);
		}
		const tempMap = this.mapType !== "other" && defaultMaps && defaultMaps[system] ? defaultMaps[system] : [];

		// If the mapType is other then the map should be empty, otherwise it's the default map for the system
		this.map = tempMap;
		this.render(true);
	}

	/**
	 * Take the new map and write it back to settings, overwriting existing
	 * @param {object} event
	 * @param {object} formData
	 */
	async _updateObject(event, formData) {
		const showDialogSetting = game.settings.get("condition-lab-triggler", "showSortDirectionDialog");

		if (this.sortDirection && showDialogSetting) {
			await Dialog.confirm({
				title: game.i18n.localize("CLT.ENHANCED_CONDITIONS.ConditionLab.SortDirectionSave.Title"),
				content: game.i18n.localize("CLT.ENHANCED_CONDITIONS.ConditionLab.SortDirectionSave.Content"),
				yes: ($html) => {
					const checkbox = $html[0].querySelector("input[name='dont-show-again']");
					if (checkbox.checked) {
						game.settings.set("condition-lab-triggler", "showSortDirectionDialog", false);
					}
					this._processFormUpdate(formData);
				},
				no: () => { }
			});
		} else {
			this._processFormUpdate(formData);
		}
	}

	/**
	 * Process Condition Lab formdata and then save changes
	 * @param {*} formData
	 */
	async _processFormUpdate(formData) {
		const mapType = formData["map-type"];
		let newMap = this.updatedMap;

		if (mapType === "default") {
			const defaultMap = EnhancedConditions.getDefaultMap(this.system);
			newMap = foundry.utils.mergeObject(newMap, defaultMap);
		}

		this._saveMapping(newMap, mapType);
	}

	/**
	 * Saves a given map and option map type to storage
	 * @param {*} newMap
	 * @param {*} mapType
	 */
	async _saveMapping(newMap, mapType = this.mapType) {
		this.mapType = this.initialMapType = mapType;
		const preparedMap = EnhancedConditions._prepareMap(newMap);

		await game.settings.set("condition-lab-triggler", "conditionMapType", mapType);
		await game.settings.set("condition-lab-triggler", "activeConditionMap", preparedMap);

		this._finaliseSave(preparedMap);
	}

	/**
	 * Performs final steps after saving mapping
	 * @param {*} preparedMap
	 */
	async _finaliseSave(preparedMap) {
		this.map = this.initialMap = preparedMap;
		this.unsaved = false;
		this.sortDirection = "";

		ui.notifications.info(game.i18n.localize("CLT.ENHANCED_CONDITIONS.Lab.SaveSuccess"));
		this.render(true);
	}

	/**
	 * Exports the current map to JSON
	 */
	_exportToJSON() {
		const map = foundry.utils.duplicate(this.map);
		const data = {
			system: game.system.id,
			map
		};

		// Trigger file save procedure
		const filename = `cub-${game.system.id}-condition-map.json`;
		saveDataToFile(JSON.stringify(data, null, 2), "text/json", filename);
	}

	/**
	 * Initiates an import via a dialog
	 * Borrowed from foundry.js Entity class
	 */
	async _importFromJSONDialog() {
		new Dialog({
			title: game.i18n.localize("CLT.ENHANCED_CONDITIONS.Lab.ImportTitle"),
			content: await renderTemplate("modules/condition-lab-triggler/templates/import-conditions.html", {}),
			buttons: {
				import: {
					icon: '<i class="fas fa-file-import"></i>',
					label: game.i18n.localize("CLT.WORDS.Import"),
					callback: (html) => {
						this._processImport(html);
					}
				},
				no: {
					icon: '<i class="fas fa-times"></i>',
					label: game.i18n.localize("Cancel")
				}
			},
			default: "import"
		}).render(true);
	}

	/**
	 * Process a Condition Map Import
	 * @param {*} html
	 * @returns {*}
	 */
	async _processImport(html) {
		const form = html.find("form")[0];

		if (!form.data.files.length) {
			return ui.notifications.error(game.i18n.localize("CLT.ENHANCED_CONDITIONS.Lab.Import.NoFile"));
		}

		const jsonFile = await readTextFromFile(form.data.files[0]);
		const json = JSON.parse(jsonFile);
		const map = EnhancedConditions.mapFromJson(json);

		if (!map || !map?.length) {
			return;
		}

		this.mapType = "other";
		this.map = map;
		this.render();
	}

	/** @override */
	_getHeaderButtons() {
		let buttons = super._getHeaderButtons();

		buttons.unshift(
			{
				label: game.i18n.localize("CLT.WORDS.Import"),
				class: "import",
				icon: "fas fa-file-import",
				onclick: async (ev) => {
					this._importFromJSONDialog();
				}
			},
			{
				label: game.i18n.localize("CLT.WORDS.Export"),
				class: "export",
				icon: "fas fa-file-export",
				onclick: async (ev) => {
					this._exportToJSON();
				}
			}
		);

		return buttons;
	}

	/* -------------------------------------------- */
	/*                 Hook Handlers                */
	/* -------------------------------------------- */

	/**
	 * Condition Lab Render handler
	 * @param {*} app
	 * @param {*} html
	 * @param {*} data
	 */
	static _onRender(app, html, data) {
		ui.clt.conditionLab = app;
	}

	/**
	 * Render save dialog hook handler
	 * @param {*} app
	 * @param {jQuery} html
	 * @param {*} data
	 */
	static _onRenderSaveDialog(app, html, data) {
		const contentDiv = html[0].querySelector("div.dialog-content");
		const checkbox = `<div class="form-group"><label class="dont-show-again-checkbox">${game.i18n.localize(
			"CLT.ENHANCED_CONDITIONS.ConditionLab.SortDirectionSave.CheckboxText"
		)}<input type="checkbox" name="dont-show-again"></label></div>`;
		contentDiv.insertAdjacentHTML("beforeend", checkbox);
		app.setPosition({ height: app.position.height + 32 });
	}

	/**
	 * Render restore defaults hook handler
	 * @param {*} app
	 * @param {*} html
	 * @param {*} data
	 */
	static _onRenderRestoreDefaultsDialog(app, html, data) {
		if (game.clt.conditionLab.mapType !== "default") return;

		const contentDiv = html[0].querySelector("div.dialog-content");
		const checkbox = `<div class="form-group">
		<label>${game.i18n.localize("CLT.ENHANCED_CONDITIONS.ConditionLab.RestoreDefaultClearCache.CheckboxText")}</label>
		<input type="checkbox" name="clear-cache">
		</div>`;
		contentDiv.insertAdjacentHTML("beforeend", checkbox);
		app.setPosition({ height: app.position.height + 32 });
	}

	/* -------------------------------------------- */
	/*                Event Handlers                */
	/* -------------------------------------------- */

	/** @override */
	activateListeners(html) {
		const inputs = html.find("input");
		const mapTypeSelector = html.find("select[class='map-type']");
		const activeEffectButton = html.find("button.active-effect-config");
		const triggerAnchor = html.find("a[class='trigger']");
		const addRowAnchor = html.find("a[name='add-row']");
		const removeRowAnchor = html.find("a[class='remove-row']");
		const changeOrderAnchor = html.find(".row-controls a.move-up, .row-controls a.move-down");
		const restoreDefaultsButton = html.find("button[class='restore-defaults']");
		const resetFormButton = html.find("button[name='reset']");
		const filterInput = html.find("input[name='filter-list']");
		const sortButton = html.find("a.sort-list");
		const macroConfigButton = html.find("button.macro-config");
		const triggerConfigButton = html.find("button.trigger-config");
		const optionConfigButton = html.find("button.option-config");

		inputs.on("change", (event) => this._onChangeInputs(event));
		mapTypeSelector.on("change", (event) => this._onChangeMapType(event));
		activeEffectButton.on("click", (event) => this._onClickActiveEffectConfig(event));
		triggerAnchor.on("click", (event) => this._onOpenTrigglerForm(event));
		addRowAnchor.on("click", async (event) => this._onAddRow(event));
		removeRowAnchor.on("click", async (event) => this._onRemoveRow(event));
		changeOrderAnchor.on("click", (event) => this._onChangeSortOrder(event));
		restoreDefaultsButton.on("click", async (event) => this._onRestoreDefaults(event));
		resetFormButton.on("click", (event) => this._onResetForm(event));
		filterInput.on("input", (event) => this._onChangeFilter(event));
		sortButton.on("click", (event) => this._onClickSortButton(event));
		macroConfigButton.on("click", (event) => this._onClickMacroConfig(event));
		triggerConfigButton.on("click", (event) => this._onClickTriggerConfig(event));
		optionConfigButton.on("click", (event) => this._onClickOptionConfig(event));

		super.activateListeners(html);
	}

	/** @override */
	_activateCoreListeners(html) {
		super._activateCoreListeners(html);
		if (this.isEditable) html.find("img[data-edit]").on("click", this._onEditImage.bind(this));
	}

	/**
	 * Input change handler
	 * @param {*} event
	 * @returns {Application.render}
	 */
	async _onChangeInputs(event) {
		const name = event.target.name;
		if (name.startsWith("filter-list")) return;
		this.map = this.updatedMap;
		if (!this.map.length) return;
		if (name.startsWith("reference")) this._onChangeReferenceId(event);
		if (this._hasMapChanged()) return this.render();
	}

	/**
	 * Filter input change handler
	 * @param {*} event
	 */
	_onChangeFilter(event) {
		const input = event.target;
		const inputValue = input?.value;
		this.filterValue = inputValue ?? "";
		this.displayedMap = this._filterMapByName(this.map, this.filterValue);

		this.displayedRowIds = this.displayedMap.filter((r) => !r.hidden).map((r) => r.id);

		const conditionRowEls = this._element[0].querySelectorAll("li.row");
		for (const el of conditionRowEls) {
			const conditionId = el.dataset.conditionId;
			if (this.displayedRowIds.includes(conditionId)) {
				el.classList.remove("hidden");
			} else {
				el.classList.add("hidden");
			}
		}
	}

	/**
	 * Filter the given map by the name property using the supplied filter value, marking filtered entries as "hidden"
	 * @param {Array} map
	 * @param {string} filter
	 * @returns {object[]} filteredMap
	 */
	_filterMapByName(map, filter) {
		return map.map((c) => ({ ...c, hidden: !c.name.toLowerCase().includes(filter.toLowerCase()) }));
	}

	/**
	 * Change Map Type event handler
	 * @param {*} event
	 */
	async _onChangeMapType(event) {
		event.preventDefault();
		const selection = $(event.target).find("option:selected");
		const newType = (this.mapType = selection.val());

		switch (newType) {
			case "default":
			case "custom": {
				const defaultMap = EnhancedConditions.getDefaultMap(this.system);
				this.map = defaultMap?.length ? EnhancedConditions._prepareMap(defaultMap) : [];
				break;
			}

			case "other": {
				this.map = this.initialMapType === "other" ? this.initialMap : [];
				break;
			}
		}

		this.data = null;
		this.render();
	}

	/**
	 * Handle click Active Effect Config button
	 * @param {*} event
	 */
	async _onClickActiveEffectConfig(event) {
		const li = event.currentTarget.closest("li");
		const conditionId = li ? li.dataset.conditionId : null;

		if (!conditionId) return;

		const conditions = this.map ?? game.settings.get("condition-lab-triggler", "activeConditionMap");
		const condition = conditions.length ? conditions.find((c) => c.id === conditionId) : null;

		if (!condition) return;

		const conditionEffect = condition.activeEffect ?? EnhancedConditions.getActiveEffects(condition)[0];

		if (!conditionEffect) return;

		if (!foundry.utils.hasProperty(conditionEffect, "flags.condition-lab-triggler.conditionId")) {
			setProperty(
				conditionEffect,
				"flags.condition-lab-triggler.conditionId",
				conditionId
			);
		}

		// Build a fake effect object for the ActiveEffectConfig sheet
		// @todo #544 make Conditions an ActiveEffect extension?
		delete conditionEffect.id;
		if (!conditionEffect.name) {
			conditionEffect.name = condition.name;
		}
		const effect = new ActiveEffect(conditionEffect, {
			// Build a dummy parent so dialog can be rendered.
			parent: new Item({ name: "Global", type: "base" })
		});
		effect.testUserPermission = (...args) => {
			return true;
		};

		new EnhancedEffectConfig(effect).render(true);
	}

	/**
	 * Reference Link change handler
	 * @param {*} event
	 */
	async _onChangeReferenceId(event) {
		event.preventDefault();
		const input = event.currentTarget ?? event.target;
		input.nextElementSibling.innerHTML = await TextEditor.enrichHTML(input.value, { documents: true });
	}

	/**
	 * Open Triggler form event handler
	 * @param {*} event
	 */
	_onOpenTrigglerForm(event) {
		event.preventDefault();
		const anchor = event.currentTarget;
		const select = anchor.parentElement.nextElementSibling;
		const id = select.value;
		const conditionLabRow = select.name.match(/\d+$/)[0];

		const data = {
			id,
			conditionLabRow
		};

		new TrigglerForm(data, { parent: this }).render(true);
	}

	/**
	 * Add Row event handler
	 * @param {*} event
	 */
	_onAddRow(event) {
		event.preventDefault();

		const existingNewConditions = this.map.filter((m) => m.name.match(/^New Condition \d+$/));
		const newConditionIndex = existingNewConditions.length
			? Math.max(...existingNewConditions.map((m) => Number(m.name.match(/\d+$/g)[0]))) + 1
			: 1;
		const newConditionName = `New Condition ${newConditionIndex}`;
		const fdMap = this.updatedMap;

		if (this.mapType === "default") {
			const defaultMap = EnhancedConditions.getDefaultMap(this.system);
			this.map = foundry.utils.mergeObject(fdMap, defaultMap);
		} else {
			this.map = fdMap;
		}

		const newMap = foundry.utils.duplicate(this.map);
		const exisitingIds = this.map.filter((c) => c.id).map((c) => c.id);
		const outputChatSetting = game.settings.get("condition-lab-triggler", "conditionsOutputToChat");

		newMap.push({
			id: Sidekick.createId(exisitingIds),
			name: newConditionName,
			img: "icons/svg/d20-black.svg",
			reference: "",
			trigger: "",
			options: {
				outputChat: outputChatSetting
			}
		});

		const newMapType = this.mapType === "default" ? "custom" : this.mapType;

		this.mapType = newMapType;
		this.map = newMap;
		this.data = null;

		this.render();
	}

	/**
	 * Handler for remove row event
	 * @param {*} event
	 */
	_onRemoveRow(event) {
		event.preventDefault();

		this.map = this.updatedMap;

		const row = event.currentTarget.name.match(/\d+$/)[0];

		const dialog = new Dialog({
			title: game.i18n.localize("CLT.ENHANCED_CONDITIONS.Lab.ConfirmDeleteTitle"),
			content: game.i18n.localize("CLT.ENHANCED_CONDITIONS.Lab.ConfirmDeleteContent"),
			buttons: {
				yes: {
					icon: '<i class="fa fa-check"></i>',
					label: game.i18n.localize("Yes"),
					callback: async (event) => {
						const newMap = foundry.utils.duplicate(this.map);
						newMap.splice(row, 1);
						this.map = newMap;
						this.render();
					}
				},
				no: {
					icon: '<i class="fa fa-times"></i>',
					label: game.i18n.localize("No"),
					callback: (event) => { }
				}
			},
			default: "no"
		});

		dialog.render(true);
	}

	/**
	 * Handle a change sort order click
	 * @param {*} event
	 */
	_onChangeSortOrder(event) {
		event.preventDefault();

		const anchor = event.currentTarget;
		const liRow = anchor?.closest("li");
		const rowNumber = parseInt(liRow?.dataset.mappingRow);
		const type = anchor?.className;
		const newMap = foundry.utils.deepClone(this.map);
		const mappingRow = newMap?.splice(rowNumber, 1) ?? [];
		let newIndex = -1;

		switch (type) {
			case "move-up":
				newIndex = rowNumber - 1;
				break;

			case "move-down":
				newIndex = rowNumber + 1;
				break;
		}

		if (newIndex <= -1) return;

		newMap.splice(newIndex, 0, ...mappingRow);
		this.map = newMap;
		this.render();
	}

	/**
	 * Sort button handler
	 * @param {*} event
	 * @returns {Application}                 The rendered Application instance
	 */
	_onClickSortButton(event) {
		const sortDirection = this.sortDirection;
		// const newSortDirection = sortDirection === "asc" ? "desc" : "asc";
		switch (sortDirection) {
			case "":
				this.sortDirection = "asc";
				break;

			case "asc":
				this.sortDirection = "desc";
				break;

			case "desc":
				this.sortDirection = "";
				break;
		}

		return this.render();
	}

	/**
	 * Sorts the given map by the name property
	 * @param {Array} map
	 * @param {*} direction
	 * @returns {Array}
	 */
	_sortMapByName(map, direction) {
		return map.sort((a, b) => {
			if (direction === "desc") return b.name.localeCompare(a.name);
			return a.name.localeCompare(b.name);
		});
	}

	/**
	 * Opens dialog to reset to default values.
	 * @param {*} event
	 */
	_onRestoreDefaults(event) {
		event.preventDefault();
		const content = game.i18n.localize("CLT.ENHANCED_CONDITIONS.Lab.RestoreDefaultsContent");

		const confirmationDialog = new Dialog({
			title: game.i18n.localize("CLT.ENHANCED_CONDITIONS.Lab.RestoreDefaultsTitle"),
			content,
			buttons: {
				yes: {
					icon: '<i class="fas fa-check"></i>',
					label: game.i18n.localize("Yes"),
					callback: ($html) => {
						const checkbox = $html[0].querySelector("input[name='clear-cache']");
						const clearCache = checkbox?.checked;
						this._restoreDefaults({ clearCache });
					}
				},
				no: {
					icon: '<i class="fas fa-times"></i>',
					label: game.i18n.localize("No"),
					callback: () => { }
				}
			},
			default: "no",
			close: () => { }
		});

		confirmationDialog.render(true);
	}

	/**
	 * Reset form handler
	 * @param {*} event
	 */
	_onResetForm(event) {
		const dialog = new Dialog({
			title: game.i18n.localize("CLT.ENHANCED_CONDITIONS.Lab.ResetFormTitle"),
			content: game.i18n.localize("CLT.ENHANCED_CONDITIONS.Lab.ResetFormContent"),
			buttons: {
				yes: {
					icon: '<i class="fa fa-check"></i>',
					label: game.i18n.localize("Yes"),
					callback: (event) => {
						this.map = this.initialMap;
						this.render();
					}
				},
				no: {
					icon: '<i class="fa fa-times"></i>',
					label: game.i18n.localize("No"),
					callback: (event) => { }
				}
			},
			default: "no"
		});
		dialog.render(true);
	}

	async _onDrop(event) {
		event.preventDefault();
		const eventData = TextEditor.getDragEventData(event);
		const link = await TextEditor.getContentLink(eventData);
		if (link) {
			const targetInput = event.currentTarget.querySelector("input");
			targetInput.value = eventData.uuid;
			return targetInput.dispatchEvent(new Event("change"));
		}
		return ui.notifications.error(game.i18n.localize("CLT.ENHANCED_CONDITIONS.ConditionLab.BadReference"));
	}

	/**
	 * Macro Config button click handler
	 * @param {*} event
	 */
	_onClickMacroConfig(event) {
		const rowLi = event.target.closest("li");
		const conditionId = rowLi ? rowLi.dataset.conditionId : null;

		if (!conditionId) return;

		const condition = this.map.find((c) => c.id === conditionId);

		new EnhancedConditionMacroConfig(condition).render(true);
	}

	/**
	 * Trigger Config button click handler
	 * @param {*} event
	 */
	_onClickTriggerConfig(event) {
		const rowLi = event.target.closest("li");
		const conditionId = rowLi ? rowLi.dataset.conditionId : null;

		if (!conditionId) return;

		const condition = this.map.find((c) => c.id === conditionId);

		new EnhancedConditionTriggerConfig(condition).render(true);
	}

	/**
	 * Option Config button click handler
	 * @param {*} event
	 */
	_onClickOptionConfig(event) {
		const rowLi = event.target.closest("li");
		const conditionId = rowLi ? rowLi.dataset.conditionId : null;

		if (!conditionId) return;

		const condition = this.map.find((c) => c.id === conditionId);

		const config = new EnhancedConditionOptionConfig(condition);
		config.parent = this;
		config.render(true);
	}

	// Checks the updatedMap property against the initial map
	_hasMapChanged() {
		let hasChanged = false;
		const conditionMap = this.updatedMap;

		conditionMap.forEach((entry, index, array) => {
			// Check if the row exists in the saved map
			const existingEntry = this.initialMap.find((e) => e.id === entry.id) ?? null;
			entry.isNew = !existingEntry;

			// If row is new or if its index has changed, it is also changed
			entry.isChanged = entry.isNew || index !== this.initialMap?.indexOf(existingEntry);

			// If it's not changed, check if the compared entries are equal
			if (!entry.isChanged) {
				entry.isChanged = !foundry.utils.isEmpty(foundry.utils.diffObject(existingEntry, entry));
				hasChanged ||= entry.isChanged;
			}
		});

		return hasChanged;
	}

	_hasEntryChanged(entry, existingEntry) {
		const propsToCheck = [
			"name",
			"img",
			"options",
			"reference",
			"applyTrigger",
			"removeTrigger",
			"activeEffect"
		];
		return propsToCheck.some((p) => this._hasPropertyChanged(p, existingEntry, entry));
	}

	/**
	 * Checks a given propertyName on an original and comparison object to see if it has changed
	 * @param {*} propertyName
	 * @param {*} original
	 * @param {*} comparison
	 * @returns {boolean}
	 */
	_hasPropertyChanged(propertyName, original, comparison) {
		const originalValue = original?.[propertyName];
		const comparisonValue = comparison?.[propertyName];
		return (originalValue && !comparisonValue)
			|| (original && JSON.stringify(originalValue) !== JSON.stringify(comparisonValue));
	}

	_onEditImage(event) {
		const current = event.target.getAttribute("src");
		const fp = new FilePicker({
			current,
			type: "image",
			callback: (path) => {
				event.currentTarget.src = path;
				const iconPath = event.target.closest(".content1").querySelector(".icon-path");
				iconPath.value = path;
				this.map = this.updatedMap;
				if (this._hasMapChanged()) this.render();
			},
			top: this.position.top + 40,
			left: this.position.left + 10
		});
		return fp.browse();
	}
}

/**
 * Registers the module's settings.
 */
function registerSettings() {
	/* -------------------------------------------- */
	/*            Setting Configuration             */
	/* -------------------------------------------- */

	game.settings.register("condition-lab-triggler", "conditionsOutputToChat", {
		name: "CLT.SETTINGS.EnhancedConditions.OutputChatN",
		hint: "CLT.SETTINGS.EnhancedConditions.OutputChatH",
		scope: "world",
		type: Boolean,
		config: true,
		default: false,
		onChange: (s) => {
			if (s === true) {
				Dialog.confirm({
					title: game.i18n.localize("CLT.ENHANCED_CONDITIONS.OutputChatConfirm.Title"),
					content: game.i18n.localize("CLT.ENHANCED_CONDITIONS.OutputChatConfirm.Content"),
					yes: () => {
						const newMap = foundry.utils.deepClone(game.clt.conditions);
						if (!newMap.length) return;
						newMap.forEach((c) => (c.options.outputChat = true));
						game.settings.set("condition-lab-triggler", "activeConditionMap", newMap);
					},
					no: () => { }
				});
			}
		}
	});

	game.settings.register("condition-lab-triggler", "conditionsOutputDuringCombat", {
		name: "CLT.SETTINGS.EnhancedConditions.OutputCombatN",
		hint: "CLT.SETTINGS.EnhancedConditions.OutputCombatH",
		scope: "world",
		type: Boolean,
		config: true,
		default: false
	});

	game.settings.register("condition-lab-triggler", "removeDefaultEffects", {
		name: "CLT.SETTINGS.EnhancedConditions.RemoveDefaultEffectsN",
		hint: "CLT.SETTINGS.EnhancedConditions.RemoveDefaultEffectsH",
		scope: "world",
		type: Boolean,
		config: true,
		default: false,
		onChange: () => {
			EnhancedConditions._updateStatusEffects();
		}
	});

	game.settings.register("condition-lab-triggler", "defaultConditionsOutputToChat", {
		name: "CLT.SETTINGS.EnhancedConditions.DefaultOutputChatN",
		hint: "CLT.SETTINGS.EnhancedConditions.DefaultOutputChatH",
		scope: "world",
		type: Boolean,
		config: true,
		default: false
	});

	game.settings.register("condition-lab-triggler", "enhancedConditionsMigrationVersion", {
		name: "CLT.SETTINGS.EnhancedConditions.MigrationVersionN",
		hint: "CLT.SETTINGS.EnhancedConditions.MigrationVersionH",
		scope: "world",
		type: String,
		config: false,
		apiOnly: true,
		default: ""
	});

	game.settings.register("condition-lab-triggler", "showSortDirectionDialog", {
		name: "CLT.SETTINGS.EnhancedConditions.ShowSortDirectionDialogN",
		hint: "CLT.SETTINGS.EnhancedConditions.ShowSortDirectionDialogH",
		scope: "world",
		type: Boolean,
		config: true,
		default: true
	});

	game.settings.register("condition-lab-triggler", "defaultSpecialStatusEffects", {
		name: "CLT.SETTINGS.EnhancedConditions.DefaultSpecialStatusEffectsN",
		hint: "CLT.SETTINGS.EnhancedConditions.DefaultSpecialStatusEffectsH",
		scope: "world",
		type: Object,
		default: CONFIG.specialStatusEffects,
		config: false
	});

	game.settings.register("condition-lab-triggler", "specialStatusEffectMapping", {
		name: "CLT.SETTINGS.EnhancedConditions.SpecialStatusEffectMappingN",
		hint: "CLT.SETTINGS.EnhancedConditions.SpecialStatusEffectMappingH",
		scope: "world",
		type: Object,
		default: {},
		config: false
	});

	/* -------------------------------------------- */
	/*              EnhancedConditions              */
	/* -------------------------------------------- */

	game.settings.registerMenu("condition-lab-triggler", "enchantedConditionsMenu", {
		name: "CLT.ENHANCED_CONDITIONS.Lab.Title",
		label: "CLT.ENHANCED_CONDITIONS.Lab.Title",
		hint: "CLT.ENHANCED_CONDITIONS.Lab.Hint",
		icon: "fas fa-flask",
		type: ConditionLab,
		restricted: true
	});

	game.settings.register("condition-lab-triggler", "coreStatusIcons", {
		name: "CLT.SETTINGS.EnhancedConditions.CoreIconsN",
		hint: "CLT.SETTINGS.EnhancedConditions.CoreIconsH",
		scope: "world",
		type: Object,
		default: [],
		config: false
	});

	game.settings.register("condition-lab-triggler", "conditionMapType", {
		name: "CLT.SETTINGS.EnhancedConditions.MapTypeN",
		hint: "CLT.SETTINGS.EnhancedConditions.MapTypeH",
		scope: "world",
		type: String,
		default: "",
		choices: {
			default: "CLT.SETTINGS.EnhancedConditions.MapType.Choices.default",
			custom: "CLT.SETTINGS.EnhancedConditions.MapType.Choices.custom",
			other: "CLT.SETTINGS.EnhancedConditions.MapType.Choices.other"
		},
		config: false,
		apiOnly: true
	});

	game.settings.register("condition-lab-triggler", "defaultConditionMaps", {
		name: "CLT.SETTINGS.EnhancedConditions.DefaultMapsN",
		hint: "CLT.SETTINGS.EnhancedConditions.DefaultMapsH",
		scope: "world",
		type: Object,
		default: {}
	});

	game.settings.register("condition-lab-triggler", "activeConditionMap", {
		name: "CLT.SETTINGS.EnhancedConditions.ActiveConditionMapN",
		hint: "CLT.SETTINGS.EnhancedConditions.ActiveConditionMapH",
		scope: "world",
		type: Object,
		default: [],
		onChange: (conditionMap) => {
			EnhancedConditions._updateStatusEffects(conditionMap);

			// Save the active condition map to a convenience property
			if (game.clt) game.clt.conditions = conditionMap;
		}
	});

	/* -------------------------------------------- */
	/*                 TokenUtility                 */
	/* -------------------------------------------- */

	if (!game.modules.get("status-halo")?.active && !game.modules.get("illandril-token-hud-scale")?.active) {
		game.settings.register("condition-lab-triggler", "effectSize", {
			name: "CLT.SETTINGS.TokenUtility.TokenEffectSizeN",
			hint: "CLT.SETTINGS.TokenUtility.TokenEffectSizeH",
			default: "small",
			scope: "client",
			type: String,
			choices: {
				small: "CLT.SETTINGS.TokenUtility.TokenEffectSize.choices.small",
				medium: "CLT.SETTINGS.TokenUtility.TokenEffectSize.choices.medium",
				large: "CLT.SETTINGS.TokenUtility.TokenEffectSize.choices.large",
				xLarge: "CLT.SETTINGS.TokenUtility.TokenEffectSize.choices.xLarge"
			},
			config: true,
			onChange: () => {
				canvas.draw();
			}
		});
	}

	/* -------------------------------------------- */
	/*                    Triggler                  */
	/* -------------------------------------------- */

	game.settings.registerMenu("condition-lab-triggler", "trigglerMenu", {
		name: "CLT.SETTINGS.Triggler.TriggersN",
		label: "CLT.SETTINGS.Triggler.TriggersN",
		hint: "CLT.SETTINGS.Triggler.TriggersH",
		icon: "fas fa-exclamation",
		type: TrigglerForm,
		restricted: true
	});

	game.settings.register("condition-lab-triggler", "storedTriggers", {
		name: "CLT.SETTINGS.Triggler.TriggersN",
		hint: "CLT.SETTINGS.Triggler.TriggersH",
		scope: "world",
		type: Object,
		default: [],
		onChange: () => { }
	});

	game.settings.register("condition-lab-triggler", "hasRunMigration", {
		scope: "world",
		type: Boolean,
		default: false
	});

	/* -------------------------------------------- */

	game.settings.register("condition-lab-triggler", "sceneControls", {
		name: "CLT.SETTINGS.SceneControls.Name",
		hint: "CLT.SETTINGS.SceneControls.Hint",
		scope: "world",
		type: Boolean,
		default: false,
		config: true,
		requiresReload: true
	});
}

/* -------------------------------------------- */

/* -------------------------------------------- */
/*                    System                    */
/* -------------------------------------------- */

/* ------------------- Init ------------------- */

Hooks.on("i18nInit", () => {
	registerSettings();

	// Assign the namespace Object if it already exists or instantiate it as an object if not
	game.clt = EnhancedConditions;
	ui.clt = {};

	// Execute housekeeping
	Sidekick.loadTemplates();

	// Keybinds
	game.keybindings.register("condition-lab-triggler", "openConditionLab", {
		name: "CLT.KEYBINDINGS.openConditionLab.name",
		onDown: () => {
			new ConditionLab().render(true);
		},
		restricted: true,
		precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
	});
	game.keybindings.register("condition-lab-triggler", "openTriggler", {
		name: "CLT.KEYBINDINGS.openTriggler.name",
		onDown: () => {
			new TrigglerForm().render(true);
		},
		restricted: true,
		precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
	});

	// Wrappers
	if (!game.modules.get("status-halo")?.active && !game.modules.get("illandril-token-hud-scale")?.active) {
		const effectSizes = {
			xLarge: {
				multiplier: 5,
				divisor: 2
			},
			large: {
				multiplier: 3.3,
				divisor: 3
			},
			medium: {
				multiplier: 2.5,
				divisor: 4
			},
			small: {
				multiplier: 2,
				divisor: 5
			}
		};
		libWrapper.register(
			"condition-lab-triggler",
			"Token.prototype._refreshEffects",
			function () {
				const effectSize = game.settings.get("condition-lab-triggler", "effectSize");
				// Use the default values if no setting found
				const { multiplier = 2, divisor = 5 } = effectSizes[effectSize];

				let i = 0;
				const size = Math.round(canvas.dimensions.size / 2 / 5) * multiplier;
				const rows = Math.floor(this.document.height * divisor);

				// Unchanged
				const bg = this.effects.bg.clear().beginFill(0x000000, 0.4)
					.lineStyle(1.0, 0x000000);
				for (const effect of this.effects.children) {
					if (effect === bg) continue;

					if (effect === this.effects.overlay) {
						const { width, height } = this.getSize();
						const size = Math.min(width * 0.6, height * 0.6);
						effect.width = effect.height = size;
						effect.position = this.getCenterPoint({ x: 0, y: 0 });
						effect.anchor.set(0.5, 0.5);
					} else {
						effect.width = effect.height = size;
						effect.x = Math.floor(i / rows) * size;
						effect.y = (i % rows) * size;
						bg.drawRoundedRect(effect.x + 1, effect.y + 1, size - 2, size - 2, 2);
						i++;
					}
				}
			},
			"OVERRIDE"
		);
	}
});

Hooks.on("ready", async () => {
	game.clt.CoreStatusEffects = foundry.utils.deepClone(CONFIG.statusEffects)
		.map((status) => {
			/** @deprecated since v12 */
			for (const [oldKey, newKey] of Object.entries({ label: "name", icon: "img" })) {
				const msg = `StatusEffectConfig#${oldKey} has been deprecated in favor of StatusEffectConfig#${newKey}`;
				Object.defineProperty(status, oldKey, {
					get() {
						foundry.utils.logCompatibilityWarning(msg, { since: 12, until: 14, once: true });
						return this[newKey];
					},
					set(value) {
						foundry.utils.logCompatibilityWarning(msg, { since: 12, until: 14, once: true });
						this[newKey] = value;
					},
					enumerable: false,
					configurable: true
				});
			}
			return status;
		});
	game.clt.CoreSpecialStatusEffects = foundry.utils.deepClone(CONFIG.specialStatusEffects);
	game.clt.supported = false;
	let defaultMaps = game.settings.get("condition-lab-triggler", "defaultConditionMaps");
	let conditionMap = game.settings.get("condition-lab-triggler", "activeConditionMap");

	const mapType = game.settings.get("condition-lab-triggler", "conditionMapType");

	// If there's no defaultMaps or defaultMaps doesn't include game system, check storage then set appropriately
	if (
		game.user.isGM
		&& (
			!defaultMaps
			|| Object.keys(defaultMaps).length === 0
			|| !Object.keys(defaultMaps).includes(game.system.id)
		)
	) {
		defaultMaps = await EnhancedConditions._loadDefaultMaps();
		game.settings.set("condition-lab-triggler", "defaultConditionMaps", defaultMaps);
	}

	// If map type is not set and a default map exists for the system, set maptype to default
	if (!mapType && defaultMaps instanceof Object && Object.keys(defaultMaps).includes(game.system.id)) {
		game.settings.set("condition-lab-triggler", "conditionMapType", "default");
	}

	// If there's no condition map, get the default one
	if (!conditionMap.length) {
		// Pass over defaultMaps since the storage version is still empty
		conditionMap = EnhancedConditions.getDefaultMap(defaultMaps);

		if (game.user.isGM && conditionMap.length) {
			game.settings.set("condition-lab-triggler", "activeConditionMap", conditionMap);
		}
	}

	// If map type is not set, now set to default
	if (!mapType && conditionMap.length) {
		game.settings.set("condition-lab-triggler", "conditionMapType", "default");
	}

	// Update status icons accordingly
	if (game.user.isGM) ;
	// const specialStatusEffectMap = game.settings.get("condition-lab-triggler", "specialStatusEffectMapping");
	if (conditionMap.length) EnhancedConditions._updateStatusEffects(conditionMap);
	setInterval(EnhancedConditions.updateConditionTimestamps, 15000);

	// Save the active condition map to a convenience property
	game.clt.conditions = conditionMap;

	game.clt.supported = true;
});

/* -------------------------------------------- */
/*                    Entity                    */
/* -------------------------------------------- */

/* ------------------- Actor ------------------ */

Hooks.on("updateActor", (actor, updateData, options, userId) => {
	// Workaround for actor array returned in hook for non triggering clients
	if (game.userId !== userId) return;
	Triggler._processUpdate(actor, updateData, "system");
});

/* --------------- Active Effect -------------- */

Hooks.on("createActiveEffect", (effect, options, userId) => {
	if (!game.user.isGM || game.userId !== userId) return;
	EnhancedConditions._processActiveEffectChange(effect, "create");
});

Hooks.on("deleteActiveEffect", (effect, options, userId) => {
	if (!game.user.isGM || game.userId !== userId) return;
	EnhancedConditions._processActiveEffectChange(effect, "delete");
});

/* ------------------ Combat ------------------ */

Hooks.on("updateCombat", (combat, update, options, userId) => {
	const enableOutputCombat = game.settings.get("condition-lab-triggler", "conditionsOutputDuringCombat");
	const outputChatSetting = game.settings.get("condition-lab-triggler", "conditionsOutputToChat");
	const combatant = combat.combatant;

	if (
		!foundry.utils.hasProperty(update, "turn")
		|| !combatant
		|| !outputChatSetting
		|| !enableOutputCombat
		|| !game.user.isGM
	) {
		return;
	}

	const token = combatant.token;

	if (!token) return;

	const tokenConditions = EnhancedConditions.getConditions(token, { warn: false });
	let conditions = tokenConditions && tokenConditions.conditions ? tokenConditions.conditions : [];
	conditions = conditions instanceof Array ? conditions : [conditions];

	if (!conditions.length) return;

	const chatConditions = conditions.filter((c) => c.options?.outputChat);

	if (!chatConditions.length) return;

	EnhancedConditions.outputChatMessage(token, chatConditions, { type: "active" });
});

/* -------------- Scene Controls -------------- */
Hooks.on("getSceneControlButtons", function (hudButtons) {
	if (game.user.isGM && game.settings.get("condition-lab-triggler", "sceneControls")) {
		const hud = $(hudButtons).find((val) => val.name === "token");
		if (hud) {
			hud.tools.push({
				name: "CLT.ENHANCED_CONDITIONS.Lab.Title",
				title: "CLT.ENHANCED_CONDITIONS.Lab.Title",
				icon: "fas fa-flask",
				button: true,
				onClick: async () => new ConditionLab().render(true)
			});
			hud.tools.push({
				name: "Triggler",
				title: "Triggler",
				icon: "fas fa-exclamation",
				button: true,
				onClick: async () => new TrigglerForm().render(true)
			});
		}
	}
});

Hooks.on("renderSceneControls", (app, html, data) => {
	const trigglerButton = $(html).find('li[data-tool="Triggler"]')[0];
	if (trigglerButton) {
		trigglerButton.style.display = "inline-block";
		const exclamationMark = trigglerButton.children[0];
		exclamationMark.style.marginRight = "0px";
		const rightChevron = document.createElement("i");
		rightChevron.classList.add("fas", "fa-angle-right");
		rightChevron.style.marginRight = "0px";
		trigglerButton.insertBefore(rightChevron, exclamationMark);
		const leftChevron = document.createElement("i");
		leftChevron.classList.add("fas", "fa-angle-left");
		exclamationMark.after(leftChevron);
	}
});

/* ------------------- Misc ------------------- */

Hooks.on("renderSettingsConfig", (app, html, data, ...others) => {
	const trigglerMenu = $(html).find("button[data-key=\"condition-lab-triggler.trigglerMenu\"]")[0];
	if (trigglerMenu) {
		const exclamationMark = trigglerMenu.children[0];
		exclamationMark.style.margin = "0 -6px";
		const rightChevron = document.createElement("i");
		rightChevron.classList.add("fas", "fa-angle-right");
		trigglerMenu.insertBefore(rightChevron, exclamationMark);
		const leftChevron = document.createElement("i");
		leftChevron.classList.add("fas", "fa-angle-left");
		exclamationMark.after(leftChevron);
	}
});

Hooks.on("renderMacroConfig", (app, html, data) => {
	const typeSelect = $(html).find("select[name='type']");
	const typeSelectDiv = typeSelect.closest("div");
	const flag = app.object.getFlag("condition-lab-triggler", "macroTrigger");
	const triggers = game.settings.get("condition-lab-triggler", "storedTriggers");

	const select = foundry.applications.fields.createSelectInput({
		name: "flags.condition-lab-triggler.macroTrigger",
		options: triggers,
		value: flag,
		blank: "CLT.ENHANCED_CONDITIONS.MacroConfig.NoTriggerSet",
		localize: true,
		sort: true,
		valueAttr: "id",
		labelAttr: "text"
	});

	typeSelectDiv.after($(`
		<div class="form-group">
			<label>${game.i18n.localize("CLT.Trigger")}</label>
			${select.outerHTML}
		</div>
	`));
});

/* ------------------- Chat ------------------- */

Hooks.on("renderChatLog", (app, html, data) => {
	EnhancedConditions.updateConditionTimestamps();
});

Hooks.on("renderChatMessage", (app, html, data) => {
	if (data.message.content && !data.message.content.match("enhanced-conditions")) {
		return;
	}

	const speaker = data.message.speaker;

	if (!speaker) return;

	const removeConditionAnchor = $(html).find("a[name='remove-row']");
	const undoRemoveAnchor = $(html).find("a[name='undo-remove']");

	/**
	 * @todo #284 move to chatlog listener instead
	 */
	removeConditionAnchor.on("click", (event) => {
		const conditionListItem = event.target.closest("li");
		const conditionName = conditionListItem.dataset.conditionName;
		const messageListItem = conditionListItem?.parentElement?.closest("li");
		const messageId = messageListItem?.dataset?.messageId;
		const message = messageId ? game.messages.get(messageId) : null;

		if (!message) return;

		const token = canvas.tokens.get(speaker.token);
		const actor = game.actors.get(speaker.actor);
		const entity = token ?? actor;

		if (!entity) return;

		EnhancedConditions.removeCondition(conditionName, entity, { warn: false });
	});

	undoRemoveAnchor.on("click", (event) => {
		const conditionListItem = event.target.closest("li");
		const conditionName = conditionListItem.dataset.conditionName;
		const messageListItem = conditionListItem?.parentElement?.closest("li");
		const messageId = messageListItem?.dataset?.messageId;
		const message = messageId ? game.messages.get(messageId) : null;

		if (!message) return;

		const speaker = message?.speaker;

		if (!speaker) return;

		const token = canvas.tokens.get(speaker.token);
		const actor = game.actors.get(speaker.actor);
		const entity = token ?? actor;

		if (!entity) return;

		EnhancedConditions.addCondition(conditionName, entity);
	});
});

Hooks.on("renderDialog", (app, html, data) => {
	switch (app.title) {
		case game.i18n.localize("CLT.ENHANCED_CONDITIONS.ConditionLab.SortDirectionSave.Title"):
			ConditionLab._onRenderSaveDialog(app, html, data);
			break;

		case game.i18n.localize("CLT.ENHANCED_CONDITIONS.Lab.RestoreDefaultsTitle"):
			ConditionLab._onRenderRestoreDefaultsDialog(app, html, data);
			break;
	}
});

/* -------------- Combat Tracker -------------- */

Hooks.on("renderCombatTracker", (app, html, data) => {
	$(html).find("img[class='token-effect']")
		.each((index, element) => {
			const url = new URL(element.src);
			const path = url?.pathname?.substring(1);
			const conditions = EnhancedConditions.getConditionsByIcon(path);
			const statusEffect = CONFIG.statusEffects.find((e) => e.img === path);

			if (conditions?.length) {
				element.title = conditions[0];
			} else if (statusEffect?.name) {
				element.title = game.i18n.localize(statusEffect.name);
			}
		});
});

/* ---------------- Custom Apps --------------- */

Hooks.on("renderConditionLab", (app, html, data) => {
	ConditionLab._onRender(app, $(html), data);
});
//# sourceMappingURL=condition-lab-triggler.js.map
