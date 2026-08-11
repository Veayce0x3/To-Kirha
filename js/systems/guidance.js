import { canPrestige, getSeasonLevelCap } from './prestige.js';
import { getNextQuest, isQuestReady, isQuestCompleted, areQuestsEnabled } from './quests.js';
import { canPayUnlockZone } from './zoneProgress.js';
import { getRecipeRequiredLevel } from './craft.js';
import { getJobEquippedTool } from './equipment.js';
import { getCombatStats } from './character.js';
import { resolveItemId } from './combat.js';
import { hasSchoolJobUnlock } from './villageSchool.js';

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
    steps: opts.steps || null,
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

  // ── Early game: guide toward first job unlock ──
  const hasLumberjack = hasSchoolJobUnlock(state, 'lumberjack');
  const farmerLevel = state.jobs?.farmer?.level || 1;

  if (!hasLumberjack && farmerLevel < 3) {
    return objective(
      'Premières récoltes',
      'Récolte du blé pour gagner de l\'XP et monter Paysan.',
      {
        hintJob: 'farmer', priority: 0, source: 'early_harvest',
        steps: [
          'Ouvre le menu → Paysan',
          'Touche une plante 🌾 pour récolter',
          'Vends ta récolte à la Place marchande 💰',
          'Recommence pour monter en niveau',
        ],
      }
    );
  }

  if (!hasLumberjack && farmerLevel >= 3) {
    return objective(
      'Débloquer Bûcheron',
      'Tu as atteint le niveau requis — débloque ton prochain métier à l\'École du Village.',
      {
        hintView: 'village_school', priority: 0, source: 'early_school',
        steps: [
          'Ouvre le menu → École du Village 🏫',
          'Choisis l\'onglet « Récolte »',
          'Lance l\'étude « Sentiers du bûcheron »',
          'Attends la fin de la recherche',
        ],
      }
    );
  }

  const nextQuest = areQuestsEnabled(balance) ? getNextQuest(quests, state, recipes) : null;
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
      'Équiper une arme',
      'Récupère une arme de combat, puis équipe-la sur ton personnage.',
      {
        hintView: 'combat', priority: 2, source: 'weapon',
        steps: [
          'Ouvre le menu → Combat ⚔️',
          'Choisis un donjon accessible',
          'Équipe ton arme depuis Perso → Équipement',
        ],
      }
    );
  }

  const gatherJobs = ['lumberjack', 'fisher', 'miner', 'farmer', 'alchemist'];
  const zoneId = state.zone || 'village_sakura';
  const missingTool = gatherJobs.find((jobId) => !getJobEquippedTool(state, jobId));
  if (missingTool && (state.jobs?.[missingTool]?.level || 1) >= 1) {
    const toolJobName = jobs[missingTool]?.name || 'métier';
    return objective(
      'Outil de récolte',
      `Fabrique un outil de ${toolJobName} pour récolter plus vite.`,
      {
        hintView: 'workshop', priority: 2, source: 'tool',
        steps: [
          'Ouvre le menu → Atelier 🛠️',
          `Choisis un outil pour ${toolJobName}`,
          'Fabrique-le avec tes ressources',
          'Il s\'équipe automatiquement',
        ],
      }
    );
  }

  const lockedRes = getLowestLockedResourceInZone(resources, zoneId, state);
  if (lockedRes) {
    const jobsCap = getSeasonLevelCap('jobs', state, balance);
    const jobLv = state.jobs?.[lockedRes.job]?.level || 1;
    if (jobLv >= jobsCap) {
      return objective(
        'Plafond de saison',
        `Plafond métiers Nv.${jobsCap} atteint — passe à la saison suivante.`,
        {
          hintView: 'season', openPrestige: true, priority: 3, source: 'season_cap',
          steps: [
            'Ouvre le menu → Saison 🌸',
            'Vérifie les prérequis de saison',
            'Lance la nouvelle saison quand tout est prêt',
          ],
        }
      );
    }
    const jobName = jobs[lockedRes.job]?.name || lockedRes.job;
    return objective(
      `Monter ${jobName}`,
      `Atteins ${jobName} Nv.${lockedRes.requiredJobLevel} pour débloquer ${lockedRes.name}.`,
      {
        hintJob: lockedRes.job, priority: 3, source: 'job_level',
        steps: [
          `Ouvre le menu → ${jobName}`,
          'Récolte pour gagner de l\'XP métier',
          'Vends à la Place marchande',
          `Objectif : Nv.${lockedRes.requiredJobLevel}`,
        ],
      }
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
        {
          hintView: 'combat', priority: 4, source: 'zone_boss',
          steps: [
            'Ouvre le menu → Combat ⚔️',
            'Choisis la zone avec le boss',
            'Bats le boss pour débloquer la suite',
          ],
        }
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
          { hintView: 'season', openPrestige: true, priority: 4, source: 'season_cap' }
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
      `Récupère ${setRecipe.emoji} ${setRecipe.name} et équipe-toi avant de pousser la zone.`,
      { hintView: 'combat', priority: 5, source: 'craft_set' }
    );
  }

  if (canPrestige(state, balance, quests, combatZones)) {
    return objective(
      'Nouvelle saison',
      `Tout est prêt — lance la Saison ${(state.season || 1) + 1} !`,
      {
        hintView: 'season', openPrestige: true, priority: 6, source: 'prestige',
        steps: [
          'Ouvre le menu → Saison 🌸',
          'Appuie sur « Nouvelle saison »',
        ],
      }
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
      { hintView: 'season', openPrestige: true, priority: 5, source: 'season_cap' }
    );
  }

  const stats = getCombatStats(state, characterConfig, combatEquipment, combatEquipment.items, balance);
  return objective(
    'Continuer l\'aventure',
    `Explore, combats et craft — ${balance.zones[zoneId]?.emoji || ''} ${balance.zones[zoneId]?.name || ''} · ⚔️ ${stats.atk} ATK.`,
    { hintView: 'world', priority: 7, source: 'explore' }
  );
}
