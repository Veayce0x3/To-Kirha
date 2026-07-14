import { resolveItemId, findCombatItemOwner, unequipCombatSlot } from './combat.js';
import { getInstanceRarity } from './equipmentRarity.js';

function releaseCombatRef(state, ref, combatItems) {
  const owner = findCombatItemOwner(state, ref);
  if (!owner) return;
  if (owner === 'hero') {
    const itemId = resolveItemId(state, ref, combatItems);
    const slot = combatItems[itemId]?.slot;
    if (slot) unequipCombatSlot(state, slot);
    return;
  }
  const comp = state.companions?.[owner];
  if (!comp?.equipment) return;
  for (const [slot, equippedRef] of Object.entries(comp.equipment)) {
    if (equippedRef === ref) comp.equipment[slot] = null;
  }
}

export function getCombatItemSellPrice(state, ref, combatItems, balance) {
  const itemId = resolveItemId(state, ref, combatItems);
  if (!itemId) return 0;
  const item = combatItems[itemId];
  if (!item || item.companionOnly) return 0;
  const inst = state.combatItemInstances?.find((i) => i.instanceId === ref);
  const rarity = getInstanceRarity(inst);
  const prices = balance.combat?.sellPrices || {};
  return prices[rarity] ?? prices.common ?? 20;
}

export function canSellCombatItem(state, ref, combatItems) {
  if (!ref || !(state.ownedCombatItems || []).includes(ref)) {
    return { ok: false, reason: 'Pièce introuvable.' };
  }
  const itemId = resolveItemId(state, ref, combatItems);
  const item = combatItems[itemId];
  if (!item) return { ok: false, reason: 'Pièce introuvable.' };
  if (item.companionOnly) return { ok: false, reason: 'Équipement compagnon non vendable.' };
  return { ok: true, item };
}

export function sellCombatItem(state, ref, combatItems, balance) {
  const check = canSellCombatItem(state, ref, combatItems);
  if (!check.ok) return check;
  const itemId = resolveItemId(state, ref, combatItems);
  const price = getCombatItemSellPrice(state, ref, combatItems, balance);
  if (price <= 0) return { ok: false, reason: 'Cette pièce ne peut pas être vendue.' };

  releaseCombatRef(state, ref, combatItems);
  state.ownedCombatItems = (state.ownedCombatItems || []).filter((r) => r !== ref);
  state.combatItemInstances = (state.combatItemInstances || []).filter((i) => i.instanceId !== ref);
  state.kirha = (state.kirha || 0) + price;
  state.lifetimeStats = state.lifetimeStats || {};
  state.lifetimeStats.totalEarned = (state.lifetimeStats.totalEarned || 0) + price;

  return {
    ok: true,
    itemId,
    item: check.item,
    kirha: price,
  };
}
