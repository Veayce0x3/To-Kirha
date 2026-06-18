const GATHERING_JOBS = ['lumberjack', 'fisher', 'miner', 'farmer', 'alchemist'];

export function normalizePurchasedSlots(saved, balance) {
  const starting = balance.harvestSlots.startingSlots;
  if (typeof saved === 'number') {
    return Object.fromEntries(GATHERING_JOBS.map((j) => [j, saved]));
  }
  if (!saved || typeof saved !== 'object') {
    return Object.fromEntries(GATHERING_JOBS.map((j) => [j, starting]));
  }
  const out = {};
  for (const j of GATHERING_JOBS) {
    out[j] = saved[j] ?? starting;
  }
  return out;
}

export function getMaxSlots(state, balance, jobId) {
  const cfg = balance.harvestSlots;
  const purchased = normalizePurchasedSlots(state.purchasedSlots, balance);
  const count = purchased[jobId] ?? cfg.startingSlots;
  return Math.min(count, cfg.maxSlots);
}

export function getSlotUnlockCost(slotIndex, balance) {
  const costs = balance.harvestSlots.unlockCosts;
  return costs[slotIndex] ?? null;
}

export function getSlotResourceCost(jobId, slotIndex, balance) {
  const perSlot = balance.harvestSlots?.unlockResourcesByJob?.[jobId];
  if (perSlot && perSlot[slotIndex]) return { ...perSlot[slotIndex] };
  const resId = balance.harvestSlots.unlockResourceByJob?.[jobId];
  const amount = balance.harvestSlots.unlockResourceAmountPerSlot ?? 0;
  if (!resId || amount <= 0 || slotIndex < 2) return null;
  return { [resId]: amount };
}

export function getSlotUnlockRequirements(jobId, slotIndex, balance) {
  return {
    kirha: getSlotUnlockCost(slotIndex, balance),
    resources: getSlotResourceCost(jobId, slotIndex, balance),
  };
}

export function canBuySlot(state, balance, jobId) {
  const current = getMaxSlots(state, balance, jobId);
  if (current >= balance.harvestSlots.maxSlots) return false;
  const { kirha, resources } = getSlotUnlockRequirements(jobId, current, balance);
  if (kirha === null) return false;
  if ((state.kirha || 0) < kirha) return false;
  if (resources) {
    for (const [resId, amount] of Object.entries(resources)) {
      if ((state.inventory[resId] || 0) < amount) return false;
    }
  }
  return true;
}

export function buySlot(state, balance, jobId) {
  const current = getMaxSlots(state, balance, jobId);
  if (current >= balance.harvestSlots.maxSlots) return false;
  const { kirha, resources } = getSlotUnlockRequirements(jobId, current, balance);
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

  if (!state.purchasedSlots || typeof state.purchasedSlots === 'number') {
    state.purchasedSlots = normalizePurchasedSlots(state.purchasedSlots, balance);
  }
  state.purchasedSlots[jobId] = current + 1;
  ensureSlots(state, balance);
  return true;
}

export function ensureSlots(state, balance) {
  if (!state.harvestSlots) state.harvestSlots = {};
  state.purchasedSlots = normalizePurchasedSlots(state.purchasedSlots, balance);

  for (const jobId of GATHERING_JOBS) {
    if (!state.jobs?.[jobId]) continue;
    const max = getMaxSlots(state, balance, jobId);
    if (!state.harvestSlots[jobId]) state.harvestSlots[jobId] = [];
    while (state.harvestSlots[jobId].length < max) {
      state.harvestSlots[jobId].push({ resourceId: null, active: null });
    }
    state.harvestSlots[jobId] = state.harvestSlots[jobId].slice(0, max);
  }
}

export function assignSlotResource(state, jobId, slotIndex, resourceId) {
  const slot = state.harvestSlots?.[jobId]?.[slotIndex];
  if (!slot || slot.active) return false;
  slot.resourceId = resourceId;
  return true;
}

export function clearSlotAssignment(state, jobId, slotIndex) {
  const slot = state.harvestSlots?.[jobId]?.[slotIndex];
  if (!slot || slot.active) return false;
  slot.resourceId = null;
  return true;
}

export function isAnySlotActive(state, jobId) {
  return (state.harvestSlots?.[jobId] || []).some((s) => s.active);
}

export function isSlotActive(state, jobId, slotIndex) {
  return !!state.harvestSlots?.[jobId]?.[slotIndex]?.active;
}

export function getSlotProgress(slot) {
  if (!slot?.active) return 0;
  return Math.min((Date.now() - slot.active.start) / slot.active.duration, 1);
}
