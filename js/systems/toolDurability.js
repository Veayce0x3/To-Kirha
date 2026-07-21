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

/**
 * Usure les outils équipés.
 * En récolte : n'use que si palier outil = palier ressource (pas sur la 1ʳᵉ ressource).
 * En ferme : passer recipeIdOverride pour n'user que le seau ou le panier.
 */
export function wearToolsForHarvest(state, recipes, equipmentData, jobId, resourceId = null, resources = null, recipeIdOverride = null) {
  const eq = state.equipment;
  if (!eq?.jobs && !eq?.breederTools) return [];

  const resource = resourceId && resources ? resources[resourceId] : null;
  const worn = [];
  const checkIds = new Set();
  if (recipeIdOverride) {
    checkIds.add(recipeIdOverride);
  } else if (jobId === 'breeder') {
    if (eq.breederTools?.bucket) checkIds.add(eq.breederTools.bucket);
    if (eq.breederTools?.basket) checkIds.add(eq.breederTools.basket);
    if (eq.jobs?.breeder) checkIds.add(eq.jobs.breeder);
  } else {
    if (eq.jobs?.[jobId]) checkIds.add(eq.jobs[jobId]);
  }
  if (eq.accessories?.[jobId]) checkIds.add(eq.accessories[jobId]);
  if (eq.global) checkIds.add(eq.global);

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
  } else if (item.job === 'breeder') {
    const bt = state.equipment.breederTools;
    if (bt?.bucket === recipeId) bt.bucket = null;
    if (bt?.basket === recipeId) bt.basket = null;
    state.equipment.jobs.breeder = bt?.bucket || bt?.basket || null;
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
  const max = getEffectiveMaxUses(state, recipe);
  if (remaining === null) return `${max} utilisations`;
  if (remaining <= 0) return 'Usé — à refabriquer';
  return `${remaining}/${max} utilisations`;
}

export function isToolUpgraded(state, recipeId) {
  return !!(state?.toolUpgrades?.[recipeId]);
}

export function getEffectiveMaxUses(state, recipe) {
  const base = recipe?.maxUses || 0;
  if (!base) return 0;
  const bonus = Number(state?.toolUpgrades?.[recipe?.id]);
  return base + (Number.isFinite(bonus) && bonus > 0 ? bonus : 0);
}

export function canUpgradeTool(state, recipeId, recipe, balance) {
  const cfg = balance?.toolSeasonUpgrade || {};
  const minSeason = cfg.minSeason ?? 2;
  if ((state.season || 1) < minSeason) return { ok: false, reason: `Disponible à partir de la Saison ${minSeason}` };
  if (!isDurabilityTool(recipe)) return { ok: false, reason: 'Cet objet n’a pas de durabilité' };
  if (!(state.crafted || []).includes(recipeId)) return { ok: false, reason: 'Outil non possédé' };
  if (isToolUpgraded(state, recipeId)) return { ok: false, reason: 'Déjà amélioré cette saison' };
  return { ok: true };
}

export function upgradeTool(state, recipeId, recipe, balance) {
  const check = canUpgradeTool(state, recipeId, recipe, balance);
  if (!check.ok) return check;
  const bonus = Number(balance?.toolSeasonUpgrade?.bonusUses) || 10;
  if (!state.toolUpgrades) state.toolUpgrades = {};
  state.toolUpgrades[recipeId] = bonus;
  const cur = getToolUsesRemaining(state, recipeId);
  const baseMax = recipe.maxUses || 0;
  const nextRemaining = (cur == null ? baseMax : Math.max(0, cur)) + bonus;
  initToolDurability(state, recipeId, nextRemaining);
  return { ok: true, bonusUses: bonus, maxUses: baseMax + bonus, remaining: nextRemaining };
}
