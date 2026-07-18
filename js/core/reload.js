import { SaveProvider } from './save.js';

async function clearBrowserCaches() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // CacheStorage optionnel (iOS standalone, etc.)
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // Pas de SW aujourd'hui — garde pour plus tard
  }
}

/** Recharge forcée des fichiers critiques (contourne le cache HTTP). */
async function prefetchFreshAssets(bust) {
  const files = [
    `./index.html?_=${bust}`,
    `./js/main.js?_=${bust}`,
    `./css/main.css?_=${bust}`,
    `./css/layout.css?_=${bust}`,
    `./css/online.css?_=${bust}`,
    `./data/balance.json?_=${bust}`,
    `./data/resources.json?_=${bust}`,
    `./data/farm.json?_=${bust}`,
    `./data/recipes.json?_=${bust}`,
    `./manifest.webmanifest?_=${bust}`,
  ];
  await Promise.allSettled(
    files.map((url) => fetch(url, { cache: 'reload', credentials: 'same-origin' }))
  );
}

/**
 * Hard refresh : vide caches + SW, re-télécharge les assets, recharge la page
 * avec un cache-buster unique (nécessaire sur GitHub Pages / Safari).
 */
export async function forceAppRefresh(game = null) {
  try {
    game?.scheduleSave?.();
  } catch {
    // Le refresh doit rester possible même si la save échoue
  }

  const bust = String(Date.now());

  await clearBrowserCaches();
  await prefetchFreshAssets(bust);

  try {
    sessionStorage.removeItem('tokirha_startup_dismissed');
  } catch {
    // ignore
  }

  const url = new URL(window.location.href);
  // Nettoie les vieux paramètres pour éviter l'accumulation
  url.searchParams.delete('tokirha_refresh');
  url.searchParams.delete('v');
  url.searchParams.delete('_');
  url.searchParams.delete('_cb');
  url.searchParams.set('_cb', bust);
  url.searchParams.set('tokirha_refresh', bust);

  // replace + timestamp = vraie navigation, pas un soft reload
  window.location.replace(url.toString());
}

export async function forceNewGameReload() {
  SaveProvider.beginReset();
  await clearBrowserCaches();

  const bust = String(Date.now());
  const url = new URL(window.location.href);
  url.searchParams.delete('tokirha_refresh');
  url.searchParams.delete('_cb');
  url.searchParams.set('newgame', '1');
  url.searchParams.set('_cb', bust);
  url.searchParams.set('tokirha_refresh', bust);
  window.location.replace(url.toString());
}
