/**
 * Marchand itinérant — visite rare (~1×/semaine UTC), boutique temporaire Kirha.
 */

import { getUtcDateKey, addUtcDays } from './harvestEvents.js';
import { getSchoolBonusesFromState } from './villageSchool.js';

const THEMES = {
  mine: {
    id: 'mine',
    label: 'Mine',
    emoji: '⛏️',
    pools: {
      harvest: ['pierre', 'fer', 'cuivre', 'topaze', 'jade', 'saphir'],
      craft: ['elixir_ortie', 'elixir_menthe'],
    },
  },
  fish: {
    id: 'fish',
    label: 'Pêche',
    emoji: '🎣',
    pools: {
      harvest: ['dorade', 'crabe', 'saumon', 'calmar', 'homard', 'naso'],
      craft: ['meal_poisson', 'meal_onigiri', 'meal_sushi'],
    },
  },
  crops: {
    id: 'crops',
    label: 'Agriculture',
    emoji: '🌾',
    pools: {
      harvest: ['ble', 'orge', 'avoine', 'seigle', 'sarrasin', 'mais'],
      craft: ['meal_onigiri', 'meal_gateau', 'meal_bento'],
    },
  },
  cooking: {
    id: 'cooking',
    label: 'Cuisine',
    emoji: '🍜',
    pools: {
      harvest: ['ble', 'dorade', 'oeuf', 'miel'],
      craft: ['meal_onigiri', 'meal_poisson', 'meal_ramen', 'meal_bento', 'meal_gateau'],
    },
  },
  alchemy: {
    id: 'alchemy',
    label: 'Alchimie',
    emoji: '🧪',
    pools: {
      harvest: ['pissenlit', 'ortie', 'menthe', 'lavande', 'ginseng'],
      craft: ['elixir_menthe', 'elixir_ortie', 'elixir_ginseng', 'elixir_lavande'],
    },
  },
  farm: {
    id: 'farm',
    label: 'Ferme',
    emoji: '🐔',
    pools: {
      harvest: ['oeuf', 'plume', 'lait', 'laine', 'miel', 'bacon'],
      craft: ['meal_onigiri', 'meal_gateau', 'elixir_menthe'],
    },
  },
};

const DIALOGUES = [
  'Les routes ont été longues cette semaine…',
  'Je viens de villages très éloignés.',
  'Mes marchandises ne restent jamais longtemps.',
  'Profites-en tant que je suis là.',
  'Le cerisier du village m’a guidé jusqu’ici.',
  'J’ai croisé des caravanes chargées de rumeurs… et de sacs.',
];

const PROMO_LABELS = {
  harvest: 'Ressources',
  craft: 'Cuisine & élixirs',
  scroll: 'Parchemins',
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

function randInt(rng, min, max) {
  const a = Math.floor(Number(min) || 0);
  const b = Math.floor(Number(max) || 0);
  if (b <= a) return a;
  return a + Math.floor(rng() * (b - a + 1));
}

function cfg(balance) {
  const c = balance?.travelingMerchant || {};
  return {
    chance: Number.isFinite(Number(c.chance)) ? Number(c.chance) : 1 / 7,
    demandBonus: Number.isFinite(Number(c.demandBonus)) ? Number(c.demandBonus) : 0.2,
    promoMin: Number.isFinite(Number(c.promoMin)) ? Number(c.promoMin) : 0.15,
    promoMax: Number.isFinite(Number(c.promoMax)) ? Number(c.promoMax) : 0.3,
  };
}

function getEffectiveMerchantChance(balance, state = null) {
  const base = cfg(balance).chance;
  const bonus = Number(getSchoolBonusesFromState(state).merchantChanceBonus) || 0;
  return Math.min(1, Math.max(0, base + bonus));
}

function existingIds(ids, resources) {
  return (ids || []).filter((id) => resources?.[id]);
}

/** Quota de rachat modéré selon le prix de base. */
function rollDemandQuota(rng, sellPrice) {
  const sp = Math.max(1, Number(sellPrice) || 1);
  if (sp <= 5) return randInt(rng, 35, 70);
  if (sp <= 15) return randInt(rng, 20, 45);
  if (sp <= 40) return randInt(rng, 12, 28);
  return randInt(rng, 6, 16);
}

function buyUnitPrice(resource, kind, rng) {
  if (kind === 'scroll') return randInt(rng, 32, 45); // ≥ Archiviste (25)
  const sp = Math.max(1, Number(resource?.sellPrice) || 1);
  if (kind === 'craft') {
    // Cuisine / élixirs : un peu au-dessus du sellPrice craft
    return Math.max(sp + 4, Math.floor(sp * (1.6 + rng() * 0.6)));
  }
  // Ressources brutes
  return Math.max(sp + 2, Math.floor(sp * (2.2 + rng() * 1.2)));
}

function stockFor(kind, rng) {
  if (kind === 'scroll') return randInt(rng, 1, 2);
  if (kind === 'craft') return randInt(rng, 2, 5);
  return randInt(rng, 8, 24);
}

/**
 * Tirage déterministe : le marchand est-il présent ce jour UTC ?
 * Legs « 1ʳᵉ semaine » : visite garantie le jour UTC du début de saison.
 */
export function rollTravelingMerchantDay(dateKey, balance = null, state = null) {
  if (state?.debugEvents?.forceTravelingMerchantDate === dateKey) return true;
  if (state?.villageSchool?.seasonFlags?.merchantFirstWeek && state.seasonStartedAt) {
    const startKey = getUtcDateKey(state.seasonStartedAt);
    if (dateKey === startKey) return true;
  }
  const chance = getEffectiveMerchantChance(balance, state);
  const rng = makeRng(hashStr(`traveling_merchant_v1:${dateKey}`));
  return rng() < chance;
}

export function isTravelingMerchantScheduled(dateKey, balance = null, state = null) {
  return rollTravelingMerchantDay(dateKey, balance, state);
}

/**
 * Génère la visite du jour (stock, thème, demande, promo). Déterministe.
 */
export function buildTravelingMerchantVisit(dateKey, resources, balance = null, state = null) {
  if (!rollTravelingMerchantDay(dateKey, balance, state)) return null;

  const c = cfg(balance);
  const rng = makeRng(hashStr(`traveling_merchant_stock_v1:${dateKey}`));
  const theme = THEMES[pickOne(rng, Object.keys(THEMES))] || THEMES.crops;
  const dialogue = pickOne(rng, DIALOGUES);

  const harvestPool = existingIds(theme.pools.harvest, resources);
  const craftPool = existingIds(theme.pools.craft, resources);

  const offers = [];
  const used = new Set();

  const addOffer = (resourceId, kind) => {
    if (!resourceId || used.has(resourceId) || !resources?.[resourceId]) return;
    used.add(resourceId);
    const res = resources[resourceId];
    offers.push({
      id: `${kind}_${resourceId}`,
      resourceId,
      kind,
      unitPrice: buyUnitPrice(res, kind, rng),
      stock: stockFor(kind, rng),
    });
  };

  // 3–4 ressources thème
  const harvestCount = randInt(rng, 3, 4);
  for (let i = 0; i < harvestCount && harvestPool.length; i++) {
    const id = pickOne(rng, harvestPool.filter((x) => !used.has(x)));
    addOffer(id, 'harvest');
  }
  // 1–2 crafts
  const craftCount = randInt(rng, 1, 2);
  for (let i = 0; i < craftCount && craftPool.length; i++) {
    const id = pickOne(rng, craftPool.filter((x) => !used.has(x)));
    addOffer(id, 'craft');
  }
  // Parchemin rare (~35 %)
  if (rng() < 0.35 && resources.ancient_scroll) {
    addOffer('ancient_scroll', 'scroll');
  }

  // Promo sur une catégorie présente
  const promoKinds = [...new Set(offers.map((o) => o.kind))];
  const promoKind = pickOne(rng, promoKinds) || 'harvest';
  const promoPct = Math.round((c.promoMin + rng() * (c.promoMax - c.promoMin)) * 100) / 100;
  for (const o of offers) {
    if (o.kind === promoKind) {
      o.unitPrice = Math.max(1, Math.floor(o.unitPrice * (1 - promoPct)));
      o.promo = true;
    }
  }

  // Demande spéciale : ressource vendable (souvent hors thème pour variété)
  const demandCandidates = Object.values(resources || {}).filter((r) => (
    r?.id
    && !r.notSellable
    && !r.merchantOnly
    && !r.combatOnly
    && Number(r.sellPrice) > 0
    && (r.job || r.farmOnly || r.craftOnly)
  ));
  const demandRes = pickOne(rng, demandCandidates);
  const demand = demandRes
    ? {
        resourceId: demandRes.id,
        bonus: c.demandBonus,
        quota: rollDemandQuota(rng, demandRes.sellPrice),
      }
    : null;

  return {
    dateKey,
    theme: { id: theme.id, label: theme.label, emoji: theme.emoji },
    dialogue,
    promo: {
      kind: promoKind,
      label: PROMO_LABELS[promoKind] || promoKind,
      pct: promoPct,
    },
    demand,
    offers,
  };
}

function ensureVisitState(state, dateKey) {
  if (!state.travelingMerchant || state.travelingMerchant.date !== dateKey) {
    state.travelingMerchant = {
      date: dateKey,
      popupSeen: false,
      bought: {},
      soldToDemand: 0,
    };
  }
  if (!state.travelingMerchant.bought) state.travelingMerchant.bought = {};
  if (state.travelingMerchant.soldToDemand == null) state.travelingMerchant.soldToDemand = 0;
  return state.travelingMerchant;
}

export function getTravelingMerchantStatus(state, resources, balance, now = Date.now()) {
  const dateKey = getUtcDateKey(now);
  const visit = buildTravelingMerchantVisit(dateKey, resources, balance, state);
  if (!visit) {
    return {
      active: false,
      dateKey,
      visit: null,
      tomorrowRumor: isTravelingMerchantScheduled(addUtcDays(dateKey, 1), balance, state),
    };
  }

  const st = ensureVisitState(state, dateKey);
  const offers = visit.offers.map((o) => {
    const bought = Number(st.bought[o.id]) || 0;
    const remaining = Math.max(0, o.stock - bought);
    return { ...o, bought, remaining };
  });

  const sold = Number(st.soldToDemand) || 0;
  const demandRemaining = visit.demand
    ? Math.max(0, visit.demand.quota - sold)
    : 0;

  return {
    active: true,
    dateKey,
    visit: {
      ...visit,
      offers,
      demandRemaining,
      soldToDemand: sold,
    },
    popupSeen: !!st.popupSeen,
    tomorrowRumor: isTravelingMerchantScheduled(addUtcDays(dateKey, 1), balance, state),
  };
}

export function markTravelingMerchantPopupSeen(state, now = Date.now()) {
  const dateKey = getUtcDateKey(now);
  const st = ensureVisitState(state, dateKey);
  st.popupSeen = true;
  return st;
}

export function getTravelingMerchantBuyPrice(offer, quantity) {
  if (!offer || quantity <= 0) return null;
  return offer.unitPrice * quantity;
}

export function canBuyTravelingMerchantOffer(status, offerId, quantity, state) {
  if (!status?.active || !status.visit) return false;
  const offer = status.visit.offers.find((o) => o.id === offerId);
  if (!offer || quantity <= 0) return false;
  if (quantity > offer.remaining) return false;
  const price = getTravelingMerchantBuyPrice(offer, quantity);
  return price != null && (state.kirha || 0) >= price;
}

export function buyTravelingMerchantOffer(state, resources, balance, offerId, quantity, now = Date.now()) {
  const status = getTravelingMerchantStatus(state, resources, balance, now);
  if (!canBuyTravelingMerchantOffer(status, offerId, quantity, state)) {
    return { ok: false, reason: 'Achat impossible.' };
  }
  const offer = status.visit.offers.find((o) => o.id === offerId);
  const price = getTravelingMerchantBuyPrice(offer, quantity);
  const st = ensureVisitState(state, status.dateKey);
  state.kirha -= price;
  state.inventory[offer.resourceId] = (state.inventory[offer.resourceId] || 0) + quantity;
  st.bought[offer.id] = (Number(st.bought[offer.id]) || 0) + quantity;
  return {
    ok: true,
    resourceId: offer.resourceId,
    quantity,
    price,
    remaining: offer.stock - st.bought[offer.id],
  };
}

/** Prix unitaire de rachat (+20 % sur sellPrice de base). */
export function getTravelingMerchantDemandUnitPrice(resource, demandBonus = 0.2) {
  const sp = Math.max(0, Number(resource?.sellPrice) || 0);
  if (sp <= 0) return 0;
  return Math.max(1, Math.floor(sp * (1 + demandBonus)));
}

export function canSellToTravelingMerchant(status, quantity, state, resources) {
  if (!status?.active || !status.visit?.demand || quantity <= 0) return false;
  if (status.demandRemaining < quantity) return false;
  const id = status.visit.demand.resourceId;
  const res = resources?.[id];
  if (!res || res.notSellable || res.merchantOnly) return false;
  return (state.inventory[id] || 0) >= quantity;
}

export function sellToTravelingMerchant(state, resources, balance, quantity, now = Date.now()) {
  const status = getTravelingMerchantStatus(state, resources, balance, now);
  if (!canSellToTravelingMerchant(status, quantity, state, resources)) {
    return { ok: false, reason: 'Vente impossible (quota ou stock).' };
  }
  const demand = status.visit.demand;
  const res = resources[demand.resourceId];
  const unit = getTravelingMerchantDemandUnitPrice(res, demand.bonus);
  const price = unit * quantity;
  const st = ensureVisitState(state, status.dateKey);
  state.inventory[demand.resourceId] -= quantity;
  if (state.inventory[demand.resourceId] <= 0) delete state.inventory[demand.resourceId];
  state.kirha = (state.kirha || 0) + price;
  if (!state.lifetimeStats) state.lifetimeStats = {};
  state.lifetimeStats.totalEarned = (state.lifetimeStats.totalEarned || 0) + price;
  if (!state.stats) state.stats = {};
  state.stats.totalEarned = (state.stats.totalEarned || 0) + price;
  st.soldToDemand = (Number(st.soldToDemand) || 0) + quantity;
  return {
    ok: true,
    resourceId: demand.resourceId,
    quantity,
    price,
    unitPrice: unit,
    remainingQuota: Math.max(0, demand.quota - st.soldToDemand),
  };
}
