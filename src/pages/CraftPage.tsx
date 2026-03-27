import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, xpRequis, xpRequisPersonage } from '../store/gameStore';
import { ResourceId } from '../data/resources';
import { useT } from '../utils/i18n';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';
import { ToolType, OUTIL_INFO, getUpgradeRecipe, DURABILITE_MAX, getOutilXp, METIER_TOOL_TYPE } from '../data/outils';

// ============================================================
// Types de recettes
// ============================================================

interface Ingredient {
  resourceId: ResourceId;
  quantite: number;
}

// Recette standard → résultat dans l'inventaire
interface RecetteInventaire {
  kind: 'inventaire';
  id: string;
  emoji: string;
  nom: string;
  nomEn: string;
  ingredients: Ingredient[];
  resultatId: ResourceId;
  resultatQte: number;
  xp: number;
  niveauRequis?: number; // niveau personnage requis
  description: string;
  descriptionEn: string;
}

type Recette = RecetteInventaire;

// ============================================================
// Recettes de Cuisine — chaîne progressive
// Chaque recette consomme l'output de la précédente + nouvelles ressources
// Parchemin des Anciens requis à partir de la recette 2 (acheté au PNJ HDV)
// ============================================================

const RECETTES_CUISINE: RecetteInventaire[] = [
  {
    kind: 'inventaire',
    id: 'pain_mie',
    emoji: '🍞',
    nom: 'Pain de Mie',
    nomEn: 'White Bread',
    niveauRequis: 1,
    ingredients: [
      { resourceId: ResourceId.BLE, quantite: 5 },
    ],
    resultatId: ResourceId.PAIN_MIE,
    resultatQte: 1,
    xp: 150,
    description: 'Base de toute cuisine. Simple mais fondamental.',
    descriptionEn: 'The foundation of all cooking. Simple but essential.',
  },
  {
    kind: 'inventaire',
    id: 'bouillie_orge',
    emoji: '🥣',
    nom: "Bouillie d'Orge",
    nomEn: 'Barley Porridge',
    niveauRequis: 10,
    ingredients: [
      { resourceId: ResourceId.PAIN_MIE,          quantite: 1 },
      { resourceId: ResourceId.ORGE,              quantite: 3 },
      { resourceId: ResourceId.EAU,               quantite: 1 },
      { resourceId: ResourceId.LAIT,              quantite: 1 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 1 },
    ],
    resultatId: ResourceId.BOUILLIE_ORGE,
    resultatQte: 1,
    xp: 400,
    description: 'Bouillie nourrissante à base d\'orge et de lait frais.',
    descriptionEn: 'Hearty porridge made from barley and fresh milk.',
  },
  {
    kind: 'inventaire',
    id: 'crepe_seigle',
    emoji: '🥞',
    nom: 'Crêpe de Seigle',
    nomEn: 'Rye Crepe',
    niveauRequis: 20,
    ingredients: [
      { resourceId: ResourceId.BOUILLIE_ORGE,     quantite: 1 },
      { resourceId: ResourceId.SEIGLE,            quantite: 3 },
      { resourceId: ResourceId.OEUF,              quantite: 1 },
      { resourceId: ResourceId.CARPE_JAPONAISE,   quantite: 2 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 2 },
    ],
    resultatId: ResourceId.CREPE_SEIGLE,
    resultatQte: 1,
    xp: 900,
    description: 'Crêpe rustique enrichie d\'œuf et de carpe japonaise.',
    descriptionEn: 'Rustic crepe enriched with egg and Japanese carp.',
  },
  {
    kind: 'inventaire',
    id: 'porridge_avoine',
    emoji: '🥣',
    nom: "Porridge d'Avoine",
    nomEn: 'Oat Porridge',
    niveauRequis: 30,
    ingredients: [
      { resourceId: ResourceId.CREPE_SEIGLE,      quantite: 1 },
      { resourceId: ResourceId.AVOINE,            quantite: 3 },
      { resourceId: ResourceId.CRABE,             quantite: 2 },
      { resourceId: ResourceId.PISSENLIT,         quantite: 2 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 3 },
    ],
    resultatId: ResourceId.PORRIDGE_AVOINE,
    resultatQte: 1,
    xp: 2000,
    description: 'Porridge raffiné aux herbes sauvages et crabe des rivières.',
    descriptionEn: 'Refined porridge with wild herbs and river crab.',
  },
  {
    kind: 'inventaire',
    id: 'galette_mais',
    emoji: '🌽',
    nom: 'Galette de Maïs',
    nomEn: 'Corn Cake',
    niveauRequis: 40,
    ingredients: [
      { resourceId: ResourceId.PORRIDGE_AVOINE,   quantite: 1 },
      { resourceId: ResourceId.MAIS,              quantite: 3 },
      { resourceId: ResourceId.SAUMON,            quantite: 2 },
      { resourceId: ResourceId.MENTHE,            quantite: 2 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 4 },
    ],
    resultatId: ResourceId.GALETTE_MAIS,
    resultatQte: 1,
    xp: 4500,
    description: 'Galette dorée au saumon et menthe fraîche des jardins.',
    descriptionEn: 'Golden cake with salmon and fresh garden mint.',
  },
  {
    kind: 'inventaire',
    id: 'riz_au_miel',
    emoji: '🍚',
    nom: 'Riz au Miel',
    nomEn: 'Honey Rice',
    niveauRequis: 50,
    ingredients: [
      { resourceId: ResourceId.GALETTE_MAIS,      quantite: 1 },
      { resourceId: ResourceId.RIZ,               quantite: 3 },
      { resourceId: ResourceId.MIEL_ANIMAL,       quantite: 1 },
      { resourceId: ResourceId.HOMARD,            quantite: 2 },
      { resourceId: ResourceId.ORTIE,             quantite: 2 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 5 },
    ],
    resultatId: ResourceId.RIZ_AU_MIEL,
    resultatQte: 1,
    xp: 10000,
    description: 'Riz gluant au miel de ruche, parfumé à l\'ortie et au homard.',
    descriptionEn: 'Sticky rice with hive honey, scented with nettle and lobster.',
  },
  {
    kind: 'inventaire',
    id: 'soupe_millet',
    emoji: '🍲',
    nom: 'Soupe du Millet',
    nomEn: 'Millet Soup',
    niveauRequis: 58,
    ingredients: [
      { resourceId: ResourceId.RIZ_AU_MIEL,       quantite: 1 },
      { resourceId: ResourceId.MILLET,            quantite: 3 },
      { resourceId: ResourceId.NASO,              quantite: 2 },
      { resourceId: ResourceId.LAVANDE,           quantite: 2 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 6 },
    ],
    resultatId: ResourceId.SOUPE_MILLET,
    resultatQte: 1,
    xp: 22000,
    description: 'Soupe ancestrale de millet et naso, apaisée à la lavande.',
    descriptionEn: 'Ancestral millet and naso soup, soothed with lavender.',
  },
  {
    kind: 'inventaire',
    id: 'sarrasin_fume',
    emoji: '🥘',
    nom: 'Sarrasin Fumé',
    nomEn: 'Smoked Buckwheat',
    niveauRequis: 66,
    ingredients: [
      { resourceId: ResourceId.SOUPE_MILLET,      quantite: 1 },
      { resourceId: ResourceId.SARRASIN,          quantite: 3 },
      { resourceId: ResourceId.PIEUVRE,           quantite: 2 },
      { resourceId: ResourceId.PIVOINE,           quantite: 2 },
      { resourceId: ResourceId.BACON,             quantite: 1 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 7 },
    ],
    resultatId: ResourceId.SARRASIN_FUME,
    resultatQte: 1,
    xp: 50000,
    description: 'Cassoulet de sarrasin fumé au bacon, garni de pivoine et pieuvre.',
    descriptionEn: 'Smoked buckwheat stew with bacon, peony and octopus.',
  },
  {
    kind: 'inventaire',
    id: 'riz_violet_royal',
    emoji: '🍱',
    nom: 'Riz Violet Royal',
    nomEn: 'Royal Purple Rice',
    niveauRequis: 75,
    ingredients: [
      { resourceId: ResourceId.SARRASIN_FUME,     quantite: 1 },
      { resourceId: ResourceId.RIZ_VIOLET,        quantite: 3 },
      { resourceId: ResourceId.CALMAR,            quantite: 2 },
      { resourceId: ResourceId.WISTERIA,          quantite: 2 },
      { resourceId: ResourceId.LAINE,             quantite: 1 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 8 },
    ],
    resultatId: ResourceId.RIZ_VIOLET_ROYAL,
    resultatQte: 1,
    xp: 110000,
    description: 'Riz violet fumé enveloppé de laine dorée et parfumé au wisteria.',
    descriptionEn: 'Smoked purple rice wrapped in golden wool, scented with wisteria.',
  },
  {
    kind: 'inventaire',
    id: 'bento_imperial',
    emoji: '🎎',
    nom: 'Bento Impérial',
    nomEn: 'Imperial Bento',
    niveauRequis: 90,
    ingredients: [
      { resourceId: ResourceId.RIZ_VIOLET_ROYAL,  quantite: 1 },
      { resourceId: ResourceId.RIZ_SAKURA,        quantite: 3 },
      { resourceId: ResourceId.CREVETTE_SAKURA,   quantite: 2 },
      { resourceId: ResourceId.CHRYSANTHEME,      quantite: 2 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 10 },
    ],
    resultatId: ResourceId.BENTO_IMPERIAL,
    resultatQte: 1,
    xp: 250000,
    description: 'Chef-d\'œuvre de la cuisine Kirha, digne des grandes cérémonies.',
    descriptionEn: 'Culinary masterpiece of Kirha cuisine, worthy of grand ceremonies.',
  },
  {
    kind: 'inventaire',
    id: 'festin_legendaire',
    emoji: '👑',
    nom: 'Festin Légendaire',
    nomEn: 'Legendary Feast',
    niveauRequis: 99,
    ingredients: [
      { resourceId: ResourceId.BENTO_IMPERIAL,    quantite: 1 },
      { resourceId: ResourceId.FUGU,              quantite: 1 },
      { resourceId: ResourceId.CARPE_KOI_DOREE,   quantite: 1 },
      { resourceId: ResourceId.GINSENG,           quantite: 2 },
      { resourceId: ResourceId.FLEUR_LOTUS_SAKURA, quantite: 2 },
      { resourceId: ResourceId.HERBE_KOI,         quantite: 2 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 15 },
    ],
    resultatId: ResourceId.FESTIN_LEGENDAIRE,
    resultatQte: 1,
    xp: 500000,
    description: 'Le repas des dieux. Seuls les plus grands cuisiniers peuvent l\'accomplir. Atteindre le niveau 100 débloque 1 Parchemin des Anciens offert par jour.',
    descriptionEn: 'The meal of gods. Only the greatest chefs can achieve it. Reaching level 100 grants 1 free Ancient Parchment per day.',
  },
];

// ============================================================
// Recettes Artisan
// ============================================================

const RECETTES_ARTISAN: Recette[] = [
  // ── Mobilier
  {
    kind: 'inventaire',
    id: 'table_sakura',
    emoji: '🪑',
    nom: 'Table Sakura',
    nomEn: 'Sakura Table',
    ingredients: [
      { resourceId: ResourceId.CHENE,         quantite: 3 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 2 },
    ],
    resultatId: ResourceId.TABLE_SAKURA,
    resultatQte: 1,
    xp: 30,
    description: 'Mobilier artisanal en bois de chêne décoré de sakura.',
    descriptionEn: 'Crafted oak furniture decorated with sakura.',
  },
  {
    kind: 'inventaire',
    id: 'lanterne_bambou',
    emoji: '🏮',
    nom: 'Lanterne Bambou',
    nomEn: 'Bamboo Lantern',
    ingredients: [
      { resourceId: ResourceId.BAMBOU,        quantite: 4 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 2 },
    ],
    resultatId: ResourceId.LANTERNE_BAMBOU,
    resultatQte: 1,
    xp: 45,
    description: 'Lanterne traditionnelle en bambou lacé de fleurs.',
    descriptionEn: 'Traditional bamboo lantern laced with flowers.',
  },
];

// ============================================================
// Recettes Meubles Plaçables (craft via Artisan → bonus quand posés)
// ============================================================

const RECETTES_MEUBLES: RecetteInventaire[] = [
  {
    kind: 'inventaire', id: 'table_bucheron', emoji: '🪵',
    nom: 'Table du Bûcheron', nomEn: "Lumberjack's Table",
    ingredients: [
      { resourceId: ResourceId.FRENE,  quantite: 80 },
      { resourceId: ResourceId.CHENE,  quantite: 60 },
      { resourceId: ResourceId.PIERRE, quantite: 40 },
      { resourceId: ResourceId.FER,    quantite: 20 },
    ],
    resultatId: ResourceId.MEUBLE_TABLE_BUCHERON, resultatQte: 1, xp: 0,
    description: '+3% quantité Bûcheron une fois posée.',
    descriptionEn: '+3% Lumberjack quantity when placed.',
  },
  {
    kind: 'inventaire', id: 'meule_paysan', emoji: '🌾',
    nom: 'Meule du Paysan', nomEn: "Farmer's Millstone",
    ingredients: [
      { resourceId: ResourceId.BLE,    quantite: 100 },
      { resourceId: ResourceId.SEIGLE, quantite: 60  },
      { resourceId: ResourceId.PIERRE, quantite: 50  },
    ],
    resultatId: ResourceId.MEUBLE_MEULE_PAYSAN, resultatQte: 1, xp: 0,
    description: '+3% quantité Paysan une fois posée.',
    descriptionEn: '+3% Farmer quantity when placed.',
  },
  {
    kind: 'inventaire', id: 'vivier_pecheur', emoji: '🐟',
    nom: 'Vivier du Pêcheur', nomEn: "Fisher's Pond",
    ingredients: [
      { resourceId: ResourceId.BAMBOU,          quantite: 80 },
      { resourceId: ResourceId.PIERRE,          quantite: 60 },
      { resourceId: ResourceId.CARPE_JAPONAISE, quantite: 30 },
    ],
    resultatId: ResourceId.MEUBLE_VIVIER_PECHEUR, resultatQte: 1, xp: 0,
    description: '+3% quantité Pêcheur une fois posée.',
    descriptionEn: '+3% Fisher quantity when placed.',
  },
  {
    kind: 'inventaire', id: 'enclume_mineur', emoji: '⛏️',
    nom: 'Enclume du Mineur', nomEn: "Miner's Anvil",
    ingredients: [
      { resourceId: ResourceId.FER,    quantite: 100 },
      { resourceId: ResourceId.CUIVRE, quantite: 60  },
      { resourceId: ResourceId.JADE,   quantite: 20  },
    ],
    resultatId: ResourceId.MEUBLE_ENCLUME_MINEUR, resultatQte: 1, xp: 0,
    description: '+3% quantité Mineur une fois posée.',
    descriptionEn: '+3% Miner quantity when placed.',
  },
  {
    kind: 'inventaire', id: 'alambic_alchi', emoji: '🌺',
    nom: 'Alambic Alchimiste', nomEn: "Alchemist's Alembic",
    ingredients: [
      { resourceId: ResourceId.CHRYSANTHEME, quantite: 80 },
      { resourceId: ResourceId.WISTERIA,     quantite: 60 },
      { resourceId: ResourceId.JADE,         quantite: 30 },
    ],
    resultatId: ResourceId.MEUBLE_ALAMBIC_ALCHI, resultatQte: 1, xp: 0,
    description: '+3% quantité Alchimiste une fois posée.',
    descriptionEn: '+3% Alchemist quantity when placed.',
  },
  {
    kind: 'inventaire', id: 'bassin_koi', emoji: '🐠',
    nom: 'Bassin à Koï', nomEn: 'Koi Basin',
    ingredients: [
      { resourceId: ResourceId.JADE,          quantite: 40 },
      { resourceId: ResourceId.CERISIER_DORE, quantite: 30 },
      { resourceId: ResourceId.DIAMANT,       quantite: 10 },
    ],
    resultatId: ResourceId.MEUBLE_BASSIN_KOI, resultatQte: 1, xp: 0,
    description: '+1 Eau par jour (Puits) une fois posée.',
    descriptionEn: '+1 Water per day (Well) when placed.',
  },
  {
    kind: 'inventaire', id: 'abreuvoir_sakura', emoji: '🍶',
    nom: 'Abreuvoir Sakura', nomEn: 'Sakura Trough',
    ingredients: [
      { resourceId: ResourceId.FER,    quantite: 60 },
      { resourceId: ResourceId.SEIGLE, quantite: 40 },
      { resourceId: ResourceId.LAIT,   quantite: 20 },
    ],
    resultatId: ResourceId.MEUBLE_ABREUVOIR, resultatQte: 1, xp: 0,
    description: '-10% temps recharge animaux une fois posée.',
    descriptionEn: '-10% animal cooldown when placed.',
  },
];

// ============================================================
// Recettes Alchimiste craft
// ============================================================

const RECETTES_ALCHIMISTE: RecetteInventaire[] = [
  {
    kind: 'inventaire',
    id: 'potion_vitalite',
    emoji: '🧪',
    nom: 'Potion de Vitalité',
    nomEn: 'Vitality Potion',
    ingredients: [
      { resourceId: ResourceId.PISSENLIT, quantite: 3 },
      { resourceId: ResourceId.ORTIE,     quantite: 2 },
      { resourceId: ResourceId.EAU,       quantite: 2 },
    ],
    resultatId: ResourceId.POTION_VITALITE,
    resultatQte: 1,
    xp: 25,
    description: 'Restaure l\'énergie après une longue récolte.',
    descriptionEn: 'Restores energy after a long harvest.',
  },
  {
    kind: 'inventaire',
    id: 'onguent_sakura',
    emoji: '💆',
    nom: 'Onguent Sakura',
    nomEn: 'Sakura Salve',
    ingredients: [
      { resourceId: ResourceId.PIVOINE,      quantite: 2 },
      { resourceId: ResourceId.MIEL_ANIMAL,  quantite: 1 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 1 },
    ],
    resultatId: ResourceId.ONGUENT_SAKURA,
    resultatQte: 1,
    xp: 40,
    description: 'Baume apaisant aux propriétés régénératrices.',
    descriptionEn: 'Soothing balm with regenerative properties.',
  },
  {
    kind: 'inventaire',
    id: 'elixir_recolte',
    emoji: '⚗️',
    nom: 'Élixir de Récolte',
    nomEn: 'Harvest Elixir',
    ingredients: [
      { resourceId: ResourceId.GINSENG,       quantite: 2 },
      { resourceId: ResourceId.LAVANDE,       quantite: 2 },
      { resourceId: ResourceId.CUIVRE,        quantite: 1 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 2 },
    ],
    resultatId: ResourceId.ELIXIR_RECOLTE,
    resultatQte: 1,
    xp: 70,
    description: 'Élixir puissant : +50% quantité récoltée pendant 2h.',
    descriptionEn: 'Powerful elixir: +50% harvest quantity for 2h.',
  },
];

// ============================================================
// Recettes Tisserand
// ============================================================

const RECETTES_TISSERAND: RecetteInventaire[] = [
  {
    kind: 'inventaire',
    id: 'tissu_bambou',
    emoji: '🧵',
    nom: 'Tissu Bambou',
    nomEn: 'Bamboo Cloth',
    ingredients: [
      { resourceId: ResourceId.BAMBOU,   quantite: 6 },
      { resourceId: ResourceId.PIERRE,   quantite: 2 },
    ],
    resultatId: ResourceId.TISSU_BAMBOU,
    resultatQte: 1,
    xp: 30,
    description: 'Tissu léger tressé de fibres de bambou et de pierre polie.',
    descriptionEn: 'Light cloth woven from bamboo fibers and polished stone.',
  },
  {
    kind: 'inventaire',
    id: 'soie_sakura',
    emoji: '🪡',
    nom: 'Soie Sakura',
    nomEn: 'Sakura Silk',
    ingredients: [
      { resourceId: ResourceId.SAKURA,   quantite: 4 },
      { resourceId: ResourceId.GINSENG,  quantite: 2 },
    ],
    resultatId: ResourceId.SOIE_SAKURA,
    resultatQte: 1,
    xp: 60,
    description: 'Soie délicate extraite des pétales de sakura et du ginseng.',
    descriptionEn: 'Delicate silk extracted from sakura petals and ginseng.',
  },
  {
    kind: 'inventaire',
    id: 'lin_alchimiste',
    emoji: '🌿',
    nom: 'Lin Alchimiste',
    nomEn: 'Alchemist Linen',
    ingredients: [
      { resourceId: ResourceId.LAVANDE,  quantite: 4 },
      { resourceId: ResourceId.ORTIE,    quantite: 3 },
      { resourceId: ResourceId.FER,      quantite: 1 },
    ],
    resultatId: ResourceId.LIN_ALCHIMISTE,
    resultatQte: 1,
    xp: 50,
    description: 'Lin imprégné d\'essences alchimiques résistant aux éléments.',
    descriptionEn: 'Linen impregnated with alchemical essences, resistant to elements.',
  },
  {
    kind: 'inventaire',
    id: 'kimono_bambou',
    emoji: '👘',
    nom: 'Kimono Bambou',
    nomEn: 'Bamboo Kimono',
    niveauRequis: 5,
    ingredients: [
      { resourceId: ResourceId.TISSU_BAMBOU,  quantite: 3 },
      { resourceId: ResourceId.CHARBON,       quantite: 2 },
    ],
    resultatId: ResourceId.KIMONO_BAMBOU,
    resultatQte: 1,
    xp: 120,
    description: 'Kimono traditionnel en tissu de bambou. Bonus : +10% XP récolte.',
    descriptionEn: 'Traditional bamboo cloth kimono. Bonus: +10% harvest XP.',
  },
  {
    kind: 'inventaire',
    id: 'haori_sakura',
    emoji: '🥋',
    nom: 'Haori Sakura',
    nomEn: 'Sakura Haori',
    niveauRequis: 15,
    ingredients: [
      { resourceId: ResourceId.SOIE_SAKURA,   quantite: 3 },
      { resourceId: ResourceId.JADE,          quantite: 1 },
    ],
    resultatId: ResourceId.HAORI_SAKURA,
    resultatQte: 1,
    xp: 200,
    description: 'Veste courte en soie sakura et jade. Bonus : -15% temps de récolte.',
    descriptionEn: 'Short jacket in sakura silk and jade. Bonus: -15% harvest time.',
  },
  {
    kind: 'inventaire',
    id: 'hakama_lin',
    emoji: '👖',
    nom: 'Hakama Lin',
    nomEn: 'Linen Hakama',
    niveauRequis: 10,
    ingredients: [
      { resourceId: ResourceId.LIN_ALCHIMISTE, quantite: 3 },
      { resourceId: ResourceId.CUIVRE,         quantite: 2 },
    ],
    resultatId: ResourceId.HAKAMA_LIN,
    resultatQte: 1,
    xp: 150,
    description: 'Pantalon large en lin alchimiste. Bonus : -8% temps de récolte.',
    descriptionEn: 'Wide linen alchemist pants. Bonus: -8% harvest time.',
  },
  {
    kind: 'inventaire',
    id: 'kasa_tisse',
    emoji: '🎩',
    nom: 'Kasa Tissé',
    nomEn: 'Woven Kasa',
    niveauRequis: 20,
    ingredients: [
      { resourceId: ResourceId.TISSU_BAMBOU,  quantite: 2 },
      { resourceId: ResourceId.SOIE_SAKURA,   quantite: 1 },
      { resourceId: ResourceId.TOPAZE,        quantite: 1 },
    ],
    resultatId: ResourceId.KASA_TISSE,
    resultatQte: 1,
    xp: 180,
    description: 'Chapeau tissé en bambou et soie. Bonus : +12% XP récolte.',
    descriptionEn: 'Hat woven in bamboo and silk. Bonus: +12% harvest XP.',
  },
  {
    kind: 'inventaire',
    id: 'obi_forge',
    emoji: '🎀',
    nom: 'Obi Forgé',
    nomEn: 'Forged Obi',
    niveauRequis: 30,
    ingredients: [
      { resourceId: ResourceId.SOIE_SAKURA,    quantite: 2 },
      { resourceId: ResourceId.LIN_ALCHIMISTE, quantite: 2 },
      { resourceId: ResourceId.DIAMANT,        quantite: 1 },
    ],
    resultatId: ResourceId.OBI_FORGE,
    resultatQte: 1,
    xp: 350,
    description: 'Ceinture de luxe forgée à la soie et au lin. Bonus : +2 slots.',
    descriptionEn: 'Luxury belt forged with silk and linen. Bonus: +2 slots.',
  },
];

// ============================================================
// Recettes Forgeron
// ============================================================

const RECETTES_FORGERON: RecetteInventaire[] = [
  {
    kind: 'inventaire',
    id: 'enclume_portable',
    emoji: '⚒️',
    nom: 'Enclume Portable',
    nomEn: 'Portable Anvil',
    ingredients: [
      { resourceId: ResourceId.FER,     quantite: 5 },
      { resourceId: ResourceId.JADE,    quantite: 2 },
      { resourceId: ResourceId.PIERRE,  quantite: 4 },
    ],
    resultatId: ResourceId.ENCLUME_PORTABLE,
    resultatQte: 1,
    xp: 80,
    description: 'Répare un outil de votre choix (+30 charges) en le "Utilisant".',
    descriptionEn: 'Repairs a tool of your choice (+30 charges) by "Using" it.',
  },
  {
    kind: 'inventaire',
    id: 'parchemin_forge',
    emoji: '📜',
    nom: 'Parchemin de Forge',
    nomEn: 'Forge Scroll',
    ingredients: [
      { resourceId: ResourceId.SAKURA,          quantite: 2 },
      { resourceId: ResourceId.CRISTAL_KOI,     quantite: 1 },
      { resourceId: ResourceId.HERBE_KOI,       quantite: 2 },
      { resourceId: ResourceId.FLEUR_LOTUS_SAKURA, quantite: 1 },
    ],
    resultatId: ResourceId.PARCHEMIN_FORGE,
    resultatQte: 1,
    xp: 150,
    description: 'Requis pour forger les outils Niv. 8-10 (1-2-3 parchemins).',
    descriptionEn: 'Required to forge tools Lv. 8-10 (1-2-3 scrolls).',
  },
];

// ============================================================
// Composant principal
// ============================================================

type View = 'categories' | 'cuisine' | 'artisan' | 'alchimiste' | 'tisserand' | 'forgeron';

export function CraftPage() {
  const navigate    = useNavigate();
  const { t, lang } = useT();
  const [view, setView] = useState<View>('categories');
  const [notification, setNotification] = useState<string | null>(null);
  const [onguentPopup, setOnguentPopup] = useState(false);
  const [enclumePopup, setEnclumePopup] = useState(false);

  const inventaire              = useGameStore(s => s.inventaire);
  const personageNiveau         = useGameStore(s => s.personageNiveau);
  const personageXp             = useGameStore(s => s.personageXp);
  const personageXpTotal        = useGameStore(s => s.personageXpTotal);
  const parcheminsLv100LastDate = useGameStore(s => s.parcheminsLv100LastDate);
  const outils                  = useGameStore(s => s.outils) ?? {};
  const activeBuffs             = useGameStore(s => s.activeBuffs) ?? [];
  const retirerRessource        = useGameStore(s => s.retirerRessource);
  const ajouterRessource        = useGameStore(s => s.ajouterRessource);
  const ajouterXpPersonage      = useGameStore(s => s.ajouterXpPersonage);
  const setOutil                = useGameStore(s => s.setOutil);
  const collectParcheminsLv100  = useGameStore(s => s.collectParcheminsLv100);
  const addBuff                 = useGameStore(s => s.addBuff);
  const repairerOutil           = useGameStore(s => s.repairerOutil);

  const TOOL_ORDER: ToolType[] = ['hache', 'faucille', 'canne', 'pioche', 'mortier'];

  function canCraftRecette(recette: Recette): boolean {
    return recette.ingredients.every(ing => (inventaire[ing.resourceId] ?? 0) >= ing.quantite);
  }

  function craftCuisine(recette: RecetteInventaire) {
    if (!canCraftRecette(recette)) return;
    if (recette.niveauRequis && personageNiveau < recette.niveauRequis) return;
    for (const ing of recette.ingredients) retirerRessource(ing.resourceId, ing.quantite);
    ajouterRessource(recette.resultatId, recette.resultatQte);
    ajouterXpPersonage(recette.xp);
    notify(`✅ ${lang === 'en' ? recette.nomEn : recette.nom} — +${recette.xp} XP personnage`);
  }

  function craftArtisan(recette: Recette) {
    if (!canCraftRecette(recette)) return;
    for (const ing of recette.ingredients) retirerRessource(ing.resourceId, ing.quantite);
    ajouterRessource(recette.resultatId, recette.resultatQte);
    notify(`✅ ${lang === 'en' ? recette.nomEn : recette.nom}`);
  }

  function craftOutilNiveau(toolType: ToolType, niveau: number) {
    const recipe = getUpgradeRecipe(toolType, niveau);
    const canCraft = recipe.every(ing => (inventaire[ing.resourceId as ResourceId] ?? 0) >= ing.quantite);
    if (!canCraft) return;
    for (const ing of recipe) retirerRessource(ing.resourceId as ResourceId, ing.quantite);
    setOutil(toolType, niveau, DURABILITE_MAX);
    const info = OUTIL_INFO[toolType];
    notify(`✅ ${info.emoji} ${info.nom} Niv.${niveau} — ${DURABILITE_MAX} charges`);
  }

  function craftAlchimiste(recette: RecetteInventaire) {
    if (!canCraftRecette(recette)) return;
    for (const ing of recette.ingredients) retirerRessource(ing.resourceId, ing.quantite);
    ajouterRessource(recette.resultatId, recette.resultatQte);
    notify(`✅ ${lang === 'en' ? recette.nomEn : recette.nom}`);
  }

  function craftTisserand(recette: RecetteInventaire) {
    if (!canCraftRecette(recette)) return;
    for (const ing of recette.ingredients) retirerRessource(ing.resourceId, ing.quantite);
    ajouterRessource(recette.resultatId, recette.resultatQte);
    notify(`✅ ${lang === 'en' ? recette.nomEn : recette.nom}`);
  }

  function craftForgeron(recette: RecetteInventaire) {
    if (!canCraftRecette(recette)) return;
    for (const ing of recette.ingredients) retirerRessource(ing.resourceId, ing.quantite);
    ajouterRessource(recette.resultatId, recette.resultatQte);
    notify(`✅ ${lang === 'en' ? recette.nomEn : recette.nom}`);
  }

  function utiliserPotion(resourceId: ResourceId) {
    const qty = inventaire[resourceId] ?? 0;
    if (qty < 1) return;
    retirerRessource(resourceId, 1);
    if (resourceId === ResourceId.POTION_VITALITE) {
      addBuff('qty_harvest', 25, 60 * 60 * 1000, resourceId); // +25% qty 1h
      notify(lang === 'en' ? '✨ +25% harvest qty for 1 hour!' : '✨ +25% quantité récolte pendant 1h !');
    } else if (resourceId === ResourceId.ELIXIR_RECOLTE) {
      addBuff('qty_harvest', 50, 2 * 60 * 60 * 1000, resourceId); // +50% qty 2h
      notify(lang === 'en' ? '✨ +50% harvest qty for 2 hours!' : '✨ +50% quantité récolte pendant 2h !');
    } else if (resourceId === ResourceId.ONGUENT_SAKURA) {
      setOnguentPopup(true); // outil déjà retiré, géré dans le popup
    }
  }

  function utiliserEnclume(toolType: ToolType) {
    repairerOutil(toolType, 30);
    setEnclumePopup(false);
    notify(lang === 'en' ? `⚒️ Tool repaired +30 charges!` : `⚒️ Outil réparé +30 charges !`);
  }

  function notify(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }

  const xpReqPersonage = personageNiveau >= 100 ? xpRequisPersonage(99) : xpRequisPersonage(personageNiveau);
  const pctPersonage = personageNiveau >= 100 ? 100 : Math.min(100, (personageXp / xpReqPersonage) * 100);

  const viewTitle =
    view === 'cuisine'    ? '🍳 Cuisine' :
    view === 'artisan'    ? '🔨 Artisan' :
    view === 'alchimiste' ? '⚗️ Alchimiste' :
    view === 'tisserand'  ? '🧵 Tisserand' :
    view === 'forgeron'   ? '⚒️ Forgeron' :
    t('craft.title');

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => view === 'categories' ? navigate('/home') : setView('categories')}>
          {view === 'categories' ? t('craft.back_home') : '← Recettes'}
        </button>
        <span style={s.headerTitle}>{viewTitle}</span>
        <div style={{ width: 80 }} />
      </div>

      {notification && (
        <div style={{ margin:'8px 16px 0', padding:'8px 14px', background:'rgba(106,191,68,0.12)', border:'1px solid rgba(106,191,68,0.35)', borderRadius:10, color:'#2a7a10', fontSize:12, fontWeight:700, textAlign:'center' }}>
          {notification}
        </div>
      )}

      <div style={s.body}>
        {/* ── Vue catégories ── */}
        {view === 'categories' && (
          <>
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'0 0 10px', letterSpacing:'0.05em' }}>MÉTIERS DE CRAFT</p>

            {/* Cuisine */}
            <button style={s.categoryCard} onClick={() => setView('cuisine')}>
              <div style={{ ...s.categoryGlow, background:'radial-gradient(ellipse at top left,rgba(196,48,112,0.12),transparent 70%)' }} />
              <span style={{ fontSize:36 }}>🍳</span>
              <span style={{ color:'#c43070', fontSize:15, fontWeight:800, marginTop:6 }}>Cuisine</span>
              <span style={{ color:'#c43070', fontSize:11, marginTop:6, fontWeight:700 }}>{RECETTES_CUISINE.length} recettes →</span>
            </button>

            {/* Artisan */}
            <button style={{ ...s.categoryCard, borderColor:'rgba(100,140,60,0.2)' }} onClick={() => setView('artisan')}>
              <div style={{ ...s.categoryGlow, background:'radial-gradient(ellipse at top left,rgba(100,140,60,0.1),transparent 70%)' }} />
              <span style={{ fontSize:36 }}>🔨</span>
              <span style={{ color:'#4a7a20', fontSize:15, fontWeight:800, marginTop:6 }}>Artisan</span>
              <span style={{ color:'#4a7a20', fontSize:11, marginTop:6, fontWeight:700 }}>{RECETTES_ARTISAN.length} recettes →</span>
            </button>

            {/* Alchimiste craft */}
            <button style={{ ...s.categoryCard, borderColor:'rgba(130,60,180,0.2)' }} onClick={() => setView('alchimiste')}>
              <div style={{ ...s.categoryGlow, background:'radial-gradient(ellipse at top left,rgba(130,60,180,0.1),transparent 70%)' }} />
              <span style={{ fontSize:36 }}>⚗️</span>
              <span style={{ color:'#7030b0', fontSize:15, fontWeight:800, marginTop:6 }}>Alchimiste</span>
              <span style={{ color:'#7030b0', fontSize:11, marginTop:6, fontWeight:700 }}>{RECETTES_ALCHIMISTE.length} recettes →</span>
            </button>

            {/* Tisserand */}
            <button style={{ ...s.categoryCard, borderColor:'rgba(29,140,200,0.2)' }} onClick={() => setView('tisserand')}>
              <div style={{ ...s.categoryGlow, background:'radial-gradient(ellipse at top left,rgba(29,140,200,0.1),transparent 70%)' }} />
              <span style={{ fontSize:36 }}>🧵</span>
              <span style={{ color:'#1a7ab0', fontSize:15, fontWeight:800, marginTop:6 }}>Tisserand</span>
              <span style={{ color:'#1a7ab0', fontSize:11, marginTop:6, fontWeight:700 }}>{RECETTES_TISSERAND.length} recettes →</span>
            </button>

            {/* Forgeron */}
            <button style={{ ...s.categoryCard, borderColor:'rgba(180,100,30,0.2)' }} onClick={() => setView('forgeron')}>
              <div style={{ ...s.categoryGlow, background:'radial-gradient(ellipse at top left,rgba(180,100,30,0.1),transparent 70%)' }} />
              <span style={{ fontSize:36 }}>⚒️</span>
              <span style={{ color:'#9a5a10', fontSize:15, fontWeight:800, marginTop:6 }}>Forgeron</span>
              <span style={{ color:'#9a5a10', fontSize:11, marginTop:6, fontWeight:700 }}>{RECETTES_FORGERON.length} recettes →</span>
            </button>
          </>
        )}

        {/* ── Vue Cuisine ── */}
        {view === 'cuisine' && (
          <>
            {/* Barre XP personnage */}
            <XpBar label={`👤 Personnage — Niv. ${personageNiveau}`} xp={personageXp} xpReq={xpReqPersonage} xpTotal={personageXpTotal} pct={pctPersonage} color="#c43070" />


            {/* Bonus Lv100 : 1 Parchemin des Anciens par jour */}
            {personageNiveau >= 100 && (() => {
              const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
              const alreadyCollected = parcheminsLv100LastDate === today;
              return (
                <div style={{ margin:'8px 0', padding:'10px 14px', background: alreadyCollected ? 'rgba(196,48,112,0.06)' : 'rgba(212,170,50,0.1)', border:`1px solid ${alreadyCollected ? 'rgba(196,48,112,0.2)' : 'rgba(212,170,50,0.4)'}`, borderRadius:12, display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:22 }}>📜</span>
                  <div style={{ flex:1 }}>
                    <p style={{ color: alreadyCollected ? '#7a4060' : '#f9a825', fontSize:12, fontWeight:700, margin:0 }}>
                      {lang === 'en' ? 'Lv.100 Bonus — 1 Ancient Parchment/day' : 'Bonus Niv.100 — 1 Parchemin des Anciens/jour'}
                    </p>
                    {alreadyCollected && <p style={{ color:'#7a4060', fontSize:10, margin:'2px 0 0' }}>{lang === 'en' ? 'Already collected today' : 'Déjà collecté aujourd\'hui'}</p>}
                  </div>
                  <button
                    disabled={alreadyCollected}
                    onClick={() => {
                      const ok = collectParcheminsLv100();
                      if (ok) setNotification(lang === 'en' ? '+1 Ancient Parchment!' : '+1 Parchemin des Anciens !');
                    }}
                    style={{ padding:'6px 14px', borderRadius:10, fontSize:11, fontWeight:700, cursor: alreadyCollected ? 'default' : 'pointer', border:'none', background: alreadyCollected ? 'rgba(196,48,112,0.1)' : 'linear-gradient(135deg,#c43070,#f9a825)', color: alreadyCollected ? '#7a4060' : '#fff' }}
                  >
                    {alreadyCollected ? (lang === 'en' ? 'Collected' : 'Collecté') : (lang === 'en' ? 'Collect' : 'Collecter')}
                  </button>
                </div>
              );
            })()}

            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'10px 0 8px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'CUISINE RECIPES' : 'RECETTES DE CUISINE'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {RECETTES_CUISINE.map(r => {
                const locked = !!(r.niveauRequis && personageNiveau < r.niveauRequis);
                return (
                  <div key={r.id} style={{ opacity: locked ? 0.5 : 1, position: 'relative' }}>
                    {locked && (
                      <div style={{ position:'absolute', top:8, right:10, background:'rgba(100,60,30,0.85)', borderRadius:8, padding:'2px 8px', fontSize:10, fontWeight:800, color:'#f9a825', zIndex:1 }}>
                        🔒 Lv. {r.niveauRequis} requis
                      </div>
                    )}
                    <RecetteCard
                      recette={r}
                      inventaire={inventaire}
                      lang={lang}
                      onCraft={() => craftCuisine(r)}
                      btnLabel={locked ? '🔒 Verrouillé' : (lang === 'en' ? '🍳 Cook' : '🍳 Cuisiner')}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Vue Artisan ── */}
        {view === 'artisan' && (
          <>

            {/* Outils — une carte par outil, montre uniquement le prochain niveau à forger */}
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'10px 0 4px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'TOOLS (next upgrade per profession)' : 'OUTILS (prochain niveau par métier)'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
              {TOOL_ORDER.map(toolType => {
                const info        = OUTIL_INFO[toolType];
                const current     = outils[toolType];
                const curNiveau   = current ? current.niveau : 0;
                const nextNiveau  = curNiveau < 10 ? Math.max(2, curNiveau + 1) : null;
                const recipe      = nextNiveau ? getUpgradeRecipe(toolType, nextNiveau) : null;
                const canForge    = recipe ? recipe.every(ing => (inventaire[ing.resourceId as ResourceId] ?? 0) >= ing.quantite) : false;
                const xp          = nextNiveau ? getOutilXp(nextNiveau) : 0;

                return (
                  <div key={toolType} style={{ background:'#fff', border:`1.5px solid ${canForge ? 'rgba(106,191,68,0.4)' : 'rgba(212,100,138,0.13)'}`, borderRadius:14, padding:12 }}>
                    {/* Titre + état actuel */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <span style={{ fontSize:28 }}>{info.emoji}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                          <span style={{ color:'#1e0a16', fontSize:14, fontWeight:800 }}>{info.nom}</span>
                          {current ? (
                            <span style={{ background: current.durabilite <= 10 ? 'rgba(229,57,53,0.12)' : 'rgba(106,191,68,0.1)', color: current.durabilite <= 10 ? '#e53935' : '#4a8f2a', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:8 }}>
                              Niv.{current.niveau} — {current.durabilite}/{DURABILITE_MAX} charges
                            </span>
                          ) : (
                            <span style={{ background:'rgba(196,48,112,0.1)', color:'#c43070', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:8 }}>
                              {lang === 'en' ? 'Not crafted' : 'Non forgé'}
                            </span>
                          )}
                          {nextNiveau === null && (
                            <span style={{ background:'rgba(212,170,50,0.15)', color:'#b07010', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:8 }}>
                              MAX
                            </span>
                          )}
                        </div>
                        {nextNiveau && <span style={{ color:'#7a4060', fontSize:10 }}>{lang === 'en' ? `Forge to Lv.${nextNiveau}` : `Forger jusqu'au Niv.${nextNiveau}`} · +{xp} XP</span>}
                      </div>
                    </div>

                    {recipe && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                        {recipe.map(ing => {
                          const have = inventaire[ing.resourceId as ResourceId] ?? 0;
                          const ok   = have >= ing.quantite;
                          return (
                            <div key={ing.resourceId} style={{ display:'flex', flexDirection:'column', alignItems:'center', background: ok ? 'rgba(106,191,68,0.08)' : 'rgba(196,48,112,0.06)', border:`1px solid ${ok ? 'rgba(106,191,68,0.3)' : 'rgba(212,100,138,0.2)'}`, borderRadius:10, padding:'5px 8px', minWidth:50, textAlign:'center' }}>
                              <span style={{ fontSize:16 }}>{emojiByResourceId(ing.resourceId)}</span>
                              <span style={{ color:'#5a3050', fontSize:8, fontWeight:600, lineHeight:1.2, marginTop:1, maxWidth:60, wordBreak:'break-word' }}>{getNomRessource(ing.resourceId, lang)}</span>
                              <span style={{ color: ok ? '#2a7a10' : '#c43070', fontSize:9, fontWeight:700 }}>×{ing.quantite}</span>
                              <span style={{ color:'#9a6080', fontSize:8 }}>({Math.floor(have)})</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {nextNiveau ? (
                      <button
                        style={{ width:'100%', padding:'9px', background: canForge ? 'linear-gradient(135deg,#6abf44,#3a7a10)' : 'rgba(106,191,68,0.08)', border: canForge ? 'none' : '1px solid rgba(106,191,68,0.2)', borderRadius:10, color: canForge ? '#fff' : '#9a6080', fontSize:12, fontWeight:700, cursor: canForge ? 'pointer' : 'default', opacity: canForge ? 1 : 0.6 }}
                        disabled={!canForge}
                        onClick={() => craftOutilNiveau(toolType, nextNiveau)}
                      >
                        {canForge ? `🔨 ${lang === 'en' ? 'Forge' : 'Forger'} Niv.${nextNiveau}` : (lang === 'en' ? 'Missing ingredients' : 'Ingrédients insuffisants')}
                      </button>
                    ) : (
                      <div style={{ textAlign:'center', color:'#b07010', fontSize:11, fontWeight:700, padding:'8px' }}>
                        {lang === 'en' ? '✨ Maximum level reached' : '✨ Niveau maximum atteint'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'0 0 4px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'FURNITURE' : 'MOBILIER'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {RECETTES_ARTISAN.map(r => (
                <RecetteCard
                  key={r.id}
                  recette={r}
                  inventaire={inventaire}
                  lang={lang}
                  onCraft={() => craftArtisan(r)}
                  btnLabel={lang === 'en' ? '🔨 Craft' : '🔨 Fabriquer'}
                />
              ))}
            </div>

            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'14px 0 4px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'PLACEABLE FURNITURE (bonus when placed)' : 'MEUBLES PLAÇABLES (bonus quand posés)'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {RECETTES_MEUBLES.map(r => (
                <RecetteCard
                  key={r.id}
                  recette={r}
                  inventaire={inventaire}
                  lang={lang}
                  onCraft={() => craftArtisan(r)}
                  btnLabel={lang === 'en' ? '🔨 Craft' : '🔨 Fabriquer'}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Vue Alchimiste ── */}
        {view === 'alchimiste' && (
          <>

            {/* Buffs actifs */}
            {activeBuffs.filter(b => b.expiresAt > Date.now()).length > 0 && (
              <div style={{ margin:'8px 0', padding:'8px 12px', background:'rgba(171,71,188,0.08)', border:'1px solid rgba(171,71,188,0.3)', borderRadius:10 }}>
                <p style={{ color:'#7030b0', fontSize:10, fontWeight:800, margin:'0 0 4px' }}>BUFFS ACTIFS</p>
                {activeBuffs.filter(b => b.expiresAt > Date.now()).map(b => {
                  const remaining = Math.ceil((b.expiresAt - Date.now()) / 60000);
                  return (
                    <div key={b.type} style={{ display:'flex', gap:6, alignItems:'center', fontSize:11, color:'#7030b0', fontWeight:600 }}>
                      <span>📦</span>
                      <span>+{b.bonusPercent}% Quantité récolte</span>
                      <span style={{ marginLeft:'auto', fontFamily:'monospace', fontSize:10 }}>{remaining}min</span>
                    </div>
                  );
                })}
              </div>
            )}

            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'10px 0 8px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'POTIONS & ELIXIRS' : 'POTIONS & ÉLIXIRS'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {RECETTES_ALCHIMISTE.map(r => {
                const stockPotion = Math.floor(inventaire[r.resultatId] ?? 0);
                const canUse = stockPotion >= 1;
                const isOnguent = r.resultatId === ResourceId.ONGUENT_SAKURA;
                return (
                  <div key={r.id}>
                    <RecetteCard
                      recette={r}
                      inventaire={inventaire}
                      lang={lang}
                      onCraft={() => craftAlchimiste(r)}
                      btnLabel={lang === 'en' ? '⚗️ Brew' : '⚗️ Préparer'}
                    />
                    {/* Bouton Utiliser */}
                    <button
                      style={{ marginTop:4, width:'100%', padding:'7px', background: canUse ? 'linear-gradient(135deg,#ab47bc,#7030b0)' : 'rgba(171,71,188,0.06)', border: canUse ? 'none' : '1px solid rgba(171,71,188,0.2)', borderRadius:8, color: canUse ? '#fff' : '#9a6080', fontSize:11, fontWeight:700, cursor: canUse ? 'pointer' : 'default', opacity: canUse ? 1 : 0.5 }}
                      disabled={!canUse}
                      onClick={() => {
                        if (!canUse) return;
                        if (isOnguent) { setOnguentPopup(true); }
                        else utiliserPotion(r.resultatId);
                      }}
                    >
                      {canUse
                        ? `✨ ${lang === 'en' ? 'Use' : 'Utiliser'} (×${stockPotion})`
                        : lang === 'en' ? 'None in inventory' : 'Aucune en inventaire'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Vue Tisserand ── */}
        {view === 'tisserand' && (
          <>
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'10px 0 8px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'WEAVING RECIPES' : 'RECETTES DE TISSAGE'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {RECETTES_TISSERAND.map(r => (
                <RecetteCard
                  key={r.id}
                  recette={r}
                  inventaire={inventaire}
                  lang={lang}
                  onCraft={() => craftTisserand(r)}
                  btnLabel={lang === 'en' ? '🧵 Weave' : '🧵 Tisser'}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Vue Forgeron ── */}
        {view === 'forgeron' && (
          <>
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'10px 0 8px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'BLACKSMITHING RECIPES' : 'RECETTES DE FORGE'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {RECETTES_FORGERON.map(r => {
                const stockItem = Math.floor(inventaire[r.resultatId] ?? 0);
                const isEnclume = r.resultatId === ResourceId.ENCLUME_PORTABLE;
                const canUse = stockItem >= 1;
                return (
                  <div key={r.id}>
                    <RecetteCard
                      recette={r}
                      inventaire={inventaire}
                      lang={lang}
                      onCraft={() => craftForgeron(r)}
                      btnLabel={lang === 'en' ? '⚒️ Smith' : '⚒️ Forger'}
                    />
                    {isEnclume && (
                      <button
                        style={{ marginTop:4, width:'100%', padding:'7px', background: canUse ? 'linear-gradient(135deg,#ff9800,#9a5a10)' : 'rgba(255,152,0,0.06)', border: canUse ? 'none' : '1px solid rgba(255,152,0,0.2)', borderRadius:8, color: canUse ? '#fff' : '#9a6080', fontSize:11, fontWeight:700, cursor: canUse ? 'pointer' : 'default', opacity: canUse ? 1 : 0.5 }}
                        disabled={!canUse}
                        onClick={() => { if (canUse) setEnclumePopup(true); }}
                      >
                        {canUse
                          ? `⚒️ ${lang === 'en' ? 'Repair a tool' : 'Réparer un outil'} (×${stockItem})`
                          : lang === 'en' ? 'None in inventory' : 'Aucune en inventaire'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Popup Onguent (sélection outil à réparer manuellement) ── */}
        {onguentPopup && (
          <ToolPickerPopup
            outils={outils}
            title={lang === 'en' ? 'Onguent Sakura — Repair tool' : 'Onguent Sakura — Réparer un outil'}
            subtitle={lang === 'en' ? 'Choose the tool to restore +30 charges' : 'Choisissez l\'outil à restaurer +30 charges'}
            onPick={(type) => { repairerOutil(type, 30); setOnguentPopup(false); notify(lang === 'en' ? `💆 ${OUTIL_INFO[type].nom} repaired +30 charges!` : `💆 ${OUTIL_INFO[type].nom} réparé +30 charges !`); }}
            onClose={() => { ajouterRessource(ResourceId.ONGUENT_SAKURA, 1); setOnguentPopup(false); }}
          />
        )}

        {/* ── Popup Enclume (sélection outil à réparer) ── */}
        {enclumePopup && (
          <ToolPickerPopup
            outils={outils}
            title={lang === 'en' ? 'Portable Anvil — Repair tool' : 'Enclume Portable — Réparer un outil'}
            subtitle={lang === 'en' ? 'Choose the tool to restore +30 charges' : 'Choisissez l\'outil à restaurer +30 charges'}
            onPick={(type) => { retirerRessource(ResourceId.ENCLUME_PORTABLE, 1); utiliserEnclume(type); }}
            onClose={() => setEnclumePopup(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── Popup sélection outil ───────────────────────────────────

function ToolPickerPopup({ outils, title, subtitle, onPick, onClose }: {
  outils: Partial<Record<ToolType, { niveau: number; durabilite: number }>>;
  title: string;
  subtitle: string;
  onPick: (type: ToolType) => void;
  onClose: () => void;
}) {
  const toolTypes = Object.values(METIER_TOOL_TYPE) as ToolType[];
  const unique = [...new Set(toolTypes)];
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fdf0f5', borderRadius:'16px 16px 0 0', padding:'16px', width:'100%', maxWidth:480, paddingBottom:32 }} onClick={e => e.stopPropagation()}>
        <p style={{ color:'#1e0a16', fontSize:14, fontWeight:800, margin:'0 0 4px' }}>{title}</p>
        <p style={{ color:'#7a4060', fontSize:11, margin:'0 0 12px' }}>{subtitle}</p>
        {unique.map(type => {
          const info = OUTIL_INFO[type];
          const outil = outils[type];
          const hasTool = !!outil && outil.durabilite > 0;
          return (
            <button
              key={type}
              style={{ width:'100%', padding:'10px 14px', background: hasTool ? '#fff' : 'rgba(212,100,138,0.04)', border:`1px solid ${hasTool ? 'rgba(106,191,68,0.3)' : 'rgba(212,100,138,0.12)'}`, borderRadius:10, marginBottom:6, display:'flex', alignItems:'center', gap:10, cursor: hasTool ? 'pointer' : 'default', opacity: hasTool ? 1 : 0.4 }}
              disabled={!hasTool}
              onClick={() => { if (hasTool) onPick(type); }}
            >
              <span style={{ fontSize:22 }}>{info.emoji}</span>
              <div style={{ flex:1, textAlign:'left' }}>
                <span style={{ color:'#1e0a16', fontSize:13, fontWeight:700 }}>{info.nom}</span>
                {outil && <span style={{ display:'block', color:'#7a4060', fontSize:10 }}>Niv.{outil.niveau} — {outil.durabilite}/{DURABILITE_MAX} charges</span>}
                {!outil && <span style={{ display:'block', color:'#c43070', fontSize:10 }}>Non forgé</span>}
              </div>
            </button>
          );
        })}
        <button style={{ width:'100%', padding:'9px', background:'none', border:'1px solid rgba(212,100,138,0.2)', borderRadius:10, color:'#7a4060', fontSize:12, fontWeight:600, cursor:'pointer', marginTop:4 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  );
}

// ── Composant barre XP ──────────────────────────────────────

function XpBar({ label, xp, xpReq, xpTotal, pct, color }: {
  label: string; xp: number; xpReq: number; xpTotal: number; pct: number; color: string;
}) {
  return (
    <div style={{ padding:'10px 14px', background:'#fff', border:'1px solid rgba(212,100,138,0.15)', borderRadius:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ color:'#1e0a16', fontSize:12, fontWeight:800 }}>{label}</span>
        <span style={{ color:'#7a4060', fontSize:10 }}>{xpTotal} XP total</span>
      </div>
      <div style={{ height:6, background:'rgba(212,100,138,0.08)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${color},${color}bb)`, borderRadius:3, transition:'width 0.4s' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
        <span style={{ color:'#7a4060', fontSize:9 }}>{xp} / {xpReq} XP</span>
        <span style={{ color:'#7a4060', fontSize:9 }}>{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

// ── Composant carte de recette ──────────────────────────────

function RecetteCard({ recette, inventaire, lang, onCraft, btnLabel }: {
  recette: Recette;
  inventaire: Partial<Record<ResourceId, number>>;
  lang: 'fr' | 'en';
  onCraft: () => void;
  btnLabel: string;
}) {
  const craftable = recette.ingredients.every(ing => (inventaire[ing.resourceId] ?? 0) >= ing.quantite);
  const nom  = lang === 'en' ? recette.nomEn : recette.nom;
  const desc = lang === 'en' ? recette.descriptionEn : recette.description;

  return (
    <div style={{ ...s.recetteCard, borderColor: craftable ? 'rgba(196,48,112,0.35)' : 'rgba(212,100,138,0.13)' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <span style={{ fontSize:32, lineHeight:1 }}>{recette.emoji}</span>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2, flexWrap:'wrap' }}>
            <span style={{ color:'#1e0a16', fontSize:14, fontWeight:800 }}>{nom}</span>
            <span style={{ background:'rgba(196,48,112,0.1)', color:'#c43070', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:8 }}>
              +{recette.xp} XP
            </span>
          </div>
          <p style={{ color:'#7a4060', fontSize:10, margin:'0 0 6px', lineHeight:1.4 }}>{desc}</p>

          {/* Ingrédients */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
            {recette.ingredients.map(ing => {
              const have = inventaire[ing.resourceId] ?? 0;
              const ok   = have >= ing.quantite;
              return (
                <div key={ing.resourceId} style={{ display:'flex', flexDirection:'column', alignItems:'center', background: ok ? 'rgba(106,191,68,0.08)' : 'rgba(196,48,112,0.06)', border: `1px solid ${ok ? 'rgba(106,191,68,0.3)' : 'rgba(212,100,138,0.2)'}`, borderRadius:10, padding:'5px 8px', minWidth:50, textAlign:'center' }}>
                  <span style={{ fontSize:16 }}>{emojiByResourceId(ing.resourceId)}</span>
                  <span style={{ color:'#5a3050', fontSize:8, fontWeight:600, lineHeight:1.2, marginTop:1, maxWidth:60, wordBreak:'break-word' }}>{getNomRessource(ing.resourceId, lang)}</span>
                  <span style={{ color: ok ? '#2a7a10' : '#c43070', fontSize:9, fontWeight:700 }}>×{ing.quantite}</span>
                  <span style={{ color:'#9a6080', fontSize:8 }}>({Math.floor(have)})</span>
                </div>
              );
            })}
          </div>

          {/* Résultat */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ color:'#9a6080', fontSize:10 }}>→</span>
            <span style={{ fontSize:15 }}>{emojiByResourceId(recette.resultatId)}</span>
            <span style={{ color:'#1e0a16', fontSize:11, fontWeight:700 }}>
              {getNomRessource(recette.resultatId, lang)} ×{recette.resultatQte}
            </span>
          </div>
        </div>
      </div>
      <button
        style={{ marginTop:8, width:'100%', padding:'9px', background: craftable ? 'linear-gradient(135deg,#c43070,#8a25d4)' : 'rgba(212,100,138,0.08)', border: craftable ? 'none' : '1px solid rgba(212,100,138,0.2)', borderRadius:10, color: craftable ? '#fff' : '#9a6080', fontSize:12, fontWeight:700, cursor: craftable ? 'pointer' : 'default', opacity: craftable ? 1 : 0.6 }}
        disabled={!craftable}
        onClick={onCraft}
      >
        {craftable ? btnLabel : (lang === 'en' ? 'Missing ingredients' : 'Ingrédients insuffisants')}
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { position:'absolute', inset:0, background:'#fdf0f5', display:'flex', flexDirection:'column' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'rgba(253,240,245,0.96)', backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(212,100,138,0.15)', flexShrink:0 },
  backBtn: { color:'#7a4060', fontSize:'13px', fontWeight:600, background:'none', border:'none', cursor:'pointer' },
  headerTitle: { color:'#1e0a16', fontSize:'16px', fontWeight:800 },
  body: { flex:1, overflowY:'auto', padding:'14px 16px', paddingBottom:80 },
  categoryCard: {
    position:'relative', overflow:'hidden',
    background:'#fff', border:'1px solid rgba(212,100,138,0.2)',
    borderRadius:16, padding:'18px 16px',
    display:'flex', flexDirection:'column', alignItems:'center',
    cursor:'pointer', width:'100%', boxSizing:'border-box',
    marginBottom:10,
  },
  categoryGlow: { position:'absolute', inset:0, pointerEvents:'none' },
  recetteCard: {
    background:'#fff', border:'1.5px solid', borderRadius:14, padding:'12px',
  },
};
