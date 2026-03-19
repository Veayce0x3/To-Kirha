import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useGameStore } from '../store/gameStore';

const ADMIN_WALLETS = ['0x5a9d55c76c38ede9b8b34ed6e7f35578ce919b0c'];
import { getResourceById } from '../data/metiers';
import { ResourceId } from '../data/resources';
import { useT } from '../utils/i18n';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';
import { useSave } from '../hooks/useSave';

// ============================================================
// Modal Inventaire
// ============================================================

type SortMode = 'quantite' | 'categorie';

const METIER_ICON: Record<string, string> = {
  bucheron: '🪓', paysan: '🌾', pecheur: '🎣', mineur: '⛏️', alchimiste: '🌿',
};

function InventaireModal({ onClose }: { onClose: () => void }) {
  const inventaire  = useGameStore(s => s.inventaire);
  const [tab, setTab]   = useState<'ressources' | 'personnage'>('ressources');
  const [sort, setSort] = useState<SortMode>('quantite');
  const { t, lang } = useT();

  // Construire la liste des ressources possédées (entiers uniquement)
  const items = (Object.entries(inventaire) as [string, number][])
    .filter(([, qty]) => Math.floor(qty) >= 1)
    .map(([id, qty]) => {
      const rid = Number(id) as ResourceId;
      const res = getResourceById(rid);
      return { id: rid, qty: Math.floor(qty), res };
    })
    .filter(item => item.res != null);

  const sorted = [...items].sort((a, b) => {
    if (sort === 'quantite') return b.qty - a.qty;
    // categorie = par métier
    return (a.res!.metier < b.res!.metier ? -1 : a.res!.metier > b.res!.metier ? 1 : 0);
  });

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={ms.header}>
          <span style={ms.title}>{t('inventory.title')}</span>
          <button style={ms.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={ms.tabs}>
          {(['ressources', 'personnage'] as const).map(tabId => (
            <button
              key={tabId}
              style={{ ...ms.tab, ...(tab === tabId ? ms.tabActive : {}) }}
              onClick={() => setTab(tabId)}
            >
              {tabId === 'ressources' ? t('inventory.tab_res') : t('inventory.tab_perso')}
            </button>
          ))}
        </div>

        {/* Contenu */}
        {tab === 'ressources' && (
          <>
            {/* Barre de tri */}
            <div style={ms.sortBar}>
              {(['quantite', 'categorie'] as SortMode[]).map(mode => (
                <button
                  key={mode}
                  style={{ ...ms.sortBtn, ...(sort === mode ? ms.sortBtnActive : {}) }}
                  onClick={() => setSort(mode)}
                >
                  {mode === 'quantite' ? t('inventory.sort_qty') : t('inventory.sort_cat')}
                </button>
              ))}
            </div>

            {/* Liste */}
            <div style={ms.list}>
              {sorted.length === 0 && (
                <p style={{ color: '#7a4060', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
                  {t('inventory.empty')}
                </p>
              )}
              {sorted.map(({ id, qty, res }) => {
                return (
                  <div key={id} style={ms.item}>
                    <div style={{ ...ms.itemIcon, borderColor: '#d4648a' }}>
                      <span style={{ fontSize: '20px' }}>{emojiByResourceId(id)}</span>
                    </div>
                    <div style={ms.itemInfo}>
                      <span style={{ color: '#1e0a16', fontSize: '13px', fontWeight: 600 }}>
                        {getNomRessource(id, lang)}
                      </span>
                      <span style={{ color: '#7a4060', fontSize: '10px' }}>
                        {METIER_ICON[res!.metier]} {t(`metier.${res!.metier}` as Parameters<typeof t>[0])}
                      </span>
                    </div>
                    <div style={ms.itemRight}>
                      <span style={{ color: '#1e0a16', fontSize: '14px', fontWeight: 800 }}>×{qty}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'personnage' && (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <span style={{ fontSize: '40px' }}>👗</span>
            <p style={{ color: '#1e0a16', fontSize: '15px', fontWeight: 700, marginTop: '12px' }}>{t('inventory.perso_title')}</p>
            <p style={{ color: '#7a4060', fontSize: '12px', marginTop: '6px' }}>{t('inventory.perso_desc')}</p>
          </div>
        )}

      </div>
    </div>
  );
}

const ms: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
    zIndex: 200, display: 'flex', alignItems: 'flex-end',
  },
  panel: {
    background: '#fdf0f5', border: '1px solid rgba(212,100,138,0.2)',
    borderRadius: '22px 22px 0 0', width: '100%',
    maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px 12px', borderBottom: '1px solid rgba(212,100,138,0.15)',
    flexShrink: 0,
  },
  title:    { color: '#1e0a16', fontSize: '17px', fontWeight: 700 },
  closeBtn: { color: '#7a4060', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' },
  tabs: {
    display: 'flex', borderBottom: '1px solid rgba(212,100,138,0.15)',
    flexShrink: 0,
  },
  tab: {
    flex: 1, padding: '10px', color: '#7a4060', fontSize: '13px', fontWeight: 600,
    background: 'none', border: 'none', cursor: 'pointer',
    borderBottom: '2px solid transparent',
  },
  tabActive: { color: '#c43070', borderBottomColor: '#c43070' },
  sortBar: {
    display: 'flex', gap: '6px', padding: '10px 12px', flexShrink: 0,
    borderBottom: '1px solid rgba(212,100,138,0.08)',
  },
  sortBtn: {
    flex: 1, padding: '5px 4px', fontSize: '10px', fontWeight: 600,
    color: '#7a4060', background: 'rgba(212,100,138,0.06)',
    border: '1px solid rgba(212,100,138,0.13)', borderRadius: '8px', cursor: 'pointer',
  },
  sortBtnActive: { color: '#c43070', borderColor: '#c43070', background: 'rgba(196,48,112,0.15)' },
  list: { overflowY: 'auto', flex: 1, padding: '8px 12px 90px' },
  item: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 0', borderBottom: '1px solid rgba(212,100,138,0.07)',
  },
  itemIcon: {
    width: 40, height: 40, borderRadius: 8, border: '1.5px solid',
    background: '#ffffff', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
  },
  itemInfo:  { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  itemRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' },
};

// ============================================================
// BottomMenu
// ============================================================

export function BottomMenu() {
  const { isConnected, address } = useAccount();
  const { pathname }     = useLocation();
  const navigate         = useNavigate();
  const isAdmin = !!address && ADMIN_WALLETS.includes(address.toLowerCase());
  const [showInventaire, setShowInventaire] = useState(false);
  const { t } = useT();
  const { sauvegarder, status: saveStatus, error: saveError, pendingCount, reset: resetSave } = useSave();

  // Masqué sur la page de connexion
  if (!isConnected || pathname === '/' || pathname === '/maison') return null;

  const saveBusy  = saveStatus === 'signing' || saveStatus === 'pending';
  const saveError_ = saveStatus === 'error';

  return (
    <>
      {/* ── Modal Inventaire ─────────────────────────────────── */}
      {showInventaire && <InventaireModal onClose={() => setShowInventaire(false)} />}

      {/* ── Barre de menu ─────────────────────────────────────── */}
      <div style={s.menu}>
        {/* Kirha-City */}
        <button style={s.btn} onClick={() => navigate('/home')}>
          <span style={s.icon}>🏠</span>
          <span style={s.label}>{t('nav.home')}</span>
        </button>

        {/* Inventaire */}
        <button style={s.btn} onClick={() => setShowInventaire(true)}>
          <span style={s.icon}>🎒</span>
          <span style={s.label}>{t('nav.inventory')}</span>
        </button>

        {/* Sauvegarder */}
        <button
          style={{
            ...s.btn,
            position:    'relative',
            opacity:     (pendingCount === 0 && !saveError_) ? 0.45 : 1,
            borderColor: saveError_ ? 'rgba(196,48,112,0.5)' : pendingCount > 0 ? 'rgba(106,191,68,0.4)' : undefined,
            background:  saveError_ ? 'rgba(196,48,112,0.08)' : pendingCount > 0 ? 'rgba(106,191,68,0.1)' : undefined,
          }}
          onClick={saveError_ ? resetSave : sauvegarder}
          disabled={(pendingCount === 0 && !saveError_) || saveBusy}
          title={saveError_ ? (saveError ?? 'Erreur') : pendingCount === 0 ? 'Rien à sauvegarder' : `${pendingCount} ressource(s) à sauvegarder`}
        >
          {pendingCount > 0 && !saveError_ && (
            <span style={{ position:'absolute', top:6, right:8, width:7, height:7, background:'#6abf44', borderRadius:'50%' }} />
          )}
          <span style={s.icon}>
            {saveBusy ? '⏳' : saveStatus === 'success' ? '✅' : saveError_ ? '❌' : '💾'}
          </span>
          <span style={{ ...s.label, color: saveError_ ? '#c43070' : pendingCount > 0 ? '#4a8f2a' : undefined }}>
            {saveBusy ? 'Sauvegarde…' : saveError_ ? 'Erreur ↺' : 'Sauvegarder'}
          </span>
        </button>

        {/* Admin (wallet autorisé uniquement) */}
        {isAdmin && (
          <button style={s.btn} onClick={() => navigate('/admin')}>
            <span style={s.icon}>⚙️</span>
            <span style={s.label}>Admin</span>
          </button>
        )}
      </div>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  menu: {
    position:       'absolute',
    bottom: 0, left: 0, right: 0,
    zIndex:         100,
    display:        'flex',
    gap:            '8px',
    padding:        '10px 12px max(14px, env(safe-area-inset-bottom))',
    paddingBottom:  'max(14px, env(safe-area-inset-bottom))' as string,
    minHeight:      64,
    background:     'rgba(253,240,245,0.96)',
    borderTop:      '1px solid rgba(212,100,138,0.18)',
    backdropFilter: 'blur(10px)',
  },
  btn: {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            '3px',
    padding:        '8px 4px',
    background:     'rgba(212,100,138,0.07)',
    border:         '1px solid rgba(212,100,138,0.13)',
    borderRadius:   '12px',
    cursor:         'pointer',
    transition:     'border-color 0.2s, background 0.2s',
  },
  icon:  { fontSize: '20px' },
  label: { color: '#7a4060', fontSize: '10px', fontWeight: 600 },
};
