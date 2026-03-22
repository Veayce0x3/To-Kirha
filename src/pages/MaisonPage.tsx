import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useGameStore, xpRequis } from '../store/gameStore';
import { METIERS, MetierId } from '../data/metiers';
import { ResourceId } from '../data/resources';
import { useT } from '../utils/i18n';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';
import { getResourceById } from '../data/metiers';

type Tab = 'ressources' | 'metiers' | 'personnage';
type SortMode = 'quantite' | 'categorie';

const METIER_CONFIG: Record<MetierId, { icon: string; color: string }> = {
  bucheron:   { icon: '🪓', color: '#6abf44' },
  paysan:     { icon: '🌾', color: '#f9a825' },
  pecheur:    { icon: '🎣', color: '#29b6f6' },
  mineur:     { icon: '⛏️', color: '#8d6e63' },
  alchimiste: { icon: '🌿', color: '#ab47bc' },
};

const COUT_RESET_COMPETENCES = 100;

export function MaisonPage() {
  const navigate    = useNavigate();
  const { address } = useAccount();
  const [tab, setTab]   = useState<Tab>('ressources');
  const [sort, setSort] = useState<SortMode>('quantite');
  const { t, lang } = useT();

  const inventaire         = useGameStore(s => s.inventaire);
  const metiers            = useGameStore(s => s.metiers);
  const personageNiveau    = useGameStore(s => s.personageNiveau);
  const personageXp        = useGameStore(s => s.personageXp);
  const personageXpTotal   = useGameStore(s => s.personageXpTotal);
  const competencesPoints  = useGameStore(s => s.competencesPoints);
  const competences        = useGameStore(s => s.competences);
  const pepitesOr          = useGameStore(s => s.pepitesOr);
  const allouerCompetence  = useGameStore(s => s.allouerCompetence);
  const retirerCompetence  = useGameStore(s => s.retirerCompetence);
  const reinitialiserCompetences = useGameStore(s => s.reinitialiserCompetences);

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';

  // Inclure toutes les ressources (y compris IDs > 50)
  const items = (Object.entries(inventaire) as [string, number][])
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const numId = Number(id) as ResourceId;
      const res = getResourceById(numId);
      return {
        id: numId,
        qty,
        res,
        nom: res?.nom ?? getNomRessource(numId, lang),
        categorie: res?.metier ?? 'special' as MetierId | 'special',
      };
    });

  const sorted = [...items].sort((a, b) => {
    if (sort === 'quantite') return b.qty - a.qty;
    return a.categorie < b.categorie ? -1 : a.categorie > b.categorie ? 1 : 0;
  });

  const totalItems = parseFloat(items.reduce((acc, i) => acc + i.qty, 0).toFixed(2));

  const xpRequisNiveau = personageNiveau < 100 ? xpRequis(personageNiveau) : 1;
  const pctPersonage   = personageNiveau >= 100 ? 100 : Math.min(100, (personageXp / xpRequisNiveau) * 100);
  const totalCompetencesDepenses = Object.values(competences).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/home')}>{t('maison.back_home')}</button>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
          <span style={s.headerTitle}>{t('maison.title')}</span>
          <span style={{ color:'#7a4060', fontSize:'10px', fontFamily:'monospace' }}>{short}</span>
        </div>
        <div style={{ width: 48 }} />
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {([['ressources', `${t('maison.tab_res')}${totalItems > 0 ? ` (${totalItems})` : ''}`], ['metiers', t('maison.tab_metiers')], ['personnage', t('maison.tab_perso')]] as [Tab, string][]).map(([tabId, label]) => (
          <button key={tabId} style={{ ...s.tab, ...(tab === tabId ? s.tabActive : {}) }} onClick={() => setTab(tabId as Tab)}>
            {label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div style={s.content}>

        {/* ── Ressources ── */}
        {tab === 'ressources' && (
          <>
            <div style={s.sortBar}>
              {(['quantite', 'categorie'] as SortMode[]).map(mode => (
                <button key={mode} style={{ ...s.sortBtn, ...(sort === mode ? s.sortBtnActive : {}) }} onClick={() => setSort(mode)}>
                  {mode === 'quantite' ? t('maison.sort_qty') : t('maison.sort_cat')}
                </button>
              ))}
            </div>
            {sorted.length === 0 ? (
              <div style={s.empty}>
                <span style={{ fontSize:'40px' }}>📦</span>
                <p style={{ color:'#7a4060', fontSize:'14px', marginTop:12 }}>{t('maison.empty')}</p>
                <button style={s.goBtn} onClick={() => navigate('/recolte')}>{t('maison.go_harvest')}</button>
              </div>
            ) : (
              sorted.map(({ id, qty, res, nom, categorie }) => {
                const metierCfg = categorie !== 'special' ? METIER_CONFIG[categorie as MetierId] : null;
                return (
                  <div key={id} style={s.itemRow}>
                    <div style={{ ...s.itemIcon, borderColor: metierCfg ? metierCfg.color + '66' : '#d4648a66' }}>
                      <span style={{ fontSize:'20px' }}>{emojiByResourceId(id)}</span>
                    </div>
                    <div style={s.itemInfo}>
                      <span style={{ color:'#1e0a16', fontSize:'13px', fontWeight:600 }}>{nom}</span>
                      <span style={{ color:'#7a4060', fontSize:'10px' }}>
                        {metierCfg
                          ? `${metierCfg.icon} ${METIERS[categorie as MetierId].nom}`
                          : id <= 57 ? '🌾 Ferme' : '🍳 Cuisine'
                        }
                      </span>
                    </div>
                    <div style={s.itemRight}>
                      <span style={{ color:'#1e0a16', fontSize:'15px', fontWeight:800 }}>×{parseFloat(qty.toFixed(2))}</span>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ── Métiers ── */}
        {tab === 'metiers' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {(Object.keys(METIER_CONFIG) as MetierId[]).map(id => {
              const p   = metiers[id];
              const cfg = METIER_CONFIG[id];
              const pct = Math.min(100, (p.xp / xpRequis(p.niveau)) * 100);
              const compPoints = competences[id] ?? 0;
              return (
                <div key={id} style={{ ...s.metierCard, borderColor: `${cfg.color}44` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
                    <span style={{ fontSize:'28px', filter:`drop-shadow(0 0 5px ${cfg.color}66)` }}>{cfg.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ color:'#1e0a16', fontSize:'14px', fontWeight:800 }}>{METIERS[id].nom}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          {compPoints > 0 && (
                            <span style={{ background:`${cfg.color}22`, color:cfg.color, fontSize:'9px', fontWeight:700, padding:'1px 5px', borderRadius:6 }}>
                              +{compPoints * 5}% rendement
                            </span>
                          )}
                          <span style={{ ...s.levelBadge, borderColor: cfg.color, color: cfg.color }}>{t('maison.level')} {p.niveau}</span>
                        </div>
                      </div>
                      <span style={{ color:'#7a4060', fontSize:'10px' }}>{p.xp_total} {t('maison.xp_total')}</span>
                    </div>
                  </div>
                  <div style={{ height:6, background:'rgba(212,100,138,0.08)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background: cfg.color, borderRadius:3, transition:'width 0.4s' }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
                    <span style={{ color:'#7a4060', fontSize:'9px' }}>{p.xp} / {xpRequis(p.niveau)} XP</span>
                    <span style={{ color:'#7a4060', fontSize:'9px' }}>{Math.round(pct)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Personnage ── */}
        {tab === 'personnage' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Niveau personnage */}
            <div style={{ background:'#fff', border:'1.5px solid rgba(196,48,112,0.25)', borderRadius:16, padding:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <span style={{ fontSize:36 }}>👤</span>
                <div style={{ flex:1 }}>
                  <span style={{ color:'#1e0a16', fontSize:16, fontWeight:900, display:'block' }}>
                    {lang === 'en' ? 'Character' : 'Personnage'}
                  </span>
                  <span style={{ color:'#c43070', fontSize:11, fontWeight:700 }}>
                    {lang === 'en' ? `Level ${personageNiveau}` : `Niveau ${personageNiveau}`}
                    {personageNiveau >= 100 && ' (MAX)'}
                  </span>
                </div>
                <span style={{ color:'#7a4060', fontSize:10, textAlign:'right' }}>
                  {personageXpTotal}<br/><span style={{ fontSize:8 }}>XP total</span>
                </span>
              </div>
              <div style={{ height:8, background:'rgba(212,100,138,0.08)', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pctPersonage}%`, background:'linear-gradient(90deg,#c43070,#8a25d4)', borderRadius:4, transition:'width 0.4s' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
                <span style={{ color:'#7a4060', fontSize:10 }}>
                  {personageNiveau < 100 ? `${personageXp} / ${xpRequisNiveau} XP` : 'Niveau maximum atteint'}
                </span>
                <span style={{ color:'#7a4060', fontSize:10 }}>{Math.round(pctPersonage)}%</span>
              </div>
              <p style={{ color:'#9a6080', fontSize:10, margin:'8px 0 0', lineHeight:1.5 }}>
                {lang === 'en'
                  ? '💡 Character XP is earned exclusively through Cuisine crafting.'
                  : '💡 L\'XP personnage se gagne uniquement via le Craft Cuisine.'}
              </p>
            </div>

            {/* Arbre de compétences */}
            <div style={{ background:'#fff', border:'1px solid rgba(212,100,138,0.15)', borderRadius:16, padding:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ color:'#1e0a16', fontSize:14, fontWeight:800 }}>
                  {lang === 'en' ? '⚡ Skill Tree' : '⚡ Arbre de compétences'}
                </span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ background:'rgba(196,48,112,0.1)', color:'#c43070', fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:20 }}>
                    {competencesPoints} {lang === 'en' ? 'pts' : 'pts dispo'}
                  </span>
                </div>
              </div>
              <p style={{ color:'#7a4060', fontSize:10, margin:'0 0 12px', lineHeight:1.5 }}>
                {lang === 'en'
                  ? 'Each point gives +5% harvest yield for a profession (max 10 pts/profession).'
                  : 'Chaque point donne +5% de rendement de récolte pour un métier (max 10 pts/métier).'}
              </p>

              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(Object.keys(METIER_CONFIG) as MetierId[]).map(id => {
                  const cfg   = METIER_CONFIG[id];
                  const pts   = competences[id] ?? 0;
                  const bonus = pts * 5;
                  return (
                    <div key={id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:`${cfg.color}08`, border:`1px solid ${cfg.color}22`, borderRadius:10 }}>
                      <span style={{ fontSize:18 }}>{cfg.icon}</span>
                      <span style={{ color:'#1e0a16', fontSize:12, fontWeight:700, flex:1 }}>{METIERS[id].nom}</span>
                      {bonus > 0 && (
                        <span style={{ color:cfg.color, fontSize:10, fontWeight:700 }}>+{bonus}%</span>
                      )}
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <button
                          style={{ width:24, height:24, background:'rgba(196,48,112,0.1)', border:'1px solid rgba(196,48,112,0.2)', borderRadius:6, color:'#c43070', fontSize:14, fontWeight:700, cursor: pts > 0 ? 'pointer' : 'default', opacity: pts > 0 ? 1 : 0.3, padding:0, lineHeight:1 }}
                          onClick={() => retirerCompetence(id)}
                          disabled={pts < 1}
                        >−</button>
                        <span style={{ color:'#1e0a16', fontSize:12, fontWeight:800, minWidth:16, textAlign:'center' }}>{pts}</span>
                        <button
                          style={{ width:24, height:24, background: competencesPoints > 0 && pts < 10 ? cfg.color : 'rgba(212,100,138,0.08)', border:'none', borderRadius:6, color: competencesPoints > 0 && pts < 10 ? '#fff' : '#9a6080', fontSize:14, fontWeight:700, cursor: competencesPoints > 0 && pts < 10 ? 'pointer' : 'default', opacity: competencesPoints > 0 && pts < 10 ? 1 : 0.3, padding:0, lineHeight:1 }}
                          onClick={() => allouerCompetence(id)}
                          disabled={competencesPoints < 1 || pts >= 10}
                        >+</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalCompetencesDepenses > 0 && (
                <button
                  style={{ marginTop:12, width:'100%', padding:'9px', background: pepitesOr >= COUT_RESET_COMPETENCES ? 'rgba(196,48,112,0.08)' : 'rgba(212,100,138,0.04)', border:'1px solid rgba(196,48,112,0.2)', borderRadius:10, color: pepitesOr >= COUT_RESET_COMPETENCES ? '#c43070' : '#9a6080', fontSize:11, fontWeight:700, cursor: pepitesOr >= COUT_RESET_COMPETENCES ? 'pointer' : 'default', opacity: pepitesOr >= COUT_RESET_COMPETENCES ? 1 : 0.5 }}
                  onClick={reinitialiserCompetences}
                  disabled={pepitesOr < COUT_RESET_COMPETENCES}
                >
                  🔄 {lang === 'en' ? `Reset all (${COUT_RESET_COMPETENCES} Pépites)` : `Réinitialiser tout (${COUT_RESET_COMPETENCES} Pépites)`}
                  {pepitesOr < COUT_RESET_COMPETENCES && ` — ${lang === 'en' ? 'insufficient' : 'insuffisant'} (${Math.floor(pepitesOr)}/${COUT_RESET_COMPETENCES})`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:    { position:'absolute', inset:0, background:'#fdf0f5', display:'flex', flexDirection:'column', overflow:'hidden' },
  header:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'rgba(253,240,245,0.96)', backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(212,100,138,0.15)', flexShrink:0 },
  backBtn: { color:'#7a4060', fontSize:'13px', fontWeight:600, background:'none', border:'none', cursor:'pointer' },
  headerTitle: { color:'#1e0a16', fontSize:'15px', fontWeight:800 },
  tabs:    { display:'flex', borderBottom:'1px solid rgba(212,100,138,0.15)', flexShrink:0 },
  tab:     { flex:1, padding:'10px 4px', color:'#7a4060', fontSize:'12px', fontWeight:600, background:'none', border:'none', cursor:'pointer', borderBottom:'2px solid transparent' },
  tabActive: { color:'#c43070', borderBottomColor:'#c43070' },
  content: { flex:1, overflowY:'auto', padding:'12px 16px', paddingBottom:20 },
  sortBar: { display:'flex', gap:'6px', marginBottom:12 },
  sortBtn: { flex:1, padding:'5px 4px', fontSize:'10px', fontWeight:600, color:'#7a4060', background:'rgba(212,100,138,0.06)', border:'1px solid rgba(212,100,138,0.13)', borderRadius:'8px', cursor:'pointer' },
  sortBtnActive: { color:'#c43070', borderColor:'#c43070', background:'rgba(196,48,112,0.15)' },
  empty: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 0', gap:8 },
  goBtn: { marginTop:12, padding:'10px 20px', background:'#6abf44', color:'#1e0a16', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', fontSize:'13px' },
  itemRow: { display:'flex', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:'1px solid rgba(212,100,138,0.07)' },
  itemIcon: { width:40, height:40, borderRadius:8, border:'1.5px solid', background:'#ffffff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  itemInfo: { flex:1, display:'flex', flexDirection:'column', gap:'2px' },
  itemRight: { display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'3px' },
  metierCard: { background:'#ffffff', border:'1.5px solid', borderRadius:14, padding:'14px' },
  levelBadge: { border:'1px solid', borderRadius:6, padding:'2px 7px', fontSize:'10px', fontWeight:700 },
};
