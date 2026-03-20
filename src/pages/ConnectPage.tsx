import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { KirhaTokenImg } from '../assets/bucheron';
import { useGameStore } from '../store/gameStore';
import { useT } from '../utils/i18n';
import { KIRHA_GAME_ADDRESS } from '../contracts/addresses';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';

const PSEUDO_REGEX = /^[a-zA-Z0-9_]+$/;

function LangToggle() {
  const langue    = useGameStore(s => s.langue);
  const setLangue = useGameStore(s => s.setLangue);
  return (
    <div style={{ position:'absolute', top:14, right:14, display:'flex', gap:4 }}>
      {(['fr', 'en'] as const).map(l => (
        <button key={l} onClick={() => setLangue(l)} style={{
          padding:'4px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
          background: langue === l ? '#c43070' : 'rgba(212,100,138,0.08)',
          color:      langue === l ? '#fff'    : '#7a4060',
          border:     langue === l ? 'none'    : '1px solid rgba(212,100,138,0.2)',
        }}>
          {l === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
        </button>
      ))}
    </div>
  );
}

export function ConnectPage() {
  const { isConnected, address } = useAccount();
  const { disconnect }           = useDisconnect();
  const navigate                 = useNavigate();
  const publicClient             = usePublicClient();
  const { t }                    = useT();

  const setAddress  = useGameStore(s => s.setAddress);
  const setPseudo   = useGameStore(s => s.setPseudo);
  const setVilleId  = useGameStore(s => s.setVilleId);

  // 'login' = joueur existant, 'register' = nouveau joueur
  const [loginMode, setLoginMode]       = useState<'login' | 'register' | null>(null);
  const [pseudoInput, setPseudoInput]   = useState('');
  const [pseudoError, setPseudoError]   = useState<string | null>(null);
  const [registering, setRegistering]   = useState(false);
  const [relayerStep, setRelayerStep]   = useState<{ cityId: bigint; pseudo: string } | null>(null);
  const [relayerSigning, setRelayerSigning] = useState(false);
  const [relayerError, setRelayerError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  // ── Lire le pseudo on-chain pour l'adresse connectée ──────
  const { data: onChainPseudo, isLoading: pseudoLoading } = useReadContract({
    address:      KIRHA_GAME_ADDRESS,
    abi:          KirhaGameAbi,
    functionName: 'playerPseudo',
    args:         address ? [address] : undefined,
    query:        { enabled: !!address },
  });

  // ── Quand le pseudo est chargé ─────────────────────────────
  useEffect(() => {
    if (!isConnected || !address || pseudoLoading) return;
    const pseudo = onChainPseudo as string | undefined;
    if (pseudo && pseudo.length > 0) {
      // Joueur déjà enregistré → lire cityId puis entrer dans le jeu
      (async () => {
        // Petit délai pour laisser le RPC propager l'état
        await new Promise(r => setTimeout(r, 1500));
        const cityId = await publicClient?.readContract({
          address:      KIRHA_GAME_ADDRESS,
          abi:          KirhaGameAbi,
          functionName: 'playerCityId',
          args:         [address],
        }) as bigint | undefined;
        if (cityId !== undefined && cityId > 0n) {
          setVilleId(cityId.toString());
          // Vérifier si le relayer est déjà actif
          const relayerActive = await publicClient?.readContract({
            address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi,
            functionName: 'isRelayerActive', args: [cityId],
          }) as boolean | undefined;
          if (!relayerActive) {
            // Proposer l'activation du relayer
            setRelayerStep({ cityId, pseudo });
            return;
          }
        }
        setPseudo(pseudo);
        setAddress(address);
        navigate('/home', { replace: true });
      })();
    }
    // Sinon : rester sur la page (login mode ou register mode géré dans le rendu)
  }, [isConnected, address, pseudoLoading, onChainPseudo]);

  async function handleConfirmPseudo() {
    if (!address) return;

    const val = pseudoInput.trim();
    if (!val || val.length < 3 || val.length > 16 || !PSEUDO_REGEX.test(val)) {
      setPseudoError(t('connect.pseudo_invalid'));
      return;
    }

    setRegistering(true);
    setPseudoError(null);

    try {
      const available = await publicClient?.readContract({
        address:      KIRHA_GAME_ADDRESS,
        abi:          KirhaGameAbi,
        functionName: 'isPseudoAvailable',
        args:         [val],
      }) as boolean | undefined;

      if (available === false) {
        setPseudoError(t('connect.pseudo_taken'));
        setRegistering(false);
        return;
      }

      const hash = await writeContractAsync({
        address:      KIRHA_GAME_ADDRESS,
        abi:          KirhaGameAbi,
        functionName: 'registerPseudo',
        args:         [val],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });

      // Délai pour laisser le RPC propager l'état après la tx
      await new Promise(r => setTimeout(r, 1500));
      const cityId = await publicClient?.readContract({
        address:      KIRHA_GAME_ADDRESS,
        abi:          KirhaGameAbi,
        functionName: 'playerCityId',
        args:         [address],
      }) as bigint | undefined;
      if (cityId !== undefined && cityId > 0n) {
        setVilleId(cityId.toString());
      }
      setPseudo(val);
      setAddress(address);
      navigate('/home', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.includes('pseudo already taken') || msg.includes('taken')) {
        setPseudoError(t('connect.pseudo_taken'));
      } else if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setPseudoError('Transaction annulée.');
      } else {
        setPseudoError('Erreur lors de l\'enregistrement.');
      }
      setRegistering(false);
    }
  }

  async function handleActiverRelayer() {
    if (!relayerStep) return;
    setRelayerSigning(true);
    setRelayerError(null);
    try {
      const hash = await writeContractAsync({
        address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi,
        functionName: 'authorizeRelayer',
        args: [relayerStep.cityId, 43200n],
        chainId: baseSepolia.id,
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      if (relayerStep.cityId && address) localStorage.setItem(`kirha_relayer_at_${relayerStep.cityId.toString()}`, Date.now().toString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.includes('User rejected') || msg.includes('user rejected')) {
        // Skip comme si l'utilisateur avait cliqué "Passer"
      } else {
        setRelayerError(msg.slice(0, 80));
        setRelayerSigning(false);
        return;
      }
    }
    setPseudo(relayerStep.pseudo);
    setAddress(address!);
    navigate('/home', { replace: true });
  }

  function handleSkipRelayer() {
    if (!relayerStep || !address) return;
    setPseudo(relayerStep.pseudo);
    setAddress(address);
    navigate('/home', { replace: true });
  }

  function handleDisconnect() {
    disconnect();
    setLoginMode(null);
    setPseudoInput('');
    setPseudoError(null);
    setRelayerStep(null);
  }

  // ── Écran : proposition activation relayer 12h ────────────
  if (relayerStep) {
    return (
      <div style={s.page}>
        <div style={s.pseudoCard}>
          <span style={{ fontSize:44 }}>⚡</span>
          <h2 style={s.pseudoTitle}>Transactions sans frais</h2>
          <p style={{ ...s.pseudoSub, textAlign:'center' }}>
            Autorise le relayer pour <strong>12h</strong> afin que toutes tes actions en jeu (récolte, marché, sauvegarde) se fassent <strong>sans popup wallet</strong> et sans gas.
          </p>
          <div style={{ background:'rgba(196,48,112,0.06)', border:'1px solid rgba(196,48,112,0.15)', borderRadius:12, padding:'12px 16px', width:'100%', boxSizing:'border-box' as const }}>
            <p style={{ color:'#7a4060', fontSize:'11px', margin:0, lineHeight:1.6 }}>
              ✅ Une seule signature requise<br/>
              ✅ Gratuit (le relayer paie le gas)<br/>
              ✅ Expire automatiquement après 12h
            </p>
          </div>
          {relayerError && <p style={{ color:'#c43070', fontSize:'11px', margin:0 }}>{relayerError}</p>}
          <button
            onClick={handleActiverRelayer}
            disabled={relayerSigning}
            style={{ ...s.btnConfirm, opacity: relayerSigning ? 0.6 : 1 }}
          >
            {relayerSigning ? '⏳ Signature…' : '⚡ Activer le relayer 12h'}
          </button>
          <button onClick={handleSkipRelayer} style={s.btnBack}>
            Passer (utiliser le wallet directement)
          </button>
        </div>
      </div>
    );
  }

  // ── Écran : chargement pseudo ──────────────────────────────
  if (isConnected && pseudoLoading) {
    return (
      <div style={{ ...s.page, gap:16 }}>
        <span style={{ fontSize:36 }}>⏳</span>
        <p style={{ color:'#7a4060', fontSize:14 }}>Vérification du compte…</p>
      </div>
    );
  }

  // ── Écran : wallet connecté, mode login, pas de compte ─────
  if (isConnected && address && !(onChainPseudo as string) && loginMode === 'login') {
    return (
      <div style={s.page}>
        <LangToggle />
        <div style={s.pseudoCard}>
          <span style={{ fontSize:44 }}>❌</span>
          <h2 style={{ ...s.pseudoTitle, color:'#c43070' }}>Aucun compte trouvé</h2>
          <p style={{ ...s.pseudoSub, textAlign:'center' }}>
            Ce wallet n'a pas encore de compte To-Kirha.{'\n'}
            Déconnecte-toi et clique sur <strong>Créer une ville</strong> pour t'inscrire.
          </p>
          <button onClick={handleDisconnect} style={s.btnConfirm}>
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  // ── Écran : choix du pseudo (nouveau joueur) ───────────────
  if (isConnected && address && !(onChainPseudo as string) && loginMode === 'register') {
    return (
      <div style={s.page}>
        <LangToggle />
        <div style={s.pseudoCard}>
          <span style={{ fontSize:40 }}>🏙️</span>
          <h2 style={s.pseudoTitle}>{t('connect.choose_pseudo')}</h2>
          <p style={s.pseudoSub}>{t('connect.pseudo_info')}</p>

          <input
            type="text"
            placeholder={t('connect.pseudo_placeholder')}
            value={pseudoInput}
            maxLength={16}
            onChange={e => { setPseudoInput(e.target.value); if (pseudoError) setPseudoError(null); }}
            style={{ ...s.pseudoInput, borderColor: pseudoError ? '#c43070' : 'rgba(212,100,138,0.35)' }}
            onKeyDown={e => e.key === 'Enter' && handleConfirmPseudo()}
          />
          <p style={{ color:'#9a6080', fontSize:10, margin:'-8px 0 0', alignSelf:'flex-start' }}>
            3-16 caractères, lettres/chiffres/_
          </p>

          {pseudoError && <p style={s.pseudoErrorMsg}>{pseudoError}</p>}

          <button
            onClick={handleConfirmPseudo}
            disabled={registering || pseudoInput.trim().length < 3}
            style={{ ...s.btnConfirm, opacity: (registering || pseudoInput.trim().length < 3) ? 0.6 : 1 }}
          >
            {registering ? '⏳ Enregistrement…' : t('connect.confirm')}
          </button>
          <button onClick={handleDisconnect} style={s.btnBack}>
            {t('connect.back')}
          </button>
        </div>
      </div>
    );
  }

  // ── Écran principal (landing) ──────────────────────────────
  return (
    <div style={s.page}>
      <LangToggle />
      <div style={s.hero}>
        <div style={s.logoWrap}>
          {KirhaTokenImg
            ? <img src={KirhaTokenImg} alt="Kirha" style={s.logoImg} />
            : <span style={s.logoEmoji}>🌸</span>}
        </div>
        <h1 style={s.title}>To-Kirha</h1>
        <p style={s.tagline}>{t('connect.tagline')}</p>
      </div>

      <div style={s.featureCard}>
        {([
          ['⛏️', t('connect.feature_1')],
          ['📦', t('connect.feature_2')],
          ['💰', t('connect.feature_3')],
          ['🔗', t('connect.feature_4')],
          ['🌐', t('connect.feature_5')],
        ] as [string, string][]).map(([emoji, label]) => (
          <div key={label} style={s.feature}>
            <span style={s.featureEmoji}>{emoji}</span>
            <span style={s.featureLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* Deux boutons : connexion existante vs création */}
      <ConnectButton.Custom>
        {({ openConnectModal }) => (
          <div style={s.btnCol}>
            <button
              onClick={() => { setLoginMode('login'); openConnectModal(); }}
              type="button"
              style={s.btnLogin}
            >
              🔑 Se connecter
            </button>
            <button
              onClick={() => { setLoginMode('register'); openConnectModal(); }}
              type="button"
              style={s.btnCreate}
            >
              🏙️ {t('connect.create_city')}
            </button>
          </div>
        )}
      </ConnectButton.Custom>

      <p style={s.network}>{t('connect.network')}</p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { position:'absolute', inset:0, background:'#fdf0f5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', overflowY:'auto', paddingTop:'56px' },
  hero: { display:'flex', flexDirection:'column', alignItems:'center', marginBottom:'32px' },
  logoWrap:  { width:'96px', height:'96px', borderRadius:'48px', overflow:'hidden', border:'2px solid rgba(212,100,138,0.4)', marginBottom:'16px', boxShadow:'0 0 30px rgba(196,48,112,0.2)' },
  logoImg:   { width:'100%', height:'100%', objectFit:'cover' },
  logoEmoji: { fontSize:'44px', lineHeight:'96px', textAlign:'center', display:'block' },
  title:     { color:'#1e0a16', fontSize:'36px', fontWeight:'900', letterSpacing:'2px', margin:0 },
  tagline:   { color:'#7a4060', fontSize:'14px', marginTop:'6px', letterSpacing:'1px' },
  featureCard: { width:'100%', background:'#ffffff', border:'1px solid rgba(212,100,138,0.2)', borderRadius:'16px', padding:'20px', marginBottom:'28px', display:'flex', flexDirection:'column', gap:'14px' },
  feature:      { display:'flex', alignItems:'center', gap:'12px' },
  featureEmoji: { fontSize:'20px', width:'28px' },
  featureLabel: { color:'#7a4060', fontSize:'14px' },
  btnCol:   { width:'100%', display:'flex', flexDirection:'column', gap:'10px' },
  btnLogin: { width:'100%', padding:'14px 0', background:'rgba(196,48,112,0.08)', color:'#c43070', border:'2px solid rgba(196,48,112,0.3)', borderRadius:'12px', fontSize:'14px', fontWeight:700, cursor:'pointer', letterSpacing:'0.3px' },
  btnCreate:{ width:'100%', padding:'14px 0', background:'#c43070', color:'#ffffff', border:'none', borderRadius:'12px', fontSize:'14px', fontWeight:700, cursor:'pointer', letterSpacing:'0.3px' },
  network:  { color:'rgba(196,48,112,0.4)', fontSize:'11px', marginTop:'14px', letterSpacing:'0.5px' },
  pseudoCard: { width:'100%', maxWidth:'360px', background:'#ffffff', border:'1px solid rgba(212,100,138,0.25)', borderRadius:'20px', padding:'32px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', boxShadow:'0 4px 24px rgba(196,48,112,0.1)' },
  pseudoTitle:    { color:'#1e0a16', fontSize:'22px', fontWeight:800, margin:0 },
  pseudoSub:      { color:'#7a4060', fontSize:'13px', textAlign:'center', lineHeight:'1.6', margin:0 },
  pseudoInput:    { width:'100%', padding:'12px 14px', border:'2px solid rgba(212,100,138,0.35)', borderRadius:'10px', fontSize:'15px', color:'#1e0a16', outline:'none', background:'#fff8fb', boxSizing:'border-box' },
  pseudoErrorMsg: { color:'#c43070', fontSize:'12px', textAlign:'center', margin:0 },
  btnConfirm: { width:'100%', padding:'13px 0', background:'#c43070', color:'#ffffff', border:'none', borderRadius:'12px', fontSize:'15px', fontWeight:700, cursor:'pointer' },
  btnBack:    { background:'none', border:'none', color:'#7a4060', fontSize:'13px', cursor:'pointer', padding:'4px 0', textDecoration:'underline' },
};
