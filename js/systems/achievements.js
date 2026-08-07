/**
 * Succès (ex-missions) — objectifs permanents, bonus cumulatifs, prérequis saison.
 */

import { canPrestige as canPrestigeBase } from './prestige.js';

export function buildDefaultAchievementState() {
  return {
    completed: [],
    progress: {},
    bonuses: {
      kirha: 0,
      xp: 0,
      harvestSpeed: 0,
      yield: 0,
      farmExtraYield: 0,
      farmFeedDiscount: 0,
      farmAnimalLife: 0,
    },
  };
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
      yield: saved.bonuses?.yield || 0,
      farmExtraYield: saved.bonuses?.farmExtraYield || 0,
      farmFeedDiscount: saved.bonuses?.farmFeedDiscount || 0,
      farmAnimalLife: saved.bonuses?.farmAnimalLife || 0,
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
    case 'farm_building':
      return getAchievementProgress(state, achievement.id);
    case 'harvest_total':
      // Uniquement la partie en cours (jamais lifetime — sinon un reset revalide les succès)
      return Math.max(0, Number(state.stats?.totalHarvests) || 0);
    case 'craft_recipe':
      return (state.crafted || []).includes(achievement.recipeId) ? 1 : 0;
    case 'craft_job':
      return (state.crafted || []).some((id) => recipes[id]?.craftJob === achievement.jobId) ? 1 : 0;
    case 'craft_meal': {
      if ((state.stats?.mealsCrafted || 0) > 0) return 1;
      if ((state.crafted || []).some((id) => {
        const job = recipes[id]?.craftJob;
        return job === 'cook' || job === 'baker' || job === 'fishmonger' || job === 'chemist';
      })) return 1;
      // Rétrocompat : repas déjà en inventaire avant le correctif
      return Object.keys(state.inventory || {}).some(
        (id) => (id.startsWith('meal_') || id.startsWith('elixir_')) && (state.inventory[id] || 0) > 0
      ) ? 1 : 0;
    }
    case 'combat_kills':
      return state.combatKillStats?.[achievement.enemyId] || 0;
    case 'combat_total':
      return Math.max(0, Number(state.stats?.combatFights) || 0);
    case 'boss_kill':
      return state.bossKills?.[achievement.combatZoneId] || 0;
    case 'boss_kills_total':
      return Object.values(state.bossKills || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    case 'dungeon_clears':
      return Object.values(state.dungeonClears || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    case 'meals_crafted':
      return Math.max(0, Number(state.stats?.mealsCrafted) || 0);
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

/**
 * Regroupe les succès en chaînes linéaires via requires.achievementId
 * (ex. Apprenti → Disciple → Maître).
 * @returns {Array<{ rootId: string, category: string, items: object[] }>}
 */
export function getAchievementChains(achievements) {
  const list = Object.values(achievements || {}).filter((a) => a && !a.hidden);
  const byId = Object.fromEntries(list.map((a) => [a.id, a]));
  const childrenOf = {};
  for (const a of list) {
    const req = a.requires?.achievementId || a.requires?.questId;
    if (req && byId[req]) {
      (childrenOf[req] ||= []).push(a);
    }
  }
  for (const kids of Object.values(childrenOf)) {
    kids.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  const used = new Set();
  const chains = [];

  const walkFrom = (start) => {
    if (!start || used.has(start.id)) return;
    const items = [];
    let cur = start;
    while (cur && !used.has(cur.id)) {
      items.push(cur);
      used.add(cur.id);
      const kids = childrenOf[cur.id] || [];
      const next = kids.find((k) => !used.has(k.id));
      if (kids.length === 1 && next) {
        cur = next;
      } else {
        // Branche multiple : on s’arrête ; les autres enfants seront des racines de chaînes
        break;
      }
    }
    if (items.length) {
      chains.push({
        rootId: items[0].id,
        category: items[0].category || items[0].chapter || 'other',
        items,
      });
    }
    // Enfants non pris (branchements)
    const last = items[items.length - 1];
    if (last) {
      for (const kid of childrenOf[last.id] || []) {
        if (!used.has(kid.id)) walkFrom(kid);
      }
    }
  };

  const roots = list
    .filter((a) => {
      const req = a.requires?.achievementId || a.requires?.questId;
      return !req || !byId[req];
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  for (const root of roots) walkFrom(root);
  // Orphelins (au cas où)
  for (const a of list) {
    if (!used.has(a.id)) walkFrom(a);
  }

  return chains;
}

export function findAchievementChain(achievements, achievementId) {
  return getAchievementChains(achievements).find((c) => c.items.some((a) => a.id === achievementId)) || null;
}

/** Focus UI : rootId → achievementId affiché (clic « suite » / après déblocage). */
const achievementChainFocus = new Map();

export function clearAchievementChainFocus() {
  achievementChainFocus.clear();
}

export function focusAchievementInChain(achievements, achievementId) {
  const chain = findAchievementChain(achievements, achievementId);
  if (!chain) return false;
  achievementChainFocus.set(chain.rootId, achievementId);
  return true;
}

export function advanceAchievementChainFocus(chain, fromAchievementId) {
  if (!chain?.items?.length) return false;
  const currentId = fromAchievementId || achievementChainFocus.get(chain.rootId);
  const idx = chain.items.findIndex((a) => a.id === currentId);
  const from = idx >= 0 ? idx : 0;
  if (from >= chain.items.length - 1) return false;
  achievementChainFocus.set(chain.rootId, chain.items[from + 1].id);
  return true;
}

/**
 * Succès à afficher pour une chaîne : focus manuel, sinon premier non terminé, sinon le dernier.
 */
export function getDisplayedAchievementForChain(chain, state) {
  if (!chain?.items?.length) return null;
  const focusedId = achievementChainFocus.get(chain.rootId);
  if (focusedId) {
    const focused = chain.items.find((a) => a.id === focusedId);
    if (focused) return focused;
  }
  const next = chain.items.find((a) => !isAchievementCompleted(state, a.id));
  return next || chain.items[chain.items.length - 1];
}

export function getAchievementChainStepLabel(chain, achievement) {
  if (!chain || chain.items.length <= 1 || !achievement) return '';
  const idx = chain.items.findIndex((a) => a.id === achievement.id);
  if (idx < 0) return '';
  return `${idx + 1}/${chain.items.length}`;
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
  farm: '🐄 Ferme',
  craft: '🔨 Artisanat',
  cuisine: '🍳 Cuisine',
  combat: '⚔️ Combat',
  village_sakura: '🌸 Village de To-Kirha',
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
  if (isAchievementReady(achievement, state, recipes)) return 'À récupérer';
  if (['harvest_resource', 'farm_building', 'combat_kills', 'boss_kill', 'boss_kills_total', 'dungeon_clears', 'harvest_total', 'combat_total', 'meals_crafted'].includes(achievement.type)) {
    return `${current}/${target}`;
  }
  if (achievement.type === 'job_level') return `Nv.${current}/${target}`;
  return current >= target ? 'OK' : 'En cours';
}

export function formatAchievementRewardText(achievement) {
  if (!achievement) return '';
  const bits = [];
  if (achievement.rewardKirha) bits.push(`+${achievement.rewardKirha} 💰`);
  if (achievement.rewardScrolls) bits.push(`+${achievement.rewardScrolls} parchemin${achievement.rewardScrolls > 1 ? 's' : ''}`);
  if (achievement.rewardNuggets) bits.push(`+${achievement.rewardNuggets} pépite${achievement.rewardNuggets > 1 ? 's' : ''}`);
  const bonus = achievement.rewardBonus || achievement.permanentBonus;
  if (bonus) {
    if (bonus.kirha) bits.push(`+${(bonus.kirha * 100).toFixed(0)}% Kirha`);
    if (bonus.xp) bits.push(`+${(bonus.xp * 100).toFixed(0)}% XP`);
    if (bonus.harvestSpeed) bits.push(`−${(bonus.harvestSpeed * 100).toFixed(0)}% repousse`);
    if (bonus.yield) bits.push(`+${(bonus.yield * 100).toFixed(0)}% rendement`);
    if (bonus.farmExtraYield) bits.push(`+${(bonus.farmExtraYield * 100).toFixed(0)}% prod. ferme`);
    if (bonus.farmFeedDiscount) bits.push(`−${(bonus.farmFeedDiscount * 100).toFixed(0)}% nourriture`);
    if (bonus.farmAnimalLife) bits.push(`+${(bonus.farmAnimalLife * 100).toFixed(0)}% vie animal`);
  }
  return bits.length ? bits.join(' · ') : '';
}

export function countClaimableAchievements(achievements, state, recipes) {
  return Object.values(achievements || {}).filter((a) => {
    if (!a || a.hidden) return false;
    return isAchievementReady(a, state, recipes);
  }).length;
}

export function claimAchievement(id, state, achievements, balance, recipes) {
  const achievement = achievements?.[id];
  if (!achievement) return { ok: false, reason: 'Succès introuvable.' };
  if (isAchievementCompleted(state, id)) return { ok: false, reason: 'Déjà récupéré.' };
  if (!isAchievementReady(achievement, state, recipes)) {
    return { ok: false, reason: 'Objectif pas encore atteint.' };
  }
  if (!completeAchievement(id, state)) return { ok: false, reason: 'Impossible de valider.' };
  applyAchievementRewards(state, achievement, balance);
  return { ok: true, achievement };
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
    yield: b.yield || 0,
    farmExtraYield: b.farmExtraYield || 0,
    farmFeedDiscount: b.farmFeedDiscount || 0,
    farmAnimalLife: b.farmAnimalLife || 0,
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
    if (!state.achievements.bonuses) {
      state.achievements.bonuses = {
        kirha: 0,
        xp: 0,
        harvestSpeed: 0,
        yield: 0,
        farmExtraYield: 0,
        farmFeedDiscount: 0,
        farmAnimalLife: 0,
      };
    }
    state.achievements.bonuses.kirha += bonus.kirha || 0;
    state.achievements.bonuses.xp += bonus.xp || 0;
    state.achievements.bonuses.harvestSpeed += bonus.harvestSpeed || 0;
    state.achievements.bonuses.yield += bonus.yield || 0;
    state.achievements.bonuses.farmExtraYield += bonus.farmExtraYield || 0;
    state.achievements.bonuses.farmFeedDiscount += bonus.farmFeedDiscount || 0;
    state.achievements.bonuses.farmAnimalLife += bonus.farmAnimalLife || 0;
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
    jobXp: 1 + (prestige.jobXpBonus || 0) + ach.xp,
    harvestSpeed: ach.harvestSpeed,
    yield: ach.yield,
    regrowthSpeed: (prestige.regrowthSpeedBonus || 0) + (ach.harvestSpeed || 0),
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
    return 'Succès Saison 1 complétés — lance une Nouvelle Saison dans l’onglet Saison.';
  }
  return 'Consulte les succès pour préparer le passage de saison.';
}

export function getQuestGuidance(state, balance, achievements, recipes) {
  return getAchievementGuidance(state, balance, achievements, recipes);
}
