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
  if (condition.buildingLevel) {
    for (const [buildingId, minLevel] of Object.entries(condition.buildingLevel)) {
      const lv = state.farmBuildingMeta?.[buildingId]?.level || 1;
      if (lv < minLevel) return false;
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

function buildJobLevelGates(when, state, jobs = {}) {
  if (!when?.jobLevel) return [];
  return Object.entries(when.jobLevel).map(([jobId, requiredLevel]) => {
    const currentLevel = state.jobs?.[jobId]?.level || 1;
    return {
      type: 'jobLevel',
      jobId,
      jobName: jobs[jobId]?.name || jobId,
      requiredLevel,
      currentLevel,
      progress: Math.min(1, currentLevel / requiredLevel),
      ready: currentLevel >= requiredLevel,
    };
  });
}

function buildBuildingLevelGates(when, state) {
  if (!when?.buildingLevel) return [];
  return Object.entries(when.buildingLevel).map(([buildingId, requiredLevel]) => {
    const currentLevel = state.farmBuildingMeta?.[buildingId]?.level || 1;
    return {
      type: 'buildingLevel',
      buildingId,
      jobName: FARM_BUILDING_LABELS[buildingId] || buildingId,
      requiredLevel,
      currentLevel,
      progress: Math.min(1, currentLevel / requiredLevel),
      ready: currentLevel >= requiredLevel,
    };
  });
}

function buildUnlockGates(rule, state, balance, jobs = {}) {
  if (!rule?.when) return [];
  const when = rule.when;
  const gates = [
    ...buildJobLevelGates(when, state, jobs),
    ...buildBuildingLevelGates(when, state),
  ];

  if (when.characterLevel != null) {
    const currentLevel = state.character?.level || 1;
    gates.push({
      type: 'characterLevel',
      jobName: 'Personnage',
      requiredLevel: when.characterLevel,
      currentLevel,
      progress: Math.min(1, currentLevel / when.characterLevel),
      ready: currentLevel >= when.characterLevel,
    });
  }

  if (when.totalHarvests != null) {
    const current = state.stats?.totalHarvests || state.lifetimeStats?.totalHarvests || 0;
    gates.push({
      type: 'totalHarvests',
      jobName: 'Récoltes totales',
      requiredLevel: when.totalHarvests,
      currentLevel: current,
      progress: Math.min(1, current / when.totalHarvests),
      ready: current >= when.totalHarvests,
    });
  }

  if (when.buildingUnlocked) {
    const buildingId = when.buildingUnlocked;
    const ready = isFarmBuildingUnlocked(buildingId, state, balance);
    const buildingRule = getJobUnlockRules(balance).farm?.[buildingId]
      || getJobUnlockRules(balance)[`farm_${buildingId}`];
    const buildingGates = buildingRule ? buildUnlockGates(buildingRule, state, balance, jobs) : [];
    const buildingProgress = ready
      ? 1
      : (buildingGates.length
        ? buildingGates.reduce((sum, gate) => sum + gate.progress, 0) / buildingGates.length
        : 0);
    gates.push({
      type: 'building',
      buildingId,
      buildingName: FARM_BUILDING_LABELS[buildingId] || buildingId,
      progress: buildingProgress,
      ready,
      subGates: buildingGates,
    });
  }

  return gates;
}

function summarizeUnlockGates(gates) {
  const ready = gates.length > 0 && gates.every((gate) => gate.ready);
  const progress = gates.length
    ? gates.reduce((sum, gate) => sum + gate.progress, 0) / gates.length
    : 0;
  return { ready, progress };
}

function countReadyGates(gates) {
  return gates.filter((gate) => gate.ready).length;
}

function legacyGateFields(gates) {
  const pending = gates.find((gate) => !gate.ready) || gates[0];
  if (!pending) return {};
  return {
    gateJob: pending.jobId,
    requiredLevel: pending.requiredLevel,
    currentLevel: pending.currentLevel,
    remaining: Math.max(0, (pending.requiredLevel || 0) - (pending.currentLevel || 0)),
  };
}

/** Progression vers le déblocage d'un métier de récolte verrouillé. */
export function getGatheringJobUnlockProgress(jobId, state, balance, jobs = {}) {
  if (!GATHERING_JOB_IDS.includes(jobId) || jobId === 'farmer') return null;
  if (isGatheringJobUnlocked(jobId, state, balance)) return null;

  const rule = getJobUnlockRules(balance)[jobId];
  const gates = buildUnlockGates(rule, state, balance, jobs);
  if (!gates.length) return null;

  const { ready, progress } = summarizeUnlockGates(gates);

  return {
    jobId,
    gates,
    ready,
    progress,
    hint: rule?.hint || null,
    viewId: `job_${jobId}`,
    ...legacyGateFields(gates),
  };
}

/** Prochains métiers de récolte à débloquer (triés par niveau requis). */
export function getUpcomingGatheringJobUnlocks(state, balance, jobs, limit = 4) {
  return GATHERING_JOB_IDS
    .filter((id) => id !== 'farmer' && !isGatheringJobUnlocked(id, state, balance))
    .map((id) => {
      const progress = getGatheringJobUnlockProgress(id, state, balance, jobs);
      if (!progress) return null;
      return {
        ...progress,
        label: jobs[id]?.name || id,
        emoji: jobs[id]?.emoji || '🔒',
        viewId: `job_${id}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const readyDiff = countReadyGates(b.gates) - countReadyGates(a.gates);
      if (readyDiff !== 0) return readyDiff;
      return b.progress - a.progress;
    })
    .slice(0, limit);
}

export function getNextGatheringJobUnlock(state, balance, jobs) {
  return getUpcomingGatheringJobUnlocks(state, balance, jobs, 1)[0] || null;
}

/** Dock horizontal récolte + ferme (prochain métier verrouillé après Paysan). */
export function getJobSwitcherItems(state, balance, jobs = {}) {
  return [
    ...getRecolteNavItems(state, balance, jobs),
    ...getVisibleFarmViews(state, balance).map((viewId) => ({ kind: 'view', viewId })),
  ];
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

  const gates = buildUnlockGates(rule, state, balance, jobs);
  const { ready, progress } = summarizeUnlockGates(gates);

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
