/**
 * Panneau du village — quêtes quotidiennes (UTC) + tirage seeded.
 */

import {
  getUtcDateKey,
  getWeatherForDateKey,
  getSakuraWindStatus,
} from './harvestEvents.js';
import { isFarmBuildingUnlocked, isCraftJobUnlocked, isCombatUnlocked } from './jobUnlock.js';

const PILLARS = ['harvest', 'farm', 'cooking', 'combat'];
const BOARD_SCHEME = 'mixed_v3';

/** PNJ → métier météo (cohérence soft). */
const NPC_WEATHER_JOB = {
  nori: 'fisher',
  yumi: 'farmer',
  nami: 'farmer',
  riku: 'farmer',
  emi: 'farmer',
  kiro: 'lumberjack',
  haru: 'lumberjack',
  yuto: 'miner',
  hana: 'alchemist',
};

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

function pickOne(rng, list) {
  if (!list?.length) return null;
  return list[Math.floor(rng() * list.length)];
}

function shuffleInPlace(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
  if (npcId === 'kenji') npcId = 'haru'; // ancien id
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

function questMatchesWeather(quest, weatherJobId, resources) {
  if (!quest || !weatherJobId) return false;
  for (const resId of Object.keys(quest.deliver || {})) {
    if (resources?.[resId]?.job === weatherJobId) return true;
  }
  return NPC_WEATHER_JOB[quest.npcId] === weatherJobId;
}

function pickWeighted(rng, items, weightFn) {
  if (!items?.length) return null;
  let total = 0;
  const weights = items.map((item) => {
    const w = Math.max(0.01, Number(weightFn(item)) || 1);
    total += w;
    return w;
  });
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickQuest(rng, boardData, {
  pillar,
  difficulty,
  usedIds,
  usedNpcs,
  allowNpcReuse,
  weatherJobId = null,
  resources = null,
}) {
  let pool = questsFor(boardData, pillar, difficulty).filter((q) => !usedIds.has(q.id));
  if (!allowNpcReuse && usedNpcs?.size) {
    const filtered = pool.filter((q) => !usedNpcs.has(q.npcId));
    if (filtered.length) pool = filtered;
  }
  if (!pool.length) return null;
  // Soft bias météo : les quêtes « qui collent » au ciel sont plus probables, sans remplacer le mix
  return pickWeighted(rng, pool, (q) => (
    questMatchesWeather(q, weatherJobId, resources) ? 4 : 1
  ));
}

/**
 * Tirage global du jour :
 * - 2 faciles + 2 moyens + 1 difficile
 * - 1 récolte, 1 ferme, 1 cuisine, 1 combat + 1 joker (pilier doublé)
 * - PNJ uniques sur les 4 premières ; joker peut réutiliser un PNJ mais jamais la même quête
 * - Soft biais météo (cohérence, pas de remplacement)
 */
export function rollDailyBoard(boardData, dateKey, resources = null) {
  const weather = getWeatherForDateKey(dateKey);
  const weatherJobId = weather?.jobId || null;
  const rng = makeRng(hashStr(`${BOARD_SCHEME}:${dateKey}:${weather?.id || 'sun'}`));
  const difficultySlots = shuffleInPlace(rng, ['easy', 'easy', 'medium', 'medium', 'hard']);
  const pillars = shuffleInPlace(rng, [...PILLARS]);

  const picked = [];
  const usedIds = new Set();
  const usedNpcs = new Set();

  for (let i = 0; i < pillars.length; i++) {
    const pillar = pillars[i];
    const difficulty = difficultySlots[i];
    let q = pickQuest(rng, boardData, {
      pillar,
      difficulty,
      usedIds,
      usedNpcs,
      allowNpcReuse: false,
      weatherJobId,
      resources,
    });
    if (!q) {
      for (const d of ['easy', 'medium', 'hard']) {
        if (d === difficulty) continue;
        q = pickQuest(rng, boardData, {
          pillar,
          difficulty: d,
          usedIds,
          usedNpcs,
          allowNpcReuse: false,
          weatherJobId,
          resources,
        });
        if (q) break;
      }
    }
    if (q) {
      picked.push(q.id);
      usedIds.add(q.id);
      if (q.npcId) usedNpcs.add(q.npcId);
    }
  }

  // Joker : favorise d’abord le pilier harvest (souvent lié à la météo), puis le reste
  const jokerDiff = difficultySlots[4] || 'medium';
  const jokerPillarOrder = shuffleInPlace(rng, [...PILLARS]);
  if (weatherJobId) {
    jokerPillarOrder.sort((a, b) => (a === 'harvest' ? -1 : 0) - (b === 'harvest' ? -1 : 0));
  }
  let joker = null;
  for (const pillar of jokerPillarOrder) {
    joker = pickQuest(rng, boardData, {
      pillar,
      difficulty: jokerDiff,
      usedIds,
      usedNpcs,
      allowNpcReuse: true,
      weatherJobId,
      resources,
    });
    if (joker) break;
  }
  if (!joker) {
    for (const pillar of jokerPillarOrder) {
      for (const d of ['easy', 'medium', 'hard']) {
        joker = pickQuest(rng, boardData, {
          pillar,
          difficulty: d,
          usedIds,
          usedNpcs,
          allowNpcReuse: true,
          weatherJobId,
          resources,
        });
        if (joker) break;
      }
      if (joker) break;
    }
  }
  if (joker) {
    picked.push(joker.id);
    usedIds.add(joker.id);
  }

  const clearEasy = getDifficultyDef(boardData, 'easy');
  const clearMed = getDifficultyDef(boardData, 'medium');

  return {
    date: dateKey,
    scheme: BOARD_SCHEME,
    difficulty: 'mixed',
    weatherId: weather?.id || null,
    questIds: picked,
    rewardKirha: 0,
    rewardNuggets: 0,
    clearBonusNuggets: Math.max(
      Number(clearEasy?.clearBonusNuggets) || 0,
      Number(clearMed?.clearBonusNuggets) || 1
    ),
    clearBonusKirha: Number(clearMed?.clearBonusKirha) || 80,
  };
}

function emptyDaily(roll) {
  return {
    date: roll.date,
    scheme: roll.scheme || BOARD_SCHEME,
    difficulty: roll.difficulty || 'mixed',
    weatherId: roll.weatherId || null,
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
export function ensureVillageBoardDay(state, boardData, now = Date.now(), resources = null) {
  const dateKey = getUtcDateKey(now);
  const daily = state.villageBoard;
  const sameDay = daily?.date === dateKey && Array.isArray(daily.questIds);
  const needsReroll = !sameDay || daily.scheme !== BOARD_SCHEME;

  if (sameDay && !needsReroll) {
    state.villageBoard.questIds = state.villageBoard.questIds.map((id) => {
      if (id === 'e_f_kenji_eau') return 'e_f_haru_eau';
      if (id === 'h_h_kenji') return 'h_h_haru';
      return id;
    });
    if (state.villageBoard.completed) {
      if (state.villageBoard.completed.e_f_kenji_eau) {
        state.villageBoard.completed.e_f_haru_eau = true;
        delete state.villageBoard.completed.e_f_kenji_eau;
      }
      if (state.villageBoard.completed.h_h_kenji) {
        state.villageBoard.completed.h_h_haru = true;
        delete state.villageBoard.completed.h_h_kenji;
      }
    }
    return { daily: state.villageBoard, rolled: false };
  }
  const roll = rollDailyBoard(boardData, dateKey, resources);
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
    if (!state.lifetimeStats) state.lifetimeStats = {};
    state.lifetimeStats.dungeonClears = (state.lifetimeStats.dungeonClears || 0) + 1;
    return;
  }
  if (result.isBoss) {
    daily.bossKills = (daily.bossKills || 0) + 1;
  } else {
    daily.mobKills = (daily.mobKills || 0) + 1;
  }
}

function grantRewards(state, kirha, nuggets, scrolls = 0) {
  const k = Math.max(0, Math.floor(Number(kirha) || 0));
  const n = Math.max(0, Math.floor(Number(nuggets) || 0));
  const s = Math.max(0, Math.floor(Number(scrolls) || 0));
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
  if (s > 0) {
    state.inventory.ancient_scroll = (state.inventory.ancient_scroll || 0) + s;
  }
  return { kirha: k, nuggets: n, scrolls: s };
}

/**
 * Livre / valide une quête du panneau.
 */
export function turnInVillageQuest(state, boardData, questId, balance, jobs, farmData, resources = null) {
  ensureVillageBoardDay(state, boardData, Date.now(), resources);
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

  const diffDef = getDifficultyDef(boardData, quest.difficulty);
  const rewardRng = makeRng(hashStr(`${daily.date}:${questId}:reward`));
  const kirha = randInt(rewardRng, diffDef?.kirhaMin ?? 60, diffDef?.kirhaMax ?? 100);
  const nuggets = Number(diffDef?.nuggets) || 0;
  const rewards = grantRewards(state, kirha, nuggets);
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
  ensureVillageBoardDay(state, boardData, Date.now(), resources);
  const daily = state.villageBoard;
  const weather = getWeatherForDateKey(daily.date || getUtcDateKey());
  const weatherJobId = weather?.jobId || null;
  const cards = (daily.questIds || []).map((id, idx) => {
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
    const diffDef = getDifficultyDef(boardData, quest?.difficulty);
    const isJoker = idx === (daily.questIds?.length || 0) - 1;
    const weatherLinked = questMatchesWeather(quest, weatherJobId, resources);
    return {
      quest,
      npc,
      locked,
      completed,
      progress,
      deliverParts,
      difficulty: diffDef,
      isJoker,
      weatherLinked,
      lockHint: locked ? getRequirementHint(quest?.requires, jobs, farmData) : null,
      canTurnIn: !completed && !locked && progress.ready,
    };
  });

  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const c of cards) {
    const d = c.quest?.difficulty;
    if (d && counts[d] != null) counts[d] += 1;
  }

  const doneCount = cards.filter((c) => c.completed).length;
  return {
    daily,
    difficulty: { id: 'mixed', label: 'Mixte', emoji: '🎯' },
    weather,
    mixCounts: counts,
    cards,
    doneCount,
    total: cards.length,
    allDone: doneCount >= cards.length && cards.length > 0,
    claimedClearBonus: !!daily.claimedClearBonus,
  };
}

function getSakuraQuestDef(boardData) {
  return boardData?.sakuraWindQuest || null;
}

export function getSakuraWindQuestView(state, boardData, balance, resources, now = Date.now()) {
  const quest = getSakuraQuestDef(boardData);
  const status = getSakuraWindStatus(now, balance);
  if (!quest || !status.scheduled) {
    return { available: false, status, quest: null };
  }

  if (!state.sakuraWind || state.sakuraWind.date !== status.dateKey) {
    state.sakuraWind = { date: status.dateKey, completed: false };
  }

  const completed = !!state.sakuraWind.completed;
  const progress = getQuestProgress(quest, state, null);
  const deliverParts = (progress.parts || []).map((p) => ({
    ...p,
    name: resources?.[p.resId]?.name || p.resId,
    emoji: resources?.[p.resId]?.emoji || '',
  }));
  const npc = getNpc(boardData, quest.npcId);

  return {
    available: true,
    status,
    quest,
    npc,
    completed,
    progress,
    deliverParts,
    canTurnIn: status.active && !completed && progress.ready,
    rewardHint: {
      kirhaMin: Number(quest.rewardKirhaMin) || 280,
      kirhaMax: Number(quest.rewardKirhaMax) || 380,
      nuggets: Number(quest.rewardNuggets) || 2,
      scrolls: Number(quest.rewardScrolls) || 1,
    },
  };
}

export function turnInSakuraWindQuest(state, boardData, balance, now = Date.now()) {
  const view = getSakuraWindQuestView(state, boardData, balance, null, now);
  const quest = getSakuraQuestDef(boardData);
  if (!quest) return { ok: false, reason: 'Quête introuvable.' };
  const status = getSakuraWindStatus(now, balance);
  if (!status.active) {
    return { ok: false, reason: 'Le Vent des cerisiers n’est pas actif (fenêtre de 20 min UTC).' };
  }
  if (!state.sakuraWind || state.sakuraWind.date !== status.dateKey) {
    state.sakuraWind = { date: status.dateKey, completed: false };
  }
  if (state.sakuraWind.completed) {
    return { ok: false, reason: 'Offrande déjà déposée aujourd’hui.' };
  }

  const progress = getQuestProgress(quest, state, null);
  if (!progress.ready) return { ok: false, reason: 'Objectif pas encore atteint.' };

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

  state.sakuraWind.completed = true;
  const rewardRng = makeRng(hashStr(`${status.dateKey}:sakura_wind:reward`));
  const kirha = randInt(rewardRng, quest.rewardKirhaMin ?? 280, quest.rewardKirhaMax ?? 380);
  const rewards = grantRewards(
    state,
    kirha,
    Number(quest.rewardNuggets) || 2,
    Number(quest.rewardScrolls) || 1
  );
  const npc = getNpc(boardData, quest.npcId);
  return {
    ok: true,
    quest,
    npc,
    thanks: npc?.thanks || 'Les pétales t’en remercient.',
    rewards,
    sakura: true,
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
