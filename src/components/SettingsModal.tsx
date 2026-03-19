import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useSave } from '../hooks/useSave';
import { useDisconnect } from 'wagmi';
import { useT } from '../utils/i18n';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const navigate  = useNavigate();
  const langue    = useGameStore(s => s.langue);
  const setLangue = useGameStore(s => s.setLangue);
  const villeId   = useGameStore(s => s.villeId);
  const { sauvegarder, status: saveStatus, pendingCount } = useSave();
  const { disconnect } = useDisconnect();
  const { t } = useT();

  const shortVilleId = villeId ?? '—';

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={ms.header}>
          <span style={ms.title}>{t('settings.title')}</span>
          <button style={ms.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={ms.body}>

          {/* Langue */}
          <div style={ms.section}>
            <span style={ms.sectionTitle}>{t('settings.language')}</span>
            <div style={{ display:'flex', gap:'8px' }}>
              <button
                style={{ ...ms.langBtn, ...(langue === 'fr' ? ms.langBtnActive : {}) }}
                onClick={() => setLangue('fr')}
              >
                🇫🇷 FR
              </button>
              <button
                style={{ ...ms.langBtn, ...(langue === 'en' ? ms.langBtnActive : {}) }}
                onClick={() => setLangue('en')}
              >
                🇬🇧 EN
              </button>
            </div>
          </div>

          {/* Sauvegarde manuelle */}
          <div style={ms.section}>
            <span style={ms.sectionTitle}>{t('settings.save')}</span>
            <button
              style={{
                ...ms.saveBtn,
                opacity: saveStatus === 'pending' || saveStatus === 'signing' ? 0.6 : 1,
              }}
              onClick={sauvegarder}
              disabled={saveStatus === 'pending' || saveStatus === 'signing'}
            >
              {saveStatus === 'pending' ? t('settings.save_pending_tx')
                : saveStatus === 'signing' ? t('settings.save_signing')
                : saveStatus === 'success' ? t('settings.save_success')
                : saveStatus === 'error' ? t('settings.save_error')
                : pendingCount > 0
                  ? `${t('settings.save_btn')} (${pendingCount} ${t('settings.save_pending')})`
                  : t('settings.save_btn')}
            </button>
          </div>

          {/* Prix $KIRHA */}
          <div style={ms.section}>
            <span style={ms.sectionTitle}>{t('settings.kirha_price')}</span>
            <div style={ms.infoRow}>
              <span style={{ color:'#7a4060', fontSize:'13px' }}>{t('settings.kirha_approx')}</span>
              <span style={{ color:'#1e0a16', fontSize:'13px', fontWeight:700 }}>— $</span>
            </div>
          </div>

          {/* Transfert $KIRHA */}
          <div style={ms.section}>
            <span style={ms.sectionTitle}>{t('settings.transfer')}</span>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ color:'#7a4060', fontSize:'12px' }}>{t('settings.transfer_desc')}</span>
              <button
                style={ms.linkBtn}
                onClick={() => { onClose(); navigate('/banque'); }}
              >
                {t('settings.bank_link')}
              </button>
            </div>
          </div>

          {/* ID Ville */}
          <div style={ms.section}>
            <span style={ms.sectionTitle}>{t('settings.city_id')}</span>
            <div style={ms.villeRow}>
              <span style={{ color:'#7a4060', fontSize:'12px', fontFamily:'monospace', flex:1 }}>
                {t('settings.city_prefix')}{shortVilleId}
              </span>
            </div>
          </div>

          {/* Déconnexion */}
          <div style={ms.section}>
            <span style={ms.sectionTitle}>{t('settings.account')}</span>
            <button
              style={{ ...ms.saveBtn, background: 'rgba(220,50,50,0.08)', border: '1.5px solid rgba(220,50,50,0.25)', color: '#c43030' }}
              onClick={() => { disconnect(); onClose(); }}
            >
              {t('settings.disconnect')}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

const ms: Record<string, React.CSSProperties> = {
  overlay: {
    position:'absolute', inset:0, background:'rgba(0,0,0,0.35)',
    zIndex:300, display:'flex', alignItems:'flex-end',
  },
  panel: {
    background:'#fdf0f5', border:'1px solid rgba(212,100,138,0.2)',
    borderRadius:'22px 22px 0 0', width:'100%',
    maxHeight:'80vh', display:'flex', flexDirection:'column',
    overflow:'hidden',
  },
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'16px 20px 12px', borderBottom:'1px solid rgba(212,100,138,0.15)',
    flexShrink:0,
  },
  title:    { color:'#1e0a16', fontSize:'17px', fontWeight:700 },
  closeBtn: { color:'#7a4060', fontSize:'18px', background:'none', border:'none', cursor:'pointer', padding:'2px 6px' },
  body: {
    overflowY:'auto', flex:1, padding:'12px 20px 32px',
    display:'flex', flexDirection:'column', gap:0,
  },
  section: {
    padding:'14px 0',
    borderBottom:'1px solid rgba(212,100,138,0.08)',
    display:'flex', flexDirection:'column', gap:'8px',
  },
  sectionTitle: {
    color:'#1e0a16', fontSize:'13px', fontWeight:700,
  },
  langBtn: {
    padding:'6px 20px', borderRadius:10, border:'1.5px solid rgba(212,100,138,0.25)',
    background:'#ffffff', color:'#7a4060', fontSize:'13px', fontWeight:600,
    cursor:'pointer', transition:'all 0.15s',
  },
  langBtnActive: {
    background:'#c43070', color:'#ffffff', borderColor:'#c43070',
  },
  saveBtn: {
    padding:'10px 16px', borderRadius:12,
    background:'rgba(196,48,112,0.12)', border:'1.5px solid rgba(196,48,112,0.3)',
    color:'#c43070', fontSize:'13px', fontWeight:700,
    cursor:'pointer', textAlign:'left' as const,
  },
  infoRow: {
    display:'flex', alignItems:'center', gap:'8px',
    background:'#ffffff', border:'1px solid rgba(212,100,138,0.12)',
    borderRadius:10, padding:'8px 12px',
  },
  linkBtn: {
    padding:'5px 12px', borderRadius:8,
    background:'rgba(212,100,138,0.08)', border:'1px solid rgba(212,100,138,0.2)',
    color:'#c43070', fontSize:'11px', fontWeight:700, cursor:'pointer', flexShrink:0,
  },
  villeRow: {
    display:'flex', alignItems:'center', gap:'8px',
    background:'#ffffff', border:'1px solid rgba(212,100,138,0.12)',
    borderRadius:10, padding:'8px 12px',
  },
};
