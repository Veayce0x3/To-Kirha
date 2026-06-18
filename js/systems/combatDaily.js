export function getLocalDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function ensureCombatDaily(state) {
  const today = getLocalDateKey();
  if (!state.combatDaily || state.combatDaily.date !== today) {
    state.combatDaily = { date: today, soloMob: 0, soloBoss: 0, dungeonRuns: 0 };
  }
  return state.combatDaily;
}

export function getCombatDailyLimits(balance) {
  const limits = balance.combat?.dailyLimits || {};
  return {
    soloMob: limits.soloMob ?? 20,
    soloBoss: limits.soloBoss ?? 5,
    dungeonRun: limits.dungeonRun ?? 2,
  };
}

export function getDungeonUnlockConfig(balance) {
  const cfg = balance.combat?.dungeonUnlock || {};
  return {
    killsPerMonster: cfg.killsPerMonster ?? 3,
    requireBossSoloKill: cfg.requireBossSoloKill !== false,
  };
}

export function getCombatDailyStatus(state, balance) {
  const daily = ensureCombatDaily(state);
  const limits = getCombatDailyLimits(balance);
  return {
    date: daily.date,
    limits,
    used: {
      soloMob: daily.soloMob,
      soloBoss: daily.soloBoss,
      dungeonRun: daily.dungeonRuns,
    },
    remaining: {
      soloMob: Math.max(0, limits.soloMob - daily.soloMob),
      soloBoss: Math.max(0, limits.soloBoss - daily.soloBoss),
      dungeonRun: Math.max(0, limits.dungeonRun - daily.dungeonRuns),
    },
  };
}

export function canSpendDailyCombat(state, balance, kind) {
  if (kind === 'dungeonRun') return { ok: true };

  const daily = ensureCombatDaily(state);
  const limits = getCombatDailyLimits(balance);

  if (kind === 'soloMob' && daily.soloMob >= limits.soloMob) {
    return { ok: false, reason: `Limite journalière : ${limits.soloMob} combats rapides (mob) atteints.` };
  }
  if (kind === 'soloBoss' && daily.soloBoss >= limits.soloBoss) {
    return { ok: false, reason: `Limite journalière : ${limits.soloBoss} boss rapides atteints.` };
  }
  return { ok: true };
}

export function recordDailyCombatUse(state, kind) {
  const daily = ensureCombatDaily(state);
  if (kind === 'soloMob') daily.soloMob += 1;
  else if (kind === 'soloBoss') daily.soloBoss += 1;
  else if (kind === 'dungeonRun') daily.dungeonRuns += 1;
}

export function getDungeonUnlockProgress(combatZone, state, balance) {
  const cfg = getDungeonUnlockConfig(balance);
  const monsters = combatZone.monsters || [];
  const monsterProgress = monsters.map((m) => {
    const kills = state.combatKillStats?.[m.enemyId] || 0;
    return {
      enemyId: m.enemyId,
      name: m.name,
      emoji: m.emoji,
      kills,
      required: cfg.killsPerMonster,
      met: kills >= cfg.killsPerMonster,
    };
  });

  const boss = combatZone.boss;
  const bossKey = boss ? `boss_${boss.enemyId}` : null;
  const bossSoloKills = bossKey ? (state.combatKillStats?.[bossKey] || 0) : 0;
  const bossMet = !cfg.requireBossSoloKill || !boss || bossSoloKills >= 1;
  const allMonstersMet = monsterProgress.length === 0 || monsterProgress.every((p) => p.met);

  return {
    monsterProgress,
    bossMet,
    bossSoloKills,
    bossName: boss?.name,
    allMonstersMet,
    ready: allMonstersMet && bossMet,
  };
}

export function getDungeonUnlockReason(combatZone, state, balance) {
  const progress = getDungeonUnlockProgress(combatZone, state, balance);
  if (progress.ready) return null;

  const cfg = getDungeonUnlockConfig(balance);
  const missing = progress.monsterProgress.filter((p) => !p.met);
  if (missing.length) {
    const first = missing[0];
    const left = first.required - first.kills;
    return `Combat rapide : vaincs ${first.name} encore ${left}× (${first.kills}/${first.required})`;
  }
  if (!progress.bossMet && combatZone.boss) {
    return `Combat rapide : vaincs le boss ${combatZone.boss.name} avant le donjon`;
  }
  return `Entraînement requis (${cfg.killsPerMonster} victoires/mob en combat rapide)`;
}
