import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, xpRequis, SLOT_UNLOCK_CONDITIONS } from '../store/gameStore';
import { useHarvest, formatTimer, SlotAvecTimer } from '../hooks/useHarvest';
import { METIERS, MetierId, Ressource } from '../data/metiers';
import { ResourceId } from '../data/resources';
import { useT } from '../utils/i18n';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';

// ── Configs par métier ──────────────────────────────────────

const METIER_CONFIG: Record<MetierId, { icon: string; color: string }> = {
  bucheron:   { icon: '🪓', color: '#6abf44' },
  paysan:     { icon: '🌾', color: '#f9a825' },
  pecheur:    { icon: '🎣', color: '#29b6f6' },
  mineur:     { icon: '⛏️', color: '#8d6e63' },
  alchimiste: { icon: '🌿', color: '#ab47bc' },
};

const METIER_ICONS: Record<MetierId, { idle: string; harvesting: string; done: string }> = {
  bucheron:   { idle: '🌳', harvesting: '🪚', done: '🪵' },
  paysan:     { idle: '🌾', harvesting: '✂️',  done: '🌽' },
  pecheur:    { idle: '🌊', harvesting: '🎣', done: '🐟' },
  mineur:     { idle: '⛰️', harvesting: '⛏️', done: '💎' },
  alchimiste: { idle: '🌿', harvesting: '🧪', done: '✨' },
};

// ── Popup de sélection de ressource ────────────────────────

function ResourcePickerPopup({
  metierId,
  ressources,
  niveau,
  onPick,
  onClose,
}: {
  metierId: MetierId;
  ressources: Ressource[];
  niveau: number;
  onPick: (id: ResourceId) => void;
  onClose: () => void;
}) {
  const { t, lang } = useT();
  return (
    <div style={ps.overlay} onClick={onClose}>
      <div style={ps.sheet} onClick={e => e.stopPropagation()}>
        <div style={ps.sheetHeader}>
          <span style={ps.sheetTitle}>{t('recolte.select_resource')}</span>
          <button style={ps.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={ps.sheetList}>
          {ressources.map(res => {
            const locked = res.niveau_requis > niveau;
            return (
              <button
                key={res.id}
                style={{
                  ...ps.resRow,
                  opacity:    locked ? 0.4 : 1,
                  cursor:     locked ? 'not-allowed' : 'pointer',
                  background: locked ? 'rgba(212,100,138,0.03)' : '#ffffff',
                }}
                onClick={() => { if (!locked) { onPick(res.id); onClose(); } }}
                disabled={locked}
              >
                <span style={{ fontSize: '22px', width: 30, textAlign: 'center' }}>
                  {locked ? '🔒' : emojiByResourceId(res.id)}
                </span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ color: locked ? '#7a4060' : '#1e0a16', fontSize: '13px', fontWeight: 600 }}>
                    {getNomRessource(res.id, lang)}
                  </span>
                  <span style={{ color: '#7a4060', fontSize: '10px', display: 'block' }}>
                    {locked
                      ? `${t('recolte.level_req')} ${res.niveau_requis} ${t('recolte.required')}`
                      : `${t('recolte.level')} ${res.niveau_requis}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Popup de déverrouillage de slot ────────────────────────

function UnlockPopup({
  slotIndex,
  totalInventaire,
  soldeKirha,
  onUnlock,
  onClose,
}: {
  slotIndex: number;
  totalInventaire: number;
  soldeKirha: number;
  onUnlock: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const cond  = SLOT_UNLOCK_CONDITIONS[slotIndex];
  if (!cond) return null;
  const canUnlock = totalInventaire >= cond.ressources && soldeKirha >= cond.kirha;

  return (
    <div style={up.overlay} onClick={onClose}>
      <div style={up.modal} onClick={e => e.stopPropagation()}>
        <div style={up.header}>
          <span style={up.title}>🔓 {t('recolte.unlock_slot')} #{slotIndex + 1}</span>
          <button style={up.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={up.body}>
          <div style={{ ...up.condRow, color: totalInventaire >= cond.ressources ? '#6abf44' : '#c43070' }}>
            <span>📦</span>
            <span style={{ fontSize: '13px', flex: 1 }}>
              {cond.ressources} ressources — {t('recolte.you_have')} : {totalInventaire}
            </span>
            <span>{totalInventaire >= cond.ressources ? '✓' : '✗'}</span>
          </div>
          <div style={{ ...up.condRow, color: soldeKirha >= cond.kirha ? '#6abf44' : '#c43070' }}>
            <span>💠</span>
            <span style={{ fontSize: '13px', flex: 1 }}>
              {cond.kirha} $KIRHA — {t('recolte.you_have')} : {soldeKirha.toFixed(2)}
            </span>
            <span>{soldeKirha >= cond.kirha ? '✓' : '✗'}</span>
          </div>
        </div>
        <div style={up.footer}>
          <button style={up.cancelBtn} onClick={onClose}>{t('recolte.cancel')}</button>
          <button
            style={{ ...up.unlockBtn, opacity: canUnlock ? 1 : 0.45, cursor: canUnlock ? 'pointer' : 'not-allowed' }}
            onClick={() => { if (canUnlock) { onUnlock(); onClose(); } }}
            disabled={!canUnlock}
          >
            {t('recolte.unlock_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sélecteur de métier ─────────────────────────────────────

function MetierSelector({ onSelect }: { onSelect: (id: MetierId) => void }) {
  const navigate = useNavigate();
  const metiers  = useGameStore(s => s.metiers);
  const slotsAll = useGameStore(s => s.slots);
  const { t }    = useT();

  // Tick 1s pour rafraîchir les timers
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/home')}>{t('recolte.back_home')}</button>
        <span style={s.headerTitle}>{t('recolte.title')}</span>
        <div style={{ width: 80 }} />
      </div>

      <div style={s.metierList}>
        {(Object.keys(METIER_CONFIG) as MetierId[]).map(id => {
          const cfg          = METIER_CONFIG[id];
          const p            = metiers[id];
          const pct          = Math.min(100, (p.xp / xpRequis(p.niveau)) * 100);
          const metierSlots  = slotsAll[id] ?? [];
          const activeSlots  = metierSlots.filter(sl => sl.resource_id !== null && sl.termine_a !== null);
          const isActive     = activeSlots.length > 0;
          const doneSlots    = activeSlots.filter(sl => sl.termine_a! <= now);
          const runningSlots = activeSlots.filter(sl => sl.termine_a! > now);
          const maxSecs      = runningSlots.length > 0
            ? Math.ceil((Math.max(...runningSlots.map(sl => sl.termine_a!)) - now) / 1000)
            : 0;

          return (
            <button
              key={id}
              style={{ ...s.metierCard, borderColor: isActive ? cfg.color : `${cfg.color}33` }}
              onClick={() => onSelect(id)}
            >
              <div style={{ ...s.metierCardGlow, background: `radial-gradient(ellipse at left, ${cfg.color}14, transparent 70%)` }} />
              <span style={{ fontSize: '26px', filter: `drop-shadow(0 0 6px ${cfg.color}66)` }}>{cfg.icon}</span>
              <div style={s.metierInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#1e0a16', fontSize: '14px', fontWeight: 800 }}>
                    {t(`metier.${id}` as `metier.${MetierId}`)}
                  </span>
                  {runningSlots.length > 0 && (
                    <span style={{ background: cfg.color, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: '9px', fontWeight: 800 }}>
                      {runningSlots.length} en cours
                    </span>
                  )}
                  {doneSlots.length > 0 && (
                    <span style={{ background: '#6abf44', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: '9px', fontWeight: 800 }}>
                      {doneSlots.length} prêt{doneSlots.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {!isActive && (
                    <span style={{ background: '#c43070', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: '9px', fontWeight: 800 }}>
                      Inactif
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{ ...s.levelBadge, borderColor: cfg.color, color: cfg.color }}>
                    {t('recolte.level')} {p.niveau}
                  </span>
                  {/* Barre XP distincte (bleu/violet) */}
                  <span style={{ color:'#7a6cb0', fontSize:'8px', fontWeight:700, flexShrink:0 }}>XP</span>
                  <div style={{ flex: 1, height: 4, background: 'rgba(122,108,176,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#7a6cb0,#5b3fa0)', borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ color:'#7a6cb0', fontSize:'8px', fontFamily:'monospace', fontWeight:600, flexShrink:0 }}>
                    {p.xp}/{xpRequis(p.niveau)}
                  </span>
                  {maxSecs > 0 && (
                    <span style={{ color: cfg.color, fontSize: '9px', fontFamily: 'monospace', fontWeight: 700 }}>
                      {formatTimer(maxSecs)}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ color: cfg.color, fontSize: '18px', flexShrink: 0 }}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Zone d'un métier ────────────────────────────────────────

function ZoneMetier({ metierId, onBack }: { metierId: MetierId; onBack: () => void }) {
  const cfg    = METIER_CONFIG[metierId];
  const metier = METIERS[metierId];
  const icons  = METIER_ICONS[metierId];
  const { t, lang } = useT();

  const { slots, niveau, xp, planterRessource, collecterEtRelancer, lastHarvested } = useHarvest(metierId);
  const debloquerSlot   = useGameStore(s => s.debloquerSlot);
  const inventaire      = useGameStore(s => s.inventaire);
  const soldeKirha      = useGameStore(s => s.soldeKirha);

  const totalInventaire = Object.values(inventaire).reduce((a, b) => a + Math.floor(b ?? 0), 0);
  const pct             = Math.min(100, (xp / xpRequis(niveau)) * 100);
  const prochainSlotVerrouille = slots.find(sl => !sl.debloque)?.index ?? -1;

  const [resourceInHand, setResourceInHand] = useState<ResourceId | null>(null);
  const [showPicker, setShowPicker]         = useState(false);
  const [unlockSlot, setUnlockSlot]         = useState<number | null>(null);

  const resInHand = resourceInHand
    ? metier.ressources.find(r => r.id === resourceInHand)
    : null;

  const handleSlotClick = (slot: SlotAvecTimer) => {
    if (!slot.debloque) {
      if (slot.index === prochainSlotVerrouille) setUnlockSlot(slot.index);
      return;
    }
    if (resourceInHand !== null) {
      planterRessource(slot.index, resourceInHand);
      return;
    }
    if (slot.prete) {
      collecterEtRelancer(slot.index);
      return;
    }
    if (slot.resource_id === null) {
      setShowPicker(true);
    }
  };

  const renderSlot = (slot: SlotAvecTimer) => {
    const isHarvesting = slot.resource_id !== null && !slot.prete;
    const isDone       = slot.resource_id !== null && slot.prete;
    const isFree       = slot.debloque && slot.resource_id === null;
    const isLocked     = !slot.debloque;
    const isNextLock   = slot.index === prochainSlotVerrouille;

    const timerPct = isHarvesting && slot.secondes_restantes != null
      ? Math.max(0, 100 - (slot.secondes_restantes / 30) * 100)
      : isDone ? 100 : 0;

    const highlightInHand = resourceInHand !== null && slot.debloque;

    const res = (isHarvesting || isDone)
      ? metier.ressources.find(r => r.id === slot.resource_id)
      : null;

    return (
      <div
        key={slot.index}
        style={{
          ...s.slotCard,
          borderColor: isDone
            ? '#6abf44'
            : isHarvesting
              ? cfg.color
              : highlightInHand
                ? `${cfg.color}cc`
                : isLocked
                  ? (isNextLock ? `${cfg.color}55` : 'rgba(212,100,138,0.08)')
                  : 'rgba(212,100,138,0.18)',
          background: isDone
            ? 'rgba(106,191,68,0.12)'
            : isHarvesting
              ? `${cfg.color}10`
              : highlightInHand
                ? `${cfg.color}14`
                : isLocked && !isNextLock
                  ? 'rgba(212,100,138,0.03)'
                  : '#ffffff',
          opacity:     isLocked && !isNextLock ? 0.35 : 1,
          cursor:      isLocked && !isNextLock ? 'default' : isHarvesting && !resourceInHand ? 'default' : 'pointer',
          outline:     highlightInHand && !isLocked && resourceInHand ? `2px dashed ${cfg.color}99` : 'none',
          outlineOffset: 2,
        }}
        onClick={() => handleSlotClick(slot)}
      >
        {/* Verrouillé — prochain */}
        {isLocked && isNextLock && (
          <>
            <span style={{ fontSize: '22px', margin: '4px 0 2px' }}>🔒</span>
            <span style={{ color: cfg.color, fontSize: '9px', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>
              {t('recolte.unlock_btn')}
            </span>
            {SLOT_UNLOCK_CONDITIONS[slot.index] && (
              <span style={{ color: '#7a4060', fontSize: '8px', textAlign: 'center', marginTop: 2, lineHeight: 1.3 }}>
                📦{SLOT_UNLOCK_CONDITIONS[slot.index].ressources} · 💠{SLOT_UNLOCK_CONDITIONS[slot.index].kirha}
              </span>
            )}
          </>
        )}

        {/* Verrouillé — au-delà */}
        {isLocked && !isNextLock && (
          <span style={{ fontSize: '18px', opacity: 0.5 }}>🔒</span>
        )}

        {/* Libre */}
        {isFree && (
          <>
            {resourceInHand && resInHand ? (
              <>
                <span style={{ fontSize: '24px', margin: '4px 0 2px', lineHeight: 1 }}>
                  {emojiByResourceId(resInHand.id)}
                </span>
                <span style={{ color: cfg.color, fontSize: '8px', fontWeight: 800, textAlign: 'center', lineHeight: 1.2 }}>
                  {getNomRessource(resInHand.id, lang)}
                </span>
                <span style={{ color: cfg.color, fontSize: '8px', marginTop: 3, fontWeight: 700 }}>▶ Planter</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '22px', margin: '4px 0 2px', opacity: 0.3 }}>{icons.idle}</span>
                <span style={{ color: '#7a4060', fontSize: '8px', textAlign: 'center', marginTop: 2 }}>vide</span>
              </>
            )}
          </>
        )}

        {/* En cours */}
        {isHarvesting && res && (
          <>
            <span style={{ fontSize: '24px', margin: '4px 0 2px', lineHeight: 1 }}>
              {resourceInHand ? emojiByResourceId(resourceInHand) : icons.harvesting}
            </span>
            <span style={{ color: '#1e0a16', fontSize: '9px', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
              {resourceInHand && resInHand ? getNomRessource(resInHand.id, lang) : getNomRessource(res.id, lang)}
            </span>
            <span style={{ color: cfg.color, fontSize: '10px', fontWeight: 900, fontFamily: 'monospace', marginTop: 2 }}>
              {resourceInHand ? '↺' : (slot.secondes_restantes != null ? formatTimer(slot.secondes_restantes) : '')}
            </span>
            {!resourceInHand && (
              <div style={{ width: '100%', height: 3, background: 'rgba(212,100,138,0.1)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${timerPct}%`, background: cfg.color, borderRadius: 2, transition: 'width 1s linear' }} />
              </div>
            )}
          </>
        )}

        {/* Prêt */}
        {isDone && res && (
          <>
            <span style={{ fontSize: '26px', margin: '4px 0 2px', lineHeight: 1 }}>
              {resourceInHand && resInHand ? emojiByResourceId(resInHand.id) : icons.done}
            </span>
            <span style={{ color: '#1e0a16', fontSize: '9px', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
              {resourceInHand && resInHand ? getNomRessource(resInHand.id, lang) : getNomRessource(res.id, lang)}
            </span>
            <span style={{ color: resourceInHand ? cfg.color : '#6abf44', fontSize: '9px', fontWeight: 900, marginTop: 2 }}>
              {resourceInHand ? '↺ Replanter' : '✓ Récolter'}
            </span>
            {!resourceInHand && (
              <div style={{ width: '100%', height: 3, background: 'rgba(106,191,68,0.2)', borderRadius: 2, marginTop: 4 }}>
                <div style={{ height: '100%', width: '100%', background: '#6abf44', borderRadius: 2 }} />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={s.page}>
      {showPicker && (
        <ResourcePickerPopup
          metierId={metierId}
          ressources={metier.ressources}
          niveau={niveau}
          onPick={id => setResourceInHand(id)}
          onClose={() => setShowPicker(false)}
        />
      )}
      {unlockSlot !== null && (
        <UnlockPopup
          slotIndex={unlockSlot}
          totalInventaire={totalInventaire}
          soldeKirha={soldeKirha}
          onUnlock={() => debloquerSlot(metierId, unlockSlot)}
          onClose={() => setUnlockSlot(null)}
        />
      )}

      {/* Header */}
      <div style={{ ...s.header, borderBottomColor: `${cfg.color}33` }}>
        <button style={{ ...s.backBtn, color: cfg.color }} onClick={onBack}>{t('recolte.back')}</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ color: '#1e0a16', fontSize: '15px', fontWeight: 800 }}>
            {cfg.icon} {t(`metier.${metierId}` as `metier.${MetierId}`)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ ...s.levelBadge, borderColor: cfg.color, color: cfg.color }}>{t('recolte.level')} {niveau}</span>
          </div>
          {/* Barre XP distincte (bleu/violet) */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
            <span style={{ color:'#7a6cb0', fontSize:'9px', fontWeight:700 }}>XP</span>
            <div style={{ width:80, height:4, background:'rgba(122,108,176,0.15)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#7a6cb0,#5b3fa0)', borderRadius:2, transition:'width 0.3s' }} />
            </div>
            <span style={{ color:'#7a6cb0', fontSize:'8px', fontFamily:'monospace', fontWeight:700 }}>
              {xp}/{xpRequis(niveau)}
            </span>
          </div>
        </div>
        <div style={{ width: 80 }} />
      </div>
      {lastHarvested && (
        <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'rgba(30,10,22,0.85)', color:'#6abf44', padding:'8px 18px', borderRadius:20, fontSize:'14px', fontWeight:800, zIndex:500, pointerEvents:'none', whiteSpace:'nowrap' }}>
          +{lastHarvested.qty.toFixed(2)} {emojiByResourceId(lastHarvested.resourceId)} {getNomRessource(lastHarvested.resourceId, lang)}
        </div>
      )}

      <div style={{ padding: '10px 14px', paddingBottom: 90 }}>

        {/* Barre ressource en main / bouton Choisir */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: 12, alignItems: 'center' }}>
          {resInHand ? (
            <>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 14px', background: `${cfg.color}14`,
                border: `2px solid ${cfg.color}`, borderRadius: 12,
              }}>
                <span style={{ fontSize: '20px' }}>{emojiByResourceId(resInHand.id)}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#1e0a16', fontSize: '12px', fontWeight: 800 }}>
                    {getNomRessource(resInHand.id, lang)}
                  </span>
                  <span style={{ display: 'block', color: cfg.color, fontSize: '10px', fontWeight: 700 }}>
                    En main — cliquez un emplacement pour planter
                  </span>
                </div>
              </div>
              <button
                style={{ padding: '9px 12px', background: 'rgba(212,100,138,0.08)', border: '1px solid rgba(212,100,138,0.2)', borderRadius: 12, color: '#7a4060', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}
                onClick={() => setResourceInHand(null)}
                title="Déposer"
              >✕</button>
              <button
                style={{ padding: '9px 14px', background: cfg.color, border: 'none', borderRadius: 12, color: '#ffffff', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                onClick={() => setShowPicker(true)}
              >{t('recolte.choose_resource')}</button>
            </>
          ) : (
            <button
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '11px 14px', background: '#ffffff', border: `1.5px dashed ${cfg.color}88`, borderRadius: 12, cursor: 'pointer' }}
              onClick={() => setShowPicker(true)}
            >
              <span style={{ fontSize: '20px' }}>🌿</span>
              <span style={{ color: cfg.color, fontSize: '13px', fontWeight: 800 }}>{t('recolte.choose_resource')}</span>
              <span style={{ color: cfg.color, fontSize: '14px' }}>▼</span>
            </button>
          )}
        </div>

        {/* Infos slots */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: '#1e0a16', fontSize: '12px', fontWeight: 700 }}>{t('recolte.harvest_points')}</span>
          <span style={{ color: '#7a4060', fontSize: '10px' }}>
            {slots.filter(sl => sl.debloque).length}/{slots.length} {t('recolte.unlocked')}
          </span>
        </div>

        <div className="slots-grid">
          {slots.map(slot => renderSlot(slot))}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ─────────────────────────────────────────

export function RecoltePage() {
  const [selectedMetier, setSelectedMetier] = useState<MetierId | null>(null);
  if (selectedMetier) {
    return <ZoneMetier metierId={selectedMetier} onBack={() => setSelectedMetier(null)} />;
  }
  return <MetierSelector onSelect={setSelectedMetier} />;
}

// ── Styles ──────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:        { position: 'absolute', inset: 0, background: '#fdf0f5', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(253,240,245,0.96)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(212,100,138,0.15)', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 },
  backBtn:     { color: '#7a4060', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' },
  headerTitle: { color: '#1e0a16', fontSize: '16px', fontWeight: 800 },
  metierList:  { display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', paddingBottom: 100 },
  metierCard:  {
    position: 'relative', overflow: 'hidden',
    display: 'flex', alignItems: 'center', gap: '10px',
    background: '#ffffff', border: '1.5px solid',
    borderRadius: 14, padding: '10px 14px',
    cursor: 'pointer', textAlign: 'left',
  },
  metierCardGlow: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  metierInfo:     { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  levelBadge:     { border: '1px solid', borderRadius: 6, padding: '2px 7px', fontSize: '10px', fontWeight: 700 },
  slotCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    border: '1.5px solid', borderRadius: 12,
    padding: '10px 6px 8px', minHeight: 88,
    transition: 'border-color 0.15s, background 0.15s, outline 0.1s',
  },
};

const ps: Record<string, React.CSSProperties> = {
  overlay:     { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'flex-end' },
  sheet:       { background: '#ffffff', borderRadius: '22px 22px 0 0', width: '100%', maxHeight: '75vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  sheetHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid rgba(212,100,138,0.15)', flexShrink: 0 },
  sheetTitle:  { color: '#1e0a16', fontSize: '16px', fontWeight: 700 },
  closeBtn:    { color: '#7a4060', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' },
  sheetList:   { overflowY: 'auto', flex: 1, padding: '8px 12px 32px' },
  resRow:      { display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '11px 8px', border: 'none', borderBottom: '1px solid rgba(212,100,138,0.08)', background: '#ffffff', textAlign: 'left' },
};

const up: Record<string, React.CSSProperties> = {
  overlay:   { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal:     { background: '#fdf0f5', border: '1px solid rgba(212,100,138,0.2)', borderRadius: 20, width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid rgba(212,100,138,0.15)', flexShrink: 0 },
  title:     { color: '#1e0a16', fontSize: '15px', fontWeight: 700 },
  closeBtn:  { color: '#7a4060', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' },
  body:      { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  condRow:   { display: 'flex', alignItems: 'center', gap: '10px', background: '#ffffff', border: '1px solid rgba(212,100,138,0.12)', borderRadius: 10, padding: '10px 12px' },
  footer:    { display: 'flex', gap: '10px', padding: '12px 20px 20px' },
  cancelBtn: { flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(212,100,138,0.08)', border: '1px solid rgba(212,100,138,0.2)', color: '#7a4060', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  unlockBtn: { flex: 2, padding: '10px', borderRadius: 12, background: '#c43070', border: 'none', color: '#ffffff', fontSize: '13px', fontWeight: 800, cursor: 'pointer' },
};
