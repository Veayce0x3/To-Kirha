import { findCombatItemOwner, resolveItem } from './combat.js';
import { validateNickname } from './character.js';

export const COMPANION_EQUIP_SLOTS = ['weapon', 'companion_armor', 'companion_charm'];

export function getDefaultCompanionEquipment() {
  return {
    weapon: null,
    companion_armor: null,
    companion_charm: null,
  };
}

export function buildDefaultCompanions(companionDefs) {
  const companions = {};
  for (const id of Object.keys(companionDefs || {})) {
    companions[id] = {
      unlocked: false,
      activeInParty: true,
      equipment: getDefaultCompanionEquipment(),
    };
  }
  return companions;
}

export function migrateCompanions(saved, companionDefs) {
  const defaults = buildDefaultCompanions(companionDefs);
  const merged = { ...defaults };
  for (const id of Object.keys(companionDefs || {})) {
    const prev = saved?.[id];
    if (!prev) continue;
    merged[id] = {
      unlocked: !!prev.unlocked,
      activeInParty: prev.activeInParty !== false,
      nickname: prev.nickname || '',
      equipment: {
        ...getDefaultCompanionEquipment(),
        ...(prev.equipment || {}),
      },
    };
  }
  return merged;
}

export function applyBetaUnlocks(state, companionDefs) {
  if (!companionDefs) return;
  if (!state.companions) state.companions = buildDefaultCompanions(companionDefs);
  for (const id of Object.keys(companionDefs)) {
    if (!state.companions[id]) {
      state.companions[id] = { unlocked: true, activeInParty: true, equipment: getDefaultCompanionEquipment() };
    } else {
      state.companions[id].unlocked = true;
      if (state.companions[id].activeInParty === undefined) {
        state.companions[id].activeInParty = true;
      }
    }
  }
}

export function getUnlockedCompanionCount(state, companionDefs) {
  return Object.keys(companionDefs || {}).filter(
    (id) => state.companions?.[id]?.unlocked
  ).length;
}

export function getActiveCompanionCount(state, companionDefs) {
  return Object.keys(companionDefs || {}).filter(
    (id) => state.companions?.[id]?.unlocked && state.companions[id].activeInParty !== false
  ).length;
}

export function toggleCompanionParty(companionId, state, companionDefs) {
  const comp = state.companions?.[companionId];
  if (!comp?.unlocked) return { ok: false, reason: 'Équipier non recruté' };
  comp.activeInParty = comp.activeInParty === false;
  return { ok: true, companionId, activeInParty: comp.activeInParty };
}

export function canUnlockCompanion(companionId, state, companionDefs) {
  const def = companionDefs[companionId];
  if (!def) return { ok: false, reason: 'Équipier inconnu' };
  if (state.companions?.[companionId]?.unlocked) {
    return { ok: false, reason: 'Déjà recruté' };
  }
  if (state.kirha < def.unlockCost) {
    return { ok: false, reason: `Il manque ${def.unlockCost - state.kirha} 💰` };
  }
  return { ok: true };
}

export function unlockCompanion(companionId, state, companionDefs) {
  const check = canUnlockCompanion(companionId, state, companionDefs);
  if (!check.ok) return check;
  const def = companionDefs[companionId];
  state.kirha -= def.unlockCost;
  if (!state.companions) state.companions = buildDefaultCompanions(companionDefs);
  state.companions[companionId].unlocked = true;
  return { ok: true, companionId, cost: def.unlockCost };
}

export function canEquipCompanionItem(state, companionId, ref, combatItems) {
  const item = resolveItem(state, ref, combatItems);
  if (!item) return false;
  if (!state.companions?.[companionId]?.unlocked) return false;
  if (!(state.ownedCombatItems || []).includes(ref)) return false;
  if (!COMPANION_EQUIP_SLOTS.includes(item.slot)) return false;
  if (item.slot !== 'weapon' && !item.companionOnly) return false;
  const owner = findCombatItemOwner(state, ref);
  if (owner && owner !== companionId) return false;
  return true;
}

export function equipCompanionItem(state, companionId, ref, combatItems) {
  if (!canEquipCompanionItem(state, companionId, ref, combatItems)) return false;
  const item = resolveItem(state, ref, combatItems);
  if (!state.companions[companionId].equipment) {
    state.companions[companionId].equipment = getDefaultCompanionEquipment();
  }
  state.companions[companionId].equipment[item.slot] = ref;
  return true;
}

export function unequipCompanionSlot(state, companionId, slot) {
  const eq = state.companions?.[companionId]?.equipment;
  if (!eq?.[slot]) return false;
  eq[slot] = null;
  return true;
}

export function getCompanionEquippableItems(state, companionId, combatItems) {
  return (state.ownedCombatItems || []).filter((ref) => {
    const item = resolveItem(state, ref, combatItems);
    if (!item) return false;
    if (!COMPANION_EQUIP_SLOTS.includes(item.slot)) return false;
    if (item.slot === 'weapon') return true;
    if (!item.companionOnly) return false;
    const owner = findCombatItemOwner(state, ref);
    if (owner && owner !== companionId) return false;
    const equipped = state.companions?.[companionId]?.equipment?.[item.slot];
    if (equipped === ref) return false;
    return true;
  });
}

export function getCompanionDisplayName(companionId, state, companionDefs) {
  const nick = state.companions?.[companionId]?.nickname?.trim();
  if (nick) return nick;
  return companionDefs[companionId]?.name || companionId;
}

export function applyCompanionNickname(companionId, rawName, state, companionDefs, characterConfig, { isRename = false } = {}) {
  const def = companionDefs[companionId];
  if (!def) return { ok: false, reason: 'Équipier inconnu' };
  if (!state.companions?.[companionId]?.unlocked) {
    return { ok: false, reason: 'Recrute cet équipier d\'abord.' };
  }

  const check = validateNickname(rawName, characterConfig);
  if (!check.ok) return check;

  const comp = state.companions[companionId];
  if (!comp.nickname?.trim()) {
    comp.nickname = check.name;
    return { ok: true, firstSet: true, companionId, name: check.name };
  }

  if (!isRename) {
    return { ok: false, reason: 'Pseudo déjà défini — utilise renommer.' };
  }

  comp.nickname = check.name;
  return { ok: true, renamed: true, companionId, name: check.name };
}
