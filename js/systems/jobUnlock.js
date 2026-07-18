/** Déblocages progressifs des métiers, bâtiments et vues. */

import { GATHERING_JOB_IDS } from './careerChoice.js';
import { FARM_BUILDING_IDS, FARM_BUILDING_LABELS } from './farm.js';

const FEATURE_UNLOCK_IDS = ['combat', 'toolmaker', 'cook'];
const FEATURE_VIEW_IDS = { combat: 'combat', toolmaker: 'workshop', cook: 'cuisine' };

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

function parseJobLevelGate(rule) {
  const levels = rule?.when?.jobLevel;
  if (!levels || typeof levels !== 'object') return null;
  const [gateJob, requiredLevel] = Object.entries(levels)[0] || [];
  if (!gateJob || requiredLevel == null) return null;
  return { gateJob, requiredLevel };
}

/** Progression vers le déblocage d'un métier de récolte verrouillé. */
export function getGatheringJobUnlockProgress(jobId, state, balance) {
  if (!GATHERING_JOB_IDS.includes(jobId) || jobId === 'farmer') return null;
  if (isGatheringJobUnlocked(jobId, state, balance)) return null;

  const rule = getJobUnlockRules(balance)[jobId];
  const gate = parseJobLevelGate(rule);
  if (!gate) return null;

  const currentLevel = state.jobs?.[gate.gateJob]?.level || 1;
  const remaining = Math.max(0, gate.requiredLevel - currentLevel);

  return {
    jobId,
    gateJob: gate.gateJob,
    requiredLevel: gate.requiredLevel,
    currentLevel,
    remaining,
    progress: Math.min(1, currentLevel / gate.requiredLevel),
    ready: currentLevel >= gate.requiredLevel,
    hint: rule?.hint || null,
  };
}

/** Prochains métiers de récolte à débloquer (triés par niveau requis). */
export function getUpcomingGatheringJobUnlocks(state, balance, jobs, limit = 4) {
  return GATHERING_JOB_IDS
    .filter((id) => id !== 'farmer' && !isGatheringJobUnlocked(id, state, balance))
    .map((id) => {
      const progress = getGatheringJobUnlockProgress(id, state, balance);
      if (!progress) return null;
      return {
        ...progress,
        label: jobs[id]?.name || id,
        emoji: jobs[id]?.emoji || '🔒',
        viewId: `job_${id}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.requiredLevel - b.requiredLevel)
    .slice(0, limit);
}

export function getNextGatheringJobUnlock(state, balance, jobs) {
  return getUpcomingGatheringJobUnlocks(state, balance, jobs, 1)[0] || null;
}

/** Entrées nav Récolte : métiers débloqués + prochain métier verrouillé juste après Paysan. */
export function getRecolteNavItems(state, balance, jobs = {}) {
  const unlockedViews = getUnlockedGatheringJobs(state, balance).map((id) => `job_${id}`);
  const next = getNextGatheringJobUnlock(state, balance, jobs);
  const items = [];

  for (const viewId of unlockedViews) {
    items.push({ kind: 'view', viewId });
    if (viewId === 'job_farmer' && next) {
      items.push({ kind: 'lockedJob', entry: next });
    }
  }

  return items;
}

/** Progression vers le déblocage d'une fonctionnalité (combat, atelier, cuisine). */
export function getFeatureUnlockProgress(featureId, state, balance, jobs = {}) {
  if (!FEATURE_UNLOCK_IDS.includes(featureId)) return null;
  if (isJobUnlocked(featureId, state, balance)) return null;

  const rule = getJobUnlockRules(balance)[featureId];
  if (!rule) return null;

  const when = rule.when || {};
  const gates = [];

  if (when.jobLevel) {
    for (const [jobId, requiredLevel] of Object.entries(when.jobLevel)) {
      const currentLevel = state.jobs?.[jobId]?.level || 1;
      gates.push({
        type: 'jobLevel',
        jobId,
        jobName: jobs[jobId]?.name || jobId,
        requiredLevel,
        currentLevel,
        progress: Math.min(1, currentLevel / requiredLevel),
        ready: currentLevel >= requiredLevel,
      });
    }
  }

  if (when.buildingUnlocked) {
    const buildingId = when.buildingUnlocked;
    const ready = isFarmBuildingUnlocked(buildingId, state, balance);
    const buildingRule = getJobUnlockRules(balance).farm?.[buildingId];
    const buildingGate = parseJobLevelGate(buildingRule);
    let progress = ready ? 1 : 0;
    let currentLevel = null;
    let requiredLevel = null;
    if (buildingGate && !ready) {
      currentLevel = state.jobs?.[buildingGate.gateJob]?.level || 1;
      requiredLevel = buildingGate.requiredLevel;
      progress = Math.min(1, currentLevel / requiredLevel);
    }
    gates.push({
      type: 'building',
      buildingId,
      buildingName: FARM_BUILDING_LABELS[buildingId] || buildingId,
      gateJob: buildingGate?.gateJob || null,
      requiredLevel,
      currentLevel,
      progress,
      ready,
    });
  }

  const ready = gates.every((gate) => gate.ready);
  const progress = gates.length
    ? gates.reduce((sum, gate) => sum + gate.progress, 0) / gates.length
    : 0;

  const labels = {
    combat: 'Combat',
    toolmaker: jobs.toolmaker?.name || 'Outilleur',
    cook: jobs.cook?.name || 'Cuisine',
  };
  const emojis = {
    combat: '⚔️',
    toolmaker: jobs.toolmaker?.emoji || '🛠️',
    cook: jobs.cook?.emoji || '👨‍🍳',
  };

  return {
    featureId,
    viewId: FEATURE_VIEW_IDS[featureId],
    label: labels[featureId],
    emoji: emojis[featureId],
    hint: rule.hint || null,
    gates,
    ready,
    progress,
  };
}
