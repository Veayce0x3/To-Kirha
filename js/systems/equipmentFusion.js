import { getNextRarity, getInstanceRarity, normalizeRarity, RARITY_LABELS } from './equipmentRarity.js';
import { resolveItemId, findCombatItemOwner, unequipCombatSlot } from './combat.js';

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

export const FUSION_INPUT_COUNT = {
  common: 2,
  rare: 2,
  epic: 3,
  mystic: 3,
};

export function getFusionInputCount(rarity) {
  return FUSION_INPUT_COUNT[normalizeRarity(rarity)] ?? 2;
}

export function getFusionKirhaCost(rarity, balance) {
  const costs = balance.combat?.fusionCosts || {};
  return costs[normalizeRarity(rarity)] ?? 100;
}

export function getFusionableGroups(state, combatItems) {
  const groups = {};
  for (const ref of state.ownedCombatItems || []) {
    const itemId = resolveItemId(state, ref, combatItems);
    if (!itemId) continue;
    const item = combatItems[itemId];
    if (!item || item.companionOnly) continue;
    const inst = state.combatItemInstances?.find((i) => i.instanceId === ref);
    if (!inst) continue;
    const rarity = getInstanceRarity(inst);
    const key = `${itemId}::${rarity}`;
    if (!groups[key]) groups[key] = { itemId, item, rarity, refs: [] };
    groups[key].refs.push(ref);
  }
  return Object.values(groups);
}

export function canFuseGroup(group, balance) {
  const count = getFusionInputCount(group.rarity);
  const next = getNextRarity(group.rarity);
  if (!next) return { ok: false, reason: 'Rareté max atteinte' };
  if (group.refs.length < count) {
    return { ok: false, reason: `Il faut ${count}× ${group.item.name} ${RARITY_LABELS[group.rarity]}` };
  }
  const kirhaCost = getFusionKirhaCost(group.rarity, balance);
  return { ok: true, inputCount: count, nextRarity: next, kirhaCost };
}

export function fuseEquipmentGroup(state, group, balance, combatItems, grantFn) {
  const check = canFuseGroup(group, balance);
  if (!check.ok) return check;
  if ((state.kirha || 0) < check.kirhaCost) {
    return { ok: false, reason: `Il faut ${check.kirhaCost} Kirha` };
  }

  const toConsume = group.refs.slice(0, check.inputCount);
  state.kirha -= check.kirhaCost;

  for (const ref of toConsume) {
    releaseCombatRef(state, ref, combatItems);
    state.ownedCombatItems = (state.ownedCombatItems || []).filter((r) => r !== ref);
    state.combatItemInstances = (state.combatItemInstances || []).filter((i) => i.instanceId !== ref);
  }

  const newRef = grantFn(state, group.itemId, combatItems, check.nextRarity);
  return {
    ok: true,
    itemId: group.itemId,
    fromRarity: group.rarity,
    toRarity: check.nextRarity,
    kirhaCost: check.kirhaCost,
    instanceRef: newRef,
  };
}
