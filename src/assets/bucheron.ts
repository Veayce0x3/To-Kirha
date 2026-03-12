// ============================================================
// Assets Bûcheron — URLs web (public/assets/)
// Vite préfixe automatiquement avec BASE_URL
// ============================================================

const base = import.meta.env.BASE_URL;

export const BucheronBackground = `${base}assets/metiers/bucheron/background.jpg`;

export const BucheronAssets = {
  frene: {
    arbre:       `${base}assets/metiers/bucheron/frene/arbre.jpg`,
    tronc_coupe: `${base}assets/metiers/bucheron/frene/tronc_coupe.jpg`,
    inventaire:  `${base}assets/metiers/bucheron/frene/inventaire.jpg`,
  },
  // null = asset à venir
  sequoia:       null,
  chene:         null,
  bouleau:       null,
  erable:        null,
  bambou:        null,
  ginkgo:        null,
  magnolia:      null,
  cerisier_dore: null,
  sakura:        null,
} as const;

export const KirhaTokenImg = `${base}assets/token/kirha_token.jpg`;
