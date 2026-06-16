import { SaveProvider, mergeSettings } from './save.js';
import { emit } from './events.js';
import { sellResource } from '../systems/economy.js';
import { getCraftSellBonus, getRecipeCraftJob, getRecipeJobXp } from '../systems/craft.js';
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
import { canCraft, craft } from '../systems/craft.js';
import { getVendorOffer, canBuyOffer, buyOffer } from '../systems/merchant.js';
import {
  advanceTutorialManual,
  dismissTutorial as completeTutorialSkip,
  getTutorialUi as buildTutorialUi,
  migrateTutorial,
  resetTutorial,
  syncTutorialProgress,
  buildDefaultTutorialState,
  isTutorialActive,
  shouldShowTutorialIntro,
  beginTutorialSandbox,
  getTutorialStepIndex,
  getTutorialStep,
  hasTutorialRewardsClaimed,
} from '../systems/tutorial.js';
import {
  bootstrapTutorialStep,
  checkTutorialWeaponEquipped,
  chooseTutorialWeapon,
  acceptTutorialStarterWeapon,
  TUTORIAL_RECIPE_ID,
  TUTORIAL_WEAPON_TYPE,
  getChosenTutorialRecipeId,
  getCraftJobForRecipe,
  getTutorialHarvestDurationMs,
  graduateTutorial as applyTutorialGraduation,
  isTutorialHarvestStep,
  markTutorialDungeonWon,
  markTutorialHarvestDone,
  markTutorialScrollBought,
  markTutorialWeaponCrafted,
  markTutorialWeaponEquipped,
  ensureTutorialCraftSupplies,
  reconcileTutorialWeaponProgress,
  findTutorialWeaponOwnedRef,
  ownsTutorialChosenWeapon,
} from '../systems/tutorialSandbox.js';
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
import { migrateToolDurability, wearToolsForHarvest } from '../systems/toolDurability.js';
import {
  ensureSlots,
  getMaxSlots,
  buySlot,
  assignSlotResource,
  clearSlotAssignment,
  getSlotProgress,
  canBuySlot,
  getSlotUnlockCost,
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
} from '../systems/combat.js';
import {
  canFight,
  startFight,
  startDungeonRun as startZoneDungeonRun,
  canEnterDungeon as checkEnterDungeon,
  useCombatSkill as resolveCombatSkill,
  useCombatDefend as resolveCombatDefend,
  abandonCombat as clearCombatEncounter,
  getActiveEncounter,
  getActiveMemberSkills,
  getTutorialFightHint,
  startTutorialFight as startZoneTutorialFight,
  startTutorialDungeon as startZoneTutorialDungeon,
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
  QUEST_CHAPTER_LABELS,
} from '../systems/quests.js';
import {
  unlockWorldZone,
  canPayUnlockZone,
  tryAutoUnlockFromBoss,
  getZoneUnlockHint,
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
  constructor(resources, jobs, balance, recipes, aides, equipment, characterConfig, combatEquipment, combatZones, enemies, merchant, combatSkills, companions, quests, tutorialData, weaponRoles) {
    this.resources = resources;
    this.jobs = jobs;
    this.balance = balance;
    this.balance._recipes = recipes;
    this.recipes = recipes;
    this.aides = aides;
    this.equipment = equipment;
    this.characterConfig = characterConfig;
    this.combatEquipment = combatEquipment;
    this.combatZones = combatZones;
    this.enemies = enemies;
    this.merchant = merchant;
    this.combatSkills = combatSkills;
    this.companions = companions;
    this.quests = quests || {};
    this.tutorialData = tutorialData || { steps: [] };
    this.weaponRoles = weaponRoles || {};
    this.state = null;
    this.harvestTimers = {};
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
    const state = {
      kirha: this.balance.startingKirha,
      inventory: this.buildDefaultInventory(),
      jobs: this.buildDefaultJobs(),
      character: { level: 1, xp: 0 },
      upgrades: {},
      crafted: [],
      toolDurability: {},
      equipment: getDefaultEquipment(),
      combatEquipment: getDefaultCombatEquipment(),
      ownedCombatItems: [],
      purchasedSlots: this.balance.harvestSlots.startingSlots,
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
      tutorial: buildDefaultTutorialState(),
      lifetimeStats: { totalEarned: 0, totalHarvests: 0, seasonsCompleted: 0 },
      settings: getDefaultSettings(),
      lastOnline: Date.now(),
      stats: { totalHarvests: 0, totalEarned: 0, passiveHarvests: 0, offlineHarvests: 0 },
      quests: buildDefaultQuestState(),
    };
    ensureSlots(state, this.balance);
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
      purchasedSlots: saved.purchasedSlots ?? defaults.purchasedSlots,
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
      tutorial: migrateTutorial(saved.tutorial),
      lifetimeStats: { ...defaults.lifetimeStats, ...(saved.lifetimeStats || {}) },
      settings: mergeSettings(saved.settings),
      stats: { ...defaults.stats, ...(saved.stats || {}) },
      harvestSlots: this.migrateHarvestSlots(saved.harvestSlots),
      quests: migrateQuests(saved.quests),
    };
    ensureSlots(merged, this.balance);
    migrateCombatItemInstances(merged, this.combatEquipment.items);
    migrateLegacyCombatResources(merged);
    migrateToolDurability(merged, this.recipes);
    if (this.balance.betaMode) applyBetaUnlocks(merged, this.companions);
    return merged;
  }

  async init() {
    const saved = await SaveProvider.load();
    this.state = saved ? this.mergeState(saved) : this.getDefaultState();
    if (this.balance.betaMode) applyBetaUnlocks(this.state, this.companions);

    const offlineResult = applyOfflineProgress(this.state, this.aides, this.balance);
    this.state.lastOnline = Date.now();

    this.restoreHarvestTimers();
    syncTutorialProgress(this.state, this.tutorialData, this.quests, {
      recipes: this.recipes,
      combatItems: this.combatEquipment.items,
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
    this.saveTimer = setTimeout(() => {
      this.state.lastOnline = Date.now();
      SaveProvider.save(this.state);
    }, 500);
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
    return canPayUnlockZone(zoneId, this.state, this.balance, this.combatZones);
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
    if (changed) {
      syncTutorialProgress(this.state, this.tutorialData, this.quests);
    }
    return changed;
  }

  isTutorialActive() {
    return isTutorialActive(this.state);
  }

  hasTutorialRewardsClaimed() {
    return hasTutorialRewardsClaimed(this.state);
  }

  shouldShowTutorialIntro() {
    return shouldShowTutorialIntro(this.state);
  }

  getTutorialSyncExtras() {
    return {
      recipes: this.recipes,
      combatItems: this.combatEquipment.items,
      craftJobHint: getChosenTutorialRecipeId(this.state)
        ? getCraftJobForRecipe(this.recipes, getChosenTutorialRecipeId(this.state))
        : null,
    };
  }

  syncTutorialInventory() {
    const extras = this.getTutorialSyncExtras();
    reconcileTutorialWeaponProgress(
      this.state,
      this.recipes,
      this.combatEquipment.items
    );
    this.prepareTutorialCraftIfNeeded();
    if (
      checkTutorialWeaponEquipped(this.state, this.recipes, this.combatEquipment.items)
      && this.state.tutorial?.sandbox
      && !this.state.tutorial.flags?.weaponEquipped
    ) {
      markTutorialWeaponEquipped(this.state);
    }
    const changed = syncTutorialProgress(this.state, this.tutorialData, this.quests, extras);
    if (changed) this.scheduleSave();
    return changed;
  }

  getTutorialUi() {
    const syncExtras = this.getTutorialSyncExtras();
    reconcileTutorialWeaponProgress(
      this.state,
      this.recipes,
      this.combatEquipment.items
    );
    this.prepareTutorialCraftIfNeeded();
    return buildTutorialUi(this.state, this.tutorialData, this.quests, syncExtras);
  }

  beginTutorial() {
    beginTutorialSandbox(this.state, this.tutorialData);
    bootstrapTutorialStep(this.state, this.balance, this.recipes, 'harvest');
    syncTutorialProgress(this.state, this.tutorialData, this.quests);
    emit('tutorialBegin', {});
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  chooseTutorialWeaponType(weaponType) {
    if (this.state.tutorial?.sandbox) {
      return this.acceptTutorialStarterWeapon();
    }
    if (!chooseTutorialWeapon(
      this.state,
      weaponType,
      this.recipes,
      this.combatEquipment.items
    )) return false;
    return this._afterTutorialWeaponChosen();
  }

  acceptTutorialStarterWeapon() {
    if (!acceptTutorialStarterWeapon(
      this.state,
      this.recipes,
      this.combatEquipment.items
    )) return false;
    return this._afterTutorialWeaponChosen();
  }

  _afterTutorialWeaponChosen() {
    syncTutorialProgress(this.state, this.tutorialData, this.quests, {
      recipes: this.recipes,
      combatItems: this.combatEquipment.items,
    });
    const craftIdx = getTutorialStepIndex(this.tutorialData, 'craft');
    if (craftIdx >= 0) bootstrapTutorialStep(this.state, this.balance, this.recipes, 'craft');
    emit('tutorialWeaponChosen', {});
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  graduateTutorial() {
    applyTutorialGraduation(this.state);
    syncTutorialProgress(this.state, this.tutorialData, this.quests);
    emit('stateChange', this.state);
    this.scheduleSave();
  }

  getTutorialStarterWeaponOffer() {
    const type = TUTORIAL_WEAPON_TYPE;
    const recipe = this.recipes[TUTORIAL_RECIPE_ID];
    return {
      type,
      role: this.weaponRoles[type],
      recipeId: TUTORIAL_RECIPE_ID,
      recipe,
    };
  }

  prepareTutorialCraftIfNeeded() {
    if (!this.state.tutorial?.sandbox) return;
    const step = getTutorialStep(this.state, this.tutorialData);
    if (step?.id === 'craft' || this.state.tutorial.flags?.weaponChosen) {
      ensureTutorialCraftSupplies(this.state, this.recipes);
    }
  }

  isTutorialCraftRecipe(recipeId) {
    this.prepareTutorialCraftIfNeeded();
    if (!this.state.tutorial?.sandbox) return true;
    const recipe = this.recipes[recipeId];
    if (recipe && getRecipeCraftJob(recipe) === 'toolmaker') return true;
    const chosen = getChosenTutorialRecipeId(this.state);
    if (!chosen) return false;
    const step = this.tutorialData?.steps?.[this.state.tutorial.stepIndex];
    if (step?.id === 'craft') return recipeId === chosen;
    if (this.state.tutorial.flags?.weaponChosen && !this.state.tutorial.flags?.weaponEquipped) {
      return recipeId === chosen;
    }
    return true;
  }

  advanceTutorialStep() {
    if (!advanceTutorialManual(this.state, this.tutorialData)) return false;
    syncTutorialProgress(this.state, this.tutorialData, this.quests);
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  dismissTutorial() {
    completeTutorialSkip(this.state);
    emit('stateChange', this.state);
    this.scheduleSave();
  }

  resetTutorialForOptions() {
    resetTutorial(this.state);
    emit('tutorialReplay', {});
    emit('stateChange', this.state);
    this.scheduleSave();
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
    if (result?.isTutorialFight) {
      syncTutorialProgress(this.state, this.tutorialData, this.quests);
    }
    if (result?.isTutorialDungeon) {
      markTutorialDungeonWon(this.state);
      syncTutorialProgress(this.state, this.tutorialData, this.quests);
      const step = getTutorialStep(this.state, this.tutorialData);
      if (step?.id === 'scrolls') {
        bootstrapTutorialStep(this.state, this.balance, this.recipes, 'scrolls');
      }
    }
    const zoneId = result?.zoneId;
    if (result?.isBoss && zoneId) {
      const unlocked = tryAutoUnlockFromBoss(zoneId, this.state, this.balance);
      if (unlocked) {
        const zone = this.balance.zones[unlocked];
        emit('zoneUnlock', { zoneId: unlocked, zone, auto: true });
      }
    }
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

  getMaxHarvestSlots() {
    return getMaxSlots(this.state, this.balance);
  }

  buyHarvestSlot() {
    if (!buySlot(this.state, this.balance)) return false;
    emit('slotUnlock', { slots: getMaxSlots(this.state, this.balance) });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  getNextSlotCost() {
    const current = getMaxSlots(this.state, this.balance);
    return getSlotUnlockCost(current, this.balance);
  }

  canBuyHarvestSlot() {
    return canBuySlot(this.state, this.balance);
  }

  assignResourceToSlot(jobId, slotIndex, resourceId) {
    const resource = this.resources[resourceId];
    if (!resource || !isResourceHarvestable(resource, this.state, this.balance)) return false;
    if (resource.job !== jobId) return false;
    if (!assignSlotResource(this.state, jobId, slotIndex, resourceId)) return false;
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  clearSlot(jobId, slotIndex) {
    if (!clearSlotAssignment(this.state, jobId, slotIndex)) return false;
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

  startSlotHarvest(jobId, slotIndex) {
    const slot = this.state.harvestSlots?.[jobId]?.[slotIndex];
    if (!slot || slot.active || !slot.resourceId) return false;

    const resource = this.resources[slot.resourceId];
    if (!resource || !isResourceHarvestable(resource, this.state, this.balance)) return false;

    const duration = isTutorialHarvestStep(this.state, this.tutorialData)
      ? getTutorialHarvestDurationMs(getHarvestTime(resource, this.state, this.jobs, this.balance))
      : getHarvestTime(resource, this.state, this.jobs, this.balance);
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
      const yield_ = getHarvestYield(resource, this.state, this.jobs, this.balance);
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
      if (isTutorialHarvestStep(this.state, this.tutorialData)) {
        markTutorialHarvestDone(this.state);
        slot.active = null;
        syncTutorialProgress(this.state, this.tutorialData, this.quests);
        emit('harvestComplete', { resourceId, jobId, slotIndex, yield: yield_, xp, levelResult });
        emit('stateChange', this.state);
        this.scheduleSave();
        return;
      }

      const regrowthDuration = getRegrowthTime(resource, this.state, this.jobs, this.balance);
      slot.active = {
        phase: 'regrowing',
        start: Date.now(),
        duration: regrowthDuration,
        resourceId,
      };
      this.scheduleHarvestTimer(jobId, slotIndex, regrowthDuration);

      emit('harvestComplete', { resourceId, jobId, slotIndex, yield: yield_, xp, levelResult });
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

  canBuyMerchant(vendorId, offerId, quantity) {
    const offer = getVendorOffer(this.merchant, vendorId, offerId);
    return canBuyOffer(offer, quantity, this.state, this.resources);
  }

  buyMerchant(vendorId, offerId, quantity) {
    const offer = getVendorOffer(this.merchant, vendorId, offerId);
    const result = buyOffer(offer, quantity, this.state, this.resources);
    if (!result) return false;
    if (this.state.tutorial?.sandbox && offer?.resourceId === 'ancient_scroll') {
      markTutorialScrollBought(this.state);
      syncTutorialProgress(this.state, this.tutorialData, this.quests);
    }
    emit('merchantBuy', { vendorId, offerId, ...result });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  doCraft(recipeId) {
    this.prepareTutorialCraftIfNeeded();
    if (!canCraft(recipeId, this.recipes, this.state, this.balance, this.jobs)) return false;

    const recipe = craft(recipeId, this.recipes, this.state, this.balance, this.resources, this.jobs);
    if (!recipe) return false;
    if (
      this.state.tutorial?.sandbox
      && recipeId === TUTORIAL_RECIPE_ID
      && recipe.combatItem
    ) {
      markTutorialWeaponCrafted(this.state);
      reconcileTutorialWeaponProgress(
        this.state,
        this.recipes,
        this.combatEquipment.items
      );
    }
    let levelResult = null;
    const jobXp = getRecipeJobXp(recipe);
    const craftJob = getRecipeCraftJob(recipe);
    if (jobXp) {
      levelResult = addJobXp(this.state, craftJob, jobXp, this.jobs, this.balance);
    }

    emit('craft', { recipeId, recipe, levelResult });
    this.processQuests();
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
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
    emit('unequip', { slot });
    emit('stateChange', this.state);
    this.scheduleSave();
    return true;
  }

  doEquipCombat(ref) {
    if (!equipCombatItem(this.state, ref, this.combatEquipment.items)) return false;
    reconcileTutorialWeaponProgress(
      this.state,
      this.recipes,
      this.combatEquipment.items
    );
    if (this.state.tutorial?.sandbox && checkTutorialWeaponEquipped(this.state, this.recipes, this.combatEquipment.items)) {
      markTutorialWeaponEquipped(this.state);
      syncTutorialProgress(this.state, this.tutorialData, this.quests, {
        recipes: this.recipes,
        combatItems: this.combatEquipment.items,
      });
    }
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

  setCharacterNickname(name, isRename = false) {
    const result = applyCharacterNickname(this.state, name, this.characterConfig, { isRename });
    if (!result.ok) return result;

    emit('nicknameChange', result);
    emit('stateChange', this.state);
    this.scheduleSave();
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

  startTutorialCombatFight(zoneId = 'village_sakura') {
    const combatZone = this.combatZones[zoneId];
    if (!combatZone) return { ok: false, reason: 'Zone inconnue' };

    const result = startZoneTutorialFight(
      combatZone,
      this.state,
      this.balance,
      this.characterConfig,
      this.combatEquipment.items,
      this.enemies,
      this.weaponRoles
    );

    if (!result.ok) return result;

    emit('combatStart', { zoneId, isTutorialFight: true });
    emit('stateChange', this.state);
    return { ok: true, zoneId, isTutorialFight: true };
  }

  startTutorialDungeonRun(zoneId = 'village_sakura') {
    const combatZone = this.combatZones[zoneId];
    if (!combatZone) return { ok: false, reason: 'Zone inconnue' };

    const result = startZoneTutorialDungeon(
      combatZone,
      this.state,
      this.balance,
      this.characterConfig,
      this.combatEquipment.items,
      this.enemies,
      this.companions
    );

    if (!result.ok) return result;

    emit('combatStart', { zoneId, isTutorialDungeon: true, roomCount: result.roomCount });
    emit('stateChange', this.state);
    return { ok: true, zoneId, isTutorialDungeon: true, roomCount: result.roomCount };
  }

  getTutorialCombatHint() {
    return getTutorialFightHint(
      this.state,
      this.combatEquipment.items,
      this.combatSkills,
      this.weaponRoles
    );
  }

  canStartTutorialFight() {
    const weapon = this.state.combatEquipment?.weapon;
    if (!weapon) return { ok: false, reason: 'Équipe une arme sur Personnage' };
    const item = resolveItem(this.state, weapon, this.combatEquipment.items);
    if (!item?.weaponType) return { ok: false, reason: 'Équipe une arme de combat' };
    return canFight(
      this.combatZones.village_sakura,
      this.state,
      this.balance,
      this.characterConfig,
      false
    );
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
      this.balance
    );
    if (!result) return null;

    if (result.cleared) {
      this.onCombatVictoryHooks(result);
      emit('combatVictory', result);
      if (result.levelResult) emit('charLevelUp', result.levelResult);
      this.scheduleSave();
    } else if (result.victory === false) {
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
    const result = resolveCombatDefend(this.state, this.characterConfig, this.enemies, this.balance);
    if (!result) return null;

    if (result.victory === false) {
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
    const result = resolveCombatEnemyStep(this.state, this.characterConfig, this.enemies, this.balance);
    if (!result) return null;

    if (result.cleared) {
      this.onCombatVictoryHooks(result);
      emit('combatVictory', result);
      if (result.levelResult) emit('charLevelUp', result.levelResult);
      this.scheduleSave();
    } else if (result.victory === false) {
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
    try {
      const parsed = SaveProvider.decode(encoded);
      Object.values(this.harvestTimers).forEach(clearTimeout);
      this.harvestTimers = {};
      this.state = this.mergeState(parsed.data);
      this.state.lastOnline = Date.now();
      this.restoreHarvestTimers();
      SaveProvider.save(this.state);
      emit('stateChange', this.state);
      emit('settingsChange', this.state.settings);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Impossible de lire la sauvegarde' };
    }
  }

  resetSave() {
    const settings = this.state.settings;
    Object.values(this.harvestTimers).forEach(clearTimeout);
    this.harvestTimers = {};
    this.state = this.getDefaultState();
    this.state.settings = settings;
    if (this.balance.betaMode) applyBetaUnlocks(this.state, this.companions);
    SaveProvider.save(this.state);
    emit('stateChange', this.state);
    return true;
  }


  getGoldNuggetCount() {
    return this.state.inventory.gold_nugget || 0;
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
    return Object.values(this.jobs).filter((j) => j.gathering === false);
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
