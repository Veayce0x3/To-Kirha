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
  return { soloMob: null, soloBoss: null, dungeonRun: null };
}

export function getDungeonUnlockConfig(balance) {
  return { killsPerMonster: 0, requireBossSoloKill: false };
}

export function getCombatDailyStatus(state, balance) {
  const daily = ensureCombatDaily(state);
  return {
    date: daily.date,
    limits: { soloMob: null, soloBoss: null, dungeonRun: null },
    used: {
      soloMob: daily.soloMob,
      soloBoss: daily.soloBoss,
      dungeonRun: daily.dungeonRuns,
    },
    remaining: { soloMob: null, soloBoss: null, dungeonRun: null },
  };
}

export function canSpendDailyCombat(state, balance, kind) {
  return { ok: true };
}

export function recordDailyCombatUse(state, kind) {
  const daily = ensureCombatDaily(state);
  if (kind === 'soloMob') daily.soloMob += 1;
  else if (kind === 'soloBoss') daily.soloBoss += 1;
  else if (kind === 'dungeonRun') daily.dungeonRuns += 1;
}

export function getDungeonUnlockProgress(combatZone, state, balance) {
  return {
    monsterProgress: [],
    bossMet: true,
    bossSoloKills: 0,
    allMonstersMet: true,
    ready: true,
  };
}

export function getDungeonUnlockReason(combatZone, state, balance) {
  return null;
}
