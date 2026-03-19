import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useSave } from '../hooks/useSave';
import { useDisconnect, useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { useT } from '../utils/i18n';
import { KIRHA_CITY_ADDRESS } from '../contracts/addresses';
import KirhaCityAbi from '../contracts/abis/KirhaCity.json';

interface SettingsModalProps {
  onClose: () => void;
}

const ADDR_REGEX = /^0x[0-9a-fA-F]{40}$/;

export function SettingsModal({ onClose }: SettingsModalProps) {
  const navigate     = useNavigate();
  const langue       = useGameStore(s => s.langue);
  const setLangue    = useGameStore(s => s.setLangue);
  const villeId      = useGameStore(s => s.villeId);
  const pseudo       = useGameStore(s => s.pseudo);
  const { sauvegarder, status: saveStatus, pendingCount } = useSave();
  const { disconnect } = useDisconnect();
  const { address }  = useAccount();
  const { t } = useT();

  // ── Transfert de ville ────────────────────────────────────
  const [showTransfer, setShowTransfer]     = useState(false);
  const [transferTo, setTransferTo]         = useState('');
  const [transferStatus, setTransferStatus] = useState<'idle'|'signing'|'pending'|'success'|'error'>('idle');
  const [transferError, setTransferError]   = useState<string | null>(null);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const shortWallet = address ? `${address.slice(0,6)}…${address.slice(-4)}` : '—';

  async function handleTransfer() {
    if (!address || !villeId || villeId === '0') return;
    if (!ADDR_REGEX.test(transferTo) || transferTo.toLowerCase() === address.toLowerCase()) {
      setTransferError('Adresse invalide ou identique à la tienne.');
      return;
    }
    setTransferError(null);
    setTransferStatus('signing');
    try {
      const hash = await writeContractAsync({
        address:      KIRHA_CITY_ADDRESS,
        abi:          KirhaCityAbi,
        functionName: 'safeTransferFrom',
        args:         [address, transferTo as `0x${string}`, BigInt(villeId)],
      });
      setTransferStatus('pending');
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      setTransferStatus('success');
      // Déconnecter et retourner à l'accueil après transfert
      setTimeout(() => {
        disconnect();
        onClose();
        navigate('/', { replace: true });
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      setTransferError(msg.includes('User rejected') ? 'Transaction annulée.' : msg.slice(0, 80));
      setTransferStatus('error');
    }
  }

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={ms.header}>
          <span style={ms.title}>{t('settings.title')}</span>
          <button style={ms.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={ms.body}>

          {/* Identité */}
          <div style={ms.section}>
            <span style={ms.sectionTitle}>Identité</span>
            <div style={ms.infoRow}>
              <span style={{ fontSize:18 }}>🏙️</span>
              <div style={{ flex:1 }}>
                <span style={{ color:'#1e0a16', fontSize:'15px', fontWeight:800 }}>{pseudo ?? '—'}</span>
                <span style={{ color:'#9a6080', fontSize:'10px', display:'block' }}>
                  {villeId ? `Ville #${villeId}` : '…'} · {shortWallet}
                </span>
              </div>
            </div>
          </div>

          {/* Langue */}
          <div style={ms.section}>
            <span style={ms.sectionTitle}>{t('settings.language')}</span>
            <div style={{ display:'flex', gap:'8px' }}>
              {(['fr','en'] as const).map(l => (
                <button
                  key={l}
                  style={{ ...ms.langBtn, ...(langue === l ? ms.langBtnActive : {}) }}
                  onClick={() => setLangue(l)}
                >
                  {l === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
                </button>
              ))}
            </div>
          </div>

          {/* Sauvegarde manuelle */}
          <div style={ms.section}>
            <span style={ms.sectionTitle}>{t('settings.save')}</span>
            <button
              style={{ ...ms.saveBtn, opacity: saveStatus === 'pending' || saveStatus === 'signing' ? 0.6 : 1 }}
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

          {/* Transfert $KIRHA */}
          <div style={ms.section}>
            <span style={ms.sectionTitle}>{t('settings.transfer')}</span>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ color:'#7a4060', fontSize:'12px' }}>{t('settings.transfer_desc')}</span>
              <button style={ms.linkBtn} onClick={() => { onClose(); navigate('/banque'); }}>
                {t('settings.bank_link')}
              </button>
            </div>
          </div>

          {/* Transfert de ville NFT */}
          <div style={ms.section}>
            <span style={ms.sectionTitle}>🏙️ Transférer ma ville</span>
            <p style={{ color:'#7a4060', fontSize:'11px', margin:'0 0 8px', lineHeight:'1.5' }}>
              Transfère le NFT de ta ville à une autre adresse.
              <strong style={{ color:'#c43070' }}> Ressources, niveaux et $KIRHA suivent automatiquement.</strong>
            </p>

            {!showTransfer ? (
              <button
                style={{ ...ms.saveBtn, background:'rgba(196,48,112,0.07)', border:'1.5px solid rgba(196,48,112,0.2)' }}
                onClick={() => setShowTransfer(true)}
              >
                Transférer la ville…
              </button>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <input
                  type="text"
                  placeholder="0x… adresse destination"
                  value={transferTo}
                  onChange={e => { setTransferTo(e.target.value); setTransferError(null); }}
                  style={ms.input}
                  disabled={transferStatus === 'signing' || transferStatus === 'pending'}
                />
                {transferError && (
                  <p style={{ color:'#c43070', fontSize:'11px', margin:0 }}>{transferError}</p>
                )}
                {transferStatus === 'success' && (
                  <p style={{ color:'#6abf44', fontSize:'11px', margin:0 }}>✓ Ville transférée ! Déconnexion…</p>
                )}
                <div style={{ display:'flex', gap:8 }}>
                  <button
                    style={{ ...ms.saveBtn, flex:1, background:'rgba(220,50,50,0.08)', border:'1.5px solid rgba(220,50,50,0.2)', color:'#c43030' }}
                    onClick={() => { setShowTransfer(false); setTransferTo(''); setTransferError(null); setTransferStatus('idle'); }}
                    disabled={transferStatus === 'signing' || transferStatus === 'pending'}
                  >
                    Annuler
                  </button>
                  <button
                    style={{ ...ms.saveBtn, flex:2, background:'#c43070', color:'#fff', border:'none',
                      opacity: (transferStatus === 'signing' || transferStatus === 'pending' || !ADDR_REGEX.test(transferTo)) ? 0.6 : 1 }}
                    onClick={handleTransfer}
                    disabled={transferStatus === 'signing' || transferStatus === 'pending' || !ADDR_REGEX.test(transferTo)}
                  >
                    {transferStatus === 'signing' ? '✍️ Signature…'
                      : transferStatus === 'pending' ? '⏳ En cours…'
                      : '⚠️ Confirmer le transfert'}
                  </button>
                </div>
              </div>
            )}
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
  sectionTitle: { color:'#1e0a16', fontSize:'13px', fontWeight:700 },
  langBtn: {
    padding:'6px 20px', borderRadius:10, border:'1.5px solid rgba(212,100,138,0.25)',
    background:'#ffffff', color:'#7a4060', fontSize:'13px', fontWeight:600,
    cursor:'pointer',
  },
  langBtnActive: { background:'#c43070', color:'#ffffff', borderColor:'#c43070' },
  saveBtn: {
    padding:'10px 16px', borderRadius:12,
    background:'rgba(196,48,112,0.12)', border:'1.5px solid rgba(196,48,112,0.3)',
    color:'#c43070', fontSize:'13px', fontWeight:700,
    cursor:'pointer', textAlign:'left' as const,
  },
  infoRow: {
    display:'flex', alignItems:'center', gap:'10px',
    background:'#ffffff', border:'1px solid rgba(212,100,138,0.12)',
    borderRadius:12, padding:'10px 14px',
  },
  linkBtn: {
    padding:'5px 12px', borderRadius:8,
    background:'rgba(212,100,138,0.08)', border:'1px solid rgba(212,100,138,0.2)',
    color:'#c43070', fontSize:'11px', fontWeight:700, cursor:'pointer', flexShrink:0,
  },
  input: {
    width:'100%', padding:'10px 12px', border:'1.5px solid rgba(212,100,138,0.3)',
    borderRadius:10, fontSize:'12px', color:'#1e0a16', background:'#fff8fb',
    boxSizing:'border-box' as const, fontFamily:'monospace',
  },
};
