import {
  migrateSlotsToProductionLines,
  getMaxUnitsPerResource,
  getJobHarvestResources,
} from '../systems/productionLines.js';
import { clearProgressionCache } from '../systems/progression.js';

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
    const tiers = getJobHarvestResources(ctx.resources, jobId);
    if (!tiers.length) continue;
    state.productionLines.harvest[jobId] = {
      [tiers[0].id]: { units: 1, slots: [{ active: null }] },
    };
  }
  // Reset farm lines except unlocked buildings get starter from ensureProductionLines on next init
  state.productionLines.farm = {};
  state.farmBuildingMeta = {};
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
};

export function runSaveMigrations(state, ctx) {
  const target = ctx.balance?.saveVersion ?? 29;
  let version = state.saveVersion ?? 0;
  while (version < target) {
    version += 1;
    MIGRATIONS[version]?.(state, ctx);
    state.saveVersion = version;
  }
  return state;
}
