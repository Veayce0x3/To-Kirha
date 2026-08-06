/**
 * Carnet du voyageur — lore optionnel, pages débloquées par jalons.
 */

export function emptyTravelerJournalState() {
  return { unlocked: [], seenToast: [] };
}

export function ensureTravelerJournalState(state) {
  if (!state.travelerJournal || typeof state.travelerJournal !== 'object') {
    state.travelerJournal = emptyTravelerJournalState();
  }
  if (!Array.isArray(state.travelerJournal.unlocked)) state.travelerJournal.unlocked = [];
  if (!Array.isArray(state.travelerJournal.seenToast)) state.travelerJournal.seenToast = [];
  return state.travelerJournal;
}

function maxJobLevel(state) {
  let max = 1;
  for (const j of Object.values(state.jobs || {})) {
    const lv = Number(j?.level) || 1;
    if (lv > max) max = lv;
  }
  return max;
}

function hasBossKill(state) {
  return Object.values(state.bossKills || {}).some((n) => (Number(n) || 0) > 0)
    || (Number(state.lifetimeStats?.bossKillsTotal) || 0) > 0;
}

function hasDungeonClear(state) {
  return Object.values(state.dungeonClears || {}).some((n) => (Number(n) || 0) > 0)
    || (Number(state.lifetimeStats?.dungeonClears) || 0) > 0
    || (Number(state.stats?.dungeonClears) || 0) > 0
    || (Number(state.villageBoard?.dungeonClears) || 0) > 0;
}

function hasSchoolResearch(state) {
  const s = state.villageSchool;
  if (!s) return false;
  return (s.completedSeasonal?.length || 0) + (s.completedPermanent?.length || 0) > 0;
}

function hasMerchantSeen(state) {
  if (state.travelingMerchant?.popupSeen) return true;
  if (state.lifetimeStats?.travelingMerchantMet) return true;
  const bought = state.travelingMerchant?.bought;
  if (bought && Object.values(bought).some((n) => (Number(n) || 0) > 0)) return true;
  return false;
}

function hasSakuraWind(state) {
  if (state.lifetimeStats?.sakuraWindSeen) return true;
  if (state.sakuraWind?.seen) return true;
  const w = state.harvestEventsDaily?.weatherId || state.harvestEventsDaily?.weather;
  return w === 'sakura_wind' || w === 'sakuraWind';
}

function hasCookbookMaster(state, recipes, resources) {
  const discovered = state.cookbook?.discovered || [];
  if (!discovered.length || !recipes) return false;
  for (const id of discovered) {
    const recipe = recipes[id];
    if (!recipe) continue;
    const out = recipe.output ? resources?.[recipe.output] : null;
    const lv = Number(recipe.requiredJobLevel) || 1;
    const tier = Number(out?.mealTier) || 0;
    const score = Math.max(lv, Math.floor(tier / 10) || 0);
    if (recipe.quality === 'master' || score >= 80) return true;
  }
  return false;
}

function isCareerDone(state) {
  return !!(state.careerChoice?.confirmed);
}

export function isJournalUnlockMet(unlock, state, ctx = {}) {
  if (!unlock || !unlock.type) return false;
  const { recipes, resources } = ctx;
  switch (unlock.type) {
    case 'career':
      return isCareerDone(state);
    case 'jobLevel':
      return maxJobLevel(state) >= (Number(unlock.min) || 20);
    case 'bossAny':
      return hasBossKill(state);
    case 'dungeonAny':
      return hasDungeonClear(state);
    case 'schoolAny':
      return hasSchoolResearch(state);
    case 'merchantSeen':
      return hasMerchantSeen(state);
    case 'sakuraWind':
      return hasSakuraWind(state);
    case 'cookbookMaster':
      return hasCookbookMaster(state, recipes, resources);
    case 'zoneUnlocked':
      return (state.unlockedZones || []).includes(unlock.zoneId)
        || !!ctx.balance?.zones?.[unlock.zoneId]?.unlocked;
    case 'seasonMin':
      return (Number(state.season) || 1) >= (Number(unlock.min) || 2)
        || (Number(state.lifetimeStats?.seasonsCompleted) || 0) >= ((Number(unlock.min) || 2) - 1);
    default:
      return false;
  }
}

/** Débloque les pages dont les conditions sont remplies. Retourne les ids nouvellement ouverts. */
export function syncTravelerJournalUnlocks(state, journalData, ctx = {}) {
  const book = ensureTravelerJournalState(state);
  const newly = [];
  const entries = journalData?.entries || {};

  // Flags de vie pour conditions volatiles
  if (state.travelingMerchant?.popupSeen) {
    if (!state.lifetimeStats) state.lifetimeStats = {};
    state.lifetimeStats.travelingMerchantMet = true;
  }
  const weather = state.harvestEventsDaily?.weatherId || state.harvestEventsDaily?.weather;
  if (weather === 'sakura_wind' || weather === 'sakuraWind') {
    if (!state.lifetimeStats) state.lifetimeStats = {};
    state.lifetimeStats.sakuraWindSeen = true;
  }

  for (const entry of Object.values(entries)) {
    if (!entry?.id) continue;
    if (book.unlocked.includes(entry.id)) continue;
    if (!isJournalUnlockMet(entry.unlock, state, ctx)) continue;
    book.unlocked.push(entry.id);
    newly.push(entry.id);
  }
  return newly;
}

export function getTravelerJournalViewModel(state, journalData, ctx = {}) {
  ensureTravelerJournalState(state);
  syncTravelerJournalUnlocks(state, journalData, ctx);
  const book = state.travelerJournal;
  const list = Object.values(journalData?.entries || {})
    .map((entry) => ({
      ...entry,
      unlocked: book.unlocked.includes(entry.id),
    }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const unlockedCount = list.filter((e) => e.unlocked).length;
  return {
    title: journalData?.title || 'Carnet du voyageur',
    emoji: journalData?.emoji || '📔',
    description: journalData?.description || '',
    entries: list,
    unlockedCount,
    total: list.length,
  };
}

/** Pages débloquées pas encore toastées. */
export function consumeJournalUnlockToasts(state, journalData) {
  const book = ensureTravelerJournalState(state);
  const toToast = [];
  for (const id of book.unlocked) {
    if (book.seenToast.includes(id)) continue;
    book.seenToast.push(id);
    const entry = journalData?.entries?.[id];
    if (entry) toToast.push(entry);
  }
  return toToast;
}
