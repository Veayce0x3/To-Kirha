/** Clés de donjon : drop en combat rapide, consommées à l'entrée DJ. */

export const ZONE_KEY_MAP = {
  village_sakura: 'key_sakura',
  petal_forest: 'key_petal',
  jade_mountains: 'key_jade',
  mist_river: 'key_mist',
  lotus_sanctuary: 'key_lotus',
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

export function consumeDungeonKey(state, combatZoneId) {
  const keyId = getDungeonKeyId(combatZoneId);
  if (!keyId || getKeyCount(state, keyId) < 1) return false;
  state.inventory[keyId] -= 1;
  if (state.inventory[keyId] <= 0) delete state.inventory[keyId];
  return true;
}

export function grantDungeonKey(state, combatZoneId) {
  const keyId = getDungeonKeyId(combatZoneId);
  if (!keyId) return false;
  state.inventory[keyId] = (state.inventory[keyId] || 0) + 1;
  return true;
}

export function rollKeyDrop(isBoss, balance) {
  const cfg = balance.combat?.keyDrops || {};
  const chance = isBoss ? (cfg.bossChance ?? 0.08) : (cfg.mobChance ?? 0.04);
  return Math.random() < chance;
}

export function getKeyDropPreview(balance) {
  const cfg = balance.combat?.keyDrops || {};
  return {
    mobChance: cfg.mobChance ?? 0.04,
    bossChance: cfg.bossChance ?? 0.08,
  };
}
