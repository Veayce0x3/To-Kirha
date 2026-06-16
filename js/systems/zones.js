export function isZoneUnlocked(zoneId, state, balance) {
  if (balance.zones[zoneId]?.unlocked) return true;
  return (state.unlockedZones || []).includes(zoneId);
}

export function getUnlockCost(zoneId, balance) {
  return balance.zones[zoneId]?.unlockCost ?? null;
}

export function getZoneResources(resources, zoneId) {
  return Object.values(resources).filter((r) => r.zone === zoneId && !r.craftOnly && !r.combatOnly);
}

export function getJobLevel(state, jobId) {
  return state.jobs[jobId]?.level || 1;
}

export function isResourceUnlockedByJob(resource, state) {
  const required = resource.requiredJobLevel || 1;
  return getJobLevel(state, resource.job) >= required;
}

export function isResourceInZone(resource, state) {
  return resource.zone === state.zone;
}

export function isResourceHarvestable(resource, state, balance) {
  if (resource.craftOnly || resource.combatOnly) return false;
  if (!isZoneUnlocked(resource.zone, state, balance)) return false;
  if (!isResourceInZone(resource, state)) return false;
  return isResourceUnlockedByJob(resource, state);
}

export function canSeeResource(resource, state, balance) {
  if (resource.craftOnly || resource.combatOnly) return false;
  if (!isZoneUnlocked(resource.zone, state, balance)) return false;
  return resource.job && resource.zone === state.zone;
}

export function isResourceAvailable(resource, state, balance) {
  return isResourceHarvestable(resource, state, balance);
}

export function getResourcesForJob(resources, jobId, state, balance) {
  return Object.values(resources).filter((r) => {
    if (r.craftOnly || r.combatOnly || r.job !== jobId) return false;
    if (!isZoneUnlocked(r.zone, state, balance)) return false;
    return r.zone === state.zone;
  }).sort((a, b) => (a.requiredJobLevel || 1) - (b.requiredJobLevel || 1));
}
