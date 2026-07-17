/**
 * Lignes de production — une ligne par ressource (récolte) ou produit (ferme).
 * Chaque ligne a 1–N unités parallèles (timers indépendants).
 */

import { isGatheringJobUnlocked, isFarmBuildingUnlocked } from './jobUnlock.js';
import { isResourceUnlockedByJob } from './zones.js';
import {
  getHarvestTime,
  getRegrowthTime,
  getHarvestYield,
  getHarvestXp,
  addJobXp,
} from './harvest.js';
import { wearToolsForHarvest } from './toolDurability.js';
import {
  getBuildingDef,
  getFeedCost,
  canAffordFeed,
  consumeFeed,
  computeFarmDuration,
  listFeedOptions,
  wearBreederTool,
} from './farm.js';

function cfg(balance) {
  return balance?.productionLines || {};
}

export function getMaxUnits(balance) {
  return cfg(balance).maxUnits ?? 10;
}

function emptySlot() {
  return { active: null };
}

function normalizeLine(line, units) {
  const count = Math.max(1, Math.min(units, 99));
  const slots = Array.isArray(line?.slots) ? line.slots.map((s) => ({ active: s?.active || null })) : [];
  while (slots.length < count) slots.push(emptySlot());
  return { units: count, slots: slots.slice(0, count) };
}

function getHarvestLine(state, jobId, resourceId) {
  return state.productionLines?.harvest?.[jobId]?.[resourceId] || null;
}

function getFarmLine(state, buildingId, productId) {
  return state.productionLines?.farm?.[buildingId]?.[productId] || null;
}

function setHarvestLine(state, jobId, resourceId, line) {
  if (!state.productionLines) state.productionLines = { harvest: {}, farm: {} };
  if (!state.productionLines.harvest[jobId]) state.productionLines.harvest[jobId] = {};
  state.productionLines.harvest[jobId][resourceId] = line;
}

function setFarmLine(state, buildingId, productId, line) {
  if (!state.productionLines) state.productionLines = { harvest: {}, farm: {} };
  if (!state.productionLines.farm[buildingId]) state.productionLines.farm[buildingId] = {};
  state.productionLines.farm[buildingId][productId] = line;
}

export function getFarmBuildingMeta(state, buildingId) {
  if (!state.farmBuildingMeta) state.farmBuildingMeta = {};
  if (!state.farmBuildingMeta[buildingId]) state.farmBuildingMeta[buildingId] = { hasAnimal: false, feedId: null };
  return state.farmBuildingMeta[buildingId];
}

export function getUnitUnlockCost(unitIndex, balance) {
  const costs = cfg(balance).unitUnlockCosts || [];
  return costs[unitIndex] ?? null;
}

export function getUnitUnlockRequirements(jobId, resourceId, currentUnits, balance) {
  const kirha = getUnitUnlockCost(currentUnits, balance);
  const perJob = cfg(balance).unitUnlockResourcesByJob?.[jobId];
  const resources = perJob?.[currentUnits] ? { ...perJob[currentUnits] } : null;
  return { kirha, resources };
}

export function canBuyHarvestUnit(state, balance, jobId, resourceId) {
  const line = getHarvestLine(state, jobId, resourceId);
  if (!line) return false;
  if (line.units >= getMaxUnits(balance)) return false;
  const { kirha, resources } = getUnitUnlockRequirements(jobId, resourceId, line.units, balance);
  if (kirha == null || (state.kirha || 0) < kirha) return false;
  if (resources) {
    for (const [resId, amount] of Object.entries(resources)) {
      if ((state.inventory[resId] || 0) < amount) return false;
    }
  }
  return true;
}

export function buyHarvestUnit(state, balance, jobId, resourceId) {
  const line = getHarvestLine(state, jobId, resourceId);
  if (!line || line.units >= getMaxUnits(balance)) return false;
  const { kirha, resources } = getUnitUnlockRequirements(jobId, resourceId, line.units, balance);
  if (kirha == null || (state.kirha || 0) < kirha) return false;
  if (resources) {
    for (const [resId, amount] of Object.entries(resources)) {
      if ((state.inventory[resId] || 0) < amount) return false;
    }
  }
  state.kirha -= kirha;
  if (resources) {
    for (const [resId, amount] of Object.entries(resources)) {
      state.inventory[resId] -= amount;
    }
  }
  line.units += 1;
  line.slots.push(emptySlot());
  return true;
}

export function canBuyFarmUnit(state, balance, buildingId, productId) {
  const line = getFarmLine(state, buildingId, productId);
  if (!line) return false;
  if (line.units >= getMaxUnits(balance)) return false;
  const costs = cfg(balance).farmUnitUnlockCosts || cfg(balance).unitUnlockCosts || [];
  const kirha = costs[line.units] ?? null;
  if (kirha == null || (state.kirha || 0) < kirha) return false;
  return true;
}

export function buyFarmUnit(state, balance, buildingId, productId) {
  const line = getFarmLine(state, buildingId, productId);
  if (!line || line.units >= getMaxUnits(balance)) return false;
  const costs = cfg(balance).farmUnitUnlockCosts || cfg(balance).unitUnlockCosts || [];
  const kirha = costs[line.units] ?? null;
  if (kirha == null || (state.kirha || 0) < kirha) return false;
  state.kirha -= kirha;
  line.units += 1;
  line.slots.push(emptySlot());
  return true;
}

export function ensureProductionLines(state, resources, farmData, balance) {
  if (!state.productionLines) state.productionLines = { harvest: {}, farm: {} };
  if (!state.productionLines.harvest) state.productionLines.harvest = {};
  if (!state.productionLines.farm) state.productionLines.farm = {};

  for (const jobId of Object.keys(state.productionLines.harvest)) {
    if (!isGatheringJobUnlocked(jobId, state, balance)) {
      delete state.productionLines.harvest[jobId];
    }
  }

  for (const jobId of getUnlockedJobIds(state, balance)) {
    if (!isGatheringJobUnlocked(jobId, state, balance)) continue;
    const jobResources = getJobHarvestResources(resources, jobId);
    if (!state.productionLines.harvest[jobId]) state.productionLines.harvest[jobId] = {};

    for (const resource of jobResources) {
      if (!isResourceUnlockedByJob(resource, state, resources)) continue;
      const existing = state.productionLines.harvest[jobId][resource.id];
      const isStarter = resource.id === 'ble' && jobId === 'farmer';
      const defaultUnits = existing?.units ?? (isStarter ? 1 : 1);
      state.productionLines.harvest[jobId][resource.id] = normalizeLine(existing || { units: defaultUnits }, defaultUnits);
    }
  }

  for (const buildingId of Object.keys(state.productionLines.farm)) {
    if (!isFarmBuildingUnlocked(buildingId, state, balance)) {
      delete state.productionLines.farm[buildingId];
    }
  }

  for (const buildingId of getUnlockedFarmIds(state, balance)) {
    if (!isFarmBuildingUnlocked(buildingId, state, balance)) continue;
    const building = getBuildingDef(farmData, buildingId);
    if (!building) continue;
    if (!state.productionLines.farm[buildingId]) state.productionLines.farm[buildingId] = {};
    for (const productId of Object.keys(building.products || {})) {
      const existing = state.productionLines.farm[buildingId][productId];
      state.productionLines.farm[buildingId][productId] = normalizeLine(existing || { units: 1 }, existing?.units || 1);
    }
  }
}

function getUnlockedJobIds(state, balance) {
  const fromState = Object.keys(state.productionLines?.harvest || {});
  const fromUnlock = ['farmer', 'lumberjack', 'fisher', 'miner', 'alchemist'].filter((id) =>
    isGatheringJobUnlocked(id, state, balance)
  );
  return [...new Set([...fromState, ...fromUnlock])];
}

function getUnlockedFarmIds(state, balance) {
  const fromState = Object.keys(state.productionLines?.farm || {});
  const fromUnlock = ['well', 'chicken_coop', 'barn', 'sheepfold', 'pigsty', 'beehive'].filter((id) =>
    isFarmBuildingUnlocked(id, state, balance)
  );
  return [...new Set([...fromState, ...fromUnlock])];
}

export function getJobHarvestResources(resources, jobId) {
  return Object.values(resources)
    .filter((r) =>
      r.job === jobId
      && !r.craftOnly
      && !r.combatOnly
      && !r.farmOnly
      && !r.notHarvestable
    )
    .sort((a, b) => (a.requiredJobLevel || 1) - (b.requiredJobLevel || 1) || a.id.localeCompare(b.id));
}

export function getUnitProgress(slot) {
  if (!slot?.active) return 0;
  return Math.min((Date.now() - slot.active.start) / slot.active.duration, 1);
}

export function isAnyHarvestActive(state, jobId) {
  const lines = state.productionLines?.harvest?.[jobId] || {};
  return Object.values(lines).some((line) => line.slots.some((s) => s.active));
}

export function isAnyFarmLineActive(state, buildingId) {
  const lines = state.productionLines?.farm?.[buildingId] || {};
  return Object.values(lines).some((line) => line.slots.some((s) => s.active));
}

export function isAnyProductionActive(state) {
  for (const jobLines of Object.values(state.productionLines?.harvest || {})) {
    if (Object.values(jobLines).some((line) => line.slots.some((s) => s.active))) return true;
  }
  for (const buildingLines of Object.values(state.productionLines?.farm || {})) {
    if (Object.values(buildingLines).some((line) => line.slots.some((s) => s.active))) return true;
  }
  return false;
}

export function startHarvestUnit(state, resources, jobs, balance, jobId, resourceId, unitIndex) {
  const line = getHarvestLine(state, jobId, resourceId);
  const slot = line?.slots?.[unitIndex];
  const resource = resources[resourceId];
  if (!slot || slot.active || !resource) return { ok: false, reason: 'Indisponible' };

  const duration = getHarvestTime(resource, state, jobs, balance);
  slot.active = { phase: 'harvesting', start: Date.now(), duration, resourceId };
  return { ok: true, duration, jobId, resourceId, unitIndex };
}

export function completeHarvestUnit(state, resources, jobs, balance, jobId, resourceId, unitIndex, recipes, equipment) {
  const line = getHarvestLine(state, jobId, resourceId);
  const slot = line?.slots?.[unitIndex];
  if (!slot?.active) return null;

  const resource = resources[resourceId];
  const phase = slot.active.phase || 'harvesting';

  if (phase === 'harvesting') {
    const today = new Date().toISOString().slice(0, 10);
    if (!state.dailyHarvest || state.dailyHarvest.date !== today) {
      state.dailyHarvest = { date: today, bonusUsed: false };
    }
    let yield_ = getHarvestYield(resource, state, jobs, balance);
    let dailyBonus = false;
    if (!state.dailyHarvest.bonusUsed) {
      state.dailyHarvest.bonusUsed = true;
      yield_ *= 2;
      dailyBonus = true;
    }
    const xp = getHarvestXp(resource, state, balance, resources);
    state.inventory[resourceId] = (state.inventory[resourceId] || 0) + yield_;
    const levelResult = addJobXp(state, jobId, xp, jobs, balance);
    state.stats.totalHarvests = (state.stats.totalHarvests || 0) + 1;

    const regrowthDuration = getRegrowthTime(resource, state, jobs, balance, resources);
    slot.active = {
      phase: 'regrowing',
      start: Date.now(),
      duration: regrowthDuration,
      resourceId,
    };

    const wornTools = wearToolsForHarvest(state, recipes, equipment, jobId);
    return {
      phase: 'harvested',
      resourceId,
      jobId,
      unitIndex,
      yield: yield_,
      xp,
      levelResult,
      dailyBonus,
      regrowthDuration,
      wornTools,
    };
  }

  slot.active = null;
  return { phase: 'ready', resourceId, jobId, unitIndex };
}

export function buyFarmAnimal(state, farmData, buildingId) {
  const building = getBuildingDef(farmData, buildingId);
  const meta = getFarmBuildingMeta(state, buildingId);
  if (!building?.requiresAnimal || meta.hasAnimal) return { ok: false, reason: 'Indisponible' };
  const cost = building.animalPurchase || {};
  if ((state.kirha || 0) < (cost.kirha || 0)) return { ok: false, reason: 'Pas assez de Kirha' };
  for (const [resId, amount] of Object.entries(cost)) {
    if (resId === 'kirha') continue;
    if ((state.inventory[resId] || 0) < amount) {
      return { ok: false, reason: 'Ressources insuffisantes' };
    }
  }
  if (cost.kirha) state.kirha -= cost.kirha;
  for (const [resId, amount] of Object.entries(cost)) {
    if (resId === 'kirha') continue;
    state.inventory[resId] -= amount;
  }
  meta.hasAnimal = true;
  return { ok: true };
}

export function setFarmLineFeed(state, buildingId, feedId) {
  const meta = getFarmBuildingMeta(state, buildingId);
  meta.feedId = feedId || null;
  return true;
}

export function startFarmUnit(state, farmData, jobs, balance, buildingId, productId, unitIndex) {
  const building = getBuildingDef(farmData, buildingId);
  const line = getFarmLine(state, buildingId, productId);
  const slot = line?.slots?.[unitIndex];
  const meta = getFarmBuildingMeta(state, buildingId);
  if (!building || !slot || slot.active) return { ok: false, reason: 'Occupé' };

  if (building.requiresAnimal && !meta.hasAnimal) {
    return { ok: false, reason: 'Achète un animal pour ce bâtiment' };
  }

  const needsFeed = Object.keys(building.feed || {}).length > 0;
  const feedId = meta.feedId;
  if (needsFeed) {
    if (!feedId || !canAffordFeed(building, feedId, state)) {
      return { ok: false, reason: 'Ration insuffisante' };
    }
    if (!consumeFeed(building, feedId, state)) {
      return { ok: false, reason: 'Ration insuffisante' };
    }
  }

  const duration = computeFarmDuration(building, feedId, state);
  slot.active = { phase: 'producing', start: Date.now(), duration, feedId, productId };
  return { ok: true, duration, buildingId, productId, unitIndex };
}

export function completeFarmUnit(state, farmData, jobs, balance, buildingId, productId, unitIndex, recipes, equipment) {
  const building = getBuildingDef(farmData, buildingId);
  const line = getFarmLine(state, buildingId, productId);
  const slot = line?.slots?.[unitIndex];
  if (!slot?.active) return null;

  const qty = building?.products?.[productId] || 1;
  const breederLv = state.jobs?.breeder?.level || 1;
  const yieldBonus = Math.floor((breederLv - 1) * 0.02);
  const amount = qty + (yieldBonus > 0 && Math.random() < yieldBonus ? 1 : 0);
  state.inventory[productId] = (state.inventory[productId] || 0) + amount;

  const xp = Math.floor(8 + (building.cycleMs || 10000) / 2000);
  const levelResult = addJobXp(state, 'breeder', xp, jobs, balance);
  state.stats.totalHarvests = (state.stats.totalHarvests || 0) + 1;
  slot.active = null;

  const wornTools = wearBreederTool(state, recipes, equipment);
  return {
    products: { [productId]: amount },
    xp,
    levelResult,
    buildingId,
    productId,
    unitIndex,
    wornTools,
  };
}

export function getJobHarvestNavStatus(state, jobId) {
  const lines = state.productionLines?.harvest?.[jobId] || {};
  let best = 'empty';
  let bestPriority = 0;
  const priority = { ready: 4, harvesting: 3, regrowing: 2, empty: 1 };

  for (const line of Object.values(lines)) {
    for (const slot of line.slots) {
      let status = 'ready';
      if (slot.active?.phase === 'regrowing') status = 'regrowing';
      else if (slot.active) status = 'harvesting';
      const p = priority[status] || 0;
      if (p > bestPriority) {
        bestPriority = p;
        best = status === 'harvesting' && slot.active?.phase === 'regrowing' ? 'regrowing' : status;
      }
    }
  }
  return best;
}

export function getFarmBuildingNavStatus(state, buildingId) {
  const lines = state.productionLines?.farm?.[buildingId] || {};
  if (Object.values(lines).some((line) => line.slots.some((s) => s.active && getUnitProgress(s) < 1))) {
    return 'harvesting';
  }
  if (Object.values(lines).some((line) => line.slots.some((s) => !s.active))) return 'ready';
  return 'empty';
}

export function listActiveProductionTimers(state) {
  const timers = [];
  for (const [jobId, lines] of Object.entries(state.productionLines?.harvest || {})) {
    for (const [resourceId, line] of Object.entries(lines)) {
      line.slots.forEach((slot, unitIndex) => {
        if (slot.active) timers.push({ kind: 'harvest', jobId, resourceId, unitIndex, slot });
      });
    }
  }
  for (const [buildingId, lines] of Object.entries(state.productionLines?.farm || {})) {
    for (const [productId, line] of Object.entries(lines)) {
      line.slots.forEach((slot, unitIndex) => {
        if (slot.active) timers.push({ kind: 'farm', buildingId, productId, unitIndex, slot });
      });
    }
  }
  return timers;
}

export function migrateSlotsToProductionLines(state, resources, farmData, balance) {
  if (!state.productionLines) state.productionLines = { harvest: {}, farm: {} };
  if (!state.farmBuildingMeta) state.farmBuildingMeta = {};

  for (const [jobId, slots] of Object.entries(state.harvestSlots || {})) {
    if (!state.productionLines.harvest[jobId]) state.productionLines.harvest[jobId] = {};
    const byResource = {};
    for (const slot of slots || []) {
      if (!slot?.resourceId) continue;
      if (!byResource[slot.resourceId]) byResource[slot.resourceId] = [];
      byResource[slot.resourceId].push(slot);
    }
    for (const [resourceId, resSlots] of Object.entries(byResource)) {
      const units = Math.min(resSlots.length, getMaxUnits(balance));
      const migrated = resSlots.slice(0, units).map((s) => ({ active: s.active ? { ...s.active } : null }));
      state.productionLines.harvest[jobId][resourceId] = normalizeLine({ units, slots: migrated }, units);
    }
  }

  for (const [buildingId, slots] of Object.entries(state.farmSlots || {})) {
    const building = getBuildingDef(farmData, buildingId);
    if (!building) continue;
    if (!state.productionLines.farm[buildingId]) state.productionLines.farm[buildingId] = {};
    const productIds = Object.keys(building.products || {});
    const units = Math.min(slots?.length || 1, getMaxUnits(balance));
    for (const productId of productIds) {
      const migrated = (slots || []).slice(0, units).map((s) => ({
        active: s?.active ? { ...s.active, productId } : null,
      }));
      state.productionLines.farm[buildingId][productId] = normalizeLine({ units: units || 1, slots: migrated }, units || 1);
    }
    const firstWithAnimal = (slots || []).find((s) => s?.hasAnimal);
    if (firstWithAnimal) getFarmBuildingMeta(state, buildingId).hasAnimal = true;
    const firstFeed = (slots || []).find((s) => s?.feedId)?.feedId;
    if (firstFeed) getFarmBuildingMeta(state, buildingId).feedId = firstFeed;
  }

  delete state.harvestSlots;
  delete state.purchasedSlots;
  delete state.farmSlots;
  delete state.purchasedFarmSlots;
}
