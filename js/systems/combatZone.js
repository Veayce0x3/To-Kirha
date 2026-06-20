import {
  initEncounter,
  useMemberSkill,
  useMemberDefend,
  useMemberMeal,
  enemyAttackTurn,
  buildParty,
  buildHeroOnlyParty,
  getMemberSkillIds,
  getLivingEnemies,
  DEFEND_ACTION,
  saveSoloHp,
  clearSoloHpWear,
} from './combat.js';
import { addCharacterXp } from './character.js';
import { useMealHealInCombat, clearCombatMealBuff, DUNGEON_ROOM_HEAL } from './consumables.js';
import { wearEquippedCombatGear } from './combatDurability.js';
import {
  canSpendDailyCombat,
  getDungeonUnlockReason,
  recordDailyCombatUse,
} from './combatDaily.js';

function isZoneUnlocked(zoneId, state, balance) {
  if (balance.zones[zoneId]?.unlocked) return true;
  return (state.unlockedZones || []).includes(zoneId);
}

export function buildDungeonRooms(combatZone) {
  const rooms = (combatZone.monsters || []).map((foe) => ({ foe, isBoss: false }));
  if (combatZone.boss) rooms.push({ foe: combatZone.boss, isBoss: true });
  return rooms;
}

export function canFight(combatZone, state, balance, characterConfig, isBoss = false) {
  if (!isZoneUnlocked(combatZone.zone, state, balance)) {
    return { ok: false, reason: 'Zone verrouillée' };
  }
  const charLevel = state.character?.level || 1;
  if (charLevel < combatZone.requiredCharLevel) {
    return { ok: false, reason: `Perso Nv.${combatZone.requiredCharLevel} requis` };
  }
  if (state.combatEncounter) return { ok: false, reason: 'Combat en cours' };

  const dailyKind = isBoss ? 'soloBoss' : 'soloMob';
  const dailyCheck = canSpendDailyCombat(state, balance, dailyKind);
  if (!dailyCheck.ok) return dailyCheck;

  return { ok: true };
}

export function canEnterDungeon(combatZone, state, balance, characterConfig) {
  if (!isZoneUnlocked(combatZone.zone, state, balance)) {
    return { ok: false, reason: 'Zone verrouillée' };
  }
  const charLevel = state.character?.level || 1;
  if (charLevel < combatZone.requiredCharLevel) {
    return { ok: false, reason: `Perso Nv.${combatZone.requiredCharLevel} requis` };
  }
  if (state.combatEncounter) return { ok: false, reason: 'Combat en cours' };
  const rooms = buildDungeonRooms(combatZone);
  if (rooms.length === 0) return { ok: false, reason: 'Donjon vide' };

  const unlockReason = getDungeonUnlockReason(combatZone, state, balance);
  if (unlockReason) return { ok: false, reason: unlockReason };

  const dailyCheck = canSpendDailyCombat(state, balance, 'dungeonRun');
  if (!dailyCheck.ok) return dailyCheck;

  return { ok: true, roomCount: rooms.length };
}

export function rollDrops(dropTable) {
  const gained = {};
  for (const [resId, spec] of Object.entries(dropTable || {})) {
    if (Math.random() > (spec.chance ?? 1)) continue;
    const min = spec.min ?? 1;
    const max = spec.max ?? min;
    const amount = min + Math.floor(Math.random() * (max - min + 1));
    gained[resId] = (gained[resId] || 0) + amount;
  }
  return gained;
}

export function applyDrops(state, drops) {
  for (const [resId, amount] of Object.entries(drops)) {
    state.inventory[resId] = (state.inventory[resId] || 0) + amount;
  }
}

function mergeDropTables(target, source) {
  for (const [resId, amount] of Object.entries(source || {})) {
    target[resId] = (target[resId] || 0) + amount;
  }
}

function recordKill(state, zoneId, foe, isBoss) {
  if (!state.combatKillStats) state.combatKillStats = {};
  const key = isBoss ? `boss_${foe.enemyId}` : foe.enemyId;
  state.combatKillStats[key] = (state.combatKillStats[key] || 0) + 1;
  if (isBoss) {
    if (!state.bossKills) state.bossKills = {};
    state.bossKills[zoneId] = (state.bossKills[zoneId] || 0) + 1;
  }
}

export function startFight(
  combatZone,
  foe,
  isBoss,
  state,
  balance,
  characterConfig,
  combatItems,
  enemies,
  companionDefs
) {
  const check = canFight(combatZone, state, balance, characterConfig, isBoss);
  if (!check.ok) return check;

  const party = buildHeroOnlyParty(state, characterConfig, combatItems, balance);

  state.combatEncounter = {
    zoneId: combatZone.id,
    combatZone,
    foe,
    isBoss,
    isDungeonRun: false,
    isSoloFight: true,
    party,
    killStats: state.combatKillStats || {},
  };

  initEncounter(state.combatEncounter, { ...foe, boss: isBoss }, enemies, 1, combatZone);
  return { ok: true, encounter: state.combatEncounter };
}

export function startDungeonRun(
  combatZone,
  state,
  balance,
  characterConfig,
  combatItems,
  enemies,
  companionDefs
) {
  const check = canEnterDungeon(combatZone, state, balance, characterConfig);
  if (!check.ok) return check;

  recordDailyCombatUse(state, 'dungeonRun');

  const rooms = buildDungeonRooms(combatZone);
  const party = buildParty(state, characterConfig, combatItems, companionDefs, balance);
  const first = rooms[0];

  state.combatEncounter = {
    zoneId: combatZone.id,
    combatZone,
    isDungeonRun: true,
    roomIndex: 0,
    rooms,
    dungeonDrops: {},
    dungeonCharXp: 0,
    foe: first.foe,
    isBoss: first.isBoss,
    party,
  };

  initEncounter(state.combatEncounter, { ...first.foe, boss: first.isBoss }, enemies, party.length, combatZone);
  return { ok: true, encounter: state.combatEncounter, roomCount: rooms.length };
}

function wearAfterCombat(state, combatItems) {
  return wearEquippedCombatGear(state, combatItems);
}

function completeVictory(zoneId, foe, isBoss, state, characterConfig, balance, combatItems) {
  const run = state.combatEncounter;
  const charXp = foe.charXpReward || 0;
  const levelResult = charXp > 0 ? addCharacterXp(state, charXp, characterConfig, balance) : null;
  const drops = rollDrops(foe.drops);
  applyDrops(state, drops);
  recordKill(state, zoneId, foe, isBoss);

  if (!run?.isDungeonRun) {
    recordDailyCombatUse(state, isBoss ? 'soloBoss' : 'soloMob');
  }

  if (combatItems) wearAfterCombat(state, combatItems);

  if (run?.isSoloFight && run.party) {
    saveSoloHp(state, run.party);
  }

  state.combatEncounter = null;

  return {
    victory: true,
    cleared: true,
    charXp,
    levelResult,
    drops,
    isBoss,
    zoneId,
  };
}

function finishDungeonRun(run, state, characterConfig, balance, combatItems) {
  const totalXp = run.dungeonCharXp || 0;
  const levelResult = totalXp > 0 ? addCharacterXp(state, totalXp, characterConfig, balance) : null;
  applyDrops(state, run.dungeonDrops || {});
  const roomCount = run.rooms?.length || 0;

  for (const member of run.party || []) {
    member.hp = member.maxHp;
  }

  clearSoloHpWear(state);
  clearCombatMealBuff(state);

  state.combatEncounter = null;

  return {
    victory: true,
    cleared: true,
    isDungeon: true,
    isBoss: true,
    charXp: totalXp,
    levelResult,
    drops: { ...(run.dungeonDrops || {}) },
    roomCount,
    zoneId: run.zoneId,
    partyRestored: true,
  };
}

function advanceDungeonRoom(run, state, characterConfig, enemies, balance, combatItems) {
  const drops = rollDrops(run.foe.drops);
  mergeDropTables(run.dungeonDrops, drops);
  run.dungeonCharXp = (run.dungeonCharXp || 0) + (run.foe.charXpReward || 0);
  recordKill(state, run.zoneId, run.foe, run.isBoss);

  if (combatItems) wearAfterCombat(state, combatItems);

  run.roomIndex += 1;
  if (run.roomIndex >= run.rooms.length) {
    return finishDungeonRun(run, state, characterConfig, balance, combatItems);
  }

  let roomHealTotal = 0;
  for (const member of run.party || []) {
    if (member.hp <= 0) continue;
    const before = member.hp;
    member.hp = Math.min(member.maxHp, member.hp + DUNGEON_ROOM_HEAL);
    roomHealTotal += member.hp - before;
  }

  const next = run.rooms[run.roomIndex];
  run.foe = next.foe;
  run.isBoss = next.isBoss;
  initEncounter(run, { ...next.foe, boss: next.isBoss }, enemies, run.party.length, run.combatZone);

  if (roomHealTotal > 0 && run.combat?.log) {
    run.combat.log.push({
      type: 'heal',
      text: `🌸 Pause entre les salles : +${DUNGEON_ROOM_HEAL} PV par allié.`,
    });
  }

  return {
    continuing: true,
    roomAdvanced: true,
    roomIndex: run.roomIndex,
    roomCount: run.rooms.length,
    foe: next.foe,
    isBoss: next.isBoss,
    party: run.party,
    phase: run.combat.phase,
    activeMemberIndex: run.combat.activeMemberIndex,
    roomHeal: DUNGEON_ROOM_HEAL,
  };
}

function onEnemyDefeated(run, state, characterConfig, enemies, balance, combatItems) {
  if (run.isDungeonRun) {
    return advanceDungeonRoom(run, state, characterConfig, enemies, balance, combatItems);
  }
  return completeVictory(run.zoneId, run.foe, run.isBoss, state, characterConfig, balance, combatItems);
}

function resolveEnemyPhaseStep(state, characterConfig, enemies, balance, combatItems) {
  const run = state.combatEncounter;
  const enemyResult = enemyAttackTurn(run);

  if (enemyResult?.playerDefeated) {
    if (run?.isSoloFight && run.party) saveSoloHp(state, run.party);
    const fail = { victory: false, cleared: false, isDungeon: !!run.isDungeonRun };
    state.combatEncounter = null;
    return fail;
  }

  if (getLivingEnemies(run.combat).length === 0) {
    return onEnemyDefeated(run, state, characterConfig, enemies, balance, combatItems);
  }

  return {
    continuing: true,
    party: run.party,
    phase: run.combat.phase,
    enemyTurnContinues: run.combat.phase === 'enemy',
    activeEnemyIndex: run.combat.activeEnemyIndex,
    enemyId: enemyResult?.enemyId,
    targetId: enemyResult?.targetId,
  };
}

export function stepCombatEnemyTurn(state, characterConfig, enemies, balance, combatItems) {
  const run = state.combatEncounter;
  if (!run?.combat || run.combat.phase !== 'enemy') return null;
  return resolveEnemyPhaseStep(state, characterConfig, enemies, balance, combatItems);
}

export function useCombatSkill(skillId, state, skills, characterConfig, enemies, targetId = 'enemy', balance, combatItems) {
  const run = state.combatEncounter;
  if (!run?.combat) return null;

  const skillDef = skills[skillId];
  if (!skillDef) return null;

  const memberIndex = run.combat.activeMemberIndex;
  const result = useMemberSkill(run, skillDef, memberIndex, targetId);
  if (!result) return null;

  if (result.enemyDefeated) {
    return onEnemyDefeated(run, state, characterConfig, enemies, balance, combatItems);
  }

  if (!result.nextMember) {
    return resolveEnemyPhaseStep(state, characterConfig, enemies, balance, combatItems);
  }

  return {
    continuing: true,
    nextMember: true,
    activeMemberIndex: run.combat.activeMemberIndex,
    party: run.party,
    phase: run.combat.phase,
  };
}

export function useCombatDefend(state, characterConfig, enemies, balance, combatItems) {
  const run = state.combatEncounter;
  if (!run?.combat) return null;

  const memberIndex = run.combat.activeMemberIndex;
  const result = useMemberDefend(run, memberIndex);
  if (!result) return null;

  if (result.enemyDefeated) {
    return onEnemyDefeated(run, state, characterConfig, enemies, balance, combatItems);
  }

  if (!result.nextMember) {
    return resolveEnemyPhaseStep(state, characterConfig, enemies, balance, combatItems);
  }

  return {
    continuing: true,
    nextMember: true,
    activeMemberIndex: run.combat.activeMemberIndex,
    party: run.party,
    phase: run.combat.phase,
  };
}

export function useCombatMeal(mealId, state, characterConfig, enemies, balance, combatItems) {
  const run = state.combatEncounter;
  if (!run?.combat) return null;

  const heal = useMealHealInCombat(state, mealId);
  if (!heal.ok) return { blocked: true, reason: heal.reason };

  const memberIndex = run.combat.activeMemberIndex;
  const gain = heal.healAmount;
  const result = useMemberMeal(run, memberIndex, gain, heal.label, mealId);
  if (!result) return { blocked: true, reason: 'Impossible d\'utiliser ce repas' };
  if (result.blocked) return result;

  if (result.enemyDefeated) {
    return onEnemyDefeated(run, state, characterConfig, enemies, balance, combatItems);
  }

  if (!result.nextMember) {
    return resolveEnemyPhaseStep(state, characterConfig, enemies, balance, combatItems);
  }

  return {
    continuing: true,
    nextMember: true,
    healed: gain,
    activeMemberIndex: run.combat.activeMemberIndex,
    party: run.party,
    phase: run.combat.phase,
  };
}

export function abandonCombat(state) {
  state.combatEncounter = null;
}

export function getActiveEncounter(state, combatZones) {
  const enc = state.combatEncounter;
  if (!enc) return null;
  return { encounter: enc, zone: combatZones[enc.zoneId] };
}

export function getActiveMemberSkills(state, combatItems, combatSkills, weaponRoles) {
  const run = state.combatEncounter;
  if (!run?.combat || run.combat.phase !== 'player') return [];

  const member = run.party[run.combat.activeMemberIndex];
  if (!member || member.hp <= 0) return [];

  const ids = getMemberSkillIds(member, state, combatItems);
  return ids.map((id) => combatSkills[id]).filter(Boolean);
}

export function getActiveCombatMember(state) {
  const run = state.combatEncounter;
  if (!run?.combat) return null;
  return run.party[run.combat.activeMemberIndex] || null;
}

export { DEFEND_ACTION };
