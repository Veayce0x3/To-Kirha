/** Paliers de déblocage et XP fixes par tier de ressource. */

const TIER_UNLOCK_BASE = 10;
const TIER_UNLOCK_STEP = 4;
const TIER_XP_BASE = 10;
const TIER_XP_STEP = 4;

const tierCache = new Map();

export function getLineUnlockLevel(tierIndex) {
  if (tierIndex <= 0) return 1;
  return TIER_UNLOCK_BASE + (tierIndex - 1) * TIER_UNLOCK_STEP;
}

export function getTierXp(tierIndex) {
  return TIER_XP_BASE + tierIndex * TIER_XP_STEP;
}

function harvestableResourcesForJob(resources, jobId) {
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

export function getResourceTierIndex(resource, resources) {
  if (!resource?.job) return 0;
  const key = `${resource.job}:${resource.id}`;
  if (tierCache.has(key)) return tierCache.get(key);
  const list = harvestableResourcesForJob(resources, resource.job);
  const idx = Math.max(0, list.findIndex((r) => r.id === resource.id));
  tierCache.set(key, idx);
  return idx;
}

export function getEffectiveRequiredJobLevel(resource, resources) {
  return getLineUnlockLevel(getResourceTierIndex(resource, resources));
}

export function getEffectiveHarvestXp(resource, resources) {
  return getTierXp(getResourceTierIndex(resource, resources));
}

export function getRegrowthTier(resource, resources) {
  return getResourceTierIndex(resource, resources);
}

export function clearProgressionCache() {
  tierCache.clear();
}
