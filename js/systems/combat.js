import {
  getBaseStats,
  getCombatStats,
  getCharacterDisplayName,
} from './character.js';
import { COMPANION_EQUIP_SLOTS, getCompanionDisplayName } from './companions.js';

export const COMBAT_SLOT_IDS = [
  'helmet', 'cape', 'amulet', 'weapon', 'shield',
  'ring_left', 'ring_right', 'belt', 'chest', 'boots',
];

export const WEAPON_TYPE_SKILLS = {
  sword_shield: ['ss_slash', 'ss_guard', 'ss_shield_bash', 'ss_riposte'],
  bow: ['bow_quick', 'bow_precise', 'bow_volley', 'bow_pierce'],
  staff: ['staff_spark', 'staff_bind', 'staff_heal', 'staff_orb'],
};

export const WEAPON_CLASS_LABELS = {
  sword_shield: 'Guerrier',
  bow: 'Archer',
  staff: 'Mage',
};

export function getWeaponClassLabel(item) {
  if (item?.className) return item.className;
  if (item?.weaponType) return WEAPON_CLASS_LABELS[item.weaponType] || item.weaponType;
  return null;
}

export const UNARMED_SKILLS = ['punch', 'kick', 'throw_pebble', 'desperate_blow'];

export const DEFEND_ACTION = {
  id: 'defend',
  name: 'Défense',
  emoji: '🛡️',
  effect: { type: 'guard', defBonus: 5 },
};

export function getDefaultCombatEquipment() {
  const eq = {};
  for (const id of COMBAT_SLOT_IDS) eq[id] = null;
  return eq;
}

export function calcDamage(atk, def, multiplier = 1, ignoreDef = 0) {
  const effectiveDef = Math.max(0, (def || 0) - ignoreDef);
  return Math.max(1, Math.floor(atk * multiplier) - effectiveDef);
}

import { initCombatInstanceDurability, isCombatInstanceBroken } from './combatDurability.js';
import { normalizeRarity, scaleItemStats, getInstanceRarity } from './equipmentRarity.js';

export function resolveItemId(state, ref, combatItems) {
  if (!ref) return null;
  if (combatItems[ref]) return ref;
  return state.combatItemInstances?.find((i) => i.instanceId === ref)?.itemId || null;
}

export function resolveItem(state, ref, combatItems) {
  const itemId = resolveItemId(state, ref, combatItems);
  return itemId ? combatItems[itemId] || null : null;
}

export function ownsCombatRef(state, ref) {
  return (state.ownedCombatItems || []).includes(ref);
}

export function migrateCombatItemInstances(state, combatItems) {
  if (!state.combatItemInstances) state.combatItemInstances = [];

  state.combatItemInstances = state.combatItemInstances.filter((inst) => inst?.itemId && combatItems[inst.itemId]);
  const knownInstanceIds = new Set(state.combatItemInstances.map((inst) => inst.instanceId));
  const isKnownRef = (ref) => !ref || combatItems[ref] || knownInstanceIds.has(ref);

  state.ownedCombatItems = (state.ownedCombatItems || []).filter(isKnownRef);
  for (const slot of COMBAT_SLOT_IDS) {
    if (state.combatEquipment?.[slot] && !isKnownRef(state.combatEquipment[slot])) {
      state.combatEquipment[slot] = null;
    }
  }
  for (const comp of Object.values(state.companions || {})) {
    for (const [slot, ref] of Object.entries(comp.equipment || {})) {
      if (ref && !isKnownRef(ref)) comp.equipment[slot] = null;
    }
  }

  const toInstance = (itemId) => {
    if (!itemId) return itemId;
    if (itemId.startsWith('ci_')) {
      const known = state.combatItemInstances.find((i) => i.instanceId === itemId);
      if (known) return itemId;
    }
    if (!combatItems[itemId]) return itemId;
    const instanceId = `ci_${itemId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const instance = { instanceId, itemId, rarity: 'common' };
    initCombatInstanceDurability(instance, combatItems[itemId]);
    state.combatItemInstances.push(instance);
    return instanceId;
  };

  const needsMigration = (state.ownedCombatItems || []).some(
    (ref) => ref && combatItems[ref]
  );
  if (!needsMigration && (state.ownedCombatItems || []).every((ref) => ref?.startsWith?.('ci_'))) {
    for (const inst of state.combatItemInstances) {
      if (!inst.rarity) inst.rarity = 'common';
    }
    return;
  }

  state.ownedCombatItems = (state.ownedCombatItems || []).map((ref) => {
    if (ref.startsWith('ci_') && state.combatItemInstances.some((i) => i.instanceId === ref)) {
      return ref;
    }
    if (combatItems[ref]) return toInstance(ref);
    return ref;
  });

  for (const slot of COMBAT_SLOT_IDS) {
    const ref = state.combatEquipment?.[slot];
    if (ref && combatItems[ref]) {
      state.combatEquipment[slot] = toInstance(ref);
    }
  }

  for (const comp of Object.values(state.companions || {})) {
    for (const [slot, ref] of Object.entries(comp.equipment || {})) {
      if (ref && combatItems[ref]) {
        comp.equipment[slot] = toInstance(ref);
      }
    }
  }

  for (const inst of state.combatItemInstances) {
    if (!inst.rarity) inst.rarity = 'common';
  }
}

export function getEquippedWeapon(state, combatItems) {
  const weaponRef = state.combatEquipment?.weapon;
  if (!weaponRef) return null;
  const itemId = resolveItemId(state, weaponRef, combatItems);
  if (!itemId) return null;
  return combatItems[itemId] || null;
}

export function getPlayerSkillIds(state, combatItems) {
  return getMemberSkillIds({ role: 'hero' }, state, combatItems);
}

export function getMemberSkillIds(member, state, combatItems) {
  let weapon = null;
  if (member.role === 'hero') {
    weapon = getEquippedWeapon(state, combatItems);
    if (!weapon?.weaponType) return [...UNARMED_SKILLS];
    return WEAPON_TYPE_SKILLS[weapon.weaponType] || [...UNARMED_SKILLS];
  }

  const weaponId = state.companions?.[member.companionId]?.equipment?.weapon;
  const itemId = weaponId ? resolveItemId(state, weaponId, combatItems) : null;
  weapon = itemId ? combatItems[itemId] : null;
  if (!weapon?.weaponType) return [...UNARMED_SKILLS];
  return WEAPON_TYPE_SKILLS[weapon.weaponType] || [...UNARMED_SKILLS];
}

export function getCompanionStats(companionId, state, characterConfig, combatItems) {
  const level = state.character?.level || 1;
  const stats = getBaseStats(characterConfig, level);
  const eq = state.companions?.[companionId]?.equipment || {};
  for (const slot of COMPANION_EQUIP_SLOTS) {
    const ref = eq[slot];
    if (!ref) continue;
    const itemId = resolveItemId(state, ref, combatItems) || ref;
    const item = combatItems[itemId];
    if (!item?.stats) continue;
    stats.hp += item.stats.hp || 0;
    stats.atk += item.stats.atk || 0;
    stats.def += item.stats.def || 0;
  }
  return stats;
}

export function buildHeroOnlyParty(state, characterConfig, combatItems, balance) {
  const heroStats = getCombatStats(
    state,
    characterConfig,
    { items: combatItems },
    combatItems,
    balance
  );
  const party = [{
    id: 'hero',
    role: 'hero',
    name: getCharacterDisplayName(state, characterConfig),
    emoji: '🧘',
    hp: heroStats.hp,
    maxHp: heroStats.hp,
    stats: heroStats,
    defBonus: 0,
  }];
  applySavedSoloHp(state, party);
  return party;
}

export function applySavedSoloHp(state, party) {
  const wear = state.combatWear?.solo;
  if (!wear) return;
  for (const m of party) {
    if (wear[m.id] != null) {
      m.hp = Math.max(0, Math.min(m.maxHp, wear[m.id]));
    }
  }
}

export function saveSoloHp(state, party) {
  if (!state.combatWear) state.combatWear = {};
  state.combatWear.solo = Object.fromEntries(party.map((m) => [m.id, m.hp]));
}

export function clearSoloHpWear(state) {
  if (state.combatWear) delete state.combatWear.solo;
}

export function snapshotDungeonParty(state, party) {
  if (!state.combatWear) state.combatWear = {};
  state.combatWear.dungeonEntry = Object.fromEntries(party.map((m) => [m.id, m.hp]));
}

export function applyDungeonPartySnapshot(state, party) {
  const snap = state.combatWear?.dungeonEntry;
  if (!snap) return;
  for (const member of party) {
    if (snap[member.id] != null) {
      member.hp = Math.max(0, Math.min(member.maxHp, snap[member.id]));
    }
  }
}

export function restoreCombatWearFromDungeonEntry(state) {
  const snap = state.combatWear?.dungeonEntry;
  if (!snap) return;
  if (!state.combatWear) state.combatWear = {};
  if (snap.hero != null) {
    state.combatWear.solo = { hero: snap.hero };
  }
}

export function clearDungeonPartySnapshot(state) {
  if (state.combatWear) delete state.combatWear.dungeonEntry;
}

export function buildParty(state, characterConfig, combatItems, companionDefs, balance) {
  const members = buildHeroOnlyParty(state, characterConfig, combatItems, balance);

  for (const [companionId, def] of Object.entries(companionDefs || {})) {
    const comp = state.companions?.[companionId];
    if (!comp?.unlocked || comp.activeInParty === false) continue;
    const stats = getCompanionStats(companionId, state, characterConfig, combatItems);
    members.push({
      id: companionId,
      role: 'companion',
      companionId,
      name: getCompanionDisplayName(companionId, state, companionDefs),
      emoji: def.emoji,
      hp: stats.hp,
      maxHp: stats.hp,
      stats,
      defBonus: 0,
    });
  }

  return members;
}

export function getPartyScale(partySize) {
  return 1 + (partySize - 1) * 0.45;
}

let enemyInstanceCounter = 0;

function nextEnemyInstanceId() {
  enemyInstanceCounter += 1;
  return `foe_${enemyInstanceCounter}`;
}

export function createEnemyInstance(foe, enemiesDb, partySize, { hpScale = 1, isPrimary = false } = {}) {
  const base = enemiesDb[foe.enemyId];
  if (!base) return null;
  const scale = getPartyScale(partySize);
  const scaledHp = Math.max(1, Math.floor(base.hp * scale * hpScale));
  return {
    id: nextEnemyInstanceId(),
    enemyId: foe.enemyId,
    name: foe.name,
    emoji: foe.emoji,
    boss: !!foe.boss,
    atk: base.atk,
    def: base.def,
    hp: scaledHp,
    maxHp: scaledHp,
    stunned: false,
    atkPenalty: 0,
    drops: foe.drops,
    charXpReward: foe.charXpReward,
    primary: isPrimary,
  };
}

export function buildEncounterEnemies(primaryFoe, enemiesDb, partySize, combatZone, isBoss) {
  const list = [];
  const primary = createEnemyInstance({ ...primaryFoe, boss: isBoss }, enemiesDb, partySize, {
    isPrimary: true,
    hpScale: isBoss ? 1 : 1,
  });
  if (primary) list.push(primary);

  const pool = (combatZone?.monsters || []).filter((m) => m.enemyId !== primaryFoe.enemyId);
  let extraCount = isBoss
    ? Math.min(2, Math.max(1, partySize - 1))
    : Math.min(2, Math.max(0, partySize - 1));

  if (!isBoss && partySize >= 2 && pool.length > 0) extraCount = Math.max(extraCount, 1);

  for (let i = 0; i < extraCount && pool.length; i += 1) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const add = createEnemyInstance(pick, enemiesDb, partySize, { hpScale: isBoss ? 0.5 : 0.7 });
    if (add) list.push(add);
  }

  return list;
}

export function getLivingEnemies(combat) {
  return (combat?.enemies || []).filter((e) => e.hp > 0);
}

export function getEnemyById(combat, targetId) {
  if (!combat?.enemies) return null;
  if (!targetId || targetId === 'enemy') return getLivingEnemies(combat)[0] || null;
  return combat.enemies.find((e) => e.id === targetId && e.hp > 0) || null;
}

export function getActiveEnemy(combat) {
  if (!combat?.enemies?.length) return null;
  const idx = combat.activeEnemyIndex ?? 0;
  const enemy = combat.enemies[idx];
  if (enemy?.hp > 0) return enemy;
  return getLivingEnemies(combat)[0] || null;
}

export function initEncounter(run, foe, enemies, partySize = 1, combatZone = null) {
  const isBoss = !!foe.boss;
  const enemyList = combatZone
    ? buildEncounterEnemies(foe, enemies, partySize, combatZone, isBoss)
    : [createEnemyInstance(foe, enemies, partySize, { isPrimary: true })].filter(Boolean);

  run.combat = {
    enemies: enemyList,
    phase: 'player',
    turnQueue: [],
    activeMemberIndex: 0,
    enemyTurnQueue: [],
    activeEnemyIndex: 0,
    log: [],
    desperateUses: 0,
    skillUses: {},
  };
  startPlayerTurn(run);
  return run.combat;
}

/** Type d'encounter pour les plafonds d'attaque forte. */
export function getEncounterUseKind(run) {
  if (run?.isDungeonRun) return 'dungeon';
  if (run?.isBoss) return 'soloBoss';
  return 'soloMob';
}

export function getSkillMaxUses(skill, run) {
  if (!skill?.limitedUses && skill?.id !== 'desperate_blow') return null;
  const kind = getEncounterUseKind(run);
  const table = skill.usesPerEncounter;
  if (table && typeof table[kind] === 'number') return Math.max(0, table[kind]);
  if (skill.id === 'desperate_blow') return 2;
  return null;
}

export function getSkillUsesLeft(skill, run) {
  const max = getSkillMaxUses(skill, run);
  if (max == null) return null;
  const used = run?.combat?.skillUses?.[skill.id]
    ?? (skill.id === 'desperate_blow' ? (run?.combat?.desperateUses || 0) : 0);
  return Math.max(0, max - used);
}

export function consumeSkillUse(skill, run) {
  const max = getSkillMaxUses(skill, run);
  if (max == null) return { ok: true, left: null, max: null };
  if (!run.combat.skillUses) run.combat.skillUses = {};
  const used = run.combat.skillUses[skill.id] || 0;
  if (used >= max) {
    return { ok: false, left: 0, max };
  }
  run.combat.skillUses[skill.id] = used + 1;
  if (skill.id === 'desperate_blow') {
    run.combat.desperateUses = run.combat.skillUses[skill.id];
  }
  return { ok: true, left: max - used - 1, max };
}

export function startPlayerTurn(run) {
  if (!run.combat || !run.party) return;
  run.combat.phase = 'player';
  for (const member of run.party) {
    member.defBonus = 0;
    member.mealUsedThisRound = false;
  }
  run.combat.turnQueue = run.party
    .map((member, index) => ({ member, index }))
    .filter(({ member }) => member.hp > 0)
    .map(({ index }) => index);
  run.combat.activeMemberIndex = run.combat.turnQueue[0] ?? 0;
}

function getActiveMember(run) {
  return run.party?.[run.combat?.activeMemberIndex];
}

function advanceAfterMemberAction(run) {
  const queue = run.combat.turnQueue;
  const currentPos = queue.indexOf(run.combat.activeMemberIndex);
  if (currentPos >= 0 && currentPos < queue.length - 1) {
    run.combat.activeMemberIndex = queue[currentPos + 1];
    return { nextMember: true };
  }
  startEnemyTurn(run);
  return { nextMember: false };
}

function startEnemyTurn(run) {
  if (!run.combat) return;
  run.combat.phase = 'enemy';
  run.combat.enemyTurnQueue = run.combat.enemies
    .map((enemy, index) => ({ enemy, index }))
    .filter(({ enemy }) => enemy.hp > 0)
    .map(({ index }) => index);
  run.combat.activeEnemyIndex = run.combat.enemyTurnQueue[0] ?? 0;
}

function applySkillDamage(run, skill, member, targetEnemyId) {
  const enemy = getEnemyById(run.combat, targetEnemyId);
  if (!enemy) return 0;
  const dmgSpec = skill.damage || {};
  const dmg = calcDamage(
    member.stats.atk,
    enemy.def,
    dmgSpec.multiplier || 0,
    dmgSpec.ignoreDef || 0
  );
  enemy.hp = Math.max(0, enemy.hp - dmg);
  run.combat.log.push({
    type: 'player',
    text: `${member.emoji} ${member.name} frappe ${enemy.emoji} ${enemy.name} avec ${skill.emoji} ${skill.name} : ${dmg} dégâts.`,
    dmg,
    memberId: member.id,
    enemyId: enemy.id,
  });
  if (enemy.hp <= 0) {
    run.combat.log.push({ type: 'system', text: `${enemy.emoji} ${enemy.name} est vaincu !` });
  }
  return dmg;
}

export function getSkillTargetMode(skill) {
  if (!skill) return 'self';
  if (skill.heal) return 'ally';
  if (skill.damage) return 'enemy';
  return 'self';
}

function applyMemberSkillEffects(run, skill, member, targetMember, targetEnemyId) {
  if (skill.heal) {
    const healTarget = targetMember || member;
    const amount = Math.max(1, Math.floor(healTarget.maxHp * (skill.heal.percent || 0)));
    healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + amount);
    run.combat.log.push({
      type: 'player',
      text: healTarget.id === member.id
        ? `${member.emoji} ${member.name} se soigne avec ${skill.emoji} ${skill.name} : +${amount} HP.`
        : `${member.emoji} ${member.name} soigne ${healTarget.emoji} ${healTarget.name} avec ${skill.emoji} ${skill.name} : +${amount} HP.`,
      heal: amount,
      memberId: member.id,
      targetId: healTarget.id,
    });
  }

  if (skill.effect?.type === 'guard') {
    member.defBonus += skill.effect.defBonus || 3;
    run.combat.log.push({
      type: 'player',
      text: `${member.emoji} ${member.name} — ${skill.emoji} ${skill.name} : défense renforcée.`,
      memberId: member.id,
    });
  }

  const targetEnemy = getEnemyById(run.combat, targetEnemyId);

  if (skill.effect?.type === 'weaken' && targetEnemy) {
    targetEnemy.atkPenalty += skill.effect.atkReduction || 2;
    run.combat.log.push({
      type: 'player',
      text: `${member.emoji} ${member.name} — ${skill.emoji} ${skill.name} : ${targetEnemy.name} s'affaiblit.`,
      memberId: member.id,
      enemyId: targetEnemy.id,
    });
    if (skill.damage) applySkillDamage(run, skill, member, targetEnemy.id);
  } else if (skill.damage) {
    applySkillDamage(run, skill, member, targetEnemyId);
    const hitEnemy = getEnemyById(run.combat, targetEnemyId);
    if (hitEnemy && skill.effect?.type === 'stun' && Math.random() < (skill.effect.chance || 0)) {
      hitEnemy.stunned = true;
      run.combat.log.push({ type: 'system', text: `${hitEnemy.name} est étourdi !`, enemyId: hitEnemy.id });
    }
  }
}

export function useMemberSkill(run, skill, memberIndex, targetId = 'enemy') {
  if (!run.combat || run.combat.phase !== 'player') return null;
  if (run.combat.activeMemberIndex !== memberIndex) return null;

  const member = run.party[memberIndex];
  if (!member || member.hp <= 0) return null;

  const useCheck = consumeSkillUse(skill, run);
  if (!useCheck.ok) {
    run.combat.log.push({
      type: 'system',
      text: `${skill.emoji || ''} ${skill.name} épuisée (${useCheck.max}× max).`,
    });
    return { blocked: true };
  }

  let targetMember = member;
  let targetEnemyId = targetId;
  if (skill.heal && targetId && targetId !== 'enemy' && targetId !== 'self') {
    targetMember = run.party.find((m) => m.id === targetId && m.hp > 0) || member;
  } else if (skill.damage || skill.effect?.type === 'weaken') {
    const living = getLivingEnemies(run.combat);
    if (targetId && targetId !== 'enemy' && targetId !== 'self') {
      targetEnemyId = living.find((e) => e.id === targetId)?.id || living[0]?.id;
    } else {
      targetEnemyId = living[0]?.id;
    }
  }

  applyMemberSkillEffects(run, skill, member, targetMember, targetEnemyId);

  if (getLivingEnemies(run.combat).length === 0) {
    return { enemyDefeated: true };
  }

  const advance = advanceAfterMemberAction(run);
  return { enemyDefeated: false, ...advance };
}

export function useMemberDefend(run, memberIndex) {
  if (!run.combat || run.combat.phase !== 'player') return null;
  if (run.combat.activeMemberIndex !== memberIndex) return null;

  const member = run.party[memberIndex];
  if (!member || member.hp <= 0) return null;

  member.defBonus += DEFEND_ACTION.effect.defBonus;
  run.combat.log.push({
    type: 'player',
    text: `${member.emoji} ${member.name} se met en défense.`,
    memberId: member.id,
  });

  const advance = advanceAfterMemberAction(run);
  return { enemyDefeated: false, ...advance };
}

export function canUseMemberMeal(run, memberIndex) {
  if (!run?.combat || run.combat.phase !== 'player') {
    return { ok: false, reason: 'Pas ton tour' };
  }
  if (run.combat.activeMemberIndex !== memberIndex) {
    return { ok: false, reason: 'Ce n\'est pas le tour de ce combattant' };
  }
  const member = run.party[memberIndex];
  if (!member || member.hp <= 0) return { ok: false, reason: 'Combattant KO' };
  if (member.mealUsedThisRound) return { ok: false, reason: 'Déjà mangé ce tour' };
  return { ok: true, member };
}

export function useMemberMeal(run, memberIndex, healAmount, mealLabel, mealId) {
  const check = canUseMemberMeal(run, memberIndex);
  if (!check.ok) return { blocked: true, reason: check.reason };
  const member = check.member;

  member.hp = Math.min(member.maxHp, member.hp + healAmount);
  member.mealUsedThisRound = true;
  run.combat.log.push({
    type: 'heal',
    text: `${member.emoji} ${member.name} mange ${mealLabel} : +${healAmount} HP.`,
    memberId: member.id,
    amount: healAmount,
    mealId,
  });

  const advance = advanceAfterMemberAction(run);
  return { enemyDefeated: false, ...advance };
}

function advanceEnemyTurnQueue(run, payload = {}) {
  const queue = run.combat.enemyTurnQueue || [];
  const currentPos = queue.indexOf(run.combat.activeEnemyIndex);
  if (currentPos >= 0 && currentPos < queue.length - 1) {
    run.combat.activeEnemyIndex = queue[currentPos + 1];
    return { ...payload, enemyTurnContinues: true, activeEnemyIndex: run.combat.activeEnemyIndex };
  }
  startPlayerTurn(run);
  return { ...payload, enemyTurnContinues: false, phase: 'player' };
}

export function enemyAttackTurn(run) {
  if (!run.combat || run.combat.phase !== 'enemy') return null;

  const enemy = run.combat.enemies[run.combat.activeEnemyIndex];
  if (!enemy || enemy.hp <= 0) {
    return advanceEnemyTurnQueue(run, { skipped: true });
  }

  if (enemy.stunned) {
    enemy.stunned = false;
    run.combat.log.push({
      type: 'system',
      text: `${enemy.emoji} ${enemy.name} reprend ses esprits.`,
      enemyId: enemy.id,
    });
    return advanceEnemyTurnQueue(run, { stunned: true, enemyId: enemy.id });
  }

  const living = run.party.filter((member) => member.hp > 0);
  if (living.length === 0) {
    run.combat.log.push({ type: 'system', text: 'Toute l\'équipe est tombée…' });
    return { playerDefeated: true };
  }

  const target = living[Math.floor(Math.random() * living.length)];
  const effectiveAtk = Math.max(1, enemy.atk - (enemy.atkPenalty || 0));
  const effectiveDef = target.stats.def + (target.defBonus || 0);
  const dmg = calcDamage(effectiveAtk, effectiveDef);
  target.hp = Math.max(0, target.hp - dmg);
  run.combat.log.push({
    type: 'enemy',
    text: `${enemy.emoji} ${enemy.name} attaque ${target.emoji} ${target.name} : ${dmg} dégâts.`,
    dmg,
    memberId: target.id,
    enemyId: enemy.id,
  });

  if (run.party.every((member) => member.hp <= 0)) {
    run.combat.log.push({ type: 'system', text: 'Toute l\'équipe est tombée…' });
    return { playerDefeated: true, dmg, targetId: target.id, enemyId: enemy.id };
  }

  return advanceEnemyTurnQueue(run, {
    playerDefeated: false,
    dmg,
    targetId: target.id,
    enemyId: enemy.id,
  });
}

export function runEnemyPhase(run) {
  if (!run.combat || run.combat.phase !== 'enemy') return null;
  const results = [];
  let safety = 12;
  while (run.combat.phase === 'enemy' && safety > 0) {
    safety -= 1;
    const result = enemyAttackTurn(run);
    if (!result) break;
    results.push(result);
    if (result.playerDefeated) return { playerDefeated: true, results };
    if (!result.enemyTurnContinues) break;
  }
  return { playerDefeated: false, results, phase: run.combat?.phase };
}

export function canEquipCombatItem(state, ref, combatItems) {
  const item = resolveItem(state, ref, combatItems);
  if (!item) return false;
  if (item.companionOnly) return false;
  if (!COMBAT_SLOT_IDS.includes(item.slot)) return false;
  if (!ownsCombatRef(state, ref)) return false;
  if (isCombatInstanceBroken(state, ref, combatItems)) return false;
  const owner = findCombatItemOwner(state, ref);
  if (owner && owner !== 'hero') return false;
  return true;
}

export function findCombatItemOwner(state, ref) {
  if (!ref) return null;
  for (const slotId of COMBAT_SLOT_IDS) {
    if (state.combatEquipment?.[slotId] === ref) return 'hero';
  }
  for (const [companionId, comp] of Object.entries(state.companions || {})) {
    for (const equippedRef of Object.values(comp.equipment || {})) {
      if (equippedRef === ref) return companionId;
    }
  }
  return null;
}

export function equipCombatItem(state, ref, combatItems) {
  const item = resolveItem(state, ref, combatItems);
  if (!canEquipCombatItem(state, ref, combatItems)) return false;
  if (!state.combatEquipment) state.combatEquipment = getDefaultCombatEquipment();
  state.combatEquipment[item.slot] = ref;
  return true;
}

export function unequipCombatSlot(state, slot) {
  if (!state.combatEquipment?.[slot]) return false;
  state.combatEquipment[slot] = null;
  return true;
}

export function getInstanceEffectiveStats(state, ref, combatItems) {
  const itemId = resolveItemId(state, ref, combatItems);
  const item = itemId ? combatItems[itemId] : null;
  if (!item?.stats) return { hp: 0, atk: 0, def: 0 };
  const inst = state.combatItemInstances?.find((i) => i.instanceId === ref);
  return scaleItemStats(item.stats, getInstanceRarity(inst));
}

export function grantCombatItem(state, itemId, combatItems = {}, rarity = 'common') {
  if (!state.combatItemInstances) state.combatItemInstances = [];
  if (!state.ownedCombatItems) state.ownedCombatItems = [];
  const instanceId = `ci_${itemId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const item = combatItems[itemId];
  const instance = { instanceId, itemId, rarity: normalizeRarity(rarity) };
  initCombatInstanceDurability(instance, item);
  state.combatItemInstances.push(instance);
  state.ownedCombatItems.push(instanceId);
  return instanceId;
}

export function migrateCombatEquipment(saved) {
  const eq = { ...getDefaultCombatEquipment(), ...(saved || {}) };
  if (eq.ring && !eq.ring_left) {
    eq.ring_left = eq.ring;
    delete eq.ring;
  }
  delete eq.ring;
  return eq;
}
