import { ResourceId } from './resources';

// ============================================================
// Configuration du Puits
// ============================================================

// Reset quotidien à 00h00 heure française (Europe/Paris)
export function canCollectPuits(lastCollect: number): boolean {
  if (lastCollect === 0) return true;
  const toParisDate = (ts: number) =>
    new Date(ts).toLocaleDateString('fr-FR', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    });
  return toParisDate(lastCollect) !== toParisDate(Date.now());
}

export function getSecondsUntilPuitsReset(): number {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
  const s = parseInt(parts.find(p => p.type === 'second')?.value ?? '0');
  return 24 * 3600 - (h * 3600 + m * 60 + s);
}

// ============================================================
// Configuration des animaux
// ============================================================

export interface Animal {
  id: string;
  emoji: string;
  nom: string;
  nomBatiment: string;  // nom du bâtiment (ex: "Poulailler")
  niveauPersonnageRequis: number;
  resourceId: ResourceId;
  cooldownMs: number;
  production: number; // unités par récolte par slot
  slotLevels: number[]; // niveaux personnage pour débloquer chacun des 10 emplacements
}

export const ANIMALS: Animal[] = [
  {
    id: 'poule',
    emoji: '🐔',
    nom: 'Poulet',
    nomBatiment: 'Poulailler',
    niveauPersonnageRequis: 1,
    resourceId: ResourceId.OEUF,
    cooldownMs: 24 * 3_600_000,
    production: 1,
    slotLevels: [1, 8, 12, 16, 22, 28, 36, 45, 55, 67],
  },
  {
    id: 'vache',
    emoji: '🐄',
    nom: 'Vache',
    nomBatiment: 'Étable',
    niveauPersonnageRequis: 1,
    resourceId: ResourceId.LAIT,
    cooldownMs: 24 * 3_600_000,
    production: 1,
    slotLevels: [1, 20, 27, 35, 44, 54, 64, 74, 84, 93],
  },
  {
    id: 'abeilles',
    emoji: '🐝',
    nom: 'Abeilles',
    nomBatiment: 'Ruche',
    niveauPersonnageRequis: 1,
    resourceId: ResourceId.MIEL_ANIMAL,
    cooldownMs: 24 * 3_600_000,
    production: 1,
    slotLevels: [1, 38, 47, 57, 67, 77, 85, 91, 96, 100],
  },
  {
    id: 'cerf_sakura',
    emoji: '🐑',
    nom: 'Mouton',
    nomBatiment: 'Bergerie',
    niveauPersonnageRequis: 1,
    resourceId: ResourceId.LAINE,
    cooldownMs: 24 * 3_600_000,
    production: 1,
    slotLevels: [1, 66, 72, 78, 84, 88, 92, 95, 98, 100],
  },
  {
    id: 'koi_doree',
    emoji: '🐷',
    nom: 'Cochon',
    nomBatiment: 'Porcherie',
    niveauPersonnageRequis: 1,
    resourceId: ResourceId.BACON,
    cooldownMs: 24 * 3_600_000,
    production: 1,
    slotLevels: [1, 92, 94, 95, 96, 97, 97, 98, 99, 100],
  },
];
