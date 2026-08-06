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

/** Conseils du jour (flavor stratégique, sans contrainte). */
export const WEATHER_TIPS = {
  rain: 'Les pêcheurs racontent que les bouteilles dérivent plus souvent jusqu’aux berges aujourd’hui…',
  snow: 'Sous la neige, la roche craque : les mineurs murmurent que les bourses apparaissent plus facilement.',
  sun: 'Beau temps sur les champs — les bourses entre les cultures se laissent mieux apercevoir.',
  wind: 'Le vent soulève les herbes : les alchimistes cherchent d’anciens sacs dans les fourrés.',
  fog: 'Dans la brume, les nids abandonnés se cachent moins bien entre les branches.',
};

export const WEATHER_TOMORROW_BLURBS = {
  rain: 'Les pêcheurs annoncent une journée idéale pour lancer leurs filets.',
  snow: 'Les mineurs prévoient une journée froide, parfaite pour fendre la roche.',
  sun: 'Le beau temps sera idéal pour les cultures et le pain du marché.',
  wind: 'Un vent vif devrait agiter les plantes — journée d’herboriste en vue.',
  fog: 'La brume s’annonce : les bûcherons parlent déjà de bois bien parfumé.',
};

export const SAKURA_WIND_META = {
  id: 'sakura_wind',
  label: 'Vent des cerisiers',
  emoji: '🌸',
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
  /** Event rare : ~1× / 2 semaines (aléatoire déterministe UTC) */
  sakuraWindChance: 1 / 14,
  sakuraWindDurationMs: 20 * 60 * 1000,
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

export function addUtcDays(dateKey, days = 1) {
  const [y, m, d] = String(dateKey || '').split('-').map(Number);
  if (!y || !m || !d) return getUtcDateKey();
  const dt = new Date(Date.UTC(y, m - 1, d + (Number(days) || 0)));
  return dt.toISOString().slice(0, 10);
}

export function getWeatherForDateKey(dateKey) {
  const id = getWeatherIdForDate(dateKey);
  return { dateKey, ...(WEATHER_META[id] || WEATHER_META.sun) };
}

export function getTomorrowWeather(now = Date.now()) {
  return getWeatherForDateKey(addUtcDays(getUtcDateKey(now), 1));
}

function hashStr(s) {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Event rare déterministe (même fenêtre pour tous).
 * @returns {{ dateKey, startAt, endAt, durationMs }|null}
 */
export function getSakuraWindSchedule(dateKey, balance = null) {
  const c = cfg(balance);
  const chance = Number(c.sakuraWindChance);
  const durationMs = Math.max(60_000, Number(c.sakuraWindDurationMs) || 20 * 60 * 1000);
  const rng = makeRng(hashStr(`sakura_wind_v1:${dateKey}`));
  if (rng() >= (Number.isFinite(chance) ? chance : 0.125)) return null;

  const dayStart = Date.parse(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(dayStart)) return null;
  const durationMin = Math.ceil(durationMs / 60000);
  const maxStartMin = Math.max(0, 24 * 60 - durationMin);
  const startMin = Math.floor(rng() * (maxStartMin + 1));
  const startAt = dayStart + startMin * 60_000;
  return {
    dateKey,
    startAt,
    endAt: startAt + durationMs,
    durationMs,
  };
}

export function formatUtcHm(ts) {
  const d = new Date(ts);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * Statut Vent des cerisiers pour un instant donné.
 */
export function getSakuraWindStatus(now = Date.now(), balance = null) {
  const dateKey = getUtcDateKey(now);
  const schedule = getSakuraWindSchedule(dateKey, balance);
  if (!schedule) {
    return { scheduled: false, active: false, upcoming: false, past: false, schedule: null, dateKey };
  }
  const active = now >= schedule.startAt && now < schedule.endAt;
  const upcoming = now < schedule.startAt;
  const past = now >= schedule.endAt;
  return {
    scheduled: true,
    active,
    upcoming,
    past,
    schedule,
    dateKey,
    startLabel: formatUtcHm(schedule.startAt),
    endLabel: formatUtcHm(schedule.endAt),
    msUntilStart: Math.max(0, schedule.startAt - now),
    msUntilEnd: Math.max(0, schedule.endAt - now),
  };
}

/** Vue complète Ciel du jour + demain (+ sakura). */
export function getWeatherSkyView(now = Date.now(), balance = null) {
  const today = getCurrentWeather(now);
  const tomorrow = getTomorrowWeather(now);
  const sakuraToday = getSakuraWindStatus(now, balance);
  const sakuraTomorrow = getSakuraWindSchedule(tomorrow.dateKey, balance);

  return {
    today,
    tip: WEATHER_TIPS[today.id] || '',
    tomorrow: {
      weather: tomorrow,
      blurb: WEATHER_TOMORROW_BLURBS[tomorrow.id] || '',
      sakura: sakuraTomorrow
        ? {
            ...SAKURA_WIND_META,
            startLabel: formatUtcHm(sakuraTomorrow.startAt),
            endLabel: formatUtcHm(sakuraTomorrow.endAt),
            durationMin: Math.round(sakuraTomorrow.durationMs / 60000),
          }
        : null,
    },
    sakura: sakuraToday.scheduled
      ? {
          ...SAKURA_WIND_META,
          ...sakuraToday,
        }
      : { ...SAKURA_WIND_META, scheduled: false, active: false },
  };
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
        if (slot.eventChecked) delete slot.eventChecked;
        if (slot.active?.event) delete slot.active.event;
        if (slot.active?.eventReveal) delete slot.active.eventReveal;
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

export function getActiveEventReveal(slot, now = Date.now()) {
  const reveal = slot?.active?.eventReveal;
  if (!reveal?.type) return null;
  if ((Number(reveal.until) || 0) <= now) {
    if (slot?.active) delete slot.active.eventReveal;
    return null;
  }
  return reveal;
}

export function getSlotEventVisual(slot) {
  const reveal = getActiveEventReveal(slot);
  if (reveal?.type) {
    if (reveal.type === 'kirha') return { kind: 'kirha', label: 'Découverte', reveal };
    if (reveal.type === 'jackpot') return { kind: 'jackpot', label: 'Jackpot', reveal };
    if (reveal.type === 'shiny') return { kind: 'shiny', label: 'Bonus', reveal };
  }

  // Idle prêt : brillance en attente
  if (!slot?.active && slot?.pendingEvent?.type) {
    const ev = slot.pendingEvent;
    if (ev.type === 'kirha') return { kind: 'kirha', label: 'Découverte', reveal: null };
    if (ev.type === 'jackpot') return { kind: 'jackpot', label: 'Jackpot', reveal: null };
    if (ev.type === 'shiny') return { kind: 'shiny', label: 'Bonus', reveal: null };
  }

  // Uniquement pendant la phase harvesting (pas la repousse)
  if (slot?.active?.phase === 'harvesting' && slot.active.event?.type) {
    const ev = slot.active.event;
    if (ev.type === 'kirha') return { kind: 'kirha', label: 'Découverte', reveal: null };
    if (ev.type === 'jackpot') return { kind: 'jackpot', label: 'Jackpot', reveal: null };
    if (ev.type === 'shiny') return { kind: 'shiny', label: 'Bonus', reveal: null };
  }

  return null;
}

/** Overlay texte pendant la révélation (reste affiché ~8 s). */
export function getEventRevealAnnounceHtml(reveal, now = Date.now()) {
  if (!reveal?.type) return '';
  const elapsed = now - (Number(reveal.startedAt) || now);
  if (reveal.type === 'kirha') {
    if (elapsed < 3200) {
      return `<div class="slot-event-announce slot-event-announce-flavor">${reveal.flavor || 'Découverte !'}</div>`;
    }
    const kirha = Math.max(0, Math.floor(Number(reveal.kirhaGain) || 0));
    if (kirha <= 0) return '';
    return `<div class="slot-event-announce slot-event-announce-kirha">+${kirha} 💰</div>`;
  }
  const qty = Math.max(0, Math.floor(Number(reveal.yieldAmount) || 0));
  if (qty <= 0) return '';
  return `<div class="slot-event-announce slot-event-announce-${reveal.type}">+${qty}</div>`;
}
