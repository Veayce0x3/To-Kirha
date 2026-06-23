export async function forceAppRefresh(game = null) {
  try {
    game?.scheduleSave?.();
  } catch {
    // Refresh must stay available even if the save debounce is unavailable.
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // CacheStorage is optional, especially on iOS standalone mode.
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // No service worker is expected today; keep this safe for future builds.
  }

  try {
    sessionStorage.setItem('tokirha-startup-refresh-seen', '1');
  } catch {
    // Session storage can be unavailable in private mode.
  }

  const url = new URL(window.location.href);
  url.searchParams.set('tokirha_refresh', String(Date.now()));
  window.location.replace(url.toString());
}
