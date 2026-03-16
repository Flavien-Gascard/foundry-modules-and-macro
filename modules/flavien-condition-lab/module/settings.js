import { ConditionLab } from "./enhanced-conditions/condition-lab.js";
import { EnhancedConditions } from "./enhanced-conditions/enhanced-conditions.js";
import { TrigglerForm } from "./triggler/triggler-form.js";

/**
 * Registers the module's settings.
 */
export function registerSettings() {
	/* -------------------------------------------- */
	/*            Setting Configuration             */
	/* -------------------------------------------- */

	game.settings.register("flavien-condition-lab", "conditionsOutputToChat", {
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
						game.settings.set("flavien-condition-lab", "activeConditionMap", newMap);
					},
					no: () => { }
				});
			}
		}
	});

	game.settings.register("flavien-condition-lab", "conditionsOutputDuringCombat", {
		name: "CLT.SETTINGS.EnhancedConditions.OutputCombatN",
		hint: "CLT.SETTINGS.EnhancedConditions.OutputCombatH",
		scope: "world",
		type: Boolean,
		config: true,
		default: false
	});

	game.settings.register("flavien-condition-lab", "removeDefaultEffects", {
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

	game.settings.register("flavien-condition-lab", "defaultConditionsOutputToChat", {
		name: "CLT.SETTINGS.EnhancedConditions.DefaultOutputChatN",
		hint: "CLT.SETTINGS.EnhancedConditions.DefaultOutputChatH",
		scope: "world",
		type: Boolean,
		config: true,
		default: false
	});

	game.settings.register("flavien-condition-lab", "enhancedConditionsMigrationVersion", {
		name: "CLT.SETTINGS.EnhancedConditions.MigrationVersionN",
		hint: "CLT.SETTINGS.EnhancedConditions.MigrationVersionH",
		scope: "world",
		type: String,
		config: false,
		apiOnly: true,
		default: ""
	});

	game.settings.register("flavien-condition-lab", "showSortDirectionDialog", {
		name: "CLT.SETTINGS.EnhancedConditions.ShowSortDirectionDialogN",
		hint: "CLT.SETTINGS.EnhancedConditions.ShowSortDirectionDialogH",
		scope: "world",
		type: Boolean,
		config: true,
		default: true
	});

	game.settings.register("flavien-condition-lab", "defaultSpecialStatusEffects", {
		name: "CLT.SETTINGS.EnhancedConditions.DefaultSpecialStatusEffectsN",
		hint: "CLT.SETTINGS.EnhancedConditions.DefaultSpecialStatusEffectsH",
		scope: "world",
		type: Object,
		default: CONFIG.specialStatusEffects,
		config: false
	});

	game.settings.register("flavien-condition-lab", "specialStatusEffectMapping", {
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

	game.settings.registerMenu("flavien-condition-lab", "enchantedConditionsMenu", {
		name: "CLT.ENHANCED_CONDITIONS.Lab.Title",
		label: "CLT.ENHANCED_CONDITIONS.Lab.Title",
		hint: "CLT.ENHANCED_CONDITIONS.Lab.Hint",
		icon: "fas fa-flask",
		type: ConditionLab,
		restricted: true
	});

	game.settings.register("flavien-condition-lab", "coreStatusIcons", {
		name: "CLT.SETTINGS.EnhancedConditions.CoreIconsN",
		hint: "CLT.SETTINGS.EnhancedConditions.CoreIconsH",
		scope: "world",
		type: Object,
		default: [],
		config: false
	});

	game.settings.register("flavien-condition-lab", "conditionMapType", {
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

	game.settings.register("flavien-condition-lab", "defaultConditionMaps", {
		name: "CLT.SETTINGS.EnhancedConditions.DefaultMapsN",
		hint: "CLT.SETTINGS.EnhancedConditions.DefaultMapsH",
		scope: "world",
		type: Object,
		default: {}
	});

	game.settings.register("flavien-condition-lab", "activeConditionMap", {
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
		game.settings.register("flavien-condition-lab", "effectSize", {
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

	game.settings.registerMenu("flavien-condition-lab", "trigglerMenu", {
		name: "CLT.SETTINGS.Triggler.TriggersN",
		label: "CLT.SETTINGS.Triggler.TriggersN",
		hint: "CLT.SETTINGS.Triggler.TriggersH",
		icon: "fas fa-exclamation",
		type: TrigglerForm,
		restricted: true
	});

	game.settings.register("flavien-condition-lab", "storedTriggers", {
		name: "CLT.SETTINGS.Triggler.TriggersN",
		hint: "CLT.SETTINGS.Triggler.TriggersH",
		scope: "world",
		type: Object,
		default: [],
		onChange: () => { }
	});

	game.settings.register("flavien-condition-lab", "hasRunMigration", {
		scope: "world",
		type: Boolean,
		default: false
	});

	/* -------------------------------------------- */

	game.settings.register("flavien-condition-lab", "sceneControls", {
		name: "CLT.SETTINGS.SceneControls.Name",
		hint: "CLT.SETTINGS.SceneControls.Hint",
		scope: "world",
		type: Boolean,
		default: false,
		config: true,
		requiresReload: true
	});
}
