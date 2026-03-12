import { useNavigate } from 'react-router-dom';
import { useHarvest } from '../hooks/useHarvest';
import { HarvestGrid } from '../components/harvest/HarvestGrid';
import { useGameStore, xpRequis } from '../store/gameStore';
import { METIERS } from '../data/metiers';
import { ResourceId } from '../data/resources';
import { BucheronBackground, BucheronAssets } from '../assets/bucheron';

const RARETE_COLOR: Record<string, string> = {
  commun: '#8bc34a', rare: '#4fc3f7', epique: '#ce93d8', legendaire: '#ffca28',
};

export function BucheronPage() {
  const navigate = useNavigate();
  const { slots, ressources_disponibles, niveau, xp, demarrer, collecter } = useHarvest('bucheron');

  const inventaire = useGameStore(s => s.inventaire);
  const metier     = METIERS['bucheron'];
  const xp_max     = xpRequis(niveau);
  const xp_pct     = Math.min(xp / xp_max, 1) * 100;

  const slots_actifs = slots.filter(s => s.resource_id !== null).length;
  const slots_prets  = slots.filter(s => s.prete).length;
  const slots_open   = slots.filter(s => s.debloque).length;

  const inventaire_bucheron = metier.ressources.filter(r => (inventaire[r.id] ?? 0) > 0);

  return (
    <div style={s.page}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/ville')}>← Ville</button>
        <span style={s.title}>🌲 Bûcheron</span>
        <div style={{ width: '60px' }} />
      </div>

      <div style={s.scroll}>

        {/* ── Niveau + XP ───────────────────────────────────── */}
        <div style={s.levelCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <div style={s.levelBadge}>
              <span style={{ color: '#6a9a50', fontSize: '9px', fontWeight: 700 }}>Niv.</span>
              <span style={{ color: '#c8e6a0', fontSize: '20px', fontWeight: 900, lineHeight: '1' }}>{niveau}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#6a9a50', fontSize: '12px' }}>Expérience</span>
                <span style={{ color: '#aaa', fontSize: '11px', fontVariant: 'tabular-nums' }}>{xp} / {xp_max} XP</span>
              </div>
              <div style={s.xpBg}>
                <div style={{ ...s.xpFill, width: `${xp_pct}%` }} />
              </div>
            </div>
          </div>
          {/* Mini stats */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { label: 'En cours', value: slots_actifs, color: '#4fc3f7' },
              { label: 'Prêts',    value: slots_prets,  color: '#8bc34a' },
              { label: 'Débloq.',  value: `${slots_open}/10`, color: '#ce93d8' },
            ].map(stat => (
              <div key={stat.label} style={{ flex: 1, textAlign: 'center', padding: '6px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${stat.color}44`, borderRadius: '8px' }}>
                <div style={{ color: stat.color, fontSize: '16px', fontWeight: 800 }}>{stat.value}</div>
                <div style={{ color: '#666', fontSize: '10px', marginTop: '1px' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Zone de récolte avec background ───────────────── */}
        <div style={s.zoneWrapper}>
          <div style={{
            ...s.zoneBg,
            backgroundImage: `url(${BucheronBackground})`,
          }}>
            <div style={s.zoneOverlay}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 16px 2px' }}>
                <span style={{ color: '#c8e6a0', fontSize: '14px', fontWeight: 700 }}>Zone de récolte</span>
                <span style={{ color: '#5a8a40', fontSize: '11px' }}>{slots_open} / 10 emplacements</span>
              </div>
              <HarvestGrid
                slots={slots}
                ressources_disponibles={ressources_disponibles}
                onStart={demarrer}
                onCollect={collecter}
              />
            </div>
          </div>
        </div>

        {/* ── Inventaire ────────────────────────────────────── */}
        <div style={s.sectionTitle}>Inventaire</div>
        {inventaire_bucheron.length === 0
          ? <p style={{ color: '#3a5a2a', fontSize: '13px', textAlign: 'center', padding: '12px' }}>Aucune ressource récoltée</p>
          : (
            <div style={{ display: 'flex', flexWrap: 'wrap', padding: '0 8px' }}>
              {inventaire_bucheron.map(r => {
                const assets = r.id === ResourceId.FRENE ? BucheronAssets.frene : null;
                return (
                  <div key={r.id} style={s.invItem}>
                    {assets
                      ? <img src={assets.inventaire} alt={r.nom} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                      : <span style={{ fontSize: '28px' }}>🪵</span>
                    }
                    <span style={{ color: '#c8e6a0', fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>×{inventaire[r.id] ?? 0}</span>
                    <span style={{ color: '#6a9a50', fontSize: '9px', textAlign: 'center' }}>{r.nom}</span>
                  </div>
                );
              })}
            </div>
          )
        }

        {/* ── Arbres à débloquer ────────────────────────────── */}
        <div style={s.sectionTitle}>Arbres à débloquer</div>
        <div style={s.treeList}>
          {metier.ressources.filter(r => r.niveau_requis > niveau).map((r, i, arr) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '12px', borderBottom: i < arr.length - 1 ? '1px solid #1a2a1a' : 'none' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '17px', border: `1px solid ${RARETE_COLOR[r.rarete]}`, background: '#0a120a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', fontSize: '14px' }}>🔒</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#8aaa70', fontSize: '14px' }}>{r.nom}</div>
                <div style={{ color: '#3a5a2a', fontSize: '11px', marginTop: '1px' }}>Niveau {r.niveau_requis}</div>
              </div>
              <span style={{ border: `1px solid ${RARETE_COLOR[r.rarete]}`, color: RARETE_COLOR[r.rarete], borderRadius: '6px', padding: '2px 6px', fontSize: '10px', fontWeight: 700, textTransform: 'capitalize' }}>
                {r.rarete}
              </span>
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
  header:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1a2a1a' },
  backBtn: { color: '#8bc34a', fontSize: '14px', cursor: 'pointer', background: 'none', border: 'none' },
  title:   { color: '#e8f5e9', fontSize: '18px', fontWeight: 700 },
  scroll:  { flex: 1, overflowY: 'auto' },
  levelCard: { margin: '12px', padding: '14px', background: '#0d1a0d', border: '1px solid #1e3a1e', borderRadius: '14px' },
  levelBadge: { width: '52px', height: '52px', borderRadius: '26px', background: '#1a3a1a', border: '2px solid #3a6a2a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  xpBg:   { height: '8px', background: '#1a2a1a', borderRadius: '4px', overflow: 'hidden' },
  xpFill: { height: '100%', background: '#6abf44', borderRadius: '4px', transition: 'width 0.3s' },
  zoneWrapper: { margin: '0 12px', borderRadius: '16px', overflow: 'hidden', border: '1.5px solid #2a4a1a' },
  zoneBg:  { backgroundSize: 'cover', backgroundPosition: 'center' },
  zoneOverlay: { background: 'rgba(5,18,5,0.58)' },
  sectionTitle: { color: '#c8e6a0', fontSize: '15px', fontWeight: 700, padding: '20px 16px 8px' },
  invItem: { width: '78px', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '5px', padding: '8px', background: '#0d1a0d', border: '1px solid #1e3a1e', borderRadius: '10px' },
  treeList: { margin: '0 12px', background: '#0d1a0d', border: '1px solid #1a2e1a', borderRadius: '12px', overflow: 'hidden' },
};
