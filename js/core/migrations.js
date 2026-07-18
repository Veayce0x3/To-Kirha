import {
  migrateSlotsToProductionLines,
  getMaxUnitsPerResource,
  getJobHarvestResources,
  ensureProductionLines,
} from '../systems/productionLines.js';
import { clearProgressionCache } from '../systems/progression.js';
import { isJobUnlocked } from '../systems/jobUnlock.js';
import { migrateAchievements } from '../systems/achievements.js';

function migrateCareerToProgressive(state) {
  if (!state.careerChoice) {
    state.careerChoice = { confirmed: false, starterWeaponsGranted: false };
    return;
  }
  if (state.careerChoice?.confirmed) {
    const cc = state.careerChoice;
    if (cc.gatheringJobs?.length && !cc.legacyGatheringJobs) {
      cc.legacyGatheringJobs = [...cc.gatheringJobs];
      cc.legacyFarmBuildings = [...(cc.farmBuildings || [])];
      delete cc.gatheringJobs;
      delete cc.farmBuildings;
    }
  }
}

function migrateProgressiveProductionUnlock(state, ctx) {
  const maxPer = getMaxUnitsPerResource(ctx.balance);
  for (const jobLines of Object.values(state.productionLines?.harvest || {})) {
    for (const line of Object.values(jobLines)) {
      if (line.units > maxPer) line.units = maxPer;
      if (line.slots?.length > maxPer) line.slots = line.slots.slice(0, maxPer);
    }
  }
}

function resetHarvestLinesForBeta(state, ctx) {
  if (!state.productionLines) state.productionLines = { harvest: {}, farm: {} };
  const jobs = ['farmer', 'lumberjack', 'fisher', 'miner', 'alchemist'];
  for (const jobId of jobs) {
    if (!isJobUnlocked(jobId, state, ctx.balance)) {
      delete state.productionLines.harvest[jobId];
      continue;
    }
    const tiers = getJobHarvestResources(ctx.resources, jobId);
    if (!tiers.length) continue;
    state.productionLines.harvest[jobId] = {
      [tiers[0].id]: { units: 1, slots: [{ active: null }] },
    };
  }
  state.productionLines.farm = {};
  state.farmBuildingMeta = {};
}

function clearLegacyCareerUnlocks(state, ctx) {
  if (state.careerChoice) {
    delete state.careerChoice.legacyGatheringJobs;
    delete state.careerChoice.legacyFarmBuildings;
    delete state.careerChoice.gatheringJobs;
    delete state.careerChoice.farmBuildings;
  }
  resetHarvestLinesForBeta(state, ctx);
}

const MIGRATIONS = {
  27(state, ctx) {
    migrateSlotsToProductionLines(state, ctx.resources, ctx.farmData, ctx.balance);
    migrateCareerToProgressive(state);
    clearProgressionCache();
  },
  28(state, ctx) {
    migrateProgressiveProductionUnlock(state, ctx);
    clearProgressionCache();
  },
  29(state, ctx) {
    resetHarvestLinesForBeta(state, ctx);
    clearProgressionCache();
  },
  30(state, ctx) {
    clearLegacyCareerUnlocks(state, ctx);
    clearProgressionCache();
  },
  31(state, ctx) {
    if (state.quests && !state.achievements) {
      state.achievements = migrateAchievements(state.quests);
      delete state.quests;
    }
    if (!state.achievements) {
      state.achievements = { completed: [], progress: {}, bonuses: { kirha: 0, xp: 0, harvestSpeed: 0 } };
    }
    clearProgressionCache();
  },
  32(state, ctx) {
    ensureProductionLines(state, ctx.resources, ctx.farmData, ctx.balance);
    clearProgressionCache();
  },
};

export function runSaveMigrations(state, ctx) {
  const target = ctx.balance?.saveVersion ?? 32;
  let version = state.saveVersion ?? 0;
  while (version < target) {
    version += 1;
    MIGRATIONS[version]?.(state, ctx);
    state.saveVersion = version;
  }
  return state;
}
