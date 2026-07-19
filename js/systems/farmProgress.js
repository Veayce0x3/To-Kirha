/**
 * Progression par bâtiment de ferme (poulailler, étable…) — indépendante du métier Éleveur.
 */

import { getXpForLevel } from './harvest.js';
import { getSeasonLevelCap } from './prestige.js';

/** Bâtiments qui gagnent de l’XP (pas le Puits). */
export const FARM_XP_BUILDING_IDS = [
  'chicken_coop',
  'barn',
  'sheepfold',
  'pigsty',
  'beehive',
];

function xpJobTemplate(jobs) {
  return jobs?.breeder || {
    maxLevel: 200,
    xpPerLevel: 100,
    xpScaling: 1.12,
  };
}

export function getFarmBuildingMetaProgress(state, buildingId) {
  if (!state.farmBuildingMeta) state.farmBuildingMeta = {};
  if (!state.farmBuildingMeta[buildingId]) {
    state.farmBuildingMeta[buildingId] = {
      hasAnimal: false,
      feedId: null,
      cyclesLeft: 0,
      level: 1,
      xp: 0,
    };
  }
  const meta = state.farmBuildingMeta[buildingId];
  if (meta.level == null || meta.level < 1) meta.level = 1;
  if (meta.xp == null || meta.xp < 0) meta.xp = 0;
  if (meta.cyclesLeft == null) meta.cyclesLeft = meta.hasAnimal ? 12 : 0;
  return meta;
}

export function getFarmBuildingLevel(state, buildingId) {
  if (!buildingId || buildingId === 'well') return 1;
  return getFarmBuildingMetaProgress(state, buildingId).level || 1;
}

export function getFarmBuildingProgress(state, buildingId, jobs, balance) {
  const job = xpJobTemplate(jobs);
  if (!buildingId || buildingId === 'well') {
    return {
      level: 1,
      xp: 0,
      needed: getXpForLevel(job, 1),
      seasonCap: null,
      atSeasonCap: false,
      grantsXp: false,
    };
  }

  const meta = getFarmBuildingMetaProgress(state, buildingId);
  const cap = balance ? getSeasonLevelCap('jobs', state, balance) : job.maxLevel;
  const needed = getXpForLevel(job, meta.level);
  return {
    level: meta.level,
    xp: meta.xp,
    needed,
    seasonCap: cap,
    atSeasonCap: meta.level >= cap,
    grantsXp: true,
  };
}

/** Miroir jobs.breeder = max des bâtiments (prestige / rétrocompat). */
export function syncBreederJobFromBuildings(state) {
  if (!state.jobs) state.jobs = {};
  if (!state.jobs.breeder) state.jobs.breeder = { level: 1, xp: 0 };
  let maxLv = 1;
  let xpAtMax = 0;
  for (const id of FARM_XP_BUILDING_IDS) {
    const meta = state.farmBuildingMeta?.[id];
    if (!meta) continue;
    const lv = meta.level || 1;
    if (lv > maxLv) {
      maxLv = lv;
      xpAtMax = meta.xp || 0;
    } else if (lv === maxLv) {
      xpAtMax = Math.max(xpAtMax, meta.xp || 0);
    }
  }
  state.jobs.breeder.level = maxLv;
  state.jobs.breeder.xp = xpAtMax;
}

/**
 * Ajoute de l’XP au bâtiment. Retourne { leveledUp, level, buildingId } ou null.
 */
export function addFarmBuildingXp(state, buildingId, xp, jobs, balance) {
  if (!buildingId || buildingId === 'well' || !(xp > 0)) return null;
  const job = xpJobTemplate(jobs);
  const meta = getFarmBuildingMetaProgress(state, buildingId);
  const cap = balance ? getSeasonLevelCap('jobs', state, balance) : job.maxLevel;
  if (meta.level >= cap) {
    syncBreederJobFromBuildings(state);
    return null;
  }

  meta.xp += xp;
  let leveled = null;
  while (meta.level < Math.min(job.maxLevel, cap)) {
    const needed = getXpForLevel(job, meta.level);
    if (meta.xp < needed) break;
    meta.xp -= needed;
    meta.level += 1;
    leveled = { leveledUp: true, level: meta.level, buildingId };
    if (meta.level >= cap) {
      meta.xp = Math.min(meta.xp, Math.max(0, needed - 1));
      leveled.capped = true;
      break;
    }
    break;
  }

  syncBreederJobFromBuildings(state);
  return leveled;
}

/** Migration : copie le niveau Éleveur vers chaque bâtiment animal. */
export function migrateBreederXpToBuildings(state) {
  const src = state.jobs?.breeder || { level: 1, xp: 0 };
  const level = Math.max(1, src.level || 1);
  const xp = Math.max(0, src.xp || 0);
  if (!state.farmBuildingMeta) state.farmBuildingMeta = {};
  for (const id of FARM_XP_BUILDING_IDS) {
    const meta = getFarmBuildingMetaProgress(state, id);
    if ((meta.level || 1) < level) {
      meta.level = level;
      meta.xp = xp;
    } else if ((meta.level || 1) === level && (meta.xp || 0) < xp) {
      meta.xp = xp;
    }
  }
  syncBreederJobFromBuildings(state);
}
