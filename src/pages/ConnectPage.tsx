import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { KirhaTokenImg } from '../assets/bucheron';

export function ConnectPage() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (isConnected) navigate('/ville', { replace: true });
  }, [isConnected, navigate]);

  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div style={s.logoWrap}>
          {KirhaTokenImg ? (
            <img src={KirhaTokenImg} alt="Kirha" style={s.logoImg} />
          ) : (
            <span style={s.logoEmoji}>🌸</span>
          )}
        </div>
        <h1 style={s.title}>To-Kirha</h1>
        <p style={s.tagline}>Récolte. Échange. Prospère.</p>
      </div>

      <div style={s.featureCard}>
        {[
          ['⛏️', '5 métiers de récolte'],
          ['📦', 'Ressources NFT ERC-1155'],
          ['💰', 'Token $Kirha sur Base'],
          ['🔗', 'Sauvegarde on-chain'],
          ['🌐', 'Web app — aucune appli à installer'],
        ].map(([emoji, label]) => (
          <div key={label} style={s.feature}>
            <span style={s.featureEmoji}>{emoji}</span>
            <span style={s.featureLabel}>{label}</span>
          </div>
        ))}
      </div>

      <div style={s.connectWrap}>
        <ConnectButton label="Connecter mon wallet" />
      </div>

      <p style={s.network}>Base Sepolia Testnet</p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight:      '100vh',
    background:     '#080f08',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '24px',
    maxWidth:       '480px',
    margin:         '0 auto',
  },
  hero: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    marginBottom:   '32px',
  },
  logoWrap: {
    width:          '96px',
    height:         '96px',
    borderRadius:   '48px',
    overflow:       'hidden',
    border:         '2px solid #2a5a1a',
    marginBottom:   '16px',
    boxShadow:      '0 0 30px rgba(106,191,68,0.35)',
  },
  logoImg: {
    width:    '100%',
    height:   '100%',
    objectFit: 'cover',
  },
  logoEmoji: {
    fontSize:   '44px',
    lineHeight: '96px',
    textAlign:  'center',
    display:    'block',
  },
  title: {
    color:          '#c8e6a0',
    fontSize:       '36px',
    fontWeight:     '900',
    letterSpacing:  '2px',
  },
  tagline: {
    color:         '#4a7a30',
    fontSize:      '14px',
    marginTop:     '6px',
    letterSpacing: '1px',
  },
  featureCard: {
    width:         '100%',
    background:    '#0d1a0d',
    border:        '1px solid #1e3a1e',
    borderRadius:  '16px',
    padding:       '20px',
    marginBottom:  '28px',
    display:       'flex',
    flexDirection: 'column',
    gap:           '14px',
  },
  feature: {
    display:    'flex',
    alignItems: 'center',
    gap:        '12px',
  },
  featureEmoji: { fontSize: '20px', width: '28px' },
  featureLabel: { color: '#8aaa70', fontSize: '14px' },
  connectWrap: {
    width:     '100%',
    display:   'flex',
    justifyContent: 'center',
  },
  network: {
    color:      '#2a4a1a',
    fontSize:   '11px',
    marginTop:  '14px',
    letterSpacing: '0.5px',
  },
};
