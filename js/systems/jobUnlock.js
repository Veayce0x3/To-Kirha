/** Déblocages progressifs des métiers, bâtiments et vues. */

import { GATHERING_JOB_IDS } from './careerChoice.js';
import { FARM_BUILDING_IDS } from './farm.js';

export const CRAFT_JOB_IDS = ['toolmaker', 'cook'];
export const SPECIAL_VIEWS = ['combat', 'workshop', 'cuisine'];

export function getJobUnlockRules(balance) {
  return balance?.jobUnlocks || {};
}

function meetsCondition(state, condition) {
  if (!condition) return true;
  if (condition.jobLevel) {
    for (const [jobId, minLevel] of Object.entries(condition.jobLevel)) {
      if ((state.jobs?.[jobId]?.level || 1) < minLevel) return false;
    }
  }
  if (condition.characterLevel != null) {
    if ((state.character?.level || 1) < condition.characterLevel) return false;
  }
  if (condition.totalHarvests != null) {
    const total = state.stats?.totalHarvests || state.lifetimeStats?.totalHarvests || 0;
    if (total < condition.totalHarvests) return false;
  }
  return true;
}

export function isJobUnlocked(jobId, state, balance) {
  if (jobId === 'farmer') return true;
  const rules = getJobUnlockRules(balance);
  const rule = rules[jobId];
  if (!rule) return false;
  if (rule.always) return true;
  if (!meetsCondition(state, rule.when)) return false;
  if (rule.when?.buildingUnlocked && !isFarmBuildingUnlocked(rule.when.buildingUnlocked, state, balance)) {
    return false;
  }
  return true;
}

export function isGatheringJobUnlocked(jobId, state, balance) {
  if (!GATHERING_JOB_IDS.includes(jobId)) return false;
  return isJobUnlocked(jobId, state, balance);
}

export function isFarmBuildingUnlocked(buildingId, state, balance) {
  const rules = getJobUnlockRules(balance);
  const rule = rules[`farm_${buildingId}`] || rules.farm?.[buildingId];
  if (!rule) return false;
  if (rule.always) return true;
  return meetsCondition(state, rule.when);
}

export function isCraftJobUnlocked(jobId, state, balance) {
  if (!CRAFT_JOB_IDS.includes(jobId)) return false;
  return isJobUnlocked(jobId, state, balance);
}

export function isCombatUnlocked(state, balance) {
  return isJobUnlocked('combat', state, balance);
}

export function getUnlockedGatheringJobs(state, balance) {
  return GATHERING_JOB_IDS.filter((id) => isGatheringJobUnlocked(id, state, balance));
}

export function getUnlockedFarmBuildings(state, balance) {
  return FARM_BUILDING_IDS.filter((id) => isFarmBuildingUnlocked(id, state, balance));
}

export function getVisibleHarvestViews(state, balance) {
  return getUnlockedGatheringJobs(state, balance).map((id) => `job_${id}`);
}

export function getVisibleFarmViews(state, balance) {
  return getUnlockedFarmBuildings(state, balance).map((id) => `farm_${id}`);
}

export function getLockedJobsPreview(state, balance, jobs) {
  const rules = getJobUnlockRules(balance);
  const locked = [];
  for (const [key, rule] of Object.entries(rules)) {
    if (key.startsWith('farm_') || key === 'farm') continue;
    if (SPECIAL_VIEWS.includes(key) || GATHERING_JOB_IDS.includes(key) || CRAFT_JOB_IDS.includes(key)) {
      if (isJobUnlocked(key, state, balance)) continue;
      locked.push({
        id: key,
        label: jobs[key]?.name || rule.label || key,
        emoji: jobs[key]?.emoji || rule.emoji || '🔒',
        hint: rule.hint || 'Continue ta progression pour débloquer.',
      });
    }
  }
  return locked;
}

export function getJobUnlockHint(jobId, balance) {
  const rules = getJobUnlockRules(balance);
  return rules[jobId]?.hint || null;
}
