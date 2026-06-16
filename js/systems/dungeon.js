import {
  initEncounter,
  playerAttackTurn,
  enemyAttackTurn,
  grantCombatItem,
} from './combat.js';
import { getCombatStats, addCharacterXp } from './character.js';

export function canEnterDungeon(dungeon, state, balance, characterConfig) {
  if (!isZoneUnlocked(dungeon.zone, state, balance)) return { ok: false, reason: 'Zone verrouillée' };
  const charLevel = state.character?.level || 1;
  if (charLevel < dungeon.requiredCharLevel) {
    return { ok: false, reason: `Perso Nv.${dungeon.requiredCharLevel} requis` };
  }
  if (state.dungeonRun) return { ok: false, reason: 'Donjon en cours' };
  return { ok: true };
}

function isZoneUnlocked(zoneId, state, balance) {
  if (balance.zones[zoneId]?.unlocked) return true;
  return (state.unlockedZones || []).includes(zoneId);
}

export function startDungeonRun(dungeon, state, balance, characterConfig, combatEquipment, combatItems, enemies) {
  const check = canEnterDungeon(dungeon, state, balance, characterConfig);
  if (!check.ok) return check;

  const playerStats = getCombatStats(state, characterConfig, combatEquipment, combatItems.items);
  state.dungeonRun = {
    dungeonId: dungeon.id,
    roomIndex: 0,
    playerHp: playerStats.hp,
    playerMaxHp: playerStats.hp,
    playerStats,
    log: [],
    combat: null,
  };

  const room = dungeon.rooms[0];
  initEncounter(state.dungeonRun, room, enemies);

  return { ok: true, started: true, run: state.dungeonRun };
}

export function getCurrentRoom(dungeon, run) {
  return dungeon.rooms[run.roomIndex] || null;
}

function advanceAfterRoomClear(dungeon, state, enemies, characterConfig) {
  const run = state.dungeonRun;
  if (!run) return null;

  run.roomIndex++;
  run.combat = null;

  if (run.roomIndex >= dungeon.rooms.length) {
    return completeDungeon(dungeon, state, characterConfig);
  }

  const room = dungeon.rooms[run.roomIndex];
  initEncounter(run, room, enemies);

  return {
    victory: true,
    roomCleared: run.roomIndex - 1,
    nextRoom: run.roomIndex,
    continuing: true,
    playerHp: run.playerHp,
    newEncounter: true,
  };
}

export function processDungeonTurn(dungeon, state, enemies, characterConfig) {
  const run = state.dungeonRun;
  if (!run || run.dungeonId !== dungeon.id || !run.combat) return null;

  const playerResult = playerAttackTurn(run);
  if (!playerResult) return null;

  if (playerResult.enemyDefeated) {
    return advanceAfterRoomClear(dungeon, state, enemies, characterConfig);
  }

  const enemyResult = enemyAttackTurn(run);
  if (!enemyResult) return { continuing: true };

  if (enemyResult.playerDefeated) {
    const fail = { victory: false, room: run.roomIndex, cleared: false };
    state.dungeonRun = null;
    return fail;
  }

  return {
    victory: true,
    continuing: true,
    playerHp: run.playerHp,
    enemyHp: run.combat.enemyHp,
  };
}

function completeDungeon(dungeon, state, characterConfig) {
  state.dungeonRun = null;

  if (!state.dungeonClears) state.dungeonClears = {};
  state.dungeonClears[dungeon.id] = (state.dungeonClears[dungeon.id] || 0) + 1;

  state.kirha += dungeon.kirhaReward;
  const levelResult = addCharacterXp(state, dungeon.charXpReward, characterConfig);

  const loot = [];
  for (const [itemId, chance] of Object.entries(dungeon.loot || {})) {
    if (Math.random() < chance) {
      grantCombatItem(state, itemId);
      loot.push(itemId);
    }
  }

  return {
    victory: true,
    cleared: true,
    kirha: dungeon.kirhaReward,
    charXp: dungeon.charXpReward,
    levelResult,
    loot,
  };
}

export function abandonDungeon(state) {
  state.dungeonRun = null;
}

export function setDungeonAuto(state, enabled) {
  if (state.dungeonRun?.combat) {
    state.dungeonRun.combat.auto = enabled;
  }
}

export function isDungeonAuto(state) {
  return !!state.dungeonRun?.combat?.auto;
}
