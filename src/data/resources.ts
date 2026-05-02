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
  PARCHEMIN_ANCIENS = 52,
  OEUF = 53,
  LAIT = 54,
  MIEL_ANIMAL = 55,
  LAINE = 56,
  BACON = 57,

  // --- Cuisine (outputs chaîne) ---
  PAIN_MIE = 58,
  BOUILLIE_ORGE = 59,
  CREPE_SEIGLE = 60,
  PORRIDGE_AVOINE = 61,
  GALETTE_MAIS = 62,

  // --- Artisan (outputs) ---
  TABLE_SAKURA = 63,
  LANTERNE_BAMBOU = 64,

  // --- Alchimiste craft (outputs) ---
  POTION_VITALITE = 65,
  ONGUENT_SAKURA = 66,
  ELIXIR_RECOLTE = 67,

  // --- Cuisine haut niveau (outputs chaîne) ---
  RIZ_AU_MIEL = 68,
  SOUPE_MILLET = 69,
  SARRASIN_FUME = 70,
  RIZ_VIOLET_ROYAL = 71,
  BENTO_IMPERIAL = 72,
  FESTIN_LEGENDAIRE = 73,

  // --- Tisserand matières premières (outputs inventaire) ---
  TISSU_BAMBOU = 74,
  SOIE_SAKURA = 75,
  LIN_ALCHIMISTE = 76,

  // --- Forgeron outputs (inventaire) ---
  ENCLUME_PORTABLE = 77,
  PARCHEMIN_FORGE = 78,

  // --- Meubles craftables (posables dans la ferme/ville) ---
  MEUBLE_TABLE_BUCHERON = 80,
  MEUBLE_MEULE_PAYSAN   = 81,
  MEUBLE_VIVIER_PECHEUR = 82,
  MEUBLE_ENCLUME_MINEUR = 83,
  MEUBLE_ALAMBIC_ALCHI  = 84,
  MEUBLE_BASSIN_KOI     = 85,
  MEUBLE_ABREUVOIR      = 86,

  // --- Tisserand vêtements (IDs 125-129, utilisés aussi dans vetements.ts) ---
  KIMONO_BAMBOU = 125,
  HAORI_SAKURA = 126,
  HAKAMA_LIN = 127,
  KASA_TISSE = 128,
  OBI_FORGE = 129,
}

/** Toutes les ressources par métier pour itération */
export const BUCHERON_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const PAYSAN_IDS   = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;
export const PECHEUR_IDS  = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30] as const;
export const MINEUR_IDS   = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40] as const;
export const ALCHIMISTE_IDS = [41, 42, 43, 44, 45, 46, 47, 48, 49, 50] as const;
export const FERME_IDS         = [51, 52, 53, 54, 55, 56, 57] as const;
export const CUISINE_IDS       = [58, 59, 60, 61, 62, 68, 69, 70, 71, 72, 73] as const;
export const ARTISAN_IDS       = [63, 64] as const;
export const ALCHIMISTE_CRAFT_IDS = [65, 66, 67] as const;
export const TISSERAND_MATIERES_IDS = [74, 75, 76] as const;
export const FORGERON_OUTPUT_IDS    = [77, 78] as const;
export const MEUBLES_CRAFTABLES_IDS = [80, 81, 82, 83, 84, 85, 86] as const;
export const TISSERAND_EQUIP_IDS    = [125, 126, 127, 128, 129] as const;

/** IDs 1-50 : métiers de récolte on-chain. 51-69 : ferme / craft (KirhaGame cityResources). 70+ : local jusqu’à extension contrat. */
export const ALL_RESOURCE_IDS = [
  ...BUCHERON_IDS,
  ...PAYSAN_IDS,
  ...PECHEUR_IDS,
  ...MINEUR_IDS,
  ...ALCHIMISTE_IDS,
] as const;
