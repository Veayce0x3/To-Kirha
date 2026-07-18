import { getCraftBonus } from './craft.js';
import { getPrestigeBonuses, getSeasonLevelCap } from './prestige.js';
import { getEffectiveHarvestXp, getRegrowthTier } from './progression.js';

const ZONE_REGROWTH_BONUS = {
  village_sakura: 0,
  petal_forest: 4000,
  jade_mountains: 8000,
};

export function getHarvestTime(resource, state, jobs, balance, resources = null) {
  const cfg = balance?.harvest || {};
  const base = cfg.baseHarvestTimeMs ?? 3000;
  const tier = resources ? getRegrowthTier(resource, resources) : Math.floor((resource.requiredJobLevel - 1) / 20);
  const perTier = cfg.harvestPerTierMs ?? 500;
  const tierTime = base + tier * perTier;

  const speedBonus = getSpeedBonus(resource, state, jobs, balance);
  const time = tierTime * (1 - Math.min(speedBonus, 0.85));
  return Math.max(time, cfg.minHarvestTimeMs ?? 1500);
}

function getSpeedBonus(resource, state, jobs, balance) {
  const job = jobs[resource.job];
  const jobData = state.jobs[resource.job] || { level: 1 };
  const craftBonus = balance ? getCraftBonus(state, balance._recipes || {}, resource.job, resource.id, 'speed') : 0;
  const jobSpeedBonus = job ? (jobData.level - 1) * job.bonusesPerLevel.speedBonus : 0;
  return craftBonus + jobSpeedBonus;
}

export function getRegrowthTime(resource, state, jobs, balance, resources = null) {
  const cfg = balance?.harvest || {};
  const tier = resources ? getRegrowthTier(resource, resources) : Math.floor((resource.requiredJobLevel - 1) / 20);
  const zoneBonus = ZONE_REGROWTH_BONUS[resource.zone] ?? 0;
  const base =
    resource.baseRegrowthTime ??
    (cfg.regrowthBaseMs ?? 8000) + tier * (cfg.regrowthPerTierMs ?? 2000) + zoneBonus;

  const speedBonus = getSpeedBonus(resource, state, jobs, balance);
  const time = base * (1 - Math.min(speedBonus, 0.85));
  return Math.max(time, cfg.minRegrowthTimeMs ?? 3000);
}

export function getHarvestCycleTime(resource, state, jobs, balance) {
  return getHarvestTime(resource, state, jobs, balance) + getRegrowthTime(resource, state, jobs, balance);
}

export function getHarvestYield(resource, state, jobs, balance) {
  const job = jobs[resource.job];
  const jobData = state.jobs[resource.job] || { level: 1 };
  const craftBonus = balance ? getCraftBonus(state, balance._recipes || {}, resource.job, resource.id, 'yield') : 0;
  const jobYieldBonus = job ? (jobData.level - 1) * job.bonusesPerLevel.yieldBonus : 0;

  return Math.max(1, Math.floor(resource.baseYield + craftBonus + jobYieldBonus));
}

export function getHarvestXp(resource, state, balance, resources = null) {
  const prestigeBonus = getPrestigeBonuses(state).xp;
  const base = resources ? getEffectiveHarvestXp(resource, resources) : resource.xpPerHarvest;
  return Math.floor(base * prestigeBonus);
}

export function getXpForLevel(job, level) {
  return Math.floor(job.xpPerLevel * Math.pow(job.xpScaling, level - 1));
}

export function addJobXp(state, jobId, xp, jobs, balance) {
  const job = jobs[jobId];
  if (!job) return null;

  if (!state.jobs[jobId]) {
    state.jobs[jobId] = { level: 1, xp: 0 };
  }

  const jobData = state.jobs[jobId];
  const cap = balance ? getSeasonLevelCap('jobs', state, balance) : job.maxLevel;
  if (jobData.level >= cap) return null;

  jobData.xp += xp;

  while (jobData.level < Math.min(job.maxLevel, cap)) {
    const needed = getXpForLevel(job, jobData.level);
    if (jobData.xp < needed) break;
    jobData.xp -= needed;
    jobData.level++;
    if (jobData.level >= cap) {
      jobData.xp = Math.min(jobData.xp, Math.max(0, needed - 1));
      return { leveledUp: true, level: jobData.level, jobId, capped: true };
    }
    return { leveledUp: true, level: jobData.level, jobId };
  }
  return null;
}
