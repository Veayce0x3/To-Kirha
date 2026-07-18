import { getResourceUnlockJobLevel } from './progression.js';

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

export function isResourceUnlockedByJob(resource, state, resources = null, balance = null) {
  const required = resources
    ? getResourceUnlockJobLevel(resource, resources, balance || {})
    : (resource.requiredJobLevel || 1);
  return getJobLevel(state, resource.job) >= required;
}

/** Zones monde : plus de filtre récolte — toutes les ressources du métier sont visibles. */
export function isResourceInZone(_resource, _state) {
  return true;
}

export function isResourceHarvestable(resource, state, balance, resources = null) {
  if (resource.craftOnly || resource.combatOnly || resource.farmOnly || resource.notHarvestable) {
    return false;
  }
  return isResourceUnlockedByJob(resource, state, resources);
}

export function canSeeResource(resource, state, _balance, resources = null) {
  if (resource.craftOnly || resource.combatOnly || resource.farmOnly) return false;
  if (!resource.job) return false;
  if (resources) return isResourceUnlockedByJob(resource, state, resources);
  return true;
}

export function isResourceAvailable(resource, state, balance, resources = null) {
  return isResourceHarvestable(resource, state, balance, resources);
}

export function getResourcesForJob(resources, jobId, state, balance) {
  return Object.values(resources)
    .filter((r) => {
      if (r.craftOnly || r.combatOnly || r.job !== jobId) return false;
      return true;
    })
    .sort((a, b) => (a.requiredJobLevel || 1) - (b.requiredJobLevel || 1));
}

export function isStarterHarvestResource(resource, resources) {
  if (!resource?.job || resource.craftOnly || resource.combatOnly || resource.farmOnly || resource.notHarvestable) {
    return false;
  }
  const jobResources = Object.values(resources)
    .filter((r) =>
      r.job === resource.job
      && !r.craftOnly
      && !r.combatOnly
      && !r.farmOnly
      && !r.notHarvestable
    )
    .sort((a, b) => (a.requiredJobLevel || 1) - (b.requiredJobLevel || 1) || a.id.localeCompare(b.id));
  return jobResources[0]?.id === resource.id;
}
