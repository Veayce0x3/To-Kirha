import { getHarvestCycleTime, getHarvestYield } from './harvest.js';
import { isZoneUnlocked, isResourceUnlockedByJob } from './zones.js';

export function getResourceProfitability(resource, state, jobs, balance) {
  const time = getHarvestCycleTime(resource, state, jobs, balance);
  const yield_ = getHarvestYield(resource, state, jobs, balance);
  const kirhaPerHarvest = yield_ * resource.sellPrice;
  const kirhaPerSecond = kirhaPerHarvest / (time / 1000);

  return { resource, time, yield: yield_, kirhaPerHarvest, kirhaPerSecond };
}

export function getAllProfitability(resources, state, jobs, balance) {
  const results = [];

  for (const resource of Object.values(resources)) {
    if (resource.craftOnly || resource.combatOnly || !resource.baseHarvestTime) continue;
    if (!isZoneUnlocked(resource.zone, state, balance)) continue;
    if (!isResourceUnlockedByJob(resource, state)) continue;
    results.push(getResourceProfitability(resource, state, jobs, balance));
  }

  return results.sort((a, b) => b.kirhaPerSecond - a.kirhaPerSecond);
}
