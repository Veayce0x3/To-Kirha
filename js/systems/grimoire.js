/**
 * Grimoire — sorts connus + jusqu’à 4 équipés (héros).
 * Pas d’import combat.js (évite cycle).
 */

export const GRIMOIRE_EQUIP_SLOTS = 4;

export const WEAPON_TYPE_SKILLS = {
  sword_shield: ['ss_slash', 'ss_guard', 'ss_shield_bash', 'ss_riposte'],
  bow: ['bow_quick', 'bow_precise', 'bow_volley', 'bow_pierce'],
  staff: ['staff_spark', 'staff_bind', 'staff_heal', 'staff_orb'],
};

export const UNARMED_SKILLS = ['punch', 'kick', 'throw_pebble', 'desperate_blow'];

export const UNIVERSAL_SPELL_IDS = [
  'uni_fire',
  'uni_heal',
  'uni_guard',
  'uni_pierce',
  'uni_focus',
];

function resolveWeaponType(state, combatItems, weaponRef) {
  if (!weaponRef || !combatItems) return null;
  if (combatItems[weaponRef]?.weaponType) return combatItems[weaponRef].weaponType;
  const inst = state.combatItemInstances?.find((i) => i.instanceId === weaponRef);
  if (inst?.itemId) return combatItems[inst.itemId]?.weaponType || null;
  return null;
}

export function emptyGrimoireState() {
  return { known: [], equipped: [] };
}

export function ensureGrimoireState(state) {
  if (!state.grimoire || typeof state.grimoire !== 'object') {
    state.grimoire = emptyGrimoireState();
  }
  if (!Array.isArray(state.grimoire.known)) state.grimoire.known = [];
  if (!Array.isArray(state.grimoire.equipped)) state.grimoire.equipped = [];
  return state.grimoire;
}

export function getWeaponSkillPool(state, combatItems) {
  const type = resolveWeaponType(state, combatItems, state.combatEquipment?.weapon);
  if (!type) return [...UNARMED_SKILLS];
  return WEAPON_TYPE_SKILLS[type] || [...UNARMED_SKILLS];
}

export function syncGrimoireKnown(state, combatItems, schoolUnlockedSpells = []) {
  const g = ensureGrimoireState(state);
  const pool = new Set([
    ...getWeaponSkillPool(state, combatItems),
    ...(schoolUnlockedSpells || []),
    ...(g.known || []),
  ]);
  pool.delete('basic_attack');
  g.known = [...pool];
  g.equipped = g.equipped.filter((id) => g.known.includes(id)).slice(0, GRIMOIRE_EQUIP_SLOTS);
  if (g.equipped.length === 0) {
    g.equipped = getWeaponSkillPool(state, combatItems).slice(0, GRIMOIRE_EQUIP_SLOTS);
  }
  return g;
}

export function learnSpell(state, skillId) {
  if (!skillId || skillId === 'basic_attack') return false;
  const g = ensureGrimoireState(state);
  if (g.known.includes(skillId)) return false;
  g.known.push(skillId);
  if (g.equipped.length < GRIMOIRE_EQUIP_SLOTS) g.equipped.push(skillId);
  return true;
}

export function equipSpell(state, skillId, slotIndex = null) {
  const g = ensureGrimoireState(state);
  if (!g.known.includes(skillId)) return { ok: false, reason: 'Sort inconnu.' };
  if (g.equipped.includes(skillId)) return { ok: false, reason: 'Déjà équipé.' };
  if (slotIndex != null && slotIndex >= 0 && slotIndex < GRIMOIRE_EQUIP_SLOTS) {
    const next = [...g.equipped];
    next[slotIndex] = skillId;
    g.equipped = next.filter(Boolean).slice(0, GRIMOIRE_EQUIP_SLOTS);
    // dedupe
    g.equipped = [...new Set(g.equipped)];
    return { ok: true, equipped: [...g.equipped] };
  }
  if (g.equipped.length >= GRIMOIRE_EQUIP_SLOTS) {
    return { ok: false, reason: `Maximum ${GRIMOIRE_EQUIP_SLOTS} sorts équipés.` };
  }
  g.equipped.push(skillId);
  return { ok: true, equipped: [...g.equipped] };
}

export function unequipSpell(state, skillId) {
  const g = ensureGrimoireState(state);
  g.equipped = g.equipped.filter((id) => id !== skillId);
  return { ok: true, equipped: [...g.equipped] };
}

export function getHeroCombatSkillIds(state, combatItems, schoolUnlockedSpells = []) {
  syncGrimoireKnown(state, combatItems, schoolUnlockedSpells);
  const g = ensureGrimoireState(state);
  return ['basic_attack', ...g.equipped];
}

export function getCompanionCombatSkillIds(state, companionId, combatItems) {
  const weaponRef = state.companions?.[companionId]?.equipment?.weapon;
  const type = resolveWeaponType(state, combatItems, weaponRef);
  if (!type) return [...UNARMED_SKILLS];
  return WEAPON_TYPE_SKILLS[type] || [...UNARMED_SKILLS];
}

export function getGrimoireViewModel(state, combatSkills, combatItems, schoolUnlockedSpells = []) {
  const g = syncGrimoireKnown(state, combatItems, schoolUnlockedSpells);
  const known = g.known.map((id) => {
    const skill = combatSkills?.[id];
    return {
      id,
      skill,
      equipped: g.equipped.includes(id),
      mpCost: skill?.mpCost ?? ((skill?.paCost || 0) * 5),
    };
  }).filter((x) => x.skill);

  return {
    known,
    equipped: g.equipped.map((id) => combatSkills?.[id]).filter(Boolean),
    maxEquipped: GRIMOIRE_EQUIP_SLOTS,
    slotsUsed: g.equipped.length,
  };
}
