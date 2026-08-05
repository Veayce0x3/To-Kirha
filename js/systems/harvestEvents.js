/**
 * Événements aléatoires de récolte : brillants ressource / jackpot / découvertes Kirha.
 * Météo UTC partagée (00:00 UTC) · caps journaliers · lifetime discoveries.
 */

export const WEATHER_IDS = ['rain', 'snow', 'sun', 'wind', 'fog'];

export const WEATHER_META = {
  rain: { id: 'rain', label: 'Pluie', emoji: '🌧️', jobId: 'fisher', discoveryId: 'bottle' },
  snow: { id: 'snow', label: 'Neige', emoji: '❄️', jobId: 'miner', discoveryId: 'rock_purse' },
  sun: { id: 'sun', label: 'Soleil', emoji: '☀️', jobId: 'farmer', discoveryId: 'field_purse' },
  wind: { id: 'wind', label: 'Vent', emoji: '🌬️', jobId: 'alchemist', discoveryId: 'herb_bag' },
  fog: { id: 'fog', label: 'Brouillard', emoji: '🌫️', jobId: 'lumberjack', discoveryId: 'nest' },
};

export const DISCOVERY_META = {
  nest: {
    id: 'nest',
    label: 'Nid abandonné',
    jobId: 'lumberjack',
    flavor: 'Vous découvrez un nid abandonné !',
  },
  rock_purse: {
    id: 'rock_purse',
    label: 'Bourse dans la roche',
    jobId: 'miner',
    flavor: 'Une vieille bourse était coincée dans la roche',
  },
  field_purse: {
    id: 'field_purse',
    label: 'Bourse dans les cultures',
    jobId: 'farmer',
    flavor: 'Vous trouvez une vieille bourse entre les cultures',
  },
  bottle: {
    id: 'bottle',
    label: 'Bouteille à la mer',
    jobId: 'fisher',
    flavor: 'Une bouteille dérive au fil de l’eau',
  },
  herb_bag: {
    id: 'herb_bag',
    label: 'Ancien sac d’herboriste',
    jobId: 'alchemist',
    flavor: 'Un ancien sac est caché sous les plantes.',
  },
};

const DEFAULT_CFG = {
  shinyChance: 1 / 30,
  jackpotAmongShiny: 1 / 20,
  kirhaChance: 1 / 80,
  shinyMin: 2,
  shinyMax: 5,
  jackpotYield: 10,
  kirhaMin: 40,
  kirhaMax: 120,
  dailyShinyCap: 10,
  dailyJackpotCap: 1,
  dailyKirhaCap: 3,
};

function cfg(balance) {
  return { ...DEFAULT_CFG, ...(balance?.harvestEvents || {}) };
}

export function getUtcDateKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

/** Hash stable → même météo pour tous à une date UTC donnée. */
export function getWeatherIdForDate(dateKey) {
  let h = 2166136261;
  const s = String(dateKey || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return WEATHER_IDS[Math.abs(h) % WEATHER_IDS.length];
}

export function getCurrentWeather(now = Date.now()) {
  const dateKey = getUtcDateKey(now);
  const id = getWeatherIdForDate(dateKey);
  return { dateKey, ...(WEATHER_META[id] || WEATHER_META.sun) };
}

function randInt(min, max) {
  const a = Math.floor(Number(min) || 0);
  const b = Math.floor(Number(max) || 0);
  if (b <= a) return a;
  return a + Math.floor(Math.random() * (b - a + 1));
}

function ensureLifetimeDiscoveries(state) {
  if (!state.lifetimeStats) state.lifetimeStats = {};
  if (!state.lifetimeStats.discoveries || typeof state.lifetimeStats.discoveries !== 'object') {
    state.lifetimeStats.discoveries = {
      nest: 0,
      rock_purse: 0,
      field_purse: 0,
      bottle: 0,
      herb_bag: 0,
    };
  }
  return state.lifetimeStats.discoveries;
}

export function getTotalDiscoveries(state) {
  const d = state?.lifetimeStats?.discoveries || {};
  return ['nest', 'rock_purse', 'field_purse', 'bottle', 'herb_bag']
    .reduce((sum, id) => sum + (Number(d[id]) || 0), 0);
}

function defaultDaily(dateKey) {
  return {
    date: dateKey,
    shinyUsed: 0,
    jackpotUsed: 0,
    kirhaUsed: 0,
    shinyPending: 0,
    jackpotPending: 0,
    kirhaPending: 0,
  };
}

/** Compte les pendingEvent encore présents sur les slots (réconciliation). */
function recountPendingFromSlots(state) {
  const counts = { shiny: 0, jackpot: 0, kirha: 0 };
  const harvest = state.productionLines?.harvest || {};
  for (const jobLines of Object.values(harvest)) {
    for (const line of Object.values(jobLines || {})) {
      for (const slot of line?.slots || []) {
        const ev = slot?.pendingEvent || slot?.active?.event;
        if (!ev?.type) continue;
        if (ev.type === 'shiny') counts.shiny += 1;
        else if (ev.type === 'jackpot') counts.jackpot += 1;
        else if (ev.type === 'kirha') counts.kirha += 1;
      }
    }
  }
  return counts;
}

function clearAllSlotEvents(state) {
  const harvest = state.productionLines?.harvest || {};
  for (const jobLines of Object.values(harvest)) {
    for (const line of Object.values(jobLines || {})) {
      for (const slot of line?.slots || []) {
        if (!slot) continue;
        if (slot.pendingEvent) delete slot.pendingEvent;
        if (slot.active?.event) delete slot.active.event;
      }
    }
  }
}

/**
 * Reset journalier UTC + retire les brillances de la veille.
 * @returns {{ changed: boolean, dayRolled: boolean }}
 */
export function syncHarvestEventsDay(state, balance, now = Date.now()) {
  const dateKey = getUtcDateKey(now);
  ensureLifetimeDiscoveries(state);
  let dayRolled = false;
  if (!state.harvestEventsDaily || state.harvestEventsDaily.date !== dateKey) {
    clearAllSlotEvents(state);
    state.harvestEventsDaily = defaultDaily(dateKey);
    dayRolled = true;
  }
  const daily = state.harvestEventsDaily;
  const live = recountPendingFromSlots(state);
  daily.shinyPending = live.shiny;
  daily.jackpotPending = live.jackpot;
  daily.kirhaPending = live.kirha;
  return { changed: dayRolled, dayRolled };
}

export function getHarvestEventsDailyStatus(state, balance, now = Date.now()) {
  syncHarvestEventsDay(state, balance, now);
  const c = cfg(balance);
  const d = state.harvestEventsDaily;
  const weather = getCurrentWeather(now);
  return {
    weather,
    shiny: {
      used: d.shinyUsed || 0,
      pending: d.shinyPending || 0,
      cap: c.dailyShinyCap,
      remaining: Math.max(0, c.dailyShinyCap - (d.shinyUsed || 0) - (d.shinyPending || 0)),
    },
    jackpot: {
      used: d.jackpotUsed || 0,
      pending: d.jackpotPending || 0,
      cap: c.dailyJackpotCap,
      remaining: Math.max(0, c.dailyJackpotCap - (d.jackpotUsed || 0) - (d.jackpotPending || 0)),
    },
    kirha: {
      used: d.kirhaUsed || 0,
      pending: d.kirhaPending || 0,
      cap: c.dailyKirhaCap,
      remaining: Math.max(0, c.dailyKirhaCap - (d.kirhaUsed || 0) - (d.kirhaPending || 0)),
    },
  };
}

function canRollAnything(daily, c, weather, jobId) {
  const shinyLeft = c.dailyShinyCap - (daily.shinyUsed || 0) - (daily.shinyPending || 0);
  const jackpotLeft = c.dailyJackpotCap - (daily.jackpotUsed || 0) - (daily.jackpotPending || 0);
  const kirhaLeft = c.dailyKirhaCap - (daily.kirhaUsed || 0) - (daily.kirhaPending || 0);
  const kirhaOk = kirhaLeft > 0 && weather.jobId === jobId;
  return shinyLeft > 0 || jackpotLeft > 0 || kirhaOk;
}

/**
 * Tire un événement pour un emplacement libre (prêt). Compte en pending.
 * @returns {object|null} pendingEvent
 */
export function rollPendingHarvestEvent(state, balance, jobId, now = Date.now()) {
  syncHarvestEventsDay(state, balance, now);
  const daily = state.harvestEventsDaily;
  const c = cfg(balance);
  const weather = getCurrentWeather(now);
  if (!canRollAnything(daily, c, weather, jobId)) return null;

  const shinyLeft = c.dailyShinyCap - (daily.shinyUsed || 0) - (daily.shinyPending || 0);
  const jackpotLeft = c.dailyJackpotCap - (daily.jackpotUsed || 0) - (daily.jackpotPending || 0);
  const kirhaLeft = c.dailyKirhaCap - (daily.kirhaUsed || 0) - (daily.kirhaPending || 0);

  // 1) Découverte Kirha (météo = métier)
  if (kirhaLeft > 0 && weather.jobId === jobId && Math.random() < c.kirhaChance) {
    const amount = randInt(c.kirhaMin, c.kirhaMax);
    const discoveryId = weather.discoveryId;
    const meta = DISCOVERY_META[discoveryId];
    daily.kirhaPending = (daily.kirhaPending || 0) + 1;
    return {
      type: 'kirha',
      amount,
      discoveryId,
      flavor: meta?.flavor || 'Vous trouvez quelque chose…',
      day: daily.date,
    };
  }

  // 2) Brillant ressource (1/30) → jackpot 1/20 parmi eux, sinon shiny si cap OK
  if (Math.random() >= c.shinyChance) return null;

  if (jackpotLeft > 0 && Math.random() < c.jackpotAmongShiny) {
    daily.jackpotPending = (daily.jackpotPending || 0) + 1;
    return {
      type: 'jackpot',
      amount: c.jackpotYield,
      day: daily.date,
    };
  }

  if (shinyLeft > 0) {
    daily.shinyPending = (daily.shinyPending || 0) + 1;
    return {
      type: 'shiny',
      amount: randInt(c.shinyMin, c.shinyMax),
      day: daily.date,
    };
  }

  return null;
}

/** Attache un pendingEvent à un slot prêt (idle). */
export function attachPendingEventToSlot(state, balance, jobId, slot, now = Date.now()) {
  if (!slot || slot.active || slot.pendingEvent) return null;
  const ev = rollPendingHarvestEvent(state, balance, jobId, now);
  if (!ev) return null;
  slot.pendingEvent = ev;
  return ev;
}

function releasePendingCount(daily, type) {
  if (!daily || !type) return;
  if (type === 'shiny') daily.shinyPending = Math.max(0, (daily.shinyPending || 0) - 1);
  else if (type === 'jackpot') daily.jackpotPending = Math.max(0, (daily.jackpotPending || 0) - 1);
  else if (type === 'kirha') daily.kirhaPending = Math.max(0, (daily.kirhaPending || 0) - 1);
}

function commitUsedCount(daily, type) {
  if (!daily || !type) return;
  if (type === 'shiny') daily.shinyUsed = (daily.shinyUsed || 0) + 1;
  else if (type === 'jackpot') daily.jackpotUsed = (daily.jackpotUsed || 0) + 1;
  else if (type === 'kirha') daily.kirhaUsed = (daily.kirhaUsed || 0) + 1;
}

/** « Tout récolter » : retire la brillance sans appliquer le bonus. */
export function discardPendingEvent(state, slot) {
  if (!slot?.pendingEvent) return;
  const daily = state.harvestEventsDaily;
  releasePendingCount(daily, slot.pendingEvent.type);
  delete slot.pendingEvent;
}

/**
 * Démarre une récolte : conserve l’event si manuel, sinon discard.
 * @returns {object|null} event porté sur active
 */
export function takeEventForHarvestStart(state, slot, { skipEvents = false } = {}) {
  if (!slot?.pendingEvent) return null;
  if (skipEvents) {
    discardPendingEvent(state, slot);
    return null;
  }
  const ev = slot.pendingEvent;
  delete slot.pendingEvent;
  return ev;
}

/**
 * Applique l’event à la fin de la phase harvesting.
 * @returns {{ yieldOverride: number|null, kirhaGain: number, discoveryId: string|null, event: object|null }}
 */
export function applyHarvestEventOnComplete(state, activeEvent) {
  const empty = { yieldOverride: null, kirhaGain: 0, discoveryId: null, event: null };
  if (!activeEvent?.type) return empty;

  const daily = state.harvestEventsDaily;
  releasePendingCount(daily, activeEvent.type);
  commitUsedCount(daily, activeEvent.type);

  if (activeEvent.type === 'shiny' || activeEvent.type === 'jackpot') {
    return {
      yieldOverride: Math.max(1, Math.floor(Number(activeEvent.amount) || 1)),
      kirhaGain: 0,
      discoveryId: null,
      event: activeEvent,
    };
  }

  if (activeEvent.type === 'kirha') {
    const gain = Math.max(0, Math.floor(Number(activeEvent.amount) || 0));
    if (gain > 0) {
      state.kirha = (state.kirha || 0) + gain;
      if (state.lifetimeStats) {
        state.lifetimeStats.totalEarned = (state.lifetimeStats.totalEarned || 0) + gain;
      }
      if (state.stats) {
        state.stats.totalEarned = (state.stats.totalEarned || 0) + gain;
      }
    }
    const discoveryId = activeEvent.discoveryId;
    if (discoveryId) {
      const disc = ensureLifetimeDiscoveries(state);
      disc[discoveryId] = (Number(disc[discoveryId]) || 0) + 1;
    }
    return {
      yieldOverride: null,
      kirhaGain: gain,
      discoveryId: discoveryId || null,
      event: activeEvent,
    };
  }

  return empty;
}

/** Après repousse : tente un roll sur le slot redevenu prêt. */
export function onHarvestSlotReady(state, balance, jobId, slot, now = Date.now()) {
  syncHarvestEventsDay(state, balance, now);
  if (!slot) return null;
  delete slot.eventChecked;
  const ev = attachPendingEventToSlot(state, balance, jobId, slot, now);
  slot.eventChecked = true;
  return ev;
}

/** Slots déjà prêts (chargement / migration) : un seul essai de roll. */
export function ensureIdleSlotEvent(state, balance, jobId, slot, now = Date.now()) {
  syncHarvestEventsDay(state, balance, now);
  if (!slot || slot.active || slot.pendingEvent || slot.eventChecked) {
    return slot?.pendingEvent || null;
  }
  slot.eventChecked = true;
  return attachPendingEventToSlot(state, balance, jobId, slot, now);
}

export function ensureHarvestEventsForJob(state, balance, jobId, now = Date.now()) {
  syncHarvestEventsDay(state, balance, now);
  const lines = state.productionLines?.harvest?.[jobId] || {};
  for (const line of Object.values(lines)) {
    for (const slot of line?.slots || []) {
      ensureIdleSlotEvent(state, balance, jobId, slot, now);
    }
  }
}

export function getSlotEventVisual(slot) {
  const ev = slot?.pendingEvent || slot?.active?.event;
  if (!ev?.type) return null;
  if (ev.type === 'kirha') return { kind: 'kirha', label: 'Découverte' };
  if (ev.type === 'jackpot') return { kind: 'jackpot', label: 'Jackpot' };
  return { kind: 'shiny', label: 'Bonus' };
}
