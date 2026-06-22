import { addJobXp } from './harvest.js';
import { wearToolsForHarvest } from './toolDurability.js';

import { isFarmBuildingUnlocked } from './careerChoice.js';

export const FARM_BUILDING_IDS = [
  'well',
  'chicken_coop',
  'barn',
  'sheepfold',
  'pigsty',
  'beehive',
];

export const FARM_BUILDING_LABELS = {
  well: 'Puits',
  chicken_coop: 'Poulailler',
  barn: 'Étable',
  sheepfold: 'Bergerie',
  pigsty: 'Porcherie',
  beehive: 'Ruches',
};

export function normalizePurchasedFarmSlots(saved, farmData, state) {
  const starting = farmData.startingSlotsPerBuilding || 1;
  const out = {};
  for (const id of FARM_BUILDING_IDS.filter((bid) => isFarmBuildingUnlocked(bid, state))) {
    out[id] = saved?.[id] ?? starting;
  }
  return out;
}

export function getMaxFarmSlots(state, farmData, balance, buildingId) {
  const cfg = balance?.farmSlots || {};
  const cap = farmData.maxSlotsPerBuilding || cfg.maxPerBuilding || 4;
  const purchased = normalizePurchasedFarmSlots(state.purchasedFarmSlots, farmData, state);
  return Math.min(purchased[buildingId] ?? (farmData.startingSlotsPerBuilding || 1), cap);
}

export function getFarmSlotUnlockCost(slotIndex, balance) {
  const costs = balance?.farmSlots?.unlockCosts;
  return costs?.[slotIndex] ?? null;
}

export function getFarmSlotResourceCost(buildingId, slotIndex, balance) {
  const resId = balance?.farmSlots?.unlockResourceByBuilding?.[buildingId];
  const amount = balance?.farmSlots?.unlockResourceAmountPerSlot ?? 0;
  if (!resId || amount <= 0 || slotIndex < 1) return null;
  return { [resId]: amount };
}

export function getFarmSlotUnlockRequirements(buildingId, slotIndex, balance) {
  return {
    kirha: getFarmSlotUnlockCost(slotIndex, balance),
    resources: getFarmSlotResourceCost(buildingId, slotIndex, balance),
  };
}

export function canBuyFarmSlot(state, farmData, balance, buildingId) {
  const current = getMaxFarmSlots(state, farmData, balance, buildingId);
  const cap = farmData.maxSlotsPerBuilding || balance?.farmSlots?.maxPerBuilding || 4;
  if (current >= cap) return false;
  const { kirha, resources } = getFarmSlotUnlockRequirements(buildingId, current, balance);
  if (kirha === null) return false;
  if ((state.kirha || 0) < kirha) return false;
  if (resources) {
    for (const [resId, amount] of Object.entries(resources)) {
      if ((state.inventory[resId] || 0) < amount) return false;
    }
  }
  return true;
}

export function buyFarmSlot(state, farmData, balance, buildingId) {
  const current = getMaxFarmSlots(state, farmData, balance, buildingId);
  const cap = farmData.maxSlotsPerBuilding || balance?.farmSlots?.maxPerBuilding || 4;
  if (current >= cap) return false;
  const { kirha, resources } = getFarmSlotUnlockRequirements(buildingId, current, balance);
  if (kirha === null || (state.kirha || 0) < kirha) return false;
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

  if (!state.purchasedFarmSlots) {
    state.purchasedFarmSlots = normalizePurchasedFarmSlots(null, farmData, state);
  }
  state.purchasedFarmSlots[buildingId] = current + 1;
  ensureFarmSlots(state, farmData, balance);
  return true;
}

export function ensureFarmSlots(state, farmData, balance) {
  if (!state.farmSlots) state.farmSlots = {};
  state.purchasedFarmSlots = normalizePurchasedFarmSlots(state.purchasedFarmSlots, farmData, state);

  for (const id of FARM_BUILDING_IDS) {
    const max = getMaxFarmSlots(state, farmData, balance, id);
    if (!state.farmSlots[id]) state.farmSlots[id] = [];
    while (state.farmSlots[id].length < max) {
      state.farmSlots[id].push({ feedId: null, active: null });
    }
    state.farmSlots[id] = state.farmSlots[id].slice(0, max);
  }
}

export function getBuildingDef(farmData, buildingId) {
  return farmData.buildings?.[buildingId] || null;
}

export function getFarmBuildingNavStatus(state, buildingId) {
  const slots = state.farmSlots?.[buildingId] || [];
  if (slots.some((s) => s.active)) return 'harvesting';
  const building = { feed: {} };
  const hasIdle = slots.some((s) => !s.active);
  if (hasIdle) return 'ready';
  return 'empty';
}

export function isFarmBuildingActive(state, buildingId) {
  return (state.farmSlots?.[buildingId] || []).some((s) => s.active);
}

export function getFeedEfficiency(building, feedId, state) {
  const map = building.feedEfficiency || {};
  let eff = map[feedId];
  if (eff == null) eff = 0.55;
  const breederLv = state.jobs?.breeder?.level || 1;
  return eff * (1 + (breederLv - 1) * 0.01);
}

export function computeFarmDuration(building, feedId, state) {
  const base = building.cycleMs || 10000;
  if (!feedId || Object.keys(building.feed || {}).length === 0) return base;
  const eff = getFeedEfficiency(building, feedId, state);
  return Math.max(2000, Math.floor(base / Math.max(0.4, eff)));
}

export function canAffordFeed(building, feedId, state) {
  const cost = getFeedCost(building, feedId);
  if (!cost) return Object.keys(building.feed || {}).length === 0;
  for (const [resId, amt] of Object.entries(cost)) {
    if ((state.inventory[resId] || 0) < amt) return false;
  }
  return true;
}

export function getFeedCost(building, feedId) {
  const needs = building.feed || {};
  if (Object.keys(needs).length === 0) return {};
  if (!feedId) return null;
  const cost = {};
  if (feedId === 'eau') return null;
  if (needs[feedId] != null) {
    cost[feedId] = needs[feedId];
  } else if (building.feedEfficiency?.[feedId] != null) {
    cost[feedId] = 2;
  } else {
    return null;
  }
  if (needs.eau) cost.eau = needs.eau;
  return cost;
}

export function consumeFeed(building, feedId, state) {
  const cost = getFeedCost(building, feedId);
  if (!cost) return Object.keys(building.feed || {}).length === 0;
  if (!canAffordFeed(building, feedId, state)) return false;
  for (const [resId, amt] of Object.entries(cost)) {
    state.inventory[resId] -= amt;
  }
  return true;
}

export function listFeedOptions(building) {
  if (Object.keys(building.feed || {}).length === 0) return [];
  return [...new Set([
    ...Object.keys(building.feed || {}).filter((k) => k !== 'eau'),
    ...Object.keys(building.feedEfficiency || {}),
  ])];
}

export function getAvailableFeeds(building, state) {
  return listFeedOptions(building).filter((feedId) => canAffordFeed(building, feedId, state));
}

export function buyFarmAnimal(state, farmData, buildingId, slotIndex) {
  const building = getBuildingDef(farmData, buildingId);
  const slot = state.farmSlots?.[buildingId]?.[slotIndex];
  if (!building?.requiresAnimal || !slot || slot.hasAnimal) return { ok: false, reason: 'Indisponible' };
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
  slot.hasAnimal = true;
  return { ok: true };
}

export function startFarmProduction(state, farmData, buildingId, slotIndex) {
  const building = getBuildingDef(farmData, buildingId);
  const slot = state.farmSlots?.[buildingId]?.[slotIndex];
  if (!building || !slot || slot.active) return { ok: false, reason: 'Occupé' };

  if (building.requiresAnimal && !slot.hasAnimal) {
    return { ok: false, reason: 'Achète une poule pour cet emplacement' };
  }

  const needsFeed = Object.keys(building.feed || {}).length > 0;
  if (needsFeed) {
    if (!slot.feedId || !canAffordFeed(building, slot.feedId, state)) {
      return { ok: false, reason: 'Ration insuffisante' };
    }
    if (!consumeFeed(building, slot.feedId, state)) {
      return { ok: false, reason: 'Ration insuffisante' };
    }
  }

  const duration = computeFarmDuration(building, slot.feedId, state);
  slot.active = {
    phase: 'producing',
    start: Date.now(),
    duration,
    feedId: slot.feedId,
  };
  return { ok: true, duration };
}

export function completeFarmProduction(state, farmData, buildingId, slotIndex, jobs, balance) {
  const building = getBuildingDef(farmData, buildingId);
  const slot = state.farmSlots?.[buildingId]?.[slotIndex];
  if (!slot?.active) return null;

  const products = { ...(building.products || {}) };
  const breederLv = state.jobs?.breeder?.level || 1;
  const yieldBonus = Math.floor((breederLv - 1) * 0.02);

  for (const [resId, qty] of Object.entries(products)) {
    const amount = qty + (yieldBonus > 0 && Math.random() < yieldBonus ? 1 : 0);
    state.inventory[resId] = (state.inventory[resId] || 0) + amount;
  }

  const xp = Math.floor(8 + (building.cycleMs || 10000) / 2000);
  const levelResult = addJobXp(state, 'breeder', xp, jobs, balance);
  state.stats.totalHarvests = (state.stats.totalHarvests || 0) + 1;
  slot.active = null;
  return { products, xp, levelResult, buildingId, slotIndex };
}

export function getFarmSlotProgress(slot) {
  if (!slot?.active) return 0;
  const elapsed = Date.now() - slot.active.start;
  if (elapsed >= slot.active.duration) return 1;
  return elapsed / slot.active.duration;
}

export function isAnyFarmActive(state) {
  for (const slots of Object.values(state.farmSlots || {})) {
    if (slots.some((s) => s.active)) return true;
  }
  return false;
}

/** Termine les productions expirées (ex. après rechargement). */
export function syncExpiredFarmSlots(state, onComplete) {
  if (!onComplete) return;
  for (const buildingId of FARM_BUILDING_IDS) {
    const slots = state.farmSlots?.[buildingId] || [];
    slots.forEach((slot, slotIndex) => {
      if (!slot?.active) return;
      const elapsed = Date.now() - slot.active.start;
      if (elapsed >= slot.active.duration) onComplete(buildingId, slotIndex);
    });
  }
}

export function wearBreederTool(state, recipes, equipment) {
  return wearToolsForHarvest(state, recipes, equipment, 'breeder');
}
