import { Game } from './core/game.js';
import { initUI } from './ui/render.js';
import { SaveProvider } from './core/save.js';
import { audio } from './core/audio.js';

const DATA_BASE = new URL('../data/', import.meta.url);

async function loadJSON(file) {
  const res = await fetch(new URL(file, DATA_BASE));
  if (!res.ok) throw new Error(`Impossible de charger ${file} (${res.status})`);
  return res.json();
}

  async function main() {
  const [
    resources, jobs, balance, recipes, aides, equipment, farmData,
    characterConfig, combatEquipment, combatZones, enemies, merchant,
    combatSkills, combatResources, companions, quests, weaponRoles,
  ] = await Promise.all([
    loadJSON('resources.json'),
    loadJSON('jobs.json'),
    loadJSON('balance.json'),
    loadJSON('recipes.json'),
    loadJSON('aides.json'),
    loadJSON('equipment.json'),
    loadJSON('farm.json'),
    loadJSON('character.json'),
    loadJSON('combat_equipment.json'),
    loadJSON('combat_zones.json'),
    loadJSON('enemies.json'),
    loadJSON('merchant.json'),
    loadJSON('combat_skills.json'),
    loadJSON('combat_resources.json'),
    loadJSON('companions.json'),
    loadJSON('quests.json'),
    loadJSON('weapon_roles.json'),
  ]);

  Object.assign(resources, combatResources);
  const { applyAssetPaths, applyJobIcons } = await import('./core/assets.js');
  applyAssetPaths(resources);
  applyJobIcons(jobs);

  const game = new Game(
    resources, jobs, balance, recipes, aides, equipment, farmData,
    characterConfig, combatEquipment, combatZones, enemies, merchant, combatSkills, companions, quests,
    weaponRoles
  );
  await game.init();

  document.documentElement.dataset.theme = game.state.settings?.darkMode ? 'dark' : '';
  audio.updateSettings(game.state.settings);
  initUI(game, audio);

  const unlockAudio = () => {
    audio.init();
    audio.updateSettings(game.state.settings);
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);

  window.addEventListener('beforeunload', () => {
    game.state.lastOnline = Date.now();
    SaveProvider.save(game.state);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      game.state.lastOnline = Date.now();
      SaveProvider.save(game.state);
    }
  });
}

main().catch(console.error);
