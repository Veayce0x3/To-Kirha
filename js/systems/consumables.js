/** Repas consommables — soin HP en combat (menu Objets). */

export const MEAL_EFFECTS = {
  meal_onigiri: { healPct: 0.15, label: '+15 % PV' },
  meal_poisson: { healPct: 0.2, label: '+20 % PV' },
  meal_oeufs: { healPct: 0.12, label: '+12 % PV' },
  meal_soupe: { healPct: 0.25, label: '+25 % PV' },
  meal_brochette: { healPct: 0.1, label: '+10 % PV' },
  meal_gateau: { healPct: 0.3, label: '+30 % PV' },
  meal_festin: { healPct: 0.5, label: '+50 % PV' },
};

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

/** @deprecated */
export function listCombatHealMeals(state) {
  return listOwnedMeals(state);
}

export function useMealHealInCombat(state, mealId) {
  const effect = MEAL_EFFECTS[mealId];
  if (!effect?.healPct) return { ok: false, reason: 'Repas inconnu' };
  if ((state.inventory[mealId] || 0) < 1) return { ok: false, reason: 'Plus de ce repas' };
  state.inventory[mealId] -= 1;
  if (state.inventory[mealId] <= 0) delete state.inventory[mealId];
  return { ok: true, healPct: effect.healPct, label: effect.label };
}
