/** Repas consommables — soin % PV max en combat, paliers de 10 niv. perso. */

export const DUNGEON_ROOM_HEAL = 30;

export function getMealTier(mealId, resources = {}) {
  return resources[mealId]?.mealTier ?? 1;
}

export function getMealLevelRange(mealTier) {
  const tier = mealTier <= 1 ? 1 : mealTier;
  return { min: tier === 1 ? 1 : tier, max: tier === 1 ? 9 : tier + 9 };
}

export function canCharUseMeal(charLevel, mealTier) {
  const { min, max } = getMealLevelRange(mealTier);
  return charLevel >= min && charLevel <= max;
}

export function getMealHealPct(mealTier, balance) {
  const cfg = balance?.meals || {};
  const base = cfg.healPctBase ?? 30;
  const step = cfg.healPctStep ?? 5;
  const max = cfg.healPctMax ?? 60;
  const tierIndex = mealTier <= 1 ? 0 : Math.floor(mealTier / 10);
  return Math.min(max, base + tierIndex * step);
}

export function buildMealEffects(resources, balance) {
  const effects = {};
  for (const [id, res] of Object.entries(resources || {})) {
    if (!res.mealTier && !id.startsWith('meal_')) continue;
    if (!id.startsWith('meal_')) continue;
    const tier = getMealTier(id, resources);
    const pct = getMealHealPct(tier, balance);
    const { min, max } = getMealLevelRange(tier);
    effects[id] = {
      mealTier: tier,
      healPct: pct,
      label: `+${pct}% PV max`,
      levelMin: min,
      levelMax: max,
    };
  }
  return effects;
}

export function getMealEffect(mealId, resources, balance) {
  const effects = buildMealEffects(resources, balance);
  return effects[mealId] || null;
}

export function formatMealHealLabel(mealId, resources, balance) {
  return getMealEffect(mealId, resources, balance)?.label || '';
}

export function clearCombatMealBuff(state) {
  state.combatMealBuff = null;
  state.activeMeal = null;
}

export function listOwnedMeals(state, resources, balance) {
  const effects = buildMealEffects(resources, balance);
  return Object.keys(effects)
    .map((id) => ({ id, effect: effects[id], qty: state.inventory?.[id] || 0 }))
    .filter((m) => m.qty > 0);
}

export function countOwnedMeals(state, resources, balance) {
  return listOwnedMeals(state, resources, balance).reduce((sum, m) => sum + m.qty, 0);
}

export function peekMealHeal(mealId, state, resources, balance, charLevel) {
  const effect = getMealEffect(mealId, resources, balance);
  if (!effect) return { ok: false, reason: 'Repas inconnu' };
  if ((state.inventory[mealId] || 0) < 1) return { ok: false, reason: 'Plus de ce repas' };
  if (!canCharUseMeal(charLevel, effect.mealTier)) {
    return { ok: false, reason: `Réservé aux persos niv. ${effect.levelMin}–${effect.levelMax}` };
  }
  return { ok: true, healPct: effect.healPct, label: effect.label, mealTier: effect.mealTier };
}

export function consumeMealFromInventory(state, mealId) {
  if ((state.inventory[mealId] || 0) < 1) return false;
  state.inventory[mealId] -= 1;
  if (state.inventory[mealId] <= 0) delete state.inventory[mealId];
  return true;
}

export function calcMealHealAmount(maxHp, healPct) {
  return Math.max(1, Math.floor(maxHp * (healPct / 100)));
}
