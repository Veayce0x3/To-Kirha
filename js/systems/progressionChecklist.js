/**
 * Progression checklist — ordered milestones for the player.
 * Each milestone has a check function to determine if it's complete.
 */

import { hasSchoolJobUnlock, hasSchoolFarmUnlock } from './villageSchool.js';
import { getJobEquippedTool } from './equipment.js';

const MILESTONES = [
  {
    id: 'career_chosen',
    title: 'Choisir sa carrière',
    desc: 'Choisis un pseudo et une arme de départ.',
    hint: null,
    check: (s) => !!s.careerChoice?.confirmed,
    category: 'debut',
  },
  {
    id: 'first_harvest',
    title: 'Première récolte',
    desc: 'Récolte ta première ressource en Paysan.',
    hint: 'Menu → Paysan → touche une plante',
    check: (s) => (s.jobs?.farmer?.level || 1) >= 2 || Object.values(s.inventory || {}).some((v) => v > 0),
    category: 'debut',
  },
  {
    id: 'first_sell',
    title: 'Première vente',
    desc: 'Vends des ressources à la Place marchande.',
    hint: 'Menu → Place marchande',
    check: (s) => (s.kirha || 0) > (s.startingKirha ?? 45),
    category: 'debut',
  },
  {
    id: 'unlock_lumberjack',
    title: 'Débloquer Bûcheron',
    desc: 'Étudie « Sentiers du bûcheron » à l\'École du Village.',
    hint: 'Menu → École du Village → Récolte',
    check: (s) => hasSchoolJobUnlock(s, 'lumberjack'),
    category: 'metiers',
  },
  {
    id: 'unlock_fisher',
    title: 'Débloquer Pêcheur',
    desc: 'Étudie « Voies d\'eau » à l\'École du Village.',
    hint: 'Menu → École du Village → Récolte',
    check: (s) => hasSchoolJobUnlock(s, 'fisher'),
    category: 'metiers',
  },
  {
    id: 'unlock_miner',
    title: 'Débloquer Mineur',
    desc: 'Étudie « Veines de pierre » à l\'École du Village.',
    hint: 'Menu → École du Village → Récolte',
    check: (s) => hasSchoolJobUnlock(s, 'miner'),
    category: 'metiers',
  },
  {
    id: 'unlock_alchemist',
    title: 'Débloquer Alchimiste',
    desc: 'Étudie « Sentier des herbes » à l\'École du Village.',
    hint: 'Menu → École du Village → Récolte',
    check: (s) => hasSchoolJobUnlock(s, 'alchemist'),
    category: 'metiers',
  },
  {
    id: 'first_tool',
    title: 'Premier outil',
    desc: 'Fabrique et équipe un outil à l\'Atelier.',
    hint: 'Menu → Atelier → Outilleur',
    check: (s) => ['lumberjack', 'fisher', 'miner', 'farmer', 'alchemist'].some((j) => getJobEquippedTool(s, j)),
    category: 'artisanat',
  },
  {
    id: 'unlock_combat',
    title: 'Premier combat',
    desc: 'Débloque le combat à l\'École du Village.',
    hint: 'Menu → École du Village → Combat',
    check: (s) => !!s.villageSchool?.unlockedCombat,
    category: 'combat',
  },
  {
    id: 'first_victory',
    title: 'Première victoire',
    desc: 'Bats un monstre en combat.',
    hint: 'Menu → Combat → choisis un donjon',
    check: (s) => (s.character?.level || 1) >= 2,
    category: 'combat',
  },
  {
    id: 'unlock_farm',
    title: 'Débloquer la ferme',
    desc: 'Étudie l\'élevage à l\'École du Village.',
    hint: 'Menu → École du Village → Ferme',
    check: (s) => hasSchoolFarmUnlock(s, 'chicken_coop'),
    category: 'ferme',
  },
  {
    id: 'unlock_cuisine',
    title: 'Débloquer la Cuisine',
    desc: 'Monte Paysan et Poulailler pour débloquer le Boulanger.',
    hint: 'Paysan Nv.6 + Poulailler Nv.6',
    check: (s) => (s.jobs?.baker?.level || 0) >= 1 || !!s.villageSchool?.unlockedCraftJobs?.includes?.('baker'),
    category: 'artisanat',
  },
  {
    id: 'season_2',
    title: 'Saison 2',
    desc: 'Passe à la Saison 2 pour débloquer de nouveaux plafonds.',
    hint: 'Menu → Saison → Nouvelle saison',
    check: (s) => (s.season || 1) >= 2,
    category: 'saison',
  },
];

const CATEGORIES = {
  debut: { label: '🌱 Premiers pas', order: 0 },
  metiers: { label: '⛏️ Métiers', order: 1 },
  artisanat: { label: '🛠️ Artisanat & Cuisine', order: 2 },
  combat: { label: '⚔️ Combat', order: 3 },
  ferme: { label: '🐔 Ferme', order: 4 },
  saison: { label: '🌸 Saisons', order: 5 },
};

export function getProgressionChecklist(state) {
  return MILESTONES.map((m) => ({
    ...m,
    done: m.check(state),
  }));
}

export function getChecklistByCategory(state) {
  const items = getProgressionChecklist(state);
  const groups = {};
  for (const item of items) {
    const cat = item.category || 'debut';
    if (!groups[cat]) groups[cat] = { ...CATEGORIES[cat], items: [] };
    groups[cat].items.push(item);
  }
  return Object.entries(groups)
    .sort(([, a], [, b]) => (a.order ?? 99) - (b.order ?? 99))
    .map(([id, group]) => ({ id, ...group }));
}

export function getChecklistProgress(state) {
  const items = getProgressionChecklist(state);
  const done = items.filter((m) => m.done).length;
  return { done, total: items.length, percent: Math.round((done / items.length) * 100) };
}
