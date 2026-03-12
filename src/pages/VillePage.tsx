import { useNavigate } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { useGameStore, xpRequis } from '../store/gameStore';
import { METIERS, MetierId } from '../data/metiers';
import { useSave } from '../hooks/useSave';

// ============================================================
// Config visuelle par métier
// ============================================================

const METIER_CONFIG: Record<MetierId, {
  emoji: string; couleur: string; description: string; route: string; debloque: boolean;
}> = {
  bucheron:   { emoji: '🌲', couleur: '#6abf44', description: 'Bois & arbres rares',   route: '/bucheron', debloque: true  },
  paysan:     { emoji: '🌾', couleur: '#f9a825', description: 'Céréales & grains',      route: '/paysan',   debloque: false },
  pecheur:    { emoji: '🎣', couleur: '#29b6f6', description: 'Poissons & crustacés',   route: '/pecheur',  debloque: false },
  mineur:     { emoji: '⛏️', couleur: '#8d6e63', description: 'Minerais & gemmes',      route: '/mineur',   debloque: false },
  alchimiste: { emoji: '🌿', couleur: '#ab47bc', description: 'Plantes & herbes rares', route: '/alchimiste', debloque: false },
};

export function VillePage() {
  const navigate  = useNavigate();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const metiersState = useGameStore(s => s.metiers);
  const { sauvegarder, status: saveStatus, pendingCount } = useSave();

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';

  return (
    <div style={s.page}>

      {/* ── TopBar ─────────────────────────────────────────── */}
      <div style={s.topbar}>
        <div style={s.pill}>
          <div style={s.dot} />
          <span style={s.pillText}>{short}</span>
        </div>
        <span style={s.cityName}>🏯 To-Kirha</span>
        <button style={s.decoBtn} onClick={() => disconnect()}>Déco</button>
      </div>

      <div style={s.scroll}>

        {/* ── Bannière sauvegarde ───────────────────────────── */}
        {pendingCount > 0 && (
          <button
            style={{ ...s.saveBanner, ...(saveStatus === 'success' ? s.saveBannerOk : {}) }}
            onClick={sauvegarder}
            disabled={saveStatus === 'pending' || saveStatus === 'signing'}
          >
            <span>{saveStatus === 'pending' ? '⏳' : saveStatus === 'success' ? '✅' : '💾'}</span>
            <span style={{ flex: 1, textAlign: 'left', color: '#8aaa70', fontSize: '13px' }}>
              {saveStatus === 'pending'
                ? 'Sauvegarde en cours…'
                : `${pendingCount} ressource${pendingCount > 1 ? 's' : ''} à sauvegarder`}
            </span>
            {saveStatus !== 'pending' && <span style={{ color: '#6abf44', fontSize: '12px', fontWeight: 700 }}>Sauvegarder →</span>}
          </button>
        )}

        {/* ── Ateliers ──────────────────────────────────────── */}
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Ateliers</span>
          <span style={s.sectionSub}>Choisissez votre métier</span>
        </div>

        <div style={s.grid}>
          {(Object.keys(METIER_CONFIG) as MetierId[]).map(id => {
            const cfg      = METIER_CONFIG[id];
            const progress = metiersState[id];
            const xp_max   = xpRequis(progress.niveau);
            const xp_pct   = Math.min(progress.xp / xp_max, 1) * 100;

            return (
              <button
                key={id}
                style={{
                  ...s.card,
                  borderColor: cfg.debloque ? cfg.couleur + '55' : '#1a2a1a',
                  opacity: cfg.debloque ? 1 : 0.45,
                  cursor: cfg.debloque ? 'pointer' : 'default',
                }}
                onClick={() => cfg.debloque && navigate(cfg.route)}
                disabled={!cfg.debloque}
              >
                <div style={s.cardTop}>
                  <div style={{ ...s.emojiCircle, background: cfg.couleur + '22' }}>
                    <span style={s.cardEmoji}>{cfg.emoji}</span>
                  </div>
                  {cfg.debloque
                    ? <span style={{ ...s.badge, background: cfg.couleur + '33', color: cfg.couleur }}>Niv.{progress.niveau}</span>
                    : <span style={s.lockBadge}>🔒</span>
                  }
                </div>
                <div style={{ ...s.cardName, color: cfg.debloque ? '#c8e6a0' : '#4a6a3a' }}>
                  {METIERS[id].nom}
                </div>
                <div style={s.cardDesc}>{cfg.description}</div>
                {cfg.debloque && (
                  <>
                    <div style={s.xpBg}>
                      <div style={{ ...s.xpFill, width: `${xp_pct}%`, background: cfg.couleur }} />
                    </div>
                    <span style={{ ...s.arrow, color: cfg.couleur }}>→</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Stats ─────────────────────────────────────────── */}
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Progression</span>
        </div>
        <div style={s.statsRow}>
          {(Object.keys(METIER_CONFIG) as MetierId[]).map(id => (
            <div key={id} style={s.statItem}>
              <span style={{ fontSize: '20px' }}>{METIER_CONFIG[id].emoji}</span>
              <span style={{ color: METIER_CONFIG[id].couleur, fontSize: '12px', fontWeight: 800 }}>
                Niv.{metiersState[id].niveau}
              </span>
              <span style={{ color: '#3a5a2a', fontSize: '9px' }}>{METIERS[id].nom}</span>
            </div>
          ))}
        </div>

        <div style={{ height: '32px' }} />
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:    { minHeight: '100vh', background: '#080f08', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto' },
  topbar:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #1a2a1a' },
  pill:    { display: 'flex', alignItems: 'center', gap: '6px', background: '#0d1a0d', border: '1px solid #1e3a1e', borderRadius: '20px', padding: '4px 10px' },
  dot:     { width: '7px', height: '7px', borderRadius: '50%', background: '#6abf44' },
  pillText: { color: '#6a9a50', fontSize: '12px', fontFamily: 'monospace' },
  cityName: { color: '#c8e6a0', fontSize: '16px', fontWeight: 700 },
  decoBtn: { color: '#5a3a3a', fontSize: '12px', border: '1px solid #2a1a1a', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer' },
  scroll:  { flex: 1, overflowY: 'auto', paddingBottom: '16px' },
  saveBanner: { display: 'flex', alignItems: 'center', gap: '8px', margin: '12px', padding: '12px', background: '#0d1a0d', border: '1px solid #2a4a1a', borderRadius: '12px', width: 'calc(100% - 24px)', cursor: 'pointer' },
  saveBannerOk: { borderColor: '#6abf44' },
  sectionHeader: { padding: '20px 16px 8px', display: 'flex', flexDirection: 'column', gap: '2px' },
  sectionTitle:  { color: '#c8e6a0', fontSize: '16px', fontWeight: 700 },
  sectionSub:    { color: '#3a5a2a', fontSize: '12px' },
  grid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '0 12px' },
  card:  { background: '#0d1a0d', borderRadius: '16px', border: '1.5px solid', padding: '14px', textAlign: 'left', position: 'relative', transition: 'background 0.18s' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' },
  emojiCircle: { width: '48px', height: '48px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardEmoji:   { fontSize: '26px' },
  badge:       { padding: '3px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 },
  lockBadge:   { background: '#1a1a1a', padding: '3px 8px', borderRadius: '8px', fontSize: '14px' },
  cardName:    { fontSize: '15px', fontWeight: 700, marginBottom: '2px' },
  cardDesc:    { color: '#4a6a3a', fontSize: '11px', marginBottom: '8px' },
  xpBg:        { height: '3px', background: '#1a2a1a', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' },
  xpFill:      { height: '100%', borderRadius: '2px', transition: 'width 0.3s' },
  arrow:       { position: 'absolute', bottom: '12px', right: '14px', fontSize: '16px', fontWeight: 700 },
  statsRow:    { display: 'flex', justifyContent: 'space-around', margin: '0 12px', padding: '14px', background: '#0d1a0d', border: '1px solid #1e3a1e', borderRadius: '14px' },
  statItem:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' },
};
