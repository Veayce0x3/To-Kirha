import { grantCombatItem } from './combat.js';
import { getEquippedRecipeIds } from './equipment.js';
import {
  hasWorkingTool,
  initToolDurability,
  isDurabilityTool,
  isToolEffectActive,
} from './toolDurability.js';

export function getRecipeCraftJob(recipe) {
  return recipe.craftJob || 'blacksmith';
}

export function getRecipeRequiredLevel(recipe) {
  if (recipe.combatItem) return 1;
  return recipe.requiredJobLevel ?? 1;
}

export function getRecipeJobXp(recipe) {
  return recipe.jobXp ?? 0;
}

export function isCraftJob(jobs, jobId) {
  return jobs[jobId] && jobs[jobId].gathering === false;
}

export function getCraftJobIds(jobs) {
  return Object.keys(jobs).filter((id) => isCraftJob(jobs, id));
}

export function canCraft(recipeId, recipes, state, balance, jobs) {
  const recipe = recipes[recipeId];
  if (!recipe) return false;

  if (recipe.tutorialOnly && !state.tutorial?.sandbox) return false;

  if (isDurabilityTool(recipe)) {
    if (hasWorkingTool(state, recipeId, recipe)) return false;
  } else if (recipe.unique && !recipe.repeatable && (state.crafted || []).includes(recipeId)) {
    return false;
  }
  if (recipe.requiresZone && !isZoneUnlocked(recipe.requiresZone, state, balance)) return false;

  if (recipe.requiresCrafted) {
    for (const req of recipe.requiresCrafted) {
      if (!(state.crafted || []).includes(req)) return false;
    }
  }

  const craftJob = getRecipeCraftJob(recipe);
  const required = getRecipeRequiredLevel(recipe);
  const jobLevel = state.jobs?.[craftJob]?.level || 1;
  if (!recipe.combatItem && jobLevel < required) return false;

  for (const [resId, amount] of Object.entries(recipe.ingredients)) {
    if ((state.inventory[resId] || 0) < amount) return false;
  }

  const kirhaCost = recipe.kirhaCost || 0;
  if (kirhaCost > 0 && (state.kirha || 0) < kirhaCost) return false;

  return true;
}

export function getCraftBlockReason(recipeId, recipes, state, balance, jobs) {
  const recipe = recipes[recipeId];
  if (!recipe) return null;

  if (recipe.tutorialOnly && !state.tutorial?.sandbox) {
    return { type: 'tutorial', message: 'Réservé à la formation' };
  }

  if (isDurabilityTool(recipe)) {
    if (hasWorkingTool(state, recipeId, recipe)) {
      return { type: 'owned', message: 'Outil encore utilisable' };
    }
  } else if (recipe.unique && !recipe.repeatable && (state.crafted || []).includes(recipeId)) {
    return { type: 'owned', message: 'Déjà possédé' };
  }

  if (recipe.requiresZone && !isZoneUnlocked(recipe.requiresZone, state, balance)) {
    return { type: 'zone', message: 'Zone non débloquée' };
  }

  if (recipe.requiresCrafted) {
    for (const req of recipe.requiresCrafted) {
      if (!(state.crafted || []).includes(req)) {
        return { type: 'prerequisite', message: 'Recette préalable requise' };
      }
    }
  }

  const craftJob = getRecipeCraftJob(recipe);
  const required = getRecipeRequiredLevel(recipe);
  const jobLevel = state.jobs?.[craftJob]?.level || 1;
  if (!recipe.combatItem && jobLevel < required) {
    const jobName = jobs[craftJob]?.name || craftJob;
    return { type: 'level', message: `${jobName} Nv.${required} requis (actuel : Nv.${jobLevel})` };
  }

  const missing = [];
  for (const [resId, amount] of Object.entries(recipe.ingredients)) {
    const have = state.inventory[resId] || 0;
    if (have < amount) missing.push({ resId, need: amount, have });
  }
  if (missing.length > 0) {
    return { type: 'ingredients', message: 'Ingrédients manquants', missing };
  }

  const kirhaCost = recipe.kirhaCost || 0;
  if (kirhaCost > 0 && (state.kirha || 0) < kirhaCost) {
    return {
      type: 'kirha',
      message: `${kirhaCost.toLocaleString('fr-FR')} 💰 requis (${(state.kirha || 0).toLocaleString('fr-FR')} 💰)`,
    };
  }

  return null;
}

export function craft(recipeId, recipes, state, balance, resources = {}, jobs = {}) {
  if (!canCraft(recipeId, recipes, state, balance, jobs)) return false;

  const recipe = recipes[recipeId];
  if (recipe.output && resources[recipe.output]?.merchantOnly) return false;
  for (const [resId, amount] of Object.entries(recipe.ingredients)) {
    state.inventory[resId] -= amount;
  }

  const kirhaCost = recipe.kirhaCost || 0;
  if (kirhaCost > 0) state.kirha -= kirhaCost;

  if (recipe.output) {
    const amount = recipe.outputAmount || 1;
    state.inventory[recipe.output] = (state.inventory[recipe.output] || 0) + amount;
  }

  if (recipe.combatItem) {
    grantCombatItem(state, recipe.combatItem);
  }

  if (isDurabilityTool(recipe)) {
    if (!state.crafted) state.crafted = [];
    if (!state.crafted.includes(recipeId)) state.crafted.push(recipeId);
    initToolDurability(state, recipeId, recipe.maxUses);
  } else if (recipe.unique && !recipe.repeatable) {
    if (!state.crafted) state.crafted = [];
    state.crafted.push(recipeId);
  }

  return recipe;
}

function isZoneUnlocked(zoneId, state, balance) {
  if (balance.zones[zoneId]?.unlocked) return true;
  return (state.unlockedZones || []).includes(zoneId);
}

export function getCraftBonus(state, recipes, jobId, resourceId, type) {
  let bonus = 0;
  const equipped = getEquippedRecipeIds(state);
  for (const recipeId of equipped) {
    const recipe = recipes[recipeId];
    if (!recipe?.effect) continue;
    if (!isToolEffectActive(state, recipeId, recipe)) continue;
    const eff = recipe.effect;
    if (eff.job === null && eff.type === type) {
      bonus += eff.bonus;
    } else if (eff.job === jobId && eff.type === type) {
      bonus += eff.bonus;
    } else if (eff.resource === resourceId && eff.type === type) {
      bonus += eff.bonus;
    }
  }
  return bonus;
}

export function getCraftSellBonus(state, jobs) {
  let maxLevel = 1;
  let rate = 0.01;
  for (const [id, job] of Object.entries(jobs)) {
    if (job.gathering !== false) continue;
    const level = state.jobs?.[id]?.level || 1;
    if (level > maxLevel) {
      maxLevel = level;
      rate = job.bonusesPerLevel?.craftValueBonus ?? rate;
    }
  }
  return 1 + (maxLevel - 1) * rate;
}

/** @deprecated use getCraftSellBonus */
export function getArtisanSellBonus(state, jobs) {
  return getCraftSellBonus(state, jobs);
}
