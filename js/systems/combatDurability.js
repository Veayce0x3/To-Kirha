const COMBAT_EQUIP_SLOTS = [
  'helmet', 'cape', 'amulet', 'weapon', 'shield',
  'ring_left', 'ring_right', 'belt', 'chest', 'boots',
];

const COMPANION_SLOTS = ['companion_armor', 'companion_charm', 'weapon'];

export function getMaxCombatDurability(item) {
  return Math.max(0, Number(item?.maxDurability) || 0);
}

export function hasCombatDurability(item) {
  return getMaxCombatDurability(item) > 0;
}

export function getInstanceDurability(state, instanceId) {
  const inst = state.combatItemInstances?.find((i) => i.instanceId === instanceId);
  if (!inst) return null;
  return inst.durability ?? null;
}

export function isCombatInstanceBroken(state, instanceId, combatItems) {
  const inst = state.combatItemInstances?.find((i) => i.instanceId === instanceId);
  if (!inst) return false;
  const item = combatItems[inst.itemId];
  if (!hasCombatDurability(item)) return false;
  const remaining = inst.durability ?? getMaxCombatDurability(item);
  return remaining <= 0;
}

export function initCombatInstanceDurability(instance, item) {
  if (!instance || !hasCombatDurability(item)) return;
  instance.durability = getMaxCombatDurability(item);
}

export function migrateCombatDurability(state, combatItems) {
  for (const inst of state.combatItemInstances || []) {
    const item = combatItems[inst.itemId];
    if (!hasCombatDurability(item)) continue;
    if (inst.durability === undefined || !Number.isFinite(Number(inst.durability))) {
      inst.durability = getMaxCombatDurability(item);
    }
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
  if (!ref) return null;
  const inst = state.combatItemInstances?.find((i) => i.instanceId === ref);
  if (!inst) return null;
  const item = combatItems[inst.itemId];
  if (!hasCombatDurability(item)) return null;

  if (inst.durability === undefined) inst.durability = getMaxCombatDurability(item);
  inst.durability = Math.max(0, inst.durability - 1);

  const worn = {
    instanceId: inst.instanceId,
    itemId: inst.itemId,
    name: item.name,
    remaining: inst.durability,
  };

  if (inst.durability <= 0) {
    unequipRef(state, ref, slot, isCompanion, companionId);
  }

  return worn;
}

/** Usure de tout l'équipement équipé après une salle / combat. */
export function wearEquippedCombatGear(state, combatItems) {
  const worn = [];

  for (const slot of COMBAT_EQUIP_SLOTS) {
    const ref = state.combatEquipment?.[slot];
    const result = wearRef(state, ref, slot, combatItems, false, null);
    if (result) worn.push({ ...result, slot });
  }

  for (const [companionId, comp] of Object.entries(state.companions || {})) {
    if (!comp?.unlocked) continue;
    for (const slot of COMPANION_SLOTS) {
      const ref = comp.equipment?.[slot];
      const result = wearRef(state, ref, slot, combatItems, true, companionId);
      if (result) worn.push({ ...result, slot, companionId });
    }
  }

  return worn;
}

export function hasWorkingCombatItem(state, itemId, combatItems) {
  return (state.combatItemInstances || []).some((inst) => {
    if (inst.itemId !== itemId) return false;
    return !isCombatInstanceBroken(state, inst.instanceId, combatItems);
  });
}

export function formatCombatDurabilityLabel(state, instanceId, item) {
  if (!hasCombatDurability(item)) return '';
  const max = getMaxCombatDurability(item);
  const remaining = getInstanceDurability(state, instanceId);
  if (remaining === null) return `${max} combats`;
  if (remaining <= 0) return 'Usé — à refabriquer';
  return `${remaining}/${max} combats`;
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
