const COMBAT_EQUIP_SLOTS = [
  'helmet', 'cape', 'amulet', 'weapon',
  'ring_left', 'ring_right', 'belt', 'chest', 'boots',
];

const COMPANION_SLOTS = ['companion_armor', 'companion_charm', 'weapon'];

export function getMaxCombatDurability(item) {
  return 0;
}

export function hasCombatDurability(item) {
  return false;
}

export function getInstanceDurability(state, instanceId) {
  return null;
}

export function isCombatInstanceBroken(state, instanceId, combatItems) {
  return false;
}

export function initCombatInstanceDurability(instance, item) {
  if (instance && 'durability' in instance) delete instance.durability;
}

export function migrateCombatDurability(state, combatItems) {
  for (const inst of state.combatItemInstances || []) {
    if ('durability' in inst) delete inst.durability;
  }
}

function unequipRef(state, ref, slot, isCompanion, companionId) {
  if (isCompanion) {
    const comp = state.companions?.[companionId];
    if (comp?.equipment?.[slot] === ref) comp.equipment[slot] = null;
    return;
  }
  if (state.combatEquipment?.[slot] === ref) state.combatEquipment[slot] = null;
}

function wearRef(state, ref, slot, combatItems, isCompanion, companionId) {
  return null;
}

/** Usure de tout l'équipement équipé après une salle / combat. */
export function wearEquippedCombatGear(state, combatItems) {
  return [];
}

export function hasWorkingCombatItem(state, itemId, combatItems) {
  return (state.combatItemInstances || []).some((inst) => {
    if (inst.itemId !== itemId) return false;
    return !isCombatInstanceBroken(state, inst.instanceId, combatItems);
  });
}

export function formatCombatDurabilityLabel(state, instanceId, item) {
  return '';
}

export function renderCombatDurabilityBar(state, instanceId, item) {
  if (!hasCombatDurability(item)) return '';
  const max = getMaxCombatDurability(item);
  const remaining = getInstanceDurability(state, instanceId);
  const val = remaining === null ? max : remaining;
  const pct = Math.max(0, (val / max) * 100);
  const broken = remaining !== null && remaining <= 0;
  const label = formatCombatDurabilityLabel(state, instanceId, item);
  return `
    <div class="durability-bar-wrap${broken ? ' durability-broken' : ''}${!broken && pct <= 25 ? ' durability-low' : ''}" title="${label}">
      <div class="durability-bar"><div class="durability-fill" style="width:${pct}%"></div></div>
      <span class="durability-label">${label}</span>
    </div>
  `;
}
