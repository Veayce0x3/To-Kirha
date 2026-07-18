import { toolMatchesResourceTier } from './toolTier.js';

export function getToolUsesRemaining(state, recipeId) {
  const val = state.toolDurability?.[recipeId];
  return val === undefined ? null : val;
}

export function isDurabilityTool(recipe) {
  return (recipe?.maxUses || 0) > 0;
}

export function hasWorkingTool(state, recipeId, recipe) {
  if (!isDurabilityTool(recipe)) {
    return (state.crafted || []).includes(recipeId);
  }
  if (!(state.crafted || []).includes(recipeId)) return false;
  const remaining = getToolUsesRemaining(state, recipeId);
  return remaining !== null && remaining > 0;
}

export function isToolBroken(state, recipeId, recipe) {
  if (!isDurabilityTool(recipe)) return false;
  if (!(state.crafted || []).includes(recipeId)) return false;
  const remaining = getToolUsesRemaining(state, recipeId);
  return remaining === null || remaining <= 0;
}

export function initToolDurability(state, recipeId, maxUses) {
  if (!state.toolDurability) state.toolDurability = {};
  state.toolDurability[recipeId] = maxUses;
}

export function migrateToolDurability(state, recipes) {
  if (!state.toolDurability) state.toolDurability = {};
  for (const recipeId of state.crafted || []) {
    const recipe = recipes[recipeId];
    if (!isDurabilityTool(recipe)) continue;
    if (state.toolDurability[recipeId] === undefined) {
      state.toolDurability[recipeId] = recipe.maxUses;
    }
  }
}

export function wearToolsForHarvest(state, recipes, equipmentData, jobId, resourceId = null, resources = null) {
  const eq = state.equipment;
  if (!eq?.jobs) return [];

  const resource = resourceId && resources ? resources[resourceId] : null;
  const worn = [];
  const checkIds = new Set([
    eq.jobs[jobId],
    eq.accessories?.[jobId],
    eq.global,
  ].filter(Boolean));

  for (const recipeId of checkIds) {
    const recipe = recipes[recipeId];
    if (!recipe || !isDurabilityTool(recipe)) continue;

    const eff = recipe.effect;
    if (eff?.job != null && eff.job !== jobId) continue;

    if (resource && resources && recipe.toolTier && !toolMatchesResourceTier(recipe, resource, resources)) {
      continue;
    }

    const remaining = getToolUsesRemaining(state, recipeId);
    if (remaining === null || remaining <= 0) continue;

    state.toolDurability[recipeId] = remaining - 1;
    worn.push({ recipeId, remaining: state.toolDurability[recipeId] });

    if (state.toolDurability[recipeId] <= 0) {
      unequipBrokenTool(state, equipmentData, recipeId);
    }
  }

  return worn;
}

function unequipBrokenTool(state, equipmentData, recipeId) {
  const item = equipmentData?.equipable?.[recipeId];
  if (!item || !state.equipment) return;

  if (item.job == null) {
    if (state.equipment.global === recipeId) state.equipment.global = null;
  } else if (item.slot === 'accessory') {
    if (state.equipment.accessories?.[item.job] === recipeId) {
      state.equipment.accessories[item.job] = null;
    }
  } else if (state.equipment.jobs?.[item.job] === recipeId) {
    state.equipment.jobs[item.job] = null;
  }
}

export function isToolEffectActive(state, recipeId, recipe) {
  if (!recipe?.effect) return false;
  if (!isDurabilityTool(recipe)) return true;
  const remaining = getToolUsesRemaining(state, recipeId);
  return remaining !== null && remaining > 0;
}

export function formatDurabilityLabel(state, recipeId, recipe) {
  if (!isDurabilityTool(recipe)) return '';
  const remaining = getToolUsesRemaining(state, recipeId);
  const max = recipe.maxUses;
  if (remaining === null) return `${max} utilisations`;
  if (remaining <= 0) return 'Usé — à refabriquer';
  return `${remaining}/${max} utilisations`;
}
