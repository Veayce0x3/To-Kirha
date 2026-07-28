/** Repas / élixirs consommables — soin héros, soin équipiers, buffs combat. */

export const DUNGEON_ROOM_HEAL = 30;

export function getMealTier(mealId, resources = {}) {
  return resources[mealId]?.mealTier ?? 1;
}

export function getMealRole(mealId, resources = {}) {
  const res = resources?.[mealId];
  if (res?.mealRole) return res.mealRole;
  if (String(mealId || '').startsWith('elixir_')) return 'buff';
  return 'hero';
}

export function getMealLevelRange(mealTier) {
  const tier = mealTier <= 1 ? 1 : mealTier;
  return { min: tier === 1 ? 1 : tier, max: tier === 1 ? 9 : tier + 9 };
}

export function getMealLevelRangeForResource(resource) {
  if (resource?.requiredCharLevelMin != null && resource?.requiredCharLevelMax != null) {
    return {
      min: Number(resource.requiredCharLevelMin) || 1,
      max: Number(resource.requiredCharLevelMax) || 1,
    };
  }
  return getMealLevelRange(resource?.mealTier ?? 1);
}

export function canCharUseMeal(charLevel, mealTier, resource = null) {
  const { min, max } = resource
    ? getMealLevelRangeForResource(resource)
    : getMealLevelRange(mealTier);
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

function buffLabel(buff) {
  if (!buff) return 'Buff combat';
  const bits = [];
  if (buff.atk) bits.push(`+${Math.round(buff.atk * 100)}% ATQ`);
  if (buff.def) bits.push(`+${Math.round(buff.def * 100)}% DEF`);
  return bits.length ? bits.join(' · ') : 'Buff combat';
}

export function buildMealEffects(resources, balance) {
  const effects = {};
  for (const [id, res] of Object.entries(resources || {})) {
    const isMeal = id.startsWith('meal_') || !!res.mealTier;
    const isElixir = id.startsWith('elixir_') || res.mealRole === 'buff';
    if (!isMeal && !isElixir) continue;
    if (!id.startsWith('meal_') && !id.startsWith('elixir_')) continue;

    const role = getMealRole(id, resources);
    const tier = getMealTier(id, resources);
    const { min, max } = getMealLevelRangeForResource(res);

    if (role === 'buff') {
      const buff = res.buff || { atk: 0.05, def: 0, fights: 1 };
      effects[id] = {
        mealTier: tier,
        mealRole: 'buff',
        healPct: 0,
        buff,
        label: buffLabel(buff),
        levelMin: min,
        levelMax: max,
      };
      continue;
    }

    const pct = getMealHealPct(tier, balance);
    const who = role === 'companions' ? 'équipiers' : 'héros';
    effects[id] = {
      mealTier: tier,
      mealRole: role,
      healPct: pct,
      label: `+${pct}% PV ${who}`,
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

export function applyCombatMealBuff(state, mealId, resources) {
  const res = resources?.[mealId];
  const buff = res?.buff;
  if (!buff) return false;
  state.combatMealBuff = {
    mealId,
    atk: Number(buff.atk) || 0,
    def: Number(buff.def) || 0,
    fightsLeft: Math.max(1, Number(buff.fights) || 1),
    label: buffLabel(buff),
  };
  return true;
}

export function consumeCombatMealBuffFight(state) {
  const buff = state.combatMealBuff;
  if (!buff) return;
  buff.fightsLeft = (Number(buff.fightsLeft) || 1) - 1;
  if (buff.fightsLeft <= 0) clearCombatMealBuff(state);
}

export function getActiveCombatMealBuff(state) {
  return state.combatMealBuff || null;
}

export function listOwnedMeals(state, resources, balance) {
  const effects = buildMealEffects(resources, balance);
  return Object.keys(effects)
    .map((id) => ({ id, effect: effects[id], qty: state.inventory?.[id] || 0 }))
    .filter((m) => m.qty > 0);
}

export function countOwnedMeals(state, resources, balance) {
  return listOwnedMeals(state, resources, balance).reduce((n, m) => n + m.qty, 0);
}

export function peekMealHeal(mealId, state, resources, balance, charLevel) {
  const effect = getMealEffect(mealId, resources, balance);
  if (!effect) return { ok: false, reason: 'Consommable inconnu' };
  if ((state.inventory[mealId] || 0) < 1) return { ok: false, reason: 'Plus de stock' };
  const res = resources?.[mealId];
  if (!canCharUseMeal(charLevel, effect.mealTier, res)) {
    return { ok: false, reason: `Niveau perso ${effect.levelMin}–${effect.levelMax} requis` };
  }
  return {
    ok: true,
    healPct: effect.healPct || 0,
    label: effect.label,
    mealTier: effect.mealTier,
    mealRole: effect.mealRole || 'hero',
    buff: effect.buff || null,
  };
}

export function consumeMealFromInventory(state, mealId) {
  if ((state.inventory[mealId] || 0) < 1) return false;
  state.inventory[mealId] -= 1;
  if (state.inventory[mealId] <= 0) delete state.inventory[mealId];
  return true;
}

export function calcMealHealAmount(maxHp, healPct) {
  return Math.max(1, Math.floor((Number(maxHp) || 1) * (Number(healPct) || 0) / 100));
}
