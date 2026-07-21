/**
 * Système de fabrication — logique unique, sans couches intermédiaires.
 */
import { grantCombatItem } from './combat.js';
import { hasWorkingCombatItem } from './combatDurability.js';
import { equip, getJobEquippedTool, recipeBelongsToWorkshopTab } from './equipment.js';
import { initToolDurability, isDurabilityTool, isToolEffectActive } from './toolDurability.js';
import { addJobXp } from './harvest.js';
import { getPrestigeBonuses, applyMultiplierBonus, getSeasonBoostMult } from './prestige.js';
import { GATHERING_JOB_IDS, isGatheringJobUnlocked } from './careerChoice.js';

export function makeCraftContext(game) {
  return {
    state: game.state,
    recipes: game.recipes,
    resources: game.resources,
    jobs: game.jobs,
    balance: game.balance,
    equipment: game.equipment,
    combatItems: game.combatEquipment?.items || {},
  };
}

function invQty(state, resId) {
  return Math.max(0, Number(state.inventory?.[resId]) || 0);
}

function kirhaQty(state) {
  return Math.max(0, Number(state.kirha) || 0);
}

function jobLevel(state, craftJob) {
  return Number(state.jobs?.[craftJob]?.level) || 1;
}

function isZoneUnlocked(zoneId, state, balance) {
  if (balance.zones[zoneId]?.unlocked) return true;
  return (state.unlockedZones || []).includes(zoneId);
}

/** Outil unique encore utilisable (pas besoin d'en refaire un). */
export function isRecipeStillOwned(state, recipeId, recipe, combatItems = {}) {
  if (!recipe) return false;

  if (recipe.combatItem && combatItems) {
    if (hasWorkingCombatItem(state, recipe.combatItem, combatItems)) return true;
  }

  const crafted = state.crafted || [];
  if (!crafted.includes(recipeId)) return false;

  if (isDurabilityTool(recipe)) {
    const uses = state.toolDurability?.[recipeId];
    return uses === undefined || uses > 0;
  }
  return !!(recipe.unique && !recipe.repeatable);
}

/** Pourquoi la fabrication est impossible — null si OK. */

export function isAllowedCraftRecipe(recipe) {
  if (!recipe) return false;
  if (recipe.combatItem) return false;
  const job = recipe.craftJob || 'blacksmith';
  return job === 'toolmaker' || job === 'cook';
}

export function whyCannotCraft(recipeId, ctx) {
  const recipe = ctx.recipes[recipeId];
  if (!isAllowedCraftRecipe(recipe)) return { ok: false, reason: 'Recette désactivée' };
  if (!recipe) return 'Recette inconnue.';

  if (isRecipeStillOwned(ctx.state, recipeId, recipe, ctx.combatItems)) {
    return 'Déjà possédé et encore utilisable.';
  }

  if (recipe.requiresZone && !isZoneUnlocked(recipe.requiresZone, ctx.state, ctx.balance)) {
    return 'Zone non débloquée.';
  }

  if (recipe.requiresCrafted) {
    for (const req of recipe.requiresCrafted) {
      if (!(ctx.state.crafted || []).includes(req)) {
        return 'Recette préalable requise.';
      }
    }
  }

  const craftJob = recipe.craftJob || 'blacksmith';
  const required = recipe.requiredJobLevel ?? 1;
  const level = jobLevel(ctx.state, craftJob);
  if (level < required) {
    const jobName = ctx.jobs[craftJob]?.name || craftJob;
    return `${jobName} Nv.${required} requis (actuel : Nv.${level}).`;
  }

  const missing = [];
  for (const [resId, need] of Object.entries(recipe.ingredients || {})) {
    const have = invQty(ctx.state, resId);
    if (have < need) {
      const name = ctx.resources[resId]?.name || resId;
      missing.push(`${name} ${have}/${need}`);
    }
  }
  if (missing.length) return `Il manque : ${missing.join(' · ')}`;

  const kirhaCost = recipe.kirhaCost || 0;
  if (kirhaCost > 0 && kirhaQty(ctx.state) < kirhaCost) {
    return `${kirhaCost.toLocaleString('fr-FR')} 💰 requis (${kirhaQty(ctx.state).toLocaleString('fr-FR')} 💰).`;
  }

  if (recipe.output && ctx.resources[recipe.output]?.merchantOnly) {
    return 'Cet objet ne peut pas être fabriqué.';
  }

  return null;
}

function applyCraftResult(recipeId, recipe, state) {
  if (!state.crafted) state.crafted = [];

  if (isDurabilityTool(recipe)) {
    if (!state.crafted.includes(recipeId)) state.crafted.push(recipeId);
    initToolDurability(state, recipeId, recipe.maxUses);
    return;
  }

  // Repas cuisine (répétables) : enregistrer le 1er craft pour les succès
  if (recipe.craftJob === 'cook' && String(recipe.output || '').startsWith('meal_')) {
    if (!state.crafted.includes(recipeId)) state.crafted.push(recipeId);
    if (!state.stats) state.stats = {};
    state.stats.mealsCrafted = (state.stats.mealsCrafted || 0) + 1;
    return;
  }

  if (recipe.unique && !recipe.repeatable && !state.crafted.includes(recipeId)) {
    state.crafted.push(recipeId);
  }
}

/** Fabrique une recette. Retourne toujours { ok, error?, recipe?, levelResult? }. */
export function performCraft(recipeId, ctx) {
  const recipe = ctx.recipes[recipeId];
  const block = whyCannotCraft(recipeId, ctx);
  if (block) return { ok: false, error: block };

  for (const [resId, amount] of Object.entries(recipe.ingredients || {})) {
    const next = invQty(ctx.state, resId) - amount;
    if (next <= 0) delete ctx.state.inventory[resId];
    else ctx.state.inventory[resId] = next;
  }

  const kirhaCost = recipe.kirhaCost || 0;
  if (kirhaCost > 0) ctx.state.kirha = kirhaQty(ctx.state) - kirhaCost;

  if (recipe.output) {
    const outId = recipe.output;
    const amount = recipe.outputAmount || 1;
    ctx.state.inventory[outId] = invQty(ctx.state, outId) + amount;
  }

  if (recipe.combatItem) grantCombatItem(ctx.state, recipe.combatItem, ctx.combatItems || {});

  applyCraftResult(recipeId, recipe, ctx.state);

  let levelResult = null;
  const rawJobXp = recipe.jobXp ?? 0;
  const jobXp = applyMultiplierBonus(rawJobXp, getPrestigeBonuses(ctx.state).jobXp) * getSeasonBoostMult(ctx.state);
  const craftJob = recipe.craftJob || 'blacksmith';
  if (jobXp > 0) {
    levelResult = addJobXp(ctx.state, craftJob, jobXp, ctx.jobs, ctx.balance);
  }

  return { ok: true, recipe, levelResult };
}

export function autoEquipIfEmpty(recipeId, ctx) {
  const meta = ctx.equipment.equipable?.[recipeId];
  if (!meta) return false;

  const recipe = ctx.recipes[recipeId];
  let slotEmpty;
  if (meta.job == null) {
    slotEmpty = !ctx.state.equipment?.global;
  } else if (meta.slot === 'accessory') {
    slotEmpty = !ctx.state.equipment?.accessories?.[meta.job];
  } else if (meta.job === 'breeder') {
    const kind = recipe?.toolKind || (String(recipeId).includes('basket') ? 'basket' : 'bucket');
    slotEmpty = !getJobEquippedTool(ctx.state, 'breeder', kind);
  } else {
    slotEmpty = !getJobEquippedTool(ctx.state, meta.job);
  }

  if (!slotEmpty) return false;
  return equip(recipeId, ctx.state, ctx.equipment, ctx.recipes);
}

export function inspectRecipe(recipeId, ctx) {
  const recipe = ctx.recipes[recipeId];
  if (!recipe) return null;

  const craftJob = recipe.craftJob || 'blacksmith';
  const required = recipe.requiredJobLevel ?? 1;
  const level = jobLevel(ctx.state, craftJob);
  const owned = isRecipeStillOwned(ctx.state, recipeId, recipe, ctx.combatItems);
  const broken = isDurabilityTool(recipe)
    && (ctx.state.crafted || []).includes(recipeId)
    && !owned;
  const hasBrokenCombat = recipe.combatItem && !owned
    && (ctx.state.combatItemInstances || []).some((i) => i.itemId === recipe.combatItem);
  const locked = level < required;
  const block = whyCannotCraft(recipeId, ctx);
  const canMake = !block;
  const isBroken = broken || hasBrokenCombat;

  let buttonLabel = 'Fabriquer';
  if (locked) buttonLabel = 'Verrouillé';
  else if (owned) buttonLabel = 'Possédé';
  else if (isBroken) buttonLabel = 'Refabriquer';
  else if (!canMake) buttonLabel = 'Fabriquer';

  const ingredients = Object.entries(recipe.ingredients || {}).map(([resId, need]) => {
    const res = ctx.resources[resId];
    const have = invQty(ctx.state, resId);
    return { resId, res, need, have, ok: have >= need };
  });

  const kirhaCost = recipe.kirhaCost || 0;
  const kirhaHave = kirhaQty(ctx.state);

  return {
    recipeId,
    recipe,
    craftJob,
    required,
    level,
    locked,
    owned,
    broken: isBroken,
    canMake,
    blockReason: block,
    buttonLabel,
    ingredients,
    kirhaCost,
    kirhaHave,
    kirhaOk: kirhaCost <= 0 || kirhaHave >= kirhaCost,
    jobXp: recipe.jobXp ?? 0,
  };
}

function isRecipeVisibleInWorkshop(recipeId, craftJobId, ctx) {
  if (craftJobId !== 'toolmaker') return true;

  const meta = ctx.equipment?.equipable?.[recipeId];
  if (!meta?.job) return true;

  if (GATHERING_JOB_IDS.includes(meta.job)) {
    return isGatheringJobUnlocked(meta.job, ctx.state, ctx.balance);
  }

  // Breeder/cook/global helpers stay visible because the farm path is always part of a career.
  return meta.job === 'breeder' || meta.job === 'cook';
}

/** Regroupe les recettes d'un onglet atelier. */
export function listWorkshopRecipes(craftJobId, ctx) {
  const available = [];
  const owned = [];
  const locked = [];

  for (const [id, recipe] of Object.entries(ctx.recipes)) {
    if (!isAllowedCraftRecipe(recipe)) continue;
    if (!recipeBelongsToWorkshopTab(id, recipe, craftJobId, ctx.equipment)) continue;
    if (!isRecipeVisibleInWorkshop(id, craftJobId, ctx)) continue;
    const info = inspectRecipe(id, ctx);
    if (!info) continue;
    if (info.locked) locked.push(info);
    else if (info.owned) owned.push(info);
    else available.push(info);
  }

  const byTier = (a, b) => {
    const tierA = a.recipe?.toolTier || a.recipe?.requiredJobLevel || 0;
    const tierB = b.recipe?.toolTier || b.recipe?.requiredJobLevel || 0;
    if (tierA !== tierB) return tierA - tierB;
    return (a.recipe?.name || a.recipeId || '').localeCompare(b.recipe?.name || b.recipeId || '', 'fr');
  };
  available.sort(byTier);
  owned.sort(byTier);
  locked.sort(byTier);

  return { available, owned, locked };
}

/** Répare les sauvegardes incohérentes (crafted / durabilité). */
export function repairCraftSave(state, recipes) {
  if (!Array.isArray(state.crafted)) state.crafted = [];
  if (!state.toolDurability || typeof state.toolDurability !== 'object') {
    state.toolDurability = {};
  }

  state.crafted = state.crafted.filter((id) => recipes[id]);

  for (const recipeId of state.crafted) {
    const recipe = recipes[recipeId];
    if (!recipe || !isDurabilityTool(recipe)) continue;
    const uses = state.toolDurability[recipeId];
    if (uses === undefined || !Number.isFinite(Number(uses))) {
      state.toolDurability[recipeId] = recipe.maxUses;
    }
  }
}

/** Bonus de récolte via équipement crafté (utilisé par harvest.js). */
export function getCraftBonus(state, recipes, jobId, resourceId, type) {
  let bonus = 0;
  const eq = state.equipment;
  if (!eq) return bonus;

  const ids = new Set([
    ...(eq.jobs ? Object.values(eq.jobs) : []),
    ...(eq.accessories ? Object.values(eq.accessories) : []),
    eq.global,
  ].filter(Boolean));

  for (const recipeId of ids) {
    const recipe = recipes[recipeId];
    if (!recipe?.effect) continue;
    if (!isToolEffectActive(state, recipeId, recipe)) continue;
    const eff = recipe.effect;
    if (eff.job === null && eff.type === type) bonus += eff.bonus;
    else if (eff.job === jobId && eff.type === type) bonus += eff.bonus;
    else if (eff.resource === resourceId && eff.type === type) bonus += eff.bonus;
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

export function getRecipeCraftJob(recipe) {
  return recipe.craftJob || 'blacksmith';
}

export function getRecipeRequiredLevel(recipe) {
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

/** @deprecated */
export function getArtisanSellBonus(state, jobs) {
  return getCraftSellBonus(state, jobs);
}
