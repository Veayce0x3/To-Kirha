/**
 * Stub de compatibilité : d’anciens bundles en cache importaient ce module.
 * Ne fait plus de pull-to-refresh — nettoie seulement les restes DOM.
 */
export function initBottomPullRefresh() {
  cleanupPullRefreshArtifacts();
}

export function cleanupPullRefreshArtifacts() {
  try {
    document.querySelectorAll('.top-pull-refresh, .bottom-pull-refresh').forEach((el) => {
      el.remove();
    });
  } catch {
    // ignore
  }
}
