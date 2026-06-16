import { getUpgradeCost } from './economy.js';

export function getAideCost(aide, level) {
  return Math.floor(aide.baseCost * Math.pow(aide.costMultiplier, level));
}

export function getAideInterval(aide, level) {
  const speedBonus = Math.min(level * 0.08, 0.6);
  return aide.baseInterval * (1 - speedBonus);
}

export function getAideYield(aide, level, _state) {
  const base = aide.yieldPerLevel + Math.floor(level / 4);
  return Math.max(1, base);
}

export function tickAides(state, aides, balance, deltaMs, accumulators) {
  const results = [];

  for (const [aideId, level] of Object.entries(state.aides || {})) {
    if (level <= 0) continue;

    const aide = aides[aideId];
    if (!aide) continue;

    if (aide.requiresZone && !isZoneUnlocked(aide.requiresZone, state, balance)) continue;

    const interval = getAideInterval(aide, level);
    accumulators[aideId] = (accumulators[aideId] || 0) + deltaMs;

    while (accumulators[aideId] >= interval) {
      accumulators[aideId] -= interval;
      const amount = getAideYield(aide, level, state);
      state.inventory[aide.resource] = (state.inventory[aide.resource] || 0) + amount;
      results.push({ aideId, resource: aide.resource, amount, aide });
    }
  }

  return results;
}

function isZoneUnlocked(zoneId, state, balance) {
  if (balance.zones[zoneId]?.unlocked) return true;
  return (state.unlockedZones || []).includes(zoneId);
}
