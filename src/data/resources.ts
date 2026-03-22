// ============================================================
// ERC-1155 Resource IDs — To-Kirha
// Bûcheron   : 1-10
// Paysan     : 11-20
// Pêcheur    : 21-30
// Mineur     : 31-40
// Alchimiste : 41-50
// ============================================================

export enum ResourceId {
  // --- Bûcheron ---
  FRENE = 1,
  SEQUOIA = 2,
  CHENE = 3,
  BOULEAU = 4,
  ERABLE = 5,
  BAMBOU = 6,
  GINKGO = 7,
  MAGNOLIA = 8,
  CERISIER_DORE = 9,
  SAKURA = 10,

  // --- Paysan ---
  BLE = 11,
  ORGE = 12,
  SEIGLE = 13,
  AVOINE = 14,
  MAIS = 15,
  RIZ = 16,
  MILLET = 17,
  SARRASIN = 18,
  RIZ_VIOLET = 19,
  RIZ_SAKURA = 20,

  // --- Pêcheur ---
  CARPE_JAPONAISE = 21,
  CRABE = 22,
  SAUMON = 23,
  HOMARD = 24,
  NASO = 25,
  PIEUVRE = 26,
  CALMAR = 27,
  CREVETTE_SAKURA = 28,
  FUGU = 29,
  CARPE_KOI_DOREE = 30,

  // --- Mineur ---
  PIERRE = 31,
  CHARBON = 32,
  CUIVRE = 33,
  FER = 34,
  TOPAZE = 35,
  EMERAUDE = 36,
  JADE = 37,
  DIAMANT = 38,
  SAPHIR_SAKURA = 39,
  CRISTAL_KOI = 40,

  // --- Alchimiste ---
  PISSENLIT = 41,
  MENTHE = 42,
  ORTIE = 43,
  LAVANDE = 44,
  PIVOINE = 45,
  WISTERIA = 46,
  CHRYSANTHEME = 47,
  GINSENG = 48,
  FLEUR_LOTUS_SAKURA = 49,
  HERBE_KOI = 50,

  // --- Ferme ---
  EAU = 51,
  FLEUR_CERISIER = 52,
  OEUF = 53,
  LAIT = 54,
  MIEL_ANIMAL = 55,
  MUSC_SAKURA = 56,
  ECAILLE_KOI = 57,

  // --- Cuisine (outputs) ---
  PAIN_BLE = 58,
  RIZ_AU_LAIT = 59,
  GALETTE_SAKURA = 60,
  MIEL_SAKURA = 61,
  THE_WISTERIA = 62,
}

/** Toutes les ressources par métier pour itération */
export const BUCHERON_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const PAYSAN_IDS   = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;
export const PECHEUR_IDS  = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30] as const;
export const MINEUR_IDS   = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40] as const;
export const ALCHIMISTE_IDS = [41, 42, 43, 44, 45, 46, 47, 48, 49, 50] as const;
export const FERME_IDS    = [51, 52, 53, 54, 55, 56, 57] as const;
export const CUISINE_IDS  = [58, 59, 60, 61, 62] as const;

/** IDs on-chain uniquement (1-50) */
export const ALL_RESOURCE_IDS = [
  ...BUCHERON_IDS,
  ...PAYSAN_IDS,
  ...PECHEUR_IDS,
  ...MINEUR_IDS,
  ...ALCHIMISTE_IDS,
] as const;
