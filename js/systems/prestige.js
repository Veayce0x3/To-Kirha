import { isChapterComplete, areAchievementsEnabled, isAchievementCompleted } from './achievements.js';
import { isCareerChoiceComplete, STARTER_WEAPON_TYPES } from './careerChoice.js';

function getPrestigeReqForSeason(balance, season) {
  const base = balance?.prestige || {};
  const override = base.seasonRequirements?.[String(season)] || {};
  const has = (key) => Object.prototype.hasOwnProperty.call(override, key);

  return {
    minTotalEarned: has('minTotalEarned') ? override.minTotalEarned : (base.minTotalEarned ?? 0),
    requiredZones: has('requiredZones') ? (override.requiredZones || []) : (base.requiredZones || []),
    minBossKills: has('minBossKills') ? (override.minBossKills || {}) : (base.minBossKills || {}),
    requireAchievements: has('requireAchievements')
      ? (override.requireAchievements || [])
      : (base.requireAchievements || []),
    requireQuestsChapter: has('requireQuestsChapter')
      ? override.requireQuestsChapter
      : base.requireQuestsChapter,
    requireAtSeasonCap: has('requireAtSeasonCap')
      ? !!override.requireAtSeasonCap
      : (base.requireAtSeasonCap ?? false),
    minCharacterLevel: has('minCharacterLevel')
      ? (override.minCharacterLevel || 0)
      : (base.minCharacterLevel || 0),
    minJobLevel: has('minJobLevel')
      ? (override.minJobLevel || 0)
      : (base.minJobLevel || 0),
    bonusesPerSeason: base.bonusesPerSeason,
    seasonStartKirha: base.seasonStartKirha,
    levelCaps: base.levelCaps,
    seasonBoostMs: base.seasonBoostMs ?? 3600000,
  };
}

export function getMaxJobLevel(state) {
  const jobs = state?.jobs || {};
  let max = 1;
  for (const data of Object.values(jobs)) {
    max = Math.max(max, Number(data?.level) || 1);
  }
  return max;
}

/** Boost de relance 1 h après nouvelle saison (temporaire, non cumulable). */
export function isSeasonBoostActive(state, now = Date.now()) {
  const endsAt = Number(state?.seasonBoost?.endsAt) || 0;
  if (endsAt <= now) {
    // Expire → on nettoie pour ne pas laisser croire à un bonus permanent
    if (state?.seasonBoost) state.seasonBoost = null;
    return false;
  }
  return true;
}

export function getSeasonBoostRemainingMs(state, now = Date.now()) {
  if (!isSeasonBoostActive(state, now)) return 0;
  const endsAt = Number(state?.seasonBoost?.endsAt) || 0;
  return Math.max(0, endsAt - now);
}

/** ×2 uniquement pendant le boost 1 h ; sinon 1 (les % saison restent séparés). */
export function getSeasonBoostMult(state) {
  return isSeasonBoostActive(state) ? 2 : 1;
}

export function createSeasonBoost(balance, now = Date.now()) {
  const ms = balance?.prestige?.seasonBoostMs ?? 3600000;
  return { endsAt: now + ms };
}

/** Multiplicateur de stats ennemis selon la saison (S1 = 1, S2 = +12 %, …). */
export function getSeasonEnemyScale(season, balance) {
  const per = Number(balance?.seasonCombatScalePerSeason);
  const step = Number.isFinite(per) ? per : 0.12;
  return 1 + Math.max(0, (Number(season) || 1) - 1) * step;
}

export function getPrestigeBonuses(state) {
  const p = state.prestige || {};
  const ach = state.achievements?.bonuses || state.quests?.bonuses || {};
  return {
    kirha: 1 + (p.kirhaBonus || 0) + (ach.kirha || 0),
    /** XP personnage / combat */
    xp: 1 + (p.xpBonus || 0) + (ach.xp || 0),
    /** XP métiers (récolte, ferme, craft) */
    jobXp: 1 + (p.jobXpBonus || 0) + (ach.xp || 0),
    /** Fraction additive : réduit le temps de repousse (0.05 = −5 %) */
    regrowthSpeed: (p.regrowthSpeedBonus || 0) + (ach.harvestSpeed || 0),
  };
}

/** Pourcentages affichés des bonus de saison (hors succès). */
export function getSeasonBonusPercents(state) {
  const p = state?.prestige || {};
  return {
    kirhaPct: Math.round((Number(p.kirhaBonus) || 0) * 100),
    xpPct: Math.round((Number(p.xpBonus) || 0) * 100),
    jobXpPct: Math.round((Number(p.jobXpBonus) || 0) * 100),
    regrowthPct: Math.round((Number(p.regrowthSpeedBonus) || 0) * 100),
  };
}

export function hasSeasonBonus(state) {
  const { kirhaPct, xpPct, jobXpPct, regrowthPct } = getSeasonBonusPercents(state);
  return kirhaPct > 0 || xpPct > 0 || jobXpPct > 0 || regrowthPct > 0;
}

/**
 * Applique un multiplicateur de saison / succès — valeur exacte (ex. 10 × 1,05 = 10,5).
 */
export function applyMultiplierBonus(base, multiplier) {
  const amount = Number(base) || 0;
  const mult = Number(multiplier) || 1;
  if (amount <= 0) return 0;
  if (mult === 1) return amount;
  return amount * mult;
}

/** Plafond de niveau pour la saison en cours — le max absolu (200) exige plusieurs saisons. */
export function getSeasonLevelCap(kind, state, balance) {
  const cfg = balance?.prestige?.levelCaps?.[kind];
  if (!cfg) return 200;

  const season = Math.max(1, state.season || 1);
  const raw = cfg.firstSeasonCap + (season - 1) * cfg.perSeason;
  return Math.min(cfg.absoluteMax ?? 200, raw);
}

export function isAtSeasonLevelCap(kind, state, balance, currentLevel) {
  return currentLevel >= getSeasonLevelCap(kind, state, balance);
}

export function getSeasonCapPreview(state, balance) {
  const season = state.season || 1;
  const cfg = balance?.prestige?.levelCaps || {};
  const charCap = getSeasonLevelCap('character', state, balance);
  const jobsCap = getSeasonLevelCap('jobs', state, balance);

  const nextSeason = season + 1;
  const nextCharCap = Math.min(
    cfg.character?.absoluteMax ?? 200,
    (cfg.character?.firstSeasonCap ?? 55) + (nextSeason - 1) * (cfg.character?.perSeason ?? 11)
  );
  const nextJobsCap = Math.min(
    cfg.jobs?.absoluteMax ?? 200,
    (cfg.jobs?.firstSeasonCap ?? 95) + (nextSeason - 1) * (cfg.jobs?.perSeason ?? 12)
  );

  return {
    season,
    character: { cap: charCap, absoluteMax: cfg.character?.absoluteMax ?? 200 },
    jobs: { cap: jobsCap, absoluteMax: cfg.jobs?.absoluteMax ?? 200 },
    nextSeason: { character: nextCharCap, jobs: nextJobsCap },
  };
}

export function getPrestigeBlockers(state, balance, achievements = {}, combatZones = {}) {
  const season = state.season || 1;
  const req = getPrestigeReqForSeason(balance, season);
  if (!req) return ['Configuration prestige manquante'];

  const blockers = [];

  if (req.requireAtSeasonCap) {
    const proximity = getSeasonCapProximity(state, balance);
    if (!proximity.atCap) {
      blockers.push(`Plafond Saison ${season} non atteint (perso ou métier)`);
    }
  }

  const charLevel = state.character?.level || 1;
  if (req.minCharacterLevel > 0 && charLevel < req.minCharacterLevel) {
    blockers.push(`Personnage Nv.${req.minCharacterLevel} (actuel ${charLevel})`);
  }

  const maxJob = getMaxJobLevel(state);
  if (req.minJobLevel > 0 && maxJob < req.minJobLevel) {
    blockers.push(`Métiers Nv.${req.minJobLevel} (max actuel ${maxJob})`);
  }

  for (const z of req.requiredZones || []) {
    const ok = balance.zones[z]?.unlocked || (state.unlockedZones || []).includes(z);
    if (!ok) blockers.push(`Zone ${balance.zones[z]?.name || z} requise`);
  }

  const earned = state.lifetimeStats?.totalEarned || 0;
  if (earned < (req.minTotalEarned || 0)) {
    blockers.push(`${((req.minTotalEarned || 0) - earned).toLocaleString('fr-FR')} 💰 à gagner encore (total vie)`);
  }

  for (const [zoneId, min] of Object.entries(req.minBossKills || {})) {
    const kills = state.bossKills?.[zoneId] || 0;
    if (kills < min) {
      const cz = combatZones[zoneId];
      const name = cz?.boss?.name || cz?.name || zoneId;
      blockers.push(`Vaincre le donjon : ${name} (${kills}/${min})`);
    }
  }

  if (areAchievementsEnabled(balance) && req.requireAchievements?.length) {
    for (const id of req.requireAchievements) {
      if (!isAchievementCompleted(state, id)) {
        const def = achievements[id];
        blockers.push(`Succès : ${def?.title || id}`);
      }
    }
  } else if (areAchievementsEnabled(balance) && req.requireQuestsChapter
    && !isChapterComplete(req.requireQuestsChapter, achievements, state)) {
    const label = balance.zones[req.requireQuestsChapter]?.name || req.requireQuestsChapter;
    blockers.push(`Succès ${label} incomplets`);
  }

  return blockers;
}

export function canPrestige(state, balance, quests = {}, combatZones = {}) {
  return getPrestigeBlockers(state, balance, quests, combatZones).length === 0;
}

export function getSeasonCapProximity(state, balance) {
  const charCap = getSeasonLevelCap('character', state, balance);
  const jobsCap = getSeasonLevelCap('jobs', state, balance);
  const charLevel = state.character?.level || 1;
  const maxJobLevel = getMaxJobLevel(state);
  const charRatio = charCap > 0 ? charLevel / charCap : 0;
  const jobRatio = jobsCap > 0 ? maxJobLevel / jobsCap : 0;
  const maxRatio = Math.max(charRatio, jobRatio);
  const season = state.season || 1;

  return {
    season,
    nextSeason: season + 1,
    charCap,
    jobsCap,
    charLevel,
    maxJobLevel,
    charRatio,
    jobRatio,
    maxRatio,
    showTeaser: maxRatio >= 0.8 && maxRatio < 1,
    atCap: charLevel >= charCap || maxJobLevel >= jobsCap,
  };
}

export function getPrestigeProgress(state, balance, achievements = {}, combatZones = {}) {
  const season = state.season || 1;
  const req = getPrestigeReqForSeason(balance, season);
  if (!req) {
    return { steps: [], completed: 0, total: 0, percent: 0, canDo: false };
  }

  const steps = [];

  if (req.requireAtSeasonCap) {
    const proximity = getSeasonCapProximity(state, balance);
    steps.push({
      id: 'season_cap',
      label: `Plafond Saison ${season} (perso ${proximity.charLevel}/${proximity.charCap} ou métier ${proximity.maxJobLevel}/${proximity.jobsCap})`,
      done: proximity.atCap,
    });
  }

  const charLevel = state.character?.level || 1;
  if (req.minCharacterLevel > 0) {
    steps.push({
      id: 'char_level',
      label: `Personnage Nv.${req.minCharacterLevel}`,
      done: charLevel >= req.minCharacterLevel,
      progress: Math.min(1, charLevel / req.minCharacterLevel),
    });
  }

  const maxJob = getMaxJobLevel(state);
  if (req.minJobLevel > 0) {
    steps.push({
      id: 'job_level',
      label: `Métiers Nv.${req.minJobLevel} (max actuel ${maxJob})`,
      done: maxJob >= req.minJobLevel,
      progress: Math.min(1, maxJob / req.minJobLevel),
    });
  }

  for (const z of req.requiredZones || []) {
    const ok = balance.zones[z]?.unlocked || (state.unlockedZones || []).includes(z);
    const name = balance.zones[z]?.name || z;
    steps.push({ id: `zone_${z}`, label: `Zone ${name}`, done: ok });
  }

  const earned = state.lifetimeStats?.totalEarned || 0;
  const kirhaTarget = req.minTotalEarned || 0;
  if (kirhaTarget > 0) {
    steps.push({
      id: 'kirha',
      label: `${kirhaTarget.toLocaleString('fr-FR')} 💰 gagnés (total vie)`,
      done: earned >= kirhaTarget,
      progress: Math.min(1, earned / kirhaTarget),
    });
  }

  for (const [zoneId, min] of Object.entries(req.minBossKills || {})) {
    const kills = state.bossKills?.[zoneId] || 0;
    const cz = combatZones[zoneId];
    const name = cz?.boss?.name || cz?.name || zoneId;
    steps.push({
      id: `boss_${zoneId}`,
      label: `Donjon : vaincre ${name}`,
      done: kills >= min,
      progress: min > 0 ? Math.min(1, kills / min) : 1,
    });
  }

  if (areAchievementsEnabled(balance) && req.requireAchievements?.length) {
    for (const id of req.requireAchievements) {
      const def = achievements[id];
      steps.push({
        id: `ach_${id}`,
        label: `Succès : ${def?.title || id}`,
        done: isAchievementCompleted(state, id),
      });
    }
  } else if (areAchievementsEnabled(balance) && req.requireQuestsChapter) {
    const label = balance.zones[req.requireQuestsChapter]?.name || req.requireQuestsChapter;
    steps.push({
      id: 'quests',
      label: `Succès ${label}`,
      done: isChapterComplete(req.requireQuestsChapter, achievements, state),
    });
  }

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;

  return {
    steps,
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
    canDo: completed === total && total > 0,
  };
}

export function shouldShowPrestigeTeaser(state, balance, quests = {}, combatZones = {}) {
  const proximity = getSeasonCapProximity(state, balance);
  const progress = getPrestigeProgress(state, balance, quests, combatZones);
  const lotusUnlocked = (state.unlockedZones || []).includes('lotus_sanctuary');
  return proximity.showTeaser
    || proximity.atCap
    || lotusUnlocked
    || progress.completed > 0
    || (state.season || 1) > 1;
}

export function getPrestigePreview(state, balance, achievements = {}, combatZones = {}) {
  const season = state.season || 1;
  const req = getPrestigeReqForSeason(balance, season);
  const bonuses = req.bonusesPerSeason || balance.prestige?.bonusesPerSeason;
  const current = state.prestige || {};
  const caps = getSeasonCapPreview(state, balance);
  const blockers = getPrestigeBlockers(state, balance, achievements, combatZones);

  return {
    currentSeason: season,
    nextSeason: season + 1,
    canDo: blockers.length === 0,
    blockers,
    minEarned: req.minTotalEarned,
    currentEarned: state.lifetimeStats?.totalEarned || 0,
    caps,
    nextBonuses: {
      kirha: ((current.kirhaBonus || 0) + (bonuses.kirhaMultiplier || 0)) * 100,
      xp: ((current.xpBonus || 0) + (bonuses.xpMultiplier || 0)) * 100,
      jobXp: ((current.jobXpBonus || 0) + (bonuses.jobXpMultiplier || 0)) * 100,
      regrowth: ((current.regrowthSpeedBonus || 0) + (bonuses.regrowthSpeed || 0)) * 100,
    },
    gainBonuses: {
      kirha: (bonuses.kirhaMultiplier || 0) * 100,
      xp: (bonuses.xpMultiplier || 0) * 100,
      jobXp: (bonuses.jobXpMultiplier || 0) * 100,
      regrowth: (bonuses.regrowthSpeed || 0) * 100,
    },
    seasonStartKirha: balance.prestige?.seasonStartKirha ?? balance.startingKirha ?? 0,
  };
}

export function applyPrestige(state, balance, getFreshState, achievements = {}, combatZones = {}) {
  if (!canPrestige(state, balance, achievements, combatZones)) return false;

  const req = balance.prestige;
  const bonuses = req.bonusesPerSeason;
  const current = state.prestige || {};

  const newPrestige = {
    kirhaBonus: (current.kirhaBonus || 0) + (bonuses.kirhaMultiplier || 0),
    xpBonus: (current.xpBonus || 0) + (bonuses.xpMultiplier || 0),
    jobXpBonus: (current.jobXpBonus || 0) + (bonuses.jobXpMultiplier || 0),
    regrowthSpeedBonus: (current.regrowthSpeedBonus || 0) + (bonuses.regrowthSpeed || 0),
  };

  const lifetimeStats = {
    ...state.lifetimeStats,
    seasonsCompleted: (state.lifetimeStats?.seasonsCompleted || 0) + 1,
    totalEarned: state.lifetimeStats?.totalEarned || 0,
    totalHarvests: (state.lifetimeStats?.totalHarvests || 0) + (state.stats?.totalHarvests || 0),
  };

  const season = (state.season || 1) + 1;
  const settings = state.settings || getDefaultSettings();
  const preservedAchievements = state.achievements || state.quests;

  // Reset complet : inventaire vide, métiers Nv.1, équipe à recruter, etc.
  // On garde seulement : bonus saison, succès, compte, pseudo, réglages, temps de jeu.
  const fresh = typeof getFreshState === 'function' ? getFreshState() : getFreshProgress(balance);
  const preservedNickname = state.character?.nickname || null;
  const preservedMeta = state.meta && typeof state.meta === 'object'
    ? JSON.parse(JSON.stringify(state.meta))
    : {};

  return {
    ...fresh,
    // Aide de relance : Kirha de départ de saison (fixe), pas le boost test
    kirha: balance.prestige?.seasonStartKirha ?? balance.startingKirha ?? 0,
    season,
    prestige: newPrestige,
    seasonBoost: createSeasonBoost(balance),
    toolUpgrades: {},
    lifetimeStats,
    achievements: preservedAchievements,
    settings,
    lastOnline: Date.now(),
    playtime: state.playtime || { foregroundMs: 0, backgroundMs: 0 },
    meta: preservedMeta,
    character: {
      ...(fresh.character || { level: 1, xp: 0 }),
      nickname: preservedNickname,
      nicknameUpdatedAt: state.character?.nicknameUpdatedAt || null,
      freeRenameUsed: !!state.character?.freeRenameUsed,
    },
    careerChoice: null,
  };
}

/** Répare une saison déjà cassée (pas de careerChoice → plus de métiers). */
export function repairSeasonAccess(state) {
  if ((state.season || 1) < 2 && !(state.lifetimeStats?.seasonsCompleted > 0)) return false;
  if (isCareerChoiceComplete(state.careerChoice)) return false;
  if (state.careerChoice?.confirmed && STARTER_WEAPON_TYPES.includes(state.careerChoice.weaponType)) {
    state.careerChoice.starterWeaponsGranted = false;
    return true;
  }
  state.careerChoice = {
    confirmed: true,
    weaponType: 'sword_shield',
    teamWeaponTypes: [...STARTER_WEAPON_TYPES],
    starterWeaponsGranted: false,
  };
  return true;
}

function getFreshProgress(balance) {
  return {
    kirha: balance.startingKirha,
    inventory: {
      sakura_wood: 0, herbs: 0, petal_wood: 0, fish: 0, sakura_carp: 0,
      jade_ore: 0, moon_stone: 0, jade_amulet: 0, sacred_incense: 0,
    },
    jobs: {
      lumberjack: { level: 1, xp: 0 },
      fisher: { level: 1, xp: 0 },
      miner: { level: 1, xp: 0 },
      artisan: { level: 1, xp: 0 },
    },
    upgrades: {},
    crafted: [],
    equipment: { weapon: null, accessory: null },
    aides: {},
    harvesting: {},
    unlockedZones: ['village_sakura'],
    zone: 'village_sakura',
    stats: { totalHarvests: 0, totalEarned: 0, passiveHarvests: 0, offlineHarvests: 0 },
  };
}

export function getDefaultSettings() {
  return { sfx: true, sfxVolume: 0.35, darkMode: false };
}
