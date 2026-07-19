import { SaveProvider, mergeSettings } from './save.js';
import { emit } from './events.js';
import { isGuestAccount, isRegisteredAccount, getAuthState } from './auth.js';
import { saveCloudSave } from './cloudSave.js';
import { validateSaveSanity } from './saveIntegrity.js';
import { submitLeaderboardSnapshot } from '../systems/leaderboard.js';
import { sellResource } from '../systems/economy.js';
import {
  getCraftSellBonus,
  performCraft,
  autoEquipIfEmpty,
  makeCraftContext,
  whyCannotCraft,
  repairCraftSave,
} from '../systems/crafting.js';
import {
  getHarvestTime,
  getRegrowthTime,
  getHarvestYield,
  getHarvestXp,
  addJobXp,
  getXpForLevel,
} from '../systems/harvest.js';
import {
  isZoneUnlocked,
  isResourceHarvestable,
  getResourcesForJob,
  getJobLevel,
} from '../systems/zones.js';
import { migrateToolDurability, wearToolsForHarvest } from '../systems/toolDurability.js';
import { getVendorOffer, canBuyOffer, buyOffer, canSellOffer, sellOffer } from '../systems/merchant.js';
import { buildTestHdvVendors, mergeMerchantVendors } from '../systems/testHdv.js';
import { getAideCost } from '../systems/passive.js';
import { applyOfflineProgress } from '../systems/offline.js';
import {
  canPrestige,
  applyPrestige,
  getPrestigePreview,
  getPrestigeBonuses,
  getPrestigeProgress,
  getSeasonCapPreview,
  getSeasonCapProximity,
  getSeasonLevelCap,
  shouldShowPrestigeTeaser,
  getDefaultSettings,
} from '../systems/prestige.js';
import { runSaveMigrations } from './migrations.js';
import {
  ensureProductionLines,
  startHarvestUnit,
  completeHarvestUnit,
  startFarmUnit,
  completeFarmUnit,
  buyHarvestUnit,
  buyFarmUnit,
  canBuyHarvestUnit,
  canBuyFarmUnit,
  getUnitUnlockRequirements,
  getNextProductionUnlock,
  canBuyNextProductionUnlock as checkCanBuyNextProductionUnlock,
  buyNextProductionUnlock as applyNextProductionUnlock,
  getUnitProgress,
  isAnyProductionActive,
  isAnyHarvestActive,
  isAnyFarmLineActive,
  getJobHarvestNavStatus as computeJobHarvestNavStatus,
  getFarmBuildingNavStatus as computeFarmBuildingNavStatus,
  buyFarmAnimal,
  unlockFarmAnimalSlot,
  setFarmLineFeed,
  getFarmBuildingMeta,
  countAliveAnimals,
  getNextAnimalSlotUnlock,
  getEmptyAnimalSlotIndex,
  formatAnimalCostParts,
  listActiveProductionTimers,
  getJobHarvestResources,
} from '../systems/productionLines.js';
import { isCraftJobUnlocked, isCombatUnlocked } from '../systems/jobUnlock.js';
import {
  getFarmBuildingProgress as computeFarmBuildingProgress,
  getFarmBuildingLevel as computeFarmBuildingLevel,
} from '../systems/farmProgress.js';
import {
  getCharacterProgress,
  getCombatStats,
  getCombatStatsBreakdown,
  addCharacterXp,
  getCharacterDisplayName,
  getNicknameRenameInfo,
  applyCharacterNickname,
} from '../systems/character.js';
import { getCurrentObjective, getCombatZoneRecommendation } from '../systems/guidance.js';
import {
  equipCombatItem,
  unequipCombatSlot,
  getDefaultCombatEquipment,
  migrateCombatEquipment,
  getCompanionStats,
  findCombatItemOwner,
  resolveItem,
  resolveItemId,
  migrateCombatItemInstances,
  getWeaponClassLabel,
  COMBAT_SLOT_IDS,
  grantCombatItem,
} from '../systems/combat.js';
import {
  canFight,
  startFight,
  startDungeonRun as startZoneDungeonRun,
  canEnterDungeon as checkEnterDungeon,
  useCombatSkill as resolveCombatSkill,
  useCombatDefend as resolveCombatDefend,
  useCombatMeal as resolveCombatMeal,
  abandonCombat as clearCombatEncounter,
  getActiveEncounter,
  getActiveMemberSkills,
  getActiveCombatMember,
  stepCombatEnemyTurn as resolveCombatEnemyStep,
  getTrainingUnlockCheck,
  DEFEND_ACTION,
} from '../systems/combatZone.js';
import {
  getCombatDailyStatus,
  getDungeonUnlockProgress,
  getDungeonUnlockConfig,
} from '../systems/combatDaily.js';
import {
  dismantleCombatItem,
  getDismantlePreview as buildDismantlePreview,
  canDismantleCombatItem,
} from '../systems/dismantle.js';
import {
  buildDefaultQuestState,
  migrateQuests,
  migrateAchievements,
  buildDefaultAchievementState,
  isQuestReady,
  isAchievementReady,
  completeQuest,
  completeAchievement,
  incrementQuestProgress,
  incrementAchievementProgress,
  applyQuestRewards,
  applyAchievementRewards,
  getActiveQuests,
  getActiveAchievements,
  getNextQuest,
  getNextAchievement,
  isQuestCompleted,
  isAchievementCompleted,
  getQuestsByChapter,
  getAchievementsByCategory,
  getQuestGuidance,
  getAchievementGuidance,
  getAchievementStatusText,
  getAchievementBonuses,
  ACHIEVEMENT_CATEGORY_LABELS,
  areQuestsEnabled,
  areAchievementsEnabled,
} from '../systems/achievements.js';
import {
  unlockWorldZone,
  canPayUnlockZone,
  getZoneUnlockHint,
  formatZoneUnlockRequirements,
} from '../systems/zoneProgress.js';
import {
  buildDefaultCompanions,
  migrateCompanions,
  applyBetaUnlocks,
  unlockCompanion,
  canUnlockCompanion as checkUnlockCompanion,
  equipCompanionItem,
  unequipCompanionSlot,
  getCompanionEquippableItems,
  getUnlockedCompanionCount,
  getActiveCompanionCount,
  toggleCompanionParty,
  applyCompanionNickname,
  getCompanionDisplayName,
} from '../systems/companions.js';
import { equip, unequip, unequipGathering, canEquip, migrateEquipment, getDefaultEquipment } from '../systems/equipment.js';
import {
  ensureFarmSlots,
  startFarmProduction,
  completeFarmProduction,
  getFarmSlotProgress,
  isAnyFarmActive,
  buyFarmSlot as purchaseFarmSlot,
  buyFarmAnimal as purchaseFarmAnimal,
  canBuyFarmSlot as checkCanBuyFarmSlot,
  getFarmSlotUnlockRequirements,
  getMaxFarmSlots as getMaxFarmSlotsForBuilding,
  syncExpiredFarmSlots,
  wearBreederTool,
  getBuildingDef,
  isUnifiedFarmBuilding,
} from '../systems/farm.js';
import { getFarmToolCheck, getHarvestToolCheck } from '../systems/toolTier.js';
import { migrateCombatDurability } from '../systems/combatDurability.js';
import { clearCombatMealBuff, listOwnedMeals, peekMealHeal, consumeMealFromInventory, calcMealHealAmount } from '../systems/consumables.js';
import {
  STARTER_WEAPON_CHOICES,
  STARTER_WEAPON_TYPES,
  applyCareerChoice,
  needsCareerChoice as checkNeedsCareerChoice,
  migrateCareerChoice,
} from '../systems/careerChoice.js';
import { getFusionableGroups, fuseEquipmentGroup } from '../systems/equipmentFusion.js';
import { sellCombatItem, getCombatItemSellPrice } from '../systems/combatSell.js';
import { getDungeonKeyId, getKeyCount as countDungeonKeys } from '../systems/dungeonKeys.js';

const LEGACY_COMBAT_RESOURCES = [
  'spirit_ember', 'petal_gel', 'temple_fragment', 'sakura_core',
  'petal_fur', 'wild_thorn', 'ancient_bark', 'forest_essence',
  'crystal_dust', 'jade_shard', 'stone_rune', 'golem_heart',
];

const LEGACY_RESOURCE_MAP = {
  // Laisser les anciens ids intacts jusqu'à la migration 33 (one-shot).
};

function migrateLegacyCombatResources(state) {
  let converted = 0;
  for (const id of LEGACY_COMBAT_RESOURCES) {
    const amount = state.inventory?.[id] || 0;
    if (amount > 0) {
      converted += amount;
      delete state.inventory[id];
    }
  }
  if (converted > 0) {
    state.inventory.gold_nugget = (state.inventory.gold_nugget || 0) + converted;
  }
}

export class Game {
  constructor(resources, jobs, balance, recipes, aides, equipment, farmData, characterConfig, combatEquipment, combatZones, enemies, merchant, combatSkills, companions, achievements, weaponRoles) {
    this.resources = resources;
    this.jobs = jobs;
    this.balance = balance;
    this.balance._recipes = recipes;
    this.recipes = recipes;
    this.aides = aides;
    this.equipment = equipment;
    this.farmData = farmData || { buildings: {} };
    this.characterConfig = characterConfig;
    this.combatEquipment = combatEquipment;
    this.combatZones = combatZones;
    this.enemies = enemies;
    this.merchant = merchant;
    this.combatSkills = combatSkills;
    this.companions = companions;
    this.achievements = achievements || {};
    this.quests = this.achievements;
    this.weaponRoles = weaponRoles || {};
    this.state = null;
    this.harvestTimers = {};
    this.farmTimers = {};
    this.saveTimer = null;
    this.passiveAccum = {};
    this.lastTick = Date.now();
    this.passiveInterval = null;
  }

  buildDefaultInventory() {
    const inv = {};
    for (const id of Object.keys(this.resources)) {
      inv[id] = 0;
    }
    return inv;
  }

  buildDefaultJobs() {
    const jobs = {};
    for (const id of Object.keys(this.jobs)) {
      jobs[id] = { level: 1, xp: 0 };
    }
    return jobs;
  }

  getDefaultState() {
    const kirha = this.balance.testHdv?.enabled
      ? (this.balance.testHdv.startingKirha ?? this.balance.startingKirha)
      : this.balance.startingKirha;
    const state = {
      kirha,
      inventory: this.buildDefaultInventory(),
      jobs: this.buildDefaultJobs(),
      character: { level: 1, xp: 0 },
      upgrades: {},
      crafted: [],
      toolDurability: {},
      equipment: getDefaultEquipment(),
      combatEquipment: getDefaultCombatEquipment(),
      ownedCombatItems: [],
      purchasedSlots: {},
      harvestSlots: {},
      productionLines: { harvest: {}, farm: {} },
      farmBuildingMeta: {},
      saveVersion: this.balance.saveVersion || 31,
      aides: {},
      bossKills: {},
      combatKillStats: {},
      combatDaily: null,
      combatEncounter: null,
      combatItemInstances: [],
      companions: buildDefaultCompanions(this.companions),
      unlockedZones: ['village_sakura'],
      zone: 'village_sakura',
      season: 1,
      prestige: { kirhaBonus: 0, xpBonus: 0 },
      lifetimeStats: { totalEarned: 0, totalHarvests: 0, seasonsCompleted: 0 },
      settings: getDefaultSettings(),
      lastOnline: Date.now(),
      playtime: { foregroundMs: 0, backgroundMs: 0 },
      stats: { totalHarvests: 0, totalEarned: 0, passiveHarvests: 0, offlineHarvests: 0 },
      achievements: buildDefaultAchievementState(),
      farmSlots: {},
      purchasedFarmSlots: {},
      activeMeal: null,
      combatMealBuff: null,
      bankProtected: [],
      careerChoice: null,
      meta: {},
    };
    ensureProductionLines(state, this.resources, this.farmData, this.balance);
    return state;
  }

  migrateJobs(oldJobs) {
    const jobs = this.buildDefaultJobs();
    for (const [id] of Object.entries(this.jobs)) {
      if (oldJobs?.[id]) {
        jobs[id] = { ...jobs[id], ...oldJobs[id] };
      }
    }
    return jobs;
  }

  migrateInventory(oldInv) {
    const inv = this.buildDefaultInventory();
    for (const [id, amount] of Object.entries(oldInv || {})) {
      if (!amount) continue;
      const mapped = LEGACY_RESOURCE_MAP[id] || id;
      // Garder aussi les anciens ids (noyer, etc.) pour la migration 33 one-shot
      inv[mapped] = (inv[mapped] || 0) + amount;
    }
    return inv;
  }

  migrateHarvestSlots(oldSlots) {
    if (!oldSlots || typeof oldSlots !== 'object') return {};
    const slots = JSON.parse(JSON.stringify(oldSlots));
    for (const jobSlots of Object.values(slots)) {
      if (!Array.isArray(jobSlots)) continue;
      for (const slot of jobSlots) {
        if (!slot?.active) continue;
        if (!slot.active.phase) slot.active.phase = 'harvesting';
      }
    }
    return slots;
  }

  mergeState(saved) {
    const defaults = this.getDefaultState();
    const merged = {
      ...defaults,
      ...saved,
      inventory: { ...defaults.inventory, ...this.migrateInventory(saved.inventory) },
      jobs: this.migrateJobs(saved.jobs),
      character: { ...defaults.character, ...(saved.character || {}) },
      upgrades: {},
      crafted: saved.crafted || [],
      toolDurability: saved.toolDurability || {},
      equipment: migrateEquipment(saved.equipment || saved.gatheringEquipment, this.equipment.equipable),
      combatEquipment: migrateCombatEquipment(saved.combatEquipment),
      ownedCombatItems: saved.ownedCombatItems || [],
      combatItemInstances: saved.combatItemInstances || [],
      purchasedSlots: saved.purchasedSlots || {},
      productionLines: saved.productionLines || defaults.productionLines,
      farmBuildingMeta: saved.farmBuildingMeta || {},
      saveVersion: saved.saveVersion ?? 0,
      aides: saved.aides || {},
      bossKills: saved.bossKills || saved.dungeonClears || {},
      combatKillStats: saved.combatKillStats || {},
      combatDaily: saved.combatDaily || null,
      combatEncounter: null,
      companions: migrateCompanions(saved.companions, this.companions),
      unlockedZones: saved.unlockedZones || defaults.unlockedZones,
      season: saved.season || defaults.season,
      prestige: {
        kirhaBonus: saved.prestige?.kirhaBonus || 0,
        xpBonus: saved.prestige?.xpBonus || 0,
      },
      lifetimeStats: { ...defaults.lifetimeStats, ...(saved.lifetimeStats || {}) },
      settings: mergeSettings(saved.settings),
      playtime: {
        foregroundMs: Math.max(0, Number(saved.playtime?.foregroundMs) || 0),
        backgroundMs: Math.max(0, Number(saved.playtime?.backgroundMs) || 0),
      },
      stats: { ...defaults.stats, ...(saved.stats || {}) },
      harvestSlots: saved.harvestSlots || {},
      farmSlots: saved.farmSlots || {},
      purchasedFarmSlots: saved.purchasedFarmSlots || {},
      activeMeal: saved.activeMeal || null,
      combatMealBuff: null,
      achievements: migrateAchievements(saved.achievements || saved.quests),
      bankProtected: saved.bankProtected || defaults.bankProtected,
      careerChoice: migrateCareerChoice(saved.careerChoice),
      meta: { ...defaults.meta, ...(saved.meta || {}) },
    };
    runSaveMigrations(merged, {
      balance: this.balance,
      resources: this.resources,
      farmData: this.farmData,
    });
    ensureProductionLines(merged, this.resources, this.farmData, this.balance);
    migrateCombatItemInstances(merged, this.combatEquipment.items);
    migrateCombatDurability(merged, this.combatEquipment.items);
    migrateLegacyCombatResources(merged);
    migrateToolDurability(merged, this.recipes);
    repairCraftSave(merged, this.recipes);
    if (this.balance.betaMode) applyBetaUnlocks(merged, this.companions);
    return merged;
  }

  async init() {
    const { markCloudSyncReady, loadCloudSave, mergeCloudAndLocal } = await import('./cloudSave.js');
    const saved = await SaveProvider.load(this.balance);
    const rawLocal = saved ? this.mergeState(saved) : null;
    this.state = rawLocal || this.getDefaultState();

    const { initAuth, syncAuthFromState, getAuthState } = await import('./auth.js');
    syncAuthFromState(this.state);
    await initAuth(this);

    const auth = getAuthState();
    if (auth.mode === 'registered' && auth.userId && auth.userId !== 'dev_local_user') {
      markCloudSyncReady(false);
      try {
        const cloud = await loadCloudSave(auth.userId);
        const freshReset = SaveProvider.isFreshReset();
        if (!freshReset && cloud?.data) {
          const merged = await mergeCloudAndLocal(cloud, rawLocal, this.balance, { userId: auth.userId });
          if (merged) {
            this.state = this.mergeState(merged);
            syncAuthFromState(this.state);
          }
        }
      } finally {
        markCloudSyncReady(true);
      }
    } else {
      markCloudSyncReady(true);
    }

    if (this.balance.betaMode) applyBetaUnlocks(this.state, this.companions);

    const offlineResult = applyOfflineProgress(this.state, this.aides, this.balance);
    this.state.lastOnline = Date.now();

    this.restoreHarvestTimers();
    this.restoreFarmTimers();
    syncExpiredFarmSlots(this.state, (buildingId, slotIndex) => {
      this.completeFarmSlot(buildingId, slotIndex);
    });
    this.processQuests();
    emit('stateChange', this.state);

    if (offlineResult) {
      this.scheduleSave();
      emit('offlineProgress', offlineResult);
    }

    return this.state;
  }

  startPassiveLoop() {
    // Anti-idle : pas de tick passif
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), 500);
  }

  /** Sauvegarde immédiate (local + cloud) — avant échanges HDV joueur. */
  async flushSave() {
    clearTimeout(this.saveTimer);
    this.state.lastOnline = Date.now();
    await SaveProvider.save(this.state, this.balance);
    if (isRegisteredAccount()) {
      const auth = getAuthState();
      await saveCloudSave(auth.userId, this.state, this.balance);
      submitLeaderboardSnapshot(this.state, this.getCharacterDisplayName()).catch(() => {});
    }
  }

  canImportSave() {
    if (isGuestAccount()) {
      return { ok: false, reason: 'Import désactivé en mode invité.' };
    }
    return { ok: true };
  }

  trackEarnings(amount) {
    this.state.stats.totalEarned += amount;
    this.state.lifetimeStats.totalEarned = (this.state.lifetimeStats.totalEarned || 0) + amount;
  }

  applyKirhaBonus(amount) {
    return Math.floor(amount * getPrestigeBonuses(this.state).kirha);
  }

  getCurrentZone() {
    return this.balance.zones[this.state.zone];
  }

  getJobResources(jobId) {
    return getResourcesForJob(this.resources, jobId, this.state, this.balance);
  }

  getAssignableResources(jobId) {
    return getJobHarvestResources(this.resources, jobId);
  }

  unlockZone(zoneId) {
    const result = unlockWorldZone(zoneId, this.state, this.balance, this.combatZones);
    if (!result.ok) return false;

    const zone = this.balance.zones[zoneId];
    emit('zoneUnlock', { zoneId, zone, cost: result.cost || 0 });
    this.processQuests();
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  canUnlockZone(zoneId) {
    return canPayUnlockZone(zoneId, this.state, this.balance, this.combatZones, this.resources, this.jobs);
  }

  getZoneUnlockRequirementsList(zoneId) {
    return formatZoneUnlockRequirements(zoneId, this.balance, this.resources, this.jobs);
  }

  getZoneUnlockHint(zoneId) {
    return getZoneUnlockHint(zoneId, this.balance, this.combatZones);
  }

  processQuests() {
    return this.processAchievements();
  }

  processAchievements() {
    if (!areAchievementsEnabled(this.balance)) return false;
    let changed = false;
    for (const ach of Object.values(this.achievements)) {
      if (ach.hidden) continue;
      if (isAchievementCompleted(this.state, ach.id)) continue;
      if (!isAchievementReady(ach, this.state, this.recipes)) continue;
      if (!completeAchievement(ach.id, this.state)) continue;
      applyAchievementRewards(this.state, ach, this.balance);
      emit('achievementComplete', { achievementId: ach.id, achievement: ach });
      emit('questComplete', { questId: ach.id, quest: ach });
      changed = true;
    }
    return changed;
  }

  getCraftContext() {
    return makeCraftContext(this);
  }

  canCraftRecipe(recipeId) {
    return !whyCannotCraft(recipeId, this.getCraftContext());
  }

  craftItem(recipeId) {
    const ctx = this.getCraftContext();
    const result = performCraft(recipeId, ctx);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    autoEquipIfEmpty(recipeId, ctx);

    emit('craft', {
      recipeId,
      recipe: result.recipe,
      levelResult: result.levelResult,
    });
    this.processQuests();
    emit('stateChange', this.state);
    this.scheduleSave();
    return { ok: true, recipe: result.recipe, levelResult: result.levelResult };
  }

  getCraftFailureMessage(recipeId) {
    return whyCannotCraft(recipeId, this.getCraftContext()) || 'Impossible de fabriquer pour le moment.';
  }

  getActiveQuests() {
    return getActiveQuests(this.quests, this.state, this.recipes);
  }

  getNextQuest() {
    return getNextQuest(this.quests, this.state, this.recipes);
  }

  getQuestsByChapter() {
    return getQuestsByChapter(this.quests, this.state, this.recipes);
  }

  getQuestGuidance() {
    return getQuestGuidance(this.state, this.balance, this.quests, this.recipes);
  }

  getCurrentObjective() {
    return getCurrentObjective({
      state: this.state,
      balance: this.balance,
      quests: this.quests,
      recipes: this.recipes,
      resources: this.resources,
      combatZones: this.combatZones,
      combatEquipment: this.combatEquipment,
      characterConfig: this.characterConfig,
      jobs: this.jobs,
    });
  }

  getCombatZoneRecommendation(combatZoneId) {
    const combatZone = this.combatZones[combatZoneId];
    if (!combatZone) return null;
    return getCombatZoneRecommendation(combatZone, this.enemies, this.balance);
  }

  onHarvestForQuests(resourceId, yield_) {
    if (!areAchievementsEnabled(this.balance)) return;
    for (const ach of Object.values(this.achievements)) {
      if (ach.type === 'harvest_resource') {
        if (isAchievementCompleted(this.state, ach.id)) continue;
        const ids = ach.resourceIds || (ach.resourceId ? [ach.resourceId] : []);
        if (!ids.includes(resourceId)) continue;
        incrementAchievementProgress(this.state, ach.id, yield_ || 1);
      }
    }
    this.processAchievements();
  }

  onCombatVictoryHooks(result) {
    const zoneId = result?.zoneId;
    void zoneId;
    if (!this.state.stats) this.state.stats = {};
    this.state.stats.combatFights = (this.state.stats.combatFights || 0) + 1;
    clearCombatMealBuff(this.state);
    this.processAchievements();
  }

  setCompanionNickname(companionId, name, isRename = false) {
    const result = applyCompanionNickname(
      companionId,
      name,
      this.state,
      this.companions,
      this.characterConfig,
      { isRename }
    );
    if (!result.ok) return result;
    emit('companionNicknameChange', result);
    this.processQuests();
    emit('stateChange', this.state);
    this.scheduleSave();
    return result;
  }

  getCompanionDisplayName(companionId) {
    return getCompanionDisplayName(companionId, this.state, this.companions);
  }

  travelToZone(zoneId) {
    if (!isZoneUnlocked(zoneId, this.state, this.balance)) return false;
    this.state.zone = zoneId;
    emit('zoneChange', { zoneId });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  getMaxHarvestSlots(_jobId) {
    return this.balance.productionLines?.maxUnitsPerResource ?? this.balance.productionLines?.maxUnits ?? 5;
  }

  buyNextProductionUnlock(jobId) {
    if (!applyNextProductionUnlock(this.state, this.balance, this.resources, jobId, this.jobs)) return false;
    ensureProductionLines(this.state, this.resources, this.farmData, this.balance);
    emit('lineUnitUnlock', { jobId });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  getNextProductionUnlockPreview(jobId) {
    return getNextProductionUnlock(this.state, this.balance, this.resources, jobId, this.jobs);
  }

  canBuyNextProductionUnlock(jobId) {
    return checkCanBuyNextProductionUnlock(this.state, this.balance, this.resources, jobId, this.jobs);
  }

  buyHarvestSlot(jobId, resourceId) {
    if (!buyHarvestUnit(this.state, this.balance, jobId, resourceId, this.resources)) return false;
    emit('lineUnitUnlock', { jobId, resourceId });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  getLineUnitUnlockPreview(jobId, resourceId) {
    return getUnitUnlockRequirements(jobId, resourceId, this.state, this.balance, this.resources);
  }

  canBuyHarvestSlot(jobId, resourceId) {
    return canBuyHarvestUnit(this.state, this.balance, jobId, resourceId, this.resources);
  }

  assignResourceToSlot(_jobId, _slotIndex, _resourceId) {
    return true;
  }

  clearSlot(_jobId, _slotIndex) {
    return true;
  }

  scheduleProductionTimer(kind, ids, unitIndex, delayMs) {
    const timerKey = kind === 'harvest'
      ? `h_${ids.jobId}_${ids.resourceId}_${unitIndex}`
      : `f_${ids.buildingId}_${ids.productId}_${unitIndex}`;
    clearTimeout(this.harvestTimers[timerKey]);
    this.harvestTimers[timerKey] = setTimeout(
      () => {
        if (kind === 'harvest') {
          this.completeHarvestLine(ids.jobId, ids.resourceId, unitIndex);
          return;
        }
        const building = getBuildingDef(this.farmData, ids.buildingId);
        if (!isUnifiedFarmBuilding(building)) {
          this.completeFarmLine(ids.buildingId, ids.productId, unitIndex);
        }
      },
      Math.max(0, delayMs)
    );
  }

  restoreHarvestTimers() {
    Object.values(this.harvestTimers).forEach(clearTimeout);
    this.harvestTimers = {};

    for (const timer of listActiveProductionTimers(this.state)) {
      const elapsed = Date.now() - timer.slot.active.start;
      const remaining = timer.slot.active.duration - elapsed;
      const ids = timer.kind === 'harvest'
        ? { jobId: timer.jobId, resourceId: timer.resourceId }
        : { buildingId: timer.buildingId, productId: timer.productId };
      if (remaining <= 0) {
        if (timer.kind === 'harvest') {
          this.completeHarvestLine(timer.jobId, timer.resourceId, timer.unitIndex);
        } else {
          const building = getBuildingDef(this.farmData, timer.buildingId);
          if (!isUnifiedFarmBuilding(building)) {
            this.completeFarmLine(timer.buildingId, timer.productId, timer.unitIndex);
          }
        }
      } else {
        this.scheduleProductionTimer(timer.kind, ids, timer.unitIndex, remaining);
      }
    }
  }

  restoreFarmTimers() {
    this.restoreHarvestTimers();
  }

  setFarmFeed(buildingId, feedId) {
    setFarmLineFeed(this.state, buildingId, feedId);
    emit('farmFeedChange', { buildingId });
    this.scheduleSave();
    return true;
  }

  startFarmSlot(buildingId, productId, unitIndex = 0) {
    const building = this.farmData.buildings?.[buildingId];
    if (!building) return { ok: false, reason: 'Bâtiment inconnu' };

    const line = this.state.productionLines?.farm?.[buildingId]?.[productId];
    const slot = line?.slots?.[unitIndex];
    if (slot?.active) {
      const progress = this.getFarmLineProgress(buildingId, productId, unitIndex);
      if (progress >= 1) {
        this.completeFarmLine(buildingId, productId, unitIndex);
      } else {
        const pct = Math.min(99, Math.floor(progress * 100));
        return { ok: false, reason: `Production en cours (${pct} %)` };
      }
    }

    const toolCheck = getFarmToolCheck(this.state, this.recipes, this.equipment, building);
    if (!toolCheck.ok) {
      return { ok: false, reason: toolCheck.message };
    }

    const result = startFarmUnit(
      this.state,
      this.farmData,
      this.jobs,
      this.balance,
      buildingId,
      productId,
      unitIndex,
      this.recipes,
      this.equipment
    );
    if (!result.ok) return result;

    for (const { recipeId, remaining } of result.wornTools || []) {
      if (remaining <= 0) {
        const recipe = this.recipes[recipeId];
        emit('toolBroken', { recipeId, name: recipe?.name || recipeId });
      }
    }

    if (!isUnifiedFarmBuilding(building)) {
      this.scheduleProductionTimer('farm', { buildingId, productId }, unitIndex, result.duration);
    }
    emit('farmStart', { buildingId, productId, unitIndex, duration: result.duration });
    emit('stateChange', this.state);
    this.scheduleSave();
    return { ok: true };
  }

  completeFarmLine(buildingId, productId, unitIndex) {
    const timerKey = `f_${buildingId}_${productId}_${unitIndex}`;
    delete this.harvestTimers[timerKey];

    const outcome = completeFarmUnit(
      this.state,
      this.farmData,
      this.jobs,
      this.balance,
      buildingId,
      productId,
      unitIndex,
      this.recipes,
      this.equipment
    );
    if (!outcome) return;

    for (const { recipeId, remaining } of outcome.wornTools || []) {
      if (remaining <= 0) {
        const recipe = this.recipes[recipeId];
        emit('toolBroken', { recipeId, name: recipe?.name || recipeId });
      }
    }

    for (const [resId, qty] of Object.entries(outcome.products || {})) {
      this.onHarvestForQuests(resId, qty);
    }

    emit('farmComplete', outcome);
    emit('stateChange', this.state);
    this.scheduleSave();
  }

  completeFarmSlot(buildingId, productId, unitIndex = 0) {
    this.completeFarmLine(buildingId, productId, unitIndex);
  }

  getFarmLineProgress(buildingId, productId, unitIndex) {
    const slot = this.state.productionLines?.farm?.[buildingId]?.[productId]?.slots?.[unitIndex];
    return getUnitProgress(slot);
  }

  getFarmSlotProgress(buildingId, _slotIndex) {
    const building = this.farmData.buildings?.[buildingId];
    const productId = Object.keys(building?.products || {})[0];
    return productId ? this.getFarmLineProgress(buildingId, productId, 0) : 0;
  }

  isFarmActive() {
    return isAnyProductionActive(this.state);
  }

  getFarmToolBlockReason(buildingId) {
    const building = this.farmData.buildings?.[buildingId];
    if (!building) return null;
    const check = getFarmToolCheck(this.state, this.recipes, this.equipment, building);
    return check.ok ? null : check.message;
  }

  getHarvestToolBlockReason(jobId, resourceId) {
    const resource = this.resources[resourceId];
    if (!resource) return null;
    const check = getHarvestToolCheck(
      this.state,
      jobId,
      resource,
      this.recipes,
      this.equipment,
      this.resources
    );
    return check.ok ? null : check.message;
  }

  getHarvestSlotHint(jobId, resourceId) {
    const resource = this.resources[resourceId];
    if (!resource) return null;
    const check = getHarvestToolCheck(
      this.state,
      jobId,
      resource,
      this.recipes,
      this.equipment,
      this.resources
    );
    return check.ok ? null : check.message;
  }

  getOwnedMeals() {
    return listOwnedMeals(this.state, this.resources, this.balance).map((m) => m.id);
  }

  needsCareerChoice() {
    return checkNeedsCareerChoice(this.state);
  }

  applyStarterWeaponTeam(weaponType) {
    if (this.state.careerChoice?.starterWeaponsGranted) return;

    const choicesByType = Object.fromEntries(STARTER_WEAPON_CHOICES.map((choice) => [choice.weaponType, choice]));
    const teamWeaponTypes = [
      weaponType,
      ...STARTER_WEAPON_TYPES.filter((type) => type !== weaponType),
    ];
    const companionIds = Object.keys(this.companions || {}).slice(0, 2);

    const heroChoice = choicesByType[teamWeaponTypes[0]];
    if (heroChoice?.itemId && this.combatEquipment.items[heroChoice.itemId]) {
      const ref = grantCombatItem(this.state, heroChoice.itemId, this.combatEquipment.items);
      this.state.combatEquipment.weapon = ref;
    }

    teamWeaponTypes.slice(1).forEach((type, index) => {
      const companionId = companionIds[index];
      const choice = choicesByType[type];
      if (!companionId || !choice?.itemId || !this.combatEquipment.items[choice.itemId]) return;
      if (!this.state.companions?.[companionId]) return;
      const ref = grantCombatItem(this.state, choice.itemId, this.combatEquipment.items);
      this.state.companions[companionId].equipment = {
        ...this.state.companions[companionId].equipment,
        weapon: ref,
      };
      this.state.companions[companionId].assignedWeaponType = type;
    });

    if (!this.state.careerChoice) this.state.careerChoice = {};
    this.state.careerChoice.starterWeaponsGranted = true;
  }

  doApplyCareerChoice(_gatheringJobs, _farmBuildings, weaponType) {
    const result = applyCareerChoice(this.state, null, null, weaponType);
    if (!result.ok) return result;
    this.applyStarterWeaponTeam(result.careerChoice.weaponType);
    ensureProductionLines(this.state, this.resources, this.farmData, this.balance);
    this.processQuests();
    SaveProvider.clearFreshReset();
    SaveProvider.save(this.state);
    emit('careerChoiceApplied', result);
    emit('stateChange', this.state);
    this.scheduleSave();
    return result;
  }

  getFusionGroups() {
    return getFusionableGroups(this.state, this.combatEquipment.items);
  }

  doFuseEquipment(groupKey) {
    const groups = getFusionableGroups(this.state, this.combatEquipment.items);
    const group = groups.find((g) => `${g.itemId}::${g.rarity}` === groupKey);
    if (!group) return { ok: false, reason: 'Groupe introuvable' };
    const result = fuseEquipmentGroup(
      this.state,
      group,
      this.balance,
      this.combatEquipment.items,
      grantCombatItem
    );
    if (result.ok) {
      emit('equipmentFused', result);
      emit('stateChange', this.state);
      this.scheduleSave();
    }
    return result;
  }

  getCombatItemSellPrice(ref) {
    return getCombatItemSellPrice(this.state, ref, this.combatEquipment.items, this.balance);
  }

  doSellCombatItem(ref) {
    const result = sellCombatItem(this.state, ref, this.combatEquipment.items, this.balance);
    if (result.ok) {
      emit('combatItemSold', result);
      emit('stateChange', this.state);
      this.scheduleSave();
    }
    return result;
  }

  getDungeonKeyCount(combatZoneId) {
    const keyId = getDungeonKeyId(combatZoneId);
    return countDungeonKeys(this.state, keyId);
  }

  getMaxFarmSlots(buildingId) {
    return getMaxFarmSlotsForBuilding(this.state, this.farmData, this.balance, buildingId);
  }

  canBuyFarmSlot(buildingId) {
    return checkCanBuyFarmSlot(this.state, this.farmData, this.balance, buildingId);
  }

  getFarmSlotUnlockPreview(buildingId) {
    const current = getMaxFarmSlotsForBuilding(this.state, this.farmData, this.balance, buildingId);
    return getFarmSlotUnlockRequirements(buildingId, current, this.balance);
  }

  buyFarmSlot(buildingId, productId) {
    if (!buyFarmUnit(this.state, this.balance, buildingId, productId)) return false;
    emit('lineUnitUnlock', { buildingId, productId });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  buyFarmAnimal(buildingId) {
    const result = buyFarmAnimal(this.state, this.farmData, buildingId, this.balance);
    if (!result.ok) return result;
    emit('farmAnimalBuy', result);
    emit('stateChange', this.state);
    this.scheduleSave();
    return result;
  }

  unlockFarmAnimalSlot(buildingId) {
    const result = unlockFarmAnimalSlot(this.state, this.farmData, buildingId, this.balance);
    if (!result.ok) return result;
    emit('farmAnimalSlotUnlock', result);
    emit('stateChange', this.state);
    this.scheduleSave();
    return result;
  }

  getFarmAnimalInfo(buildingId) {
    const building = this.farmData.buildings?.[buildingId];
    const meta = getFarmBuildingMeta(this.state, buildingId);
    if (!building?.requiresAnimal) return null;
    return {
      alive: countAliveAnimals(meta),
      slots: meta.animalSlots,
      animals: meta.animals,
      emptyIndex: getEmptyAnimalSlotIndex(meta),
      nextUnlock: getNextAnimalSlotUnlock(building, meta),
      buildingLevel: this.getFarmBuildingLevel(buildingId),
    };
  }

  useCombatMeal(mealId) {
    const result = resolveCombatMeal(
      mealId,
      this.state,
      this.characterConfig,
      this.resources,
      this.balance,
      this.combatEquipment.items,
      this.enemies
    );
    if (!result) return { ok: false, reason: 'Pas en combat' };
    if (result.blocked) return { ok: false, reason: result.reason || 'Impossible' };

    if (result.cleared) {
      this.onCombatVictoryHooks(result);
      emit('combatVictory', result);
      if (result.levelResult) emit('charLevelUp', result.levelResult);
      this.scheduleSave();
    } else if (result.victory === false) {
      clearCombatMealBuff(this.state);
      emit('combatFail', result);
      this.scheduleSave();
    } else {
      emit('combatTurn', result);
      if (result.roomAdvanced) this.scheduleSave();
    }

    emit('stateChange', this.state);
    return { ok: true, ...result };
  }

  useInventoryMeal(mealId) {
    if (this.state.combatEncounter) {
      return { ok: false, reason: 'En combat, utilise le menu Objets' };
    }
    const charLevel = this.state.character?.level || 1;
    const heal = peekMealHeal(mealId, this.state, this.resources, this.balance, charLevel);
    if (!heal.ok) return { ok: false, reason: heal.reason };

    const maxHp = this.getCharacterStats().hp;
    const stored = this.state.combatWear?.solo?.hero;
    const currentHp = stored != null ? stored : maxHp;
    if (currentHp >= maxHp) {
      return { ok: false, reason: 'PV déjà au maximum' };
    }

    const gain = calcMealHealAmount(maxHp, heal.healPct);
    const newHp = Math.min(maxHp, currentHp + gain);
    if (!this.state.combatWear) this.state.combatWear = {};
    if (!this.state.combatWear.solo) this.state.combatWear.solo = {};
    this.state.combatWear.solo.hero = newHp;

    if (!consumeMealFromInventory(this.state, mealId)) {
      return { ok: false, reason: 'Plus de ce repas' };
    }

    const mealName = this.resources[mealId]?.name || mealId;
    emit('mealUsed', { mealName, healed: newHp - currentHp, hp: newHp, maxHp });
    emit('stateChange', this.state);
    this.scheduleSave();
    return { ok: true, healed: newHp - currentHp, hp: newHp, maxHp };
  }

  getFarmBuildingNavStatus(buildingId) {
    return computeFarmBuildingNavStatus(this.state, buildingId);
  }

  isFarmBuildingActive(buildingId) {
    return isAnyFarmLineActive(this.state, buildingId);
  }

  startLineHarvest(jobId, resourceId, unitIndex = 0) {
    const resource = this.resources[resourceId];
    if (!resource || !isResourceHarvestable(resource, this.state, this.balance, this.resources)) {
      return false;
    }
    if (resource.job !== jobId) return false;

    const line = this.state.productionLines?.harvest?.[jobId]?.[resourceId];
    const slot = line?.slots?.[unitIndex];
    if (slot?.active) return false;

    const toolCheck = getHarvestToolCheck(
      this.state,
      jobId,
      resource,
      this.recipes,
      this.equipment,
      this.resources
    );
    if (!toolCheck.ok) {
      emit('harvestBlocked', { jobId, resourceId, unitIndex, message: toolCheck.message });
      return false;
    }

    const result = startHarvestUnit(
      this.state,
      this.resources,
      this.jobs,
      this.balance,
      jobId,
      resourceId,
      unitIndex,
      this.recipes,
      this.equipment
    );
    if (!result.ok) return false;

    for (const { recipeId, remaining } of result.wornTools || []) {
      if (remaining <= 0) {
        const recipe = this.recipes[recipeId];
        emit('toolBroken', { recipeId, name: recipe?.name || recipeId });
      }
    }

    this.scheduleProductionTimer('harvest', { jobId, resourceId }, unitIndex, result.duration);
    emit('harvestStart', { resourceId, jobId, unitIndex, duration: result.duration, phase: 'harvesting' });
    emit('stateChange', this.state);
    return true;
  }

  startSlotHarvest(jobId, resourceId, unitIndex = 0) {
    return this.startLineHarvest(jobId, resourceId, unitIndex);
  }

  completeHarvestLine(jobId, resourceId, unitIndex) {
    const timerKey = `h_${jobId}_${resourceId}_${unitIndex}`;
    delete this.harvestTimers[timerKey];

    const outcome = completeHarvestUnit(
      this.state,
      this.resources,
      this.jobs,
      this.balance,
      jobId,
      resourceId,
      unitIndex,
      this.recipes,
      this.equipment
    );
    if (!outcome) return;

    if (outcome.phase === 'harvested') {
      for (const { recipeId, remaining } of outcome.wornTools || []) {
        if (remaining <= 0) {
          const recipe = this.recipes[recipeId];
          emit('toolBroken', { recipeId, name: recipe?.name || recipeId });
        }
      }
      this.onHarvestForQuests(resourceId, outcome.yield);
      this.scheduleProductionTimer('harvest', { jobId, resourceId }, unitIndex, outcome.regrowthDuration);
      emit('harvestComplete', {
        resourceId,
        jobId,
        unitIndex,
        yield: outcome.yield,
        xp: outcome.xp,
        levelResult: outcome.levelResult,
        dailyBonus: outcome.dailyBonus,
      });
      emit('regrowthStart', { resourceId, jobId, unitIndex, duration: outcome.regrowthDuration });
      ensureProductionLines(this.state, this.resources, this.farmData, this.balance);
    } else if (outcome.phase === 'ready') {
      emit('regrowthComplete', { resourceId, jobId, unitIndex });
    }

    emit('stateChange', this.state);
    this.scheduleSave();
  }

  completeSlotHarvest(jobId, resourceId, unitIndex = 0) {
    this.completeHarvestLine(jobId, resourceId, unitIndex);
  }

  getLineHarvestProgress(jobId, resourceId, unitIndex) {
    const slot = this.state.productionLines?.harvest?.[jobId]?.[resourceId]?.slots?.[unitIndex];
    return getUnitProgress(slot);
  }

  getSlotHarvestProgress(jobId, resourceId, unitIndex = 0) {
    return this.getLineHarvestProgress(jobId, resourceId, unitIndex);
  }

  isJobHarvesting(jobId) {
    return isAnyHarvestActive(this.state, jobId);
  }

  getJobHarvestNavStatus(jobId) {
    return computeJobHarvestNavStatus(this.state, jobId);
  }

  isHarvesting() {
    return isAnyProductionActive(this.state);
  }

  getActiveHarvests() {
    const active = {};
    for (const timer of listActiveProductionTimers(this.state)) {
      if (timer.kind !== 'harvest') continue;
      active[`${timer.jobId}_${timer.resourceId}_${timer.unitIndex}`] = timer.slot.active;
    }
    return active;
  }

  getProductionLinesForJob(jobId) {
    return this.state.productionLines?.harvest?.[jobId] || {};
  }

  getProductionLinesForFarm(buildingId) {
    return this.state.productionLines?.farm?.[buildingId] || {};
  }

  getFarmMeta(buildingId) {
    return getFarmBuildingMeta(this.state, buildingId);
  }

  getFarmBuildingLevel(buildingId) {
    return computeFarmBuildingLevel(this.state, buildingId);
  }

  getFarmBuildingProgress(buildingId) {
    return computeFarmBuildingProgress(this.state, buildingId, this.jobs, this.balance);
  }

  isCraftUnlocked() {
    return isCraftJobUnlocked('toolmaker', this.state, this.balance);
  }

  isCookUnlocked() {
    return isCraftJobUnlocked('cook', this.state, this.balance);
  }

  isCombatViewUnlocked() {
    return isCombatUnlocked(this.state, this.balance);
  }

  sell(resourceId, amount = null) {
    const inventory = this.state.inventory[resourceId] || 0;
    const sellAmount = amount ?? inventory;
    if (sellAmount <= 0) return 0;

    const resource = this.resources[resourceId];
    if (resource?.notSellable || resource?.merchantOnly) return 0;
    const artisanMult = resource?.craftOnly ? getCraftSellBonus(this.state, this.jobs) : 1;
    const raw = sellResource(resourceId, sellAmount, this.resources, this.state.inventory, artisanMult);
    const earnings = this.applyKirhaBonus(raw);

    if (earnings > 0) {
      this.state.kirha += earnings;
      this.trackEarnings(earnings);
      emit('sell', { resourceId, amount: sellAmount, earnings });
      emit('stateChange', this.state);
      this.scheduleSave();
    }
    return earnings;
  }

  sellEverything() {
    let rawTotal = 0;
    const artisanBonus = getCraftSellBonus(this.state, this.jobs);

    for (const [id, amount] of Object.entries({ ...this.state.inventory })) {
      if (amount <= 0 || !this.resources[id]) continue;
      if (this.resources[id].notSellable || this.resources[id].merchantOnly) continue;
      const mult = this.resources[id].craftOnly ? artisanBonus : 1;
      rawTotal += this.resources[id].sellPrice * amount * mult;
      this.state.inventory[id] = 0;
    }

    const earnings = this.applyKirhaBonus(rawTotal);
    if (earnings > 0) {
      this.state.kirha += earnings;
      this.trackEarnings(earnings);
      emit('sell', { all: true, earnings });
      emit('stateChange', this.state);
      this.scheduleSave();
    }
    return earnings;
  }

  sellEverythingExcept(excludeIds = []) {
    const exclude = new Set(excludeIds);
    let rawTotal = 0;
    const artisanBonus = getCraftSellBonus(this.state, this.jobs);

    for (const [id, amount] of Object.entries({ ...this.state.inventory })) {
      if (amount <= 0 || !this.resources[id]) continue;
      if (exclude.has(id)) continue;
      if (this.resources[id].notSellable || this.resources[id].merchantOnly) continue;
      const mult = this.resources[id].craftOnly ? artisanBonus : 1;
      rawTotal += this.resources[id].sellPrice * amount * mult;
      this.state.inventory[id] = 0;
    }

    const earnings = this.applyKirhaBonus(rawTotal);
    if (earnings > 0) {
      this.state.kirha += earnings;
      this.trackEarnings(earnings);
      emit('sell', { all: true, earnings, except: [...exclude] });
      emit('stateChange', this.state);
      this.scheduleSave();
    }
    return earnings;
  }

  toggleBankProtected(resourceId) {
    if (!this.resources[resourceId]) return false;
    const list = this.state.bankProtected || (this.state.bankProtected = []);
    const idx = list.indexOf(resourceId);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(resourceId);
    emit('stateChange', this.state);
    this.scheduleSave();
    return idx < 0;
  }

  buyUpgrade() {
    return false;
  }

  getUpgradesForJob() {
    return [];
  }

  getUpgradeCostFor() {
    return null;
  }

  getAideCostFor(aideId) {
    const aide = this.aides[aideId];
    if (!aide) return null;
    if (aide.requiresZone && !isZoneUnlocked(aide.requiresZone, this.state, this.balance)) return null;
    const level = this.state.aides[aideId] || 0;
    if (level >= aide.maxLevel) return null;
    return getAideCost(aide, level);
  }

  getScrollCount() {
    return this.state.inventory.ancient_scroll || 0;
  }

  getMerchantVendors() {
    const testVendors = buildTestHdvVendors(
      this.state,
      this.resources,
      this.farmData,
      this.balance,
      this.jobs
    );
    return mergeMerchantVendors(this.merchant, testVendors);
  }

  canBuyMerchant(vendorId, offerId, quantity) {
    const offer = getVendorOffer(this.merchant, vendorId, offerId, this.getMerchantVendors());
    return canBuyOffer(offer, quantity, this.state, this.resources);
  }

  buyMerchant(vendorId, offerId, quantity) {
    const offer = getVendorOffer(this.merchant, vendorId, offerId, this.getMerchantVendors());
    const result = buyOffer(offer, quantity, this.state, this.resources);
    if (!result) return false;
    emit('merchantBuy', { vendorId, offerId, ...result });
    emit('stateChange', this.state);
    SaveProvider.save(this.state);
    this.scheduleSave();
    return true;
  }

  canSellMerchant(vendorId, offerId, quantity) {
    const offer = getVendorOffer(this.merchant, vendorId, offerId, this.getMerchantVendors());
    return canSellOffer(offer, quantity, this.state);
  }

  sellMerchant(vendorId, offerId, quantity) {
    const offer = getVendorOffer(this.merchant, vendorId, offerId, this.getMerchantVendors());
    const result = sellOffer(offer, quantity, this.state);
    if (!result) return false;
    emit('merchantSell', { vendorId, offerId, ...result });
    emit('stateChange', this.state);
    SaveProvider.save(this.state);
    this.scheduleSave();
    return true;
  }

  doCraft(recipeId) {
    return this.craftItem(recipeId).ok;
  }

  doEquip(recipeId) {
    if (!equip(recipeId, this.state, this.equipment, this.recipes)) return false;
    emit('equip', { recipeId });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  doUnequip(slotOrJob, slotKind = 'tool') {
    const ok = slotOrJob === 'global'
      ? unequipGathering(this.state, null, 'global')
      : unequipGathering(this.state, slotOrJob, slotKind);
    if (!ok) return false;
    emit('unequip', { slot: slotOrJob, slotKind });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  doEquipCombat(ref) {
    if (!equipCombatItem(this.state, ref, this.combatEquipment.items)) return false;
    emit('equipCombat', { ref });
    this.processQuests();
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  doUnequipCombat(slot) {
    if (!unequipCombatSlot(this.state, slot)) return false;
    emit('unequipCombat', { slot });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  canDismantleCombat(ref) {
    return canDismantleCombatItem(
      ref,
      this.state,
      this.recipes,
      this.combatEquipment.items
    );
  }

  getDismantlePreview(ref) {
    return buildDismantlePreview(
      ref,
      this.state,
      this.recipes,
      this.combatEquipment.items,
      this.balance
    );
  }

  doDismantleCombat(ref) {
    const result = dismantleCombatItem(
      ref,
      this.state,
      this.recipes,
      this.combatEquipment.items,
      this.balance
    );
    if (!result?.ok) return result;
    emit('dismantleCombat', result);
    emit('stateChange', this.state);
    this.scheduleSave();
    return result;
  }

  getEquippableItems() {
    return Object.keys(this.equipment.equipable).filter((id) =>
      canEquip(id, this.state, this.equipment, this.recipes)
    );
  }

  getOwnedCombatItems(forHero = true) {
    return (this.state.ownedCombatItems || []).filter((ref) => {
      const item = resolveItem(this.state, ref, this.combatEquipment.items);
      if (!item) return false;
      if (forHero) {
        if (item.companionOnly) return false;
        if (!COMBAT_SLOT_IDS.includes(item.slot)) return false;
        const owner = findCombatItemOwner(this.state, ref);
        if (owner && owner !== 'hero') return false;
        const equipped = this.state.combatEquipment?.[item.slot] === ref;
        return !equipped;
      }
      return false;
    });
  }

  getCombatItemLabel(ref) {
    const item = resolveItem(this.state, ref, this.combatEquipment.items);
    if (!item) return ref;
    const cls = getWeaponClassLabel(item);
    if (item.slot === 'weapon' && cls) {
      return `${item.emoji} ${item.name} (${cls})`;
    }
    return `${item.emoji} ${item.name}`;
  }

  getCompanionOwnedItems(companionId) {
    return getCompanionEquippableItems(this.state, companionId, this.combatEquipment.items);
  }

  getCharacterStats() {
    return getCombatStats(this.state, this.characterConfig, this.combatEquipment, this.combatEquipment.items, this.balance);
  }

  getCharacterStatsBreakdown() {
    return getCombatStatsBreakdown(this.state, this.characterConfig, this.combatEquipment, this.combatEquipment.items, this.balance);
  }

  getCharacterProgress() {
    return getCharacterProgress(this.state, this.characterConfig, this.balance);
  }

  getSeasonCapPreview() {
    return getSeasonCapPreview(this.state, this.balance);
  }

  getCharacterDisplayName() {
    return getCharacterDisplayName(this.state, this.characterConfig);
  }

  getNicknameRenameInfo() {
    return getNicknameRenameInfo(this.state, this.characterConfig);
  }

  setCharacterNickname(name, isRename = false, options = {}) {
    const result = applyCharacterNickname(this.state, name, this.characterConfig, { isRename });
    if (!result.ok) return result;

    emit('nicknameChange', result);
    if (!options.silent) {
      emit('stateChange', this.state);
      this.scheduleSave();
    }
    return result;
  }

  getCombatZoneForWorldZone(zoneId) {
    return this.combatZones[zoneId] || null;
  }

  canStartFight(zoneId, isBoss = false, monsterIndex = 0) {
    const combatZone = this.combatZones[zoneId];
    if (!combatZone) return { ok: false, reason: 'Zone de combat inconnue' };
    return canFight(combatZone, this.state, this.balance, this.characterConfig, isBoss, monsterIndex);
  }

  /** Progression déblocage entraînement (indépendant d'un combat en cours). */
  getTrainingUnlock(zoneId, isBoss = false, monsterIndex = 0) {
    const combatZone = this.combatZones[zoneId];
    if (!combatZone) return { ok: false, reason: 'Zone inconnue' };
    return getTrainingUnlockCheck(combatZone, this.state, this.balance, isBoss, monsterIndex);
  }

  startCombatFight(zoneId, monsterIndex, isBoss = false) {
    const combatZone = this.combatZones[zoneId];
    if (!combatZone) return { ok: false, reason: 'Zone inconnue' };

    const foe = isBoss ? combatZone.boss : combatZone.monsters[monsterIndex];
    if (!foe) return { ok: false, reason: 'Ennemi inconnu' };

    const result = startFight(
      combatZone,
      foe,
      isBoss,
      this.state,
      this.balance,
      this.characterConfig,
      this.combatEquipment.items,
      this.enemies,
      this.companions,
      monsterIndex
    );

    if (!result.ok) return result;

    emit('combatStart', { zoneId, isBoss, foe });
    emit('stateChange', this.state);
    return { ok: true, zoneId, foe, isBoss };
  }

  canEnterDungeonZone(zoneId) {
    const combatZone = this.combatZones[zoneId];
    if (!combatZone) return { ok: false, reason: 'Zone inconnue' };
    return checkEnterDungeon(combatZone, this.state, this.balance, this.characterConfig);
  }

  getCombatDailyStatus() {
    return getCombatDailyStatus(this.state, this.balance);
  }

  getDungeonUnlockProgress(zoneId) {
    const combatZone = this.combatZones[zoneId];
    if (!combatZone) return null;
    return getDungeonUnlockProgress(combatZone, this.state, this.balance);
  }

  getDungeonUnlockConfig() {
    return getDungeonUnlockConfig(this.balance);
  }

  startDungeonRun(zoneId) {
    const combatZone = this.combatZones[zoneId];
    if (!combatZone) return { ok: false, reason: 'Zone inconnue' };

    const result = startZoneDungeonRun(
      combatZone,
      this.state,
      this.balance,
      this.characterConfig,
      this.combatEquipment.items,
      this.enemies,
      this.companions
    );

    if (!result.ok) return result;

    emit('combatStart', { zoneId, isDungeon: true, roomCount: result.roomCount });
    emit('stateChange', this.state);
    return { ok: true, zoneId, roomCount: result.roomCount };
  }

  getActiveCombat() {
    return getActiveEncounter(this.state, this.combatZones);
  }

  getPlayerCombatSkills() {
    return getActiveMemberSkills(
      this.state,
      this.combatEquipment.items,
      this.combatSkills,
      this.weaponRoles
    );
  }

  getActiveCombatMember() {
    return getActiveCombatMember(this.state);
  }

  getDefendAction() {
    return DEFEND_ACTION;
  }

  getUnlockedCompanionCount() {
    return getUnlockedCompanionCount(this.state, this.companions);
  }

  getActiveCompanionCount() {
    return getActiveCompanionCount(this.state, this.companions);
  }

  doToggleCompanionParty(companionId) {
    const result = toggleCompanionParty(companionId, this.state, this.companions);
    if (!result.ok) return result;
    emit('companionPartyToggle', result);
    emit('stateChange', this.state);
    this.scheduleSave();
    return result;
  }

  canUnlockCompanion(companionId) {
    return checkUnlockCompanion(companionId, this.state, this.companions);
  }

  doUnlockCompanion(companionId) {
    const result = unlockCompanion(companionId, this.state, this.companions);
    if (!result.ok) return result;
    emit('companionUnlock', result);
    emit('stateChange', this.state);
    this.scheduleSave();
    return result;
  }

  doEquipCompanion(companionId, ref) {
    if (!equipCompanionItem(this.state, companionId, ref, this.combatEquipment.items)) return false;
    emit('equipCompanion', { companionId, ref });
    this.processQuests();
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  doUnequipCompanion(companionId, slot) {
    if (!unequipCompanionSlot(this.state, companionId, slot)) return false;
    emit('unequipCompanion', { companionId, slot });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  getCompanionStatsFor(companionId) {
    return getCompanionStats(companionId, this.state, this.characterConfig, this.combatEquipment.items);
  }

  useCombatSkill(skillId, targetId = 'enemy') {
    const result = resolveCombatSkill(
      skillId,
      this.state,
      this.combatSkills,
      this.characterConfig,
      this.enemies,
      targetId,
      this.balance,
      this.combatEquipment.items
    );
    if (!result) return null;

    if (result.cleared) {
      this.onCombatVictoryHooks(result);
      emit('combatVictory', result);
      if (result.levelResult) emit('charLevelUp', result.levelResult);
      this.scheduleSave();
    } else if (result.victory === false) {
      clearCombatMealBuff(this.state);
      emit('combatFail', result);
      this.scheduleSave();
    } else {
      emit('combatTurn', result);
      if (result.roomAdvanced) this.scheduleSave();
    }

    emit('stateChange', this.state);
    return result;
  }

  useCombatDefend() {
    const result = resolveCombatDefend(this.state, this.characterConfig, this.enemies, this.balance, this.combatEquipment.items);
    if (!result) return null;

    if (result.victory === false) {
      clearCombatMealBuff(this.state);
      emit('combatFail', result);
      this.scheduleSave();
    } else if (result.cleared) {
      this.onCombatVictoryHooks(result);
      emit('combatVictory', result);
      if (result.levelResult) emit('charLevelUp', result.levelResult);
      this.scheduleSave();
    } else {
      emit('combatTurn', result);
      if (result.roomAdvanced) this.scheduleSave();
    }

    emit('stateChange', this.state);
    return result;
  }

  stepCombatEnemyTurn() {
    const result = resolveCombatEnemyStep(this.state, this.characterConfig, this.enemies, this.balance, this.combatEquipment.items);
    if (!result) return null;

    if (result.cleared) {
      this.onCombatVictoryHooks(result);
      emit('combatVictory', result);
      if (result.levelResult) emit('charLevelUp', result.levelResult);
      this.scheduleSave();
    } else if (result.victory === false) {
      clearCombatMealBuff(this.state);
      emit('combatFail', result);
      this.scheduleSave();
    } else {
      emit('combatTurn', result);
      if (result.roomAdvanced) this.scheduleSave();
    }

    emit('stateChange', this.state);
    return result;
  }

  abandonCombat() {
    clearCombatEncounter(this.state);
    clearCombatMealBuff(this.state);
    emit('combatAbandon', {});
    emit('stateChange', this.state);
    this.scheduleSave();
  }

  buyAide(aideId) {
    const aide = this.aides[aideId];
    if (!aide) return false;
    if (aide.requiresZone && !isZoneUnlocked(aide.requiresZone, this.state, this.balance)) return false;

    const level = this.state.aides[aideId] || 0;
    if (level >= aide.maxLevel) return false;

    const cost = getAideCost(aide, level);
    if (this.state.kirha < cost) return false;

    this.state.kirha -= cost;
    this.state.aides[aideId] = level + 1;
    emit('aideUpgrade', { aideId, level: level + 1, cost });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  doPrestige() {
    if (!canPrestige(this.state, this.balance, this.quests, this.combatZones)) return false;
    Object.values(this.harvestTimers).forEach(clearTimeout);
    this.harvestTimers = {};

    const newState = applyPrestige(
      this.state,
      this.balance,
      () => this.getDefaultState(),
      this.achievements,
      this.combatZones
    );
    const season = newState.season;
    this.state = this.mergeState(newState);
    this.passiveAccum = {};

    emit('prestige', { season, prestige: this.state.prestige });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  getPrestigeInfo() {
    return getPrestigePreview(this.state, this.balance, this.quests, this.combatZones);
  }

  getPrestigeProgress() {
    return getPrestigeProgress(this.state, this.balance, this.quests, this.combatZones);
  }

  getSeasonCapProximity() {
    return getSeasonCapProximity(this.state, this.balance);
  }

  shouldShowPrestigeTeaser() {
    return shouldShowPrestigeTeaser(this.state, this.balance, this.quests, this.combatZones);
  }

  updateSettings(partial) {
    this.state.settings = { ...this.state.settings, ...partial };
    emit('settingsChange', this.state.settings);
    emit('stateChange', this.state);
    this.scheduleSave();
  }

  exportSave() {
    return SaveProvider.encode(this.state);
  }

  importSave(encoded) {
    const gate = this.canImportSave();
    if (!gate.ok) return { ok: false, error: gate.reason };
    try {
      const parsed = SaveProvider.decode(encoded);
      const sanity = validateSaveSanity(parsed.data, this.balance);
      if (!sanity.ok) return { ok: false, error: sanity.reason || 'Sauvegarde suspecte.' };
      Object.values(this.harvestTimers).forEach(clearTimeout);
      this.harvestTimers = {};
      this.state = this.mergeState(parsed.data);
      this.state.lastOnline = Date.now();
      this.restoreHarvestTimers();
      SaveProvider.save(this.state, this.balance);
      emit('stateChange', this.state);
      emit('settingsChange', this.state.settings);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Impossible de lire la sauvegarde' };
    }
  }

  resetSave() {
    const settings = this.state.settings;
    const accountMeta = this.state.meta?.account
      ? JSON.parse(JSON.stringify(this.state.meta.account))
      : null;
    Object.values(this.harvestTimers).forEach(clearTimeout);
    this.harvestTimers = {};
    this.state = this.getDefaultState();
    this.state.settings = settings;
    if (accountMeta?.mode) {
      this.state.meta.account = accountMeta;
    }
    if (this.balance.betaMode) applyBetaUnlocks(this.state, this.companions);
    SaveProvider.markFreshReset();
    SaveProvider.save(this.state);
    emit('stateChange', this.state);
    return true;
  }


  getGoldNuggetCount() {
    return this.state.inventory.gold_nugget || 0;
  }

  exchangeGoldNuggets(mode, quantity = 1) {
    const qty = Math.max(1, Math.floor(quantity || 1));
    const have = this.getGoldNuggetCount();
    const cfg = this.balance.goldNuggetExchange || {};
    if (mode === 'scroll') {
      const cost = (cfg.scrollCost ?? 5) * qty;
      if (have < cost) return { ok: false, reason: `Il faut ${cost} pépite(s) d'or.` };
      this.state.inventory.gold_nugget = have - cost;
      if (this.state.inventory.gold_nugget <= 0) delete this.state.inventory.gold_nugget;
      this.state.inventory.ancient_scroll = (this.state.inventory.ancient_scroll || 0) + qty;
      emit('stateChange', this.state);
      this.scheduleSave();
      return { ok: true, gained: qty, resourceId: 'ancient_scroll' };
    }
    if (mode === 'kirha') {
      const perNugget = cfg.kirhaPerNugget ?? 40;
      if (have < qty) return { ok: false, reason: `Il faut ${qty} pépite(s) d'or.` };
      this.state.inventory.gold_nugget = have - qty;
      if (this.state.inventory.gold_nugget <= 0) delete this.state.inventory.gold_nugget;
      this.state.kirha = (this.state.kirha || 0) + perNugget * qty;
      emit('stateChange', this.state);
      this.scheduleSave();
      return { ok: true, gained: perNugget * qty, resourceId: 'kirha' };
    }
    return { ok: false, reason: 'Échange inconnu.' };
  }

  getGoldNuggetExchangeInfo() {
    const cfg = this.balance.goldNuggetExchange || {};
    return {
      scrollCost: cfg.scrollCost ?? 5,
      kirhaPerNugget: cfg.kirhaPerNugget ?? 40,
      owned: this.getGoldNuggetCount(),
    };
  }

  getJobProgress(jobId) {
    const job = this.jobs[jobId];
    if (!job) return null;
    const jobData = this.state.jobs[jobId] || { level: 1, xp: 0 };
    const needed = getXpForLevel(job, jobData.level);
    const seasonCap = getSeasonLevelCap('jobs', this.state, this.balance);
    return {
      ...jobData,
      needed,
      job,
      seasonCap,
      atSeasonCap: jobData.level >= seasonCap,
    };
  }

  getCraftJobs() {
    return Object.values(this.jobs).filter((j) => j.id === 'toolmaker');
  }

  getCuisineJob() {
    return this.jobs.cook || null;
  }

  getGatheringJobs() {
    return Object.values(this.jobs).filter((j) => j.gathering);
  }

  getAllJobs() {
    return Object.values(this.jobs);
  }

  isZoneUnlocked(zoneId) {
    return isZoneUnlocked(zoneId, this.state, this.balance);
  }

  getJobLevel(jobId) {
    return getJobLevel(this.state, jobId);
  }
}
