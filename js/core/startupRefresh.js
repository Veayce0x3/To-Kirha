const LS_LAST_BUILD = 'tokirha_last_build';
const LS_CHANGELOG_SEEN = 'tokirha_changelog_seen';
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

export function getChangelogSeenBuildId() {
  try {
    return localStorage.getItem(LS_CHANGELOG_SEEN);
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

/** Première visite / rétrocompat : mémorise la build sans fausser la popup Nouveautés. */
export function ensureBuildTracked(balance) {
  const current = getAppBuildId(balance);
  try {
    let last = localStorage.getItem(LS_LAST_BUILD);
    let seen = localStorage.getItem(LS_CHANGELOG_SEEN);

    if (!last && !seen) {
      localStorage.setItem(LS_LAST_BUILD, current);
      localStorage.setItem(LS_CHANGELOG_SEEN, current);
      return;
    }
    if (!last) {
      localStorage.setItem(LS_LAST_BUILD, current);
      last = current;
    }
    // Ancienne session : aligner le changelog sur la build déjà vue (pas la nouvelle)
    if (!seen) {
      localStorage.setItem(LS_CHANGELOG_SEEN, last);
    }
  } catch {
    // ignore
  }
}

/**
 * Nouvelle build détectée → refresh auto (sauf si on arrive déjà d’un hard refresh).
 * @returns {boolean} true si un reload va être lancé
 */
export async function tryAutoRefreshForNewBuild(balance) {
  if (cameFromHardRefresh()) {
    recordBuildSeen(balance);
    cleanRefreshParamsFromUrl();
    return false;
  }

  ensureBuildTracked(balance);

  if (!isBuildStale(balance)) return false;

  try {
    sessionStorage.setItem(SS_JUST_REFRESHED, '1');
  } catch {
    // ignore
  }

  const { forceAppRefresh } = await import('./reload.js');
  await forceAppRefresh();
  return true;
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

export function markChangelogSeen(balance) {
  const buildId = getAppBuildId(balance);
  try {
    localStorage.setItem(LS_CHANGELOG_SEEN, buildId);
    localStorage.setItem(LS_LAST_BUILD, buildId);
  } catch {
    // ignore
  }
}

export function shouldShowWhatsNew(balance) {
  const current = getAppBuildId(balance);
  const seen = getChangelogSeenBuildId();
  if (!seen) {
    markChangelogSeen(balance);
    return false;
  }
  return seen !== current;
}

/**
 * Entrées changelog plus récentes que la dernière build vue (entries = plus récent en premier).
 */
export function getWhatsNewEntries(changelog, sinceBuildId, currentBuildId) {
  const entries = Array.isArray(changelog?.entries) ? changelog.entries : [];
  if (!entries.length) {
    return [{
      buildId: currentBuildId,
      title: 'Nouvelle version',
      highlights: [`Build ${currentBuildId} installée.`],
    }];
  }

  if (!sinceBuildId) {
    const current = entries.find((e) => e.buildId === currentBuildId);
    return current ? [current] : [entries[0]];
  }

  const sinceIdx = entries.findIndex((e) => e.buildId === sinceBuildId);
  if (sinceIdx === -1) {
    const current = entries.find((e) => e.buildId === currentBuildId);
    return current ? [current] : [entries[0]];
  }
  if (sinceIdx === 0) return [];
  return entries.slice(0, sinceIdx);
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
