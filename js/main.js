import { Game } from './core/game.js';
import { initUI } from './ui/render.js';
import { SaveProvider } from './core/save.js';
import { audio } from './core/audio.js';
import { initAuthModal, showAuthModalIfNeeded, showBannedModalIfNeeded } from './ui/authUi.js';
import { loadGameConfig, isMaintenanceMode } from './systems/gameConfig.js';
import { tryAutoRefreshForNewBuild } from './core/startupRefresh.js';
import { mountAnnouncementBanner } from './ui/announcements.js';
import { isAccountBanned, syncProfileFromServer, setupAuthStateListener } from './core/auth.js';
import { emit } from './core/events.js';
import { applyAssetPaths, applyJobIcons } from './core/assets.js';
import { getSupabaseClient, isSupabaseConfigured } from './core/supabaseClient.js';

const DATA_BASE = new URL('../data/', import.meta.url);

/**
 * @param {string} file
 * @param {{ fresh?: boolean, bust?: string }} [opts]
 * - fresh: ignore le cache (ex. balance.json pour détecter une nouvelle build)
 * - bust: clé de cache (= appBuildId) pour invalider proprement après déploiement
 */
async function loadJSON(file, opts = {}) {
  const url = new URL(file, DATA_BASE);
  if (opts.bust) url.searchParams.set('v', opts.bust);
  else if (opts.fresh) url.searchParams.set('_', String(Date.now()));

  const res = await fetch(url, {
    credentials: 'same-origin',
    cache: opts.fresh ? 'no-store' : 'force-cache',
  });
  if (!res.ok) throw new Error(`Impossible de charger ${file} (${res.status})`);
  return res.json();
}

async function main() {
  // Préchauffe Supabase (esm.sh) en parallèle du chargement des données
  if (isSupabaseConfigured()) {
    getSupabaseClient().catch(() => {});
  }

  // Seul balance.json est forcé hors-cache (petit fichier) pour détecter les updates
  const balance = await loadJSON('balance.json', { fresh: true });
  if (await tryAutoRefreshForNewBuild(balance)) return;

  const bust = balance.appBuildId || String(balance.saveVersion || 'dev');
  const load = (file) => loadJSON(file, { bust });

  const [
    resources, jobs, recipes, aides, equipment, farmData,
    characterConfig, combatEquipment, combatZones, enemies, merchant,
    combatSkills, combatResources, companions, achievements, weaponRoles,
    changelog,
  ] = await Promise.all([
    load('resources.json'),
    load('jobs.json'),
    load('recipes.json'),
    load('aides.json'),
    load('equipment.json'),
    load('farm.json'),
    load('character.json'),
    load('combat_equipment.json'),
    load('combat_zones.json'),
    load('enemies.json'),
    load('merchant.json'),
    load('combat_skills.json'),
    load('combat_resources.json'),
    load('companions.json'),
    load('achievements.json'),
    load('weapon_roles.json'),
    load('changelog.json').catch(() => ({ entries: [] })),
  ]);

  Object.assign(resources, combatResources);
  applyAssetPaths(resources);
  applyJobIcons(jobs);

  const game = new Game(
    resources, jobs, balance, recipes, aides, equipment, farmData,
    characterConfig, combatEquipment, combatZones, enemies, merchant, combatSkills, companions, achievements,
    weaponRoles
  );
  game.changelog = changelog;

  // Init jeu + config online en parallèle
  const configPromise = loadGameConfig().catch(() => null);
  await game.init();
  await Promise.all([
    setupAuthStateListener(game),
    configPromise,
  ]);

  document.documentElement.dataset.theme = game.state.settings?.darkMode ? 'dark' : '';
  audio.updateSettings(game.state.settings);
  initAuthModal(game);
  await showAuthModalIfNeeded(game);

  if (isAccountBanned()) {
    showBannedModalIfNeeded();
  }

  // Sync rôle AVANT le menu (sinon onglet Admin invisible au 1er paint)
  if (game.state?.meta?.account?.mode === 'registered') {
    await syncProfileFromServer();
    emit('navRefresh');
  }

  initUI(game, audio);
  emit('navRefresh');

  const bannerEl = document.getElementById('global-banners');
  if (bannerEl) {
    if (isMaintenanceMode()) {
      bannerEl.classList.remove('hidden');
      bannerEl.innerHTML = '<div class="announcement-banner kind-maintenance" role="alert"><strong>Maintenance</strong> — Les fonctionnalités online sont temporairement limitées.</div>';
    } else {
      mountAnnouncementBanner(bannerEl);
    }
  }

  const { showCareerChoiceIfNeeded } = await import('./ui/careerChoiceUi.js');
  showCareerChoiceIfNeeded(game);

  const unlockAudio = () => {
    audio.init();
    audio.updateSettings(game.state.settings);
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);

  const { startPlaytimeTracker } = await import('./systems/playtime.js');
  startPlaytimeTracker(game);

  window.addEventListener('beforeunload', () => {
    if (SaveProvider.isResetting()) return;
    game.state.lastOnline = Date.now();
    SaveProvider.save(game.state, game.balance);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (SaveProvider.isResetting()) return;
      game.state.lastOnline = Date.now();
      SaveProvider.save(game.state, game.balance);
    }
  });
}

main().catch(console.error);
