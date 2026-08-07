import {
  initEncounter,
  useMemberSkill,
  useMemberDefend,
  useMemberMeal,
  canUseMemberMeal,
  enemyAttackTurn,
  buildParty,
  buildHeroOnlyParty,
  getMemberSkillIds,
  getLivingEnemies,
  grantCombatItem,
  DEFEND_ACTION,
  saveSoloHp,
  clearSoloHpWear,
  snapshotDungeonParty,
  applyDungeonPartySnapshot,
  restoreCombatWearFromDungeonEntry,
  clearDungeonPartySnapshot,
} from './combat.js';
import { addCharacterXp } from './character.js';
import { getPrestigeBonuses, applyMultiplierBonus, getSeasonBoostMult, getSeasonEnemyScale } from './prestige.js';
import {
  peekMealHeal,
  consumeMealFromInventory,
  clearCombatMealBuff,
  consumeCombatMealBuffFight,
  DUNGEON_ROOM_HEAL,
  calcMealHealAmount,
  calcMealMpAmount,
} from './consumables.js';
import { wearEquippedCombatGear } from './combatDurability.js';
import {
  hasDungeonKey,
  consumeDungeonKey,
  grantDungeonKey,
  rollKeyDrop,
  getDungeonKeyId,
  getAvailableKeyQualities,
  getKeyQualityCounts,
  openDungeonChest,
  KEY_QUALITY_META,
  syncKeyQualities,
} from './dungeonKeys.js';
import {
  rollDungeonEquipmentDrop,
  pickRandomDropItem,
  RARITY_LABELS,
} from './equipmentRarity.js';
import { isCraftJobUnlocked } from './jobUnlock.js';
import { hasSchoolCombatZoneUnlock, hasSchoolCombatUnlock } from './villageSchool.js';

function getDungeonGate(balance) {
  return balance?.combat?.dungeonGate || {};
}

function checkDungeonGate(combatZone, state, balance) {
  const gate = getDungeonGate(balance);
  const requireCuisine = gate.requireCuisineUnlocked || gate.requireCookUnlocked;
  if (!requireCuisine) return { ok: true };
  const firstId = gate.firstDungeonId || 'village_sakura';
  if (combatZone.id !== firstId && combatZone.zone !== firstId) return { ok: true };
  if (!isCraftJobUnlocked('baker', state, balance) && !isCraftJobUnlocked('cook', state, balance)) {
    return { ok: false, reason: gate.hint || 'Débloque la Cuisine pour préparer des repas avant le donjon.' };
  }
  return { ok: true };
}

function isZoneUnlocked(zoneId, state, balance) {
  if (balance.zones[zoneId]?.unlocked) return true;
  return (state.unlockedZones || []).includes(zoneId);
}

export function buildDungeonRooms(combatZone) {
  const rooms = (combatZone.monsters || []).map((foe) => ({ foe, isBoss: false }));
  if (combatZone.boss) rooms.push({ foe: combatZone.boss, isBoss: true });
  return rooms;
}

export function canFight(combatZone, state, balance, characterConfig, isBoss = false, monsterIndex = 0) {
  if (!hasSchoolCombatUnlock(state)) {
    return { ok: false, reason: 'École → débloque le Combat' };
  }
  if (!hasSchoolCombatZoneUnlock(state, combatZone.id)) {
    return { ok: false, reason: 'École → débloque ce donjon' };
  }
  if (!isZoneUnlocked(combatZone.zone, state, balance)) {
    return { ok: false, reason: 'Zone verrouillée' };
  }
  const charLevel = state.character?.level || 1;
  if (charLevel < combatZone.requiredCharLevel) {
    return { ok: false, reason: `Perso Nv.${combatZone.requiredCharLevel} requis` };
  }
  if (state.combatEncounter) return { ok: false, reason: 'Combat en cours' };

  const training = getTrainingUnlockCheck(combatZone, state, balance, isBoss, monsterIndex);
  if (!training.ok) return training;

  return { ok: true };
}

/** Seuils d'entraînement : monstre 2 = 5 kills du 1, monstre 3 = 10 du 2, boss = 15 du 3. */
export function getTrainingUnlockThresholds(balance) {
  const configured = balance?.combat?.trainingUnlockKills;
  if (Array.isArray(configured) && configured.length) return configured.map((n) => Math.max(0, Number(n) || 0));
  return [0, 5, 10, 15];
}

export function getMonsterKillCount(state, enemyId) {
  if (!enemyId) return 0;
  return state.combatKillStats?.[enemyId] || 0;
}

/**
 * @returns {{ ok: boolean, reason?: string, required?: number, current?: number, prevName?: string }}
 */
export function getTrainingUnlockCheck(combatZone, state, balance, isBoss = false, monsterIndex = 0) {
  const thresholds = getTrainingUnlockThresholds(balance);
  const monsters = combatZone.monsters || [];

  // Après une victoire donjon (boss vaincu), tout l'entraînement de la zone est ouvert.
  if ((state.bossKills?.[combatZone.id] || 0) >= 1) {
    return { ok: true, required: 0, current: 0, unlockedByDungeon: true };
  }

  if (isBoss) {
    if (!monsters.length) return { ok: true };
    const last = monsters[monsters.length - 1];
    const required = thresholds[Math.min(thresholds.length - 1, monsters.length)] ?? 15;
    const current = getMonsterKillCount(state, last.enemyId);
    if (current >= required) return { ok: true, required, current, prevName: last.name };
    return {
      ok: false,
      reason: `Vaincs ${last.name} ${required} fois (${current}/${required})`,
      required,
      current,
      prevName: last.name,
    };
  }

  const index = Math.max(0, monsterIndex | 0);
  if (index <= 0) return { ok: true, required: 0, current: 0 };
  if (index >= monsters.length) return { ok: false, reason: 'Ennemi inconnu' };

  const required = thresholds[Math.min(thresholds.length - 1, index)] ?? 5;
  const prev = monsters[index - 1];
  const current = getMonsterKillCount(state, prev.enemyId);
  if (current >= required) return { ok: true, required, current, prevName: prev.name };
  return {
    ok: false,
    reason: `Vaincs ${prev.name} ${required} fois (${current}/${required})`,
    required,
    current,
    prevName: prev.name,
  };
}

export function getTrainingUnlockProgress(combatZone, state, balance) {
  const monsters = combatZone.monsters || [];
  const thresholds = getTrainingUnlockThresholds(balance);
  const rows = monsters.map((monster, index) => {
    const check = getTrainingUnlockCheck(combatZone, state, balance, false, index);
    const kills = getMonsterKillCount(state, monster.enemyId);
    return {
      index,
      monster,
      unlocked: check.ok,
      kills,
      requiredFromPrev: index === 0 ? 0 : (thresholds[Math.min(thresholds.length - 1, index)] ?? 5),
      prevName: check.prevName || null,
      currentTowardUnlock: check.current ?? 0,
      reason: check.reason || null,
    };
  });
  const bossCheck = getTrainingUnlockCheck(combatZone, state, balance, true, 0);
  return {
    monsters: rows,
    boss: {
      unlocked: bossCheck.ok,
      required: bossCheck.required ?? 15,
      current: bossCheck.current ?? 0,
      prevName: bossCheck.prevName || null,
      reason: bossCheck.reason || null,
    },
  };
}

export function getDungeonBossKillRequirement(balance) {
  const n = Number(balance?.combat?.dungeonEntry?.minBossKills);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

export function canEnterDungeon(combatZone, state, balance, characterConfig) {
  if (!hasSchoolCombatUnlock(state)) {
    return { ok: false, reason: 'École → débloque le Combat' };
  }
  if (!hasSchoolCombatZoneUnlock(state, combatZone.id)) {
    return { ok: false, reason: 'École → débloque ce donjon' };
  }
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

  const minBossKills = getDungeonBossKillRequirement(balance);
  const bossKills = state.bossKills?.[combatZone.id] || 0;
  if (bossKills < minBossKills) {
    const bossName = combatZone.boss?.name || 'le boss';
    return {
      ok: false,
      reason: `Vaincs ${bossName} ${minBossKills} fois en entraînement (${bossKills}/${minBossKills}) avant d’entrer dans le donjon.`,
      bossKills,
      minBossKills,
    };
  }

  if (!hasDungeonKey(state, combatZone.id)) {
    const keyId = getDungeonKeyId(combatZone.id);
    return { ok: false, reason: `Il te faut 1 clé de donjon (${keyId || '?'}) — farm en combat rapide (mobs / boss) ou achète à la HdV.` };
  }
  const gateCheck = checkDungeonGate(combatZone, state, balance);
  if (!gateCheck.ok) return gateCheck;
  return { ok: true, roomCount: rooms.length };
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

function rollEquipmentDrop(zoneId, isBoss, state, combatItems, balance, combatZone) {
  const zones = combatZone ? { [zoneId]: combatZone } : null;
  if (!rollDungeonEquipmentDrop(isBoss, balance, zoneId, zones)) return null;
  const item = pickRandomDropItem(zoneId, combatItems);
  if (!item) return null;
  const ref = grantCombatItem(state, item.id, combatItems, 'common');
  return { itemId: item.id, name: item.name, emoji: item.emoji, rarity: 'common', ref };
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
  companionDefs,
  monsterIndex = 0
) {
  const check = canFight(combatZone, state, balance, characterConfig, isBoss, monsterIndex);
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

  initEncounter(
    state.combatEncounter,
    { ...foe, boss: isBoss },
    enemies,
    1,
    combatZone,
    getSeasonEnemyScale(state.season, balance)
  );
  return { ok: true, encounter: state.combatEncounter };
}

export function startDungeonRun(
  combatZone,
  state,
  balance,
  characterConfig,
  combatItems,
  enemies,
  companionDefs,
  keyQuality = 'bronze'
) {
  const check = canEnterDungeon(combatZone, state, balance, characterConfig);
  if (!check.ok) return check;

  syncKeyQualities(state);
  const available = getAvailableKeyQualities(state, combatZone.id);
  const quality = available.includes(keyQuality)
    ? keyQuality
    : (available[0] || 'bronze');

  if (!consumeDungeonKey(state, combatZone.id, quality)) {
    return { ok: false, reason: 'Clé de donjon manquante' };
  }

  const rooms = buildDungeonRooms(combatZone);
  const party = buildParty(state, characterConfig, combatItems, companionDefs, balance);
  applyDungeonPartySnapshot(state, party);
  snapshotDungeonParty(state, party);
  const first = rooms[0];

  state.combatEncounter = {
    zoneId: combatZone.id,
    combatZone,
    isDungeonRun: true,
    roomIndex: 0,
    rooms,
    dungeonDrops: {},
    dungeonEquipmentDrops: [],
    dungeonCharXp: 0,
    keyQuality: quality,
    foe: first.foe,
    isBoss: first.isBoss,
    party,
  };

  initEncounter(
    state.combatEncounter,
    { ...first.foe, boss: first.isBoss },
    enemies,
    party.length,
    combatZone,
    getSeasonEnemyScale(state.season, balance)
  );
  return { ok: true, encounter: state.combatEncounter, roomCount: rooms.length, keyQuality: quality };
}

function wearAfterCombat(state, combatItems) {
  return wearEquippedCombatGear(state, combatItems);
}

function completeVictory(zoneId, foe, isBoss, state, characterConfig, balance, combatItems, combatZone) {
  const run = state.combatEncounter;
  const xpMult = balance.combat?.soloXpMultiplier ?? 0.25;
  const rawXp = Math.floor((foe.charXpReward || 0) * xpMult);
  const charXp = applyMultiplierBonus(rawXp, getPrestigeBonuses(state).xp) * getSeasonBoostMult(state);
  const levelResult = charXp > 0 ? addCharacterXp(state, charXp, characterConfig, balance) : null;
  recordKill(state, zoneId, foe, isBoss);

  const zoneMap = combatZone ? { [zoneId]: combatZone } : null;
  let keyDropped = false;
  let keyQuality = null;
  // Entraînement solo uniquement (mobs + boss) — le donjon ne passe pas par ici.
  if (rollKeyDrop(!!isBoss, balance, zoneId, zoneMap)) {
    const granted = grantDungeonKey(state, zoneId, balance, !!isBoss);
    keyDropped = !!granted?.ok;
    keyQuality = granted?.quality || null;
  }

  const equipDrop = null;

  if (combatItems) wearAfterCombat(state, combatItems);

  if (run?.isSoloFight && !run?.isDungeonRun && run.party) {
    saveSoloHp(state, run.party);
  }

  state.combatEncounter = null;

  return {
    victory: true,
    cleared: true,
    charXp,
    levelResult,
    drops: {},
    equipmentDrops: equipDrop ? [equipDrop] : [],
    keyDropped,
    keyQuality,
    isBoss,
    zoneId,
    isSolo: true,
  };
}

function finishDungeonRun(run, state, characterConfig, balance, combatItems) {
  const totalXp = applyMultiplierBonus(run.dungeonCharXp || 0, getPrestigeBonuses(state).xp)
    * getSeasonBoostMult(state);
  const levelResult = totalXp > 0 ? addCharacterXp(state, totalXp, characterConfig, balance) : null;
  applyDrops(state, run.dungeonDrops || {});
  const roomCount = run.rooms?.length || 0;

  const chest = openDungeonChest(
    state,
    run.keyQuality || 'bronze',
    balance,
    combatItems,
    run.zoneId,
    grantCombatItem
  );
  if (chest?.equipment?.length) {
    if (!run.dungeonEquipmentDrops) run.dungeonEquipmentDrops = [];
    run.dungeonEquipmentDrops.push(...chest.equipment);
  }

  for (const member of run.party || []) {
    member.hp = member.maxHp;
    if (member.maxMp != null) member.mp = member.maxMp;
  }

  clearSoloHpWear(state);
  clearDungeonPartySnapshot(state);
  consumeCombatMealBuffFight(state);

  state.combatEncounter = null;

  return {
    victory: true,
    cleared: true,
    isDungeon: true,
    isBoss: true,
    charXp: totalXp,
    levelResult,
    drops: { ...(run.dungeonDrops || {}) },
    equipmentDrops: [...(run.dungeonEquipmentDrops || [])],
    chest,
    keyQuality: run.keyQuality || 'bronze',
    roomCount,
    zoneId: run.zoneId,
    partyRestored: true,
  };
}

function applyDrops(state, drops) {
  for (const [resId, amount] of Object.entries(drops || {})) {
    state.inventory[resId] = (state.inventory[resId] || 0) + amount;
  }
}

function advanceDungeonRoom(run, state, characterConfig, enemies, balance, combatItems) {
  run.dungeonCharXp = (run.dungeonCharXp || 0) + (run.foe.charXpReward || 0);
  recordKill(state, run.zoneId, run.foe, run.isBoss);

  const equipDrop = run.isBoss
    ? rollEquipmentDrop(run.zoneId, true, state, combatItems, balance, run.combatZone)
    : null;
  if (equipDrop) {
    if (!run.dungeonEquipmentDrops) run.dungeonEquipmentDrops = [];
    run.dungeonEquipmentDrops.push(equipDrop);
  }

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
  initEncounter(
    run,
    { ...next.foe, boss: next.isBoss },
    enemies,
    run.party.length,
    run.combatZone,
    getSeasonEnemyScale(state.season, balance)
  );

  if (roomHealTotal > 0 && run.combat?.log) {
    run.combat.log.push({
      type: 'heal',
      text: `🌸 Pause entre les salles : +${DUNGEON_ROOM_HEAL} PV par allié.`,
    });
  }

  if (equipDrop && run.combat?.log) {
    run.combat.log.push({
      type: 'loot',
      text: `🎁 Drop : ${equipDrop.emoji} ${equipDrop.name} (${RARITY_LABELS.common})`,
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
    equipDrop,
  };
}

function onEnemyDefeated(run, state, characterConfig, enemies, balance, combatItems) {
  if (run.isDungeonRun) {
    return advanceDungeonRoom(run, state, characterConfig, enemies, balance, combatItems);
  }
  return completeVictory(run.zoneId, run.foe, run.isBoss, state, characterConfig, balance, combatItems, run.combatZone);
}

function resolveEnemyPhaseStep(state, characterConfig, enemies, balance, combatItems) {
  const run = state.combatEncounter;
  const enemyResult = enemyAttackTurn(run);

  if (enemyResult?.playerDefeated) {
    if (run?.isDungeonRun) {
      restoreCombatWearFromDungeonEntry(state);
    } else if (run?.isSoloFight && run.party) {
      saveSoloHp(state, run.party);
    }
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
    // UI : jouer le trait joueur, puis enchaîner les tours ennemis un par un.
    return {
      continuing: true,
      nextMember: false,
      phase: 'enemy',
      party: run.party,
      activeMemberIndex: run.combat.activeMemberIndex,
    };
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
    return {
      continuing: true,
      nextMember: false,
      phase: 'enemy',
      party: run.party,
      activeMemberIndex: run.combat.activeMemberIndex,
    };
  }

  return {
    continuing: true,
    nextMember: true,
    activeMemberIndex: run.combat.activeMemberIndex,
    party: run.party,
    phase: run.combat.phase,
  };
}

export function useCombatMeal(mealId, state, characterConfig, resources, balance, combatItems, enemies) {
  const run = state.combatEncounter;
  if (!run?.combat) return null;

  const check = checkCombatMealUse(mealId, state, resources, balance);
  if (!check.ok) return { blocked: true, reason: check.reason };

  const memberIndex = run.combat.activeMemberIndex;
  const member = run.party[memberIndex];
  const role = check.mealRole || 'hero';
  const gainHp = check.gainHp || 0;
  const gainMp = check.gainMp || 0;
  const heal = check.heal;

  const result = useMemberMeal(run, memberIndex, gainHp, heal.label, mealId, gainMp);
  if (!result) return { blocked: true, reason: 'Impossible d\'utiliser ce repas' };
  if (result.blocked) return result;

  consumeMealFromInventory(state, mealId);

  if (result.enemyDefeated) {
    return onEnemyDefeated(run, state, characterConfig, enemies, balance, combatItems);
  }

  if (!result.nextMember) {
    return {
      continuing: true,
      nextMember: false,
      phase: 'enemy',
      party: run.party,
      activeMemberIndex: run.combat.activeMemberIndex,
      healed: gainHp,
      restoredMp: gainMp,
      mealRole: role,
      memberId: member?.id,
    };
  }

  return {
    continuing: true,
    nextMember: true,
    healed: gainHp,
    restoredMp: gainMp,
    mealRole: role,
    memberId: member?.id,
    activeMemberIndex: run.combat.activeMemberIndex,
    party: run.party,
    phase: run.combat.phase,
  };
}

/** Vérifie si un repas est utilisable au tour actuel (sans le consommer). */
export function checkCombatMealUse(mealId, state, resources, balance) {
  const run = state.combatEncounter;
  if (!run?.combat) return { ok: false, reason: 'Pas en combat' };

  const charLevel = state.character?.level || 1;
  const memberIndex = run.combat.activeMemberIndex;
  const member = run.party[memberIndex];
  const heal = peekMealHeal(mealId, state, resources, balance, charLevel);
  if (!heal.ok) return { ok: false, reason: heal.reason, heal: null };

  const role = heal.mealRole || 'hero';
  if (role === 'buff') {
    return { ok: false, reason: 'Boire l’élixir hors combat (préparation).', heal, mealRole: role };
  }
  if (role === 'companions' && member?.id === 'hero') {
    return { ok: false, reason: 'Ce plat est pour un équipier', heal, mealRole: role };
  }
  if ((role === 'hero' || role === 'mp') && member?.id && member.id !== 'hero') {
    return { ok: false, reason: 'Ce plat est pour le héros', heal, mealRole: role };
  }

  const mealCheck = canUseMemberMeal(run, memberIndex);
  if (!mealCheck.ok) return { ok: false, reason: mealCheck.reason, heal, mealRole: role };

  let gainHp = 0;
  let gainMp = 0;
  if (role === 'mp') {
    gainMp = calcMealMpAmount(member?.maxMp || 0, heal.mpPct);
    if (gainMp <= 0 || (member.mp || 0) >= (member.maxMp || 0)) {
      return { ok: false, reason: 'PM déjà au maximum — utilise un sort d’abord', heal, mealRole: role };
    }
  } else if (role === 'companions') {
    gainHp = calcMealHealAmount(member?.maxHp || 1, heal.healPct);
    if ((member.hp || 0) >= (member.maxHp || 0)) {
      return { ok: false, reason: 'PV déjà au maximum', heal, mealRole: role };
    }
  } else {
    gainHp = calcMealHealAmount(member?.maxHp || 1, heal.healPct);
    if ((member.hp || 0) >= (member.maxHp || 0)) {
      return { ok: false, reason: 'PV déjà au maximum', heal, mealRole: role };
    }
  }

  return {
    ok: true,
    heal,
    mealRole: role,
    gainHp,
    gainMp,
    memberIndex,
  };
}

export function abandonCombat(state) {
  const run = state.combatEncounter;
  if (run?.isDungeonRun) {
    restoreCombatWearFromDungeonEntry(state);
  }
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
