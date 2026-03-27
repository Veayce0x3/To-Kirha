// ============================================================
// Système de Saisons — To-Kirha
// 5 saisons, rotation toutes les 14 jours depuis le 2026-01-01.
// Chaque saison booste un métier : +20% Qty (pas de bonus XP).
// ============================================================

import { MetierId } from './metiers';

export type SaisonId = MetierId;

export interface Saison {
  id:       SaisonId;
  nom:      string;
  nomEn:    string;
  emoji:    string;
  color:    string;
  bonusQty: number; // en % (quantité uniquement, pas de bonus XP)
  resourceIds: readonly number[];
}

const SAISONS: Saison[] = [
  {
    id: 'bucheron',
    nom: 'Saison des Forêts',
    nomEn: 'Forest Season',
    emoji: '🌳',
    color: '#4caf50',
    bonusQty: 20,
    resourceIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: 'paysan',
    nom: 'Saison des Moissons',
    nomEn: 'Harvest Season',
    emoji: '🌾',
    color: '#ff9800',
    bonusQty: 20,
    resourceIds: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  },
  {
    id: 'pecheur',
    nom: 'Saison des Eaux',
    nomEn: 'Water Season',
    emoji: '🐟',
    color: '#29b6f6',
    bonusQty: 20,
    resourceIds: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  },
  {
    id: 'mineur',
    nom: 'Saison des Mines',
    nomEn: 'Mining Season',
    emoji: '⛏️',
    color: '#9e9e9e',
    bonusQty: 20,
    resourceIds: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
  },
  {
    id: 'alchimiste',
    nom: 'Saison des Plantes',
    nomEn: 'Herb Season',
    emoji: '🌺',
    color: '#ab47bc',
    bonusQty: 20,
    resourceIds: [41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
  },
];

const REFERENCE_DATE = new Date('2026-01-01T00:00:00Z').getTime();
const SAISON_DURATION_DAYS = 14;
const SAISON_DURATION_MS = SAISON_DURATION_DAYS * 24 * 60 * 60 * 1000;

export function getSaisonActuelle(): Saison {
  const elapsed = Date.now() - REFERENCE_DATE;
  const index = Math.floor(elapsed / SAISON_DURATION_MS) % SAISONS.length;
  return SAISONS[Math.max(0, index)];
}

export function joursRestantsSaison(): number {
  const elapsed = Date.now() - REFERENCE_DATE;
  const elapsedInCycle = elapsed % SAISON_DURATION_MS;
  return Math.ceil((SAISON_DURATION_MS - elapsedInCycle) / (24 * 60 * 60 * 1000));
}

export function getSaisonById(id: SaisonId): Saison {
  return SAISONS.find(s => s.id === id) ?? SAISONS[0];
}

export { SAISONS };
