import { getJobEquippedTool } from './equipment.js';
import { isDurabilityTool, isToolEffectActive, getToolUsesRemaining, getEffectiveMaxUses } from './toolDurability.js';
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

export function getGatheringToolRecipe(state, jobId, recipes, toolKind = null) {
  const recipeId = getJobEquippedTool(state, jobId, toolKind);
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
  const recipe = getGatheringToolRecipe(state, 'breeder', recipes, toolKind);

  if (recipe) {
    return { ok: true, recipe };
  }

  const owned = findOwnedWorkingToolForJob(state, 'breeder', recipes, building?.toolTier || 1, toolKind);
  if (owned) {
    return {
      ok: false,
      reason: 'not_equipped',
      message: `Tu possèdes « ${owned.name} » — équipe-le sur Perso → Outils (seau et panier peuvent être équipés ensemble).`,
      recipe: null,
    };
  }
  return {
    ok: false,
    reason: 'no_tool',
    message: `Craft et équipe un ${kindLabel} d'éleveur (Perso → Outils). Tu peux garder le seau et le panier équipés en même temps.`,
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
  if (resourceTier <= 0) return false;
  return getRecipeToolTier(recipe) === resourceTier;
}

/**
 * Outil usé (0 utilisations) correspondant au palier de la ressource —
 * même s’il a été déséquipé à la casse.
 */
export function findBrokenToolForResource(state, jobId, resource, recipes, resources = null) {
  if (!resource || !jobId) return null;
  const needTier = getResourceHarvestTier(resource, resources);
  if (needTier <= 0) return null;

  let best = null;
  for (const recipeId of state.crafted || []) {
    const recipe = recipes[recipeId];
    if (!recipe || recipe.effect?.job !== jobId) continue;
    if (!isDurabilityTool(recipe)) continue;
    const remaining = getToolUsesRemaining(state, recipeId);
    if (remaining === null || remaining > 0) continue;
    if (getRecipeToolTier(recipe) !== needTier) continue;
    if (!best || (recipe.name || '').localeCompare(best.recipe.name || '', 'fr') < 0) {
      best = { recipeId, recipe };
    }
  }
  return best;
}

/** Statut outil pour l’UI ligne de récolte (ok / bas / usé + refabrication). */
export function getHarvestLineToolStatus(state, jobId, resource, recipes, equipmentData, resources = null) {
  const check = getHarvestToolCheck(state, jobId, resource, recipes, equipmentData, resources);
  const equippedId = getJobEquippedTool(state, jobId);

  if (check.ok && check.recipe && equippedId && isDurabilityTool(check.recipe)) {
    const remaining = getToolUsesRemaining(state, equippedId);
    const max = getEffectiveMaxUses(state, check.recipe) || check.recipe.maxUses;
    if (remaining != null && max) {
      return {
        kind: remaining <= 3 ? 'low' : 'ok',
        recipeId: equippedId,
        recipe: check.recipe,
        remaining,
        max,
        label: `${remaining}/${max}`,
      };
    }
  }

  const broken = findBrokenToolForResource(state, jobId, resource, recipes, resources);
  if (broken) {
    const max = getEffectiveMaxUses(state, broken.recipe) || broken.recipe.maxUses || 0;
    return {
      kind: 'broken',
      recipeId: broken.recipeId,
      recipe: broken.recipe,
      remaining: 0,
      max,
      label: `0/${max}`,
    };
  }

  return null;
}
