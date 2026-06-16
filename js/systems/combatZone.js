import {
  initEncounter,
  useMemberSkill,
  useMemberDefend,
  enemyAttackTurn,
  buildParty,
  buildHeroOnlyParty,
  getMemberSkillIds,
  getLivingEnemies,
  getEquippedWeapon,
  WEAPON_TYPE_SKILLS,
  DEFEND_ACTION,
} from './combat.js';
import { addCharacterXp } from './character.js';
import {
  canSpendDailyCombat,
  getDungeonUnlockReason,
  recordDailyCombatUse,
} from './combatDaily.js';
import { isTutorialActive } from './tutorial.js';
import { canClaimTutorialReward, claimTutorialReward } from './tutorialSandbox.js';

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
  if (!isTutorialActive(state)) {
    const dailyCheck = canSpendDailyCombat(state, balance, dailyKind);
    if (!dailyCheck.ok) return dailyCheck;
  }

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

export function startTutorialFight(
  combatZone,
  state,
  balance,
  characterConfig,
  combatItems,
  enemies,
  weaponRoles
) {
  const check = canFight(combatZone, state, balance, characterConfig, false);
  if (!check.ok) return check;

  const weapon = getEquippedWeapon(state, combatItems);
  if (!weapon?.weaponType) {
    return { ok: false, reason: 'Équipe une arme sur Personnage avant l\'entraînement' };
  }

  const trainingFoe = {
    enemyId: 'training_dummy',
    name: 'Mannequin d\'entraînement',
    emoji: '🎯',
    drops: {},
    charXpReward: 8,
  };

  state.combatEncounter = {
    zoneId: combatZone.id,
    combatZone,
    foe: trainingFoe,
    isBoss: false,
    isDungeonRun: false,
    isTutorialFight: true,
    weaponRoles: weaponRoles || {},
    party: buildHeroOnlyParty(state, characterConfig, combatItems, balance),
    killStats: state.combatKillStats || {},
  };

  initEncounter(state.combatEncounter, trainingFoe, enemies, 1, null);

  const enemy = state.combatEncounter.combat?.enemies?.[0];
  if (enemy) {
    enemy.hp = 10;
    enemy.maxHp = 10;
    enemy.atk = 0;
    enemy.def = 0;
    enemy.name = 'Mannequin d\'entraînement';
    enemy.emoji = '🎯';
  }

  state.combatEncounter.combat.log.push({
    type: 'system',
    text: `Entraînement : teste le coup signature de ton arme (${weapon.name}).`,
  });

  return { ok: true, encounter: state.combatEncounter };
}

export function getTutorialFightSkills(state, combatItems, combatSkills, weaponRoles) {
  const run = state.combatEncounter;
  if (!run?.isTutorialFight) return null;

  const weapon = getEquippedWeapon(state, combatItems);
  if (!weapon?.weaponType) return [];

  const role = weaponRoles?.[weapon.weaponType];
  const signatureId = role?.signatureSkill;
  const basicId = WEAPON_TYPE_SKILLS[weapon.weaponType]?.[0];
  const ids = [...new Set([basicId, signatureId].filter(Boolean))];

  return ids.map((id) => combatSkills[id]).filter(Boolean);
}

export function getTutorialFightHint(state, combatItems, combatSkills, weaponRoles) {
  const weapon = getEquippedWeapon(state, combatItems);
  if (!weapon?.weaponType) return null;

  const role = weaponRoles?.[weapon.weaponType];
  const sigId = role?.signatureSkill;
  const sig = sigId ? combatSkills[sigId] : null;

  return {
    weapon,
    roleLabel: role?.label || weapon.className,
    roleShort: role?.role || '',
    signatureSkill: sig,
    signatureHint: role?.signatureHint || (sig ? `Utilise ${sig.name}.` : ''),
  };
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

export function startTutorialDungeon(
  combatZone,
  state,
  balance,
  characterConfig,
  combatItems,
  enemies,
  companionDefs
) {
  const weapon = getEquippedWeapon(state, combatItems);
  if (!weapon?.weaponType) {
    return { ok: false, reason: 'Équipe ton arme sur Personnage avant le donjon.' };
  }
  if (state.combatEncounter) return { ok: false, reason: 'Combat en cours' };

  const tutorialFoe = {
    enemyId: 'spirit_lantern',
    name: 'Esprit novice',
    emoji: '👻',
    drops: { gold_nugget: { min: 1, max: 2, chance: 1 } },
    charXpReward: 12,
  };

  const party = buildHeroOnlyParty(state, characterConfig, combatItems, balance);

  state.combatEncounter = {
    zoneId: combatZone.id,
    combatZone,
    isDungeonRun: true,
    isTutorialDungeon: true,
    roomIndex: 0,
    rooms: [{ foe: tutorialFoe, isBoss: false }],
    dungeonDrops: {},
    dungeonCharXp: 0,
    foe: tutorialFoe,
    isBoss: false,
    party,
  };

  initEncounter(state.combatEncounter, tutorialFoe, enemies, party.length, combatZone);

  const enemy = state.combatEncounter.combat?.enemies?.[0];
  if (enemy) {
    enemy.hp = 20;
    enemy.maxHp = 20;
    enemy.atk = 3;
    enemy.def = 1;
    enemy.name = 'Esprit novice';
    enemy.emoji = '👻';
  }

  state.combatEncounter.combat.log.push({
    type: 'system',
    text: 'Donjon de formation — tu affrontes l\'esprit seul, sans compagnons.',
  });

  return { ok: true, encounter: state.combatEncounter, roomCount: 1 };
}

function completeVictory(zoneId, foe, isBoss, state, characterConfig, balance) {
  const run = state.combatEncounter;
  const isTutorial = !!run?.isTutorialFight;
  const isTutorialDungeon = !!run?.isTutorialDungeon;

  const isTraining = isTutorial || isTutorialDungeon;
  const charXp = isTraining ? (foe.charXpReward || 5) : (foe.charXpReward || 0);
  const levelResult = charXp > 0 ? addCharacterXp(state, charXp, characterConfig, balance) : null;

  const drops = isTraining ? (isTutorialDungeon ? rollDrops(foe.drops) : {}) : rollDrops(foe.drops);
  if (!isTutorial && !isTutorialDungeon) {
    applyDrops(state, drops);
  } else if (isTutorialDungeon) {
    claimTutorialReward(state, 'dungeonDrops', () => applyDrops(state, drops));
  }
  if (!isTraining) recordKill(state, zoneId, foe, isBoss);

  if (!isTraining && !run?.isDungeonRun) {
    recordDailyCombatUse(state, isBoss ? 'soloBoss' : 'soloMob');
  }

  if (isTutorial) {
    if (!state.tutorial) state.tutorial = { stepIndex: 0, completed: false, dismissed: false, trainingFightWon: false };
    state.tutorial.trainingFightWon = true;
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
    isTutorialFight: isTutorial,
    isTutorialDungeon,
  };
}

function finishDungeonRun(run, state, characterConfig, balance) {
  const totalXp = run.dungeonCharXp || 0;
  const levelResult = totalXp > 0 ? addCharacterXp(state, totalXp, characterConfig, balance) : null;
  if (run.isTutorialDungeon) {
    const loot = { ...(run.dungeonDrops || {}) };
    claimTutorialReward(state, 'dungeonDrops', () => applyDrops(state, loot));
  } else {
    applyDrops(state, run.dungeonDrops || {});
  }
  const roomCount = run.rooms?.length || 0;

  state.combatEncounter = null;

  return {
    victory: true,
    cleared: true,
    isDungeon: true,
    isBoss: true,
    isTutorialDungeon: !!run.isTutorialDungeon,
    charXp: totalXp,
    levelResult,
    drops: { ...(run.dungeonDrops || {}) },
    roomCount,
    zoneId: run.zoneId,
  };
}

function advanceDungeonRoom(run, state, characterConfig, enemies, balance) {
  if (!run.isTutorialDungeon || canClaimTutorialReward(state, 'dungeonDrops')) {
    const drops = rollDrops(run.foe.drops);
    mergeDropTables(run.dungeonDrops, drops);
  }
  run.dungeonCharXp = (run.dungeonCharXp || 0) + (run.foe.charXpReward || 0);
  recordKill(state, run.zoneId, run.foe, run.isBoss);

  run.roomIndex += 1;
  if (run.roomIndex >= run.rooms.length) {
    return finishDungeonRun(run, state, characterConfig, balance);
  }

  const next = run.rooms[run.roomIndex];
  run.foe = next.foe;
  run.isBoss = next.isBoss;
  initEncounter(run, { ...next.foe, boss: next.isBoss }, enemies, run.party.length, run.combatZone);

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
  };
}

function onEnemyDefeated(run, state, characterConfig, enemies, balance) {
  if (run.isDungeonRun) {
    return advanceDungeonRoom(run, state, characterConfig, enemies, balance);
  }
  return completeVictory(run.zoneId, run.foe, run.isBoss, state, characterConfig, balance);
}

function resolveEnemyPhaseStep(state, characterConfig, enemies, balance) {
  const run = state.combatEncounter;
  const enemyResult = enemyAttackTurn(run);

  if (enemyResult?.playerDefeated) {
    const fail = { victory: false, cleared: false, isDungeon: !!run.isDungeonRun };
    state.combatEncounter = null;
    return fail;
  }

  if (getLivingEnemies(run.combat).length === 0) {
    return onEnemyDefeated(run, state, characterConfig, enemies, balance);
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

export function stepCombatEnemyTurn(state, characterConfig, enemies, balance) {
  const run = state.combatEncounter;
  if (!run?.combat || run.combat.phase !== 'enemy') return null;
  return resolveEnemyPhaseStep(state, characterConfig, enemies, balance);
}

export function useCombatSkill(skillId, state, skills, characterConfig, enemies, targetId = 'enemy', balance) {
  const run = state.combatEncounter;
  if (!run?.combat) return null;

  const skillDef = skills[skillId];
  if (!skillDef) return null;

  const memberIndex = run.combat.activeMemberIndex;
  const result = useMemberSkill(run, skillDef, memberIndex, targetId);
  if (!result) return null;

  if (result.enemyDefeated) {
    return onEnemyDefeated(run, state, characterConfig, enemies, balance);
  }

  if (!result.nextMember) {
    return resolveEnemyPhaseStep(state, characterConfig, enemies, balance);
  }

  return {
    continuing: true,
    nextMember: true,
    activeMemberIndex: run.combat.activeMemberIndex,
    party: run.party,
    phase: run.combat.phase,
  };
}

export function useCombatDefend(state, characterConfig, enemies, balance) {
  const run = state.combatEncounter;
  if (!run?.combat) return null;

  const memberIndex = run.combat.activeMemberIndex;
  const result = useMemberDefend(run, memberIndex);
  if (!result) return null;

  if (result.enemyDefeated) {
    return onEnemyDefeated(run, state, characterConfig, enemies, balance);
  }

  if (!result.nextMember) {
    return resolveEnemyPhaseStep(state, characterConfig, enemies, balance);
  }

  return {
    continuing: true,
    nextMember: true,
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

  if (run.isTutorialFight) {
    return getTutorialFightSkills(state, combatItems, combatSkills, weaponRoles || run.weaponRoles) || [];
  }

  const ids = getMemberSkillIds(member, state, combatItems);
  return ids.map((id) => combatSkills[id]).filter(Boolean);
}

export function getActiveCombatMember(state) {
  const run = state.combatEncounter;
  if (!run?.combat) return null;
  return run.party[run.combat.activeMemberIndex] || null;
}

export { DEFEND_ACTION };
