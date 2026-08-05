/**
 * Panneau du village — quêtes quotidiennes (UTC) + tirage seeded.
 */

import { getUtcDateKey } from './harvestEvents.js';
import { isFarmBuildingUnlocked, isCraftJobUnlocked, isCombatUnlocked } from './jobUnlock.js';

const PILLARS = ['harvest', 'farm', 'cooking', 'combat'];

function hashStr(s) {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** RNG déterministe (mulberry32). */
function makeRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng, weights) {
  const entries = Object.entries(weights || {});
  const total = entries.reduce((s, [, w]) => s + (Number(w) || 0), 0);
  if (total <= 0) return 'easy';
  let roll = rng() * total;
  for (const [id, w] of entries) {
    roll -= Number(w) || 0;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1]?.[0] || 'easy';
}

function pickOne(rng, list) {
  if (!list?.length) return null;
  return list[Math.floor(rng() * list.length)];
}

function randInt(rng, min, max) {
  const a = Math.floor(Number(min) || 0);
  const b = Math.floor(Number(max) || 0);
  if (b <= a) return a;
  return a + Math.floor(rng() * (b - a + 1));
}

export function getQuestDef(boardData, questId) {
  return boardData?.quests?.[questId] || null;
}

export function getNpc(boardData, npcId) {
  return boardData?.npcs?.[npcId] || null;
}

export function getDifficultyDef(boardData, difficultyId) {
  return boardData?.difficulties?.[difficultyId] || boardData?.difficulties?.easy || null;
}

function questsFor(boardData, pillar, difficulty) {
  return Object.values(boardData?.quests || {}).filter(
    (q) => q.pillar === pillar && q.difficulty === difficulty
  );
}

/** Tirage global du jour (même pour tous). */
export function rollDailyBoard(boardData, dateKey) {
  const rng = makeRng(hashStr(`village_board:${dateKey}`));
  const difficulty = pickWeighted(rng, boardData.difficultyWeights || { easy: 50, medium: 35, hard: 15 });
  const picked = [];
  const usedIds = new Set();

  for (const pillar of PILLARS) {
    const pool = questsFor(boardData, pillar, difficulty).filter((q) => !usedIds.has(q.id));
    const q = pickOne(rng, pool);
    if (q) {
      picked.push(q.id);
      usedIds.add(q.id);
    }
  }

  // Joker : doublon d’un pilier, autre quête
  const jokerPillar = pickOne(rng, PILLARS);
  const jokerPool = questsFor(boardData, jokerPillar, difficulty).filter((q) => !usedIds.has(q.id));
  const joker = pickOne(rng, jokerPool);
  if (joker) {
    picked.push(joker.id);
    usedIds.add(joker.id);
  } else {
    // Fallback : n’importe quel pilier encore disponible
    for (const pillar of PILLARS) {
      const pool = questsFor(boardData, pillar, difficulty).filter((q) => !usedIds.has(q.id));
      const q = pickOne(rng, pool);
      if (q) {
        picked.push(q.id);
        break;
      }
    }
  }

  const diffDef = getDifficultyDef(boardData, difficulty);
  const rewardKirha = randInt(rng, diffDef?.kirhaMin ?? 60, diffDef?.kirhaMax ?? 100);

  return {
    date: dateKey,
    difficulty,
    questIds: picked,
    rewardKirha,
    rewardNuggets: Number(diffDef?.nuggets) || 0,
    clearBonusNuggets: Number(diffDef?.clearBonusNuggets) || 0,
    clearBonusKirha: Number(diffDef?.clearBonusKirha) || 0,
  };
}

function emptyDaily(roll) {
  return {
    date: roll.date,
    difficulty: roll.difficulty,
    questIds: roll.questIds.slice(),
    rewardKirha: roll.rewardKirha,
    rewardNuggets: roll.rewardNuggets,
    clearBonusNuggets: roll.clearBonusNuggets,
    clearBonusKirha: roll.clearBonusKirha,
    completed: {},
    claimedClearBonus: false,
    mobKills: 0,
    bossKills: 0,
    dungeonClears: 0,
  };
}

/**
 * Assure l’état journalier (reset UTC).
 * @returns {{ daily: object, rolled: boolean }}
 */
export function ensureVillageBoardDay(state, boardData, now = Date.now()) {
  const dateKey = getUtcDateKey(now);
  if (state.villageBoard?.date === dateKey && Array.isArray(state.villageBoard.questIds)) {
    return { daily: state.villageBoard, rolled: false };
  }
  const roll = rollDailyBoard(boardData, dateKey);
  state.villageBoard = emptyDaily(roll);
  return { daily: state.villageBoard, rolled: true };
}

export function getRequirementHint(requires, jobs, farmData) {
  if (!requires) return null;
  if (requires.farmBuilding) {
    const name = farmData?.buildings?.[requires.farmBuilding]?.name || requires.farmBuilding;
    return `Débloque ${name}`;
  }
  if (requires.craftJob) {
    const name = jobs?.[requires.craftJob]?.name || requires.craftJob;
    return `Débloque ${name}`;
  }
  if (requires.feature === 'combat') return 'Débloque le Combat';
  return 'Progression requise';
}

export function isQuestRequirementMet(requires, state, balance) {
  if (!requires) return true;
  if (requires.farmBuilding) return isFarmBuildingUnlocked(requires.farmBuilding, state, balance);
  if (requires.craftJob) return isCraftJobUnlocked(requires.craftJob, state, balance);
  if (requires.feature === 'combat') return isCombatUnlocked(state, balance);
  return true;
}

function deliverHave(state, deliver) {
  const parts = [];
  let ok = true;
  for (const [resId, need] of Object.entries(deliver || {})) {
    const have = Number(state.inventory?.[resId]) || 0;
    const n = Number(need) || 0;
    parts.push({ resId, need: n, have });
    if (have < n) ok = false;
  }
  return { ok, parts };
}

export function getQuestProgress(quest, state, daily) {
  if (!quest) return { current: 0, target: 1, ready: false };
  if (quest.type === 'deliver') {
    const { ok, parts } = deliverHave(state, quest.deliver);
    const current = parts.reduce((s, p) => s + Math.min(p.have, p.need), 0);
    const target = parts.reduce((s, p) => s + p.need, 0);
    return { current, target, ready: ok, parts };
  }
  if (quest.type === 'combat_kills') {
    const current = Number(daily?.mobKills) || 0;
    const target = Number(quest.target) || 1;
    return { current: Math.min(current, target), target, ready: current >= target };
  }
  if (quest.type === 'combat_bosses') {
    const current = Number(daily?.bossKills) || 0;
    const target = Number(quest.target) || 1;
    return { current: Math.min(current, target), target, ready: current >= target };
  }
  if (quest.type === 'combat_dungeons') {
    const current = Number(daily?.dungeonClears) || 0;
    const target = Number(quest.target) || 1;
    return { current: Math.min(current, target), target, ready: current >= target };
  }
  return { current: 0, target: 1, ready: false };
}

export function noteVillageCombatResult(state, boardData, result) {
  if (!result?.cleared) return;
  ensureVillageBoardDay(state, boardData);
  const daily = state.villageBoard;
  if (result.isDungeon) {
    daily.dungeonClears = (daily.dungeonClears || 0) + 1;
    daily.bossKills = (daily.bossKills || 0) + 1;
    return;
  }
  if (result.isBoss) {
    daily.bossKills = (daily.bossKills || 0) + 1;
  } else {
    daily.mobKills = (daily.mobKills || 0) + 1;
  }
}

function grantRewards(state, kirha, nuggets) {
  const k = Math.max(0, Math.floor(Number(kirha) || 0));
  const n = Math.max(0, Math.floor(Number(nuggets) || 0));
  if (k > 0) {
    state.kirha = (state.kirha || 0) + k;
    if (!state.lifetimeStats) state.lifetimeStats = {};
    state.lifetimeStats.totalEarned = (state.lifetimeStats.totalEarned || 0) + k;
    if (!state.stats) state.stats = {};
    state.stats.totalEarned = (state.stats.totalEarned || 0) + k;
  }
  if (n > 0) {
    state.inventory.gold_nugget = (state.inventory.gold_nugget || 0) + n;
  }
  return { kirha: k, nuggets: n };
}

/**
 * Livre / valide une quête du panneau.
 */
export function turnInVillageQuest(state, boardData, questId, balance, jobs, farmData) {
  ensureVillageBoardDay(state, boardData);
  const daily = state.villageBoard;
  if (!daily.questIds.includes(questId)) {
    return { ok: false, reason: 'Cette quête n’est pas sur le panneau aujourd’hui.' };
  }
  if (daily.completed?.[questId]) {
    return { ok: false, reason: 'Quête déjà terminée.' };
  }
  const quest = getQuestDef(boardData, questId);
  if (!quest) return { ok: false, reason: 'Quête inconnue.' };

  if (!isQuestRequirementMet(quest.requires, state, balance)) {
    return {
      ok: false,
      reason: getRequirementHint(quest.requires, jobs, farmData) || 'Pas encore accessible.',
      locked: true,
    };
  }

  const progress = getQuestProgress(quest, state, daily);
  if (!progress.ready) {
    return { ok: false, reason: 'Objectif pas encore atteint.' };
  }

  if (quest.type === 'deliver') {
    for (const [resId, need] of Object.entries(quest.deliver || {})) {
      const n = Number(need) || 0;
      if ((state.inventory[resId] || 0) < n) {
        return { ok: false, reason: 'Ressources insuffisantes.' };
      }
    }
    for (const [resId, need] of Object.entries(quest.deliver || {})) {
      state.inventory[resId] -= Number(need) || 0;
      if (state.inventory[resId] <= 0) delete state.inventory[resId];
    }
  }

  if (!daily.completed) daily.completed = {};
  daily.completed[questId] = true;

  const rewards = grantRewards(state, daily.rewardKirha, daily.rewardNuggets);
  const npc = getNpc(boardData, quest.npcId);
  const doneCount = Object.keys(daily.completed).length;
  const allDone = doneCount >= (daily.questIds?.length || 0);

  let clearBonus = null;
  if (allDone && !daily.claimedClearBonus) {
    daily.claimedClearBonus = true;
    clearBonus = grantRewards(state, daily.clearBonusKirha, daily.clearBonusNuggets);
  }

  return {
    ok: true,
    quest,
    npc,
    thanks: npc?.thanks || 'Merci !',
    rewards,
    clearBonus,
    allDone,
    doneCount,
    total: daily.questIds.length,
  };
}

export function getVillageBoardViewModel(state, boardData, balance, jobs, farmData, resources) {
  ensureVillageBoardDay(state, boardData);
  const daily = state.villageBoard;
  const diff = getDifficultyDef(boardData, daily.difficulty);
  const cards = (daily.questIds || []).map((id) => {
    const quest = getQuestDef(boardData, id);
    const npc = getNpc(boardData, quest?.npcId);
    const locked = !isQuestRequirementMet(quest?.requires, state, balance);
    const completed = !!daily.completed?.[id];
    const progress = getQuestProgress(quest, state, daily);
    const deliverParts = (progress.parts || []).map((p) => ({
      ...p,
      name: resources?.[p.resId]?.name || p.resId,
      emoji: resources?.[p.resId]?.emoji || '',
    }));
    return {
      quest,
      npc,
      locked,
      completed,
      progress,
      deliverParts,
      lockHint: locked ? getRequirementHint(quest?.requires, jobs, farmData) : null,
      canTurnIn: !completed && !locked && progress.ready,
    };
  });

  const doneCount = cards.filter((c) => c.completed).length;
  return {
    daily,
    difficulty: diff,
    cards,
    doneCount,
    total: cards.length,
    allDone: doneCount >= cards.length && cards.length > 0,
    claimedClearBonus: !!daily.claimedClearBonus,
  };
}

export function msUntilNextUtcMidnight(now = Date.now()) {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  return Math.max(0, next - now);
}

export function formatUtcResetLabel(now = Date.now()) {
  const ms = msUntilNextUtcMidnight(now);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h${String(m).padStart(2, '0')}`;
}
