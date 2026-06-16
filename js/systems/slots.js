export function getMaxSlots(state, balance) {
  const cfg = balance.harvestSlots;
  const purchased = state.purchasedSlots || cfg.startingSlots;
  return Math.min(purchased, cfg.maxSlots);
}

export function getSlotUnlockCost(slotIndex, balance) {
  const costs = balance.harvestSlots.unlockCosts;
  return costs[slotIndex] ?? null;
}

export function canBuySlot(state, balance) {
  const current = getMaxSlots(state, balance);
  if (current >= balance.harvestSlots.maxSlots) return false;
  const cost = getSlotUnlockCost(current, balance);
  return cost !== null && state.kirha >= cost;
}

export function buySlot(state, balance) {
  const current = getMaxSlots(state, balance);
  if (current >= balance.harvestSlots.maxSlots) return false;
  const cost = getSlotUnlockCost(current, balance);
  if (cost === null || state.kirha < cost) return false;
  state.kirha -= cost;
  state.purchasedSlots = current + 1;
  ensureSlots(state, balance);
  return true;
}

export function ensureSlots(state, balance) {
  if (!state.harvestSlots) state.harvestSlots = {};
  const max = getMaxSlots(state, balance);
  for (const jobId of Object.keys(state.jobs || {})) {
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
