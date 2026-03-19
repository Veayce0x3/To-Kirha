import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { SettingsModal } from '../components/SettingsModal';
import { useT } from '../utils/i18n';

export function HomePage() {
  const navigate   = useNavigate();
  const soldeKirha = useGameStore(s => s.soldeKirha);
  const pepitesOr  = useGameStore(s => s.pepitesOr);
  const pseudo     = useGameStore(s => s.pseudo);
  const villeId    = useGameStore(s => s.villeId);
  const vipExpiry  = useGameStore(s => s.vipExpiry);
  const [showSettings, setShowSettings] = useState(false);
  const { t } = useT();

  const isVip = vipExpiry > 0 && vipExpiry > Math.floor(Date.now() / 1000);

  const CARDS = [
    { route: '/recolte', icon: '🌿', label: t('home.card_recolte'),  desc: t('home.card_recolte_desc'), color: '#6abf44' },
    { route: '/hdv',     icon: '🏪', label: t('home.card_hdv'),      desc: t('home.card_hdv_desc'),     color: '#f9a825' },
    { route: '/banque',  icon: '🏦', label: t('home.card_banque'),   desc: t('home.card_banque_desc'),  color: '#8a25d4' },
    { route: '/maison',  icon: '🏠', label: t('home.card_maison'),   desc: t('home.card_maison_desc'),  color: '#c43070' },
    { route: '/craft',   icon: '⚗️', label: t('home.card_craft'),    desc: t('home.card_craft_desc'),   color: '#8d6e63' },
    { route: '/temple',  icon: '⛩️', label: t('home.card_temple'),   desc: t('home.card_temple_desc'),  color: '#c4306e' },
  ] as const;

  return (
    <div style={s.page}>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* TopBar */}
      <div style={s.topbar}>
        <div style={s.logoRow}>
          <span style={s.logoIcon}>🌸</span>
          <span style={s.logoTitle}>To-Kirha</span>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ color:'#1e0a16', fontSize:'13px', fontWeight:800 }}>{pseudo ?? '—'}</span>
              {isVip && (
                <span style={{ background:'linear-gradient(135deg,#f9a825,#c43070)', color:'#fff', fontSize:'8px', fontWeight:800, padding:'1px 5px', borderRadius:6 }}>VIP ✨</span>
              )}
            </div>
            <span style={{ color:'#9a6080', fontSize:'9px' }}>
              {villeId ? `Ville #${villeId}` : '…'}
            </span>
          </div>
          <button style={s.settingsBtn} onClick={() => setShowSettings(true)}>⚙️</button>
        </div>
      </div>

      {/* Soldes */}
      <div style={s.soldesRow}>
        <div style={s.soldeItem}>
          <span style={s.soldeIcon}>🪙</span>
          <span style={s.soldeLabel}>{t('home.pepites')}</span>
          <span style={s.soldeValue}>{pepitesOr > 0 ? pepitesOr.toFixed(0) : '—'}</span>
        </div>
        <div style={s.soldeDivider} />
        <div style={s.soldeItem}>
          <span style={s.soldeIcon}>💠</span>
          <span style={s.soldeLabel}>$KIRHA</span>
          <span style={s.soldeValue}>{soldeKirha > 0 ? soldeKirha.toFixed(4) : '—'}</span>
        </div>
      </div>

      {/* Cards */}
      <div style={s.cardGrid}>
        {CARDS.map(card => (
          <button key={card.route} style={{ ...s.card, borderColor: `${card.color}44` }} onClick={() => navigate(card.route)}>
            <div style={{ ...s.cardGlow, background: `radial-gradient(ellipse at top left, ${card.color}18, transparent 70%)` }} />
            <div style={s.cardTop}>
              <span style={{ ...s.cardIcon, filter: `drop-shadow(0 0 8px ${card.color}88)` }}>{card.icon}</span>
            </div>
            <span style={{ ...s.cardLabel, color: card.color }}>{card.label}</span>
            <span style={s.cardDesc}>{card.desc}</span>
            <span style={{ ...s.cardArrow, color: card.color }}>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    position:'absolute', inset:0, background:'#fdf0f5',
    overflowY:'auto', paddingBottom:20,
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
  settingsBtn: { color:'#7a4060', fontSize:'15px', border:'1px solid rgba(212,100,138,0.18)', borderRadius:'8px', padding:'3px 7px', background:'rgba(212,100,138,0.06)', cursor:'pointer' },
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
    borderRadius:18, padding:'18px 14px 14px',
    display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'4px',
    cursor:'pointer', textAlign:'left',
  },
  cardGlow: { position:'absolute', inset:0, pointerEvents:'none' },
  cardTop: { display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' },
  cardIcon: { fontSize:'32px', lineHeight:1 },
  cardLabel: { fontSize:'15px', fontWeight:800, marginTop:'4px' },
  cardDesc: { color:'#7a4060', fontSize:'10px', lineHeight:1.4 },
  cardArrow: { fontSize:'16px', marginTop:'4px', alignSelf:'flex-end' },
};
