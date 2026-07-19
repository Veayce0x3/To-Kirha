/**
 * Temps de jeu — premier plan vs arrière-plan (onglet ouvert mais pas visible).
 * Stocké dans la save ; visible uniquement dans le panneau Admin.
 */

import { SaveProvider } from '../core/save.js';

const MAX_DELTA_MS = 2 * 60 * 1000; // ignore les trous (veille / crash)
const TICK_MS = 5000;

function ensurePlaytime(state) {
  if (!state.playtime || typeof state.playtime !== 'object') {
    state.playtime = { foregroundMs: 0, backgroundMs: 0 };
  }
  state.playtime.foregroundMs = Math.max(0, Number(state.playtime.foregroundMs) || 0);
  state.playtime.backgroundMs = Math.max(0, Number(state.playtime.backgroundMs) || 0);
  return state.playtime;
}

export function formatPlayDuration(ms) {
  const total = Math.max(0, Math.floor(Number(ms) || 0));
  if (total < 1000) return '0 min';
  const minutes = Math.floor(total / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 48) {
    return remMin > 0 ? `${hours} h ${remMin} min` : `${hours} h`;
  }
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH > 0 ? `${days} j ${remH} h` : `${days} j`;
}

/**
 * Démarre le compteur. À appeler une fois après init du jeu.
 * @returns {() => void} stop
 */
export function startPlaytimeTracker(game) {
  if (!game?.state) return () => {};

  ensurePlaytime(game.state);
  let lastMark = Date.now();
  let wasHidden = typeof document !== 'undefined' ? document.hidden : false;

  function flush() {
    if (!game?.state || SaveProvider.isResetting()) return;
    const now = Date.now();
    let delta = now - lastMark;
    lastMark = now;
    if (delta < 0) delta = 0;
    if (delta > MAX_DELTA_MS) delta = 0;
    if (delta === 0) return;

    const pt = ensurePlaytime(game.state);
    if (wasHidden) pt.backgroundMs += delta;
    else pt.foregroundMs += delta;
  }

  const onVisibility = () => {
    flush();
    wasHidden = document.hidden;
  };

  const onPageHide = () => {
    flush();
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  const timer = setInterval(flush, TICK_MS);

  return () => {
    flush();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
  };
}
