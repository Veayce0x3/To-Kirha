import { getJobEquippedTool } from './equipment.js';
import { getToolUsesRemaining, hasWorkingTool, isDurabilityTool } from './toolDurability.js';

/** Palier outil requis : Nv.1 → 0, Nv.20 → 1, Nv.40 → 2… */
export function getResourceToolTier(resource) {
  const lvl = resource?.requiredJobLevel || 1;
  if (lvl <= 1) return 0;
  return Math.floor(lvl / 20);
}

export function getRecipeToolTier(recipe) {
  return recipe?.toolTier || 1;
}

export function getEquippedToolRecipe(state, recipes, jobId) {
  const recipeId = getJobEquippedTool(state, jobId);
  if (!recipeId) return null;
  return recipes[recipeId] || null;
}

export function getEquippedToolTier(state, recipes, jobId) {
  const recipe = getEquippedToolRecipe(state, recipes, jobId);
  if (!recipe) return 0;
  if (!hasWorkingTool(state, recipe.id, recipe)) return 0;
  return getRecipeToolTier(recipe);
}

export function canHarvestWithTool(resource, state, recipes, jobId) {
  const required = getResourceToolTier(resource);
  if (required <= 0) return true;
  const equipped = getEquippedToolTier(state, recipes, jobId);
  return equipped >= required;
}

export function getHarvestToolBlockReason(resource, state, recipes, jobs, jobId) {
  const required = getResourceToolTier(resource);
  if (required <= 0) return null;
  const recipeId = getJobEquippedTool(state, jobId);
  if (!recipeId) {
    const jobName = jobs[jobId]?.name || jobId;
    return { type: 'no_tool', message: `Équipe un outil de ${jobName} (Perso → Outils)` };
  }
  const recipe = recipes[recipeId];
  if (!recipe) {
    return { type: 'no_tool', message: 'Outil invalide' };
  }
  if (isDurabilityTool(recipe)) {
    const remaining = getToolUsesRemaining(state, recipeId);
    if (remaining !== null && remaining <= 0) {
      return { type: 'broken', message: `${recipe.name} usé — refabrique-le à l'Outilleur` };
    }
  }
  const tier = getRecipeToolTier(recipe);
  if (tier < required) {
    return {
      type: 'tier',
      message: `Palier ${required} requis pour ${resource.name} (outil palier ${tier})`,
    };
  }
  return null;
}

export function canUseFarmTool(building, state, recipes) {
  const jobId = building.toolJob || 'breeder';
  const required = building.toolTier || 1;
  return getEquippedToolTier(state, recipes, jobId) >= required;
}

export function getFarmToolBlockReason(building, state, recipes) {
  const jobId = building.toolJob || 'breeder';
  const recipeId = getJobEquippedTool(state, jobId);
  if (!recipeId) {
    return { type: 'no_tool', message: 'Équipe un seau d\'Éleveur (Perso → Outils)' };
  }
  const recipe = recipes[recipeId];
  if (!recipe || !hasWorkingTool(state, recipe.id, recipe)) {
    return { type: 'broken', message: 'Outil d\'élevage usé — refabrique-le' };
  }
  const tier = getRecipeToolTier(recipe);
  const required = building.toolTier || 1;
  if (tier < required) {
    return { type: 'tier', message: `Outil palier ${required} requis pour ${building.name}` };
  }
  return null;
}
