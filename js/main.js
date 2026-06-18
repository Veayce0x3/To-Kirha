import { Game } from './core/game.js';
import { initUI } from './ui/render.js';
import { SaveProvider } from './core/save.js';
import { audio } from './core/audio.js';

async function loadJSON(path) {
  const res = await fetch(path);
  return res.json();
}

  async function main() {
  const [
    resources, jobs, balance, recipes, aides, equipment, farmData,
    characterConfig, combatEquipment, combatZones, enemies, merchant,
    combatSkills, combatResources, companions, quests, weaponRoles,
  ] = await Promise.all([
    loadJSON('./data/resources.json'),
    loadJSON('./data/jobs.json'),
    loadJSON('./data/balance.json'),
    loadJSON('./data/recipes.json'),
    loadJSON('./data/aides.json'),
    loadJSON('./data/equipment.json'),
    loadJSON('./data/farm.json'),
    loadJSON('./data/character.json'),
    loadJSON('./data/combat_equipment.json'),
    loadJSON('./data/combat_zones.json'),
    loadJSON('./data/enemies.json'),
    loadJSON('./data/merchant.json'),
    loadJSON('./data/combat_skills.json'),
    loadJSON('./data/combat_resources.json'),
    loadJSON('./data/companions.json'),
    loadJSON('./data/quests.json'),
    loadJSON('./data/weapon_roles.json'),
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
