/**
 * Temps de jeu — premier plan vs arrière-plan (onglet ouvert mais pas visible).
 * Stocké dans la save ; visible uniquement dans le panneau Admin.
 */

import { SaveProvider } from '../core/save.js';

const MAX_DELTA_MS = 2 * 60 * 1000; // ignore les trous (veille / crash)
const TICK_MS = 5000;
const PERSIST_EVERY_TICKS = 6; // ~30 s → save locale (+ cloud via flushSave)

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
 * @param {object} game
 * @param {{ onPersist?: () => void }} [opts] — onPersist = scheduleSave / flushSave
 * @returns {() => void} stop
 */
export function startPlaytimeTracker(game, opts = {}) {
  if (!game?.state) return () => {};

  ensurePlaytime(game.state);
  let lastMark = Date.now();
  let wasHidden = typeof document !== 'undefined' ? document.hidden : false;
  let ticksSincePersist = 0;
  const onPersist = typeof opts.onPersist === 'function' ? opts.onPersist : null;

  function flush({ persist = false, forceCloud = false } = {}) {
    if (!game?.state || SaveProvider.isResetting()) return;
    const now = Date.now();
    let delta = now - lastMark;
    lastMark = now;
    if (delta < 0) delta = 0;
    if (delta > MAX_DELTA_MS) delta = 0;
    if (delta > 0) {
      const pt = ensurePlaytime(game.state);
      if (wasHidden) pt.backgroundMs += delta;
      else pt.foregroundMs += delta;
    }

    if (persist || forceCloud) {
      ticksSincePersist = 0;
      if (forceCloud && typeof game.flushSave === 'function') {
        game.flushSave().catch(() => {});
      } else if (onPersist) {
        onPersist();
      } else if (typeof game.scheduleSave === 'function') {
        game.scheduleSave();
      }
    }
  }

  const onVisibility = () => {
    const goingHidden = document.hidden;
    flush({ persist: true, forceCloud: goingHidden });
    wasHidden = goingHidden;
  };

  const onPageHide = () => {
    flush({ persist: true, forceCloud: true });
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  const timer = setInterval(() => {
    ticksSincePersist += 1;
    flush({ persist: ticksSincePersist >= PERSIST_EVERY_TICKS });
  }, TICK_MS);

  return () => {
    flush({ persist: true, forceCloud: true });
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
  };
}
