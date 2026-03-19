import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useGameStore, xpRequis } from '../store/gameStore';
import { getResourceById, METIERS, MetierId } from '../data/metiers';
import { ResourceId } from '../data/resources';
import { useT } from '../utils/i18n';

type Tab = 'ressources' | 'metiers' | 'personnage';

function emojiRessource(metier: string, nom: string): string {
  const bucheron: Record<string, string> = {
    'Frêne':'🪵', 'Séquoia':'🌲', 'Chêne':'🌳', 'Bouleau':'🌿', 'Érable':'🍁',
    'Bambou':'🎋', 'Ginkgo':'🍃', 'Magnolia':'🌸', 'Cerisier Doré':'🌺', 'Sakura':'🌸',
  };
  const paysan: Record<string, string> = {
    'Blé':'🌾', 'Orge':'🌾', 'Seigle':'🌿', 'Avoine':'🌾', 'Maïs':'🌽',
    'Riz':'🍚', 'Millet':'🌾', 'Sarrasin':'🌿', 'Riz Violet':'🍚', 'Riz Sakura':'🍚',
  };
  const pecheur: Record<string, string> = {
    'Carpe Japonaise':'🐟', 'Crabe':'🦀', 'Saumon':'🐠', 'Homard':'🦞', 'Naso':'🐡',
    'Pieuvre':'🐙', 'Calmar':'🦑', 'Crevette Sakura':'🍤', 'Fugu':'🐡', 'Carpe Koï Dorée':'🐟',
  };
  const mineur: Record<string, string> = {
    'Pierre':'🪨', 'Charbon':'⬛', 'Cuivre':'🟤', 'Fer':'⚙️', 'Topaze':'💛',
    'Émeraude':'💚', 'Jade':'🟢', 'Diamant':'💎', 'Saphir Sakura':'💙', 'Cristal Koï':'🔮',
  };
  const alchimiste: Record<string, string> = {
    'Pissenlit':'🌼', 'Menthe':'🌿', 'Ortie':'🌱', 'Lavande':'💜', 'Pivoine':'🌺',
    'Wisteria':'🪻', 'Chrysanthème':'🌸', 'Ginseng':'🫚', 'Fleur de Lotus Sakura':'🪷', 'Herbe Koï':'🌿',
  };
  const map: Record<string, Record<string, string>> = { bucheron, paysan, pecheur, mineur, alchimiste };
  return map[metier]?.[nom] ?? '📦';
}
type SortMode = 'quantite' | 'categorie';

const METIER_CONFIG: Record<MetierId, { icon: string; color: string }> = {
  bucheron:   { icon: '🪓', color: '#6abf44' },
  paysan:     { icon: '🌾', color: '#f9a825' },
  pecheur:    { icon: '🎣', color: '#29b6f6' },
  mineur:     { icon: '⛏️', color: '#8d6e63' },
  alchimiste: { icon: '🌿', color: '#ab47bc' },
};

export function MaisonPage() {
  const navigate    = useNavigate();
  const { address } = useAccount();
  const [tab, setTab]   = useState<Tab>('ressources');
  const [sort, setSort] = useState<SortMode>('quantite');
  const inventaire  = useGameStore(s => s.inventaire);
  const metiers     = useGameStore(s => s.metiers);
  const { t } = useT();

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';

  const items = (Object.entries(inventaire) as [string, number][])
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ id: Number(id) as ResourceId, qty, res: getResourceById(Number(id) as ResourceId) }))
    .filter(i => i.res != null);

  const sorted = [...items].sort((a, b) => {
    if (sort === 'quantite') return b.qty - a.qty;
    return a.res!.metier < b.res!.metier ? -1 : a.res!.metier > b.res!.metier ? 1 : 0;
  });

  const totalItems = parseFloat(items.reduce((acc, i) => acc + i.qty, 0).toFixed(2));

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
              sorted.map(({ id, qty, res }) => {
                return (
                  <div key={id} style={s.itemRow}>
                    <div style={{ ...s.itemIcon, borderColor: '#d4648a' }}>
                      <span style={{ fontSize:'20px' }}>{emojiRessource(res!.metier, res!.nom)}</span>
                    </div>
                    <div style={s.itemInfo}>
                      <span style={{ color:'#1e0a16', fontSize:'13px', fontWeight:600 }}>{res!.nom}</span>
                      <span style={{ color:'#7a4060', fontSize:'10px' }}>{METIER_CONFIG[res!.metier].icon} {METIERS[res!.metier].nom}</span>
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
              return (
                <div key={id} style={{ ...s.metierCard, borderColor: `${cfg.color}44` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
                    <span style={{ fontSize:'28px', filter:`drop-shadow(0 0 5px ${cfg.color}66)` }}>{cfg.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ color:'#1e0a16', fontSize:'14px', fontWeight:800 }}>{METIERS[id].nom}</span>
                        <span style={{ ...s.levelBadge, borderColor: cfg.color, color: cfg.color }}>{t('maison.level')} {p.niveau}</span>
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
          <div style={s.empty}>
            <span style={{ fontSize:'50px' }}>👗</span>
            <p style={{ color:'#1e0a16', fontSize:'15px', fontWeight:700, marginTop:12 }}>{t('maison.perso_title')}</p>
            <p style={{ color:'#7a4060', fontSize:'12px', marginTop:6, textAlign:'center', maxWidth:240 }}>{t('maison.perso_desc')}</p>
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
