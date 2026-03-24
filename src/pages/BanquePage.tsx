import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useWithdraw } from '../hooks/useWithdraw';
import { useDeposit } from '../hooks/useDeposit';
import { useVip, VIP_PACKS, VIP_DURATIONS } from '../hooks/useVip';
import { useGameStore } from '../store/gameStore';
import { useT } from '../utils/i18n';
import { uiAssetPath } from '../utils/resourceUtils';
import { KIRHA_TOKEN_ADDRESS } from '../contracts/addresses';

export function BanquePage() {
  const navigate    = useNavigate();
  const { address } = useAccount();
  const { retirer, status: withdrawStatus, error: withdrawError, soldeKirha } = useWithdraw();
  const { deposer, status: depositStatus, error: depositError, balanceKirha } = useDeposit();
  const { acheterPepites, acheterVip, status: vipStatus, error: vipError } = useVip();
  const soldeKirhaStore = useGameStore(s => s.soldeKirha);
  const pepitesOr  = useGameStore(s => s.pepitesOr);
  const vipExpiry  = useGameStore(s => s.vipExpiry);
  const now = Math.floor(Date.now() / 1000);
  const isVip = vipExpiry > 0 && vipExpiry > now;
  const vipRemainingDays = isVip ? Math.ceil((vipExpiry - now) / 86400) : 0;
  const [montantRetrait, setMontantRetrait] = useState('');
  const [montantDepot, setMontantDepot]     = useState('');
  const [watchStatus, setWatchStatus]       = useState<'idle'|'ok'|'err'>('idle');
  const { t } = useT();

  const addKirhaToWallet = async () => {
    try {
      await (window as any).ethereum?.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address:  KIRHA_TOKEN_ADDRESS,
            symbol:   'KIRHA',
            decimals: 18,
            image:    'https://to-kirha.com/assets/token/kirha_token.jpg',
          },
        },
      });
      setWatchStatus('ok');
    } catch {
      setWatchStatus('err');
    }
    setTimeout(() => setWatchStatus('idle'), 3000);
  };

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/home')}>{t('banque.back_home')}</button>
        <span style={s.headerTitle}>{t('banque.title')}</span>
        <div style={{ width:80 }} />
      </div>

      <div style={{ padding:'16px', paddingBottom:90 }}>

        {/* Récap soldes */}
        <div style={{ display:'flex', gap:10, marginBottom:12 }}>
          <div style={{ flex:1, background:'linear-gradient(135deg, rgba(196,48,112,0.08), rgba(138,37,212,0.05))', border:'1px solid rgba(196,48,112,0.2)', borderRadius:14, padding:'12px 14px', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <span style={{ fontSize:20 }}>💠</span>
            <span style={{ color:'#1e0a16', fontSize:18, fontWeight:900 }}>{soldeKirhaStore > 0 ? soldeKirhaStore.toFixed(4) : '0'}</span>
            <span style={{ color:'#9a6080', fontSize:10, fontWeight:700 }}>$KIRHA IN-GAME</span>
          </div>
          <div style={{ flex:1, background:'linear-gradient(135deg, rgba(249,168,37,0.1), rgba(196,48,112,0.04))', border:'1px solid rgba(249,168,37,0.25)', borderRadius:14, padding:'12px 14px', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <span style={{ fontSize:20 }}>🪙</span>
            <span style={{ color:'#f9a825', fontSize:18, fontWeight:900 }}>{pepitesOr > 0 ? pepitesOr.toFixed(0) : '0'}</span>
            <span style={{ color:'#9a6080', fontSize:10, fontWeight:700 }}>PÉPITES D'OR</span>
          </div>
        </div>

        {/* Wallet */}
        <div style={s.walletCard}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
            <span style={{ fontSize:'28px' }}>💎</span>
            <div>
              <p style={{ color:'#1e0a16', fontSize:'14px', fontWeight:700, margin:0 }}>{t('banque.wallet_connected')}</p>
              <p style={{ color:'#8a25d4', fontSize:'11px', margin:'2px 0 0', fontFamily:'monospace' }}>{short}</p>
            </div>
          </div>
          <div style={s.divider} />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'10px' }}>
            <span style={{ color:'#7a4060', fontSize:'12px' }}>{t('banque.balance_kirha')}</span>
            <span style={{ color:'#8a25d4', fontSize:'16px', fontWeight:900 }}>{balanceKirha.toFixed(2)} $K</span>
          </div>
          <button
            style={{ marginTop:12, width:'100%', padding:'8px', background:'rgba(138,37,212,0.08)', border:'1px solid rgba(138,37,212,0.2)', borderRadius:10, color:'#8a25d4', fontSize:'12px', fontWeight:600, cursor:'pointer' }}
            onClick={addKirhaToWallet}
          >
            {watchStatus === 'ok' ? '✅ $KIRHA ajouté' : watchStatus === 'err' ? '❌ Erreur' : '+ Ajouter $KIRHA au wallet'}
          </button>
        </div>

        {/* Retrait / Dépôt $KIRHA */}
        <div style={s.saveCard}>
          <p style={{ color:'#1e0a16', fontSize:'14px', fontWeight:700, margin:'0 0 12px' }}>💠 $KIRHA — Retrait / Dépôt</p>

          {/* Retrait */}
          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ color:'#7a4060', fontSize:'12px', fontWeight:700 }}>{t('banque.withdraw_title')} · {soldeKirha.toFixed(2)} $K dispo</span>
              <button style={s.maxBtn} onClick={() => setMontantRetrait(soldeKirha.toFixed(2))}>MAX</button>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input
                type="number" min="0" max={soldeKirha} step="0.01"
                value={montantRetrait}
                onChange={e => setMontantRetrait(e.target.value)}
                placeholder={t('banque.amount_placeholder')}
                style={s.inputField}
              />
              <button
                style={{ ...s.actionBtn, background:'linear-gradient(135deg,#c43070,#8a25d4)', opacity: withdrawStatus === 'pending' || withdrawStatus === 'signing' ? 0.6 : 1 }}
                onClick={() => retirer(parseFloat(montantRetrait) || 0)}
                disabled={!montantRetrait || parseFloat(montantRetrait) <= 0 || parseFloat(montantRetrait) > soldeKirha || withdrawStatus === 'pending' || withdrawStatus === 'signing'}
              >
                {withdrawStatus === 'pending' ? '⏳' : withdrawStatus === 'signing' ? '✍️' : withdrawStatus === 'success' ? '✅' : '→ Retirer'}
              </button>
            </div>
            {withdrawError && <p style={{ color:'#c43070', fontSize:'10px', margin:'4px 0 0' }}>{withdrawError}</p>}
          </div>

          <div style={{ height:1, background:'rgba(212,100,138,0.1)', margin:'4px 0 12px' }} />

          {/* Dépôt */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ color:'#7a4060', fontSize:'12px', fontWeight:700 }}>Déposer · {balanceKirha.toFixed(2)} $K wallet</span>
              <button style={s.maxBtn} onClick={() => setMontantDepot(balanceKirha.toFixed(2))}>MAX</button>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input
                type="number" min="0" max={balanceKirha} step="0.01"
                value={montantDepot}
                onChange={e => setMontantDepot(e.target.value)}
                placeholder="Montant à déposer"
                style={{ ...s.inputField, borderColor:'rgba(138,37,212,0.3)' }}
              />
              <button
                style={{ ...s.actionBtn, background:'linear-gradient(135deg,#8a25d4,#5b10a0)', opacity: depositStatus === 'pending' || depositStatus === 'signing' ? 0.6 : 1 }}
                onClick={() => deposer(parseFloat(montantDepot) || 0)}
                disabled={!montantDepot || parseFloat(montantDepot) <= 0 || parseFloat(montantDepot) > balanceKirha || depositStatus === 'pending' || depositStatus === 'signing'}
              >
                {depositStatus === 'pending' ? '⏳' : depositStatus === 'signing' ? '✍️' : depositStatus === 'success' ? '✅' : '← Déposer'}
              </button>
            </div>
            {depositError && <p style={{ color:'#c43070', fontSize:'10px', margin:'4px 0 0' }}>{depositError}</p>}
          </div>
        </div>

        {/* Pépites d'or — achat avec $KIRHA */}
        <div style={s.saveCard}>
          <p style={{ color:'#f9a825', fontSize:'14px', fontWeight:700, margin:'0 0 4px' }}>🪙 Pépites d'or</p>
          <p style={{ color:'#7a4060', fontSize:'11px', margin:'0 0 12px' }}>
            Solde : <strong style={{color:'#f9a825'}}>{pepitesOr.toFixed(0)}</strong> pépites · {soldeKirhaStore.toFixed(2)} $KIRHA disponibles
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {VIP_PACKS.map(pack => (
              <button
                key={pack.type}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'rgba(249,168,37,0.07)', border:'1px solid rgba(249,168,37,0.2)', borderRadius:10, cursor: soldeKirhaStore < pack.kirha ? 'not-allowed' : 'pointer', opacity: soldeKirhaStore < pack.kirha ? 0.5 : 1 }}
                onClick={() => acheterPepites(pack.type)}
                disabled={vipStatus === 'pending' || soldeKirhaStore < pack.kirha}
              >
                <div style={{textAlign:'left'}}>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    <img src={uiAssetPath(`ui/pepites/${pack.pepites}.png`)} alt="" style={{width:28, height:28, objectFit:'contain'}} />
                    <span style={{color:'#f9a825', fontSize:'13px', fontWeight:700}}>{pack.pepites} pépites</span>
                    {pack.bonus && <span style={{color:'#6abf44', fontSize:'9px', fontWeight:700}}>{pack.bonus}</span>}
                  </div>
                  <span style={{display:'block', color:'#7a4060', fontSize:'10px'}}>Pack {pack.label}</span>
                </div>
                <span style={{color:'#1e0a16', fontSize:'12px', fontWeight:800}}>{pack.kirha} $K</span>
              </button>
            ))}
          </div>
          {vipError && vipStatus === 'error' && <p style={{color:'#c43070', fontSize:'10px', margin:'8px 0 0'}}>{vipError}</p>}
        </div>

        {/* VIP — achat avec pépites */}
        <div style={s.saveCard}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
            <img src={uiAssetPath('ui/vip.png')} alt="" style={{width:24, height:24, objectFit:'contain'}} />
            <p style={{ color:'#c43070', fontSize:'14px', fontWeight:700, margin:0 }}>Statut VIP</p>
            {isVip && <span style={{ background:'linear-gradient(135deg,#f9a825,#c43070)', color:'#fff', fontSize:'9px', fontWeight:800, padding:'2px 7px', borderRadius:6 }}>ACTIF ✨</span>}
          </div>
          {isVip ? (
            <p style={{color:'#6abf44', fontSize:'12px', margin:'0 0 12px'}}>
              VIP actif — expire le {new Date(vipExpiry * 1000).toLocaleDateString('fr-FR')}
            </p>
          ) : (
            <p style={{color:'#7a4060', fontSize:'11px', margin:'0 0 12px'}}>
              Avantage VIP : taxe HDV réduite de 50% → 25%
            </p>
          )}
          {isVip && vipRemainingDays > 0 && (
            <p style={{ color:'#f9a825', fontSize:'11px', margin:'0 0 10px' }}>
              ⏳ Il vous reste <strong>{vipRemainingDays} jours</strong> de VIP. L'achat prolongera votre abonnement.
            </p>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {VIP_DURATIONS.map(dur => {
              const durDays = [7, 30, 90][dur.type] ?? 0;
              // Désactiver les options plus courtes si VIP actif avec plus de jours restants
              const isRedundant = isVip && vipRemainingDays >= durDays;
              const resultingExpiry = isVip
                ? new Date((vipExpiry + durDays * 86400) * 1000).toLocaleDateString('fr-FR')
                : null;
              const disabled = vipStatus === 'pending' || pepitesOr < dur.pepites || isRedundant;
              return (
                <button
                  key={dur.type}
                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background: isRedundant ? 'rgba(0,0,0,0.03)' : 'rgba(196,48,112,0.07)', border: isRedundant ? '1px dashed rgba(196,48,112,0.15)' : '1px solid rgba(196,48,112,0.2)', borderRadius:10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1 }}
                  onClick={() => acheterVip(dur.type)}
                  disabled={disabled}
                >
                  <div style={{ textAlign:'left' }}>
                    <span style={{color:'#1e0a16', fontSize:'13px', fontWeight:700}}>{dur.label}</span>
                    {resultingExpiry && !isRedundant && (
                      <span style={{display:'block', color:'#9a6080', fontSize:'9px'}}>→ expire le {resultingExpiry}</span>
                    )}
                    {isRedundant && (
                      <span style={{display:'block', color:'#9a6080', fontSize:'9px'}}>Déjà couvert par votre VIP actuel</span>
                    )}
                  </div>
                  <span style={{color:'#c43070', fontSize:'12px', fontWeight:800}}>🪙 {dur.pepites}</span>
                </button>
              );
            })}
          </div>
          {vipStatus === 'success' && <p style={{color:'#6abf44', fontSize:'11px', margin:'8px 0 0'}}>✅ VIP activé !</p>}
        </div>

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:    { position:'absolute', inset:0, background:'#fdf0f5', overflowY:'auto' },
  header:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'rgba(253,240,245,0.96)', backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(212,100,138,0.15)', position:'sticky', top:0, zIndex:10 },
  backBtn: { color:'#7a4060', fontSize:'13px', fontWeight:600, background:'none', border:'none', cursor:'pointer' },
  headerTitle: { color:'#1e0a16', fontSize:'16px', fontWeight:800 },
  walletCard: { background:'#ffffff', border:'1px solid rgba(138,37,212,0.25)', borderRadius:14, padding:'16px', marginBottom:12 },
  divider: { height:1, background:'rgba(212,100,138,0.08)' },
  saveCard: { background:'#ffffff', border:'1px solid rgba(212,100,138,0.2)', borderRadius:14, padding:'16px', marginBottom:12 },
  saveBtn: { width:'100%', padding:'12px', background:'linear-gradient(135deg, #c43070, #8a25d4)', color:'#fdf0f5', border:'none', borderRadius:12, fontSize:'14px', fontWeight:700, cursor:'pointer' },
  saveBtnPurple: { width:'100%', padding:'12px', background:'linear-gradient(135deg, #8a25d4, #5b10a0)', color:'#fdf0f5', border:'none', borderRadius:12, fontSize:'14px', fontWeight:700, cursor:'pointer' },
  maxBtn: { padding:'3px 10px', borderRadius:8, border:'1px solid rgba(196,48,112,0.3)', background:'rgba(196,48,112,0.07)', color:'#c43070', fontSize:'10px', fontWeight:800, cursor:'pointer' },
  inputField: { flex:1, padding:'10px 12px', borderRadius:10, border:'1.5px solid rgba(212,100,138,0.3)', background:'#ffffff', color:'#1e0a16', fontSize:'13px', outline:'none' } as React.CSSProperties,
  actionBtn: { flex:'none', padding:'10px 14px', borderRadius:10, border:'none', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' } as React.CSSProperties,
  comingCard: { display:'flex', alignItems:'center', gap:'12px', background:'rgba(212,100,138,0.04)', border:'1px solid rgba(212,100,138,0.13)', borderRadius:12, padding:'14px', marginBottom:10 },
};
