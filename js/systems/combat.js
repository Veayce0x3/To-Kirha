import {
  getBaseStats,
  getCombatStats,
  getCharacterDisplayName,
} from './character.js';
import { COMPANION_EQUIP_SLOTS, getCompanionDisplayName } from './companions.js';
import {
  getHeroCombatSkillIds,
  getCompanionCombatSkillIds,
  syncGrimoireKnown,
  WEAPON_TYPE_SKILLS as GRIMOIRE_WEAPON_SKILLS,
  UNARMED_SKILLS as GRIMOIRE_UNARMED,
} from './grimoire.js';
import { getSchoolUnlockedSpells } from './villageSchool.js';

export const COMBAT_SLOT_IDS = [
  'helmet', 'cape', 'amulet', 'weapon',
  'ring_left', 'ring_right', 'belt', 'chest', 'boots',
];

export const WEAPON_TYPE_SKILLS = GRIMOIRE_WEAPON_SKILLS;
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

export const UNARMED_SKILLS = GRIMOIRE_UNARMED;

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

/** Aperçu d’effet d’un sort/attaque (dégâts ou soin estimés). */
export function previewSkillEffect(skill, attackerStats, target = null) {
  if (!skill) return null;
  if (skill.heal) {
    const maxHp = Number(target?.maxHp) || Number(attackerStats?.hp) || 0;
    const amount = Math.max(1, Math.floor(maxHp * (Number(skill.heal.percent) || 0)));
    return { kind: 'heal', value: amount, label: `+${amount} PV` };
  }
  if (skill.damage) {
    const enemyDef = (Number(target?.def) || 0) + (Number(target?.defBonus) || 0);
    const dmg = calcDamage(
      Number(attackerStats?.atk) || 0,
      enemyDef,
      Number(skill.damage.multiplier) || 0,
      Number(skill.damage.ignoreDef) || 0
    );
    return { kind: 'damage', value: dmg, label: `~${dmg} dégâts` };
  }
  if (skill.effect?.type === 'guard') {
    return { kind: 'effect', value: skill.effect.defBonus || 0, label: `+${skill.effect.defBonus || 0} DEF` };
  }
  if (skill.effect) {
    return { kind: 'effect', value: 0, label: 'Effet' };
  }
  return null;
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
  if (member.role === 'hero') {
    const schoolSpells = getSchoolUnlockedSpells(state);
    return getHeroCombatSkillIds(state, combatItems, schoolSpells);
  }
  return getCompanionCombatSkillIds(state, member.companionId, combatItems);
}

export function getSkillMpCost(skill) {
  if (!skill) return 0;
  if (skill.mpCost != null) return Math.max(0, Number(skill.mpCost) || 0);
  if (skill.paCost != null) return Math.max(0, (Number(skill.paCost) || 0) * 5);
  return 0;
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
    stats.mp = (stats.mp || 0) + (item.stats.mp || 0);
    stats.atk += item.stats.atk || 0;
    stats.def += item.stats.def || 0;
  }
  // Compagnons : un peu moins de PM que le héros
  stats.mp = Math.max(20, Math.floor((stats.mp || 40) * 0.85));
  return stats;
}

export function buildHeroOnlyParty(state, characterConfig, combatItems, balance) {
  syncGrimoireKnown(state, combatItems, getSchoolUnlockedSpells(state));
  const heroStats = getCombatStats(
    state,
    characterConfig,
    { items: combatItems },
    combatItems,
    balance
  );
  const maxMp = Math.max(0, heroStats.mp || 0);
  const party = [{
    id: 'hero',
    role: 'hero',
    name: getCharacterDisplayName(state, characterConfig),
    emoji: '🧘',
    hp: heroStats.hp,
    maxHp: heroStats.hp,
    mp: maxMp,
    maxMp,
    stats: heroStats,
    defBonus: 0,
    nextDamageBonus: 0,
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
    const mpKey = `${m.id}_mp`;
    if (wear[mpKey] != null && m.maxMp != null) {
      m.mp = Math.max(0, Math.min(m.maxMp, wear[mpKey]));
    }
  }
}

export function saveSoloHp(state, party) {
  if (!state.combatWear) state.combatWear = {};
  const prev = state.combatWear.solo && typeof state.combatWear.solo === 'object'
    ? { ...state.combatWear.solo }
    : {};
  for (const m of party) {
    prev[m.id] = m.hp;
    if (m.maxMp != null) prev[`${m.id}_mp`] = m.mp;
  }
  state.combatWear.solo = prev;
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
      mp: stats.mp || 0,
      maxMp: stats.mp || 0,
      stats,
      defBonus: 0,
      nextDamageBonus: 0,
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

export function createEnemyInstance(foe, enemiesDb, partySize, { hpScale = 1, isPrimary = false, seasonScale = 1 } = {}) {
  const base = enemiesDb[foe.enemyId];
  if (!base) return null;
  const scale = getPartyScale(partySize);
  const s = Math.max(0.01, Number(seasonScale) || 1);
  const scaledHp = Math.max(1, Math.floor(base.hp * scale * hpScale * s));
  return {
    id: nextEnemyInstanceId(),
    enemyId: foe.enemyId,
    name: foe.name,
    emoji: foe.emoji,
    boss: !!foe.boss,
    atk: Math.max(1, Math.floor((base.atk || 1) * s)),
    def: Math.max(0, Math.floor((base.def || 0) * s)),
    hp: scaledHp,
    maxHp: scaledHp,
    defBonus: 0,
    stunned: false,
    atkPenalty: 0,
    ai: base.ai || null,
    drops: foe.drops,
    charXpReward: foe.charXpReward,
    primary: isPrimary,
  };
}

export function buildEncounterEnemies(primaryFoe, enemiesDb, partySize, combatZone, isBoss, seasonScale = 1) {
  const list = [];
  const primary = createEnemyInstance({ ...primaryFoe, boss: isBoss }, enemiesDb, partySize, {
    isPrimary: true,
    hpScale: isBoss ? 1 : 1,
    seasonScale,
  });
  if (primary) list.push(primary);

  const pool = (combatZone?.monsters || []).filter((m) => m.enemyId !== primaryFoe.enemyId);
  let extraCount = isBoss
    ? Math.min(2, Math.max(1, partySize - 1))
    : Math.min(2, Math.max(0, partySize - 1));

  if (!isBoss && partySize >= 2 && pool.length > 0) extraCount = Math.max(extraCount, 1);

  for (let i = 0; i < extraCount && pool.length; i += 1) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const add = createEnemyInstance(pick, enemiesDb, partySize, {
      hpScale: isBoss ? 0.5 : 0.7,
      seasonScale,
    });
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

export function initEncounter(run, foe, enemies, partySize = 1, combatZone = null, seasonScale = 1) {
  const isBoss = !!foe.boss;
  const enemyList = combatZone
    ? buildEncounterEnemies(foe, enemies, partySize, combatZone, isBoss, seasonScale)
    : [createEnemyInstance(foe, enemies, partySize, { isPrimary: true, seasonScale })].filter(Boolean);

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
  let mult = dmgSpec.multiplier || 0;
  if (member.nextDamageBonus > 0) {
    mult *= (1 + member.nextDamageBonus);
    member.nextDamageBonus = 0;
  }
  const enemyDef = (enemy.def || 0) + (enemy.defBonus || 0);
  const dmg = calcDamage(
    member.stats.atk,
    enemyDef,
    mult,
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

  if (skill.effect?.type === 'focus') {
    member.nextDamageBonus = (member.nextDamageBonus || 0) + (skill.effect.nextDamageBonus || 0.5);
    run.combat.log.push({
      type: 'player',
      text: `${member.emoji} ${member.name} — ${skill.emoji} ${skill.name} : prochaine attaque renforcée.`,
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

  const mpCost = getSkillMpCost(skill);
  if ((member.mp || 0) < mpCost) {
    run.combat.log.push({
      type: 'system',
      text: `${member.emoji} ${member.name} — PM insuffisants (${mpCost} requis).`,
    });
    return { blocked: true, reason: 'PM insuffisants' };
  }

  const useCheck = consumeSkillUse(skill, run);
  if (!useCheck.ok) {
    run.combat.log.push({
      type: 'system',
      text: `${skill.emoji || ''} ${skill.name} épuisée (${useCheck.max}× max).`,
    });
    return { blocked: true };
  }

  if (mpCost > 0) {
    member.mp = Math.max(0, (member.mp || 0) - mpCost);
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

export function useMemberMeal(run, memberIndex, healAmount, mealLabel, mealId, mpAmount = 0) {
  const check = canUseMemberMeal(run, memberIndex);
  if (!check.ok) return { blocked: true, reason: check.reason };
  const member = check.member;

  let healed = 0;
  let restoredMp = 0;
  if (healAmount > 0) {
    const before = member.hp;
    member.hp = Math.min(member.maxHp, member.hp + healAmount);
    healed = member.hp - before;
  }
  if (mpAmount > 0 && member.maxMp != null) {
    const before = member.mp || 0;
    member.mp = Math.min(member.maxMp, before + mpAmount);
    restoredMp = member.mp - before;
  }

  member.mealUsedThisRound = true;
  const bits = [];
  if (healed > 0) bits.push(`+${healed} PV`);
  if (restoredMp > 0) bits.push(`+${restoredMp} PM`);
  run.combat.log.push({
    type: 'heal',
    text: `${member.emoji} ${member.name} mange ${mealLabel}${bits.length ? ` : ${bits.join(' · ')}` : ''}.`,
    memberId: member.id,
    amount: healed,
    mp: restoredMp,
    mealId,
  });

  const advance = advanceAfterMemberAction(run);
  return { enemyDefeated: false, healed, restoredMp, ...advance };
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

  const pattern = pickEnemyPattern(enemy);
  if (pattern?.type === 'guard') {
    enemy.defBonus = (enemy.defBonus || 0) + (pattern.defBonus || 4);
    run.combat.log.push({
      type: 'enemy',
      text: `${enemy.emoji} ${enemy.name} renforce sa défense !`,
      enemyId: enemy.id,
    });
    return advanceEnemyTurnQueue(run, { enemyId: enemy.id, pattern: pattern.id });
  }

  if (pattern?.type === 'heal') {
    const amount = Math.max(1, Math.floor(enemy.maxHp * (pattern.healPercent || 0.1)));
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount);
    run.combat.log.push({
      type: 'enemy',
      text: `${enemy.emoji} ${enemy.name} se soigne : +${amount} PV.`,
      enemyId: enemy.id,
      heal: amount,
    });
    return advanceEnemyTurnQueue(run, { enemyId: enemy.id, pattern: pattern.id });
  }

  const target = living[Math.floor(Math.random() * living.length)];
  const effectiveAtk = Math.max(1, enemy.atk - (enemy.atkPenalty || 0));
  const effectiveDef = target.stats.def + (target.defBonus || 0);
  const dmg = calcDamage(effectiveAtk, effectiveDef, pattern?.damageMult || 1);
  target.hp = Math.max(0, target.hp - dmg);
  const label = pattern?.id && pattern.id !== 'strike'
    ? ` (${pattern.id})`
    : '';
  run.combat.log.push({
    type: 'enemy',
    text: `${enemy.emoji} ${enemy.name} attaque${label} ${target.emoji} ${target.name} : ${dmg} dégâts.`,
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

function pickEnemyPattern(enemy) {
  const patterns = enemy?.ai?.patterns;
  if (!Array.isArray(patterns) || !patterns.length) {
    return { id: 'strike', damageMult: 1 };
  }
  const hpPct = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
  const eligible = patterns.filter((p) => {
    if (p.maxHpPct != null && hpPct > p.maxHpPct) return false;
    if (p.minHpPct != null && hpPct < p.minHpPct) return false;
    return true;
  });
  const pool = eligible.length ? eligible : patterns;
  const total = pool.reduce((a, p) => a + Math.max(0, Number(p.weight) || 1), 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= Math.max(0, Number(p.weight) || 1);
    if (r <= 0) return p;
  }
  return pool[0];
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
  delete eq.shield;
  return eq;
}
