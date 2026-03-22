import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, xpRequis } from '../store/gameStore';
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
// Recettes de Cuisine (Parchemin Ancien requis dans toutes)
// ============================================================

const RECETTES_CUISINE: RecetteInventaire[] = [
  {
    kind: 'inventaire',
    id: 'pain_ble',
    emoji: '🍞',
    nom: 'Pain de Blé',
    nomEn: 'Wheat Bread',
    ingredients: [
      { resourceId: ResourceId.BLE,           quantite: 5 },
      { resourceId: ResourceId.EAU,           quantite: 2 },
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 1 },
    ],
    resultatId: ResourceId.PAIN_BLE,
    resultatQte: 1,
    xp: 25,
    description: 'Une miche dorée, base de tout repas.',
    descriptionEn: 'A golden loaf, the base of every meal.',
  },
  {
    kind: 'inventaire',
    id: 'riz_au_lait',
    emoji: '🍚',
    nom: 'Riz au Lait',
    nomEn: 'Rice Pudding',
    ingredients: [
      { resourceId: ResourceId.RIZ,           quantite: 5 },
      { resourceId: ResourceId.LAIT,          quantite: 2 },
      { resourceId: ResourceId.EAU,           quantite: 1 },
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 1 },
    ],
    resultatId: ResourceId.RIZ_AU_LAIT,
    resultatQte: 1,
    xp: 40,
    description: 'Crémeux et doux, parfait après la récolte.',
    descriptionEn: 'Creamy and sweet, perfect after harvesting.',
  },
  {
    kind: 'inventaire',
    id: 'galette_sakura',
    emoji: '🥞',
    nom: 'Galette Sakura',
    nomEn: 'Sakura Pancake',
    ingredients: [
      { resourceId: ResourceId.SARRASIN,      quantite: 3 },
      { resourceId: ResourceId.EAU,           quantite: 2 },
      { resourceId: ResourceId.MIEL_ANIMAL,   quantite: 1 },
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 2 },
    ],
    resultatId: ResourceId.GALETTE_SAKURA,
    resultatQte: 1,
    xp: 55,
    description: 'Galette parfumée au miel, spécialité de la Ferme.',
    descriptionEn: 'Honey-scented pancake, a Farm specialty.',
  },
  {
    kind: 'inventaire',
    id: 'miel_sakura',
    emoji: '🍯',
    nom: 'Miel Sakura',
    nomEn: 'Sakura Honey',
    ingredients: [
      { resourceId: ResourceId.MIEL_ANIMAL,   quantite: 3 },
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 3 },
    ],
    resultatId: ResourceId.MIEL_SAKURA,
    resultatQte: 1,
    xp: 80,
    description: 'Miel infusé de fleurs de cerisier, rare et précieux.',
    descriptionEn: 'Honey infused with cherry blossoms, rare and precious.',
  },
  {
    kind: 'inventaire',
    id: 'the_wisteria',
    emoji: '🍵',
    nom: 'Thé Wisteria',
    nomEn: 'Wisteria Tea',
    ingredients: [
      { resourceId: ResourceId.WISTERIA,      quantite: 3 },
      { resourceId: ResourceId.EAU,           quantite: 2 },
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 2 },
    ],
    resultatId: ResourceId.THE_WISTERIA,
    resultatQte: 1,
    xp: 65,
    description: 'Infusion florale aux arômes délicats de Wisteria.',
    descriptionEn: 'Floral infusion with delicate Wisteria aromas.',
  },
  {
    kind: 'inventaire',
    id: 'soupe_pecheur',
    emoji: '🍲',
    nom: 'Soupe du Pêcheur',
    nomEn: "Fisher's Soup",
    ingredients: [
      { resourceId: ResourceId.SAUMON,        quantite: 2 },
      { resourceId: ResourceId.BLE,           quantite: 2 },
      { resourceId: ResourceId.PIERRE,        quantite: 1 },
      { resourceId: ResourceId.PISSENLIT,     quantite: 2 },
      { resourceId: ResourceId.EAU,           quantite: 3 },
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 2 },
    ],
    resultatId: ResourceId.SOUPE_PECHEUR,
    resultatQte: 1,
    xp: 150,
    description: 'Soupe roborative mêlant les saveurs des 4 métiers de récolte.',
    descriptionEn: 'Hearty soup blending flavors from 4 harvest professions.',
  },
  {
    kind: 'inventaire',
    id: 'bento_imperial',
    emoji: '🎎',
    nom: 'Bento Impérial',
    nomEn: 'Imperial Bento',
    ingredients: [
      { resourceId: ResourceId.SAKURA,              quantite: 1 },
      { resourceId: ResourceId.RIZ_SAKURA,          quantite: 2 },
      { resourceId: ResourceId.FUGU,                quantite: 1 },
      { resourceId: ResourceId.CRISTAL_KOI,         quantite: 1 },
      { resourceId: ResourceId.FLEUR_LOTUS_SAKURA,  quantite: 1 },
      { resourceId: ResourceId.FLEUR_CERISIER,      quantite: 3 },
      { resourceId: ResourceId.LAIT,                quantite: 2 },
      { resourceId: ResourceId.MIEL_SAKURA,         quantite: 1 },
    ],
    resultatId: ResourceId.BENTO_IMPERIAL,
    resultatQte: 1,
    xp: 350,
    description: 'Chef-d\'œuvre culinaire exigeant les 5 professions de récolte.',
    descriptionEn: 'Culinary masterpiece requiring all 5 harvest professions.',
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
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 1 },
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
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 1 },
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
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 1 },
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
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 1 },
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
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 1 },
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
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 2 },
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
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 2 },
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
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 1 },
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
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 2 },
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

  const xpRequisPersonage = Math.round(100 * Math.pow(personageNiveau, 1.8));
  const pctPersonage = personageNiveau >= 100 ? 100 : Math.min(100, (personageXp / xpRequisPersonage) * 100);

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
            <XpBar label={`👤 Personnage — Niv. ${personageNiveau}`} xp={personageXp} xpReq={xpRequisPersonage} xpTotal={personageXpTotal} pct={pctPersonage} color="#c43070" />
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'10px 0 8px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'CUISINE RECIPES' : 'RECETTES DE CUISINE'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {RECETTES_CUISINE.map(r => (
                <RecetteCard
                  key={r.id}
                  recette={r}
                  inventaire={inventaire}
                  lang={lang}
                  onCraft={() => craftCuisine(r)}
                  btnLabel={lang === 'en' ? '🍳 Cook' : '🍳 Cuisiner'}
                  outilActuel={undefined}
                />
              ))}
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
