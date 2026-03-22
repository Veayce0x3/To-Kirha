import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { ResourceId } from '../data/resources';
import { useT } from '../utils/i18n';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';

// ============================================================
// Recettes de Cuisine
// ============================================================

interface Ingredient {
  resourceId: ResourceId;
  quantite: number;
}

interface Recette {
  id: string;
  emoji: string;
  nom: string;
  nomEn: string;
  ingredients: Ingredient[];
  resultatId: ResourceId;
  resultatQte: number;
  xpPersonage: number;
  description: string;
  descriptionEn: string;
}

const RECETTES: Recette[] = [
  {
    id: 'pain_ble',
    emoji: '🍞',
    nom: 'Pain de Blé',
    nomEn: 'Wheat Bread',
    ingredients: [
      { resourceId: ResourceId.BLE,  quantite: 5 },
      { resourceId: ResourceId.EAU,  quantite: 2 },
    ],
    resultatId: ResourceId.PAIN_BLE,
    resultatQte: 1,
    xpPersonage: 20,
    description: 'Une miche dorée, base de tout repas.',
    descriptionEn: 'A golden loaf, the base of every meal.',
  },
  {
    id: 'riz_au_lait',
    emoji: '🍚',
    nom: 'Riz au Lait',
    nomEn: 'Rice Pudding',
    ingredients: [
      { resourceId: ResourceId.RIZ,         quantite: 5 },
      { resourceId: ResourceId.LAIT,         quantite: 2 },
      { resourceId: ResourceId.EAU,          quantite: 1 },
    ],
    resultatId: ResourceId.RIZ_AU_LAIT,
    resultatQte: 1,
    xpPersonage: 35,
    description: 'Crémeux et doux, parfait après la récolte.',
    descriptionEn: 'Creamy and sweet, perfect after harvesting.',
  },
  {
    id: 'galette_sakura',
    emoji: '🥞',
    nom: 'Galette Sakura',
    nomEn: 'Sakura Pancake',
    ingredients: [
      { resourceId: ResourceId.SARRASIN,    quantite: 3 },
      { resourceId: ResourceId.EAU,          quantite: 2 },
      { resourceId: ResourceId.MIEL_ANIMAL, quantite: 1 },
    ],
    resultatId: ResourceId.GALETTE_SAKURA,
    resultatQte: 1,
    xpPersonage: 50,
    description: 'Galette parfumée au miel, spécialité de la Ferme.',
    descriptionEn: 'Honey-scented pancake, a Farm specialty.',
  },
  {
    id: 'miel_sakura',
    emoji: '🍯',
    nom: 'Miel Sakura',
    nomEn: 'Sakura Honey',
    ingredients: [
      { resourceId: ResourceId.MIEL_ANIMAL,   quantite: 3 },
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 2 },
    ],
    resultatId: ResourceId.MIEL_SAKURA,
    resultatQte: 1,
    xpPersonage: 75,
    description: 'Miel infusé de fleurs de cerisier, rare et précieux.',
    descriptionEn: 'Honey infused with cherry blossoms, rare and precious.',
  },
  {
    id: 'the_wisteria',
    emoji: '🍵',
    nom: 'Thé Wisteria',
    nomEn: 'Wisteria Tea',
    ingredients: [
      { resourceId: ResourceId.WISTERIA,       quantite: 3 },
      { resourceId: ResourceId.FLEUR_CERISIER, quantite: 1 },
      { resourceId: ResourceId.EAU,            quantite: 2 },
    ],
    resultatId: ResourceId.THE_WISTERIA,
    resultatQte: 1,
    xpPersonage: 60,
    description: 'Infusion florale aux arômes délicats de Wisteria.',
    descriptionEn: 'Floral infusion with delicate Wisteria aromas.',
  },
];

// ============================================================
// Composant principal
// ============================================================

type View = 'categories' | 'cuisine';

export function CraftPage() {
  const navigate    = useNavigate();
  const { t, lang } = useT();
  const [view, setView] = useState<View>('categories');
  const [notification, setNotification] = useState<string | null>(null);

  const inventaire           = useGameStore(s => s.inventaire);
  const personageNiveau      = useGameStore(s => s.personageNiveau);
  const personageXp          = useGameStore(s => s.personageXp);
  const personageXpTotal     = useGameStore(s => s.personageXpTotal);
  const retirerRessource     = useGameStore(s => s.retirerRessource);
  const ajouterRessource     = useGameStore(s => s.ajouterRessource);
  const ajouterXpPersonage   = useGameStore(s => s.ajouterXpPersonage);

  function canCraft(recette: Recette): boolean {
    return recette.ingredients.every(ing => (inventaire[ing.resourceId] ?? 0) >= ing.quantite);
  }

  function craft(recette: Recette) {
    if (!canCraft(recette)) return;
    for (const ing of recette.ingredients) {
      retirerRessource(ing.resourceId, ing.quantite);
    }
    ajouterRessource(recette.resultatId, recette.resultatQte);
    ajouterXpPersonage(recette.xpPersonage);
    const nom = lang === 'en' ? recette.nomEn : recette.nom;
    setNotification(`✅ ${nom} crafté ! +${recette.xpPersonage} XP personnage`);
    setTimeout(() => setNotification(null), 3000);
  }

  const xpRequisPersonage = Math.round(100 * Math.pow(personageNiveau, 1.8));
  const pctPersonage = personageNiveau >= 100 ? 100 : Math.min(100, (personageXp / xpRequisPersonage) * 100);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => view === 'categories' ? navigate('/home') : setView('categories')}>
          {view === 'categories' ? t('craft.back_home') : '← Recettes'}
        </button>
        <span style={s.headerTitle}>{view === 'cuisine' ? '🍳 Cuisine' : t('craft.title')}</span>
        <div style={{ width: 80 }} />
      </div>

      {notification && (
        <div style={{ margin:'8px 16px 0', padding:'8px 14px', background:'rgba(106,191,68,0.12)', border:'1px solid rgba(106,191,68,0.35)', borderRadius:10, color:'#2a7a10', fontSize:12, fontWeight:700, textAlign:'center' }}>
          {notification}
        </div>
      )}

      {/* Barre XP personnage */}
      <div style={{ margin:'10px 16px 0', padding:'10px 14px', background:'#fff', border:'1px solid rgba(212,100,138,0.15)', borderRadius:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <span style={{ color:'#1e0a16', fontSize:12, fontWeight:800 }}>👤 Personnage — Niv. {personageNiveau}</span>
          <span style={{ color:'#7a4060', fontSize:10 }}>{personageXpTotal} XP total</span>
        </div>
        <div style={{ height:6, background:'rgba(212,100,138,0.08)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pctPersonage}%`, background:'linear-gradient(90deg,#c43070,#8a25d4)', borderRadius:3, transition:'width 0.4s' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
          <span style={{ color:'#7a4060', fontSize:9 }}>{personageXp} / {personageNiveau < 100 ? xpRequisPersonage : '—'} XP</span>
          <span style={{ color:'#7a4060', fontSize:9 }}>{Math.round(pctPersonage)}%</span>
        </div>
      </div>

      <div style={s.body}>
        {/* ── Vue catégories ── */}
        {view === 'categories' && (
          <>
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'0 0 10px', letterSpacing:'0.05em' }}>MÉTIERS DE CRAFT</p>
            {/* Carte Cuisine — fonctionnelle */}
            <button style={s.categoryCard} onClick={() => setView('cuisine')}>
              <div style={{ ...s.categoryGlow, background:'radial-gradient(ellipse at top left,rgba(196,48,112,0.12),transparent 70%)' }} />
              <span style={{ fontSize:40 }}>🍳</span>
              <span style={{ color:'#c43070', fontSize:16, fontWeight:800, marginTop:6 }}>Cuisine</span>
              <span style={{ color:'#7a4060', fontSize:11, textAlign:'center', lineHeight:1.4, marginTop:4 }}>
                {lang === 'en' ? 'Cook recipes & earn character XP' : 'Cuisinez des recettes & gagnez de l\'XP personnage'}
              </span>
              <span style={{ color:'#c43070', fontSize:12, marginTop:8, fontWeight:700 }}>{RECETTES.length} recettes →</span>
            </button>

            {/* Placeholder futures catégories */}
            <div style={{ ...s.categoryCard, opacity:0.45, cursor:'default' }}>
              <span style={{ fontSize:36 }}>⚗️</span>
              <span style={{ color:'#8d6e63', fontSize:15, fontWeight:800, marginTop:6 }}>Alchimie</span>
              <span style={{ color:'#7a4060', fontSize:11, marginTop:4 }}>
                {lang === 'en' ? 'Coming soon' : 'Bientôt disponible'}
              </span>
              <div style={s.comingSoon}>{lang === 'en' ? '🚧 Coming soon' : '🚧 Bientôt'}</div>
            </div>
          </>
        )}

        {/* ── Vue Cuisine ── */}
        {view === 'cuisine' && (
          <>
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'0 0 10px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'CUISINE RECIPES' : 'RECETTES DE CUISINE'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {RECETTES.map(recette => {
                const craftable = canCraft(recette);
                const nom = lang === 'en' ? recette.nomEn : recette.nom;
                const desc = lang === 'en' ? recette.descriptionEn : recette.description;
                return (
                  <div key={recette.id} style={{ ...s.recetteCard, borderColor: craftable ? 'rgba(196,48,112,0.35)' : 'rgba(212,100,138,0.13)' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                      <span style={{ fontSize:36, lineHeight:1 }}>{recette.emoji}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                          <span style={{ color:'#1e0a16', fontSize:14, fontWeight:800 }}>{nom}</span>
                          <span style={{ background:'rgba(196,48,112,0.1)', color:'#c43070', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:8 }}>
                            +{recette.xpPersonage} XP
                          </span>
                        </div>
                        <p style={{ color:'#7a4060', fontSize:10, margin:'0 0 8px', lineHeight:1.4 }}>{desc}</p>
                        {/* Ingrédients */}
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                          {recette.ingredients.map(ing => {
                            const have = inventaire[ing.resourceId] ?? 0;
                            const ok   = have >= ing.quantite;
                            return (
                              <div key={ing.resourceId} style={{ display:'flex', alignItems:'center', gap:3, background: ok ? 'rgba(106,191,68,0.08)' : 'rgba(196,48,112,0.06)', border: `1px solid ${ok ? 'rgba(106,191,68,0.3)' : 'rgba(212,100,138,0.2)'}`, borderRadius:8, padding:'3px 7px' }}>
                                <span style={{ fontSize:13 }}>{emojiByResourceId(ing.resourceId)}</span>
                                <span style={{ color: ok ? '#2a7a10' : '#c43070', fontSize:10, fontWeight:700 }}>
                                  ×{ing.quantite}
                                </span>
                                <span style={{ color:'#9a6080', fontSize:9 }}>
                                  ({Math.floor(have)}/{ing.quantite})
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {/* Résultat */}
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ color:'#9a6080', fontSize:10 }}>→</span>
                          <span style={{ fontSize:16 }}>{emojiByResourceId(recette.resultatId)}</span>
                          <span style={{ color:'#1e0a16', fontSize:11, fontWeight:700 }}>
                            {getNomRessource(recette.resultatId, lang)} ×{recette.resultatQte}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      style={{ marginTop:10, width:'100%', padding:'9px', background: craftable ? 'linear-gradient(135deg,#c43070,#8a25d4)' : 'rgba(212,100,138,0.08)', border: craftable ? 'none' : '1px solid rgba(212,100,138,0.2)', borderRadius:10, color: craftable ? '#fff' : '#9a6080', fontSize:12, fontWeight:700, cursor: craftable ? 'pointer' : 'default', opacity: craftable ? 1 : 0.6 }}
                      disabled={!craftable}
                      onClick={() => craft(recette)}
                    >
                      {craftable ? `🍳 ${lang === 'en' ? 'Cook' : 'Cuisiner'}` : lang === 'en' ? 'Missing ingredients' : 'Ingrédients insuffisants'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
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
    borderRadius:18, padding:'20px 16px',
    display:'flex', flexDirection:'column', alignItems:'center',
    cursor:'pointer', width:'100%', boxSizing:'border-box',
    marginBottom:12,
  },
  categoryGlow: { position:'absolute', inset:0, pointerEvents:'none' },
  recetteCard: {
    background:'#fff', border:'1.5px solid', borderRadius:16, padding:'14px',
  },
  comingSoon: { marginTop:10, padding:'5px 16px', background:'rgba(141,110,99,0.12)', border:'1px solid rgba(141,110,99,0.25)', borderRadius:10, color:'#8d6e63', fontSize:11, fontWeight:700 },
};
