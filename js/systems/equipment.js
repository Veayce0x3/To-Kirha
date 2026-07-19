import { isToolBroken } from './toolDurability.js';

const GATHER_JOBS = ['lumberjack', 'fisher', 'miner', 'farmer', 'alchemist', 'breeder', 'cook'];

export function getDefaultEquipment() {
  return {
    jobs: Object.fromEntries(GATHER_JOBS.map((j) => [j, null])),
    accessories: Object.fromEntries(GATHER_JOBS.map((j) => [j, null])),
    breederTools: { bucket: null, basket: null },
    global: null,
  };
}

function inferBreederToolKind(recipeId) {
  return String(recipeId || '').includes('basket') ? 'basket' : 'bucket';
}

function syncBreederJobsMirror(state) {
  const bt = state.equipment.breederTools || { bucket: null, basket: null };
  state.equipment.jobs.breeder = bt.bucket || bt.basket || null;
}

export function migrateEquipment(saved, equipable = {}) {
  const defaults = getDefaultEquipment();
  if (!saved || typeof saved !== 'object') return defaults;

  let base;
  if (saved.jobs || saved.accessories || 'global' in saved || saved.breederTools) {
    base = {
      jobs: { ...defaults.jobs, ...(saved.jobs || {}) },
      accessories: { ...defaults.accessories, ...(saved.accessories || {}) },
      breederTools: {
        bucket: saved.breederTools?.bucket ?? null,
        basket: saved.breederTools?.basket ?? null,
      },
      global: saved.global ?? null,
    };
  } else {
    base = getDefaultEquipment();
    for (const legacyId of [saved.weapon, saved.accessory]) {
      if (!legacyId) continue;
      const item = equipable[legacyId];
      if (!item) continue;
      if (item.job == null) {
        base.global = legacyId;
      } else if (item.slot === 'accessory') {
        base.accessories[item.job] = legacyId;
      } else if (item.job === 'breeder') {
        const kind = inferBreederToolKind(legacyId);
        base.breederTools[kind] = legacyId;
      } else {
        base.jobs[item.job] = legacyId;
      }
    }
  }

  // Legacy : un seul jobs.breeder string → slot seau/panier
  const legacyBreeder = base.jobs?.breeder;
  if (typeof legacyBreeder === 'string' && legacyBreeder) {
    const kind = inferBreederToolKind(legacyBreeder);
    if (!base.breederTools[kind]) base.breederTools[kind] = legacyBreeder;
  }
  syncBreederJobsMirror({ equipment: base });
  return base;
}

export function ensureEquipment(state, equipable = {}) {
  state.equipment = migrateEquipment(state.equipment, equipable);
}

export function getEquippedRecipeIds(state) {
  const eq = state.equipment;
  if (!eq) return [];
  const ids = [];
  if (eq.jobs) {
    for (const id of Object.values(eq.jobs)) if (id) ids.push(id);
  }
  if (eq.accessories) {
    for (const id of Object.values(eq.accessories)) if (id) ids.push(id);
  }
  if (eq.breederTools) {
    if (eq.breederTools.bucket) ids.push(eq.breederTools.bucket);
    if (eq.breederTools.basket) ids.push(eq.breederTools.basket);
  }
  if (eq.global) ids.push(eq.global);
  if (eq.weapon) ids.push(eq.weapon);
  if (eq.accessory) ids.push(eq.accessory);
  return [...new Set(ids)];
}

export function isRecipeEquipped(state, recipeId) {
  return getEquippedRecipeIds(state).includes(recipeId);
}

export function isGatheringEquipableRecipe(recipeId, equipmentData) {
  return !!equipmentData?.equipable?.[recipeId];
}

/** Onglet atelier : outils de récolte regroupés sous Outilleur. */
export function recipeBelongsToWorkshopTab(recipeId, recipe, craftJobId, equipmentData) {
  const isGatheringTool = isGatheringEquipableRecipe(recipeId, equipmentData);
  if (craftJobId === 'toolmaker') {
    return isGatheringTool || recipe?.craftJob === 'toolmaker';
  }
  if (recipe?.craftJob !== craftJobId) return false;
  return !isGatheringTool;
}

export function getJobEquippedTool(state, jobId, toolKind = null) {
  ensureEquipment(state);
  if (jobId === 'breeder') {
    const bt = state.equipment.breederTools || {};
    if (toolKind === 'bucket' || toolKind === 'basket') return bt[toolKind] || null;
    return bt.bucket || bt.basket || state.equipment.jobs?.breeder || null;
  }
  return state.equipment.jobs?.[jobId] || null;
}

export function canEquip(recipeId, state, equipmentData, recipes = {}) {
  const item = equipmentData.equipable[recipeId];
  if (!item) return false;
  if (!(state.crafted || []).includes(recipeId)) return false;
  const recipe = recipes[recipeId];
  if (recipe && (recipe.maxUses || 0) > 0) {
    const remaining = state.toolDurability?.[recipeId];
    if (remaining === undefined || remaining <= 0) return false;
  }
  return true;
}

export function equip(recipeId, state, equipmentData, recipes = {}) {
  if (!canEquip(recipeId, state, equipmentData, recipes)) return false;
  return equipForced(recipeId, state, equipmentData, recipes);
}

/** Équipe sans garde-fous (formation, récompenses). */
export function equipForced(recipeId, state, equipmentData, recipes = {}) {
  const item = equipmentData.equipable[recipeId];
  if (!item) return false;
  ensureEquipment(state, equipmentData.equipable);

  if (item.job == null) {
    state.equipment.global = recipeId;
  } else if (item.slot === 'accessory') {
    state.equipment.accessories[item.job] = recipeId;
  } else if (item.job === 'breeder') {
    const recipe = recipes[recipeId];
    const kind = recipe?.toolKind || inferBreederToolKind(recipeId);
    if (!state.equipment.breederTools) state.equipment.breederTools = { bucket: null, basket: null };
    state.equipment.breederTools[kind] = recipeId;
    syncBreederJobsMirror(state);
  } else {
    state.equipment.jobs[item.job] = recipeId;
  }
  return true;
}

export function unequipGathering(state, jobId, slotKind = 'tool') {
  ensureEquipment(state);
  if (slotKind === 'global') {
    if (!state.equipment.global) return false;
    state.equipment.global = null;
    return true;
  }
  if (jobId === 'breeder' && (slotKind === 'bucket' || slotKind === 'basket')) {
    if (!state.equipment.breederTools?.[slotKind]) return false;
    state.equipment.breederTools[slotKind] = null;
    syncBreederJobsMirror(state);
    return true;
  }
  if (jobId === 'breeder' && slotKind === 'tool') {
    // Retirer le miroir + les deux si on ne précise pas
    const bt = state.equipment.breederTools;
    const had = !!(bt?.bucket || bt?.basket || state.equipment.jobs?.breeder);
    if (bt) {
      bt.bucket = null;
      bt.basket = null;
    }
    state.equipment.jobs.breeder = null;
    return had;
  }
  const bag = slotKind === 'accessory' ? state.equipment.accessories : state.equipment.jobs;
  if (!bag?.[jobId]) return false;
  bag[jobId] = null;
  return true;
}

/** @deprecated Préférer unequipGathering — compat ancien UI */
export function unequip(slot, state) {
  if (!state.equipment) return false;
  if (slot === 'weapon' || slot === 'accessory') {
    if (state.equipment[slot] != null) {
      state.equipment[slot] = null;
      return true;
    }
    return false;
  }
  return unequipGathering(state, slot, 'tool');
}

export function getEquippedLabel(recipeId, recipes) {
  if (!recipeId) return null;
  const r = recipes[recipeId];
  return r ? `${r.emoji} ${r.name}` : null;
}

export function getGatheringEquipmentRows(state, jobs, recipes) {
  ensureEquipment(state);
  return GATHER_JOBS.map((jobId) => {
    const job = jobs[jobId];
    const toolId = state.equipment.jobs?.[jobId] || null;
    const accId = state.equipment.accessories?.[jobId] || null;
    return {
      jobId,
      jobName: job?.name || jobId,
      jobEmoji: job?.emoji || '🛠️',
      toolId,
      toolLabel: getEquippedLabel(toolId, recipes),
      accessoryId: accId,
      accessoryLabel: getEquippedLabel(accId, recipes),
    };
  });
}

/** Tous les outils/accessoires de métier possédés (équipés ou en réserve), liste plate. */
export function getOwnedGatheringEquipment(state, equipmentData, recipes, jobs) {
  ensureEquipment(state);
  const equipable = equipmentData?.equipable || {};
  const items = [];

  for (const recipeId of state.crafted || []) {
    const meta = equipable[recipeId];
    if (!meta) continue;
    const recipe = recipes[recipeId];
    if (!recipe) continue;
    const job = meta.job ? jobs[meta.job] : null;
    const slotKind = meta.job == null
      ? 'global'
      : (meta.slot === 'accessory'
        ? 'accessory'
        : (meta.job === 'breeder'
          ? (recipe.toolKind || (String(recipeId).includes('basket') ? 'basket' : 'bucket'))
          : 'tool'));
    items.push({
      recipeId,
      recipe,
      jobId: meta.job,
      jobName: job?.name || 'Tous métiers',
      jobEmoji: job?.emoji || '🌐',
      slotKind,
      equipped: isRecipeEquipped(state, recipeId),
      canEquip: canEquip(recipeId, state, equipmentData, recipes),
      broken: isToolBroken(state, recipeId, recipe),
    });
  }

  items.sort((a, b) => {
    if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
    const jobCmp = a.jobName.localeCompare(b.jobName, 'fr');
    if (jobCmp !== 0) return jobCmp;
    if (a.slotKind !== b.slotKind) return a.slotKind === 'tool' ? -1 : 1;
    return (a.recipe.name || '').localeCompare(b.recipe.name || '', 'fr');
  });

  return items;
}
