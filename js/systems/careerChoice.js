/** Choix de carrière au lancement : 2 récolte + 2 bâtiments ferme (puits gratuit). */

export const GATHERING_JOB_IDS = ['lumberjack', 'fisher', 'miner', 'farmer', 'alchemist'];

/** Bâtiments choisissables (hors puits). */
export const PICKABLE_FARM_BUILDINGS = ['chicken_coop', 'barn', 'sheepfold', 'pigsty', 'beehive'];

export const FREE_FARM_BUILDING = 'well';

export const CAREER_PICK_COUNTS = { gathering: 2, farm: 2 };

export const RECOMMENDED_FARM_BY_GATHERING = {
  lumberjack: {
    building: 'barn',
    reason: 'cuir et lait utiles aux crafts, bon complément du bois'
  },
  fisher: {
    building: 'pigsty',
    reason: 'le Goujon nourrit la porcherie'
  },
  miner: {
    building: 'sheepfold',
    reason: 'la laine et le lait de brebis reviennent souvent avec les minerais'
  },
  farmer: {
    building: 'chicken_coop',
    reason: 'le Blé nourrit le poulailler dès le début'
  },
  alchemist: {
    building: 'beehive',
    reason: "l'Ortie nourrit les ruches"
  },
};

export function getRecommendedFarmBuildingsForGathering(gatheringJobs) {
  return [...new Set((gatheringJobs || [])
    .map((jobId) => RECOMMENDED_FARM_BY_GATHERING[jobId]?.building)
    .filter(Boolean))];
}

export const STARTER_WEAPON_CHOICES = [
  {
    weaponType: 'sword_shield',
    itemId: 'set_sakura_guardian_blade',
    label: 'Guerrier',
    emoji: '🛡️',
    bonus: 'Bonus défense',
    description: 'Épée + bouclier pour encaisser les gros combats.'
  },
  {
    weaponType: 'bow',
    itemId: 'set_sakura_bow',
    label: 'Archer',
    emoji: '🏹',
    bonus: 'Bonus attaque',
    description: 'Arc pour frapper fort et vite.'
  },
  {
    weaponType: 'staff',
    itemId: 'set_sakura_staff',
    label: 'Mage',
    emoji: '🪄',
    bonus: 'Bonus mixte',
    description: 'Bâton pour mélanger dégâts, contrôle et soin.'
  },
];

export const STARTER_WEAPON_TYPES = STARTER_WEAPON_CHOICES.map((choice) => choice.weaponType);

export function needsCareerChoice(state) {
  return !isCareerChoiceComplete(state.careerChoice);
}

/** Sauvegarde valide uniquement si confirmé avec sélection complète. */
export function isCareerChoiceComplete(careerChoice) {
  if (!careerChoice?.confirmed) return false;
  if (!careerChoice.starterWeaponsGranted) return false;
  const check = validateCareerSelection(
    careerChoice.gatheringJobs,
    careerChoice.farmBuildings,
    careerChoice.weaponType
  );
  return check.ok;
}

export function migrateCareerChoice(saved) {
  if (!saved) return null;
  if (isCareerChoiceComplete(saved)) return saved;
  const legacyCheck = validateCareerSelection(saved.gatheringJobs, saved.farmBuildings, 'sword_shield');
  if (legacyCheck.ok && saved.confirmed) {
    return {
      ...saved,
      weaponType: null,
      teamWeaponTypes: [],
      starterWeaponsGranted: false,
    };
  }
  return null;
}

export function validateCareerSelection(gatheringJobs, farmBuildings, weaponType) {
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
  if (!STARTER_WEAPON_TYPES.includes(weaponType)) {
    return { ok: false, reason: 'Choisis ton arme de départ.' };
  }
  return { ok: true, gatheringJobs: g, farmBuildings: f, weaponType };
}

export function applyCareerChoice(state, gatheringJobs, farmBuildings, weaponType) {
  const check = validateCareerSelection(gatheringJobs, farmBuildings, weaponType);
  if (!check.ok) return check;
  const teamWeaponTypes = [
    check.weaponType,
    ...STARTER_WEAPON_TYPES.filter((type) => type !== check.weaponType),
  ];
  state.careerChoice = {
    confirmed: true,
    gatheringJobs: check.gatheringJobs,
    farmBuildings: check.farmBuildings,
    weaponType: check.weaponType,
    teamWeaponTypes,
    starterWeaponsGranted: false,
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
