import logger from "../logger.js";
import { getCharacterData } from "./import.js";
import { isEqual } from "../../vendor/isequal.js";
import { getCampaignId } from "../muncher/utils.js";
import DICTIONARY from "../dictionary.js";
import { getCobalt, checkCobalt } from "../lib/Secrets.js";


async function updateCharacterCall(actor, path, bodyContent) {
  const characterId = actor.data.flags.ddbimporter.dndbeyond.characterId;
  const cobaltCookie = getCobalt(actor.id);
  const parsingApi = game.settings.get("ddb-importer", "api-endpoint");
  const betaKey = game.settings.get("ddb-importer", "beta-key");
  const campaignId = getCampaignId();
  const proxyCampaignId = campaignId === "" ? null : campaignId;
  const coreBody = { cobalt: cobaltCookie, betaKey: betaKey, characterId: characterId, campaignId: proxyCampaignId };
  const body = { ...coreBody, ...bodyContent };

  logger.debug("Update body:", bodyContent);

  return new Promise((resolve, reject) => {
    fetch(`${parsingApi}/proxy/update/${path}`, {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body), // body data type must match "Content-Type" header
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) {
          resolve(data);
        }
        logger.debug(`${path} updated`);
        return data;
      })
      .then((data) => resolve(data))
      .catch((error) => {
        logger.error(`Setting ${path} failed`);
        logger.error(error);
        logger.error(error.stack);
        reject(error);
      });
  });
}

async function spellSlotsPact(actor, ddbData) {
  return new Promise((resolve) => {
    if (!game.settings.get("ddb-importer", "sync-policy-spells-slots")) resolve();
    if (
      actor.data.data.spells.pact.max > 0 &&
      ddbData.character.character.data.spells.pact.value !== actor.data.data.spells.pact.value
    ) {
      const used = actor.data.data.spells.pact.max - actor.data.data.spells.pact.value;
      let spellSlotPackData = {
        spellslots: {},
        pact: true,
      };
      spellSlotPackData.spellslots[`level${actor.data.data.spells.pact.level}`] = used;
      const spellPactSlots = updateCharacterCall(actor, "spell/slots", spellSlotPackData);
      resolve(spellPactSlots);
    }
    resolve();
  });
}

async function spellSlots(actor, ddbData) {
  return new Promise((resolve) => {
    if (!game.settings.get("ddb-importer", "sync-policy-spells-slots")) resolve();

    let spellSlotData = { spellslots: {}, update: false };
    for (let i = 1; i <= 9; i++) {
      let spellData = actor.data.data.spells[`spell${i}`];
      if (spellData.max > 0 && ddbData.character.character.data.spells[`spell${i}`].value !== spellData.value) {
        const used = spellData.max - spellData.value;
        spellSlotData.spellslots[`level${i}`] = used;
        spellSlotData["update"] = true;
      }
    }
    if (spellSlotData["update"]) {
      resolve(updateCharacterCall(actor, "spells/slots", spellSlotData));
    }

    resolve();
  });
}

async function currency(actor, ddbData) {
  return new Promise((resolve) => {
    if (!game.settings.get("ddb-importer", "sync-policy-currency")) resolve();
    const same = isEqual(ddbData.character.character.data.currency, actor.data.data.currency);

    if (!same) {
      resolve(updateCharacterCall(actor, "currency", actor.data.data.currency));
    }

    resolve();
  });
}

async function xp(actor, ddbData) {
  return new Promise((resolve) => {
    if (!game.settings.get("ddb-importer", "sync-policy-xp")) resolve();
    const same = ddbData.character.character.data.details.xp.value === actor.data.data.details.xp.value;

    if (!same) {
      resolve(updateCharacterCall(actor, "xp", { currentXp: actor.data.data.details.xp.value }));
    }

    resolve();
  });
}

async function hitPoints(actor, ddbData) {
  return new Promise((resolve) => {
    if (!game.settings.get("ddb-importer", "sync-policy-hitpoints")) resolve();
    const localTemp = actor.data.data.attributes.hp.temp ? actor.data.data.attributes.hp.temp : 0;
    const same =
      ddbData.character.character.data.attributes.hp.value === actor.data.data.attributes.hp.value &&
      ddbData.character.character.data.attributes.hp.temp === localTemp;

    if (!same) {
      const hitPointData = {
        removedHitPoints: actor.data.data.attributes.hp.max - actor.data.data.attributes.hp.value,
        temporaryHitPoints: localTemp,
      };
      resolve(updateCharacterCall(actor, "hitpoints", hitPointData));
    }

    resolve();
  });
}

async function inspiration(actor, ddbData) {
  return new Promise((resolve) => {
    if (!game.settings.get("ddb-importer", "sync-policy-inspiration")) resolve();
    const same = ddbData.character.character.data.attributes.inspiration === actor.data.data.attributes.inspiration;

    if (!same) {
      const inspiration = updateCharacterCall(actor, "inspiration", {
        inspiration: actor.data.data.attributes.inspiration,
      });
      resolve(inspiration);
    }

    resolve();
  });
}

async function exhaustion(actor, ddbData) {
  return new Promise((resolve) => {
    if (!game.settings.get("ddb-importer", "sync-policy-condition")) resolve();
    const same = ddbData.character.character.data.attributes.exhaustion === actor.data.data.attributes.exhaustion;

    if (!same) {
      let exhaustionData = {
        conditionId: 4,
        addCondition: false,
      };
      if (actor.data.data.attributes.exhaustion !== 0) {
        exhaustionData["level"] = actor.data.data.attributes.exhaustion;
        exhaustionData["totalHP"] = actor.data.data.attributes.hp.max;
        exhaustionData["addCondition"] = true;
      }
      resolve(updateCharacterCall(actor, "condition", exhaustionData));
    }

    resolve();
  });
}

async function deathSaves(actor, ddbData) {
  return new Promise((resolve) => {
    if (!game.settings.get("ddb-importer", "sync-policy-deathsaves")) resolve();
    const same = isEqual(ddbData.character.character.data.attributes.death, actor.data.data.attributes.death);

    if (!same) {
      const deathSaveData = {
        failCount: actor.data.data.attributes.death.failure,
        successCount: actor.data.data.attributes.death.success,
      };
      resolve(updateCharacterCall(actor, "deathsaves", deathSaveData));
    }

    resolve();
  });
}

async function hitDice(actor, ddbData) {
  return new Promise((resolve) => {
    if (!game.settings.get("ddb-importer", "sync-policy-hitdice")) resolve();

    const ddbClasses = ddbData.character.classes;

    const klasses = actor.data.items.filter(
      (item) => item.type === "class" && item.data.flags.ddbimporter.id && item.data.flags.ddbimporter.definitionId
    );

    let hitDiceData = {
      classHitDiceUsed: {},
      resetMaxHpModifier: false,
    };

    klasses.forEach((klass) => {
      const classMatch = ddbClasses.find((ddbClass) => ddbClass.flags.ddbimporter.id === klass.data.flags.ddbimporter.id);
      if (classMatch && classMatch.data.hitDiceUsed !== klass.data.data.hitDiceUsed) {
        hitDiceData.classHitDiceUsed[klass.data.flags.ddbimporter.id] = klass.data.data.hitDiceUsed;
      }
    });

    const same = isEqual({}, hitDiceData.classHitDiceUsed);
    if (!same) {
      resolve(updateCharacterCall(actor, "hitdice", { shortRest: hitDiceData }));
    }

    resolve();
  });
}

async function updateSpellsPrepared(actor, spellPreparedData) {
  return new Promise((resolve) => {
    resolve(updateCharacterCall(actor, "spell/prepare", spellPreparedData));
  });
}

async function spellsPrepared(actor, ddbData) {
  if (!game.settings.get("ddb-importer", "sync-policy-spells-prepared")) return [];
  const ddbSpells = ddbData.character.spells;

  const preparedSpells = actor.data.items.filter((item) => {
    const spellMatch = ddbSpells.find((s) =>
      s.name === item.name &&
      item.data.data.preparation?.mode === "prepared" &&
      item.data.flags.ddbimporter?.dndbeyond?.characterClassId &&
      item.data.flags.ddbimporter?.dndbeyond?.characterClassId === s.flags.ddbimporter?.dndbeyond?.characterClassId
    );
    if (!spellMatch) return false;
    const select = item.type === "spell" &&
      item.data.data.preparation?.mode === "prepared" &&
      item.data.data.preparation.prepared !== spellMatch.data.preparation?.prepared;
    return spellMatch && select;
  }).map((spell) => {
    let spellPreparedData = {
        spellInfo: {
          spellId: spell.data.flags.ddbimporter.definitionId,
          characterClassId: spell.data.flags.ddbimporter.dndbeyond.characterClassId,
          entityTypeId: spell.data.flags.ddbimporter.entityTypeId,
          id: spell.data.flags.ddbimporter.id,
          prepared: false,
        }
    };
    if (spell.data.data.preparation.prepared) spellPreparedData.spellInfo.prepared = true;
    return spellPreparedData;
  });

  let promises = [];
  preparedSpells.forEach((spellPreparedData) => {
    // console.warn(spellPreparedData);
    // promises.push(spellPreparedData);
    promises.push(updateSpellsPrepared(actor, spellPreparedData));
  });

  return Promise.all(promises);

}

async function addEquipment(actor, ddbData) {
  const syncItemReady = actor.data.flags.ddbimporter?.syncItemReady;
  if (syncItemReady && !game.settings.get("ddb-importer", "sync-policy-equipment")) return [];
  const ddbItems = ddbData.character.inventory;

  const itemsToAdd = actor.data.items.filter((item) =>
    !item.data.flags.ddbimporter?.action &&
    DICTIONARY.types.inventory.includes(item.type) &&
    !ddbItems.some((s) => s.name === item.name && s.type === item.type) &&
    item.data.flags.ddbimporter?.definitionId &&
    item.data.flags.ddbimporter?.definitionEntityTypeId
  );

  let addItemData = {
    equipment: []
  };

  itemsToAdd.forEach((item) => {
    addItemData.equipment.push({
      entityId: parseInt(item.data.flags.ddbimporter.definitionId),
      entityTypeId: parseInt(item.data.flags.ddbimporter.definitionEntityTypeId),
      quantity: parseInt(item.data.data.quantity),
    });
  });

  if (addItemData.equipment.length > 0) {
    const itemResults = await updateCharacterCall(actor, "equipment/add", addItemData);
    const itemUpdates = itemResults.data.addItems.map((addedItem) => {
      let updatedItem = itemsToAdd.find((i) =>
        i.data.flags.ddbimporter.definitionId === addedItem.definition.id &&
        i.data.flags.ddbimporter.definitionEntityTypeId === addedItem.definition.entityTypeId
      );
      updatedItem.data.flags.ddbimporter.id = addedItem.id;
      return updatedItem;
    });
    try {
      await actor.updateEmbeddedDocuments("Item", itemUpdates);
    } catch (err) {
      logger.error(`Unable to update character with equipment, got the error:`, err);
      logger.info(`Update payload:`, itemUpdates);
    }


    return itemResults;
  } else {
    return [];
  }
}

async function removeEquipment(actor, ddbData) {
  const syncItemReady = actor.data.flags.ddbimporter?.syncItemReady;
  if (syncItemReady && !game.settings.get("ddb-importer", "sync-policy-equipment")) return [];
  const ddbItems = ddbData.character.inventory;

  const itemsToRemove = ddbItems.filter((item) =>
    !actor.data.items.some((s) => (s.name === item.name && s.type === item.type) && !s.data.flags.ddbimporter?.action) &&
    DICTIONARY.types.inventory.includes(item.type) &&
    item.flags.ddbimporter?.id
  );

  let promises = [];

  itemsToRemove.forEach((item) => {
    promises.push(updateCharacterCall(actor, "equipment/remove", { itemId: parseInt(item.flags.ddbimporter.id) }));
  });

  return Promise.all(promises);
}

async function updateEquipmentStatus(actor, ddbData, addEquipmentResults) {
  const syncItemReady = actor.data.flags.ddbimporter?.syncItemReady;
  if (syncItemReady && !game.settings.get("ddb-importer", "sync-policy-equipment")) return [];
  // reload the actor following potential updates to equipment
  let ddbItems = ddbData.ddb.inventory;
  if (addEquipmentResults?.data) {
    actor = game.actors.get(actor.id);
    ddbItems = ddbItems.concat(addEquipmentResults.data.addItems);
  }

  const itemsToEquip = actor.data.items.filter((item) =>
    !item.data.flags.ddbimporter?.action && item.data.flags.ddbimporter?.id &&
    ddbItems.some((dItem) =>
      item.data.flags.ddbimporter.id === dItem.id &&
      item.name === dItem.definition.name &&
      item.data.data.equipped !== dItem.equipped
    )
  );
  const itemsToAttune = actor.data.items.filter((item) =>
    !item.data.flags.ddbimporter?.action && item.data.flags.ddbimporter?.id &&
    ddbItems.some((dItem) =>
      item.data.flags.ddbimporter.id === dItem.id &&
      item.name === dItem.definition.name &&
      ((item.data.data.attunement === 2) !== dItem.isAttuned)
    )
  );
  const itemsToCharge = actor.data.items.filter((item) =>
    !item.data.flags.ddbimporter?.action && item.data.flags.ddbimporter?.id &&
    ddbItems.some((dItem) =>
      item.data.flags.ddbimporter.id === dItem.id &&
      item.name === dItem.definition.name &&
      item.data.data.uses?.max && dItem.limitedUse?.numberUsed &&
      ((parseInt(item.data.data.uses.max) - parseInt(item.data.data.uses.value)) !== dItem.limitedUse.numberUsed)
    )
  );
  const itemsToQuantity = actor.data.items.filter((item) =>
    !item.data.flags.ddbimporter?.action && item.data.flags.ddbimporter?.id &&
    ddbItems.some((dItem) =>
      item.data.flags.ddbimporter.id === dItem.id &&
      item.name === dItem.definition.name &&
      item.data.data.quantity !== dItem.quantity
    )
  );

  let promises = [];

  itemsToEquip.forEach((item) => {
    const itemData = { itemId: item.data.flags.ddbimporter.id, value: item.data.data.equipped };
    promises.push(updateCharacterCall(actor, "equipment/equipped", itemData));
  });
  itemsToAttune.forEach((item) => {
    const itemData = { itemId: item.data.flags.ddbimporter.id, value: (item.data.data.attunement === 2) };
    promises.push(updateCharacterCall(actor, "equipment/attuned", itemData));
  });
  itemsToCharge.forEach((item) => {
    const itemData = {
      itemId: item.data.flags.ddbimporter.id,
      charges: parseInt(item.data.data.uses.max) - parseInt(item.data.data.uses.value),
    };
    promises.push(updateCharacterCall(actor, "equipment/charges", itemData));
  });
  itemsToQuantity.forEach((item) => {
    const itemData = {
      itemId: item.data.flags.ddbimporter.id,
      quantity: parseInt(item.data.data.quantity),
    };
    promises.push(updateCharacterCall(actor, "equipment/quantity", itemData));
  });

  return Promise.all(promises);
}

async function actionUpdate(actor, ddbData) {
  const syncActionReady = actor.data.flags.ddbimporter?.syncActionReady;
  if (syncActionReady && !game.settings.get("ddb-importer", "sync-policy-action-use")) return [];

  let ddbActions = ddbData.character.actions;

  const actionsToCharge = actor.data.items.filter((item) =>
    (item.data.flags.ddbimporter?.action || item.type === "feat") &&
    item.data.flags.ddbimporter?.id && item.data.flags.ddbimporter?.entityTypeId &&
    ddbActions.some((dItem) =>
      item.data.flags.ddbimporter.id === dItem.flags.ddbimporter.id &&
      item.data.flags.ddbimporter.entityTypeId === dItem.flags.ddbimporter.entityTypeId &&
      item.name === dItem.name && item.type === dItem.type &&
      item.data.data.uses?.value &&
      item.data.data.uses.value !== dItem.data.uses.value
    )
  );

  let promises = [];

  actionsToCharge.forEach((action) => {
    const actionData = {
      actionId: action.data.flags.ddbimporter.id,
      entityTypeId: action.data.flags.ddbimporter.entityTypeId,
      uses: parseInt(action.data.data.uses.max) - parseInt(action.data.data.uses.value)
    };
    promises.push(updateCharacterCall(actor, "action/use", actionData));
  });

  return Promise.all(promises);
}

export async function updateDDBCharacter(actor) {
  const cobaltCheck = await checkCobalt(actor.id);

  if (cobaltCheck.success) {
    logger.debug(`Cobalt checked`);
  } else {
    logger.error(`Cobalt cookie expired, please reset`);
    logger.error(cobaltCheck.message);
    throw cobaltCheck.message;
  }

  const characterId = actor.data.flags.ddbimporter.dndbeyond.characterId;
  const syncId = actor.data.flags["ddb-importer"]?.syncId ? actor.data.flags["ddb-importer"].syncId + 1 : 0;
  let ddbData = await getCharacterData(characterId, syncId, actor.id);

  logger.debug("Current actor:", actor.data);
  logger.debug("DDB Parsed data:", ddbData);

  let singlePromises = []
    .concat(
      currency(actor, ddbData),
      hitPoints(actor, ddbData),
      hitDice(actor, ddbData),
      spellSlots(actor, ddbData),
      spellSlotsPact(actor, ddbData),
      inspiration(actor, ddbData),
      exhaustion(actor, ddbData),
      deathSaves(actor, ddbData),
      xp(actor, ddbData),
    ).flat();

  const singleResults = await Promise.all(singlePromises);
  const spellsPreparedResults = await spellsPrepared(actor, ddbData);
  const actionUpdateResults = await actionUpdate(actor, ddbData);
  const addEquipmentResults = await addEquipment(actor, ddbData);
  const removeEquipmentResults = await removeEquipment(actor, ddbData);

  const updateEquipmentStatusResults = await updateEquipmentStatus(actor, ddbData, addEquipmentResults);

  // if a known/choice spellcaster
  // and new spell/ spells removed
  // for each spell add or remove, e.g.
  // const spellsData = {
  //   characterClassId: 52134801,
  //   spellId: 2019,
  //   id: 136157,
  //   entityTypeId: 435869154,
  //   remove: true,
  // };
  // const spellSlots = updateCharacterCall(actor, "spells", spellsData);
  // promises.push(spellSlots);

  actor.setFlag("ddb-importer", "syncId", syncId);

  // we can now process item attunements and uses (not yet done)

  const results = singleResults.concat(
    addEquipmentResults, spellsPreparedResults, removeEquipmentResults, updateEquipmentStatusResults, actionUpdateResults
  ).filter((result) => result !== undefined);

  logger.debug("Update results", results);

  return results;
}
