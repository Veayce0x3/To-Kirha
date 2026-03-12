import { useState, useCallback } from 'react';
import { SlotAvecTimer, formatTimer } from '../../hooks/useHarvest';
import { Ressource } from '../../data/metiers';
import { ResourceId } from '../../data/resources';
import { BucheronAssets } from '../../assets/bucheron';

// ============================================================
// Assets lookup
// ============================================================

const RESOURCE_ASSETS: Partial<Record<ResourceId, { arbre: string; tronc_coupe: string; inventaire: string; } | null>> = {
  [ResourceId.FRENE]: BucheronAssets.frene,
};

const RARETE_COLOR: Record<string, string> = {
  commun: '#8bc34a', rare: '#4fc3f7', epique: '#ce93d8', legendaire: '#ffca28',
};

// ============================================================
// Props
// ============================================================

interface HarvestSlotProps {
  slot:                   SlotAvecTimer;
  slotWidth:              number;
  slotHeight:             number;
  ressources_disponibles: Ressource[];
  onStart:                (resourceId: ResourceId) => void;
  onCollect:              () => void;
}

// ============================================================
// Composant
// ============================================================

export function HarvestSlot({ slot, slotWidth, slotHeight, ressources_disponibles, onStart, onCollect }: HarvestSlotProps) {
  const [modal, setModal] = useState(false);
  const handleChoix = useCallback((id: ResourceId) => { setModal(false); onStart(id); }, [onStart]);

  const base: React.CSSProperties = {
    width: slotWidth, height: slotHeight, borderRadius: '10px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', position: 'relative', overflow: 'hidden',
    border: '1.5px solid', cursor: 'pointer', transition: 'box-shadow 0.2s',
    flexShrink: 0,
  };

  // ── Verrouillé ─────────────────────────────────────────────
  if (!slot.debloque) {
    return (
      <div style={{ ...base, borderColor: 'rgba(60,50,80,0.5)', background: 'rgba(10,10,20,0.5)', cursor: 'default', opacity: 0.5 }}>
        <span style={{ fontSize: '18px', opacity: 0.5 }}>🔒</span>
      </div>
    );
  }

  // ── Vide ───────────────────────────────────────────────────
  if (!slot.resource_id) {
    const assets = RESOURCE_ASSETS[ResourceId.FRENE];
    return (
      <>
        <button
          style={{ ...base, borderStyle: 'dashed', borderColor: 'rgba(100,180,80,0.4)', background: 'rgba(20,40,20,0.55)' }}
          onClick={() => setModal(true)}
        >
          {assets
            ? <img src={assets.arbre} alt="" style={{ width: '80%', height: '58%', objectFit: 'contain' }} />
            : <span style={{ fontSize: '28px' }}>🌳</span>
          }
          <span style={{ position: 'absolute', bottom: '4px', fontSize: '9px', color: '#a5d67a', fontWeight: 700, background: 'rgba(100,200,80,0.25)', padding: '2px 5px', borderRadius: '4px' }}>
            Couper
          </span>
        </button>

        {modal && (
          <ResourceModal
            ressources={ressources_disponibles}
            onSelect={handleChoix}
            onClose={() => setModal(false)}
          />
        )}
      </>
    );
  }

  // ── Actif / Prêt ───────────────────────────────────────────
  const assets   = RESOURCE_ASSETS[slot.resource_id] ?? null;
  const ressource = ressources_disponibles.find(r => r.id === slot.resource_id);
  const color     = RARETE_COLOR[ressource?.rarete ?? 'commun'];
  const progress  = slot.secondes_restantes && ressource
    ? (1 - slot.secondes_restantes / ressource.temps_recolte_secondes) * 100
    : 100;

  if (slot.prete) {
    return (
      <button
        style={{ ...base, borderColor: color, background: 'rgba(20,50,20,0.75)', boxShadow: `0 0 14px ${color}66` }}
        onClick={onCollect}
      >
        {assets
          ? <img src={assets.inventaire} alt="" style={{ width: '70%', height: '55%', objectFit: 'contain' }} />
          : <span style={{ fontSize: '28px' }}>🪵</span>
        }
        <span style={{ position: 'absolute', bottom: '4px', fontSize: '9px', fontWeight: 800, background: color, color: '#0a1a05', padding: '2px 6px', borderRadius: '4px' }}>
          ✓ Collecter
        </span>
      </button>
    );
  }

  return (
    <div style={{ ...base, borderColor: 'rgba(80,150,60,0.6)', background: 'rgba(10,30,15,0.65)', cursor: 'default' }}>
      {assets
        ? <img src={assets.tronc_coupe} alt="" style={{ width: '80%', height: '58%', objectFit: 'contain' }} />
        : <span style={{ fontSize: '28px' }}>🪚</span>
      }
      {/* Barre progression */}
      <div style={{ position: 'absolute', bottom: '18px', left: '5px', right: '5px', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(progress)}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 1s linear' }} />
      </div>
      <span style={{ position: 'absolute', bottom: '4px', fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', fontVariant: 'tabular-nums' }}>
        {formatTimer(slot.secondes_restantes ?? 0)}
      </span>
    </div>
  );
}

// ============================================================
// Modal de choix de ressource
// ============================================================

function ResourceModal({ ressources, onSelect, onClose }: {
  ressources: Ressource[];
  onSelect:   (id: ResourceId) => void;
  onClose:    () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#0e1a0e', border: '1px solid #2a4a1a', borderRadius: '22px 22px 0 0', padding: '20px', width: '100%', maxWidth: '480px', maxHeight: '70vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <p style={{ color: '#c8e6a0', fontSize: '16px', fontWeight: 700, textAlign: 'center', marginBottom: '16px' }}>
          Choisir un arbre
        </p>
        {ressources.map((r, i) => {
          const assets = RESOURCE_ASSETS[r.id];
          const color  = RARETE_COLOR[r.rarete];
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 0', borderBottom: i < ressources.length - 1 ? '1px solid #1a2a1a' : 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: '#1a2a1a', overflow: 'hidden', flexShrink: 0 }}>
                {assets && <img src={assets.inventaire} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{r.nom}</div>
                <div style={{ color: '#6a9a50', fontSize: '12px', marginTop: '2px' }}>
                  {formatTimer(r.temps_recolte_secondes)} · {r.xp_recolte} XP
                </div>
              </div>
              <span style={{ border: `1px solid ${color}`, color, borderRadius: '6px', padding: '2px 6px', fontSize: '10px', fontWeight: 700, textTransform: 'capitalize' }}>
                {r.rarete}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
