import { ResourceId } from '../data/resources';

// ── Noms des ressources (FR + EN) ───────────────────────────
const RESOURCE_NAMES: Record<number, { fr: string; en: string }> = {
  // Bûcheron / Lumberjack
  1:  { fr: 'Frêne',               en: 'Ash'                  },
  2:  { fr: 'Séquoia',             en: 'Redwood'              },
  3:  { fr: 'Chêne',               en: 'Oak'                  },
  4:  { fr: 'Bouleau',             en: 'Birch'                },
  5:  { fr: 'Érable',              en: 'Maple'                },
  6:  { fr: 'Bambou',              en: 'Bamboo'               },
  7:  { fr: 'Ginkgo',              en: 'Ginkgo'               },
  8:  { fr: 'Magnolia',            en: 'Magnolia'             },
  9:  { fr: 'Cerisier Doré',       en: 'Golden Cherry'        },
  10: { fr: 'Sakura',              en: 'Sakura'               },
  // Paysan / Farmer
  11: { fr: 'Blé',                 en: 'Wheat'                },
  12: { fr: 'Orge',                en: 'Barley'               },
  13: { fr: 'Seigle',              en: 'Rye'                  },
  14: { fr: 'Avoine',              en: 'Oats'                 },
  15: { fr: 'Maïs',                en: 'Corn'                 },
  16: { fr: 'Riz',                 en: 'Rice'                 },
  17: { fr: 'Millet',              en: 'Millet'               },
  18: { fr: 'Sarrasin',            en: 'Buckwheat'            },
  19: { fr: 'Riz Violet',          en: 'Purple Rice'          },
  20: { fr: 'Riz Sakura',          en: 'Sakura Rice'          },
  // Pêcheur / Fisher
  21: { fr: 'Carpe Japonaise',     en: 'Japanese Carp'        },
  22: { fr: 'Crabe',               en: 'Crab'                 },
  23: { fr: 'Saumon',              en: 'Salmon'               },
  24: { fr: 'Homard',              en: 'Lobster'              },
  25: { fr: 'Naso',                en: 'Naso'                 },
  26: { fr: 'Pieuvre',             en: 'Octopus'              },
  27: { fr: 'Calmar',              en: 'Squid'                },
  28: { fr: 'Crevette Sakura',     en: 'Sakura Shrimp'        },
  29: { fr: 'Fugu',                en: 'Fugu'                 },
  30: { fr: 'Carpe Koï Dorée',     en: 'Golden Koi'           },
  // Mineur / Miner
  31: { fr: 'Pierre',              en: 'Stone'                },
  32: { fr: 'Charbon',             en: 'Coal'                 },
  33: { fr: 'Cuivre',              en: 'Copper'               },
  34: { fr: 'Fer',                 en: 'Iron'                 },
  35: { fr: 'Topaze',              en: 'Topaz'                },
  36: { fr: 'Émeraude',            en: 'Emerald'              },
  37: { fr: 'Jade',                en: 'Jade'                 },
  38: { fr: 'Diamant',             en: 'Diamond'              },
  39: { fr: 'Saphir Sakura',       en: 'Sakura Sapphire'      },
  40: { fr: 'Cristal Koï',         en: 'Koi Crystal'          },
  // Alchimiste / Alchemist
  41: { fr: 'Pissenlit',           en: 'Dandelion'            },
  42: { fr: 'Menthe',              en: 'Mint'                 },
  43: { fr: 'Ortie',               en: 'Nettle'               },
  44: { fr: 'Lavande',             en: 'Lavender'             },
  45: { fr: 'Pivoine',             en: 'Peony'                },
  46: { fr: 'Wisteria',            en: 'Wisteria'             },
  47: { fr: 'Chrysanthème',        en: 'Chrysanthemum'        },
  48: { fr: 'Ginseng',             en: 'Ginseng'              },
  49: { fr: 'Fleur de Lotus Sakura', en: 'Sakura Lotus'       },
  50: { fr: 'Herbe Koï',           en: 'Koi Herb'             },
  // Ferme
  51: { fr: 'Eau',                 en: 'Water'                },
  52: { fr: 'Parchemin Ancien', en: 'Ancient Parchment' },
  53: { fr: 'Œuf',                 en: 'Egg'                  },
  54: { fr: 'Lait',                en: 'Milk'                 },
  55: { fr: 'Miel',                en: 'Honey'                },
  56: { fr: 'Musc Sakura',         en: 'Sakura Musk'          },
  57: { fr: 'Écaille de Koï',      en: 'Koi Scale'            },
  // Cuisine
  58: { fr: 'Pain de Blé',         en: 'Wheat Bread'          },
  59: { fr: 'Riz au Lait',         en: 'Rice Pudding'         },
  60: { fr: 'Galette Sakura',      en: 'Sakura Pancake'       },
  61: { fr: 'Miel Sakura',         en: 'Sakura Honey'         },
  62: { fr: 'Thé Wisteria',        en: 'Wisteria Tea'         },
  // Artisan
  63: { fr: 'Table Sakura',        en: 'Sakura Table'         },
  64: { fr: 'Lanterne Bambou',     en: 'Bamboo Lantern'       },
  // Alchimiste craft
  65: { fr: 'Potion de Vitalité',  en: 'Vitality Potion'      },
  66: { fr: 'Onguent Sakura',      en: 'Sakura Salve'         },
  67: { fr: 'Élixir de Récolte',   en: 'Harvest Elixir'       },
  // Cuisine haut niveau
  68: { fr: 'Soupe du Pêcheur',    en: 'Fisher\'s Soup'       },
  69: { fr: 'Bento Impérial',      en: 'Imperial Bento'       },
};

export function getNomRessource(id: number, lang: 'fr' | 'en' = 'fr'): string {
  return RESOURCE_NAMES[id]?.[lang] ?? RESOURCE_NAMES[id]?.fr ?? '?';
}

// ── Emoji par ResourceId ─────────────────────────────────────
const RESOURCE_EMOJI: Record<number, string> = {
  1: '🪵', 2: '🌲', 3: '🌳', 4: '🌿', 5: '🍁',
  6: '🎋', 7: '🍃', 8: '🌸', 9: '🌺', 10: '🌸',
  11: '🌾', 12: '🌾', 13: '🌿', 14: '🌾', 15: '🌽',
  16: '🍚', 17: '🌾', 18: '🌿', 19: '🍚', 20: '🍚',
  21: '🐟', 22: '🦀', 23: '🐠', 24: '🦞', 25: '🐡',
  26: '🐙', 27: '🦑', 28: '🍤', 29: '🐡', 30: '🐟',
  31: '🪨', 32: '⬛', 33: '🟤', 34: '⚙️', 35: '💛',
  36: '💚', 37: '🟢', 38: '💎', 39: '💙', 40: '🔮',
  41: '🌼', 42: '🌿', 43: '🌱', 44: '💜', 45: '🌺',
  46: '🪻', 47: '🌸', 48: '🫚', 49: '🪷', 50: '🌿',
  // Ferme
  51: '💧', 52: '📜', 53: '🥚', 54: '🥛', 55: '🍯',
  56: '✨', 57: '🔮',
  // Cuisine
  58: '🍞', 59: '🍚', 60: '🥞', 61: '🍯', 62: '🍵',
  // Artisan
  63: '🪑', 64: '🏮',
  // Alchimiste craft
  65: '🧪', 66: '💆', 67: '⚗️',
  // Cuisine haut niveau
  68: '🍲', 69: '🎎',
};

export function emojiByResourceId(id: ResourceId | number): string {
  return RESOURCE_EMOJI[id] ?? '📦';
}

// ── Images par ResourceId ─────────────────────────────────────
export type ResourceImgType = 'idle' | 'done' | 'inventory';

const RESOURCE_IMAGES: Partial<Record<number, Partial<Record<ResourceImgType, string>>>> = {
  // Bûcheron
  1:  { idle: 'metiers/bucheron/frene/arbre.png',        done: 'metiers/bucheron/frene/tronc_coupe.png',        inventory: 'metiers/bucheron/frene/inventaire.png'        },
  2:  { idle: 'metiers/bucheron/sequoia/arbre.png',      done: 'metiers/bucheron/sequoia/tronc_coupe.png',      inventory: 'metiers/bucheron/sequoia/inventaire.png'      },
  3:  { idle: 'metiers/bucheron/chene/arbre.png',        done: 'metiers/bucheron/chene/tronc_coupe.png',        inventory: 'metiers/bucheron/chene/inventaire.png'        },
  4:  { idle: 'metiers/bucheron/bouleau/arbre.png',      done: 'metiers/bucheron/bouleau/tronc_coupe.png',      inventory: 'metiers/bucheron/bouleau/inventaire.png'      },
  5:  { idle: 'metiers/bucheron/erable/arbre.png',       done: 'metiers/bucheron/erable/tronc_coupe.png',       inventory: 'metiers/bucheron/erable/inventaire.png'       },
  6:  { idle: 'metiers/bucheron/bambou/arbre.png',       done: 'metiers/bucheron/bambou/tronc_coupe.png',       inventory: 'metiers/bucheron/bambou/inventaire.png'       },
  7:  { idle: 'metiers/bucheron/ginkgo/arbre.png',       done: 'metiers/bucheron/ginkgo/tronc_coupe.png',       inventory: 'metiers/bucheron/ginkgo/inventaire.png'       },
  8:  { idle: 'metiers/bucheron/magnolia/arbre.png',     done: 'metiers/bucheron/magnolia/tronc_coupe.png',     inventory: 'metiers/bucheron/magnolia/inventaire.png'     },
  9:  { idle: 'metiers/bucheron/cerisier_dore/arbre.png',done: 'metiers/bucheron/cerisier_dore/tronc_coupe.png',inventory: 'metiers/bucheron/cerisier_dore/inventaire.png'},
  10: { idle: 'metiers/bucheron/sakura/arbre.png',       done: 'metiers/bucheron/sakura/tronc_coupe.png',       inventory: 'metiers/bucheron/sakura/inventaire.png'       },
  // Paysan
  11: { idle: 'metiers/paysan/ble/arbre.png',    done: 'metiers/paysan/ble/tronc_coupe.png',    inventory: 'metiers/paysan/ble/inventaire.png'    },
  12: { idle: 'metiers/paysan/orge/arbre.png',   done: 'metiers/paysan/orge/tronc_coupe.png',   inventory: 'metiers/paysan/orge/inventaire.png'   },
  13: { idle: 'metiers/paysan/seigle/arbre.png', done: 'metiers/paysan/seigle/tronc_coupe.png', inventory: 'metiers/paysan/seigle/inventaire.png' },
  14: { idle: 'metiers/paysan/avoine/arbre.png', done: 'metiers/paysan/avoine/tronc_coupe.png', inventory: 'metiers/paysan/avoine/inventaire.png' },
};

export function imageByResourceId(id: number, type: ResourceImgType): string | null {
  const paths = RESOURCE_IMAGES[id];
  if (!paths) return null;
  const rel = paths[type];
  if (!rel) return null;
  return `${import.meta.env.BASE_URL}assets/${rel}`;
}

// ── Icônes métiers ────────────────────────────────────────────
const METIER_ICON_PATHS: Record<string, string> = {
  bucheron:   'metiers/bucheron/icone.png',
  paysan:     'metiers/paysan/icone.png',
  pecheur:    'metiers/pecheur/icone.png',
  mineur:     'metiers/mineur/icone.png',
  alchimiste: 'metiers/alchimiste/icone.png',
};

export function metierIconPath(metierId: string): string | null {
  const rel = METIER_ICON_PATHS[metierId];
  return rel ? `${import.meta.env.BASE_URL}assets/${rel}` : null;
}

// ── Assets UI génériques ──────────────────────────────────────
export function uiAssetPath(rel: string): string {
  return `${import.meta.env.BASE_URL}assets/${rel}`;
}
