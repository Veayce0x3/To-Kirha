import { getJobEquippedTool } from './equipment.js';
import { getToolUsesRemaining, hasWorkingTool, isDurabilityTool } from './toolDurability.js';

/** Palier outil requis pour une ressource (Nv.1→1, Nv.20→2, …). */
export function getResourceToolTier(resource) {
  return Math.floor(((resource?.requiredJobLevel || 1) - 1) / 20) + 1;
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
  const equipped = getEquippedToolTier(state, recipes, jobId);
  return equipped >= required;
}

export function getHarvestToolBlockReason(resource, state, recipes, jobs, jobId) {
  const required = getResourceToolTier(resource);
  const recipeId = getJobEquippedTool(state, jobId);
  if (!recipeId) {
    const jobName = jobs[jobId]?.name || jobId;
    return { type: 'no_tool', message: `Équipe un outil de ${jobName} à l'Atelier` };
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
  return !getFarmToolBlockReason(building, state, recipes);
}

function farmToolKindLabel(kind) {
  if (kind === 'bucket') return 'seau';
  if (kind === 'basket') return 'panier';
  return 'outil d\'élevage';
}

export function getFarmToolBlockReason(building, state, recipes) {
  const jobId = building.toolJob || 'breeder';
  const requiredKind = building.requiredFarmToolKind || null;
  const recipeId = getJobEquippedTool(state, jobId);
  const required = building.toolTier || 1;

  if (!recipeId) {
    const toolName = farmToolKindLabel(requiredKind);
    return { type: 'no_tool', message: `Équipe un ${toolName} d'Éleveur sur Perso → Outils` };
  }
  const recipe = recipes[recipeId];
  if (!recipe || !hasWorkingTool(state, recipe.id, recipe)) {
    return { type: 'broken', message: `${farmToolKindLabel(requiredKind || recipe?.farmToolKind)} usé — refabrique-le à l'Outilleur` };
  }
  const kind = recipe.farmToolKind;
  if (requiredKind && kind !== requiredKind) {
    if (requiredKind === 'bucket') {
      return { type: 'wrong_tool', message: 'Équipe un seau au puits (le panier sert aux autres bâtiments)' };
    }
    return { type: 'wrong_tool', message: 'Équipe un panier ici (le seau est réservé au puits)' };
  }
  const tier = getRecipeToolTier(recipe);
  if (tier < required) {
    return { type: 'tier', message: `Outil palier ${required} requis pour ${building.name}` };
  }
  return null;
}
