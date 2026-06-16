import { resolveItemId } from './combat.js';

const COMPANION_SLOTS = new Set(['companion_armor', 'companion_charm']);

export function getSetIdFromItemId(itemId) {
  if (!itemId?.startsWith('set_')) return null;
  const parts = itemId.split('_');
  if (parts.length < 3) return null;
  return parts[1];
}

export function countEquippedSetPieces(state, combatItems) {
  const counts = {};
  for (const [slot, ref] of Object.entries(state.combatEquipment || {})) {
    if (!ref || COMPANION_SLOTS.has(slot)) continue;
    const itemId = resolveItemId(state, ref, combatItems);
    const setId = getSetIdFromItemId(itemId);
    if (!setId) continue;
    counts[setId] = (counts[setId] || 0) + 1;
  }
  return counts;
}

export function getActiveSetBonus(state, combatItems, balance) {
  const cfg = balance?.combatSetBonuses;
  if (!cfg) return { bonus: { hp: 0, atk: 0, def: 0 }, sets: [] };

  const counts = countEquippedSetPieces(state, combatItems);
  const bonus = { hp: 0, atk: 0, def: 0 };
  const sets = [];

  for (const [setId, count] of Object.entries(counts)) {
    let tier = null;
    if (cfg.tier8 && count >= cfg.tier8.minPieces) tier = 'tier8';
    else if (cfg.tier4 && count >= cfg.tier4.minPieces) tier = 'tier4';
    if (!tier) continue;

    const t = cfg[tier];
    sets.push({ setId, count, tier, minPieces: t.minPieces });
    bonus.hp += t.hp || 0;
    bonus.atk += t.atk || 0;
    bonus.def += t.def || 0;
  }

  return { bonus, sets };
}
