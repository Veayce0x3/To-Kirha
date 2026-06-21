/** Rareté équipement combat — stats et labels. */

export const RARITY_ORDER = ['common', 'rare', 'epic', 'mystic', 'legendary'];

export const RARITY_LABELS = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
  mystic: 'Mystique',
  legendary: 'Légendaire',
};

export const RARITY_EMOJI = {
  common: '⚪',
  rare: '🔵',
  epic: '🟣',
  mystic: '🟡',
  legendary: '🟠',
};

export const RARITY_STAT_MULT = {
  common: 1,
  rare: 1.15,
  epic: 1.32,
  mystic: 1.52,
  legendary: 1.75,
};

export function normalizeRarity(rarity) {
  return RARITY_ORDER.includes(rarity) ? rarity : 'common';
}

export function getNextRarity(rarity) {
  const idx = RARITY_ORDER.indexOf(normalizeRarity(rarity));
  if (idx < 0 || idx >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[idx + 1];
}

export function getRarityStatMult(rarity) {
  return RARITY_STAT_MULT[normalizeRarity(rarity)] ?? 1;
}

export function scaleItemStats(baseStats, rarity) {
  const mult = getRarityStatMult(rarity);
  const stats = baseStats || {};
  return {
    hp: Math.floor((stats.hp || 0) * mult),
    atk: Math.floor((stats.atk || 0) * mult),
    def: Math.floor((stats.def || 0) * mult),
  };
}

export function getInstanceRarity(instance) {
  return normalizeRarity(instance?.rarity);
}

export function rollDungeonEquipmentDrop(isBoss, balance) {
  const cfg = balance.combat?.equipmentDrops || {};
  const chance = isBoss ? (cfg.bossChance ?? 0.12) : (cfg.mobChance ?? 0.05);
  return Math.random() < chance;
}

export function getZoneDropPool(combatZoneId, combatItems) {
  return Object.values(combatItems || {}).filter(
    (item) => item.zone === combatZoneId && !item.companionOnly
  );
}

export function pickRandomDropItem(combatZoneId, combatItems) {
  const pool = getZoneDropPool(combatZoneId, combatItems);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
