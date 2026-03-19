import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { KirhaTokenImg } from '../assets/bucheron';
import { useGameStore } from '../store/gameStore';
import { assignNewCityId, hasCityId, getOrCreateCityId } from '../utils/cityId';
import { useT } from '../utils/i18n';

function LangToggle() {
  const langue    = useGameStore(s => s.langue);
  const setLangue = useGameStore(s => s.setLangue);
  return (
    <div style={{ position:'absolute', top:14, right:14, display:'flex', gap:4 }}>
      {(['fr', 'en'] as const).map(l => (
        <button
          key={l}
          onClick={() => setLangue(l)}
          style={{
            padding:'4px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
            background: langue === l ? '#c43070' : 'rgba(212,100,138,0.08)',
            color:      langue === l ? '#fff'    : '#7a4060',
            border:     langue === l ? 'none'    : '1px solid rgba(212,100,138,0.2)',
          }}
        >
          {l === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
        </button>
      ))}
    </div>
  );
}

const PSEUDO_STORAGE_KEY = 'kirha_pseudos';
const PSEUDO_REGEX = /^[a-zA-Z0-9_]+$/;

function getStoredPseudos(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PSEUDO_STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function addStoredPseudo(pseudo: string): void {
  const existing = getStoredPseudos();
  if (!existing.includes(pseudo)) {
    localStorage.setItem(PSEUDO_STORAGE_KEY, JSON.stringify([...existing, pseudo]));
  }
}

export function ConnectPage() {
  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const { t } = useT();

  const setAddress  = useGameStore((s) => s.setAddress);
  const setPseudo   = useGameStore((s) => s.setPseudo);
  const storeAddress = useGameStore((s) => s.address);
  const villeId     = useGameStore((s) => s.villeId);

  const [mode, setMode]         = useState<'create' | 'connect' | null>(null);
  const [step, setStep]         = useState<'choose' | 'pseudo'>('choose');
  const [pseudoInput, setPseudoInput] = useState('');
  const [pseudoError, setPseudoError] = useState<string | null>(null);

  // After wallet connects, decide where to go
  useEffect(() => {
    if (!isConnected || !address) return;

    const alreadyHasCity =
      (storeAddress === address && villeId && Number(villeId) >= 1) ||
      hasCityId();

    if (alreadyHasCity) {
      // Wallet already owns a city — go home regardless of mode
      navigate('/home', { replace: true });
      return;
    }

    if (mode === 'connect') {
      // New wallet via "Se connecter" — auto-create city and go home
      getOrCreateCityId();
      setAddress(address);
      navigate('/home', { replace: true });
      return;
    }

    if (mode === 'create') {
      // New wallet via "Créer une ville" — ask for pseudo
      setStep('pseudo');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  function handleCreateClick() {
    setMode('create');
    openConnectModal?.();
  }

  function handleConnectClick() {
    setMode('connect');
    openConnectModal?.();
  }

  function handleBack() {
    setStep('choose');
    setPseudoInput('');
    setPseudoError(null);
    setMode(null);
    disconnect();
  }

  function validatePseudo(value: string): string | null {
    if (!value.trim()) return t('connect.pseudo_invalid');
    if (value.length < 3)  return t('connect.pseudo_invalid');
    if (value.length > 16) return t('connect.pseudo_invalid');
    if (!PSEUDO_REGEX.test(value)) return t('connect.pseudo_invalid');
    if (getStoredPseudos().includes(value)) return t('connect.pseudo_taken');
    return null;
  }

  function handleConfirmPseudo() {
    const error = validatePseudo(pseudoInput);
    if (error) {
      setPseudoError(error);
      return;
    }

    const newCityId = assignNewCityId();
    setPseudo(pseudoInput);
    if (address) setAddress(address);
    addStoredPseudo(pseudoInput);

    // Persist villeId into the store (store already reacts via getOrCreateCityId on init,
    // but we need to reflect the new one assigned here)
    // We use localStorage directly so the Zustand persist picks it up on next rehydrate,
    // but also update the city_id key so hasCityId() returns true immediately.
    localStorage.setItem('kirha_city_id', newCityId);

    navigate('/home', { replace: true });
  }

  // ─── Render : step === 'pseudo' ────────────────────────────────────────────
  if (step === 'pseudo') {
    return (
      <div style={s.page}>
        <div style={s.pseudoCard}>
          <h2 style={s.pseudoTitle}>{t('connect.choose_pseudo')}</h2>
          <p style={s.pseudoSub}>
            {t('connect.pseudo_info')}
          </p>

          <input
            type="text"
            placeholder={t('connect.pseudo_placeholder')}
            value={pseudoInput}
            maxLength={16}
            onChange={(e) => {
              setPseudoInput(e.target.value);
              if (pseudoError) setPseudoError(null);
            }}
            style={s.pseudoInput}
          />

          {pseudoError && <p style={s.pseudoErrorMsg}>{pseudoError}</p>}

          <button onClick={handleConfirmPseudo} style={s.btnConfirm}>
            {t('connect.confirm')}
          </button>

          <button onClick={handleBack} style={s.btnBack}>
            {t('connect.back')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Render : step === 'choose' ────────────────────────────────────────────
  return (
    <div style={s.page}>
      <LangToggle />
      <div style={s.hero}>
        <div style={s.logoWrap}>
          {KirhaTokenImg ? (
            <img src={KirhaTokenImg} alt="Kirha" style={s.logoImg} />
          ) : (
            <span style={s.logoEmoji}>🌸</span>
          )}
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

      <div style={s.btnRow}>
        <button onClick={handleCreateClick} style={s.btnCreate}>
          🏙️ {t('connect.create_city')}
        </button>
        <button onClick={handleConnectClick} style={s.btnConnect}>
          🔑 {t('connect.sign_in')}
        </button>
      </div>

      <p style={s.network}>{t('connect.network')}</p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    position:       'absolute',
    inset:          0,
    background:     '#fdf0f5',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '24px',
    overflowY:      'auto',
    paddingTop:     '56px',
  },

  // ── hero ──
  hero: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    marginBottom:  '32px',
  },
  logoWrap: {
    width:        '96px',
    height:       '96px',
    borderRadius: '48px',
    overflow:     'hidden',
    border:       '2px solid rgba(212,100,138,0.4)',
    marginBottom: '16px',
    boxShadow:    '0 0 30px rgba(196,48,112,0.2)',
  },
  logoImg:   { width: '100%', height: '100%', objectFit: 'cover' },
  logoEmoji: { fontSize: '44px', lineHeight: '96px', textAlign: 'center', display: 'block' },
  title: {
    color:         '#1e0a16',
    fontSize:      '36px',
    fontWeight:    '900',
    letterSpacing: '2px',
    margin:        0,
  },
  tagline: {
    color:         '#7a4060',
    fontSize:      '14px',
    marginTop:     '6px',
    letterSpacing: '1px',
  },

  // ── feature card ──
  featureCard: {
    width:         '100%',
    background:    '#ffffff',
    border:        '1px solid rgba(212,100,138,0.2)',
    borderRadius:  '16px',
    padding:       '20px',
    marginBottom:  '28px',
    display:       'flex',
    flexDirection: 'column',
    gap:           '14px',
  },
  feature:      { display: 'flex', alignItems: 'center', gap: '12px' },
  featureEmoji: { fontSize: '20px', width: '28px' },
  featureLabel: { color: '#7a4060', fontSize: '14px' },

  // ── buttons row ──
  btnRow: {
    width:   '100%',
    display: 'flex',
    gap:     '12px',
  },
  btnCreate: {
    flex:          1,
    padding:       '14px 0',
    background:    '#c43070',
    color:         '#ffffff',
    border:        'none',
    borderRadius:  '12px',
    fontSize:      '14px',
    fontWeight:    700,
    cursor:        'pointer',
    letterSpacing: '0.3px',
  },
  btnConnect: {
    flex:          1,
    padding:       '14px 0',
    background:    '#ffffff',
    color:         '#c43070',
    border:        '2px solid #c43070',
    borderRadius:  '12px',
    fontSize:      '14px',
    fontWeight:    700,
    cursor:        'pointer',
    letterSpacing: '0.3px',
  },

  // ── network label ──
  network: {
    color:         'rgba(196,48,112,0.4)',
    fontSize:      '11px',
    marginTop:     '14px',
    letterSpacing: '0.5px',
  },

  // ── pseudo screen ──
  pseudoCard: {
    width:         '100%',
    maxWidth:      '360px',
    background:    '#ffffff',
    border:        '1px solid rgba(212,100,138,0.25)',
    borderRadius:  '20px',
    padding:       '32px 24px',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           '16px',
    boxShadow:     '0 4px 24px rgba(196,48,112,0.1)',
  },
  pseudoTitle: {
    color:      '#1e0a16',
    fontSize:   '22px',
    fontWeight: 800,
    margin:     0,
  },
  pseudoSub: {
    color:      '#7a4060',
    fontSize:   '13px',
    textAlign:  'center',
    lineHeight: '1.6',
    margin:     0,
  },
  pseudoInput: {
    width:        '100%',
    padding:      '12px 14px',
    border:       '2px solid rgba(212,100,138,0.35)',
    borderRadius: '10px',
    fontSize:     '15px',
    color:        '#1e0a16',
    outline:      'none',
    background:   '#fff8fb',
    boxSizing:    'border-box',
  },
  pseudoErrorMsg: {
    color:      '#c43070',
    fontSize:   '12px',
    textAlign:  'center',
    margin:     0,
  },
  btnConfirm: {
    width:        '100%',
    padding:      '13px 0',
    background:   '#c43070',
    color:        '#ffffff',
    border:       'none',
    borderRadius: '12px',
    fontSize:     '15px',
    fontWeight:   700,
    cursor:       'pointer',
  },
  btnBack: {
    background:    'none',
    border:        'none',
    color:         '#7a4060',
    fontSize:      '13px',
    cursor:        'pointer',
    padding:       '4px 0',
    textDecoration: 'underline',
  },
};
