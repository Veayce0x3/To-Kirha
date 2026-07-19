/**
 * Lignes de production — une ligne par ressource (récolte) ou produit (ferme).
 * Chaque ligne a 1–N unités parallèles (timers indépendants).
 */

import { isGatheringJobUnlocked, isFarmBuildingUnlocked } from './jobUnlock.js';
import { isResourceUnlockedByJob } from './zones.js';
import { getResourceUnlockJobLevel } from './progression.js';
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
  wearBreederTool,
  isUnifiedFarmBuilding,
  getUnifiedFarmLineKey,
  rollFarmProductDrops,
  getFarmProductionXp,
  getPrimaryFeedId,
} from './farm.js';
import { addFarmBuildingXp, getFarmBuildingLevel } from './farmProgress.js';

function cfg(balance) {
  return balance?.productionLines || {};
}

export function getMaxUnits(balance) {
  return cfg(balance).maxUnitsPerResource ?? cfg(balance).maxUnits ?? 5;
}

export function getMaxUnitsPerResource(balance) {
  return cfg(balance).maxUnitsPerResource ?? 5;
}

export function getVisibleProductionResources(state, resources, jobId) {
  const lines = state.productionLines?.harvest?.[jobId] || {};
  const tiers = getJobHarvestResources(resources, jobId);
  return tiers.filter((r) => lines[r.id]);
}

export function getUnitUnlockCost(unitIndex, balance) {
  const costs = cfg(balance).unitUnlockCosts || [];
  return extrapolateCost(unitIndex, costs);
}

function extrapolateCost(index, costs) {
  if (!costs.length) return null;
  if (index < costs.length) return costs[index];
  const last = costs[costs.length - 1];
  const prev = costs[costs.length - 2] ?? last;
  const ratio = prev > 0 ? last / prev : 2;
  return Math.floor(last * Math.pow(Math.max(ratio, 1.4), index - costs.length + 1));
}

export function getCumulativeUnitIndex(tiers, lines, resourceId) {
  let index = 0;
  for (const tier of tiers) {
    const line = lines[tier.id];
    if (!line) continue;
    if (tier.id === resourceId) {
      index += line.units;
      break;
    }
    index += line.units;
  }
  return index;
}

export function getUnitUnlockRequirements(jobId, resourceId, state, balance, resources) {
  const tiers = getJobHarvestResources(resources, jobId);
  const lines = state.productionLines?.harvest?.[jobId] || {};
  const cumulativeIndex = getCumulativeUnitIndex(tiers, lines, resourceId);
  const kirha = getUnitUnlockCost(cumulativeIndex, balance);
  const sameRes = cfg(balance).unitUnlockSameResource || [];
  const amount = extrapolateCost(cumulativeIndex, sameRes) ?? 0;
  const resAmount = amount > 0 ? { [resourceId]: amount } : null;
  return { kirha, resources: resAmount };
}

export function getNewTierUnlockRequirements(_jobId, _resourceId, prevResourceId, tierIndex, balance) {
  const c = cfg(balance);
  const kirha = (c.newTierKirhaBase ?? 50) + tierIndex * (c.newTierKirhaStep ?? 40);
  const amount = (c.newTierResourceBase ?? 25) + tierIndex * (c.newTierResourceStep ?? 15);
  return { kirha, resources: { [prevResourceId]: amount } };
}

function canAffordRequirements(state, { kirha, resources }) {
  if (kirha == null || (state.kirha || 0) < kirha) return false;
  if (resources) {
    for (const [resId, amount] of Object.entries(resources)) {
      if ((state.inventory[resId] || 0) < amount) return false;
    }
  }
  return true;
}

function deductRequirements(state, { kirha, resources }) {
  if (kirha) state.kirha -= kirha;
  if (resources) {
    for (const [resId, amount] of Object.entries(resources)) {
      state.inventory[resId] -= amount;
    }
  }
}

export function getNextProductionUnlock(state, balance, resources, jobId, jobs) {
  const tiers = getJobHarvestResources(resources, jobId);
  if (!tiers.length) return { kind: 'maxed' };

  const lines = state.productionLines?.harvest?.[jobId] || {};
  const maxPer = getMaxUnitsPerResource(balance);
  const jobName = jobs?.[jobId]?.name || jobId;

  let currentTierIndex = -1;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (lines[tiers[i].id]) {
      currentTierIndex = i;
      break;
    }
  }

  if (currentTierIndex < 0) return { kind: 'maxed' };

  const currentResource = tiers[currentTierIndex];
  const currentLine = lines[currentResource.id];

  if (currentLine.units < maxPer) {
    const req = getUnitUnlockRequirements(jobId, currentResource.id, state, balance, resources);
    if (req.kirha == null) return { kind: 'maxed' };
    return {
      kind: 'unit',
      jobId,
      resourceId: currentResource.id,
      resourceName: currentResource.name,
      nextUnits: currentLine.units + 1,
      maxUnits: maxPer,
      jobName,
      ...req,
    };
  }

  const nextTierIndex = currentTierIndex + 1;
  if (nextTierIndex >= tiers.length) return { kind: 'maxed' };

  const nextResource = tiers[nextTierIndex];
  if (!isResourceUnlockedByJob(nextResource, state, resources, balance)) {
    return {
      kind: 'level_blocked',
      jobId,
      resourceName: nextResource.name,
      requiredLevel: getResourceUnlockJobLevel(nextResource, resources, balance),
      jobName,
    };
  }

  const prevResource = tiers[currentTierIndex];
  const req = getNewTierUnlockRequirements(jobId, nextResource.id, prevResource.id, nextTierIndex, balance);
  return {
    kind: 'tier',
    jobId,
    resourceId: nextResource.id,
    resourceName: nextResource.name,
    prevResourceId: prevResource.id,
    prevResourceName: prevResource.name,
    jobName,
    ...req,
  };
}

export function canBuyNextProductionUnlock(state, balance, resources, jobId, jobs) {
  const preview = getNextProductionUnlock(state, balance, resources, jobId, jobs);
  if (!preview || preview.kind === 'maxed' || preview.kind === 'level_blocked') return false;
  return canAffordRequirements(state, preview);
}

export function buyNextProductionUnlock(state, balance, resources, jobId, jobs) {
  const preview = getNextProductionUnlock(state, balance, resources, jobId, jobs);
  if (!preview || preview.kind === 'maxed' || preview.kind === 'level_blocked') return false;
  if (!canAffordRequirements(state, preview)) return false;

  if (preview.kind === 'unit') {
    const line = getHarvestLine(state, jobId, preview.resourceId);
    if (!line || line.units >= getMaxUnitsPerResource(balance)) return false;
    deductRequirements(state, preview);
    line.units += 1;
    line.slots.push(emptySlot());
    return true;
  }

  if (preview.kind === 'tier') {
    deductRequirements(state, preview);
    setHarvestLine(state, jobId, preview.resourceId, normalizeLine({ units: 1 }, 1));
    return true;
  }

  return false;
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
  if (!state.farmBuildingMeta[buildingId]) {
    state.farmBuildingMeta[buildingId] = {
      hasAnimal: false,
      feedId: null,
      cyclesLeft: 0,
      animalSlots: 1,
      animals: [null],
      level: 1,
      xp: 0,
    };
  }
  const meta = state.farmBuildingMeta[buildingId];
  if (meta.level == null || meta.level < 1) meta.level = 1;
  if (meta.xp == null || meta.xp < 0) meta.xp = 0;
  normalizeAnimalSlots(meta);
  return meta;
}

/** Migre hasAnimal/cyclesLeft → animals[] + animalSlots. */
export function normalizeAnimalSlots(meta) {
  if (!Array.isArray(meta.animals)) {
    const slots = Math.max(1, Number(meta.animalSlots) || 1);
    meta.animalSlots = slots;
    meta.animals = Array.from({ length: slots }, () => null);
    if (meta.hasAnimal) {
      meta.animals[0] = { cyclesLeft: Math.max(1, Number(meta.cyclesLeft) || 12) };
    }
  }
  const slots = Math.max(1, Number(meta.animalSlots) || meta.animals.length || 1);
  meta.animalSlots = slots;
  while (meta.animals.length < slots) meta.animals.push(null);
  if (meta.animals.length > slots) meta.animals.length = slots;

  const alive = meta.animals.filter((a) => a && (a.cyclesLeft || 0) > 0);
  meta.hasAnimal = alive.length > 0;
  meta.cyclesLeft = alive.reduce((sum, a) => sum + (a.cyclesLeft || 0), 0);
  return meta;
}

export function countAliveAnimals(meta) {
  normalizeAnimalSlots(meta);
  return meta.animals.filter((a) => a && (a.cyclesLeft || 0) > 0).length;
}

export function countActiveFarmProductions(state, buildingId) {
  const lines = state.productionLines?.farm?.[buildingId] || {};
  let n = 0;
  for (const line of Object.values(lines)) {
    for (const slot of line.slots || []) {
      if (slot?.active) n += 1;
    }
  }
  return n;
}

/** Emplacement libre : jamais rempli (null) ou animal mort (cyclesLeft <= 0). */
export function getEmptyAnimalSlotIndex(meta) {
  normalizeAnimalSlots(meta);
  return meta.animals.findIndex((a) => !a || (a.cyclesLeft || 0) <= 0);
}

export function getNextAnimalSlotUnlock(building, meta) {
  normalizeAnimalSlots(meta);
  const unlocks = building?.animalSlotUnlocks || [];
  const nextIndex = meta.animalSlots; // 0-based index of next slot to unlock
  if (nextIndex >= (building?.animalMaxSlots || unlocks.length + 1)) {
    return null;
  }
  const req = unlocks[nextIndex - 1]; // unlocks[0] = 2nd slot
  if (!req) return null;
  return { slotIndex: nextIndex, ...req };
}

function payAnimalCost(state, cost) {
  if (!cost) return { ok: false, reason: 'Coût invalide' };
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
  return { ok: true };
}

export function formatAnimalCostParts(cost, resources) {
  const parts = [];
  if (cost?.kirha) parts.push(`${cost.kirha} 💰`);
  for (const [rid, qty] of Object.entries(cost || {})) {
    if (rid === 'kirha') continue;
    parts.push(`${qty}× ${resources?.[rid]?.name || rid}`);
  }
  return parts;
}

export function canBuyHarvestUnit(state, balance, jobId, resourceId, resources) {
  const line = getHarvestLine(state, jobId, resourceId);
  if (!line) return false;
  if (line.units >= getMaxUnitsPerResource(balance)) return false;
  const req = getUnitUnlockRequirements(jobId, resourceId, state, balance, resources);
  return canAffordRequirements(state, req);
}

export function buyHarvestUnit(state, balance, jobId, resourceId, resources) {
  const line = getHarvestLine(state, jobId, resourceId);
  if (!line || line.units >= getMaxUnitsPerResource(balance)) return false;
  const req = getUnitUnlockRequirements(jobId, resourceId, state, balance, resources);
  if (!canAffordRequirements(state, req)) return false;
  deductRequirements(state, req);
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

function normalizeUnifiedFarmBuilding(state, buildingId, building, balance) {
  if (!isUnifiedFarmBuilding(building)) return;

  const lineKey = getUnifiedFarmLineKey(building);
  if (!state.productionLines.farm[buildingId]) state.productionLines.farm[buildingId] = {};
  const lines = state.productionLines.farm[buildingId];
  const productIds = Object.keys(building.products || {});

  let unified = lines[lineKey];
  if (!unified) {
    unified = lines[productIds[0]] || normalizeLine({ units: 1 }, 1);
  }

  for (const productId of productIds) {
    if (productId === lineKey) continue;
    const other = lines[productId];
    if (!other) continue;
    unified.units = Math.max(unified.units, other.units);
    while (unified.slots.length < unified.units) unified.slots.push(emptySlot());
    other.slots.forEach((slot, index) => {
      if (slot?.active && unified.slots[index] && !unified.slots[index].active) {
        unified.slots[index].active = { ...slot.active, productId: lineKey };
      }
    });
    delete lines[productId];
  }

  lines[lineKey] = normalizeLine(unified, unified.units || 1);
  for (const productId of productIds) {
    if (productId !== lineKey && lines[productId]) delete lines[productId];
  }
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

    const lines = state.productionLines.harvest[jobId];
    const maxPer = getMaxUnitsPerResource(balance);

    if (jobResources.length && Object.keys(lines).length === 0) {
      const starter = jobResources[0];
      lines[starter.id] = normalizeLine({ units: 1 }, 1);
    }

    for (const [resourceId, existing] of Object.entries({ ...lines })) {
      const capped = Math.min(existing?.units || 1, maxPer);
      lines[resourceId] = normalizeLine(existing, capped);
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

    if (isUnifiedFarmBuilding(building)) {
      normalizeUnifiedFarmBuilding(state, buildingId, building, balance);
      const lineKey = getUnifiedFarmLineKey(building);
      const existing = state.productionLines.farm[buildingId][lineKey];
      state.productionLines.farm[buildingId][lineKey] = normalizeLine(existing || { units: 1 }, existing?.units || 1);
      continue;
    }

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

export function startHarvestUnit(state, resources, jobs, balance, jobId, resourceId, unitIndex, recipes = null, equipment = null) {
  const line = getHarvestLine(state, jobId, resourceId);
  const slot = line?.slots?.[unitIndex];
  const resource = resources[resourceId];
  if (!slot || slot.active || !resource) return { ok: false, reason: 'Indisponible' };

  const duration = getHarvestTime(resource, state, jobs, balance, resources);
  slot.active = { phase: 'harvesting', start: Date.now(), duration, resourceId };

  // Usure à au démarrage : 1 utilisation = 1 récolte lancée (pas de multi-clic gratuit)
  let wornTools = [];
  if (recipes && equipment) {
    wornTools = wearToolsForHarvest(state, recipes, equipment, jobId, resourceId, resources);
  }

  return { ok: true, duration, jobId, resourceId, unitIndex, wornTools };
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
      wornTools: [],
    };
  }

  slot.active = null;
  return { phase: 'ready', resourceId, jobId, unitIndex };
}

export function buyFarmAnimal(state, farmData, buildingId, balance = null) {
  const building = getBuildingDef(farmData, buildingId);
  const meta = getFarmBuildingMeta(state, buildingId);
  if (!building?.requiresAnimal) return { ok: false, reason: 'Indisponible' };

  const emptyIdx = getEmptyAnimalSlotIndex(meta);
  if (emptyIdx < 0) {
    return { ok: false, reason: 'Tous les emplacements sont occupés — débloque-en un autre' };
  }

  const slotState = meta.animals[emptyIdx];
  const isReplaceDead = !!(slotState && (slotState.cyclesLeft || 0) <= 0);
  const cost = (isReplaceDead && building.animalRepurchase)
    ? building.animalRepurchase
    : (building.animalPurchase || {});

  const paid = payAnimalCost(state, cost);
  if (!paid.ok) return paid;

  meta.animals[emptyIdx] = { cyclesLeft: Math.max(1, building.animalMaxCycles || 12) };
  normalizeAnimalSlots(meta);
  ensureFarmUnitsForAnimalSlots(state, farmData, buildingId, balance);
  return {
    ok: true,
    animalName: building.animalName || 'Animal',
    cyclesLeft: meta.animals[emptyIdx].cyclesLeft,
    slotIndex: emptyIdx,
    replaced: isReplaceDead,
  };
}

export function unlockFarmAnimalSlot(state, farmData, buildingId, balance = null) {
  const building = getBuildingDef(farmData, buildingId);
  const meta = getFarmBuildingMeta(state, buildingId);
  if (!building?.requiresAnimal) return { ok: false, reason: 'Indisponible' };

  const next = getNextAnimalSlotUnlock(building, meta);
  if (!next) return { ok: false, reason: 'Maximum d’animaux atteint' };

  const buildingLv = getFarmBuildingLevel(state, buildingId);
  if (buildingLv < (next.buildingLevel || 1)) {
    return { ok: false, reason: `${building.name} Nv.${next.buildingLevel} requis` };
  }

  const cost = { kirha: next.kirha || 0, ...(next.resources || {}) };
  const paid = payAnimalCost(state, cost);
  if (!paid.ok) return paid;

  meta.animalSlots += 1;
  meta.animals.push(null);
  normalizeAnimalSlots(meta);
  // Une place animal = une unité de production visible
  ensureFarmUnitsForAnimalSlots(state, farmData, buildingId, balance);
  return { ok: true, animalSlots: meta.animalSlots };
}

/** Aligne le nombre d’unités de production sur les emplacements animaux débloqués. */
export function ensureFarmUnitsForAnimalSlots(state, farmData, buildingId, balance = null) {
  const building = getBuildingDef(farmData, buildingId);
  if (!building?.requiresAnimal) return;
  const meta = getFarmBuildingMeta(state, buildingId);
  const want = Math.max(1, Number(meta.animalSlots) || 1);
  const maxUnits = getMaxUnits(balance);
  const target = Math.min(want, maxUnits);

  const lineKeys = isUnifiedFarmBuilding(building)
    ? [getUnifiedFarmLineKey(building)]
    : Object.keys(building.products || {});

  for (const lineKey of lineKeys) {
    let line = getFarmLine(state, buildingId, lineKey);
    if (!line) {
      setFarmLine(state, buildingId, lineKey, normalizeLine({ units: target }, target));
      continue;
    }
    while (line.units < target) {
      line.units += 1;
      line.slots.push(emptySlot());
    }
    setFarmLine(state, buildingId, lineKey, line);
  }
}

export function setFarmLineFeed(state, buildingId, feedId) {
  const meta = getFarmBuildingMeta(state, buildingId);
  meta.feedId = feedId || null;
  return true;
}

export function startFarmUnit(state, farmData, jobs, balance, buildingId, productId, unitIndex, recipes = null, equipment = null) {
  const building = getBuildingDef(farmData, buildingId);
  const line = getFarmLine(state, buildingId, productId);
  const slot = line?.slots?.[unitIndex];
  const meta = getFarmBuildingMeta(state, buildingId);
  if (!building || !slot || slot.active) return { ok: false, reason: 'Occupé' };

  if (building.requiresAnimal) {
    const alive = countAliveAnimals(meta);
    if (alive <= 0) {
      return { ok: false, reason: 'Achète un animal pour ce bâtiment' };
    }
    const producing = countActiveFarmProductions(state, buildingId);
    if (producing >= alive) {
      return { ok: false, reason: `Pas assez d’animaux (${alive} actif${alive > 1 ? 's' : ''})` };
    }
  }

  const needsFeed = Object.keys(building.feed || {}).length > 0;
  let feedId = meta.feedId || getPrimaryFeedId(building);
  if (needsFeed) {
    if (!feedId) feedId = getPrimaryFeedId(building);
    meta.feedId = feedId;
    if (!feedId || !canAffordFeed(building, feedId, state)) {
      return { ok: false, reason: 'Ration insuffisante' };
    }
    if (!consumeFeed(building, feedId, state)) {
      return { ok: false, reason: 'Ration insuffisante' };
    }
  }

  const duration = computeFarmDuration(building, feedId, state);
  slot.active = { phase: 'producing', start: Date.now(), duration, feedId, productId };

  let wornTools = [];
  if (recipes && equipment) {
    wornTools = wearBreederTool(state, recipes, equipment, building?.toolKind || null);
  }

  return { ok: true, duration, buildingId, productId, unitIndex, wornTools };
}

export function completeFarmUnit(state, farmData, jobs, balance, buildingId, productId, unitIndex, recipes, equipment) {
  const building = getBuildingDef(farmData, buildingId);
  const line = getFarmLine(state, buildingId, productId);
  const slot = line?.slots?.[unitIndex];
  if (!slot?.active) return null;

  const buildingLv = getFarmBuildingLevel(state, buildingId);
  const yieldBonus = Math.floor((buildingLv - 1) * 0.02);

  let products;
  if (isUnifiedFarmBuilding(building)) {
    products = rollFarmProductDrops(building);
    for (const [resId, qty] of Object.entries(products)) {
      const bonus = yieldBonus > 0 && Math.random() < yieldBonus ? 1 : 0;
      products[resId] = qty + bonus;
    }
  } else {
    const qty = building?.products?.[productId] || 1;
    const amount = qty + (yieldBonus > 0 && Math.random() < yieldBonus ? 1 : 0);
    products = { [productId]: amount };
  }

  for (const [resId, amount] of Object.entries(products)) {
    state.inventory[resId] = (state.inventory[resId] || 0) + amount;
  }

  const xp = getFarmProductionXp(building);
  const levelResult = xp > 0 ? addFarmBuildingXp(state, buildingId, xp, jobs, balance) : null;
  state.stats.totalHarvests = (state.stats.totalHarvests || 0) + 1;
  slot.active = null;

  let animalExpired = false;
  let expiredName = null;
  if (building?.requiresAnimal) {
    const meta = getFarmBuildingMeta(state, buildingId);
    // Usure sur l'animal avec le moins de cycles restants
    let bestIdx = -1;
    let bestCycles = Infinity;
    meta.animals.forEach((a, i) => {
      if (a && (a.cyclesLeft || 0) > 0 && a.cyclesLeft < bestCycles) {
        bestCycles = a.cyclesLeft;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0) {
      meta.animals[bestIdx].cyclesLeft -= 1;
      if (meta.animals[bestIdx].cyclesLeft <= 0) {
        meta.animals[bestIdx] = { cyclesLeft: 0 };
        animalExpired = true;
        expiredName = building.animalName || 'Animal';
      }
    }
    normalizeAnimalSlots(meta);
  }

  return {
    products,
    xp,
    levelResult,
    buildingId,
    productId,
    unitIndex,
    animalExpired,
    animalName: expiredName || building?.animalName || null,
    cyclesLeft: building?.requiresAnimal
      ? (getFarmBuildingMeta(state, buildingId).cyclesLeft || 0)
      : null,
    wornTools: [],
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
