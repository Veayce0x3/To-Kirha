import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicClient } from 'wagmi';
import { useGameStore } from '../store/gameStore';
import { SettingsModal } from '../components/SettingsModal';
import { useT } from '../utils/i18n';
import { uiAssetPath } from '../utils/resourceUtils';
import { KIRHA_GAME_ADDRESS } from '../contracts/addresses';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';
import { useMarket } from '../hooks/useMarket';

export function HomePage() {
  const navigate   = useNavigate();
  const soldeKirha = useGameStore(s => s.soldeKirha);
  const pepitesOr  = useGameStore(s => s.pepitesOr);
  const pseudo     = useGameStore(s => s.pseudo);
  const villeId    = useGameStore(s => s.villeId);
  const vipExpiry  = useGameStore(s => s.vipExpiry);
  const [showSettings, setShowSettings] = useState(false);
  const [showVipInfo, setShowVipInfo] = useState(false);
  const [showRelayer, setShowRelayer] = useState(false);
  const { t, lang } = useT();

  const publicClient = usePublicClient();
  const { activerRelayer, status: marketStatus, error: relayerHookError, relayerWcHint } = useMarket();

  // Vérifier si le relayer est actif — proposer l'activation si non
  useEffect(() => {
    if (!villeId || villeId === '0' || !publicClient) return;
    const key = `kirha_relayer_checked_${villeId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    (async () => {
      try {
        const active = await publicClient.readContract({
          address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi,
          functionName: 'isRelayerActive', args: [BigInt(villeId)],
        }) as boolean;
        if (!active) setShowRelayer(true);
      } catch {}
    })();
  }, [villeId, publicClient]);

  async function handleActiverRelayer() {
    if (!villeId) return;
    const ok = await activerRelayer();
    if (ok) setShowRelayer(false);
  }

  const relayerSigning = marketStatus === 'listing';

  const isVip = vipExpiry > 0 && vipExpiry > Math.floor(Date.now() / 1000);

  const CARDS = [
    { route: '/recolte', icon: '🌿', imgSrc: 'ui/pages/recolte.png',     label: t('home.card_recolte'),  desc: t('home.card_recolte_desc'), color: '#6abf44', locked: false },
    { route: '/hdv',     icon: '🏪', imgSrc: 'ui/pages/hdv.png',         label: t('home.card_hdv'),      desc: t('home.card_hdv_desc'),     color: '#f9a825', locked: false },
    { route: '/banque',  icon: '🏦', imgSrc: 'ui/pages/banque.png',      label: t('home.card_banque'),   desc: t('home.card_banque_desc'),  color: '#8a25d4', locked: false },
    { route: '/maison',  icon: '🏠', imgSrc: 'ui/pages/maison.png',      label: t('home.card_maison'),   desc: t('home.card_maison_desc'),  color: '#c43070', locked: false },
    { route: '/craft',   icon: '⚗️', imgSrc: 'ui/pages/craft.png',       label: t('home.card_craft'),    desc: t('home.card_craft_desc'),   color: '#8d6e63', locked: false },
    { route: '/temple',  icon: '⛩️', imgSrc: 'ui/pages/temple.png',      label: t('home.card_temple'),   desc: t('home.card_temple_desc'),  color: '#c4306e', locked: false },
    { route: '/ferme',   icon: '🌾', imgSrc: 'ui/pages/ferme.png',       label: t('home.card_ferme'),    desc: t('home.card_ferme_desc'),   color: '#a0522d', locked: false },
    { route: '/enchere', icon: '🏆', imgSrc: '',                          label: lang === 'en' ? 'Auctions' : 'Enchères', desc: '', color: '#8a25d4', locked: false },
  ];

  return (
    <div style={s.page}>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showRelayer && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#fdf0f5', borderRadius:18, padding:'28px 24px', width:'100%', maxWidth:320, display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
            <span style={{ fontSize:44 }}>⚡</span>
            <h2 style={{ color:'#1e0a16', fontSize:20, fontWeight:800, margin:0 }}>Transactions sans frais</h2>
            <p style={{ color:'#7a4060', fontSize:13, textAlign:'center', lineHeight:1.6, margin:0 }}>
              Autorise le relayer jusqu'à <strong>minuit</strong> (heure française) pour que toutes tes actions en jeu (récolte, marché, sauvegarde) se fassent <strong>sans popup wallet</strong> et sans gas.
            </p>
            <div style={{ background:'rgba(196,48,112,0.06)', border:'1px solid rgba(196,48,112,0.15)', borderRadius:12, padding:'12px 16px', width:'100%', boxSizing:'border-box' as const }}>
              <p style={{ color:'#7a4060', fontSize:11, margin:0, lineHeight:1.6 }}>
                ✅ Une seule signature requise<br/>
                ✅ Gratuit (le relayer paie le gas)<br/>
                ✅ Expire automatiquement à minuit (heure française)
              </p>
            </div>
            {relayerHookError && <p style={{ color:'#c43070', fontSize:11, margin:0 }}>{relayerHookError}</p>}
            {relayerWcHint && (
              <p style={{ color:'#f9a825', fontSize:12, margin:0, textAlign:'center', lineHeight:1.45, fontWeight:600 }}>
                {relayerWcHint}
              </p>
            )}
            <button
              onClick={handleActiverRelayer}
              disabled={relayerSigning}
              style={{ width:'100%', padding:'13px 0', background:'#c43070', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', opacity: relayerSigning ? 0.6 : 1 }}
            >
              {relayerSigning ? '⏳ Signature…' : relayerWcHint ? '⚡ Signer la transaction' : '⚡ Activer jusqu\'à minuit'}
            </button>
            <button onClick={() => setShowRelayer(false)} style={{ background:'none', border:'none', color:'#7a4060', fontSize:13, cursor:'pointer', textDecoration:'underline' }}>
              Passer (utiliser le wallet directement)
            </button>
          </div>
        </div>
      )}
      {showVipInfo && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setShowVipInfo(false)}>
          <div style={{ background:'#fdf0f5', borderRadius:18, padding:'24px 20px', width:'100%', maxWidth:300 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <img src={uiAssetPath('ui/vip.png')} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <p style={{ color:'#f9a825', fontSize:'18px', fontWeight:800, margin:0 }}>VIP Actif</p>
            </div>
            <p style={{ color:'#7a4060', fontSize:'12px', margin:'0 0 16px' }}>Taxe HDV réduite : 25% (au lieu de 50%)</p>
            <p style={{ color:'#1e0a16', fontSize:'13px', fontWeight:700, margin:0 }}>Expire le {new Date(vipExpiry * 1000).toLocaleDateString('fr-FR')}</p>
            <button style={{ marginTop:16, width:'100%', padding:'10px', borderRadius:12, background:'rgba(249,168,37,0.15)', border:'1px solid rgba(249,168,37,0.3)', color:'#f9a825', fontWeight:700, cursor:'pointer' }} onClick={() => { setShowVipInfo(false); navigate('/banque'); }}>Prolonger le VIP</button>
          </div>
        </div>
      )}

      {/* TopBar */}
      <div style={s.topbar}>
        <div style={s.logoRow}>
          <img src={uiAssetPath('ui/logo.jpg')} alt="To-Kirha" style={{ height: 36, objectFit: 'contain' }} />
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ color:'#1e0a16', fontSize:'13px', fontWeight:800 }}>{pseudo ?? '—'}</span>
            </div>
            <span style={{ color:'#9a6080', fontSize:'9px' }}>
              {villeId ? `Ville #${villeId}` : '…'}
            </span>
          </div>
          <button style={s.settingsBtn} onClick={() => setShowSettings(true)}>
            <img src={uiAssetPath('ui/parametre.png')} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          </button>
        </div>
      </div>

      {/* Soldes */}
      <div style={s.soldesRow}>
        <div style={s.soldeItem}>
          <img src={uiAssetPath('ui/pepites/50.png')} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
          <span style={s.soldeValue}>{pepitesOr > 0 ? pepitesOr.toFixed(0) : '—'}</span>
        </div>
        <div style={s.soldeDivider} />
        <div style={s.soldeItem}>
          <img src={uiAssetPath('ui/token.png')} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
          <span style={s.soldeValue}>{soldeKirha > 0 ? soldeKirha.toFixed(4) : '—'}</span>
        </div>
        <div style={s.soldeDivider} />
        <button
          style={{ ...s.soldeItem, cursor:'pointer', background:'none', border:'none' }}
          onClick={() => isVip ? setShowVipInfo(true) : navigate('/banque')}
        >
          <img src={uiAssetPath('ui/vip.png')} alt="" style={{ width: 32, height: 32, objectFit: 'contain', filter: isVip ? 'none' : 'grayscale(1) opacity(0.4)' }} />
        </button>
      </div>

      {/* Cards */}
      <div style={s.cardGrid} className="home-card-grid">
        {CARDS.map(card => (
          <button key={card.route} style={{ ...s.card, borderColor: `${card.color}33`, opacity: card.locked ? 0.55 : 1, cursor: card.locked ? 'default' : 'pointer' }} onClick={() => !card.locked && navigate(card.route)}>
            <div style={s.cardTop}>
              {card.imgSrc
                ? <img src={uiAssetPath(card.imgSrc)} alt="" style={{ width: 110, height: 110, objectFit: 'contain' }} />
                : <span style={{ ...s.cardIcon }}>{card.icon}</span>
              }
              {card.locked && <span style={{ fontSize:12, position:'absolute', top:10, right:10 }}>🔒</span>}
            </div>
            <span style={{ ...s.cardLabel, color: card.color }}>{card.locked ? 'Bientôt disponible' : card.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    position:'absolute', inset:0, background:'#fdf0f5',
    overflowY:'auto', paddingBottom:90,
  },
  topbar: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 16px 10px',
    borderBottom:'1px solid rgba(212,100,138,0.15)',
    background:'rgba(253,240,245,0.96)', backdropFilter:'blur(8px)',
    position:'sticky', top:0, zIndex:10,
  },
  logoRow: { display:'flex', alignItems:'center', gap:'8px' },
  logoIcon: { fontSize:'22px' },
  logoTitle: { color:'#1e0a16', fontSize:'18px', fontWeight:900, letterSpacing:'1px' },
  addressPill: { color:'#7a4060', fontSize:'11px', fontFamily:'monospace', background:'rgba(212,100,138,0.07)', padding:'3px 8px', borderRadius:8, border:'1px solid rgba(212,100,138,0.13)' },
  settingsBtn: { color:'#7a4060', fontSize:'15px', border:'1px solid rgba(212,100,138,0.18)', borderRadius:'8px', padding:'6px 8px', background:'rgba(212,100,138,0.06)', cursor:'pointer', lineHeight:0 },
  soldesRow: {
    display:'flex', alignItems:'center', justifyContent:'center',
    gap:0, padding:'10px 16px 0',
    background:'#ffffff', border:'1px solid rgba(212,100,138,0.15)',
    borderRadius:12, margin:'12px 16px 0',
  },
  soldeItem: {
    display:'flex', alignItems:'center', gap:'8px',
    flex:1, justifyContent:'center', padding:'8px 0',
  },
  soldeDivider: {
    width:1, height:24, background:'rgba(212,100,138,0.15)',
  },
  soldeIcon: { fontSize:'16px' },
  soldeLabel: { color:'#7a4060', fontSize:'12px', fontWeight:600 },
  soldeValue: { color:'#1e0a16', fontSize:'14px', fontWeight:800 },
  cardGrid: {
    display:'grid', gridTemplateColumns:'1fr 1fr',
    gap:'12px', padding:'14px 16px',
  },
  card: {
    position:'relative', overflow:'hidden',
    background:'#ffffff', border:'1px solid',
    borderRadius:18, padding:'14px 10px 14px',
    display:'flex', flexDirection:'column', alignItems:'center', gap:'6px',
    cursor:'pointer', textAlign:'center',
  },
  cardTop: { display:'flex', alignItems:'center', justifyContent:'center', width:'100%' },
  cardIcon: { fontSize:'48px', lineHeight:1 },
  cardLabel: { fontSize:'13px', fontWeight:800, marginTop:'2px' },
};
