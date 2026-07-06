/**
 * Après reset local : rétablit session compte + pseudo serveur sans recharger la page.
 */

import {
  syncAuthFromState,
  refreshProfile,
  applyServerDisplayNameToGame,
  getAuthState,
  initAuth,
} from '../core/auth.js';

export async function reconcileAuthAfterLocalReset(game) {
  syncAuthFromState(game.state);
  const auth = getAuthState();
  if (auth.mode === 'registered' && auth.userId) {
    await refreshProfile();
    applyServerDisplayNameToGame(game, getAuthState().displayName);
    game.scheduleSave?.();
    return;
  }
  if (!auth.mode || auth.mode === 'guest') {
    await initAuth(game);
    if (getAuthState().mode === 'registered') {
      applyServerDisplayNameToGame(game, getAuthState().displayName);
      game.scheduleSave?.();
    }
  }
}
