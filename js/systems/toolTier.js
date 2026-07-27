import { getJobEquippedTool, equipForced } from './equipment.js';
import { isDurabilityTool, isToolEffectActive, getToolUsesRemaining, getEffectiveMaxUses } from './toolDurability.js';
import { getResourceTierIndex } from './progression.js';
import { isStarterHarvestResource } from './zones.js';

/**
 * Palier outil vs ressource (correspondance EXACTE) :
 * index 0 (Frêne / Blé…) → pas d'outil
 * index 1 (Séquoia…) → outil palier 1 (crafté avec la ressource 0)
 * index 2 (Chêne…) → outil palier 2 (crafté avec Séquoia), etc.
 * Un outil de palier N ne récolte QUE la ressource de palier N — pas les plus basses.
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
  if (recipe?.toolTier != null) return Number(recipe.toolTier) || 1;
  const lvl = recipe?.requiredJobLevel ?? 1;
  if (lvl <= 1) return 1;
  if (lvl >= 20) return Math.max(1, Math.floor(lvl / 20));
  return Math.max(1, Math.floor((lvl - 1) / 5) + 1);
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

/**
 * Outil possédé utilisable.
 * - exact=false (ferme) : palier >= minTier, garde le plus haut
 * - exact=true (récolte) : palier === minTier uniquement
 */
export function findOwnedWorkingToolForJob(state, jobId, recipes, minTier = 1, toolKind = null, { exact = false } = {}) {
  let best = null;
  for (const recipeId of state.crafted || []) {
    const recipe = recipes[recipeId];
    if (!recipe || recipe.effect?.job !== jobId) continue;
    if (!isDurabilityTool(recipe)) continue;
    if (!isToolEffectActive(state, recipeId, recipe)) continue;
    if (toolKind && (recipe.toolKind || 'bucket') !== toolKind) continue;
    const tier = getRecipeToolTier(recipe);
    if (exact) {
      if (tier !== minTier) continue;
    } else if (tier < minTier) {
      continue;
    }
    if (!best || tier > getRecipeToolTier(best.recipe)) {
      best = { recipeId, recipe };
    }
  }
  return best;
}

/**
 * Outil effectif pour une ressource : équipé s’il a le BON palier, sinon celui en réserve au bon palier.
 * Correspondance exacte outil.toolTier === ressource.tier.
 */
export function resolveHarvestTool(state, jobId, resource, recipes, resources = null) {
  const resourceTier = getResourceHarvestTier(resource, resources);
  if (resourceTier <= 0 || (resources && isStarterHarvestResource(resource, resources))) {
    const equipped = getGatheringToolRecipe(state, jobId, recipes);
    return {
      ok: true,
      recipe: equipped || null,
      recipeId: equipped ? getJobEquippedTool(state, jobId) : null,
      requiredTier: 0,
    };
  }

  const equippedId = getJobEquippedTool(state, jobId);
  const equipped = getGatheringToolRecipe(state, jobId, recipes);
  if (equipped && getRecipeToolTier(equipped) === resourceTier) {
    return { ok: true, recipe: equipped, recipeId: equippedId, requiredTier: resourceTier };
  }

  const owned = findOwnedWorkingToolForJob(state, jobId, recipes, resourceTier, null, { exact: true });
  if (owned) {
    return {
      ok: true,
      recipe: owned.recipe,
      recipeId: owned.recipeId,
      requiredTier: resourceTier,
      needsEquip: !equipped || equippedId !== owned.recipeId,
    };
  }

  if (equipped) {
    const have = getRecipeToolTier(equipped);
    return {
      ok: false,
      reason: 'tier',
      recipe: equipped,
      recipeId: equippedId,
      requiredTier: resourceTier,
      message: have > resourceTier
        ? `« ${equipped.name} » (palier ${have}) sert pour une ressource plus haute — pas pour ${resource.name}. Équipe l’outil palier ${resourceTier}.`
        : `Outil insuffisant (palier ${have}) pour ${resource.name} (palier ${resourceTier}). Craft / équipe l’outil palier ${resourceTier}.`,
    };
  }

  return {
    ok: false,
    reason: 'no_tool',
    requiredTier: resourceTier,
    message: resourceTier <= 1
      ? 'Équipe un outil sur Perso → Outils, ou fabrique-le à l\'Atelier Outilleur.'
      : `Outil palier ${resourceTier} requis pour ${resource.name} — fabrique-le à l'Atelier Outilleur.`,
  };
}

/** Équipe automatiquement l’outil du bon palier si besoin (avant une récolte). */
export function ensureHarvestToolEquipped(state, jobId, resource, recipes, equipmentData, resources = null) {
  const resolved = resolveHarvestTool(state, jobId, resource, recipes, resources);
  if (!resolved.ok || !resolved.recipeId) return resolved;
  if (resolved.needsEquip && equipmentData) {
    equipForced(resolved.recipeId, state, equipmentData, recipes);
  }
  return resolved;
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
      message: `Tu possèdes « ${owned.recipe.name} » — équipe-le sur Perso → Outils (seau et panier peuvent être équipés ensemble).`,
      recipe: owned.recipe,
      recipeId: owned.recipeId,
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
  const resolved = resolveHarvestTool(state, jobId, resource, recipes, resources);
  if (resolved.ok) {
    return {
      ok: true,
      recipe: resolved.recipe || undefined,
      recipeId: resolved.recipeId || undefined,
      autoEquip: !!resolved.needsEquip,
    };
  }
  if (resolved.reason === 'tier') {
    // Si l’outil exact est en réserve, proposer de l’équiper
    const owned = findOwnedWorkingToolForJob(state, jobId, recipes, resolved.requiredTier, null, { exact: true });
    if (owned) {
      return {
        ok: false,
        reason: 'not_equipped',
        message: `Équipe « ${owned.recipe.name} » (Perso → Outils ou bouton) pour récolter ${resource.name}.`,
        recipe: owned.recipe,
        recipeId: owned.recipeId,
      };
    }
    return {
      ok: false,
      reason: 'tier',
      message: resolved.message,
      recipe: resolved.recipe,
      recipeId: resolved.recipeId,
    };
  }
  return {
    ok: false,
    reason: resolved.reason || 'no_tool',
    message: resolved.message,
    recipe: null,
  };
}

export function listToolsForJob(recipes, jobId) {
  return Object.entries(recipes)
    .filter(([, r]) => r.effect?.job === jobId && isDurabilityTool(r))
    .map(([id, r]) => ({ id, recipe: r, tier: getRecipeToolTier(r) }));
}

/** Usure / validité : palier outil === palier ressource (pas de couverture des paliers bas). */
export function toolMatchesResourceTier(recipe, resource, resources) {
  if (!recipe?.toolTier || !resource) return true;
  const resourceTier = getResourceHarvestTier(resource, resources);
  if (resourceTier <= 0) return false;
  return getRecipeToolTier(recipe) === resourceTier;
}

/** Outil usé du palier exact de la ressource. */
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

/** Statut outil pour l’UI ligne de récolte (ok / bas / usé / à équiper + refabrication). */
export function getHarvestLineToolStatus(state, jobId, resource, recipes, equipmentData, resources = null) {
  const check = getHarvestToolCheck(state, jobId, resource, recipes, equipmentData, resources);
  const resolved = resolveHarvestTool(state, jobId, resource, recipes, resources);

  if (check.ok && resolved.recipe && resolved.recipeId && isDurabilityTool(resolved.recipe)) {
    const remaining = getToolUsesRemaining(state, resolved.recipeId);
    const max = getEffectiveMaxUses(state, resolved.recipe, resolved.recipeId) || resolved.recipe.maxUses;
    if (remaining != null && max) {
      return {
        kind: remaining <= 3 ? 'low' : 'ok',
        recipeId: resolved.recipeId,
        recipe: resolved.recipe,
        remaining,
        max,
        label: `${remaining}/${max}`,
      };
    }
  }

  if (check.reason === 'not_equipped' && check.recipe && check.recipeId) {
    const remaining = getToolUsesRemaining(state, check.recipeId);
    const max = getEffectiveMaxUses(state, check.recipe, check.recipeId) || check.recipe.maxUses || 0;
    return {
      kind: 'unequipped',
      recipeId: check.recipeId,
      recipe: check.recipe,
      remaining: remaining ?? max,
      max,
      label: remaining != null && max ? `${remaining}/${max}` : 'prêt',
      message: check.message,
    };
  }

  const broken = findBrokenToolForResource(state, jobId, resource, recipes, resources);
  if (broken) {
    const max = getEffectiveMaxUses(state, broken.recipe, broken.recipeId) || broken.recipe.maxUses || 0;
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
