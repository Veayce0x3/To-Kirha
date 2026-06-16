import { canPrestige, getSeasonLevelCap } from './prestige.js';
import { getNextQuest, isQuestReady, isQuestCompleted } from './quests.js';
import { canPayUnlockZone } from './zoneProgress.js';
import { getRecipeRequiredLevel } from './craft.js';
import { getJobEquippedTool } from './equipment.js';
import { getCombatStats } from './character.js';

const ZONE_ORDER = ['village_sakura', 'petal_forest', 'mist_river', 'jade_mountains', 'lotus_sanctuary'];

const SET_PREFIX_BY_ZONE = {
  village_sakura: 'set_sakura',
  petal_forest: 'set_petal',
  jade_mountains: 'set_jade',
};

function objective(title, description, opts = {}) {
  return {
    title,
    description,
    hintView: opts.hintView || null,
    hintJob: opts.hintJob || null,
    openPrestige: opts.openPrestige || false,
    priority: opts.priority ?? 5,
    source: opts.source || 'guidance',
  };
}

function getLowestLockedResourceInZone(resources, zoneId, state) {
  const list = Object.values(resources)
    .filter((r) => r.zone === zoneId && !r.craftOnly && !r.combatOnly && r.job)
    .sort((a, b) => (a.requiredJobLevel || 1) - (b.requiredJobLevel || 1));

  for (const res of list) {
    const jobLv = state.jobs?.[res.job]?.level || 1;
    if (jobLv < (res.requiredJobLevel || 1)) {
      return res;
    }
  }
  return null;
}

function findMissingSetRecipe(zoneId, state, recipes, combatEquipment) {
  const prefix = SET_PREFIX_BY_ZONE[zoneId];
  if (!prefix) return null;

  const owned = new Set(state.ownedCombatItems || []);
  const equipped = new Set(Object.values(state.combatEquipment || {}).filter(Boolean));

  for (const [recipeId, recipe] of Object.entries(recipes)) {
    if (!recipe.combatItem?.startsWith(prefix)) continue;
    const itemId = recipe.combatItem;
    const already = [...owned, ...equipped].some((ref) => {
      const id = resolveItemId(state, ref, combatEquipment.items) || ref;
      return id === itemId;
    });
    if (!already) return recipe;
  }
  return null;
}

export function getCombatZoneRecommendation(combatZone, enemies, balance) {
  const bossId = combatZone?.boss?.enemyId;
  const boss = bossId ? enemies[bossId] : null;
  const recAtk = boss ? Math.max(8, (boss.def || 0) + 4) : null;
  const recHp = boss ? Math.max(40, Math.floor((boss.atk || 0) * 3)) : null;
  return {
    charLevel: combatZone?.requiredCharLevel || 1,
    recommendedAtk: recAtk,
    recommendedHp: recHp,
    bossName: combatZone?.boss?.name,
  };
}

export function getCurrentObjective(ctx) {
  const {
    state,
    balance,
    quests,
    recipes,
    resources,
    combatZones,
    combatEquipment,
    characterConfig,
    jobs,
  } = ctx;

  const nextQuest = getNextQuest(quests, state, recipes);
  if (nextQuest && !isQuestCompleted(state, nextQuest.id)) {
    return objective(nextQuest.title, nextQuest.description, {
      hintView: nextQuest.hintView,
      hintJob: nextQuest.hintJob,
      priority: 1,
      source: 'quest',
    });
  }

  if (!state.combatEquipment?.weapon) {
    return objective(
      'Forger une arme',
      'Va à l\'Atelier et fabrique une arme, puis équipe-la sur ton personnage.',
      { hintView: 'workshop', priority: 2, source: 'weapon' }
    );
  }

  const gatherJobs = ['lumberjack', 'fisher', 'miner', 'farmer', 'alchemist'];
  const zoneId = state.zone || 'village_sakura';
  const missingTool = gatherJobs.find((jobId) => !getJobEquippedTool(state, jobId));
  if (missingTool && (state.jobs?.[missingTool]?.level || 1) >= 1) {
    return objective(
      'Outil de récolte',
      `Fabrique un outil de ${jobs[missingTool]?.name || 'métier'} à l'Outilleur pour récolter plus efficacement.`,
      { hintView: 'workshop', priority: 2, source: 'tool' }
    );
  }

  const lockedRes = getLowestLockedResourceInZone(resources, zoneId, state);
  if (lockedRes) {
    const jobsCap = getSeasonLevelCap('jobs', state, balance);
    const jobLv = state.jobs?.[lockedRes.job]?.level || 1;
    if (jobLv >= jobsCap) {
      return objective(
        'Plafond de saison',
        `Plafond métiers Nv.${jobsCap} atteint — passe à la Saison ${(state.season || 1) + 1} pour progresser.`,
        { hintView: 'options', openPrestige: true, priority: 3, source: 'season_cap' }
      );
    }
    const jobName = jobs[lockedRes.job]?.name || lockedRes.job;
    return objective(
      `Monter ${jobName}`,
      `Atteins ${jobName} Nv.${lockedRes.requiredJobLevel} pour débloquer ${lockedRes.name} en ${balance.zones[zoneId]?.name || 'cette zone'}.`,
      { hintJob: lockedRes.job, priority: 3, source: 'job_level' }
    );
  }

  for (const zId of ZONE_ORDER) {
    if (zId === 'village_sakura') continue;
    const check = canPayUnlockZone(zId, state, balance, combatZones);
    if (!check.ok && check.reason?.includes('Vaincre')) {
      const req = balance.zoneBossUnlocks?.[zId];
      const cz = req?.bossCombatZone ? combatZones[req.bossCombatZone] : null;
      return objective(
        'Débloquer une zone',
        check.reason || `Vaincs le boss pour ouvrir ${balance.zones[zId]?.name || zId}.`,
        { hintView: 'combat', priority: 4, source: 'zone_boss' }
      );
    }
  }

  const charLevel = state.character?.level || 1;
  for (const cz of Object.values(combatZones || {})) {
    if (!state.unlockedZones?.includes(cz.zone)) continue;
    if (charLevel < (cz.requiredCharLevel || 1)) {
      const charCap = getSeasonLevelCap('character', state, balance);
      if (charLevel >= charCap) {
        return objective(
          'Plafond de saison',
          `Plafond perso Nv.${charCap} atteint — passe à la Saison ${(state.season || 1) + 1} pour progresser.`,
          { hintView: 'options', openPrestige: true, priority: 4, source: 'season_cap' }
        );
      }
      return objective(
        'Niveau personnage',
        `Monte ton personnage au Nv.${cz.requiredCharLevel} pour accéder à ${cz.name}.`,
        { hintView: 'combat', priority: 4, source: 'char_level' }
      );
    }
  }

  const setRecipe = findMissingSetRecipe(zoneId, state, recipes, combatEquipment);
  if (setRecipe) {
    return objective(
      'Compléter ton équipement',
      `Fabrique ${setRecipe.emoji} ${setRecipe.name} à l'Atelier pour cette zone.`,
      { hintView: 'workshop', priority: 5, source: 'craft_set' }
    );
  }

  if (canPrestige(state, balance, quests, combatZones)) {
    return objective(
      'Nouvelle saison',
      `Tout est prêt — lance la Saison ${(state.season || 1) + 1} dans Options.`,
      { hintView: 'options', openPrestige: true, priority: 6, source: 'prestige' }
    );
  }

  const charCap = getSeasonLevelCap('character', state, balance);
  const jobsCap = getSeasonLevelCap('jobs', state, balance);
  const charAtCap = (state.character?.level || 1) >= charCap;
  const jobsAtCap = gatherJobs.some((j) => (state.jobs?.[j]?.level || 1) >= jobsCap);

  if (charAtCap || jobsAtCap) {
    const capParts = [];
    if (charAtCap) capParts.push(`perso Nv.${charCap}`);
    if (jobsAtCap) capParts.push(`métiers Nv.${jobsCap}`);
    return objective(
      'Plafond de saison',
      `Plafond Saison ${state.season || 1} atteint (${capParts.join(' · ')}). Termine les prérequis puis passe à la Saison ${(state.season || 1) + 1}.`,
      { hintView: 'options', openPrestige: true, priority: 5, source: 'season_cap' }
    );
  }

  const stats = getCombatStats(state, characterConfig, combatEquipment, combatEquipment.items, balance);
  return objective(
    'Continuer l\'aventure',
    `Explore, combats et craft — ${balance.zones[zoneId]?.emoji || ''} ${balance.zones[zoneId]?.name || ''} · ⚔️ ${stats.atk} ATK.`,
    { hintView: 'world', priority: 7, source: 'explore' }
  );
}
