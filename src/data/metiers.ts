import { ResourceId } from './resources';

// ============================================================
// Types
// ============================================================

export type MetierId = 'bucheron' | 'paysan' | 'pecheur' | 'mineur' | 'alchimiste';

export interface Ressource {
  id: ResourceId;
  nom: string;
  metier: MetierId;
  niveau_requis: number;
  temps_recolte_secondes: number;
  xp_recolte: number;
}

export interface Metier {
  id: MetierId;
  nom: string;
  niveau_max: number;
  ressources: Ressource[];
}

// ============================================================
// Helpers
// ============================================================

// Temps de récolte et XP selon le niveau de déblocage
// TEST_MODE : temps de récolte réduit à 2s pour tester rapidement
// Remettre TEST_MODE = false avant la production
export const TEST_MODE = true;

const HARVEST_CONFIG: Record<number, { temps_recolte_secondes: number; xp_recolte: number }> = {
  1:  { temps_recolte_secondes: TEST_MODE ? 2 : 30,  xp_recolte: 10  },
  10: { temps_recolte_secondes: TEST_MODE ? 2 : 45,  xp_recolte: 15  },
  20: { temps_recolte_secondes: TEST_MODE ? 2 : 60,  xp_recolte: 25  },
  30: { temps_recolte_secondes: TEST_MODE ? 2 : 90,  xp_recolte: 40  },
  40: { temps_recolte_secondes: TEST_MODE ? 2 : 120, xp_recolte: 60  },
  50: { temps_recolte_secondes: TEST_MODE ? 2 : 180, xp_recolte: 90  },
  60: { temps_recolte_secondes: TEST_MODE ? 2 : 300, xp_recolte: 150 },
  70: { temps_recolte_secondes: TEST_MODE ? 2 : 420, xp_recolte: 210 },
  80: { temps_recolte_secondes: TEST_MODE ? 2 : 600, xp_recolte: 350 },
  90: { temps_recolte_secondes: TEST_MODE ? 2 : 900, xp_recolte: 500 },
};

function cfg(niveau: number) {
  return HARVEST_CONFIG[niveau] ?? { temps_recolte_secondes: 60, xp_recolte: 20 };
}

// ============================================================
// Bûcheron
// ============================================================

const bucheron: Metier = {
  id: 'bucheron',
  nom: 'Bûcheron',
  niveau_max: 100,
  ressources: [
    { id: ResourceId.FRENE,         nom: 'Frêne',          metier: 'bucheron', niveau_requis: 1,  ...cfg(1)  },
    { id: ResourceId.SEQUOIA,       nom: 'Séquoia',        metier: 'bucheron', niveau_requis: 10, ...cfg(10) },
    { id: ResourceId.CHENE,         nom: 'Chêne',          metier: 'bucheron', niveau_requis: 20, ...cfg(20) },
    { id: ResourceId.BOULEAU,       nom: 'Bouleau',        metier: 'bucheron', niveau_requis: 30, ...cfg(30) },
    { id: ResourceId.ERABLE,        nom: 'Érable',         metier: 'bucheron', niveau_requis: 40, ...cfg(40) },
    { id: ResourceId.BAMBOU,        nom: 'Bambou',         metier: 'bucheron', niveau_requis: 50, ...cfg(50) },
    { id: ResourceId.GINKGO,        nom: 'Ginkgo',         metier: 'bucheron', niveau_requis: 60, ...cfg(60) },
    { id: ResourceId.MAGNOLIA,      nom: 'Magnolia',       metier: 'bucheron', niveau_requis: 70, ...cfg(70) },
    { id: ResourceId.CERISIER_DORE, nom: 'Cerisier Doré', metier: 'bucheron', niveau_requis: 80, ...cfg(80) },
    { id: ResourceId.SAKURA,        nom: 'Sakura',         metier: 'bucheron', niveau_requis: 90, ...cfg(90) },
  ],
};

// ============================================================
// Paysan
// ============================================================

const paysan: Metier = {
  id: 'paysan',
  nom: 'Paysan',
  niveau_max: 100,
  ressources: [
    { id: ResourceId.BLE,        nom: 'Blé',           metier: 'paysan', niveau_requis: 1,  ...cfg(1)  },
    { id: ResourceId.ORGE,       nom: 'Orge',          metier: 'paysan', niveau_requis: 10, ...cfg(10) },
    { id: ResourceId.SEIGLE,     nom: 'Seigle',        metier: 'paysan', niveau_requis: 20, ...cfg(20) },
    { id: ResourceId.AVOINE,     nom: 'Avoine',        metier: 'paysan', niveau_requis: 30, ...cfg(30) },
    { id: ResourceId.MAIS,       nom: 'Maïs',          metier: 'paysan', niveau_requis: 40, ...cfg(40) },
    { id: ResourceId.RIZ,        nom: 'Riz',           metier: 'paysan', niveau_requis: 50, ...cfg(50) },
    { id: ResourceId.MILLET,     nom: 'Millet',        metier: 'paysan', niveau_requis: 60, ...cfg(60) },
    { id: ResourceId.SARRASIN,   nom: 'Sarrasin',      metier: 'paysan', niveau_requis: 70, ...cfg(70) },
    { id: ResourceId.RIZ_VIOLET, nom: 'Riz Violet',    metier: 'paysan', niveau_requis: 80, ...cfg(80) },
    { id: ResourceId.RIZ_SAKURA, nom: 'Riz Sakura',    metier: 'paysan', niveau_requis: 90, ...cfg(90) },
  ],
};

// ============================================================
// Pêcheur
// ============================================================

const pecheur: Metier = {
  id: 'pecheur',
  nom: 'Pêcheur',
  niveau_max: 100,
  ressources: [
    { id: ResourceId.CARPE_JAPONAISE, nom: 'Carpe Japonaise',    metier: 'pecheur', niveau_requis: 1,  ...cfg(1)  },
    { id: ResourceId.CRABE,           nom: 'Crabe',               metier: 'pecheur', niveau_requis: 10, ...cfg(10) },
    { id: ResourceId.SAUMON,          nom: 'Saumon',              metier: 'pecheur', niveau_requis: 20, ...cfg(20) },
    { id: ResourceId.HOMARD,          nom: 'Homard',              metier: 'pecheur', niveau_requis: 30, ...cfg(30) },
    { id: ResourceId.NASO,            nom: 'Naso',                metier: 'pecheur', niveau_requis: 40, ...cfg(40) },
    { id: ResourceId.PIEUVRE,         nom: 'Pieuvre',             metier: 'pecheur', niveau_requis: 50, ...cfg(50) },
    { id: ResourceId.CALMAR,          nom: 'Calmar',              metier: 'pecheur', niveau_requis: 60, ...cfg(60) },
    { id: ResourceId.CREVETTE_SAKURA, nom: 'Crevette Sakura',    metier: 'pecheur', niveau_requis: 70, ...cfg(70) },
    { id: ResourceId.FUGU,            nom: 'Fugu',                metier: 'pecheur', niveau_requis: 80, ...cfg(80) },
    { id: ResourceId.CARPE_KOI_DOREE, nom: 'Carpe Koï Dorée',   metier: 'pecheur', niveau_requis: 90, ...cfg(90) },
  ],
};

// ============================================================
// Mineur
// ============================================================

const mineur: Metier = {
  id: 'mineur',
  nom: 'Mineur',
  niveau_max: 100,
  ressources: [
    { id: ResourceId.PIERRE,        nom: 'Pierre',          metier: 'mineur', niveau_requis: 1,  ...cfg(1)  },
    { id: ResourceId.CHARBON,       nom: 'Charbon',         metier: 'mineur', niveau_requis: 10, ...cfg(10) },
    { id: ResourceId.CUIVRE,        nom: 'Cuivre',          metier: 'mineur', niveau_requis: 20, ...cfg(20) },
    { id: ResourceId.FER,           nom: 'Fer',             metier: 'mineur', niveau_requis: 30, ...cfg(30) },
    { id: ResourceId.TOPAZE,        nom: 'Topaze',          metier: 'mineur', niveau_requis: 40, ...cfg(40) },
    { id: ResourceId.EMERAUDE,      nom: 'Émeraude',        metier: 'mineur', niveau_requis: 50, ...cfg(50) },
    { id: ResourceId.JADE,          nom: 'Jade',            metier: 'mineur', niveau_requis: 60, ...cfg(60) },
    { id: ResourceId.DIAMANT,       nom: 'Diamant',         metier: 'mineur', niveau_requis: 70, ...cfg(70) },
    { id: ResourceId.SAPHIR_SAKURA, nom: 'Saphir Sakura',  metier: 'mineur', niveau_requis: 80, ...cfg(80) },
    { id: ResourceId.CRISTAL_KOI,   nom: 'Cristal Koï',    metier: 'mineur', niveau_requis: 90, ...cfg(90) },
  ],
};

// ============================================================
// Alchimiste
// ============================================================

const alchimiste: Metier = {
  id: 'alchimiste',
  nom: 'Alchimiste',
  niveau_max: 100,
  ressources: [
    { id: ResourceId.PISSENLIT,          nom: 'Pissenlit',              metier: 'alchimiste', niveau_requis: 1,  ...cfg(1)  },
    { id: ResourceId.MENTHE,             nom: 'Menthe',                 metier: 'alchimiste', niveau_requis: 10, ...cfg(10) },
    { id: ResourceId.ORTIE,              nom: 'Ortie',                  metier: 'alchimiste', niveau_requis: 20, ...cfg(20) },
    { id: ResourceId.LAVANDE,            nom: 'Lavande',                metier: 'alchimiste', niveau_requis: 30, ...cfg(30) },
    { id: ResourceId.PIVOINE,            nom: 'Pivoine',                metier: 'alchimiste', niveau_requis: 40, ...cfg(40) },
    { id: ResourceId.WISTERIA,           nom: 'Wisteria',               metier: 'alchimiste', niveau_requis: 50, ...cfg(50) },
    { id: ResourceId.CHRYSANTHEME,       nom: 'Chrysanthème',           metier: 'alchimiste', niveau_requis: 60, ...cfg(60) },
    { id: ResourceId.GINSENG,            nom: 'Ginseng',                metier: 'alchimiste', niveau_requis: 70, ...cfg(70) },
    { id: ResourceId.FLEUR_LOTUS_SAKURA, nom: 'Fleur de Lotus Sakura', metier: 'alchimiste', niveau_requis: 80, ...cfg(80) },
    { id: ResourceId.HERBE_KOI,          nom: 'Herbe Koï',             metier: 'alchimiste', niveau_requis: 90, ...cfg(90) },
  ],
};

// ============================================================
// Export
// ============================================================

export const METIERS: Record<MetierId, Metier> = {
  bucheron,
  paysan,
  pecheur,
  mineur,
  alchimiste,
};

export const ALL_METIERS = Object.values(METIERS);

/** Récupère une ressource par son ID ERC-1155 */
export function getResourceById(id: ResourceId): Ressource | undefined {
  for (const metier of ALL_METIERS) {
    const found = metier.ressources.find(r => r.id === id);
    if (found) return found;
  }
  return undefined;
}
