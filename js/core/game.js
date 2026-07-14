import { SaveProvider, mergeSettings } from './save.js';
import { emit } from './events.js';
import { isGuestAccount, isRegisteredAccount, getAuthState } from './auth.js';
import { loadCloudSave, saveCloudSave, mergeCloudAndLocal } from './cloudSave.js';
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
import {
  ensureSlots,
  getMaxSlots,
  buySlot,
  assignSlotResource,
  clearSlotAssignment,
  getSlotProgress,
  canBuySlot,
  getSlotUnlockCost,
  getSlotUnlockRequirements,
  normalizePurchasedSlots,
} from '../systems/slots.js';
import { getJobHarvestNavStatus } from '../systems/resourceVisual.js';
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
  isQuestReady,
  completeQuest,
  incrementQuestProgress,
  applyQuestRewards,
  getActiveQuests,
  getNextQuest,
  isQuestCompleted,
  getQuestsByChapter,
  getQuestGuidance,
} from '../systems/quests.js';
import {
  unlockWorldZone,
  canPayUnlockZone,
  tryAutoUnlockFromBoss,
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
  getFarmBuildingNavStatus,
  syncExpiredFarmSlots,
  wearBreederTool,
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
  sakura_wood: 'frene',
  herbs: 'ortie',
  petal_wood: 'noyer',
  fish: 'goujon',
  sakura_carp: 'carpe',
  jade_ore: 'fer',
  moon_stone: 'kobalte',
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
  constructor(resources, jobs, balance, recipes, aides, equipment, farmData, characterConfig, combatEquipment, combatZones, enemies, merchant, combatSkills, companions, quests, weaponRoles) {
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
    this.quests = quests || {};
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
      purchasedSlots: normalizePurchasedSlots(null, this.balance),
      harvestSlots: {},
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
      stats: { totalHarvests: 0, totalEarned: 0, passiveHarvests: 0, offlineHarvests: 0 },
      quests: buildDefaultQuestState(),
      farmSlots: {},
      purchasedFarmSlots: {},
      activeMeal: null,
      combatMealBuff: null,
      bankProtected: [],
      careerChoice: null,
      meta: {},
    };
    ensureSlots(state, this.balance);
    ensureFarmSlots(state, this.farmData, this.balance);
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
      const mapped = LEGACY_RESOURCE_MAP[id] || id;
      if (this.resources[mapped]) inv[mapped] = (inv[mapped] || 0) + amount;
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
      purchasedSlots: normalizePurchasedSlots(saved.purchasedSlots, this.balance),
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
      stats: { ...defaults.stats, ...(saved.stats || {}) },
      harvestSlots: this.migrateHarvestSlots(saved.harvestSlots),
      farmSlots: saved.farmSlots || {},
      purchasedFarmSlots: saved.purchasedFarmSlots || {},
      activeMeal: saved.activeMeal || null,
      combatMealBuff: null,
      quests: migrateQuests(saved.quests),
      bankProtected: saved.bankProtected || defaults.bankProtected,
      careerChoice: migrateCareerChoice(saved.careerChoice),
      meta: { ...defaults.meta, ...(saved.meta || {}) },
    };
    ensureSlots(merged, this.balance);
    ensureFarmSlots(merged, this.farmData, this.balance);
    migrateCombatItemInstances(merged, this.combatEquipment.items);
    migrateCombatDurability(merged, this.combatEquipment.items);
    migrateLegacyCombatResources(merged);
    migrateToolDurability(merged, this.recipes);
    repairCraftSave(merged, this.recipes);
    if (this.balance.betaMode) applyBetaUnlocks(merged, this.companions);
    return merged;
  }

  async init() {
    const saved = await SaveProvider.load(this.balance);
    let localState = saved ? this.mergeState(saved) : null;
    this.state = localState || this.getDefaultState();

    const { initAuth, syncAuthFromState, getAuthState } = await import('./auth.js');
    syncAuthFromState(this.state);
    await initAuth(this);
    localState = this.state;

    const auth = getAuthState();
    if (auth.mode === 'registered' && auth.userId && auth.userId !== 'dev_local_user') {
      const cloud = await loadCloudSave(auth.userId);
      const freshReset = SaveProvider.isFreshReset();
      const hasLocalSave = !!localState;
      const shouldMergeCloud = !freshReset && (
        !hasLocalSave
          ? !!cloud?.data
          : !!localState?.careerChoice?.confirmed && !!cloud?.data
      );
      if (shouldMergeCloud) {
        const merged = await mergeCloudAndLocal(cloud, localState, this.balance);
        this.state = merged ? this.mergeState(merged) : localState;
        syncAuthFromState(this.state);
      }
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
    return Object.values(this.resources).filter((r) => {
      if (r.craftOnly || r.combatOnly || r.job !== jobId) return false;
      if (!isZoneUnlocked(r.zone, this.state, this.balance)) return false;
      return r.zone === this.state.zone;
    }).sort((a, b) => (a.requiredJobLevel || 1) - (b.requiredJobLevel || 1));
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
    let changed = false;
    for (const quest of Object.values(this.quests)) {
      if (isQuestCompleted(this.state, quest.id)) continue;
      if (!isQuestReady(quest, this.state, this.recipes)) continue;
      if (!completeQuest(quest.id, this.state)) continue;
      applyQuestRewards(this.state, quest, this.balance);
      emit('questComplete', { questId: quest.id, quest });
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
    for (const quest of Object.values(this.quests)) {
      if (quest.type !== 'harvest_resource') continue;
      if (isQuestCompleted(this.state, quest.id)) continue;
      const ids = quest.resourceIds || (quest.resourceId ? [quest.resourceId] : []);
      if (!ids.includes(resourceId)) continue;
      incrementQuestProgress(this.state, quest.id, yield_ || 1);
    }
    this.processQuests();
  }

  onCombatVictoryHooks(result) {
    const zoneId = result?.zoneId;
    if (result?.isDungeon && zoneId) {
      const zone = this.combatZones[zoneId];
      const jobXpMap = zone?.jobXpReward || this.balance.combat?.dungeonJobXp?.default || {};
      for (const [jobId, xp] of Object.entries(jobXpMap)) {
        if (xp > 0) addJobXp(this.state, jobId, xp, this.jobs, this.balance);
      }
    }
    if (result?.isBoss && zoneId) {
      const unlocked = tryAutoUnlockFromBoss(zoneId, this.state, this.balance);
      if (unlocked) {
        const zone = this.balance.zones[unlocked];
        emit('zoneUnlock', { zoneId: unlocked, zone, auto: true });
      }
    }
    clearCombatMealBuff(this.state);
    this.processQuests();
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

  getMaxHarvestSlots(jobId) {
    return getMaxSlots(this.state, this.balance, jobId);
  }

  buyHarvestSlot(jobId) {
    if (!buySlot(this.state, this.balance, jobId)) return false;
    emit('slotUnlock', { slots: getMaxSlots(this.state, this.balance, jobId), jobId });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  getNextSlotCost(jobId) {
    const current = getMaxSlots(this.state, this.balance, jobId);
    return getSlotUnlockCost(current, this.balance);
  }

  getSlotUnlockPreview(jobId) {
    const current = getMaxSlots(this.state, this.balance, jobId);
    return getSlotUnlockRequirements(jobId, current, this.balance);
  }

  canBuyHarvestSlot(jobId) {
    return canBuySlot(this.state, this.balance, jobId);
  }

  assignResourceToSlot(jobId, slotIndex, resourceId) {
    const resource = this.resources[resourceId];
    if (!resource || !isResourceHarvestable(resource, this.state, this.balance)) return false;
    if (resource.job !== jobId) return false;
    if (!assignSlotResource(this.state, jobId, slotIndex, resourceId)) return false;
    emit('harvestSlotAssign', { jobId, slotIndex });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  clearSlot(jobId, slotIndex) {
    if (!clearSlotAssignment(this.state, jobId, slotIndex)) return false;
    emit('harvestSlotAssign', { jobId, slotIndex });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  scheduleHarvestTimer(jobId, slotIndex, delayMs) {
    const timerKey = `${jobId}_${slotIndex}`;
    clearTimeout(this.harvestTimers[timerKey]);
    this.harvestTimers[timerKey] = setTimeout(
      () => this.completeSlotHarvest(jobId, slotIndex),
      Math.max(0, delayMs)
    );
  }

  restoreHarvestTimers() {
    Object.values(this.harvestTimers).forEach(clearTimeout);
    this.harvestTimers = {};

    for (const [jobId, slots] of Object.entries(this.state.harvestSlots || {})) {
      slots.forEach((slot, slotIndex) => {
        if (!slot?.active) return;
        if (!slot.active.phase) slot.active.phase = 'harvesting';
        const elapsed = Date.now() - slot.active.start;
        const remaining = slot.active.duration - elapsed;
        if (remaining <= 0) {
          this.completeSlotHarvest(jobId, slotIndex);
        } else {
          this.scheduleHarvestTimer(jobId, slotIndex, remaining);
        }
      });
    }
  }

  restoreFarmTimers() {
    Object.values(this.farmTimers).forEach(clearTimeout);
    this.farmTimers = {};

    for (const [buildingId, slots] of Object.entries(this.state.farmSlots || {})) {
      slots.forEach((slot, slotIndex) => {
        if (!slot?.active) return;
        const elapsed = Date.now() - slot.active.start;
        const remaining = slot.active.duration - elapsed;
        if (remaining <= 0) {
          this.completeFarmSlot(buildingId, slotIndex);
        } else {
          this.scheduleFarmTimer(buildingId, slotIndex, remaining);
        }
      });
    }
  }

  scheduleFarmTimer(buildingId, slotIndex, delayMs) {
    const key = `farm_${buildingId}_${slotIndex}`;
    clearTimeout(this.farmTimers[key]);
    this.farmTimers[key] = setTimeout(
      () => this.completeFarmSlot(buildingId, slotIndex),
      Math.max(0, delayMs)
    );
  }

  setFarmFeed(buildingId, slotIndex, feedId) {
    const slot = this.state.farmSlots?.[buildingId]?.[slotIndex];
    if (!slot || slot.active) return false;
    slot.feedId = feedId || null;
    emit('farmFeedChange', { buildingId, slotIndex });
    this.scheduleSave();
    return true;
  }

  startFarmSlot(buildingId, slotIndex) {
    const building = this.farmData.buildings?.[buildingId];
    if (!building) return { ok: false, reason: 'Bâtiment inconnu' };

    const slot = this.state.farmSlots?.[buildingId]?.[slotIndex];
    if (slot?.active) {
      const progress = this.getFarmSlotProgress(buildingId, slotIndex);
      if (progress >= 1) {
        this.completeFarmSlot(buildingId, slotIndex);
      } else {
        const pct = Math.min(99, Math.floor(progress * 100));
        return { ok: false, reason: `Production en cours (${pct} %)` };
      }
    }

    const toolCheck = getFarmToolCheck(this.state, this.recipes, this.equipment);
    if (!toolCheck.ok) {
      return { ok: false, reason: toolCheck.message };
    }

    const result = startFarmProduction(this.state, this.farmData, buildingId, slotIndex);
    if (!result.ok) return result;

    const duration = result.duration;

    this.scheduleFarmTimer(buildingId, slotIndex, duration);
    emit('farmStart', { buildingId, slotIndex, duration });
    emit('stateChange', this.state);
    this.scheduleSave();
    return { ok: true };
  }

  completeFarmSlot(buildingId, slotIndex) {
    const key = `farm_${buildingId}_${slotIndex}`;
    delete this.farmTimers[key];

    const outcome = completeFarmProduction(
      this.state,
      this.farmData,
      buildingId,
      slotIndex,
      this.jobs,
      this.balance
    );
    if (!outcome) return;

    const wornTools = wearBreederTool(this.state, this.recipes, this.equipment);
    for (const { recipeId, remaining } of wornTools) {
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

  getFarmSlotProgress(buildingId, slotIndex) {
    const slot = this.state.farmSlots?.[buildingId]?.[slotIndex];
    return getFarmSlotProgress(slot);
  }

  isFarmActive() {
    return isAnyFarmActive(this.state);
  }

  getFarmToolBlockReason(buildingId) {
    const building = this.farmData.buildings?.[buildingId];
    if (!building) return null;
    const check = getFarmToolCheck(this.state, this.recipes, this.equipment);
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

  doApplyCareerChoice(gatheringJobs, farmBuildings, weaponType) {
    const result = applyCareerChoice(this.state, gatheringJobs, farmBuildings, weaponType);
    if (!result.ok) return result;
    this.applyStarterWeaponTeam(result.careerChoice.weaponType);
    ensureSlots(this.state, this.balance);
    ensureFarmSlots(this.state, this.farmData, this.balance);
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

  buyFarmSlot(buildingId) {
    if (!purchaseFarmSlot(this.state, this.farmData, this.balance, buildingId)) return false;
    emit('farmSlotUnlock', { buildingId, slots: this.getMaxFarmSlots(buildingId) });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  buyFarmAnimal(buildingId, slotIndex) {
    const result = purchaseFarmAnimal(this.state, this.farmData, buildingId, slotIndex);
    if (!result.ok) return result;
    emit('farmFeedChange', { buildingId, slotIndex });
    this.scheduleSave();
    return result;
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
    return getFarmBuildingNavStatus(this.state, buildingId);
  }

  isFarmBuildingActive(buildingId) {
    return (this.state.farmSlots?.[buildingId] || []).some((s) => s.active);
  }

  startSlotHarvest(jobId, slotIndex) {
    const slot = this.state.harvestSlots?.[jobId]?.[slotIndex];
    if (!slot || slot.active || !slot.resourceId) return false;

    const resource = this.resources[slot.resourceId];
    if (!resource || !isResourceHarvestable(resource, this.state, this.balance)) return false;

    const toolCheck = getHarvestToolCheck(
      this.state,
      jobId,
      resource,
      this.recipes,
      this.equipment,
      this.resources
    );
    if (!toolCheck.ok) {
      emit('harvestBlocked', { jobId, slotIndex, resourceId: resource.id, message: toolCheck.message });
      return false;
    }

    const duration = getHarvestTime(resource, this.state, this.jobs, this.balance);
    slot.active = { phase: 'harvesting', start: Date.now(), duration, resourceId: resource.id };
    this.scheduleHarvestTimer(jobId, slotIndex, duration);

    emit('harvestStart', { resourceId: resource.id, jobId, slotIndex, duration, phase: 'harvesting' });
    emit('stateChange', this.state);
    return true;
  }

  completeSlotHarvest(jobId, slotIndex) {
    const slot = this.state.harvestSlots?.[jobId]?.[slotIndex];
    if (!slot?.active) return;

    const timerKey = `${jobId}_${slotIndex}`;
    delete this.harvestTimers[timerKey];

    const resourceId = slot.active.resourceId;
    const resource = this.resources[resourceId];
    const phase = slot.active.phase || 'harvesting';

    if (phase === 'harvesting') {
      const today = new Date().toISOString().slice(0, 10);
      if (!this.state.dailyHarvest || this.state.dailyHarvest.date !== today) {
        this.state.dailyHarvest = { date: today, bonusUsed: false };
      }
      let yield_ = getHarvestYield(resource, this.state, this.jobs, this.balance);
      let dailyBonus = false;
      if (!this.state.dailyHarvest.bonusUsed) {
        this.state.dailyHarvest.bonusUsed = true;
        yield_ *= 2;
        dailyBonus = true;
      }
      const xp = getHarvestXp(resource, this.state, this.balance);

      this.state.inventory[resourceId] = (this.state.inventory[resourceId] || 0) + yield_;
      const levelResult = addJobXp(this.state, jobId, xp, this.jobs, this.balance);
      this.state.stats.totalHarvests++;
      this.onHarvestForQuests(resourceId, yield_);
      const wornTools = wearToolsForHarvest(this.state, this.recipes, this.equipment, jobId);
      for (const { recipeId, remaining } of wornTools) {
        if (remaining <= 0) {
          const recipe = this.recipes[recipeId];
          emit('toolBroken', { recipeId, name: recipe?.name || recipeId });
        }
      }

      const regrowthDuration = getRegrowthTime(resource, this.state, this.jobs, this.balance);
      slot.active = {
        phase: 'regrowing',
        start: Date.now(),
        duration: regrowthDuration,
        resourceId,
      };
      this.scheduleHarvestTimer(jobId, slotIndex, regrowthDuration);

      emit('harvestComplete', { resourceId, jobId, slotIndex, yield: yield_, xp, levelResult, dailyBonus });
      emit('regrowthStart', { resourceId, jobId, slotIndex, duration: regrowthDuration });
      emit('stateChange', this.state);
      this.scheduleSave();
      return;
    }

    slot.active = null;
    emit('regrowthComplete', { resourceId, jobId, slotIndex });
    emit('stateChange', this.state);
    this.scheduleSave();
  }

  getSlotHarvestProgress(jobId, slotIndex) {
    const slot = this.state.harvestSlots?.[jobId]?.[slotIndex];
    return getSlotProgress(slot);
  }

  isJobHarvesting(jobId) {
    return (this.state.harvestSlots?.[jobId] || []).some((s) => s.active);
  }

  getJobHarvestNavStatus(jobId) {
    return getJobHarvestNavStatus(this.state, jobId);
  }

  isHarvesting() {
    return Object.values(this.state.harvestSlots || {}).some((slots) =>
      slots.some((s) => s.active)
    );
  }

  getActiveHarvests() {
    const active = {};
    for (const [jobId, slots] of Object.entries(this.state.harvestSlots || {})) {
      slots.forEach((s, i) => {
        if (s.active) active[`${jobId}_${i}`] = s.active;
      });
    }
    return active;
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
      : slotKind === 'accessory' || slotKind === 'tool'
        ? unequipGathering(this.state, slotOrJob, slotKind)
        : unequip(slotOrJob, this.state);
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

  canStartFight(zoneId, isBoss = false) {
    const combatZone = this.combatZones[zoneId];
    if (!combatZone) return { ok: false, reason: 'Zone de combat inconnue' };
    return canFight(combatZone, this.state, this.balance, this.characterConfig, isBoss);
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
      this.companions
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

    const newState = applyPrestige(this.state, this.balance, () => this.getDefaultState());
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
