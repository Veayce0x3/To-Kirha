import React, { Suspense, lazy, useEffect } from 'react';
import { useBreakpoint } from './hooks/useBreakpoint';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther, hexToString } from 'viem';
import { ConnectPage }  from './pages/ConnectPage';
import { HomePage }     from './pages/HomePage';
const RecoltePage = lazy(() => import('./pages/RecoltePage').then(m => ({ default: m.RecoltePage })));
const HdvPage = lazy(() => import('./pages/HdvPage').then(m => ({ default: m.HdvPage })));
const BanquePage = lazy(() => import('./pages/BanquePage').then(m => ({ default: m.BanquePage })));
const MaisonPage = lazy(() => import('./pages/MaisonPage').then(m => ({ default: m.MaisonPage })));
const CraftPage = lazy(() => import('./pages/CraftPage').then(m => ({ default: m.CraftPage })));
const FermePage = lazy(() => import('./pages/FermePage').then(m => ({ default: m.FermePage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const TemplePage = lazy(() => import('./pages/TemplePage').then(m => ({ default: m.TemplePage })));
const EncherePage = lazy(() => import('./pages/EncherePage').then(m => ({ default: m.EncherePage })));
import { BottomMenu }   from './components/BottomMenu';
import { useGameStore } from './store/gameStore';
import { MetierId } from './data/metiers';
import { ResourceId } from './data/resources';
import { useSave } from './hooks/useSave';
import { useProgressSave } from './hooks/useProgressSave';
import { parsePlayerProgressBlob } from './utils/playerProgressCodec';
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
  const { sauvegarder } = useSave();
  const { saveProgress } = useProgressSave();

  useEffect(() => {
    const handler = (_e: BeforeUnloadEvent) => {
      sauvegarder();
      void saveProgress();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const setVilleId  = useGameStore(s => s.setVilleId);
  const setPseudo   = useGameStore(s => s.setPseudo);
  const mergeEconomyFromChain  = useGameStore(s => s.mergeEconomyFromChain);
  const hydratePlayerProgress  = useGameStore(s => s.hydratePlayerProgress);
  const forceChainSync         = useGameStore(s => s.forceChainSync);
  const resetGameData          = useGameStore(s => s.resetGameData);
  const storeMetiers           = useGameStore(s => s.metiers);
  const storeSoldeKirha        = useGameStore(s => s.soldeKirha);
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!isConnected || !address || !publicClient) return;
    (async () => {
      try {
        const cityId = await publicClient.readContract({
          address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi,
          functionName: 'playerCityId', args: [address],
        }) as bigint;
        if (cityId === 0n) {
          // Ville supprimée ou jamais créée — reset store et laisser Guard rediriger vers /
          resetGameData();
          setVilleId('0');
          return;
        }
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

          const metiersChain = await publicClient.readContract({
            address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi,
            functionName: 'getCityMetiers', args: [cityId],
          }) as { metierId: number; level: number; xp: number; xpTotal: number }[];

          const allIds = Array.from({ length: 69 }, (_, i) => BigInt(i + 1));
          const resourcesChain = await publicClient.readContract({
            address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi,
            functionName: 'getCityResources', args: [cityId, allIds],
          }) as bigint[];

          const chainKirha   = parseFloat(formatEther(kirhaWei));
          const chainPepites = Number(pepites);
          const chainVip     = Number(vipExp);
          const chainMetiers = metiersChain.map(m => ({
            metierId: METIER_IDS_ARR[m.metierId] as MetierId,
            niveau:   Number(m.level),
            xp:       Number(m.xp),
            xpTotal:  Number(m.xpTotal),
          })).filter(m => m.metierId);
          const chainInventaire: Partial<Record<ResourceId, number>> = {};
          for (let i = 0; i < resourcesChain.length; i++) {
            const qty = Number(resourcesChain[i]) / 1e4;
            if (qty > 0) chainInventaire[(i + 1) as ResourceId] = qty;
          }

          const chainAllLevel1 = chainMetiers.every(m => m.niveau <= 1 && m.xpTotal === 0);
          const chainNoResources = Object.keys(chainInventaire).length === 0;
          const chainNoKirha = chainKirha === 0 && chainPepites === 0;
          const localHasData = storeSoldeKirha > 0
            || Object.values(storeMetiers).some(m => m.xp_total > 0)
            || Object.values(storeMetiers).some(m => m.niveau > 1);

          if (chainAllLevel1 && chainNoResources && chainNoKirha && localHasData) {
            forceChainSync(chainKirha, chainPepites, chainVip, chainMetiers, chainInventaire);
          } else {
            mergeEconomyFromChain({
              chainKirha,
              chainPepites,
              chainVip,
              metiers: chainMetiers,
              inventaireSlice: chainInventaire,
            });
          }

          try {
            const rawProg = await publicClient.readContract({
              address: KIRHA_GAME_ADDRESS,
              abi: KirhaGameAbi,
              functionName: 'playerProgress',
              args: [cityId],
            }) as `0x${string}`;
            if (rawProg && rawProg !== '0x') {
              const txt = hexToString(rawProg);
              const parsed = parsePlayerProgressBlob(JSON.parse(txt));
              if (parsed) hydratePlayerProgress(parsed);
            }
          } catch { /* pas encore de blob déployé */ }
        }
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, publicClient]);
  return null;
}

/** Sauvegarde le blob de progression (slots, temple, craft…) sur la chaîne toutes les 2 min. */
function ProgressAutoSave() {
  const villeId = useGameStore(s => s.villeId);
  const { saveProgress } = useProgressSave();

  useEffect(() => {
    if (!villeId || villeId === '0') return;
    const id = setInterval(() => {
      void saveProgress().catch(() => {});
    }, 120_000);
    return () => clearInterval(id);
  }, [villeId, saveProgress]);

  return null;
}

function Guard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const villeId = useGameStore(s => s.villeId);
  // Connecté mais pas encore enregistré → retour à ConnectPage pour inscription
  if (isConnected && (!villeId || villeId === '0')) return <Navigate to="/" replace />;
  return isConnected ? <>{children}</> : <Navigate to="/" replace />;
}

function RouteFallback() {
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#fdf0f5', color:'#7a4060', fontWeight:700, fontSize:13 }}>
      Chargement...
    </div>
  );
}

/** Met à jour `html[data-viewport]` pour le CSS responsive (sidebar desktop, grilles). */
function ViewportRootAttr() {
  const { isDesktop } = useBreakpoint();
  useEffect(() => {
    document.documentElement.dataset.viewport = isDesktop ? 'desktop' : 'mobile';
  }, [isDesktop]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ViewportRootAttr />
        <VersionGuard />
        <BeforeUnloadGuard />
        <AutoSaveGuard />
        <ProgressAutoSave />
        <VilleIdGuard />
        <div className="app-shell" style={{ position:'relative', width:'100%', height:'100svh', overflow:'hidden' }}>
          <div className="app-main">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/"       element={<ConnectPage />} />
                <Route path="/home"   element={<Guard><HomePage /></Guard>} />
                <Route path="/recolte" element={<Guard><RecoltePage /></Guard>} />
                <Route path="/hdv"    element={<Guard><HdvPage /></Guard>} />
                <Route path="/banque" element={<Guard><BanquePage /></Guard>} />
                <Route path="/maison" element={<Guard><MaisonPage /></Guard>} />
                <Route path="/craft"  element={<Guard><CraftPage /></Guard>} />
                <Route path="/ferme"  element={<Guard><FermePage /></Guard>} />
                <Route path="/kirha-gm-v4x9"  element={<Guard><AdminPage /></Guard>} />
                <Route path="/temple"  element={<Guard><TemplePage /></Guard>} />
                <Route path="/enchere" element={<Guard><EncherePage /></Guard>} />
                <Route path="*"       element={<Navigate to="/home" replace />} />
              </Routes>
            </Suspense>
          </div>
          <BottomMenu />
        </div>
      </HashRouter>
    </ErrorBoundary>
  );
}
