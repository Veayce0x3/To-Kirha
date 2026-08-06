import {
  migrateSlotsToProductionLines,
  getMaxUnitsPerResource,
  getJobHarvestResources,
  ensureProductionLines,
} from '../systems/productionLines.js';
import { clearProgressionCache } from '../systems/progression.js';
import { isJobUnlocked } from '../systems/jobUnlock.js';
import { migrateAchievements } from '../systems/achievements.js';
import { migrateBreederXpToBuildings } from '../systems/farmProgress.js';

/**
 * Remap one-shot inventaire / lignes (anciens ids → liste 10×5).
 * Une seule passe sur les clés d'origine (évite les collisions chene/fer/dorade…).
 */
const GATHERING_ID_REWRITE = {
  // Proto
  sakura_wood: 'frene',
  herbs: 'pissenlit',
  petal_wood: 'chene',
  fish: 'dorade',
  sakura_carp: 'naso',
  jade_ore: 'pierre',
  moon_stone: 'fer',
  // Bûcheron
  frene: 'frene',
  chataignier: 'sequoia',
  noyer: 'chene',
  brume_saule: 'chene',
  chene: 'bouleau',
  if: 'ginkgo',
  bombu: 'erable',
  bambou: 'magnolia',
  erable: 'bambou',
  merisier: 'sakura_dore',
  charme: 'sakura',
  lotus_tree: 'sakura',
  orme: 'sakura_dore',
  // Pêcheur
  goujon: 'dorade',
  greuvette: 'crabe',
  truite: 'saumon',
  brume_truite: 'saumon',
  sardine: 'calmar',
  brochet: 'homard',
  carpe: 'naso',
  bar: 'naso',
  dorade: 'fugu',
  raie: 'pieuvre',
  perche: 'koi_dore',
  lotus_carp: 'carpe_koi',
  kralamoure: 'koi_dore',
  // Mineur
  fer: 'pierre',
  cuivre: 'fer',
  bronze: 'cuivre',
  brume_quartz: 'topaze',
  kobalte: 'fer',
  silicate: 'jade',
  manganese: 'topaze',
  argent: 'diamant',
  etain: 'emeraude',
  bauxite: 'saphir',
  or_minerai: 'cristal',
  lotus_crystal: 'cristal',
  cendrepierre: 'cristal_dore',
  // Alchimiste
  ortie: 'pissenlit',
  sauge: 'menthe',
  trefle: 'ortie',
  brume_lotus_herb: 'menthe',
  menthe: 'lavande',
  ginseng: 'chrysantheme',
  orchidee: 'pivoine',
  belladone: 'ginseng',
  edelweiss: 'wisteria',
  mandragore: 'lotus_sacre',
  perce_neige: 'lotus_sacre',
  lotus_essence: 'lotus_sacre',
  salikronia: 'lotus_sacre_dore',
  // Paysan
  ble: 'ble',
  orge: 'orge',
  avoine: 'seigle',
  brume_ble: 'orge',
  houblon: 'avoine',
  malt: 'seigle',
  lin: 'mais',
  chanvre: 'sarrasin',
  seigle: 'riz_sakura',
  mais: 'riz_sakura',
  millet: 'riz_sakura',
  lotus_grain: 'riz_sakura',
  frostiz: 'riz_dore',
};

function remapInventoryKeys(inv, map) {
  if (!inv || typeof inv !== 'object') return;
  const next = {};
  for (const [id, amount] of Object.entries(inv)) {
    if (!amount) continue;
    const mapped = map[id] || id;
    next[mapped] = (next[mapped] || 0) + amount;
  }
  for (const key of Object.keys(inv)) delete inv[key];
  Object.assign(inv, next);
}

function remapProductionLineKeys(state, map) {
  const harvest = state.productionLines?.harvest;
  if (!harvest) return;
  for (const jobId of Object.keys(harvest)) {
    const lines = harvest[jobId];
    if (!lines || typeof lines !== 'object') continue;
    const next = {};
    for (const [resId, line] of Object.entries(lines)) {
      const mapped = map[resId] || resId;
      if (next[mapped]) {
        next[mapped].units = Math.max(next[mapped].units || 0, line.units || 0);
        const slotsA = next[mapped].slots || [];
        const slotsB = line.slots || [];
        next[mapped].slots = slotsA.length >= slotsB.length ? slotsA : slotsB;
      } else {
        next[mapped] = line;
      }
    }
    harvest[jobId] = next;
  }
}

function pruneUnknownInventory(state, resources) {
  if (!state.inventory || !resources) return;
  for (const id of Object.keys(state.inventory)) {
    if (!resources[id]) delete state.inventory[id];
  }
}

function migrateCareerToProgressive(state) {
  if (!state.careerChoice) {
    state.careerChoice = { confirmed: false, starterWeaponsGranted: false };
    return;
  }
  if (state.careerChoice?.confirmed) {
    const cc = state.careerChoice;
    if (cc.gatheringJobs?.length && !cc.legacyGatheringJobs) {
      cc.legacyGatheringJobs = [...cc.gatheringJobs];
      cc.legacyFarmBuildings = [...(cc.farmBuildings || [])];
      delete cc.gatheringJobs;
      delete cc.farmBuildings;
    }
  }
}

function migrateProgressiveProductionUnlock(state, ctx) {
  const maxPer = getMaxUnitsPerResource(ctx.balance);
  for (const jobLines of Object.values(state.productionLines?.harvest || {})) {
    for (const line of Object.values(jobLines)) {
      if (line.units > maxPer) line.units = maxPer;
      if (line.slots?.length > maxPer) line.slots = line.slots.slice(0, maxPer);
    }
  }
}

function resetHarvestLinesForBeta(state, ctx) {
  if (!state.productionLines) state.productionLines = { harvest: {}, farm: {} };
  const jobs = ['farmer', 'lumberjack', 'fisher', 'miner', 'alchemist'];
  for (const jobId of jobs) {
    if (!isJobUnlocked(jobId, state, ctx.balance)) {
      delete state.productionLines.harvest[jobId];
      continue;
    }
    const tiers = getJobHarvestResources(ctx.resources, jobId);
    if (!tiers.length) continue;
    state.productionLines.harvest[jobId] = {
      [tiers[0].id]: { units: 1, slots: [{ active: null }] },
    };
  }
  state.productionLines.farm = {};
  state.farmBuildingMeta = {};
}

function clearLegacyCareerUnlocks(state, ctx) {
  if (state.careerChoice) {
    delete state.careerChoice.legacyGatheringJobs;
    delete state.careerChoice.legacyFarmBuildings;
    delete state.careerChoice.gatheringJobs;
    delete state.careerChoice.farmBuildings;
  }
  resetHarvestLinesForBeta(state, ctx);
}

const MIGRATIONS = {
  27(state, ctx) {
    migrateSlotsToProductionLines(state, ctx.resources, ctx.farmData, ctx.balance);
    migrateCareerToProgressive(state);
    clearProgressionCache();
  },
  28(state, ctx) {
    migrateProgressiveProductionUnlock(state, ctx);
    clearProgressionCache();
  },
  29(state, ctx) {
    resetHarvestLinesForBeta(state, ctx);
    clearProgressionCache();
  },
  30(state, ctx) {
    clearLegacyCareerUnlocks(state, ctx);
    clearProgressionCache();
  },
  31(state, ctx) {
    if (state.quests && !state.achievements) {
      state.achievements = migrateAchievements(state.quests);
      delete state.quests;
    }
    if (!state.achievements) {
      state.achievements = { completed: [], progress: {}, bonuses: { kirha: 0, xp: 0, harvestSpeed: 0 } };
    }
    clearProgressionCache();
  },
  32(state, ctx) {
    ensureProductionLines(state, ctx.resources, ctx.farmData, ctx.balance);
    clearProgressionCache();
  },
  33(state, ctx) {
    remapInventoryKeys(state.inventory, GATHERING_ID_REWRITE);
    remapProductionLineKeys(state, GATHERING_ID_REWRITE);
    if (Array.isArray(state.bankProtected)) {
      state.bankProtected = [...new Set(state.bankProtected.map((id) => GATHERING_ID_REWRITE[id] || id))];
    }
    if (state.farmBuildingMeta) {
      for (const meta of Object.values(state.farmBuildingMeta)) {
        if (meta?.feedId && GATHERING_ID_REWRITE[meta.feedId]) {
          meta.feedId = GATHERING_ID_REWRITE[meta.feedId];
        }
      }
    }
    pruneUnknownInventory(state, ctx.resources);
    ensureProductionLines(state, ctx.resources, ctx.farmData, ctx.balance);
    clearProgressionCache();
  },
  34(state) {
    // XP ferme : métier Éleveur → niveau par bâtiment (poulailler, étable…)
    migrateBreederXpToBuildings(state);
  },
  35(state) {
    // Animaux ferme : slots multiples (hasAnimal → animals[])
    if (!state.farmBuildingMeta) return;
    for (const meta of Object.values(state.farmBuildingMeta)) {
      if (!meta || Array.isArray(meta.animals)) continue;
      const slots = 1;
      meta.animalSlots = slots;
      meta.animals = [meta.hasAnimal ? { cyclesLeft: Math.max(1, Number(meta.cyclesLeft) || 12) } : null];
    }
  },
  36(state) {
    // Retrait outils rendement bûcheron / pêcheur (Panier renforcé, Nasse)
    const removed = new Set(['herb_basket', 'fish_trap']);
    if (Array.isArray(state.crafted)) {
      state.crafted = state.crafted.filter((id) => !removed.has(id));
    }
    if (state.toolDurability && typeof state.toolDurability === 'object') {
      for (const id of removed) delete state.toolDurability[id];
    }
    const eq = state.equipment;
    if (eq?.accessories) {
      for (const jobId of Object.keys(eq.accessories)) {
        if (removed.has(eq.accessories[jobId])) eq.accessories[jobId] = null;
      }
    }
    if (eq && removed.has(eq.accessory)) eq.accessory = null;
    if (eq?.jobs) {
      for (const jobId of Object.keys(eq.jobs)) {
        if (removed.has(eq.jobs[jobId])) eq.jobs[jobId] = null;
      }
    }
  },
  37() {
    // Accès métiers après prestige cassé : géré par repairSeasonAccess() dans mergeState
  },
  38(state, ctx) {
    // Recalcule les bonus prestige (15 % Kirha / 10 % XP par saison)
    const done = state.lifetimeStats?.seasonsCompleted || 0;
    if (done <= 0) return;
    const b = ctx.balance?.prestige?.bonusesPerSeason || {};
    state.prestige = state.prestige || {};
    state.prestige.kirhaBonus = done * (b.kirhaMultiplier ?? 0.15);
    state.prestige.xpBonus = done * (b.xpMultiplier ?? 0.1);
  },
  39(state, ctx) {
    // XP métiers + vitesse repousse (cumul par saison)
    const done = state.lifetimeStats?.seasonsCompleted || 0;
    const b = ctx.balance?.prestige?.bonusesPerSeason || {};
    state.prestige = state.prestige || {};
    state.prestige.jobXpBonus = done * (b.jobXpMultiplier ?? 0.1);
    state.prestige.regrowthSpeedBonus = done * (b.regrowthSpeed ?? 0.05);
  },
  40(state) {
    if (!state.toolUpgrades || typeof state.toolUpgrades !== 'object') state.toolUpgrades = {};
    if (state.seasonBoost && !(Number(state.seasonBoost.endsAt) > Date.now())) {
      state.seasonBoost = null;
    }
  },
  41(state) {
    if (!state.achievements) return;
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
    } else {
      if (state.achievements.bonuses.yield == null) state.achievements.bonuses.yield = 0;
      if (state.achievements.bonuses.farmExtraYield == null) state.achievements.bonuses.farmExtraYield = 0;
      if (state.achievements.bonuses.farmFeedDiscount == null) state.achievements.bonuses.farmFeedDiscount = 0;
      if (state.achievements.bonuses.farmAnimalLife == null) state.achievements.bonuses.farmAnimalLife = 0;
    }
  },
  42(state) {
    // Cuisine : cook → baker ; initialise fishmonger / chemist
    if (!state.jobs || typeof state.jobs !== 'object') state.jobs = {};
    if (state.jobs.cook && !state.jobs.baker) {
      state.jobs.baker = { ...state.jobs.cook };
    }
    delete state.jobs.cook;
    for (const id of ['baker', 'fishmonger', 'chemist']) {
      if (!state.jobs[id]) state.jobs[id] = { level: 1, xp: 0 };
    }
    if (state.equipment?.accessories?.cook && !state.equipment.accessories.baker) {
      state.equipment.accessories.baker = state.equipment.accessories.cook;
    }
    if (state.equipment?.accessories) delete state.equipment.accessories.cook;
  },
  43(state) {
    if (!state.lifetimeStats) state.lifetimeStats = {};
    if (!state.lifetimeStats.discoveries || typeof state.lifetimeStats.discoveries !== 'object') {
      state.lifetimeStats.discoveries = {
        nest: 0,
        rock_purse: 0,
        field_purse: 0,
        bottle: 0,
        herb_bag: 0,
      };
    }
    if (!state.harvestEventsDaily) state.harvestEventsDaily = null;
  },
  44(state) {
    if (!state.villageBoard) state.villageBoard = null;
  },
  45(state) {
    if (!state.travelingMerchant) state.travelingMerchant = null;
    if (!state.sakuraWind) state.sakuraWind = null;
  },
  46(state) {
    if (!state.villageSchool || typeof state.villageSchool !== 'object') {
      state.villageSchool = {
        completedSeasonal: [],
        completedPermanent: [],
        active: null,
        legacyPending: null,
        seasonFlags: {},
        bonuses: {},
        unlockedSpells: [],
      };
    }
    if (!state.seasonStartedAt) state.seasonStartedAt = Date.now();
  },
  47(state) {
    if (!state.grimoire || typeof state.grimoire !== 'object') {
      state.grimoire = { known: [], equipped: [] };
    }
    if (!Array.isArray(state.grimoire.known)) state.grimoire.known = [];
    if (!Array.isArray(state.grimoire.equipped)) state.grimoire.equipped = [];
    if (!state.keyQualities) state.keyQualities = {};
    if (state.villageSchool && !Array.isArray(state.villageSchool.unlockedSpells)) {
      state.villageSchool.unlockedSpells = [];
    }
  },
  48(state, ctx) {
    if (!state.cookbook || typeof state.cookbook !== 'object') {
      state.cookbook = { discovered: [] };
    }
    if (!Array.isArray(state.cookbook.discovered)) state.cookbook.discovered = [];
    const recipes = ctx.recipes || {};
    const cuisineJobs = new Set(['baker', 'fishmonger', 'chemist', 'cook']);
    const crafted = new Set(state.crafted || []);
    for (const recipe of Object.values(recipes)) {
      if (!recipe?.id || !cuisineJobs.has(recipe.craftJob)) continue;
      if (crafted.has(recipe.id) && !state.cookbook.discovered.includes(recipe.id)) {
        state.cookbook.discovered.push(recipe.id);
      }
    }
  },
  49(state) {
    if (!state.travelerJournal || typeof state.travelerJournal !== 'object') {
      state.travelerJournal = { unlocked: [], seenToast: [] };
    }
    if (!Array.isArray(state.travelerJournal.unlocked)) state.travelerJournal.unlocked = [];
    if (!Array.isArray(state.travelerJournal.seenToast)) state.travelerJournal.seenToast = [];
  },
};

export function runSaveMigrations(state, ctx) {
  const target = ctx.balance?.saveVersion ?? 49;
  let version = state.saveVersion ?? 0;
  while (version < target) {
    version += 1;
    MIGRATIONS[version]?.(state, ctx);
    state.saveVersion = version;
  }
  return state;
}
