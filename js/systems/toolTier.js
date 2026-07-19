import { getJobEquippedTool } from './equipment.js';
import { hasWorkingTool, isDurabilityTool, isToolEffectActive } from './toolDurability.js';
import { getResourceTierIndex } from './progression.js';
import { isStarterHarvestResource } from './zones.js';

/**
 * Palier outil vs ressource :
 * index 0 (Blé…) → 0 = sans outil / pas d'usure
 * index 1 (Orge…) → 1 = faucille craftée avec la ressource 0
 * index 2 → 2, etc.
 */
export function getResourceHarvestTier(resource, resources = null) {
  if (resources && resource) {
    return getResourceTierIndex(resource, resources);
  }
  const lvl = resource?.requiredJobLevel || 1;
  if (lvl <= 1) return 0;
  return Math.floor(lvl / 20);
}

export function getRecipeToolTier(recipe) {
  if (recipe?.toolTier) return recipe.toolTier;
  const lvl = recipe?.requiredJobLevel ?? 1;
  if (lvl <= 1) return 1;
  return Math.floor(lvl / 20);
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

function findOwnedWorkingToolForJob(state, jobId, recipes, minTier = 1, toolKind = null) {
  let best = null;
  for (const recipeId of state.crafted || []) {
    const recipe = recipes[recipeId];
    if (!recipe || recipe.effect?.job !== jobId) continue;
    if (!isDurabilityTool(recipe)) continue;
    if (!isToolEffectActive(state, recipeId, recipe)) continue;
    if (toolKind && (recipe.toolKind || 'bucket') !== toolKind) continue;
    const tier = getRecipeToolTier(recipe);
    if (tier < minTier) continue;
    if (!best || tier > getRecipeToolTier(best)) best = recipe;
  }
  return best;
}

export function getFarmToolKindLabel(toolKind) {
  if (toolKind === 'basket') return 'panier';
  return 'seau';
}

export function getFarmToolCheck(state, recipes, equipmentData, building = null) {
  const toolKind = building?.toolKind || 'bucket';
  const kindLabel = getFarmToolKindLabel(toolKind);
  const recipe = getGatheringToolRecipe(state, 'breeder', recipes);

  if (recipe) {
    const equippedKind = recipe.toolKind || 'bucket';
    if (equippedKind !== toolKind) {
      const owned = findOwnedWorkingToolForJob(state, 'breeder', recipes, building?.toolTier || 1, toolKind);
      if (owned) {
        return {
          ok: false,
          reason: 'wrong_tool',
          message: `Équipe ton ${kindLabel} « ${owned.name} » (Perso → Outils). Le ${getFarmToolKindLabel(equippedKind)} sert ailleurs.`,
          recipe: null,
        };
      }
      return {
        ok: false,
        reason: 'wrong_tool',
        message: `Il te faut un ${kindLabel} d'éleveur (Atelier Outilleur), pas un ${getFarmToolKindLabel(equippedKind)}.`,
        recipe: null,
      };
    }
    return { ok: true, recipe };
  }

  const owned = findOwnedWorkingToolForJob(state, 'breeder', recipes, building?.toolTier || 1, toolKind);
  if (owned) {
    return {
      ok: false,
      reason: 'not_equipped',
      message: `Tu possèdes « ${owned.name} » — équipe-le sur Perso → Outils.`,
      recipe: null,
    };
  }
  return {
    ok: false,
    reason: 'no_tool',
    message: `Craft et équipe un ${kindLabel} d'éleveur (Perso → Outils / Atelier Outilleur).`,
    recipe: null,
  };
}

export function getHarvestToolCheck(state, jobId, resource, recipes, equipmentData, resources = null) {
  const recipe = getGatheringToolRecipe(state, jobId, recipes);
  const resourceTier = getResourceHarvestTier(resource, resources);

  if (!recipe) {
    if (resources && isStarterHarvestResource(resource, resources)) {
      return { ok: true };
    }
    if (resourceTier <= 0) {
      return { ok: true };
    }
    const owned = findOwnedWorkingToolForJob(state, jobId, recipes, resourceTier);
    if (owned) {
      return {
        ok: false,
        reason: 'not_equipped',
        message: `Tu possèdes « ${owned.name} » — équipe-la sur Perso → Outils.`,
      };
    }
    return {
      ok: false,
      reason: 'no_tool',
      message: resourceTier <= 1
        ? 'Équipe un outil sur Perso → Outils, ou fabrique-le à l\'Atelier Outilleur.'
        : `Outil palier ${resourceTier} requis — fabrique-le à l'Atelier Outilleur.`,
    };
  }

  // Ressource starter : outil optionnel, pas de contrôle de palier
  if (resourceTier <= 0 || (resources && isStarterHarvestResource(resource, resources))) {
    return { ok: true, recipe };
  }

  const toolTier = getRecipeToolTier(recipe);
  if (toolTier !== resourceTier) {
    return {
      ok: false,
      reason: toolTier < resourceTier ? 'tier' : 'wrong_tier',
      message: toolTier < resourceTier
        ? `Outil insuffisant (palier ${toolTier}) pour ${resource.name} (palier ${resourceTier}).`
        : `Outil palier ${toolTier} inadapté pour ${resource.name} (palier ${resourceTier} requis).`,
    };
  }

  return { ok: true, recipe };
}

export function listToolsForJob(recipes, jobId) {
  return Object.entries(recipes)
    .filter(([, r]) => r.effect?.job === jobId && isDurabilityTool(r))
    .map(([id, r]) => ({ id, recipe: r, tier: getRecipeToolTier(r) }));
}

export function toolMatchesResourceTier(recipe, resource, resources) {
  if (!recipe?.toolTier || !resource) return true;
  const resourceTier = getResourceHarvestTier(resource, resources);
  if (resourceTier <= 0) return false; // starter : pas d'usure
  return getRecipeToolTier(recipe) === resourceTier;
}
