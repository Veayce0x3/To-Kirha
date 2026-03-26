import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, xpRequis, xpRequisPersonage } from '../store/gameStore';
import { ResourceId } from '../data/resources';
import { useT } from '../utils/i18n';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';
import { ToolType, OUTIL_TIERS, getOutilTierInfo } from '../data/outils';

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

// Recette outil → va dans outils (pas l'inventaire)
interface RecetteOutil {
  kind: 'outil';
  id: string;
  emoji: string;
  nom: string;
  nomEn: string;
  ingredients: Ingredient[];
  toolType: ToolType;
  tierId: number;
  xp: number;
  description: string;
  descriptionEn: string;
}

type Recette = RecetteInventaire | RecetteOutil;

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
  // ── Outils T1 (sans Parchemin Ancien)
  {
    kind: 'outil',
    id: 'hache_t1',
    emoji: '🪓',
    nom: 'Hache en Bois (T1)',
    nomEn: 'Wooden Axe (T1)',
    ingredients: [
      { resourceId: ResourceId.FRENE,  quantite: 3 },
      { resourceId: ResourceId.PIERRE, quantite: 2 },
    ],
    toolType: 'hache', tierId: 1,
    xp: 20,
    description: 'Permet de récolter les essences de Bûcheron au-delà du Frêne.',
    descriptionEn: 'Allows harvesting Lumberjack resources beyond Ash.',
  },
  {
    kind: 'outil',
    id: 'faucille_t1',
    emoji: '🌾',
    nom: 'Faucille en Pierre (T1)',
    nomEn: 'Stone Sickle (T1)',
    ingredients: [
      { resourceId: ResourceId.PIERRE, quantite: 5 },
    ],
    toolType: 'faucille', tierId: 1,
    xp: 20,
    description: 'Permet de récolter les cultures Paysan au-delà du Blé.',
    descriptionEn: 'Allows harvesting Farmer crops beyond Wheat.',
  },
  {
    kind: 'outil',
    id: 'canne_t1',
    emoji: '🎣',
    nom: 'Canne en Bois (T1)',
    nomEn: 'Wooden Rod (T1)',
    ingredients: [
      { resourceId: ResourceId.FRENE,   quantite: 3 },
      { resourceId: ResourceId.CHARBON, quantite: 1 },
    ],
    toolType: 'canne', tierId: 1,
    xp: 20,
    description: 'Permet de pêcher au-delà de la Carpe Japonaise.',
    descriptionEn: 'Allows fishing beyond Japanese Carp.',
  },
  {
    kind: 'outil',
    id: 'pioche_t1',
    emoji: '⛏️',
    nom: 'Pioche en Pierre (T1)',
    nomEn: 'Stone Pickaxe (T1)',
    ingredients: [
      { resourceId: ResourceId.FRENE,  quantite: 2 },
      { resourceId: ResourceId.PIERRE, quantite: 5 },
    ],
    toolType: 'pioche', tierId: 1,
    xp: 20,
    description: 'Permet d\'extraire des minerais au-delà de la Pierre.',
    descriptionEn: 'Allows mining beyond Stone.',
  },
  {
    kind: 'outil',
    id: 'mortier_t1',
    emoji: '🫙',
    nom: 'Mortier en Pierre (T1)',
    nomEn: 'Stone Mortar (T1)',
    ingredients: [
      { resourceId: ResourceId.PIERRE, quantite: 5 },
    ],
    toolType: 'mortier', tierId: 1,
    xp: 20,
    description: 'Permet de préparer des plantes au-delà du Pissenlit.',
    descriptionEn: 'Allows preparing plants beyond Dandelion.',
  },
  // ── Outils T2 (avec Parchemin Ancien)
  {
    kind: 'outil',
    id: 'hache_t2',
    emoji: '🪓',
    nom: 'Hache en Pierre (T2)',
    nomEn: 'Stone Axe (T2)',
    ingredients: [
      { resourceId: ResourceId.SEQUOIA,       quantite: 3 },
      { resourceId: ResourceId.CHARBON,       quantite: 2 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 1 },
    ],
    toolType: 'hache', tierId: 2,
    xp: 60,
    description: '+10% XP récolte, 40 charges. Remplace la T1.',
    descriptionEn: '+10% harvest XP, 40 charges. Replaces T1.',
  },
  {
    kind: 'outil',
    id: 'faucille_t2',
    emoji: '🌾',
    nom: 'Faucille en Fer (T2)',
    nomEn: 'Iron Sickle (T2)',
    ingredients: [
      { resourceId: ResourceId.ORGE,          quantite: 3 },
      { resourceId: ResourceId.CUIVRE,        quantite: 3 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 1 },
    ],
    toolType: 'faucille', tierId: 2,
    xp: 60,
    description: '+10% XP récolte, 40 charges. Remplace la T1.',
    descriptionEn: '+10% harvest XP, 40 charges. Replaces T1.',
  },
  {
    kind: 'outil',
    id: 'canne_t2',
    emoji: '🎣',
    nom: 'Canne Renforcée (T2)',
    nomEn: 'Reinforced Rod (T2)',
    ingredients: [
      { resourceId: ResourceId.CHENE,         quantite: 2 },
      { resourceId: ResourceId.CUIVRE,        quantite: 2 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 1 },
    ],
    toolType: 'canne', tierId: 2,
    xp: 60,
    description: '+10% XP récolte, 40 charges. Remplace la T1.',
    descriptionEn: '+10% harvest XP, 40 charges. Replaces T1.',
  },
  {
    kind: 'outil',
    id: 'pioche_t2',
    emoji: '⛏️',
    nom: 'Pioche en Cuivre (T2)',
    nomEn: 'Copper Pickaxe (T2)',
    ingredients: [
      { resourceId: ResourceId.BOULEAU,       quantite: 2 },
      { resourceId: ResourceId.FER,           quantite: 3 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 1 },
    ],
    toolType: 'pioche', tierId: 2,
    xp: 60,
    description: '+10% XP récolte, 40 charges. Remplace la T1.',
    descriptionEn: '+10% harvest XP, 40 charges. Replaces T1.',
  },
  {
    kind: 'outil',
    id: 'mortier_t2',
    emoji: '🫙',
    nom: 'Mortier en Jade (T2)',
    nomEn: 'Jade Mortar (T2)',
    ingredients: [
      { resourceId: ResourceId.SEQUOIA,       quantite: 2 },
      { resourceId: ResourceId.EMERAUDE,      quantite: 1 },
      { resourceId: ResourceId.PARCHEMIN_ANCIENS, quantite: 1 },
    ],
    toolType: 'mortier', tierId: 2,
    xp: 60,
    description: '+10% XP récolte, 40 charges. Remplace la T1.',
    descriptionEn: '+10% harvest XP, 40 charges. Replaces T1.',
  },
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
    description: 'Élixir puissant combinant herbes et minerais.',
    descriptionEn: 'Powerful elixir combining herbs and minerals.',
  },
];

// ============================================================
// Composant principal
// ============================================================

type View = 'categories' | 'cuisine' | 'artisan' | 'alchimiste';

export function CraftPage() {
  const navigate    = useNavigate();
  const { t, lang } = useT();
  const [view, setView] = useState<View>('categories');
  const [notification, setNotification] = useState<string | null>(null);

  const inventaire         = useGameStore(s => s.inventaire);
  const personageNiveau    = useGameStore(s => s.personageNiveau);
  const personageXp        = useGameStore(s => s.personageXp);
  const personageXpTotal   = useGameStore(s => s.personageXpTotal);
  const craftMetiersRaw    = useGameStore(s => s.craftMetiers);
  const craftMetiers       = craftMetiersRaw ?? { artisan: { niveau: 1, xp: 0, xpTotal: 0 }, alchimisteCraft: { niveau: 1, xp: 0, xpTotal: 0 } };
  const outils             = useGameStore(s => s.outils) ?? {};
  const retirerRessource   = useGameStore(s => s.retirerRessource);
  const ajouterRessource   = useGameStore(s => s.ajouterRessource);
  const ajouterXpPersonage = useGameStore(s => s.ajouterXpPersonage);
  const ajouterXpCraft     = useGameStore(s => s.ajouterXpCraft);
  const setOutil           = useGameStore(s => s.setOutil);

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
    if (recette.kind === 'outil') {
      const tierInfo = getOutilTierInfo(recette.toolType, recette.tierId);
      setOutil(recette.toolType, recette.tierId, tierInfo?.durabiliteMax ?? 20);
      notify(`✅ ${lang === 'en' ? recette.nomEn : recette.nom} — ${tierInfo?.durabiliteMax ?? 20} charges · +${recette.xp} XP Artisan`);
    } else {
      ajouterRessource(recette.resultatId, recette.resultatQte);
      notify(`✅ ${lang === 'en' ? recette.nomEn : recette.nom} — +${recette.xp} XP Artisan`);
    }
    ajouterXpCraft('artisan', recette.xp);
  }

  function craftAlchimiste(recette: RecetteInventaire) {
    if (!canCraftRecette(recette)) return;
    for (const ing of recette.ingredients) retirerRessource(ing.resourceId, ing.quantite);
    ajouterRessource(recette.resultatId, recette.resultatQte);
    ajouterXpCraft('alchimisteCraft', recette.xp);
    notify(`✅ ${lang === 'en' ? recette.nomEn : recette.nom} — +${recette.xp} XP Alchimiste`);
  }

  function notify(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }

  const xpReqPersonage = personageNiveau >= 100 ? xpRequisPersonage(99) : xpRequisPersonage(personageNiveau);
  const pctPersonage = personageNiveau >= 100 ? 100 : Math.min(100, (personageXp / xpReqPersonage) * 100);

  const artisanNiveau    = craftMetiers.artisan.niveau;
  const artisanXp        = craftMetiers.artisan.xp;
  const artisanXpReq     = xpRequis(artisanNiveau);
  const pctArtisan       = artisanNiveau >= 100 ? 100 : Math.min(100, (artisanXp / artisanXpReq) * 100);

  const alchNiveau       = craftMetiers.alchimisteCraft.niveau;
  const alchXp           = craftMetiers.alchimisteCraft.xp;
  const alchXpReq        = xpRequis(alchNiveau);
  const pctAlch          = alchNiveau >= 100 ? 100 : Math.min(100, (alchXp / alchXpReq) * 100);

  const viewTitle =
    view === 'cuisine'    ? '🍳 Cuisine' :
    view === 'artisan'    ? '🔨 Artisan' :
    view === 'alchimiste' ? '⚗️ Alchimiste' :
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
              <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:2 }}>
                <span style={{ color:'#7a4060', fontSize:10, fontWeight:700 }}>Personnage Niv. {personageNiveau}</span>
              </div>
              <div style={{ width:'80%', height:3, background:'rgba(196,48,112,0.1)', borderRadius:2, marginTop:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pctPersonage}%`, background:'linear-gradient(90deg,#c43070,#8a25d4)', borderRadius:2 }} />
              </div>
              <span style={{ color:'#c43070', fontSize:11, marginTop:6, fontWeight:700 }}>{RECETTES_CUISINE.length} recettes →</span>
            </button>

            {/* Artisan */}
            <button style={{ ...s.categoryCard, borderColor:'rgba(100,140,60,0.2)' }} onClick={() => setView('artisan')}>
              <div style={{ ...s.categoryGlow, background:'radial-gradient(ellipse at top left,rgba(100,140,60,0.1),transparent 70%)' }} />
              <span style={{ fontSize:36 }}>🔨</span>
              <span style={{ color:'#4a7a20', fontSize:15, fontWeight:800, marginTop:6 }}>Artisan</span>
              <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:2 }}>
                <span style={{ color:'#5a7030', fontSize:10, fontWeight:700 }}>Artisan Niv. {artisanNiveau}</span>
              </div>
              <div style={{ width:'80%', height:3, background:'rgba(100,140,60,0.1)', borderRadius:2, marginTop:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pctArtisan}%`, background:'linear-gradient(90deg,#6abf44,#3a7a10)', borderRadius:2 }} />
              </div>
              <span style={{ color:'#4a7a20', fontSize:11, marginTop:6, fontWeight:700 }}>{RECETTES_ARTISAN.length} recettes →</span>
            </button>

            {/* Alchimiste craft */}
            <button style={{ ...s.categoryCard, borderColor:'rgba(130,60,180,0.2)' }} onClick={() => setView('alchimiste')}>
              <div style={{ ...s.categoryGlow, background:'radial-gradient(ellipse at top left,rgba(130,60,180,0.1),transparent 70%)' }} />
              <span style={{ fontSize:36 }}>⚗️</span>
              <span style={{ color:'#7030b0', fontSize:15, fontWeight:800, marginTop:6 }}>Alchimiste</span>
              <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:2 }}>
                <span style={{ color:'#7030b0', fontSize:10, fontWeight:700 }}>Alchimiste Niv. {alchNiveau}</span>
              </div>
              <div style={{ width:'80%', height:3, background:'rgba(130,60,180,0.1)', borderRadius:2, marginTop:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pctAlch}%`, background:'linear-gradient(90deg,#ab47bc,#7030b0)', borderRadius:2 }} />
              </div>
              <span style={{ color:'#7030b0', fontSize:11, marginTop:6, fontWeight:700 }}>{RECETTES_ALCHIMISTE.length} recettes →</span>
            </button>
          </>
        )}

        {/* ── Vue Cuisine ── */}
        {view === 'cuisine' && (
          <>
            {/* Barre XP personnage */}
            <XpBar label={`👤 Personnage — Niv. ${personageNiveau}`} xp={personageXp} xpReq={xpReqPersonage} xpTotal={personageXpTotal} pct={pctPersonage} color="#c43070" />
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
                      outilActuel={undefined}
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
            <XpBar label={`🔨 Artisan — Niv. ${artisanNiveau}`} xp={artisanXp} xpReq={artisanXpReq} xpTotal={craftMetiers.artisan.xpTotal} pct={pctArtisan} color="#6abf44" />
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'10px 0 4px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'TOOLS (T1 — no Parchment required)' : 'OUTILS (T1 — sans Parchemin)'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
              {RECETTES_ARTISAN.filter(r => r.kind === 'outil' && (r as RecetteOutil).tierId === 1).map(r => (
                <RecetteCard
                  key={r.id}
                  recette={r}
                  inventaire={inventaire}
                  lang={lang}
                  onCraft={() => craftArtisan(r)}
                  btnLabel={lang === 'en' ? '🔨 Craft' : '🔨 Forger'}
                  outilActuel={r.kind === 'outil' ? outils[(r as RecetteOutil).toolType] : undefined}
                />
              ))}
            </div>
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'0 0 4px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'TOOLS (T2 — Parchment required)' : 'OUTILS (T2 — Parchemin requis)'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
              {RECETTES_ARTISAN.filter(r => r.kind === 'outil' && (r as RecetteOutil).tierId === 2).map(r => (
                <RecetteCard
                  key={r.id}
                  recette={r}
                  inventaire={inventaire}
                  lang={lang}
                  onCraft={() => craftArtisan(r)}
                  btnLabel={lang === 'en' ? '🔨 Craft' : '🔨 Forger'}
                  outilActuel={r.kind === 'outil' ? outils[(r as RecetteOutil).toolType] : undefined}
                />
              ))}
            </div>
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'0 0 4px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'FURNITURE' : 'MOBILIER'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {RECETTES_ARTISAN.filter(r => r.kind === 'inventaire').map(r => (
                <RecetteCard
                  key={r.id}
                  recette={r}
                  inventaire={inventaire}
                  lang={lang}
                  onCraft={() => craftArtisan(r)}
                  btnLabel={lang === 'en' ? '🔨 Craft' : '🔨 Fabriquer'}
                  outilActuel={undefined}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Vue Alchimiste ── */}
        {view === 'alchimiste' && (
          <>
            <XpBar label={`⚗️ Alchimiste — Niv. ${alchNiveau}`} xp={alchXp} xpReq={alchXpReq} xpTotal={craftMetiers.alchimisteCraft.xpTotal} pct={pctAlch} color="#ab47bc" />
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'10px 0 8px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'POTIONS & ELIXIRS' : 'POTIONS & ÉLIXIRS'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {RECETTES_ALCHIMISTE.map(r => (
                <RecetteCard
                  key={r.id}
                  recette={r}
                  inventaire={inventaire}
                  lang={lang}
                  onCraft={() => craftAlchimiste(r)}
                  btnLabel={lang === 'en' ? '⚗️ Brew' : '⚗️ Préparer'}
                  outilActuel={undefined}
                />
              ))}
            </div>
          </>
        )}
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

function RecetteCard({ recette, inventaire, lang, onCraft, btnLabel, outilActuel }: {
  recette: Recette;
  inventaire: Partial<Record<ResourceId, number>>;
  lang: 'fr' | 'en';
  onCraft: () => void;
  btnLabel: string;
  outilActuel: { tierId: number; durabilite: number } | undefined;
}) {
  const craftable = recette.ingredients.every(ing => (inventaire[ing.resourceId] ?? 0) >= ing.quantite);
  const nom  = lang === 'en' ? recette.nomEn : recette.nom;
  const desc = lang === 'en' ? recette.descriptionEn : recette.description;

  // Pour les outils : afficher l'état actuel
  const toolInfo = recette.kind === 'outil'
    ? OUTIL_TIERS[(recette as RecetteOutil).toolType]?.find(t => t.tierId === (recette as RecetteOutil).tierId)
    : undefined;

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
            {recette.kind === 'outil' && toolInfo && (
              <span style={{ background:'rgba(106,191,68,0.1)', color:'#4a8f2a', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:8 }}>
                {toolInfo.durabiliteMax} charges
              </span>
            )}
          </div>
          <p style={{ color:'#7a4060', fontSize:10, margin:'0 0 6px', lineHeight:1.4 }}>{desc}</p>

          {/* État outil actuel */}
          {recette.kind === 'outil' && outilActuel !== undefined && (
            <div style={{ marginBottom:6, padding:'4px 8px', background:'rgba(249,168,37,0.08)', border:'1px solid rgba(249,168,37,0.25)', borderRadius:8 }}>
              {outilActuel.durabilite > 0 ? (
                <span style={{ color:'#b07010', fontSize:9, fontWeight:700 }}>
                  Actuel : T{outilActuel.tierId} — {outilActuel.durabilite} charges restantes
                </span>
              ) : (
                <span style={{ color:'#e53935', fontSize:9, fontWeight:700 }}>⚠️ Outil cassé — Recraftez-en un</span>
              )}
            </div>
          )}

          {/* Ingrédients */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
            {recette.ingredients.map(ing => {
              const have = inventaire[ing.resourceId] ?? 0;
              const ok   = have >= ing.quantite;
              return (
                <div key={ing.resourceId} style={{ display:'flex', alignItems:'center', gap:3, background: ok ? 'rgba(106,191,68,0.08)' : 'rgba(196,48,112,0.06)', border: `1px solid ${ok ? 'rgba(106,191,68,0.3)' : 'rgba(212,100,138,0.2)'}`, borderRadius:8, padding:'3px 7px' }}>
                  <span style={{ fontSize:12 }}>{emojiByResourceId(ing.resourceId)}</span>
                  <span style={{ color: ok ? '#2a7a10' : '#c43070', fontSize:10, fontWeight:700 }}>×{ing.quantite}</span>
                  <span style={{ color:'#9a6080', fontSize:9 }}>({Math.floor(have)}/{ing.quantite})</span>
                </div>
              );
            })}
          </div>

          {/* Résultat */}
          {recette.kind === 'inventaire' && (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ color:'#9a6080', fontSize:10 }}>→</span>
              <span style={{ fontSize:15 }}>{emojiByResourceId(recette.resultatId)}</span>
              <span style={{ color:'#1e0a16', fontSize:11, fontWeight:700 }}>
                {getNomRessource(recette.resultatId, lang)} ×{recette.resultatQte}
              </span>
            </div>
          )}
          {recette.kind === 'outil' && toolInfo && (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ color:'#9a6080', fontSize:10 }}>→</span>
              <span style={{ fontSize:15 }}>{toolInfo.emoji}</span>
              <span style={{ color:'#1e0a16', fontSize:11, fontWeight:700 }}>{toolInfo.nom}</span>
            </div>
          )}
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
