import { migrateSlotsToProductionLines } from '../systems/productionLines.js';
import { clearProgressionCache } from '../systems/progression.js';

function migrateCareerToProgressive(state) {
  if (!state.careerChoice) {
    state.careerChoice = { confirmed: false, starterWeaponsGranted: false };
    return;
  }
  if (state.careerChoice.confirmed && state.careerChoice.gatheringJobs?.length) {
    state.careerChoice = {
      confirmed: true,
      weaponType: state.careerChoice.weaponType,
      teamWeaponTypes: state.careerChoice.teamWeaponTypes || [],
      starterWeaponsGranted: state.careerChoice.starterWeaponsGranted ?? false,
      legacyGatheringJobs: state.careerChoice.gatheringJobs,
      legacyFarmBuildings: state.careerChoice.farmBuildings,
    };
  }
}

const MIGRATIONS = {
  27(state, ctx) {
    migrateSlotsToProductionLines(state, ctx.resources, ctx.farmData, ctx.balance);
    migrateCareerToProgressive(state);
    clearProgressionCache();
  },
};

export function runSaveMigrations(state, ctx) {
  const target = ctx.balance?.saveVersion ?? 27;
  let version = state.saveVersion ?? 0;
  while (version < target) {
    version += 1;
    MIGRATIONS[version]?.(state, ctx);
    state.saveVersion = version;
  }
  return state;
}
