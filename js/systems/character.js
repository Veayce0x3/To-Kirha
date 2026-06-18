import { resolveItemId } from './combat.js';
import { getActiveSetBonus } from './setBonus.js';
import { getSeasonLevelCap } from './prestige.js';

export function getXpForCharLevel(config, level) {
  return Math.floor(config.xpPerLevel * Math.pow(config.xpScaling, level - 1));
}

export function getBaseStats(config, level) {
  const { baseStats, statsPerLevel } = config;
  const lv = level - 1;
  return {
    hp: baseStats.hp + statsPerLevel.hp * lv,
    atk: baseStats.atk + statsPerLevel.atk * lv,
    def: baseStats.def + statsPerLevel.def * lv,
  };
}

export function getCombatStatsBreakdown(state, characterConfig, combatEquipment, combatItems, balance) {
  const level = state.character?.level || 1;
  const base = getBaseStats(characterConfig, level);
  const equipment = { hp: 0, atk: 0, def: 0 };

  for (const ref of Object.values(state.combatEquipment || {})) {
    if (!ref) continue;
    const itemId = resolveItemId(state, ref, combatItems) || ref;
    const item = combatItems[itemId];
    if (!item?.stats) continue;
    equipment.hp += item.stats.hp || 0;
    equipment.atk += item.stats.atk || 0;
    equipment.def += item.stats.def || 0;
  }

  const { bonus: setBonus, sets } = getActiveSetBonus(state, combatItems, balance);
  const total = {
    hp: base.hp + equipment.hp + setBonus.hp,
    atk: base.atk + equipment.atk + setBonus.atk,
    def: base.def + equipment.def + setBonus.def,
  };

  return { base, equipment, setBonus, sets, total };
}

export function getCombatStats(state, characterConfig, combatEquipment, combatItems, balance) {
  if (balance) {
    return getCombatStatsBreakdown(state, characterConfig, combatEquipment, combatItems, balance).total;
  }

  const level = state.character?.level || 1;
  const stats = getBaseStats(characterConfig, level);

  for (const ref of Object.values(state.combatEquipment || {})) {
    if (!ref) continue;
    const itemId = resolveItemId(state, ref, combatItems) || ref;
    const item = combatItems[itemId];
    if (!item?.stats) continue;
    stats.hp += item.stats.hp || 0;
    stats.atk += item.stats.atk || 0;
    stats.def += item.stats.def || 0;
  }

  return stats;
}

export function addCharacterXp(state, xp, characterConfig, balance) {
  if (!state.character) state.character = { level: 1, xp: 0 };
  const cap = balance ? getSeasonLevelCap('character', state, balance) : characterConfig.maxLevel;
  if (state.character.level >= cap) return null;

  state.character.xp += xp;

  while (state.character.level < Math.min(characterConfig.maxLevel, cap)) {
    const needed = getXpForCharLevel(characterConfig, state.character.level);
    if (state.character.xp < needed) break;
    state.character.xp -= needed;
    state.character.level++;
    if (state.character.level >= cap) {
      state.character.xp = Math.min(state.character.xp, Math.max(0, needed - 1));
      return { leveledUp: true, level: state.character.level, capped: true };
    }
    return { leveledUp: true, level: state.character.level };
  }
  return null;
}

export function getCharacterProgress(state, characterConfig, balance) {
  const c = state.character || { level: 1, xp: 0 };
  const cap = balance ? getSeasonLevelCap('character', state, balance) : characterConfig.maxLevel;
  const needed = getXpForCharLevel(characterConfig, c.level);
  return {
    ...c,
    needed,
    seasonCap: cap,
    atSeasonCap: c.level >= cap,
  };
}

export function getCharacterDisplayName(state, characterConfig) {
  const nick = state.character?.nickname?.trim();
  if (nick) return nick;
  return characterConfig.defaultName || 'Voyageur Sakura';
}

export function hasCharacterNickname(state) {
  return !!state.character?.nickname?.trim();
}

export function getNicknameRenameInfo(state, characterConfig) {
  const cfg = characterConfig;
  const cost = cfg.nicknameRenameCost ?? 50000;
  const cooldown = cfg.nicknameRenameCooldownMs ?? 2592000000;
  const updatedAt = state.character?.nicknameUpdatedAt || 0;
  const now = Date.now();
  const elapsed = now - updatedAt;
  const canRename = hasCharacterNickname(state)
    && elapsed >= cooldown
    && (state.kirha || 0) >= cost;

  return {
    cost,
    cooldown,
    canRename,
    hasNickname: hasCharacterNickname(state),
    daysUntilRename: canRename ? 0 : Math.ceil((cooldown - elapsed) / 86400000),
    msUntilRename: Math.max(0, cooldown - elapsed),
  };
}

export function validateNickname(raw, characterConfig) {
  const maxLen = characterConfig.nicknameMaxLength ?? 20;
  const name = (raw || '').trim();
  if (!name) return { ok: false, reason: 'Le pseudo ne peut pas être vide.' };
  if (name.length > maxLen) return { ok: false, reason: `Maximum ${maxLen} caractères.` };
  if (!/^[\p{L}\p{N}\s'_-]+$/u.test(name)) {
    return { ok: false, reason: 'Lettres, chiffres, espaces, tirets et apostrophes uniquement.' };
  }
  return { ok: true, name };
}

export function applyCharacterNickname(state, name, characterConfig, { isRename = false } = {}) {
  const check = validateNickname(name, characterConfig);
  if (!check.ok) return check;

  if (!state.character) state.character = { level: 1, xp: 0 };

  if (!hasCharacterNickname(state)) {
    state.character.nickname = check.name;
    state.character.nicknameUpdatedAt = Date.now();
    return { ok: true, firstSet: true, name: check.name };
  }

  if (!isRename) {
    return { ok: false, reason: 'Tu as déjà un pseudo. Utilise le renommage payant.' };
  }

  const info = getNicknameRenameInfo(state, characterConfig);
  if (!info.canRename) {
    if ((state.kirha || 0) < info.cost) {
      return { ok: false, reason: `Il faut ${info.cost.toLocaleString('fr-FR')} 💰 pour renommer.` };
    }
    return { ok: false, reason: `Renommage possible dans ${info.daysUntilRename} jour(s).` };
  }

  state.kirha -= info.cost;
  state.character.nickname = check.name;
  state.character.nicknameUpdatedAt = Date.now();
  return { ok: true, renamed: true, name: check.name, cost: info.cost };
}
