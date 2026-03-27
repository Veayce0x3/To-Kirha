import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useGameStore, xpRequis, xpRequisPersonage } from '../store/gameStore';
import { METIERS, MetierId } from '../data/metiers';
import { ResourceId } from '../data/resources';
import { useT } from '../utils/i18n';
import { getNomRessource, metierIconPath } from '../utils/resourceUtils';
import { ResourceIcon } from '../components/ResourceIcon';
import { getResourceById } from '../data/metiers';
import { MEUBLES, calculerBonusMeubles, getMetierBonusMeuble } from '../data/meubles';
import { calculerBonus } from '../data/vetements';
import { getSaisonActuelle } from '../data/saisons';

type Tab = 'ressources' | 'metiers' | 'personnage' | 'meubles' | 'efficacite';
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
  const meubles_poses  = useGameStore(s => s.meubles_poses);
  const artefacts      = useGameStore(s => s.artefacts);
  const equipement     = useGameStore(s => s.equipement);
  const activeBuffs    = useGameStore(s => s.activeBuffs);
  const prestige       = useGameStore(s => s.prestige);
  const vipExpiry      = useGameStore(s => s.vipExpiry);
  const poserMeuble    = useGameStore(s => s.poserMeuble);
  const retirerMeuble  = useGameStore(s => s.retirerMeuble);

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

  const xpRequisNiveau = personageNiveau < 100 ? xpRequisPersonage(personageNiveau) : 1;
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
        {([['ressources', `${t('maison.tab_res')}${totalItems > 0 ? ` (${totalItems})` : ''}`], ['metiers', t('maison.tab_metiers')], ['personnage', t('maison.tab_perso')], ['meubles', lang === 'en' ? '🏠 Furn.' : '🏠 Meubles'], ['efficacite', lang === 'en' ? '📊 Stats' : '📊 Stats']] as [Tab, string][]).map(([tabId, label]) => (
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
                      <ResourceIcon id={id} type="inventory" size={24} />
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
                    {metierIconPath(id)
                      ? <img src={metierIconPath(id)!} alt="" style={{ width:40, height:40, objectFit:'contain', filter:`drop-shadow(0 0 6px ${cfg.color}88)`, flexShrink:0 }} />
                      : <span style={{ fontSize:'28px', filter:`drop-shadow(0 0 5px ${cfg.color}66)` }}>{cfg.icon}</span>
                    }
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

        {/* ── Meubles ── */}
        {tab === 'meubles' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'0 0 6px', letterSpacing:'0.05em' }}>
              {lang === 'en' ? 'CRAFTABLE FURNITURE (one of each max)' : 'MEUBLES CRAFTABLES (un seul de chaque)'}
            </p>
            {MEUBLES.filter(m => !m.isArtefact).map(m => {
              const inInventory = Math.floor((inventaire[m.id as ResourceId] ?? 0));
              const isPlaced    = meubles_poses.includes(m.id);
              const bonusLabel  = m.bonus.type === 'eau_par_jour'
                ? `+${m.bonus.valeur} Eau/jour`
                : m.bonus.type === 'cooldown_animaux_pct'
                ? `-${m.bonus.valeur}% cooldown animaux`
                : `+${m.bonus.valeur}% quantité`;
              return (
                <div key={m.id} style={{ background:'#fff', border:`1.5px solid ${isPlaced ? 'rgba(106,191,68,0.4)' : 'rgba(212,100,138,0.13)'}`, borderRadius:14, padding:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:28 }}>{m.emoji}</span>
                    <div style={{ flex:1 }}>
                      <span style={{ color:'#1e0a16', fontSize:13, fontWeight:800, display:'block' }}>{lang === 'en' ? m.nomEn : m.nom}</span>
                      <span style={{ color:'#4a8f2a', fontSize:10, fontWeight:700 }}>{bonusLabel}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                      {isPlaced && <span style={{ background:'rgba(106,191,68,0.15)', color:'#2a7a10', fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:8 }}>✅ {lang === 'en' ? 'Placed' : 'Posé'}</span>}
                      <span style={{ color:'#7a4060', fontSize:10 }}>×{inInventory} {lang === 'en' ? 'in bag' : 'en sac'}</span>
                    </div>
                  </div>
                  <p style={{ color:'#9a6080', fontSize:10, margin:'0 0 8px' }}>{m.description}</p>
                  {isPlaced ? (
                    <button style={{ width:'100%', padding:'8px', background:'rgba(196,48,112,0.08)', border:'1px solid rgba(196,48,112,0.2)', borderRadius:10, color:'#c43070', fontSize:11, fontWeight:700, cursor:'pointer' }} onClick={() => retirerMeuble(m.id)}>
                      🔄 {lang === 'en' ? 'Remove (returns to bag)' : 'Retirer (retourne en sac)'}
                    </button>
                  ) : (
                    <button style={{ width:'100%', padding:'8px', background: inInventory >= 1 ? 'linear-gradient(135deg,#6abf44,#3a7a10)' : 'rgba(106,191,68,0.06)', border: inInventory >= 1 ? 'none' : '1px solid rgba(106,191,68,0.2)', borderRadius:10, color: inInventory >= 1 ? '#fff' : '#9a6080', fontSize:11, fontWeight:700, cursor: inInventory >= 1 ? 'pointer' : 'default', opacity: inInventory >= 1 ? 1 : 0.5 }} disabled={inInventory < 1} onClick={() => poserMeuble(m.id)}>
                      {inInventory >= 1 ? `🏠 ${lang === 'en' ? 'Place' : 'Poser'}` : lang === 'en' ? 'Not in inventory' : 'Pas en inventaire'}
                    </button>
                  )}
                </div>
              );
            })}

            {/* Artefacts meubles */}
            {MEUBLES.filter(m => m.isArtefact && artefacts[m.id]).length > 0 && (
              <>
                <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'8px 0 6px', letterSpacing:'0.05em' }}>
                  {lang === 'en' ? 'ARTEFACT FURNITURE' : 'MEUBLES ARTEFACTS'}
                </p>
                {MEUBLES.filter(m => m.isArtefact && artefacts[m.id]).map(m => {
                  const isPlaced = meubles_poses.includes(m.id);
                  const acquis   = artefacts[m.id];
                  const echangeableLe = acquis ? acquis.acquis_le + 90 * 24 * 3600 : 0;
                  const nowSec = Math.floor(Date.now() / 1000);
                  return (
                    <div key={m.id} style={{ background:'linear-gradient(135deg,#fff9e6,#fff)', border:`1.5px solid ${isPlaced ? 'rgba(106,191,68,0.4)' : 'rgba(212,170,50,0.4)'}`, borderRadius:14, padding:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                        <span style={{ fontSize:28 }}>{m.emoji}</span>
                        <div style={{ flex:1 }}>
                          <span style={{ color:'#1e0a16', fontSize:13, fontWeight:800, display:'block' }}>{lang === 'en' ? m.nomEn : m.nom}</span>
                          <span style={{ color:'#b07010', fontSize:9, fontWeight:700 }}>🏆 Artefact · max {m.maxSupply}</span>
                        </div>
                        {isPlaced && <span style={{ background:'rgba(106,191,68,0.15)', color:'#2a7a10', fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:8 }}>✅ {lang === 'en' ? 'Placed' : 'Posé'}</span>}
                      </div>
                      <p style={{ color:'#9a6080', fontSize:10, margin:'0 0 4px' }}>{m.description}</p>
                      <p style={{ color: nowSec >= echangeableLe ? '#2a7a10' : '#9a6080', fontSize:9, margin:'0 0 8px', fontStyle:'italic' }}>
                        {nowSec >= echangeableLe
                          ? (lang === 'en' ? '✅ Tradeable on HDV' : '✅ Échangeable sur le HDV')
                          : (lang === 'en' ? `🔒 Tradeable in ${Math.ceil((echangeableLe - nowSec) / 86400)}d` : `🔒 Échangeable dans ${Math.ceil((echangeableLe - nowSec) / 86400)}j`)}
                      </p>
                      {isPlaced
                        ? <button style={{ width:'100%', padding:'8px', background:'rgba(196,48,112,0.08)', border:'1px solid rgba(196,48,112,0.2)', borderRadius:10, color:'#c43070', fontSize:11, fontWeight:700, cursor:'pointer' }} onClick={() => retirerMeuble(m.id)}>🔄 {lang === 'en' ? 'Remove' : 'Retirer'}</button>
                        : <button style={{ width:'100%', padding:'8px', background:'linear-gradient(135deg,#f9a825,#b07010)', border:'none', borderRadius:10, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }} onClick={() => poserMeuble(m.id)}>🏠 {lang === 'en' ? 'Place' : 'Poser'}</button>
                      }
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── Efficacité ── */}
        {tab === 'efficacite' && (() => {
          const METIER_IDS_LIST = ['bucheron', 'paysan', 'pecheur', 'mineur', 'alchimiste'] as const;
          const bonusVet    = calculerBonus(equipement);
          const bonusMeuble = calculerBonusMeubles(meubles_poses);
          const saison      = getSaisonActuelle();
          const isVip       = vipExpiry > 0 && vipExpiry > Math.floor(Date.now() / 1000);
          const now         = Date.now();
          const validBuffs  = activeBuffs.filter(b => b.expiresAt > now);
          const buffQtyTotal = validBuffs.reduce((s, b) => s + b.bonusPercent, 0);
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'0 0 2px', letterSpacing:'0.05em' }}>
                {lang === 'en' ? 'HARVEST YIELD BY PROFESSION' : 'RENDEMENT PAR MÉTIER'}
              </p>
              {METIER_IDS_LIST.map(mid => {
                const cfg        = METIER_CONFIG[mid];
                const compBonus  = (competences[mid] ?? 0) * 5;
                const prestigeB  = (prestige[mid] ?? 0) * 5;
                const meubleB    = getMetierBonusMeuble(mid, bonusMeuble);
                const saisonB    = saison.id === mid ? saison.bonusQty + (isVip ? 10 : 0) : 0;
                const meubleQtyS = saison.id === mid ? bonusMeuble.qty_saison : 0;
                const vetQty     = bonusVet.qty_recolte ?? 0;
                const total      = compBonus + prestigeB + meubleB + meubleQtyS + saisonB + buffQtyTotal + vetQty;
                return (
                  <div key={mid} style={{ background:'#fff', border:`1.5px solid ${cfg.color}33`, borderRadius:12, padding:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <span style={{ fontSize:20 }}>{cfg.icon}</span>
                      <span style={{ color:'#1e0a16', fontSize:13, fontWeight:800, flex:1 }}>{METIERS[mid].nom}</span>
                      <span style={{ color: total > 0 ? '#2a7a10' : '#9a6080', fontSize:14, fontWeight:900 }}>+{total}%</span>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px' }}>
                      {compBonus > 0    && <span style={{ color:'#5a9a30', fontSize:9, fontWeight:600 }}>⚡ Compétences +{compBonus}%</span>}
                      {prestigeB > 0    && <span style={{ color:'#9a5a10', fontSize:9, fontWeight:600 }}>🌟 Prestige +{prestigeB}%</span>}
                      {meubleB > 0      && <span style={{ color:'#4a7a20', fontSize:9, fontWeight:600 }}>🏠 Meubles +{meubleB}%</span>}
                      {meubleQtyS > 0   && <span style={{ color:'#4a7a20', fontSize:9, fontWeight:600 }}>🌸 Artefact saison +{meubleQtyS}%</span>}
                      {saisonB > 0      && <span style={{ color:'#ff9800', fontSize:9, fontWeight:600 }}>{saison.emoji} Saison +{saisonB}%{isVip ? ' (VIP)' : ''}</span>}
                      {buffQtyTotal > 0 && <span style={{ color:'#7030b0', fontSize:9, fontWeight:600 }}>🧪 Potion +{buffQtyTotal}%</span>}
                      {vetQty > 0       && <span style={{ color:'#c43070', fontSize:9, fontWeight:600 }}>👘 Vêtement +{vetQty}%</span>}
                      {total === 0      && <span style={{ color:'#9a6080', fontSize:9 }}>{lang === 'en' ? 'No active bonus' : 'Aucun bonus actif'}</span>}
                    </div>
                  </div>
                );
              })}

              <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'6px 0 2px', letterSpacing:'0.05em' }}>
                {lang === 'en' ? 'FARM BONUSES' : 'BONUS FERME'}
              </p>
              <div style={{ background:'#fff', border:'1.5px solid rgba(41,182,246,0.25)', borderRadius:12, padding:12, display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'#1e0a16', fontSize:12, fontWeight:700 }}>💧 {lang === 'en' ? 'Water/day (Well)' : 'Eau/jour (Puits)'}</span>
                  <span style={{ color:'#29b6f6', fontSize:12, fontWeight:800 }}>1 + {bonusMeuble.eau_par_jour} = {1 + bonusMeuble.eau_par_jour}/j</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'#1e0a16', fontSize:12, fontWeight:700 }}>🐔 {lang === 'en' ? 'Animal cooldown' : 'Recharge animaux'}</span>
                  <span style={{ color: bonusMeuble.cooldown_animaux_pct > 0 ? '#2a7a10' : '#9a6080', fontSize:12, fontWeight:800 }}>-{bonusMeuble.cooldown_animaux_pct}%</span>
                </div>
              </div>

              <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'6px 0 2px', letterSpacing:'0.05em' }}>
                {lang === 'en' ? 'EQUIPPED BONUSES' : 'BONUS ÉQUIPEMENT'}
              </p>
              <div style={{ background:'#fff', border:'1.5px solid rgba(196,48,112,0.15)', borderRadius:12, padding:12, display:'flex', flexDirection:'column', gap:5 }}>
                {bonusVet.vitesse_recolte > 0 && <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#1e0a16', fontSize:11 }}>⏱️ {lang === 'en' ? 'Speed' : 'Vitesse récolte'}</span><span style={{ color:'#2a7a10', fontSize:11, fontWeight:700 }}>-{bonusVet.vitesse_recolte}%</span></div>}
                {bonusVet.xp_bonus > 0       && <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#1e0a16', fontSize:11 }}>✨ XP Bonus</span><span style={{ color:'#c43070', fontSize:11, fontWeight:700 }}>+{bonusVet.xp_bonus}%</span></div>}
                {bonusVet.qty_recolte > 0    && <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#1e0a16', fontSize:11 }}>📦 {lang === 'en' ? 'Harvest Qty' : 'Qté récolte'}</span><span style={{ color:'#2a7a10', fontSize:11, fontWeight:700 }}>+{bonusVet.qty_recolte}%</span></div>}
                {bonusVet.slots_bonus > 0    && <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#1e0a16', fontSize:11 }}>🎒 Slots</span><span style={{ color:'#9a5a10', fontSize:11, fontWeight:700 }}>+{bonusVet.slots_bonus}</span></div>}
                {bonusVet.vitesse_recolte === 0 && bonusVet.xp_bonus === 0 && bonusVet.qty_recolte === 0 && bonusVet.slots_bonus === 0 && (
                  <span style={{ color:'#9a6080', fontSize:10 }}>{lang === 'en' ? 'No equipment' : 'Aucun équipement'}</span>
                )}
              </div>

              {validBuffs.length > 0 && (
                <>
                  <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'6px 0 2px', letterSpacing:'0.05em' }}>BUFFS ACTIFS</p>
                  <div style={{ background:'#fff', border:'1.5px solid rgba(171,71,188,0.25)', borderRadius:12, padding:12, display:'flex', flexDirection:'column', gap:5 }}>
                    {validBuffs.map(b => {
                      const remaining = Math.ceil((b.expiresAt - now) / 60000);
                      return (
                        <div key={b.type} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ color:'#7030b0', fontSize:11 }}>🧪 +{b.bonusPercent}% {lang === 'en' ? 'harvest qty' : 'qté récolte'}</span>
                          <span style={{ color:'#7030b0', fontSize:10, fontFamily:'monospace' }}>{remaining}min</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })()}
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
