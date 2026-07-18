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
 * Popup au lancement : désactivée (bloquait les clics sur mobile).
 * Hard-refresh reste dispo dans Options.
 */
export function shouldShowStartupRefreshPrompt(_balance) {
  return false;
}

export function markStartupRefreshDismissed(_balance) {
  try {
    sessionStorage.setItem(SS_JUST_REFRESHED, '1');
  } catch {
    // ignore
  }
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
      title: '🔄 Nouvelle version disponible',
      desc: `Actualise pour charger la build ${current} (ta dernière session : ${last}). Ça vide le cache navigateur.`,
      stale: true,
    };
  }

  return {
    title: '🔄 Actualiser pour jouer',
    desc: `Un rechargement forcé charge la build ${current} sans ancien cache. Tu peux aussi le faire plus tard dans Options.`,
    stale: false,
  };
}
