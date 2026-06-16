import { canPrestige } from './prestige.js';

export function buildDefaultQuestState() {
  return { completed: [], progress: {} };
}

export function migrateQuests(saved) {
  if (!saved) return buildDefaultQuestState();
  return {
    completed: Array.isArray(saved.completed) ? [...saved.completed] : [],
    progress: { ...(saved.progress || {}) },
  };
}

export function getQuestDef(quests, questId) {
  return quests[questId] || null;
}

export function isQuestCompleted(state, questId) {
  return (state.quests?.completed || []).includes(questId);
}

export function isChapterComplete(chapterId, quests, state) {
  const list = Object.values(quests).filter((q) => q.chapter === chapterId);
  if (list.length === 0) return true;
  return list.every((q) => isQuestCompleted(state, q.id));
}

export function getQuestProgress(state, questId) {
  return state.quests?.progress?.[questId] || 0;
}

function meetsRequirement(state, req, recipes) {
  if (!req) return true;
  if (req.bossZone) {
    return (state.bossKills?.[req.bossZone] || 0) >= (req.count || 1);
  }
  if (req.questId) return isQuestCompleted(state, req.questId);
  if (req.zoneId) {
    return (state.unlockedZones || []).includes(req.zoneId)
      || state.zone === req.zoneId;
  }
  return true;
}

export function isQuestAvailable(quest, state, recipes) {
  if (isQuestCompleted(state, quest.id)) return false;
  if (quest.requires && !meetsRequirement(state, quest.requires, recipes)) return false;
  return true;
}

export function evaluateQuestProgress(quest, state, recipes) {
  switch (quest.type) {
    case 'harvest_resource':
      return getQuestProgress(state, quest.id);
    case 'harvest_total':
      return state.stats?.totalHarvests || 0;
    case 'craft_recipe':
      return (state.crafted || []).includes(quest.recipeId) ? 1 : 0;
    case 'craft_job':
      return (state.crafted || []).some((id) => recipes[id]?.craftJob === quest.jobId) ? 1 : 0;
    case 'combat_kills':
      return state.combatKillStats?.[quest.enemyId] || 0;
    case 'boss_kill':
      return state.bossKills?.[quest.combatZoneId] || 0;
    case 'job_level':
      return state.jobs?.[quest.jobId]?.level || 1;
    case 'equip_weapon':
      return state.combatEquipment?.weapon ? 1 : 0;
    case 'companion_party':
      return Object.values(state.companions || {}).filter(
        (c) => c?.unlocked && c.activeInParty !== false
      ).length;
    case 'companion_equipped':
      return Object.values(state.companions || {}).some((c) => {
        if (!c?.unlocked) return false;
        return !!(c.equipment?.weapon || c.equipment?.companion_armor);
      }) ? 1 : 0;
    default:
      return getQuestProgress(state, quest.id);
  }
}

export function isQuestReady(quest, state, recipes) {
  if (isQuestCompleted(state, quest.id)) return false;
  const current = evaluateQuestProgress(quest, state, recipes);
  const target = quest.target ?? 1;
  return current >= target;
}

export function completeQuest(questId, state) {
  if (!state.quests) state.quests = buildDefaultQuestState();
  if (state.quests.completed.includes(questId)) return false;
  state.quests.completed.push(questId);
  return true;
}

export function incrementQuestProgress(state, questId, amount = 1) {
  if (!state.quests) state.quests = buildDefaultQuestState();
  state.quests.progress[questId] = (state.quests.progress[questId] || 0) + amount;
}

export function getActiveQuests(quests, state, recipes) {
  return Object.values(quests)
    .filter((q) => isQuestAvailable(q, state, recipes))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getNextQuest(quests, state, recipes) {
  const active = getActiveQuests(quests, state, recipes);
  return active.find((q) => !isQuestReady(q, state, recipes)) || active[0] || null;
}

export function getQuestsByChapter(quests, state, recipes) {
  const chapters = {};
  for (const quest of Object.values(quests)) {
    const chapter = quest.chapter || 'other';
    if (!chapters[chapter]) chapters[chapter] = { available: [], completed: [], locked: [] };
    if (isQuestCompleted(state, quest.id)) {
      chapters[chapter].completed.push(quest);
    } else if (isQuestAvailable(quest, state, recipes)) {
      chapters[chapter].available.push(quest);
    } else {
      chapters[chapter].locked.push(quest);
    }
  }
  for (const chapter of Object.values(chapters)) {
    chapter.available.sort((a, b) => (a.order || 0) - (b.order || 0));
    chapter.completed.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  return chapters;
}

export const QUEST_CHAPTER_LABELS = {
  village_sakura: '🌸 Village Sakura',
  petal_forest: '🌿 Forêt des Pétales',
  mist_river: '🌫️ Rivière de Brume',
  jade_mountains: '⛩️ Montagnes de Jade',
  lotus_sanctuary: '🪷 Sanctuaire du Lotus',
};

export function getQuestGuidance(state, balance, quests, recipes) {
  const next = getNextQuest(quests, state, recipes);
  if (next) return null;

  if (canPrestige(state, balance)) {
    return 'Toutes les missions sont terminées — lance une Nouvelle Saison dans Options.';
  }
  const zones = Object.values(balance.zones || {});
  const nextZone = zones.find((z) => !(state.unlockedZones || []).includes(z.id) && !z.unlocked);
  if (nextZone) {
    return `Continue l'exploration : prochaine zone ${nextZone.emoji} ${nextZone.name}.`;
  }
  return 'Explore, craft et combats pour progresser.';
}

export function getQuestStatusText(quest, state, recipes) {
  const current = Math.min(evaluateQuestProgress(quest, state, recipes), quest.target ?? 1);
  const target = quest.target ?? 1;
  if (isQuestCompleted(state, quest.id)) return 'Terminée';
  if (isQuestReady(quest, state, recipes)) return 'Prête à valider';
  if (quest.type === 'harvest_resource' || quest.type === 'combat_kills' || quest.type === 'boss_kill') {
    return `${current}/${target}`;
  }
  if (quest.type === 'job_level') return `Nv.${current}/${target}`;
  return current >= target ? 'OK' : 'En cours';
}

export function applyQuestRewards(state, quest, balance) {
  if (quest.rewardKirha) {
    state.kirha = (state.kirha || 0) + quest.rewardKirha;
    if (state.lifetimeStats) state.lifetimeStats.totalEarned += quest.rewardKirha;
  }
  if (quest.rewardScrolls) {
    state.inventory.ancient_scroll = (state.inventory.ancient_scroll || 0) + quest.rewardScrolls;
  }
  if (quest.rewardNuggets) {
    state.inventory.gold_nugget = (state.inventory.gold_nugget || 0) + quest.rewardNuggets;
  }
}
