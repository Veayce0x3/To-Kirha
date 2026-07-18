import { SaveProvider } from './save.js';

async function clearBrowserCaches() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // CacheStorage optionnel
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // Pas de SW obligatoire
  }
}

/** Prefetch court (max 1,5 s) — ne doit jamais bloquer le reload. */
async function prefetchFreshAssets(bust) {
  const files = [
    `./index.html?_=${bust}`,
    `./js/main.js?_=${bust}`,
    `./css/main.css?_=${bust}`,
    `./css/layout.css?_=${bust}`,
    `./data/balance.json?_=${bust}`,
  ];
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), 1500);
  try {
    await Promise.allSettled(
      files.map((url) =>
        fetch(url, {
          cache: 'reload',
          credentials: 'same-origin',
          signal: controller?.signal,
        })
      )
    );
  } catch {
    // ignore
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Hard refresh : vide caches + SW, tente un prefetch rapide, recharge avec cache-buster.
 */
export async function forceAppRefresh(game = null) {
  try {
    game?.scheduleSave?.();
  } catch {
    // ignore
  }

  const bust = String(Date.now());

  // Ne jamais bloquer plus de ~2 s au total
  await Promise.race([
    (async () => {
      await clearBrowserCaches();
      await prefetchFreshAssets(bust);
    })(),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);

  try {
    sessionStorage.removeItem('tokirha_startup_dismissed');
  } catch {
    // ignore
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('tokirha_refresh');
  url.searchParams.delete('v');
  url.searchParams.delete('_');
  url.searchParams.delete('_cb');
  url.searchParams.set('_cb', bust);
  url.searchParams.set('tokirha_refresh', bust);

  window.location.replace(url.toString());
}

export async function forceNewGameReload() {
  SaveProvider.beginReset();

  await Promise.race([
    clearBrowserCaches(),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);

  const bust = String(Date.now());
  const url = new URL(window.location.href);
  url.searchParams.delete('tokirha_refresh');
  url.searchParams.delete('_cb');
  url.searchParams.set('newgame', '1');
  url.searchParams.set('_cb', bust);
  url.searchParams.set('tokirha_refresh', bust);
  window.location.replace(url.toString());
}
