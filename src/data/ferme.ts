import { TEST_MODE } from './metiers';
import { ResourceId } from './resources';

// ============================================================
// Configuration du Puits
// ============================================================

// En TEST_MODE : rechargement après 30s
// En production : rechargement quotidien à 00h00 heure française
export const PUITS_COOLDOWN_MS = TEST_MODE ? 30_000 : 0; // 0 = mode journalier

export function canCollectPuits(lastCollect: number): boolean {
  if (lastCollect === 0) return true;
  if (TEST_MODE) return Date.now() - lastCollect >= PUITS_COOLDOWN_MS;
  // Production : vérifie si minuit Paris a été dépassé depuis la dernière collecte
  const toParisDate = (ts: number) =>
    new Date(ts).toLocaleDateString('fr-FR', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    });
  return toParisDate(lastCollect) !== toParisDate(Date.now());
}

export function getSecondsUntilPuitsReset(lastCollect: number): number {
  if (TEST_MODE) {
    if (lastCollect === 0) return 0;
    return Math.max(0, Math.ceil((lastCollect + PUITS_COOLDOWN_MS - Date.now()) / 1000));
  }
  // Production : secondes jusqu'à minuit Paris
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
  niveauPersonnageRequis: number;
  resourceId: ResourceId;
  cooldownMs: number;
  production: number; // unités par récolte
}

export const ANIMALS: Animal[] = [
  {
    id: 'poule',
    emoji: '🐔',
    nom: 'Poule',
    niveauPersonnageRequis: 5,
    resourceId: ResourceId.OEUF,
    cooldownMs: TEST_MODE ? 10_000 : 4 * 3_600_000,
    production: 1,
  },
  {
    id: 'vache',
    emoji: '🐄',
    nom: 'Vache',
    niveauPersonnageRequis: 15,
    resourceId: ResourceId.LAIT,
    cooldownMs: TEST_MODE ? 20_000 : 6 * 3_600_000,
    production: 1,
  },
  {
    id: 'abeilles',
    emoji: '🐝',
    nom: 'Abeilles',
    niveauPersonnageRequis: 30,
    resourceId: ResourceId.MIEL_ANIMAL,
    cooldownMs: TEST_MODE ? 30_000 : 8 * 3_600_000,
    production: 1,
  },
  {
    id: 'cerf_sakura',
    emoji: '🦌',
    nom: 'Cerf Sakura',
    niveauPersonnageRequis: 60,
    resourceId: ResourceId.MUSC_SAKURA,
    cooldownMs: TEST_MODE ? 60_000 : 24 * 3_600_000,
    production: 1,
  },
  {
    id: 'koi_doree',
    emoji: '🐟',
    nom: 'Koï Dorée',
    niveauPersonnageRequis: 90,
    resourceId: ResourceId.ECAILLE_KOI,
    cooldownMs: TEST_MODE ? 120_000 : 48 * 3_600_000,
    production: 1,
  },
];
