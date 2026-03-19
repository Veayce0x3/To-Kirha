import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectPage }  from './pages/ConnectPage';
import { HomePage }     from './pages/HomePage';
import { RecoltePage }  from './pages/RecoltePage';
import { HdvPage }      from './pages/HdvPage';
import { BanquePage }   from './pages/BanquePage';
import { MaisonPage }   from './pages/MaisonPage';
import { CraftPage }    from './pages/CraftPage';
import { AdminPage }    from './pages/AdminPage';
import { BottomMenu }   from './components/BottomMenu';
import { useGameStore } from './store/gameStore';
import { useSave } from './hooks/useSave';

const APP_VERSION = '0.5.0';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (error) return (
      <div style={{ position:'fixed', inset:0, background:'#1a0a1e', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px' }}>
        <span style={{ fontSize:'32px', marginBottom:'16px' }}>⚠️</span>
        <p style={{ color:'#ff6b9d', fontSize:'16px', fontWeight:700, marginBottom:'8px' }}>Erreur de rendu</p>
        <p style={{ color:'#c9a0b4', fontSize:'12px', textAlign:'center', marginBottom:'24px' }}>{(error as Error).message}</p>
        <button onClick={() => { localStorage.clear(); window.location.reload(); }}
          style={{ padding:'10px 20px', background:'#ff6b9d', color:'#1a0a1e', border:'none', borderRadius:'10px', cursor:'pointer', fontSize:'14px', fontWeight:700 }}>
          Réinitialiser
        </button>
      </div>
    );
    return this.props.children;
  }
}

function VersionGuard() {
  const { disconnect } = useDisconnect();
  useEffect(() => {
    const saved = localStorage.getItem('kirha_version');
    if (saved !== APP_VERSION) {
      localStorage.removeItem('to-kirha-game');
      // Reset city ID so the player gets #1 (sequential, no UUID)
      localStorage.removeItem('kirha_city_id');
      localStorage.removeItem('kirha_next_city_id');
      localStorage.setItem('kirha_version', APP_VERSION);
      disconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function BeforeUnloadGuard() {
  const pending      = useGameStore(s => s.pending_mints);
  const { sauvegarder } = useSave();

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pending.length === 0) return;
      // Déclenche la sauvegarde on-chain (MetaMask s'ouvrira)
      sauvegarder();
      // Empêche la fermeture immédiate pour laisser le temps de signer
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  // sauvegarder est stable (useCallback) mais on le met en dépendance par sécurité
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.length]);
  return null;
}

function Guard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  return isConnected ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <VersionGuard />
        <BeforeUnloadGuard />
        <div style={{ position:'relative', width:'100%', height:'100vh', overflow:'hidden' }}>
          <Routes>
            <Route path="/"       element={<ConnectPage />} />
            <Route path="/home"   element={<Guard><HomePage /></Guard>} />
            <Route path="/recolte" element={<Guard><RecoltePage /></Guard>} />
            <Route path="/hdv"    element={<Guard><HdvPage /></Guard>} />
            <Route path="/banque" element={<Guard><BanquePage /></Guard>} />
            <Route path="/maison" element={<Guard><MaisonPage /></Guard>} />
            <Route path="/craft"  element={<Guard><CraftPage /></Guard>} />
            <Route path="/admin"  element={<Guard><AdminPage /></Guard>} />
            <Route path="*"       element={<Navigate to="/home" replace />} />
          </Routes>
          <BottomMenu />
        </div>
      </HashRouter>
    </ErrorBoundary>
  );
}
