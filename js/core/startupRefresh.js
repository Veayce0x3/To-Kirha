const LS_LAST_BUILD = 'tokirha_last_build';
const SS_DISMISSED = 'tokirha_startup_dismissed';

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

/** Afficher la popup de refresh (testeurs / beta). */
export function shouldShowStartupRefreshPrompt(balance) {
  if (!balance?.testerStartupRefresh && !balance?.betaMode) return false;

  const url = new URL(window.location.href);
  if (url.searchParams.has('tokirha_refresh')) return false;

  const buildId = getAppBuildId(balance);
  if (isBuildStale(balance)) return true;

  try {
    if (sessionStorage.getItem(SS_DISMISSED) === buildId) return false;
  } catch {
    // sessionStorage indisponible → afficher quand même
  }

  return true;
}

export function markStartupRefreshDismissed(balance) {
  const buildId = getAppBuildId(balance);
  try {
    sessionStorage.setItem(SS_DISMISSED, buildId);
  } catch {
    // ignore
  }
}

export function recordBuildSeen(balance) {
  const buildId = getAppBuildId(balance);
  try {
    localStorage.setItem(LS_LAST_BUILD, buildId);
    sessionStorage.removeItem(SS_DISMISSED);
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
      desc: `Tu joues peut‑être une ancienne version en cache (ta dernière session : ${last}). Actualise pour charger la build ${current} avant de tester.`,
      stale: true,
    };
  }

  return {
    title: '🔄 Vérifier la dernière version',
    desc: `Avant de tester, actualise la page pour être sûr de jouer la build ${current} (cache navigateur vidé). Recommandé à chaque ouverture du jeu.`,
    stale: false,
  };
}
