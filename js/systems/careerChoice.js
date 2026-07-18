/** Onboarding simplifié : pseudo + arme. Déblocages progressifs via jobUnlock.js */

export const GATHERING_JOB_IDS = ['lumberjack', 'fisher', 'miner', 'farmer', 'alchemist'];

export const STARTER_WEAPON_CHOICES = [
  {
    weaponType: 'sword_shield',
    itemId: 'set_sakura_guardian_blade',
    label: 'Guerrier',
    emoji: '🛡️',
    bonus: 'Bonus défense',
    description: 'Épée + bouclier pour encaisser les gros combats.',
  },
  {
    weaponType: 'bow',
    itemId: 'set_sakura_bow',
    label: 'Archer',
    emoji: '🏹',
    bonus: 'Bonus attaque',
    description: 'Arc pour frapper fort et vite.',
  },
  {
    weaponType: 'staff',
    itemId: 'set_sakura_staff',
    label: 'Mage',
    emoji: '🪄',
    bonus: 'Bonus mixte',
    description: 'Bâton pour mélanger dégâts, contrôle et soin.',
  },
];

export const STARTER_WEAPON_TYPES = STARTER_WEAPON_CHOICES.map((choice) => choice.weaponType);

export {
  isGatheringJobUnlocked,
  isFarmBuildingUnlocked,
  getUnlockedGatheringJobs,
  getUnlockedFarmBuildings,
  getVisibleHarvestViews,
  getVisibleFarmViews,
  isCraftJobUnlocked,
  isCombatUnlocked,
  getNextGatheringJobUnlock,
  getUpcomingGatheringJobUnlocks,
  getRecolteNavItems,
  getJobSwitcherItems,
  getFeatureUnlockProgress,
  getGatheringJobUnlockProgress,
} from './jobUnlock.js';

export function needsCareerChoice(state) {
  return !isCareerChoiceComplete(state.careerChoice);
}

export function isCareerChoiceComplete(careerChoice) {
  if (!careerChoice?.confirmed) return false;
  if (!careerChoice.starterWeaponsGranted) return false;
  return STARTER_WEAPON_TYPES.includes(careerChoice.weaponType);
}

export function migrateCareerChoice(saved) {
  if (!saved) return null;
  if (isCareerChoiceComplete(saved)) {
    return {
      confirmed: true,
      weaponType: saved.weaponType,
      teamWeaponTypes: saved.teamWeaponTypes || [],
      starterWeaponsGranted: saved.starterWeaponsGranted,
    };
  }
  if (saved.confirmed && saved.weaponType) {
    return {
      confirmed: true,
      weaponType: saved.weaponType,
      teamWeaponTypes: saved.teamWeaponTypes || [],
      starterWeaponsGranted: saved.starterWeaponsGranted ?? false,
    };
  }
  return null;
}

export function validateOnboarding(weaponType) {
  if (!STARTER_WEAPON_TYPES.includes(weaponType)) {
    return { ok: false, reason: 'Choisis ton arme de départ.' };
  }
  return { ok: true, weaponType };
}

export function applyCareerChoice(state, _gatheringJobs, _farmBuildings, weaponType) {
  const check = validateOnboarding(weaponType);
  if (!check.ok) return check;
  const teamWeaponTypes = [
    check.weaponType,
    ...STARTER_WEAPON_TYPES.filter((type) => type !== check.weaponType),
  ];
  state.careerChoice = {
    confirmed: true,
    weaponType: check.weaponType,
    teamWeaponTypes,
    starterWeaponsGranted: false,
  };
  return { ok: true, careerChoice: state.careerChoice };
}
