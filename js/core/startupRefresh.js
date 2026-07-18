const LS_LAST_BUILD = 'tokirha_last_build';
const SS_JUST_REFRESHED = 'tokirha_just_refreshed';

export function getAppBuildId(balance) {
  return balance?.appBuildId || balance?.saveVersion?.toString() || 'dev';
}

export function getLastSeenBuildId() {
  try {
    return localStorage.getItem(LS_LAST_BUILD);
  } catch {
    return null;
  }
}

export function isBuildStale(balance) {
  const current = getAppBuildId(balance);
  const last = getLastSeenBuildId();
  return !!last && last !== current;
}

/** True si on vient juste d'un hard-refresh (param URL ou flag session). */
export function cameFromHardRefresh() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('tokirha_refresh')) return true;
    if (sessionStorage.getItem(SS_JUST_REFRESHED) === '1') return true;
  } catch {
    // ignore
  }
  return false;
}

/**
 * Afficher la popup à chaque ouverture de session,
 * sauf si on arrive tout juste d'un hard-refresh.
 */
export function shouldShowStartupRefreshPrompt(balance) {
  // Toujours actif en beta / testeurs (défaut true si non précisé)
  if (balance?.testerStartupRefresh === false) return false;

  if (cameFromHardRefresh()) return false;

  return true;
}

/** @deprecated Conservé pour compat — plus utilisé pour sauter le prompt. */
export function markStartupRefreshDismissed(_balance) {
  // Intentionnellement vide : on ne laisse plus contourner le hard-refresh.
}

export function recordBuildSeen(balance) {
  const buildId = getAppBuildId(balance);
  try {
    localStorage.setItem(LS_LAST_BUILD, buildId);
    sessionStorage.setItem(SS_JUST_REFRESHED, '1');
  } catch {
    // ignore
  }
}

/** Nettoie l'URL (?tokirha_refresh=…) après un refresh réussi. */
export function cleanRefreshParamsFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('tokirha_refresh') && !url.searchParams.has('_cb')) return;
    url.searchParams.delete('tokirha_refresh');
    url.searchParams.delete('_cb');
    url.searchParams.delete('v');
    url.searchParams.delete('_');
    const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '') + url.hash;
    window.history.replaceState({}, '', clean);
  } catch {
    // ignore
  }
}

export function getStartupRefreshCopy(balance) {
  const current = getAppBuildId(balance);
  const last = getLastSeenBuildId();
  const stale = isBuildStale(balance);

  if (stale) {
    return {
      title: '🔄 Nouvelle version — actualisation obligatoire',
      desc: `Une version plus récente est disponible. L'ancienne (session : ${last}) est peut‑être encore en cache. Appuie sur Actualiser pour vider le cache et charger la build ${current}.`,
      stale: true,
    };
  }

  return {
    title: '🔄 Actualisation au lancement',
    desc: `À chaque ouverture, on force un rechargement complet (cache navigateur vidé) pour jouer la build ${current}. C’est normal en beta.`,
    stale: false,
  };
}
