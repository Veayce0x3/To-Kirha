import { resolveItem } from './combat.js';
import { assignSlotResource, ensureSlots } from './slots.js';

const DEFAULT_REWARDS_CLAIMED = {
  materials: false,
  harvestKirha: false,
  scrollPrep: false,
  graduateKirha: false,
  dungeonDrops: false,
};

export function normalizeRewardsClaimed(saved) {
  if (!saved) return { ...DEFAULT_REWARDS_CLAIMED };
  if (saved === true) {
    return Object.fromEntries(Object.keys(DEFAULT_REWARDS_CLAIMED).map((k) => [k, true]));
  }
  return { ...DEFAULT_REWARDS_CLAIMED, ...saved };
}

export function hasTutorialRewardsClaimed(state) {
  const rc = state.tutorial?.rewardsClaimed;
  if (!rc) return false;
  if (rc === true) return true;
  return Object.values(rc).some(Boolean);
}

export function canClaimTutorialReward(state, key) {
  if (!state.tutorial?.sandbox || !key) return false;
  const rc = normalizeRewardsClaimed(state.tutorial.rewardsClaimed);
  state.tutorial.rewardsClaimed = rc;
  return !rc[key];
}

export function claimTutorialReward(state, key, applyFn) {
  if (!canClaimTutorialReward(state, key)) return false;
  applyFn();
  state.tutorial.rewardsClaimed[key] = true;
  return true;
}

/** Arme imposée pendant la formation (Chevalier / Katana Sakura). */
export const TUTORIAL_WEAPON_TYPE = 'longsword';
export const TUTORIAL_RECIPE_ID = 'tutorial_sakura_blade';

export const WEAPON_TYPE_RECIPES = {
  sword_shield: 'set_sakura_guardian_blade',
  longsword: 'set_sakura_weapon',
  bow: 'set_sakura_bow',
  staff: 'set_sakura_staff',
  dagger: 'set_sakura_dagger',
  spear: 'set_sakura_spear',
};

export const WEAPON_GALLERY_ORDER = [
  'sword_shield',
  'longsword',
  'bow',
  'staff',
  'spear',
  'dagger',
];

export function ensureTutorialFlags(state) {
  if (!state.tutorial) return;
  if (!state.tutorial.flags) {
    state.tutorial.flags = {
      harvestDone: false,
      weaponChosen: false,
      weaponCrafted: false,
      weaponEquipped: false,
      dungeonWon: false,
      scrollBought: false,
    };
  }
}

export function getChosenTutorialRecipeId(state) {
  if (state.tutorial?.sandbox) {
    if (state.tutorial.flags?.weaponChosen || state.tutorial.chosenRecipeId === TUTORIAL_RECIPE_ID) {
      return TUTORIAL_RECIPE_ID;
    }
    return null;
  }
  const type = state.tutorial?.chosenWeaponType;
  return type ? WEAPON_TYPE_RECIPES[type] : state.tutorial?.chosenRecipeId || null;
}

export function getCraftJobForRecipe(recipes, recipeId) {
  return recipes[recipeId]?.craftJob || 'blacksmith';
}

export function ownsTutorialChosenWeapon(state, recipes, combatItems) {
  const combatItemId = recipes[TUTORIAL_RECIPE_ID]?.combatItem;
  if (!combatItemId) return false;
  return (state.ownedCombatItems || []).some((ref) => {
    const item = resolveItem(state, ref, combatItems);
    return item?.id === combatItemId;
  });
}

export function findTutorialWeaponOwnedRef(state, recipes, combatItems) {
  const combatItemId = recipes[TUTORIAL_RECIPE_ID]?.combatItem;
  if (!combatItemId) return null;
  return (state.ownedCombatItems || []).find((ref) => {
    const item = resolveItem(state, ref, combatItems);
    return item?.id === combatItemId;
  }) || null;
}

export function getTutorialWeaponSlotRef(state, recipes, combatItems) {
  const combatItemId = recipes[TUTORIAL_RECIPE_ID]?.combatItem;
  if (!combatItemId) return null;
  const weaponRef = state.combatEquipment?.weapon;
  if (!weaponRef) return null;
  const item = resolveItem(state, weaponRef, combatItems);
  return item?.id === combatItemId ? weaponRef : null;
}

export function reconcileTutorialWeaponProgress(state, recipes, combatItems) {
  if (!state.tutorial?.sandbox) return;
  ensureTutorialFlags(state);

  if (ownsTutorialChosenWeapon(state, recipes, combatItems)) {
    state.tutorial.flags.weaponChosen = true;
    state.tutorial.flags.weaponCrafted = true;
    state.tutorial.chosenWeaponType = TUTORIAL_WEAPON_TYPE;
    state.tutorial.chosenRecipeId = TUTORIAL_RECIPE_ID;
  }

  if (checkTutorialWeaponEquipped(state, recipes, combatItems)) {
    state.tutorial.flags.weaponEquipped = true;
  }
}

/** Garantit les matériaux pour forger pendant la formation. */
export function ensureTutorialCraftSupplies(state, recipes) {
  if (!state.tutorial?.sandbox) return;
  const recipe = recipes?.[TUTORIAL_RECIPE_ID];
  if (!recipe) return;

  if (!state.tutorial.flags.weaponChosen) {
    state.tutorial.chosenWeaponType = TUTORIAL_WEAPON_TYPE;
    state.tutorial.chosenRecipeId = TUTORIAL_RECIPE_ID;
    state.tutorial.flags.weaponChosen = true;
  }
  grantRecipeIngredients(state, recipes, TUTORIAL_RECIPE_ID);
}

/** Formation : arme de débutant unique (pas de galerie 6 armes). */
export function acceptTutorialStarterWeapon(state, recipes, combatItems = null) {
  ensureTutorialFlags(state);
  state.tutorial.chosenWeaponType = TUTORIAL_WEAPON_TYPE;
  state.tutorial.chosenRecipeId = TUTORIAL_RECIPE_ID;
  state.tutorial.flags.weaponChosen = true;
  grantRecipeIngredients(state, recipes, TUTORIAL_RECIPE_ID);

  if (combatItems) {
    reconcileTutorialWeaponProgress(state, recipes, combatItems);
  }
  return true;
}

/** @deprecated Utiliser acceptTutorialStarterWeapon */
export function chooseTutorialWeapon(state, weaponType, recipes, combatItems = null) {
  if (state.tutorial?.sandbox) {
    return acceptTutorialStarterWeapon(state, recipes, combatItems);
  }
  const recipeId = WEAPON_TYPE_RECIPES[weaponType];
  if (!recipeId) return false;

  ensureTutorialFlags(state);
  state.tutorial.chosenWeaponType = weaponType;
  state.tutorial.chosenRecipeId = recipeId;
  state.tutorial.flags.weaponChosen = true;
  grantRecipeIngredients(state, recipes, recipeId);

  if (combatItems) {
    reconcileTutorialWeaponProgress(state, recipes, combatItems);
  }
  return true;
}

export function grantRecipeIngredients(state, recipes, recipeId) {
  if (!canClaimTutorialReward(state, 'materials')) return false;
  const recipe = recipes[recipeId];
  if (!recipe?.ingredients) return false;
  claimTutorialReward(state, 'materials', () => {
    for (const [resId, qty] of Object.entries(recipe.ingredients)) {
      state.inventory[resId] = Math.max(state.inventory[resId] || 0, qty);
    }
  });
  return true;
}

export function bootstrapTutorialStep(state, balance, recipes, stepId) {
  ensureTutorialFlags(state);
  ensureSlots(state, balance);

  if (stepId === 'harvest') {
    assignSlotResource(state, 'lumberjack', 0, 'frene');
    claimTutorialReward(state, 'harvestKirha', () => {
      if (state.kirha < 20) state.kirha = 20;
    });
    return;
  }

  if (stepId === 'craft') {
    ensureTutorialCraftSupplies(state, recipes);
    return;
  }

  if (stepId === 'scrolls') {
    claimTutorialReward(state, 'scrollPrep', () => {
      if (state.kirha < 50) state.kirha = 50;
      state.inventory.frene = (state.inventory.frene || 0) + 10;
    });
  }
}

export function isTutorialHarvestStep(state, tutorialData) {
  if (!state.tutorial?.sandbox || hasTutorialRewardsClaimed(state)) return false;
  const step = tutorialData?.steps?.[state.tutorial.stepIndex];
  return step?.id === 'harvest' && !state.tutorial.flags?.harvestDone;
}

export function getTutorialHarvestDurationMs(defaultMs) {
  return Math.min(defaultMs, 1200);
}

export function markTutorialHarvestDone(state) {
  ensureTutorialFlags(state);
  state.tutorial.flags.harvestDone = true;
}

export function checkTutorialWeaponEquipped(state, recipes, combatItems) {
  const combatItemId = recipes[TUTORIAL_RECIPE_ID]?.combatItem;
  if (!combatItemId) return false;

  const weaponRef = state.combatEquipment?.weapon;
  if (!weaponRef) return false;

  const equipped = resolveItem(state, weaponRef, combatItems);
  return equipped?.id === combatItemId;
}

export function markTutorialWeaponCrafted(state) {
  ensureTutorialFlags(state);
  state.tutorial.flags.weaponCrafted = true;
}

export function markTutorialWeaponEquipped(state) {
  ensureTutorialFlags(state);
  state.tutorial.flags.weaponEquipped = true;
}

export function markTutorialDungeonWon(state) {
  ensureTutorialFlags(state);
  state.tutorial.flags.dungeonWon = true;
}

export function markTutorialScrollBought(state) {
  ensureTutorialFlags(state);
  state.tutorial.flags.scrollBought = true;
}

export function graduateTutorial(state) {
  if (!state.tutorial) return;
  state.tutorial.sandbox = false;
  state.tutorial.completed = true;
  state.tutorial.replay = false;
  claimTutorialReward(state, 'graduateKirha', () => {
    if (state.kirha < 30) state.kirha = Math.max(state.kirha, 30);
  });
}
