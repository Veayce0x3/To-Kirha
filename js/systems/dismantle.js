import { findCombatItemOwner, resolveItem } from './combat.js';

export function findSalvageRecipe(itemId, recipes) {
  const matches = Object.values(recipes || {}).filter(
    (r) => r.combatItem === itemId && r.ingredients
  );
  if (!matches.length) return null;
  const nonTutorial = matches.filter((r) => !r.tutorialOnly);
  const pool = nonTutorial.length ? nonTutorial : matches;
  return pool.sort(
    (a, b) => Object.keys(b.ingredients).length - Object.keys(a.ingredients).length
  )[0];
}

export function getDismantlePreview(ref, state, recipes, combatItems, balance) {
  const item = resolveItem(state, ref, combatItems);
  if (!item) return null;

  const recipe = findSalvageRecipe(item.id, recipes);
  if (!recipe) return { ok: false, reason: 'Aucune recette connue pour cette pièce.' };

  const rate = balance.dismantle?.recoveryRate ?? 0.45;
  const recovered = {};
  for (const [resId, amount] of Object.entries(recipe.ingredients)) {
    const qty = Math.floor(amount * rate);
    if (qty > 0) recovered[resId] = qty;
  }

  return {
    ok: true,
    item,
    recipe,
    rate,
    recovered,
  };
}

export function canDismantleCombatItem(ref, state, recipes, combatItems) {
  const item = resolveItem(state, ref, combatItems);
  if (!item) return { ok: false, reason: 'Objet introuvable.' };
  if (findCombatItemOwner(state, ref)) {
    return { ok: false, reason: 'Retire la pièce avant de la démanteler.' };
  }
  const recipe = findSalvageRecipe(item.id, recipes);
  if (!recipe) return { ok: false, reason: 'Cette pièce ne peut pas être démantelée.' };
  return { ok: true, recipe };
}

export function dismantleCombatItem(ref, state, recipes, combatItems, balance) {
  const check = canDismantleCombatItem(ref, state, recipes, combatItems);
  if (!check.ok) return check;

  const preview = getDismantlePreview(ref, state, recipes, combatItems, balance);
  if (!preview?.ok) return preview;

  const { item, recipe, recovered } = preview;

  for (const [resId, amount] of Object.entries(recovered)) {
    state.inventory[resId] = (state.inventory[resId] || 0) + amount;
  }

  state.ownedCombatItems = (state.ownedCombatItems || []).filter((r) => r !== ref);
  state.combatItemInstances = (state.combatItemInstances || []).filter(
    (inst) => inst.instanceId !== ref
  );

  if (recipe.unique && state.crafted) {
    state.crafted = state.crafted.filter((id) => id !== recipe.id);
  }

  return {
    ok: true,
    itemId: item.id,
    itemName: item.name,
    recovered,
    recipeId: recipe.id,
  };
}
