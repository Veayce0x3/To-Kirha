/**
 * École du Village — recherches saisonnières + connaissances permanentes + legs.
 * Feuille de route : métiers récolte, bâtiments ferme, zones combat.
 */

import { learnSpell } from './grimoire.js';

export function emptyVillageSchoolState() {
  return {
    completedSeasonal: [],
    completedPermanent: [],
    active: null,
    legacyPending: null,
    seasonFlags: {},
    unlockedSpells: [],
    unlockedJobs: [],
    unlockedFarmBuildings: [],
    unlockedCombatZones: [],
    unlockedCombat: false,
    unlockedVillageBoard: false,
    unlockedCraftJobs: [],
  };
}

export function ensureVillageSchoolState(state) {
  if (!state.villageSchool || typeof state.villageSchool !== 'object') {
    state.villageSchool = emptyVillageSchoolState();
  }
  const s = state.villageSchool;
  if (!Array.isArray(s.completedSeasonal)) s.completedSeasonal = [];
  if (!Array.isArray(s.completedPermanent)) s.completedPermanent = [];
  if (!Array.isArray(s.unlockedSpells)) s.unlockedSpells = [];
  if (!Array.isArray(s.unlockedJobs)) s.unlockedJobs = [];
  if (!Array.isArray(s.unlockedFarmBuildings)) s.unlockedFarmBuildings = [];
  if (!Array.isArray(s.unlockedCombatZones)) s.unlockedCombatZones = [];
  if (!Array.isArray(s.unlockedCraftJobs)) s.unlockedCraftJobs = [];
  if (typeof s.unlockedCombat !== 'boolean') s.unlockedCombat = false;
  if (typeof s.unlockedVillageBoard !== 'boolean') s.unlockedVillageBoard = false;
  if (!s.seasonFlags || typeof s.seasonFlags !== 'object') s.seasonFlags = {};
  return s;
}

/** Ouverte dès le début (feuille de route). */
export function isVillageSchoolUnlocked(_state, _balance) {
  return true;
}

export function hasSchoolJobUnlock(state, jobId) {
  return ensureVillageSchoolState(state).unlockedJobs.includes(jobId);
}

export function hasSchoolFarmUnlock(state, buildingId) {
  return ensureVillageSchoolState(state).unlockedFarmBuildings.includes(buildingId);
}

export function hasSchoolCombatUnlock(state) {
  return !!ensureVillageSchoolState(state).unlockedCombat;
}

export function hasSchoolCombatZoneUnlock(state, combatZoneId) {
  const s = ensureVillageSchoolState(state);
  if (!combatZoneId) return false;
  if (combatZoneId === 'village_sakura') return !!s.unlockedCombat;
  return s.unlockedCombatZones.includes(combatZoneId);
}

/** Quêtes quotidiennes du Village — déblocage École. */
export function hasSchoolVillageBoardUnlock(state) {
  return !!ensureVillageSchoolState(state).unlockedVillageBoard;
}

export function hasSchoolCraftUnlock(state, craftJobId) {
  return ensureVillageSchoolState(state).unlockedCraftJobs.includes(craftJobId);
}

export function isVillageBoardUnlocked(state, _balance) {
  return hasSchoolVillageBoardUnlock(state);
}

export function getResearchDef(schoolData, researchId) {
  return schoolData?.researches?.[researchId] || null;
}

export function isResearchCompleted(state, research) {
  if (!research) return false;
  const s = ensureVillageSchoolState(state);
  if (research.tier === 'permanent') return s.completedPermanent.includes(research.id);
  return s.completedSeasonal.includes(research.id);
}

export function areRequirementsMet(state, research) {
  if (!research?.requires?.length) return true;
  return research.requires.every((id) => {
    const s = ensureVillageSchoolState(state);
    return s.completedSeasonal.includes(id) || s.completedPermanent.includes(id);
  });
}

function invHave(state, resId) {
  return Number(state.inventory?.[resId]) || 0;
}

export function canAffordResearch(state, research) {
  if (!research) return false;
  if ((state.kirha || 0) < (Number(research.kirhaCost) || 0)) return false;
  for (const [resId, need] of Object.entries(research.ingredients || {})) {
    if (invHave(state, resId) < (Number(need) || 0)) return false;
  }
  return true;
}

export function getResearchStatus(state, research) {
  if (!research) return 'unknown';
  if (isResearchCompleted(state, research)) return 'done';
  const s = ensureVillageSchoolState(state);
  if (s.active?.researchId === research.id) return 'active';
  if (!areRequirementsMet(state, research)) return 'locked';
  if (s.active) return 'blocked';
  if (!canAffordResearch(state, research)) return 'unaffordable';
  return 'available';
}

export function getActiveResearchProgress(state, now = Date.now()) {
  const s = ensureVillageSchoolState(state);
  const active = s.active;
  if (!active?.researchId) return null;
  const startedAt = Number(active.startedAt) || now;
  const durationMs = Math.max(1000, Number(active.durationMs) || 1000);
  const elapsed = Math.max(0, now - startedAt);
  const remainingMs = Math.max(0, durationMs - elapsed);
  return {
    researchId: active.researchId,
    startedAt,
    durationMs,
    elapsed,
    remainingMs,
    progress: Math.min(1, elapsed / durationMs),
    ready: remainingMs <= 0,
  };
}

function payResearchCost(state, research) {
  state.kirha = (state.kirha || 0) - (Number(research.kirhaCost) || 0);
  for (const [resId, need] of Object.entries(research.ingredients || {})) {
    const n = Number(need) || 0;
    state.inventory[resId] = (state.inventory[resId] || 0) - n;
    if (state.inventory[resId] <= 0) delete state.inventory[resId];
  }
}

export function startVillageResearch(state, schoolData, balance, researchId) {
  if (!isVillageSchoolUnlocked(state, balance)) {
    return { ok: false, reason: 'École du Village indisponible.' };
  }
  const research = getResearchDef(schoolData, researchId);
  if (!research) return { ok: false, reason: 'Recherche inconnue.' };
  const status = getResearchStatus(state, research);
  if (status === 'done') return { ok: false, reason: 'Déjà terminée.' };
  if (status === 'locked') return { ok: false, reason: 'Prérequis manquants.' };
  if (status === 'active') return { ok: false, reason: 'Déjà en cours.' };
  if (status === 'blocked') return { ok: false, reason: 'Une recherche est déjà en cours.' };
  if (!canAffordResearch(state, research)) return { ok: false, reason: 'Ressources ou Kirha insuffisants.' };

  payResearchCost(state, research);
  const s = ensureVillageSchoolState(state);
  s.active = {
    researchId: research.id,
    startedAt: Date.now(),
    durationMs: Math.max(1000, Number(research.durationMs) || 60000),
  };
  return { ok: true, research, active: s.active };
}

function pushUnique(arr, id) {
  if (!id || arr.includes(id)) return false;
  arr.push(id);
  return true;
}

/** Applique les effets d’unlock (idempotent). */
export function applyResearchUnlockEffects(state, research) {
  const effect = research?.effect || {};
  const s = ensureVillageSchoolState(state);
  let changed = false;

  if (effect.unlockGatheringJob) {
    if (pushUnique(s.unlockedJobs, effect.unlockGatheringJob)) changed = true;
  }
  if (effect.unlockFarmBuilding) {
    if (pushUnique(s.unlockedFarmBuildings, effect.unlockFarmBuilding)) changed = true;
  }
  if (effect.unlockCombat) {
    if (!s.unlockedCombat) {
      s.unlockedCombat = true;
      changed = true;
    }
    if (pushUnique(s.unlockedCombatZones, 'village_sakura')) changed = true;
    if (!Array.isArray(state.unlockedZones)) state.unlockedZones = [];
    if (pushUnique(state.unlockedZones, 'village_sakura')) changed = true;
  }
  if (effect.unlockCombatZone) {
    if (pushUnique(s.unlockedCombatZones, effect.unlockCombatZone)) changed = true;
    if (!Array.isArray(state.unlockedZones)) state.unlockedZones = [];
    if (pushUnique(state.unlockedZones, effect.unlockCombatZone)) changed = true;
  }
  if (effect.unlockVillageBoard) {
    if (!s.unlockedVillageBoard) {
      s.unlockedVillageBoard = true;
      changed = true;
    }
  }
  if (effect.unlockCraftJob) {
    if (pushUnique(s.unlockedCraftJobs, effect.unlockCraftJob)) changed = true;
  }
  if (effect.unlockSpell) {
    const spellId = effect.unlockSpell;
    if (pushUnique(s.unlockedSpells, spellId)) {
      learnSpell(state, spellId);
      changed = true;
    }
  }
  return changed;
}

/** Rejoue les unlocks des recherches déjà terminées (repair / load). */
export function syncSchoolUnlocksFromCompleted(state, schoolData) {
  ensureVillageSchoolState(state);
  const s = state.villageSchool;
  const ids = [...(s.completedSeasonal || []), ...(s.completedPermanent || [])];
  for (const id of ids) {
    const research = getResearchDef(schoolData, id);
    if (research) applyResearchUnlockEffects(state, research);
  }
}

function applyEffectOnComplete(state, research) {
  const effect = research?.effect || {};
  const s = ensureVillageSchoolState(state);

  if (research.tier === 'permanent') {
    if (!s.completedPermanent.includes(research.id)) s.completedPermanent.push(research.id);
  } else if (!s.completedSeasonal.includes(research.id)) {
    s.completedSeasonal.push(research.id);
  }

  applyResearchUnlockEffects(state, research);

  if (effect.legacy && typeof effect.legacy === 'object') {
    if (!s.legacyPending) s.legacyPending = {};
    const leg = s.legacyPending;
    if (effect.legacy.nextSeasonKirha) {
      leg.nextSeasonKirha = (Number(leg.nextSeasonKirha) || 0) + Number(effect.legacy.nextSeasonKirha);
    }
    if (effect.legacy.merchantFirstWeek) leg.merchantFirstWeek = true;
  }
}

export function getSchoolUnlockedSpells(state) {
  return [...(ensureVillageSchoolState(state).unlockedSpells || [])];
}

export function completeVillageResearchIfReady(state, schoolData, now = Date.now()) {
  const progress = getActiveResearchProgress(state, now);
  if (!progress?.ready) return null;
  const research = getResearchDef(schoolData, progress.researchId);
  const s = ensureVillageSchoolState(state);
  s.active = null;
  if (!research) return { ok: false, reason: 'Recherche introuvable.' };
  applyEffectOnComplete(state, research);
  return { ok: true, research };
}

export function tickVillageSchool(state, schoolData, now = Date.now()) {
  return completeVillageResearchIfReady(state, schoolData, now);
}

/** Bonus actifs (saison + permanent). */
export function getVillageSchoolBonuses(state, schoolData) {
  const s = ensureVillageSchoolState(state);
  const bonuses = {
    cuisineJobXp: 0,
    mealSellBonus: 0,
    farmXp: 0,
    farmCycleSpeed: 0,
    toolDurability: 0,
    merchantChanceBonus: 0,
    extraHarvestSlot: 0,
    combatHp: 0,
    combatMp: 0,
    combatAtk: 0,
    combatDef: 0,
    combatHpFlat: 0,
    combatMpFlat: 0,
    combatAtkFlat: 0,
    combatDefFlat: 0,
  };

  const ids = [...s.completedSeasonal, ...s.completedPermanent];
  for (const id of ids) {
    const research = getResearchDef(schoolData, id);
    if (!research) continue;
    const season = research.effect?.seasonBonuses || {};
    const perm = research.effect?.permanent || {};
    for (const [k, v] of Object.entries(season)) {
      if (bonuses[k] != null) bonuses[k] += Number(v) || 0;
    }
    for (const [k, v] of Object.entries(perm)) {
      if (bonuses[k] != null) bonuses[k] += Number(v) || 0;
    }
  }
  s.bonuses = { ...bonuses };
  return bonuses;
}

export function getSchoolBonusesFromState(state) {
  const s = state?.villageSchool;
  const b = s?.bonuses;
  if (b && typeof b === 'object') return b;
  return {
    cuisineJobXp: 0,
    mealSellBonus: 0,
    farmXp: 0,
    farmCycleSpeed: 0,
    toolDurability: 0,
    merchantChanceBonus: 0,
    extraHarvestSlot: 0,
    combatHp: 0,
    combatMp: 0,
    combatAtk: 0,
    combatDef: 0,
    combatHpFlat: 0,
    combatMpFlat: 0,
    combatAtkFlat: 0,
    combatDefFlat: 0,
  };
}

export function refreshSchoolBonusCache(state, schoolData) {
  syncSchoolUnlocksFromCompleted(state, schoolData);
  return getVillageSchoolBonuses(state, schoolData);
}

export function extractVillageSchoolForPrestige(state) {
  const s = ensureVillageSchoolState(state);
  const legacy = s.legacyPending && typeof s.legacyPending === 'object'
    ? { ...s.legacyPending }
    : {};
  return {
    preserved: {
      completedPermanent: [...s.completedPermanent],
      completedSeasonal: [],
      active: null,
      legacyPending: null,
      unlockedSpells: [...(s.unlockedSpells || [])],
      unlockedJobs: [...(s.unlockedJobs || [])],
      unlockedFarmBuildings: [...(s.unlockedFarmBuildings || [])],
      unlockedCombatZones: [...(s.unlockedCombatZones || [])],
      unlockedCombat: !!s.unlockedCombat,
      unlockedVillageBoard: !!s.unlockedVillageBoard,
      unlockedCraftJobs: [...(s.unlockedCraftJobs || [])],
      seasonFlags: {
        merchantFirstWeek: !!legacy.merchantFirstWeek,
      },
    },
    legacyKirha: Math.max(0, Math.floor(Number(legacy.nextSeasonKirha) || 0)),
  };
}

export function getVillageSchoolViewModel(state, schoolData, balance, resources, jobs) {
  ensureVillageSchoolState(state);
  syncSchoolUnlocksFromCompleted(state, schoolData);
  tickVillageSchool(state, schoolData);
  const unlocked = isVillageSchoolUnlocked(state, balance);
  const bonuses = getVillageSchoolBonuses(state, schoolData);
  const activeProg = getActiveResearchProgress(state);
  const activeDef = activeProg ? getResearchDef(schoolData, activeProg.researchId) : null;

  const branches = Object.values(schoolData?.branches || {})
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((branch) => {
      const items = Object.values(schoolData?.researches || {})
        .filter((r) => r.branch === branch.id)
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)
          || String(a.id).localeCompare(String(b.id)))
        .map((r) => {
          const status = getResearchStatus(state, r);
          const ingredients = Object.entries(r.ingredients || {}).map(([resId, need]) => ({
            resId,
            need: Number(need) || 0,
            have: invHave(state, resId),
            name: resources?.[resId]?.name || resId,
            emoji: resources?.[resId]?.emoji || '',
          }));
          return {
            research: r,
            status,
            ingredients,
            canStart: status === 'available',
          };
        });
      return { branch, items };
    });

  return {
    unlocked,
    unlockHint: 'Étudie à l’École pour ouvrir métiers, ferme et donjons.',
    bonuses,
    active: activeProg && activeDef
      ? { ...activeProg, research: activeDef }
      : null,
    branches,
    seasonFlags: ensureVillageSchoolState(state).seasonFlags,
    permanentCount: ensureVillageSchoolState(state).completedPermanent.length,
    seasonalCount: ensureVillageSchoolState(state).completedSeasonal.length,
  };
}

export function formatResearchDuration(ms) {
  const t = Math.max(0, Number(ms) || 0);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h${String(m % 60).padStart(2, '0')}`;
  }
  if (m > 0) return `${m} min`;
  return `${s}s`;
}
