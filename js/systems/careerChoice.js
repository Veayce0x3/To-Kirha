/** Choix de carrière au lancement : 2 récolte + 2 bâtiments ferme (puits gratuit). */

export const GATHERING_JOB_IDS = ['lumberjack', 'fisher', 'miner', 'farmer', 'alchemist'];

/** Bâtiments choisissables (hors puits). */
export const PICKABLE_FARM_BUILDINGS = ['chicken_coop', 'barn', 'sheepfold', 'pigsty', 'beehive'];

export const FREE_FARM_BUILDING = 'well';

export const CAREER_PICK_COUNTS = { gathering: 2, farm: 2 };

export function needsCareerChoice(state) {
  return !isCareerChoiceComplete(state.careerChoice);
}

/** Sauvegarde valide uniquement si confirmé avec sélection complète. */
export function isCareerChoiceComplete(careerChoice) {
  if (!careerChoice?.confirmed) return false;
  const check = validateCareerSelection(
    careerChoice.gatheringJobs,
    careerChoice.farmBuildings
  );
  return check.ok;
}

export function migrateCareerChoice(saved) {
  if (!saved) return null;
  if (isCareerChoiceComplete(saved)) return saved;
  return null;
}

export function validateCareerSelection(gatheringJobs, farmBuildings) {
  const g = [...new Set(gatheringJobs || [])];
  const f = [...new Set(farmBuildings || [])];
  if (g.length !== CAREER_PICK_COUNTS.gathering) {
    return { ok: false, reason: `Choisis exactement ${CAREER_PICK_COUNTS.gathering} métiers de récolte.` };
  }
  if (f.length !== CAREER_PICK_COUNTS.farm) {
    return { ok: false, reason: `Choisis exactement ${CAREER_PICK_COUNTS.farm} bâtiments de ferme.` };
  }
  if (!g.every((id) => GATHERING_JOB_IDS.includes(id))) {
    return { ok: false, reason: 'Métier de récolte invalide.' };
  }
  if (!f.every((id) => PICKABLE_FARM_BUILDINGS.includes(id))) {
    return { ok: false, reason: 'Bâtiment de ferme invalide.' };
  }
  return { ok: true, gatheringJobs: g, farmBuildings: f };
}

export function applyCareerChoice(state, gatheringJobs, farmBuildings) {
  const check = validateCareerSelection(gatheringJobs, farmBuildings);
  if (!check.ok) return check;
  state.careerChoice = {
    confirmed: true,
    gatheringJobs: check.gatheringJobs,
    farmBuildings: check.farmBuildings,
  };
  return { ok: true, careerChoice: state.careerChoice };
}

export function isGatheringJobUnlocked(jobId, state) {
  if (!state.careerChoice?.confirmed) return GATHERING_JOB_IDS.includes(jobId);
  return state.careerChoice.gatheringJobs.includes(jobId);
}

export function isFarmBuildingUnlocked(buildingId, state) {
  if (buildingId === FREE_FARM_BUILDING) return true;
  if (!state.careerChoice?.confirmed) return false;
  return state.careerChoice.farmBuildings.includes(buildingId);
}

export function getUnlockedGatheringJobs(state) {
  if (!state.careerChoice?.confirmed) return [...GATHERING_JOB_IDS];
  return state.careerChoice.gatheringJobs;
}

export function getUnlockedFarmBuildings(state) {
  const list = [FREE_FARM_BUILDING];
  if (!state.careerChoice?.confirmed) return list;
  return [...list, ...state.careerChoice.farmBuildings];
}

export function getVisibleHarvestViews(state) {
  return getUnlockedGatheringJobs(state).map((id) => `job_${id}`);
}

export function getVisibleFarmViews(state) {
  return getUnlockedFarmBuildings(state).map((id) => `farm_${id}`);
}
