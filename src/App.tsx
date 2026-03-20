import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { ConnectPage }  from './pages/ConnectPage';
import { HomePage }     from './pages/HomePage';
import { RecoltePage }  from './pages/RecoltePage';
import { HdvPage }      from './pages/HdvPage';
import { BanquePage }   from './pages/BanquePage';
import { MaisonPage }   from './pages/MaisonPage';
import { CraftPage }    from './pages/CraftPage';
import { AdminPage }    from './pages/AdminPage';
import { TemplePage }   from './pages/TemplePage';
import { BottomMenu }   from './components/BottomMenu';
import { useGameStore } from './store/gameStore';
import { MetierId } from './data/metiers';
import { ResourceId } from './data/resources';
import { useSave } from './hooks/useSave';
import { KIRHA_GAME_ADDRESS } from './contracts/addresses';
import KirhaGameAbi from './contracts/abis/KirhaGame.json';

const APP_VERSION = '0.6.0';

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
  useEffect(() => {
    // Juste marquer la version — ne plus effacer le localStorage
    localStorage.setItem('kirha_version', APP_VERSION);
  }, []);
  return null;
}

function BeforeUnloadGuard() {
  const pending      = useGameStore(s => s.pending_mints);
  const { sauvegarder } = useSave();

  useEffect(() => {
    const handler = (_e: BeforeUnloadEvent) => {
      if (pending.length === 0) return;
      // Déclenche la sauvegarde on-chain (MetaMask s'ouvrira)
      sauvegarder();
      // Note: e.preventDefault() et e.returnValue retiré — cause des popups indésirables sur Android
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  // sauvegarder est stable (useCallback) mais on le met en dépendance par sécurité
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.length]);
  return null;
}

function AutoSaveGuard() {
  const derniereSauvegarde = useGameStore(s => s.derniere_sauvegarde);
  const { sauvegarder, status } = useSave();

  useEffect(() => {
    const check = () => {
      if (status !== 'idle') return;
      const last = derniereSauvegarde ?? 0;
      if (Date.now() - last >= 12 * 3600 * 1000) {
        sauvegarder();
      }
    };
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derniereSauvegarde, status]);

  return null;
}

const METIER_IDS_ARR: MetierId[] = ['bucheron', 'paysan', 'pecheur', 'mineur', 'alchimiste'];

function VilleIdGuard() {
  const { isConnected, address } = useAccount();
  const villeId     = useGameStore(s => s.villeId);
  const setVilleId  = useGameStore(s => s.setVilleId);
  const setPseudo   = useGameStore(s => s.setPseudo);
  const setChainBalances    = useGameStore(s => s.setChainBalances);
  const setMetierFromChain  = useGameStore(s => s.setMetierFromChain);
  const addInventaireFromChain = useGameStore(s => s.addInventaireFromChain);
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!isConnected || !address || !publicClient) return;
    // Toujours synchroniser depuis la chaîne à chaque connexion/rechargement
    // (suppression du early return sur villeId — nécessaire pour recevoir les dons admin)
    (async () => {
      try {
        const cityId = await publicClient.readContract({
          address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi,
          functionName: 'playerCityId', args: [address],
        }) as bigint;
        if (cityId > 0n) {
          setVilleId(cityId.toString());
          const pseudo = await publicClient.readContract({
            address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi,
            functionName: 'cityPseudo', args: [cityId],
          }) as string;
          if (pseudo) setPseudo(pseudo);

          const [kirhaWei, pepites, vipExp] = await Promise.all([
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'cityKirha', args: [cityId] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'cityPepites', args: [cityId] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'vipExpiry', args: [cityId] }),
          ]) as [bigint, bigint, bigint];

          setChainBalances(
            parseFloat(formatEther(kirhaWei)),
            Number(pepites),
            Number(vipExp)
          );

          const metiersChain = await publicClient.readContract({
            address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi,
            functionName: 'getCityMetiers', args: [cityId],
          }) as { metierId: number; level: number; xp: number; xpTotal: number }[];

          for (const m of metiersChain) {
            const mid = METIER_IDS_ARR[m.metierId];
            if (mid) setMetierFromChain(mid, Number(m.level), Number(m.xp), Number(m.xpTotal));
          }

          const allIds = Array.from({ length: 50 }, (_, i) => BigInt(i + 1));
          const resourcesChain = await publicClient.readContract({
            address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi,
            functionName: 'getCityResources', args: [cityId, allIds],
          }) as bigint[];

          for (let i = 0; i < resourcesChain.length; i++) {
            const qty = Number(resourcesChain[i]) / 1e4;
            if (qty > 0) addInventaireFromChain((i + 1) as ResourceId, qty);
          }
        }
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, publicClient]);
  return null;
}

function Guard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const villeId = useGameStore(s => s.villeId);
  // Connecté mais pas encore enregistré → retour à ConnectPage pour inscription
  if (isConnected && (!villeId || villeId === '0')) return <Navigate to="/" replace />;
  return isConnected ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <VersionGuard />
        <BeforeUnloadGuard />
        <AutoSaveGuard />
        <VilleIdGuard />
        <div style={{ position:'relative', width:'100%', height:'100vh', overflow:'hidden' }}>
          <Routes>
            <Route path="/"       element={<ConnectPage />} />
            <Route path="/home"   element={<Guard><HomePage /></Guard>} />
            <Route path="/recolte" element={<Guard><RecoltePage /></Guard>} />
            <Route path="/hdv"    element={<Guard><HdvPage /></Guard>} />
            <Route path="/banque" element={<Guard><BanquePage /></Guard>} />
            <Route path="/maison" element={<Guard><MaisonPage /></Guard>} />
            <Route path="/craft"  element={<Guard><CraftPage /></Guard>} />
            <Route path="/kirha-gm-v4x9"  element={<Guard><AdminPage /></Guard>} />
            <Route path="/temple" element={<Guard><TemplePage /></Guard>} />
            <Route path="*"       element={<Navigate to="/home" replace />} />
          </Routes>
          <BottomMenu />
        </div>
      </HashRouter>
    </ErrorBoundary>
  );
}
