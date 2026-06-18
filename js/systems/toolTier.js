import { getJobEquippedTool } from './equipment.js';
import { isDurabilityTool, isToolEffectActive } from './toolDurability.js';
import { isStarterHarvestResource } from './zones.js';

export function getResourceHarvestTier(resource) {
  return Math.floor(((resource?.requiredJobLevel || 1) - 1) / 20) + 1;
}

export function getRecipeToolTier(recipe) {
  if (recipe?.toolTier) return recipe.toolTier;
  const lvl = recipe?.requiredJobLevel ?? 1;
  return Math.floor((lvl - 1) / 20) + 1;
}

export function getGatheringToolRecipe(state, jobId, recipes) {
  const recipeId = getJobEquippedTool(state, jobId);
  if (!recipeId) return null;
  const recipe = recipes[recipeId];
  if (!recipe) return null;
  const effJob = recipe.effect?.job;
  if (effJob != null && effJob !== jobId) return null;
  if (!isToolEffectActive(state, recipeId, recipe)) return null;
  return recipe;
}

export function getHarvestToolCheck(state, jobId, resource, recipes, equipmentData, resources = null) {
  const recipe = getGatheringToolRecipe(state, jobId, recipes);
  if (!recipe) {
    if (resources && isStarterHarvestResource(resource, resources)) {
      return { ok: true };
    }
    const resourceTier = getResourceHarvestTier(resource);
    return {
      ok: false,
      reason: 'no_tool',
      message: resourceTier <= 1
        ? 'Équipe un outil sur Perso → Outils, ou fabrique-le à l\'Atelier Outilleur.'
        : `Outil palier ${resourceTier} requis — fabrique-le à l'Atelier Outilleur.`,
    };
  }

  const resourceTier = getResourceHarvestTier(resource);
  const toolTier = getRecipeToolTier(recipe);
  if (toolTier < resourceTier) {
    return {
      ok: false,
      reason: 'tier',
      message: `Outil insuffisant (palier ${toolTier}) pour ${resource.name} (palier ${resourceTier}).`,
    };
  }

  return { ok: true, recipe };
}

export function getFarmToolCheck(state, recipes, equipmentData) {
  const recipe = getGatheringToolRecipe(state, 'breeder', recipes);
  if (!recipe) {
    return {
      ok: false,
      reason: 'no_tool',
      message: 'Équipe un outil d\'éleveur sur Perso → Outils (seau, panier…).',
    };
  }
  return { ok: true, recipe };
}

export function listToolsForJob(recipes, jobId) {
  return Object.entries(recipes)
    .filter(([, r]) => r.effect?.job === jobId && isDurabilityTool(r))
    .map(([id, r]) => ({ id, recipe: r, tier: getRecipeToolTier(r) }));
}
