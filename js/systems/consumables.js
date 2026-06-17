/** Buffs repas consommés avant un donjon (1 run). */

export const MEAL_EFFECTS = {
  meal_onigiri: { hpPct: 0.05, label: '+5 % HP max' },
  meal_oeufs: { defPct: 0.03, label: '+3 % DEF' },
  meal_soupe: { regenBetweenRooms: 8, label: 'Regain entre salles' },
  meal_brochette: { atkPct: 0.05, label: '+5 % ATK' },
  meal_gateau: { hpPct: 0.08, atkPct: 0.05, label: '+8 % HP · +5 % ATK' },
  meal_festin: { hpPct: 0.12, atkPct: 0.1, defPct: 0.05, label: 'Festin complet' },
};

export function getMealEffect(mealId) {
  return MEAL_EFFECTS[mealId] || null;
}

export function setActiveMeal(state, mealId) {
  if (!mealId || !MEAL_EFFECTS[mealId]) return false;
  if ((state.inventory[mealId] || 0) < 1) return false;
  state.activeMeal = mealId;
  return true;
}

export function clearActiveMeal(state) {
  state.activeMeal = null;
}

/** Consomme le repas équipé au lancement du donjon. */
export function consumeActiveMealForRun(state) {
  const mealId = state.activeMeal;
  if (!mealId) return null;
  if ((state.inventory[mealId] || 0) < 1) {
    state.activeMeal = null;
    return null;
  }
  state.inventory[mealId] -= 1;
  const effect = { ...MEAL_EFFECTS[mealId], mealId };
  state.activeMeal = null;
  state.combatMealBuff = effect;
  return effect;
}

export function getCombatMealBuff(state) {
  return state.combatMealBuff || null;
}

export function clearCombatMealBuff(state) {
  state.combatMealBuff = null;
}

export function applyMealBuffToStats(baseStats, buff) {
  if (!buff) return baseStats;
  const hp = Math.floor(baseStats.hp * (1 + (buff.hpPct || 0)));
  const atk = Math.floor(baseStats.atk * (1 + (buff.atkPct || 0)));
  const def = Math.floor(baseStats.def * (1 + (buff.defPct || 0)));
  return { ...baseStats, hp, atk, def, maxHp: hp };
}
