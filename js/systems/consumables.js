/** Repas consommables — soin HP fixe en combat (menu Objets). */

export const MEAL_EFFECTS = {
  meal_onigiri: { healAmount: 25, label: '+25 PV' },
  meal_poisson: { healAmount: 35, label: '+35 PV' },
  meal_oeufs: { healAmount: 20, label: '+20 PV' },
  meal_soupe: { healAmount: 45, label: '+45 PV' },
  meal_brochette: { healAmount: 15, label: '+15 PV' },
  meal_gateau: { healAmount: 55, label: '+55 PV' },
  meal_festin: { healAmount: 80, label: '+80 PV' },
};

/** Soin fixe entre deux salles de donjon (toute l'équipe vivante). */
export const DUNGEON_ROOM_HEAL = 30;

export function getMealEffect(mealId) {
  return MEAL_EFFECTS[mealId] || null;
}

export function formatMealHealLabel(mealId) {
  const effect = MEAL_EFFECTS[mealId];
  return effect?.label || '';
}

/** @deprecated — conservé pour migration save */
export function clearCombatMealBuff(state) {
  state.combatMealBuff = null;
  state.activeMeal = null;
}

export function listOwnedMeals(state) {
  return Object.keys(MEAL_EFFECTS)
    .map((id) => ({ id, effect: MEAL_EFFECTS[id], qty: state.inventory?.[id] || 0 }))
    .filter((m) => m.qty > 0);
}

export function countOwnedMeals(state) {
  return listOwnedMeals(state).reduce((sum, m) => sum + m.qty, 0);
}

/** @deprecated */
export function listCombatHealMeals(state) {
  return listOwnedMeals(state);
}

export function useMealHealInCombat(state, mealId) {
  const effect = MEAL_EFFECTS[mealId];
  if (!effect?.healAmount) return { ok: false, reason: 'Repas inconnu' };
  if ((state.inventory[mealId] || 0) < 1) return { ok: false, reason: 'Plus de ce repas' };
  state.inventory[mealId] -= 1;
  if (state.inventory[mealId] <= 0) delete state.inventory[mealId];
  return { ok: true, healAmount: effect.healAmount, label: effect.label };
}
