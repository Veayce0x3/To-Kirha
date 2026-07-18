/**
 * Succès (ex-missions) — objectifs permanents, bonus cumulatifs, prérequis saison.
 */

import { canPrestige as canPrestigeBase } from './prestige.js';

export function buildDefaultAchievementState() {
  return { completed: [], progress: {}, bonuses: { kirha: 0, xp: 0, harvestSpeed: 0 } };
}

export function areAchievementsEnabled(balance) {
  return balance?.achievementsEnabled === true || balance?.questsEnabled === true;
}

/** @deprecated */
export function areQuestsEnabled(balance) {
  return areAchievementsEnabled(balance);
}

export function migrateAchievements(saved) {
  if (!saved) return buildDefaultAchievementState();
  return {
    completed: Array.isArray(saved.completed) ? [...saved.completed] : [],
    progress: { ...(saved.progress || {}) },
    bonuses: {
      kirha: saved.bonuses?.kirha || 0,
      xp: saved.bonuses?.xp || 0,
      harvestSpeed: saved.bonuses?.harvestSpeed || 0,
    },
  };
}

/** @deprecated */
export function migrateQuests(saved) {
  return migrateAchievements(saved);
}

export function buildDefaultQuestState() {
  return buildDefaultAchievementState();
}

export function getAchievementDef(achievements, id) {
  return achievements[id] || null;
}

export function getQuestDef(achievements, id) {
  return getAchievementDef(achievements, id);
}

export function isAchievementCompleted(state, id) {
  const list = state.achievements?.completed || state.quests?.completed || [];
  return list.includes(id);
}

export function isQuestCompleted(state, id) {
  return isAchievementCompleted(state, id);
}

export function getAchievementProgress(state, id) {
  return state.achievements?.progress?.[id] ?? state.quests?.progress?.[id] ?? 0;
}

export function getQuestProgress(state, id) {
  return getAchievementProgress(state, id);
}

function meetsRequirement(state, req, recipes) {
  if (!req) return true;
  if (req.bossZone) {
    return (state.bossKills?.[req.bossZone] || 0) >= (req.count || 1);
  }
  if (req.achievementId || req.questId) {
    return isAchievementCompleted(state, req.achievementId || req.questId);
  }
  if (req.zoneId) {
    return (state.unlockedZones || []).includes(req.zoneId) || state.zone === req.zoneId;
  }
  if (req.jobUnlocked) {
    const rules = state._balanceJobUnlocks;
    void rules;
    return (state.jobs?.[req.jobUnlocked]?.level || 0) >= 1;
  }
  return true;
}

export function evaluateAchievementProgress(achievement, state, recipes) {
  switch (achievement.type) {
    case 'harvest_resource':
      return getAchievementProgress(state, achievement.id);
    case 'harvest_total':
      return state.stats?.totalHarvests || state.lifetimeStats?.totalHarvests || 0;
    case 'craft_recipe':
      return (state.crafted || []).includes(achievement.recipeId) ? 1 : 0;
    case 'craft_job':
      return (state.crafted || []).some((id) => recipes[id]?.craftJob === achievement.jobId) ? 1 : 0;
    case 'craft_meal':
      return (state.crafted || []).some((id) => recipes[id]?.craftJob === 'cook') ? 1 : 0;
    case 'combat_kills':
      return state.combatKillStats?.[achievement.enemyId] || 0;
    case 'combat_total':
      return state.stats?.combatFights || state.lifetimeStats?.combatFights || 0;
    case 'boss_kill':
      return state.bossKills?.[achievement.combatZoneId] || 0;
    case 'job_level':
      return state.jobs?.[achievement.jobId]?.level || 1;
    case 'equip_weapon':
      return state.combatEquipment?.weapon ? 1 : 0;
    case 'building_unlocked':
      return state.productionLines?.farm?.[achievement.buildingId] ? 1 : 0;
    case 'job_unlocked':
      return state.productionLines?.harvest?.[achievement.jobId] ? 1 : 0;
    default:
      return getAchievementProgress(state, achievement.id);
  }
}

export function evaluateQuestProgress(achievement, state, recipes) {
  return evaluateAchievementProgress(achievement, state, recipes);
}

export function isAchievementAvailable(achievement, state, recipes) {
  if (isAchievementCompleted(state, achievement.id)) return false;
  if (achievement.requires && !meetsRequirement(state, achievement.requires, recipes)) return false;
  return true;
}

export function isQuestAvailable(achievement, state, recipes) {
  return isAchievementAvailable(achievement, state, recipes);
}

export function isAchievementReady(achievement, state, recipes) {
  if (isAchievementCompleted(state, achievement.id)) return false;
  const current = evaluateAchievementProgress(achievement, state, recipes);
  return current >= (achievement.target ?? 1);
}

export function isQuestReady(achievement, state, recipes) {
  return isAchievementReady(achievement, state, recipes);
}

export function completeAchievement(id, state) {
  if (!state.achievements) {
    state.achievements = migrateAchievements(state.quests);
    delete state.quests;
  }
  if (state.achievements.completed.includes(id)) return false;
  state.achievements.completed.push(id);
  return true;
}

export function completeQuest(id, state) {
  return completeAchievement(id, state);
}

export function incrementAchievementProgress(state, id, amount = 1) {
  if (!state.achievements) {
    state.achievements = migrateAchievements(state.quests);
    delete state.quests;
  }
  state.achievements.progress[id] = (state.achievements.progress[id] || 0) + amount;
}

export function incrementQuestProgress(state, id, amount = 1) {
  incrementAchievementProgress(state, id, amount);
}

export function getActiveAchievements(achievements, state, recipes) {
  return Object.values(achievements)
    .filter((a) => isAchievementAvailable(a, state, recipes))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getActiveQuests(achievements, state, recipes) {
  return getActiveAchievements(achievements, state, recipes);
}

export function getNextAchievement(achievements, state, recipes) {
  const active = getActiveAchievements(achievements, state, recipes);
  return active.find((a) => !isAchievementReady(a, state, recipes)) || active[0] || null;
}

export function getNextQuest(achievements, state, recipes) {
  return getNextAchievement(achievements, state, recipes);
}

export function getAchievementsByCategory(achievements, state, recipes) {
  const categories = {};
  for (const ach of Object.values(achievements)) {
    const cat = ach.category || ach.chapter || 'other';
    if (!categories[cat]) categories[cat] = { available: [], completed: [], locked: [] };
    if (isAchievementCompleted(state, ach.id)) {
      categories[cat].completed.push(ach);
    } else if (isAchievementAvailable(ach, state, recipes)) {
      categories[cat].available.push(ach);
    } else {
      categories[cat].locked.push(ach);
    }
  }
  for (const cat of Object.values(categories)) {
    cat.available.sort((a, b) => (a.order || 0) - (b.order || 0));
    cat.completed.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  return categories;
}

export function getQuestsByChapter(achievements, state, recipes) {
  return getAchievementsByCategory(achievements, state, recipes);
}

export function isChapterComplete(chapterId, achievements, state) {
  const list = Object.values(achievements).filter((a) => (a.category || a.chapter) === chapterId);
  if (list.length === 0) return true;
  return list.every((a) => isAchievementCompleted(state, a.id));
}

export const ACHIEVEMENT_CATEGORY_LABELS = {
  season_1: '🌸 Saison 1',
  season_meta: '🔄 Passage de saison',
  harvest: '🌾 Récolte',
  craft: '🔨 Artisanat',
  combat: '⚔️ Combat',
  village_sakura: '🌸 Village Sakura',
  petal_forest: '🌿 Forêt des Pétales',
  mist_river: '🌫️ Rivière de Brume',
  jade_mountains: '⛩️ Montagnes de Jade',
  lotus_sanctuary: '🪷 Sanctuaire du Lotus',
};

export const QUEST_CHAPTER_LABELS = ACHIEVEMENT_CATEGORY_LABELS;

export function getAchievementStatusText(achievement, state, recipes) {
  const current = Math.min(evaluateAchievementProgress(achievement, state, recipes), achievement.target ?? 1);
  const target = achievement.target ?? 1;
  if (isAchievementCompleted(state, achievement.id)) return '✓ Terminé';
  if (isAchievementReady(achievement, state, recipes)) return 'Prêt';
  if (['harvest_resource', 'combat_kills', 'boss_kill', 'harvest_total', 'combat_total'].includes(achievement.type)) {
    return `${current}/${target}`;
  }
  if (achievement.type === 'job_level') return `Nv.${current}/${target}`;
  return current >= target ? 'OK' : 'En cours';
}

export function getQuestStatusText(achievement, state, recipes) {
  return getAchievementStatusText(achievement, state, recipes);
}

export function getAchievementBonuses(state) {
  const b = state.achievements?.bonuses || state.quests?.bonuses || {};
  return {
    kirha: b.kirha || 0,
    xp: b.xp || 0,
    harvestSpeed: b.harvestSpeed || 0,
  };
}

export function applyAchievementRewards(state, achievement, balance) {
  if (!state.achievements) {
    state.achievements = migrateAchievements(state.quests);
    delete state.quests;
  }
  if (achievement.rewardKirha) {
    state.kirha = (state.kirha || 0) + achievement.rewardKirha;
    if (state.lifetimeStats) state.lifetimeStats.totalEarned += achievement.rewardKirha;
  }
  if (achievement.rewardScrolls) {
    state.inventory.ancient_scroll = (state.inventory.ancient_scroll || 0) + achievement.rewardScrolls;
  }
  if (achievement.rewardNuggets) {
    state.inventory.gold_nugget = (state.inventory.gold_nugget || 0) + achievement.rewardNuggets;
  }
  const bonus = achievement.rewardBonus || achievement.permanentBonus;
  if (bonus) {
    if (!state.achievements.bonuses) state.achievements.bonuses = { kirha: 0, xp: 0, harvestSpeed: 0 };
    state.achievements.bonuses.kirha += bonus.kirha || 0;
    state.achievements.bonuses.xp += bonus.xp || 0;
    state.achievements.bonuses.harvestSpeed += bonus.harvestSpeed || 0;
  }
}

export function applyQuestRewards(state, achievement, balance) {
  applyAchievementRewards(state, achievement, balance);
}

export function getCombinedBonuses(state) {
  const ach = getAchievementBonuses(state);
  const prestige = state.prestige || {};
  return {
    kirha: 1 + (prestige.kirhaBonus || 0) + ach.kirha,
    xp: 1 + (prestige.xpBonus || 0) + ach.xp,
    harvestSpeed: ach.harvestSpeed,
  };
}

export function getSeasonAchievementRequirements(balance, season) {
  const bySeason = balance?.prestige?.seasonRequirements?.[String(season)];
  return bySeason?.requireAchievements || balance?.prestige?.requireAchievements || [];
}

export function getAchievementGuidance(state, balance, achievements, recipes) {
  const next = getNextAchievement(achievements, state, recipes);
  if (next) return null;
  if (canPrestigeBase(state, balance, achievements, {})) {
    return 'Succès Saison 1 complétés — lance une Nouvelle Saison dans Options.';
  }
  return 'Consulte les succès pour préparer le passage de saison.';
}

export function getQuestGuidance(state, balance, achievements, recipes) {
  return getAchievementGuidance(state, balance, achievements, recipes);
}
