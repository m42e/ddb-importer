import utils from "../../utils.js";
import logger from "../../logger.js";
import DICTIONARY from "../../dictionary.js";
import { getWeaponProficiencies, getArmorProficiencies, getToolProficiencies, getLanguagesFromModifiers } from "../character/proficiencies.js";

/**
 * Add supported effects here to exclude them from calculations.
 * Currently only effects on equipment (i.e. items) are supported.
 */
export const EFFECT_EXCLUDED_ITEM_MODIFIERS = [
  { type: "bonus", subType: "saving-throws" },
  { type: "bonus", subType: "ability-checks" },
  { type: "bonus", subType: "skill-checks" },
  { type: "bonus", subType: "strength-score" },
  { type: "bonus", subType: "dexterity-score" },
  { type: "bonus", subType: "constitution-score" },
  { type: "bonus", subType: "wisdom-score" },
  { type: "bonus", subType: "intelligence-score" },
  { type: "bonus", subType: "charisma-score" },
  { type: "bonus", subType: "proficiency-bonus" },
  { type: "set", subType: "strength-score" },
  { type: "set", subType: "dexterity-score" },
  { type: "set", subType: "constitution-score" },
  { type: "set", subType: "wisdom-score" },
  { type: "set", subType: "intelligence-score" },
  { type: "set", subType: "charisma-score" },

  { type: "bonus", subType: "spell-save-dc" },
  { type: "bonus", subType: "spell-attacks" },

  { type: "bonus", subType: "hit-points-per-level" },


  // resistances - subType - e.g. poison - lookup from DICTIONARY
  { type: "resistance", subType: null },
  { type: "immunity", subType: null },
  { type: "vulnerability", subType: null },

  // languages - e.g. dwarvish -- lookup from DICTIONARY
  { type: "language", subType: null },

  // senses
  { type: "set-base", subType: "darkvision" },
  { type: "sense", subType: "darkvision" },

  // speeds
  { type: "set", subType: "innate-speed-walking" },
  { type: "set", subType: "innate-speed-climbing" },
  { type: "set", subType: "innate-speed-swimming" },
  { type: "set", subType: "innate-speed-flying" },

  // ac
  { type: "bonus", subType: "armor-class" },
  // e.g. robe of the archm
  { type: "set", subType: "unarmored-armor-class" },
  // bracers of defence
  { type: "bonus", subType: "unarmored-armor-class" },

   // profs
   { type: "proficiency", subType: null },

   // skills
   { type: "bonus", subType: "acrobatics" },
   { type: "bonus", subType: "animal-handling" },
   { type: "bonus", subType: "arcana" },
   { type: "bonus", subType: "athletics" },
   { type: "bonus", subType: "deception" },
   { type: "bonus", subType: "history" },
   { type: "bonus", subType: "insight" },
   { type: "bonus", subType: "intimidation" },
   { type: "bonus", subType: "investigation" },
   { type: "bonus", subType: "medicine" },
   { type: "bonus", subType: "nature" },
   { type: "bonus", subType: "perception" },
   { type: "bonus", subType: "performance" },
   { type: "bonus", subType: "persuasion" },
   { type: "bonus", subType: "religion" },
   { type: "bonus", subType: "sleight-of-hand" },
   { type: "bonus", subType: "stealth" },
   { type: "bonus", subType: "survival" },

  // { modifiers: "item", type: "bonus", subType: "skill-checks", key: "data.bonuses.abilities.skill" },
  // data.bonuses.rwak.attack
  // data.bonuses.mwak.attack
  // data.bonuses.rwak.damage
  // data.bonuses.mwak.damage
  // data.bonuses.spell.attack
  // data.bonuses.spell.damage
  // data.bonuses.spell.dc
  // data.bonuses.heal.damage
  // data.skills.prc.passive
  // data.skills.per.value
  // data.attributes.hp.value

];

// I used DAE as a reference
// https://gitlab.com/tposney/dae/-/blob/master/src/module/dae.ts
/**
 *
 * Generate a base effect for an Item
 *
 * @param {*} formula
 * @param {*} mode
 * @param {*} itemData
 * @param {*} label
 * @param {*} origin
 */

function baseItemEffect(foundryItem, label) {
  return {
    label: label,
    icon: foundryItem.img,
    changes: [],
    duration: {},
    // duration: {
    //   seconds: null,
    //   startTime: null,
    //   rounds: null,
    //   turns: null,
    //   startRound: null,
    //   startTurn: null,
    // },
    tint: "",
    transfer: true,
    disabled: false,
    // origin: origin,
    flags: {
      dae: {
        transfer: true,
        stackable: false,
        // armorEffect: true
      },
      ddbimporter: {
        disabled: false
      }
    },
   // _id: `${randomID()}${randomID()}`,
  };
}

// *
// CONST.ACTIVE_EFFECT_MODES.
// ADD: 2
// CUSTOM: 0
// DOWNGRADE: 3
// MULTIPLY: 1
// OVERRIDE: 5
// UPGRADE: 4
//

export function generateBaseSkillEffect(id) {
  const mockItem = {
    img: "icons/svg/up.svg",
  };
  const label = "Misc Skill Bonuses";
  let skillEffect = baseItemEffect(mockItem, label);
  skillEffect.flags.dae = {};
  skillEffect.flags.ddbimporter.characterEffect = true;
  skillEffect.origin = `Actor.${id}`;
  delete (skillEffect.transfer);
  return skillEffect;
}

function generateChange(bonus, priority, key, mode) {
  return {
    key: key,
    value: bonus,
    mode: mode,
    priority: priority,
  };
}

function generateAddChange(bonus, priority, key) {
  return generateChange(bonus, priority, key, CONST.ACTIVE_EFFECT_MODES.ADD);
}

function generateCustomChange(bonus, priority, key) {
  return generateChange(bonus, priority, key, CONST.ACTIVE_EFFECT_MODES.CUSTOM);
}

function generateCustomBonusChange(bonus, priority, key) {
  return generateChange(`+${bonus}`, priority, key, CONST.ACTIVE_EFFECT_MODES.CUSTOM);
}

function generateUpgradeChange(bonus, priority, key) {
  return generateChange(bonus, priority, key, CONST.ACTIVE_EFFECT_MODES.UPGRADE);
}

function generateOverrideChange(bonus, priority, key) {
  return generateChange(bonus, priority, key, CONST.ACTIVE_EFFECT_MODES.OVERRIDE);
}

function generateMultiplyChange(bonus, priority, key) {
  return generateChange(bonus, priority, key, CONST.ACTIVE_EFFECT_MODES.MULTIPLY);
}

function generateDowngradeChange(bonus, priority, key) {
  return generateChange(bonus, priority, key, CONST.ACTIVE_EFFECT_MODES.DOWNGRADE);
}

/**
 * Generates an AC bonus for an item
 */
function addACBonusEffect(modifiers, name, type) {
  let changes = [];
  const bonus = utils.filterModifiers(modifiers, "bonus", type).reduce((a, b) => a + b.value, 0);
  if (bonus !== 0) {
    logger.debug(`Generating ${type} bonus for ${name}`);
    changes.push(generateAddChange(bonus, 18, "data.attributes.ac.value"));
  }
  return changes;
}

/**
 * Generates a global custom bonus for an item with a +
 */
function addCustomBonusEffect(modifiers, name, type, key) {
  let changes = [];
  const bonus = utils.filterModifiers(modifiers, "bonus", type).reduce((a, b) => a + b.value, 0);
  if (bonus !== 0) {
    logger.debug(`Generating ${type} bonus for ${name}`);
    changes.push(generateCustomBonusChange(bonus, 18, key));
  }
  return changes;
}

/**
 * Generates a global custom bonus for an item
 */
function addCustomEffect(modifiers, name, type, key) {
  let changes = [];
  const bonus = utils.filterModifiers(modifiers, "bonus", type).reduce((a, b) => a + b.value, 0);
  if (bonus !== 0) {
    logger.debug(`Generating ${type} bonus for ${name}`);
    changes.push(generateCustomChange(bonus, 18, key));
  }
  return changes;
}

/**
 * Generates a global add for an item
 */
function addAddEffect(modifiers, name, type, key) {
  let changes = [];
  const bonus = utils.filterModifiers(modifiers, "bonus", type).reduce((a, b) => a + b.value, 0);
  if (bonus !== 0) {
    logger.debug(`Generating ${type} bonus for ${name}`);
    changes.push(generateAddChange(bonus, 18, key));
  }
  return changes;
}

/**
 * Adds languages, can't handle custom languages
 */
function addLanguages(modifiers, name) {
  let changes = [];

  const languages = getLanguagesFromModifiers(null, modifiers);

  languages.value.forEach((prof) => {
    logger.debug(`Generating language ${prof} for ${name}`);
    changes.push(generateCustomChange(prof, 0, "data.traits.languages.value"));
  });
  if (languages?.custom != "") {
    logger.debug(`Generating language ${languages.custom} for ${name}`);
    changes.push(generateCustomChange(languages.custom, 0, "data.traits.languages.custom"));
  }

  return changes;
}

// *
// Get list of generic conditions/damages
//

function getGenericConditionAffect (modifiers, condition, typeId) {
  const damageTypes = DICTIONARY.character.damageTypes
    .filter((type) => type.kind === condition && type.type === typeId)
    .map((type) => type.value);

  let result = modifiers.filter((modifier) => modifier.type === condition &&
      damageTypes.includes(modifier.subType) && (modifier.restriction === "" || !modifier.restriction))
    .map((modifier) => {
      const entry = DICTIONARY.character.damageTypes.find(
        (type) => type.type === typeId && type.kind === modifier.type && type.value === modifier.subType
      );
      return entry ? entry.foundryValue || entry.value : undefined;
    });

  return result;
}

/**
 * Get  Damage Conditions, and Condition Immunities
 * @param {*} ddbItem
 */
function addDamageConditions(modifiers) {
  let charges = [];

  const damageImmunities = getGenericConditionAffect(modifiers, "immunity", 2);
  const damageResistances = getGenericConditionAffect(modifiers, "resistance", 2);
  const damageVulnerability = getGenericConditionAffect(modifiers, "vulnerability", 2);

  damageImmunities.forEach((type) => {
    charges.push(generateCustomChange(type, 0, "data.traits.di.value"));
  });
  damageResistances.forEach((type) => {
    charges.push(generateCustomChange(type, 0, "data.traits.dr.value"));
  });
  damageVulnerability.forEach((type) => {
    charges.push(generateCustomChange(type, 0, "data.traits.dv.value"));
  });

  const conditionImmunities = getGenericConditionAffect(modifiers, "immunity", 1);

  conditionImmunities.forEach((type) => {
    charges.push(generateCustomChange(type, 20, "data.traits.ci.value"));
  });
  return charges;
}

// *
// Generate stat bonuses
//
function addStatBonusEffect(modifiers, name, subType) {
  const bonuses = modifiers.filter((modifier) => modifier.type === "bonus" && modifier.subType === subType);

  let effects = [];
  // dwarfen "Maximum of 20"
  if (bonuses.length > 0) {
    bonuses.forEach((bonus) => {
      const maxMatch = /Maximum of (\d*)/;
      const match = bonus.restriction ? bonus.restriction.match(maxMatch) : false;
      const max = match ? match[1] : 99;
      logger.debug(`Generating ${subType} stat bonus for ${name}`);
      const ability = DICTIONARY.character.abilities.find((ability) => ability.long === subType.split("-")[0]).value;
      const bonusString = `{${max}, @data.abilities.${ability}.value + ${bonus.value}} kl`;
      effects.push(generateOverrideChange(bonusString, 5, `data.abilities.${ability}.value`));
    });
  }
  return effects;
}

function addStatBonuses(modifiers, name) {
  let changes = [];
  const stats = ["strength-score", "dexterity-score", "constitution-score", "wisdom-score", "intelligence-score", "charisma-score"];
  stats.forEach((stat) => {
    const result = addStatBonusEffect(modifiers, name, stat);
    changes = changes.concat(result);
  });

  return changes;
}

// *
// Generate stat sets
//
function addACSetEffect(modifiers, name, subType) {
  const bonuses = modifiers.filter((mod) => mod.type === "set" && mod.subType === subType).map((mod) => mod.value);

  let effects = [];
  const maxDexTypes = ["ac-max-dex-unarmored-modifier"]

  let maxDexMod = 99;
  // dwarfen "Maximum of 20"
  if (bonuses.length > 0) {
    switch(subType) {
      case "unarmored-armor-class": {
        const maxDexArray = modifiers.filter((mod) => mod.type === "set" && maxDexTypes.includes(mod.subType))
          .map((mod) => mod.value);
        if (maxDexArray.length > 0) maxDexMod = Math.min(maxDexArray);
        break;
      }
      // no default
    }

    logger.debug(`Generating ${subType} AC set for ${name}`);
    effects.push(generateUpgradeChange(`10 + ${Math.max(bonuses)} + {@abilities.dex.mod, ${maxDexMod}} kl`, 4, "data.attributes.ac.value"));
  }
  return effects;
}

function addACSets(modifiers, name) {
  let changes = [];
  const stats = ["unarmored-armor-class"];
  stats.forEach((set) => {
    const result = addACSetEffect(modifiers, name, set);
    changes = changes.concat(result);
  });

  return changes;
}


// *
// Generate stat sets
//
function addStatSetEffect(modifiers, name, subType) {
  const bonuses = modifiers.filter((modifier) => modifier.type === "set" && modifier.subType === subType);

  let effects = [];
  // dwarfen "Maximum of 20"
  if (bonuses.length > 0) {
    bonuses.forEach((bonus) => {
      logger.debug(`Generating ${subType} stat set for ${name}`);
      const ability = DICTIONARY.character.abilities.find((ability) => ability.long === subType.split("-")[0]).value;
      effects.push(generateUpgradeChange(bonus.value, 4, `data.abilities.${ability}.value`));
    });
  }
  return effects;
}

function addStatSets(modifiers, name) {
  let changes = [];
  const stats = ["strength-score", "dexterity-score", "constitution-score", "wisdom-score", "intelligence-score", "charisma-score"];
  stats.forEach((stat) => {
    const result = addStatSetEffect(modifiers, name, stat);
    changes = changes.concat(result);
  });

  return changes;
}


// *
// Senses
//
function addSenseBonus(modifiers, name) {
  let changes = [];

  const bonus = modifiers.filter((modifier) => modifier.type === "set-base" && modifier.subType === "darkvision").map((mod) => mod.value);
  if (bonus.length > 0) {
    logger.debug(`Generating darkvision base for ${name}`);
    changes.push(generateUpgradeChange(Math.max(bonus), 10, "data.attributes.senses.darkvision"));
  }
  // TODO: do other senses
  return changes;
}

/**
 * Proficiency bonus
 */

function addProficiencyBonus(modifiers, name) {
  let changes = [];
  const bonus = utils.filterModifiers(modifiers, "bonus", "proficiency-bonus").reduce((a, b) => a + b.value, 0);
  if (bonus) {
    logger.debug(`Generating proficiency bonus for ${name}`);
    changes.push(generateCustomChange(bonus, 0, "data.attributes.prof"));
  }
  return changes;
}


// *
// Generate set speeds
//
function addSetSpeedEffect(modifiers, name, subType) {
  const bonuses = modifiers.filter((modifier) => modifier.type === "set" && modifier.subType === subType);

  let effects = [];
  // "Equal to Walking Speed"
  if (bonuses.length > 0) {
    bonuses.forEach((bonus) => {
      logger.debug(`Generating ${subType} speed set for ${name}`);
      const innate = subType.split("-").slice(-1)[0];
      const speedType = DICTIONARY.character.speeds.find((s) => s.innate === innate).type;
      // current assumption if no speed provided, set to walking speed
      const speed = (bonus.value) ? bonus.value : "@attributes.movement.walk";
      effects.push(generateUpgradeChange(speed, 20, `data.attributes.movement.${speedType}`));
    });
  }
  return effects;
}

/**
 * Innate Speeds
 */
function addSetSpeeds(modifiers, name) {
  let changes = [];
  const speedSets = ["innate-speed-walking", "innate-speed-climbing", "innate-speed-swimming", "innate-speed-flying"];
  speedSets.forEach((speedSet) => {
    const result = addSetSpeedEffect(modifiers, name, speedSet);
    changes = changes.concat(result);
  });

  return changes;
}

function addProficiencies(modifiers, name) {
  let changes = [];

  const proficiencies = modifiers.filter((mod) => mod.type === "proficiency")
    .map((mod) => {
 return { name: mod.friendlySubtypeName };
});

  const toolProf = getToolProficiencies(null, proficiencies);
  const weaponProf = getWeaponProficiencies(null, proficiencies);
  const armorProf = getArmorProficiencies(null, proficiencies);

  toolProf.value.forEach((prof) => {
    logger.debug(`Generating tool proficiencies for ${name}`);
    changes.push(generateCustomChange(prof, 20, "data.traits.toolProf.custom"));
  });
  weaponProf.value.forEach((prof) => {
    logger.debug(`Generating weapon proficiencies for ${name}`);
    changes.push(generateCustomChange(prof, 20, "data.traits.weaponProf.custom"));
  });
  armorProf.value.forEach((prof) => {
    logger.debug(`Generating armor proficiencies for ${name}`);
    changes.push(generateCustomChange(prof, 20, "data.traits.armorProf.custom"));
  });
  if (toolProf?.custom != "") changes.push(generateCustomChange(toolProf.custom, 20, "data.traits.toolProf.custom"));
  if (weaponProf?.custom != "") changes.push(generateCustomChange(weaponProf.custom, 20, "data.traits.weaponProf.custom"));
  if (armorProf?.custom != "") changes.push(generateCustomChange(armorProf.custom, 20, "data.traits.armorProf.custom"));

  return changes;
}

/**
 * Add HP effects
 * @param {*} modifiers
 * @param {*} name
 */
function addHPEffect(modifiers, name) {
  let changes = [];

  // HP per level
  const hpPerLevel = utils.filterModifiers(modifiers, "bonus", "hit-points-per-level").reduce((a, b) => a + b.value, 0);
  if (hpPerLevel && hpPerLevel > 0) {
    logger.debug(`Generating HP Per Level effects for ${name}`);
    changes.push(generateAddChange(`${hpPerLevel} * @details.level`, 20, "data.attributes.hp.max"));
  }

  return changes;
}


//
// Generate skill bonuses
//
function addSkillBonusEffect(modifiers, name, skill) {
  const bonuses = modifiers.filter((modifier) => modifier.type === "bonus" && modifier.subType === skill.subType);

  let effects = [];
  // dwarfen "Maximum of 20"
  if (bonuses.length > 0) {
    logger.debug(`Generating ${skill.subType} skill bonus for ${name}`);
    const value = utils
      .filterModifiers(modifiers, "bonus", skill.subType)
      .map((skl) => skl.value)
      .reduce((a, b) => a + b, 0) || 0;
    effects.push(generateAddChange(value, 18, `data.skills.${skill.name}.mod`));
  }
  return effects;
}

function addSkillBonuses(modifiers, name) {
  let changes = [];
  DICTIONARY.character.skills.forEach((skill) => {
    const result = addSkillBonusEffect(modifiers, name, skill);
    changes = changes.concat(result);
  });

  return changes;
}


/**
 * Generate supported effects for items
 * @param {*} ddb
 * @param {*} character
 * @param {*} ddbItem
 * @param {*} foundryItem
 */
export function generateItemEffects(ddb, character, ddbItem, foundryItem, compendiumItem) {
  if (!ddbItem.definition?.grantedModifiers || ddbItem.definition.grantedModifiers.length === 0) return foundryItem;
  console.error(`Item: ${foundryItem.name}`, ddbItem);
  logger.debug(`Generating supported effects for ${foundryItem.name}`);

  // Update -actually might not need this, as it seems to add a value anyway to undefined
  // this item might not have been created yet - we will update these origins later in the character import
  // const origin = `ddb.${ddbItem.id}`;
  let effect = baseItemEffect(foundryItem, `${foundryItem.name} - Constant Effects`);

  const acBonus = addACBonusEffect(ddbItem.definition.grantedModifiers, foundryItem.name, "armor-class", "data.attributes.ac.value");
  const unarmoredACBonus = addACBonusEffect(ddbItem.definition.grantedModifiers, foundryItem.name, "unarmored-armor-class", "data.attributes.ac.value");
  const globalSaveBonus = addCustomBonusEffect(ddbItem.definition.grantedModifiers, foundryItem.name, "saving-throws", "data.bonuses.abilities.save");
  const globalAbilityBonus = addCustomBonusEffect(ddbItem.definition.grantedModifiers, foundryItem.name, "ability-checks", "data.bonuses.abilities.check");
  const globalSkillBonus = addCustomBonusEffect(ddbItem.definition.grantedModifiers, foundryItem.name, "skill-checks", "data.bonuses.abilities.skill");
  const languages = addLanguages(ddbItem.definition.grantedModifiers, foundryItem.name);
  const conditions = addDamageConditions(ddbItem.definition.grantedModifiers, foundryItem.name);
  const statSets = addStatSets(ddbItem.definition.grantedModifiers, foundryItem.name);
  const statBonuses = addStatBonuses(ddbItem.definition.grantedModifiers, foundryItem.name);
  const senses = addSenseBonus(ddbItem.definition.grantedModifiers, foundryItem.name);
  const proficiencyBonus = addProficiencyBonus(ddbItem.definition.grantedModifiers, foundryItem.name);
  const speedSets = addSetSpeeds(ddbItem.definition.grantedModifiers, foundryItem.name);
  const spellAttackBonus = addCustomEffect(ddbItem.definition.grantedModifiers, foundryItem.name, "spell-attacks", "data.bonuses.spell.attack");
  const spellDCBonus = addAddEffect(ddbItem.definition.grantedModifiers, foundryItem.name, "spell-save-dc", "data.bonuses.spell.dc");
  const acSets = addACSets(ddbItem.definition.grantedModifiers, foundryItem.name);
  const profs = addProficiencies(ddbItem.definition.grantedModifiers, foundryItem.name);
  const hp = addHPEffect(ddbItem.definition.grantedModifiers, foundryItem.name);
  const skillBonus = addSkillBonuses(ddbItem.definition.grantedModifiers, foundryItem.name);

  effect.changes = [
    ...acBonus,
    ...unarmoredACBonus,
    ...globalSaveBonus,
    ...globalAbilityBonus,
    ...globalSkillBonus,
    ...languages,
    ...conditions,
    ...statSets,
    ...statBonuses,
    ...senses,
    ...proficiencyBonus,
    ...speedSets,
    ...spellAttackBonus,
    ...spellDCBonus,
    ...acSets,
    ...profs,
    ...hp,
    ...skillBonus,
  ];

  // check attunement status etc

  if (!ddbItem.definition.canEquip && !ddbItem.definition.canAttune && !ddbItem.definition.isConsumable) {
    // if item just gives a thing and not potion/scroll
    effect.disabled = false;
    setProperty(effect, "flags.ddbimporter.disabled", false);
    setProperty(foundryItem, "flags.dae.alwaysActive", true);
  } else if (
    compendiumItem ||
    (ddbItem.isAttuned && ddbItem.equipped) || // if it is attuned and equipped
    (ddbItem.isAttuned && !ddbItem.definition.canEquip) || // if it is attuned but can't equip
    (!ddbItem.definition.canAttune && ddbItem.equipped) // can't attune but is equipped
  ) {
    setProperty(foundryItem, "flags.dae.alwaysActive", false);
    setProperty(effect, "flags.ddbimporter.disabled", false);
    effect.disabled = false;
  } else {
    effect.disabled = true;
    setProperty(effect, "flags.ddbimporter.disabled", true);
    setProperty(foundryItem, "flags.dae.alwaysActive", false);
  }

  setProperty(effect, "flags.ddbimporter.itemId", ddbItem.id);
  setProperty(effect, "flags.ddbimporter.itemEntityTypeId", ddbItem.entityTypeId);
  // set dae flag for active equipped
  if (ddbItem.definition.canEquip || ddbItem.definition.canAttune) {
    setProperty(foundryItem, "flags.dae.activeEquipped", true);
  } else {
    setProperty(foundryItem, "flags.dae.activeEquipped", false);
  }

  if (effect.changes?.length > 0) {
    foundryItem.effects.push(effect);
  }

  console.warn(JSON.parse(JSON.stringify(foundryItem)));
  return foundryItem;
}

// TODO:
// * override ac
// * item effects
// * armour bases
// * natural armors
// * unarmoured effects, like monk
// * add durations for potions, mark
// passive skills
// skill prof
// addition senses
