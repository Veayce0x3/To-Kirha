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
  if (resource.craftOnly || resource.combatOnly || resource.farmOnly || resource.notHarvestable) return false;
  if (!isZoneUnlocked(resource.zone, state, balance)) return false;
  if (!isResourceInZone(resource, state)) return false;
  return isResourceUnlockedByJob(resource, state);
}

export function canSeeResource(resource, state, balance) {
  if (resource.craftOnly || resource.combatOnly || resource.farmOnly) return false;
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

/** Première ressource récoltable Nv.1 du métier dans la zone (récolte sans outil, plus lente). */
export function isStarterHarvestResource(resource, resources) {
  if (!resource?.job || resource.craftOnly || resource.combatOnly || resource.farmOnly || resource.notHarvestable) {
    return false;
  }
  if ((resource.requiredJobLevel || 1) !== 1) return false;
  const jobResources = Object.values(resources)
    .filter((r) =>
      r.job === resource.job
      && r.zone === resource.zone
      && !r.craftOnly
      && !r.combatOnly
      && !r.farmOnly
      && !r.notHarvestable
    )
    .sort((a, b) => (a.requiredJobLevel || 1) - (b.requiredJobLevel || 1) || a.id.localeCompare(b.id));
  return jobResources[0]?.id === resource.id;
}
