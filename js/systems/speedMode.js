/** Mode vitesse admin (testeurs) — accélère timers + XP récolte / ferme. */

export const SPEED_MODE_OPTIONS = [5, 10, 20];

export function normalizeSpeedMultiplier(value) {
  const n = Math.round(Number(value));
  if (SPEED_MODE_OPTIONS.includes(n)) return n;
  return 10;
}

export function isSpeedModeActive(state) {
  return !!(state?.speedMode?.active && getSpeedModeMultiplier(state) > 1);
}

export function getSpeedModeMultiplier(state) {
  if (!state?.speedMode?.active) return 1;
  return normalizeSpeedMultiplier(state.speedMode.multiplier);
}

/** Divise une durée (ms) par le multiplicateur admin. */
export function applySpeedModeDuration(ms, state) {
  const raw = Math.max(0, Number(ms) || 0);
  const mult = getSpeedModeMultiplier(state);
  if (mult <= 1) return raw;
  return Math.max(250, Math.floor(raw / mult));
}

/** Multiplie un gain d’XP (récolte / ferme) par le multiplicateur admin. */
export function applySpeedModeXp(xp, state) {
  const raw = Math.max(0, Number(xp) || 0);
  const mult = getSpeedModeMultiplier(state);
  if (mult <= 1) return raw;
  return Math.floor(raw * mult);
}

export function getSpeedModeLabel(state) {
  if (!isSpeedModeActive(state)) return '';
  return `⚡ ×${getSpeedModeMultiplier(state)}`;
}

export function acknowledgeSpeedModePopup(state) {
  if (!state?.speedMode) return false;
  if (!state.speedMode.popupPending) return false;
  state.speedMode = {
    ...state.speedMode,
    popupPending: false,
    popupSeenAt: Date.now(),
  };
  return true;
}

export function shouldShowSpeedModePopup(state) {
  return !!(state?.speedMode?.active && state.speedMode.popupPending);
}
