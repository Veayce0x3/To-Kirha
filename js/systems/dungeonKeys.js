/** Clés de donjon : drop en combat rapide, consommées à l'entrée DJ (+ qualité Option A). */

export const ZONE_KEY_MAP = {
  village_sakura: 'key_sakura',
  petal_forest: 'key_petal',
  jade_mountains: 'key_jade',
  mist_river: 'key_mist',
  lotus_sanctuary: 'key_lotus',
};

export const KEY_QUALITIES = ['bronze', 'silver', 'gold', 'mystic'];

export const KEY_QUALITY_META = {
  bronze: { id: 'bronze', label: 'Bronze', emoji: '🥉' },
  silver: { id: 'silver', label: 'Argent', emoji: '🩶' },
  gold: { id: 'gold', label: 'Or', emoji: '🥇' },
  mystic: { id: 'mystic', label: 'Mystique', emoji: '💜' },
};

export function getDungeonKeyId(combatZoneId) {
  return ZONE_KEY_MAP[combatZoneId] || null;
}

export function getKeyCount(state, keyId) {
  if (!keyId) return 0;
  return state.inventory?.[keyId] || 0;
}

export function hasDungeonKey(state, combatZoneId) {
  const keyId = getDungeonKeyId(combatZoneId);
  return getKeyCount(state, keyId) >= 1;
}

export function ensureKeyQualities(state) {
  if (!state.keyQualities || typeof state.keyQualities !== 'object') {
    state.keyQualities = {};
  }
  return state.keyQualities;
}

/** Réconcilie inventaire ↔ stocks par qualité (surplus → bronze). */
export function syncKeyQualities(state) {
  const bag = ensureKeyQualities(state);
  for (const keyId of Object.values(ZONE_KEY_MAP)) {
    const total = getKeyCount(state, keyId);
    if (!bag[keyId] || typeof bag[keyId] !== 'object') {
      bag[keyId] = { bronze: 0, silver: 0, gold: 0, mystic: 0 };
    }
    const q = bag[keyId];
    for (const tier of KEY_QUALITIES) {
      q[tier] = Math.max(0, Math.floor(Number(q[tier]) || 0));
    }
    let sum = KEY_QUALITIES.reduce((a, t) => a + q[t], 0);
    if (sum < total) q.bronze += total - sum;
    while (sum > total) {
      for (const tier of [...KEY_QUALITIES].reverse()) {
        if (q[tier] > 0 && sum > total) {
          q[tier] -= 1;
          sum -= 1;
        }
      }
      if (KEY_QUALITIES.every((t) => q[t] <= 0)) break;
    }
  }
  return bag;
}

export function getKeyQualityCounts(state, combatZoneId) {
  syncKeyQualities(state);
  const keyId = getDungeonKeyId(combatZoneId);
  if (!keyId) return { bronze: 0, silver: 0, gold: 0, mystic: 0 };
  return { ...(state.keyQualities[keyId] || { bronze: 0, silver: 0, gold: 0, mystic: 0 }) };
}

export function getAvailableKeyQualities(state, combatZoneId) {
  const counts = getKeyQualityCounts(state, combatZoneId);
  return KEY_QUALITIES.filter((q) => (counts[q] || 0) > 0);
}

function rollQualityTier(balance, isBoss = false) {
  const weights = balance?.combat?.keyQuality?.dropWeights || {
    bronze: 70,
    silver: 22,
    gold: 7,
    mystic: 1,
  };
  const bossBoost = isBoss ? (balance?.combat?.keyQuality?.bossWeightBoost || {}) : {};
  const entries = KEY_QUALITIES.map((id) => ({
    id,
    w: Math.max(0, (Number(weights[id]) || 0) + (Number(bossBoost[id]) || 0)),
  }));
  const total = entries.reduce((a, e) => a + e.w, 0) || 1;
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.w;
    if (r <= 0) return e.id;
  }
  return 'bronze';
}

export function consumeDungeonKey(state, combatZoneId, quality = 'bronze') {
  const keyId = getDungeonKeyId(combatZoneId);
  if (!keyId || getKeyCount(state, keyId) < 1) return false;
  syncKeyQualities(state);
  const q = state.keyQualities[keyId];
  const tier = KEY_QUALITIES.includes(quality) ? quality : 'bronze';
  if ((q[tier] || 0) < 1) {
    // Fallback : consommer la meilleure qualité dispo
    const fallback = [...KEY_QUALITIES].reverse().find((t) => (q[t] || 0) > 0)
      || KEY_QUALITIES.find((t) => (q[t] || 0) > 0);
    if (!fallback) return false;
    q[fallback] -= 1;
  } else {
    q[tier] -= 1;
  }
  state.inventory[keyId] -= 1;
  if (state.inventory[keyId] <= 0) delete state.inventory[keyId];
  return true;
}

export function grantDungeonKey(state, combatZoneId, balance = null, isBoss = false) {
  const keyId = getDungeonKeyId(combatZoneId);
  if (!keyId) return false;
  const quality = rollQualityTier(balance, isBoss);
  syncKeyQualities(state);
  if (!state.keyQualities[keyId]) {
    state.keyQualities[keyId] = { bronze: 0, silver: 0, gold: 0, mystic: 0 };
  }
  state.keyQualities[keyId][quality] = (state.keyQualities[keyId][quality] || 0) + 1;
  state.inventory[keyId] = (state.inventory[keyId] || 0) + 1;
  return { ok: true, keyId, quality };
}

export function getKeyDropChance(zoneId, isBoss, combatZones, balance) {
  const zoneRates = combatZones?.[zoneId]?.dropRates || {};
  const cfg = balance.combat?.keyDrops || {};
  if (isBoss) return zoneRates.keyBoss ?? cfg.bossChance ?? 0.08;
  return zoneRates.keyMob ?? cfg.mobChance ?? 0.04;
}

export function rollKeyDrop(isBoss, balance, zoneId = null, combatZones = null) {
  const chance = zoneId && combatZones
    ? getKeyDropChance(zoneId, isBoss, combatZones, balance)
    : (() => {
      const cfg = balance.combat?.keyDrops || {};
      return isBoss ? (cfg.bossChance ?? 0.08) : (cfg.mobChance ?? 0.04);
    })();
  return Math.random() < chance;
}

export function getKeyDropPreview(balance, zoneId = null, combatZones = null) {
  return {
    mobChance: zoneId && combatZones
      ? getKeyDropChance(zoneId, false, combatZones, balance)
      : (balance.combat?.keyDrops?.mobChance ?? 0.04),
    bossChance: zoneId && combatZones
      ? getKeyDropChance(zoneId, true, combatZones, balance)
      : (balance.combat?.keyDrops?.bossChance ?? 0.08),
  };
}

/** Ouvre le coffre de fin de donjon selon la qualité de clé. */
export function openDungeonChest(state, quality, balance, combatItems, zoneId, grantCombatItemFn) {
  const tier = KEY_QUALITIES.includes(quality) ? quality : 'bronze';
  const cfg = balance?.combat?.keyQuality?.chest?.[tier] || balance?.combat?.keyQuality?.chest?.bronze || {};
  const loot = {
    quality: tier,
    nuggets: 0,
    scrolls: 0,
    equipment: [],
  };

  const nugMin = Number(cfg.nuggetsMin) || 0;
  const nugMax = Number(cfg.nuggetsMax) || nugMin;
  loot.nuggets = nugMin + Math.floor(Math.random() * Math.max(1, nugMax - nugMin + 1));
  if (loot.nuggets > 0) {
    state.inventory.gold_nugget = (state.inventory.gold_nugget || 0) + loot.nuggets;
  }

  if (Math.random() < (Number(cfg.scrollChance) || 0)) {
    loot.scrolls = 1;
    state.inventory.ancient_scroll = (state.inventory.ancient_scroll || 0) + 1;
  }

  if (Math.random() < (Number(cfg.equipChance) || 0) && typeof grantCombatItemFn === 'function') {
    const rarityWeights = cfg.equipRarityWeights || { common: 70, uncommon: 25, rare: 5 };
    const rarity = weightedPick(rarityWeights) || 'common';
    const pool = Object.values(combatItems || {}).filter((it) => {
      if (!it?.id || it.companionOnly) return false;
      if (it.set && zoneId) {
        // Prefer zone set if marked
        return true;
      }
      return !!it.slot;
    });
    if (pool.length) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      const ref = grantCombatItemFn(state, item.id, combatItems, rarity);
      if (ref) {
        loot.equipment.push({
          itemId: item.id,
          name: item.name,
          emoji: item.emoji,
          rarity,
          ref,
        });
      }
    }
  }

  return loot;
}

function weightedPick(weights) {
  const entries = Object.entries(weights || {});
  const total = entries.reduce((a, [, w]) => a + (Number(w) || 0), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const [id, w] of entries) {
    r -= Number(w) || 0;
    if (r <= 0) return id;
  }
  return entries[0]?.[0] || null;
}
