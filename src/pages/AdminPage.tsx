import { useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { KIRHA_GAME_ADDRESS, KIRHA_CITY_ADDRESS, KIRHA_MARKET_ADDRESS } from '../contracts/addresses';
import KirhaGameAbi   from '../contracts/abis/KirhaGame.json';
import KirhaCityAbi   from '../contracts/abis/KirhaCity.json';
import KirhaMarketAbi from '../contracts/abis/KirhaMarket.json';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';

// ── Whitelist admin ────────────────────────────────────────
const ADMIN_WALLETS = [
  '0x5A9d55c76c38eDe9b8B34ED6e7F35578cE919b0C',
].map(a => a.toLowerCase());

// ── Types ──────────────────────────────────────────────────
interface PlayerData {
  cityId:    number;
  pseudo:    string;
  wallet:    string;
  kirhaWei:  bigint;
  resources: number[];   // index 0 = unused, 1-50 = quantités réelles (÷1e4)
  levels:    number[];   // 0-4 = 5 métiers
}

const ALL_RESOURCE_IDS = Array.from({ length: 50 }, (_, i) => BigInt(i + 1));
const METIER_NAMES = ['Bûcheron', 'Paysan', 'Pêcheur', 'Mineur', 'Alchimiste'];

export function AdminPage() {
  const { address }  = useAccount();
  const publicClient = usePublicClient();

  const [players, setPlayers]             = useState<PlayerData[]>([]);
  const [totalCities, setTotalCities]     = useState<number | null>(null);
  const [totalListings, setTotalListings] = useState<number | null>(null);
  const [activeListings, setActiveListings] = useState<number | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [expandedCity, setExpandedCity]   = useState<number | null>(null);

  const isAdmin = !!address && ADMIN_WALLETS.includes(address.toLowerCase());

  // ── Chargement des données ─────────────────────────────
  async function charger() {
    if (!publicClient || loading) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Nombre total de villes
      const count = await publicClient.readContract({
        address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'playerCount',
      }) as bigint;
      const n = Number(count);
      setTotalCities(n);

      // 2. Données par joueur
      const list: PlayerData[] = [];
      for (let cityId = 1; cityId <= n; cityId++) {
        const cid = BigInt(cityId);
        const [wallet, pseudo, resourcesRaw, metiersRaw, kirhaWei] = await Promise.all([
          publicClient.readContract({ address: KIRHA_CITY_ADDRESS, abi: KirhaCityAbi, functionName: 'ownerOf', args: [cid] }),
          publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'cityPseudo', args: [cid] }),
          publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'getCityResources', args: [cid, ALL_RESOURCE_IDS] }),
          publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'getCityMetiers', args: [cid] }),
          publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'cityKirha', args: [cid] }),
        ]);
        // resourcesRaw[0] = resource #1, ..., resourcesRaw[49] = resource #50
        const resources = [0, ...(resourcesRaw as bigint[]).map(r => Number(r) / 1e4)];
        const levels    = (metiersRaw as { level: number }[]).map(m => Number(m.level));
        list.push({ cityId, pseudo: pseudo as string, wallet: wallet as string, kirhaWei: kirhaWei as bigint, resources, levels });
      }
      setPlayers(list);

      // 3. Stats marché
      const nextId = await publicClient.readContract({
        address: KIRHA_MARKET_ADDRESS, abi: KirhaMarketAbi, functionName: 'nextListingId',
      }) as bigint;
      setTotalListings(Number(nextId));

      const listingsResult = await publicClient.readContract({
        address: KIRHA_MARKET_ADDRESS, abi: KirhaMarketAbi, functionName: 'getActiveListings', args: [0n, 500n],
      }) as [unknown[], unknown[]];
      setActiveListings(listingsResult[0].length);

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  // ── Stats globales des ressources ──────────────────────
  const resourceTotals: number[] = Array(51).fill(0);
  for (const p of players) {
    for (let rid = 1; rid <= 50; rid++) {
      resourceTotals[rid] += p.resources[rid] ?? 0;
    }
  }
  const topResources = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, qty: resourceTotals[i + 1] }))
    .filter(r => r.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 15);

  // ── Accès refusé ───────────────────────────────────────
  if (!isAdmin) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0010', gap:12 }}>
        <span style={{ fontSize:40 }}>🚫</span>
        <p style={{ color:'#ff6b9d', fontSize:16, fontWeight:700 }}>Accès refusé</p>
        <p style={{ color:'#9a6080', fontSize:12 }}>Wallet non autorisé</p>
      </div>
    );
  }

  return (
    <div style={{ background:'#0a0010', minHeight:'100vh', color:'#e0c8d8', fontFamily:'monospace', padding:'20px', paddingBottom:60 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, borderBottom:'1px solid rgba(196,48,112,0.3)', paddingBottom:12 }}>
        <div>
          <h1 style={{ color:'#ff6b9d', fontSize:20, fontWeight:900, margin:0 }}>⚙️ Admin — To-Kirha</h1>
          <p style={{ color:'#7a4060', fontSize:10, margin:'4px 0 0' }}>{address?.slice(0,10)}…</p>
        </div>
        <button
          onClick={charger}
          disabled={loading}
          style={{ padding:'8px 16px', background: loading ? 'rgba(196,48,112,0.2)' : '#c43070', color:'#fff', border:'none', borderRadius:10, fontSize:12, fontWeight:700, cursor: loading ? 'default' : 'pointer' }}
        >
          {loading ? '⏳ Chargement…' : '🔄 Charger'}
        </button>
      </div>

      {error && <p style={{ color:'#ff6b9d', fontSize:12, marginBottom:16 }}>❌ {error}</p>}

      {/* Stats globales */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'Villes créées',    value: totalCities  ?? '—', icon:'🏙️' },
          { label:'Joueurs',          value: players.length || (totalCities ?? '—'), icon:'👥' },
          { label:'Listings total',   value: totalListings ?? '—', icon:'📋' },
          { label:'Listings actifs',  value: activeListings ?? '—', icon:'🏪' },
        ].map(stat => (
          <div key={stat.label} style={{ background:'rgba(196,48,112,0.08)', border:'1px solid rgba(196,48,112,0.2)', borderRadius:12, padding:'12px 14px' }}>
            <div style={{ fontSize:18, marginBottom:4 }}>{stat.icon}</div>
            <div style={{ color:'#ff6b9d', fontSize:22, fontWeight:900 }}>{stat.value}</div>
            <div style={{ color:'#7a4060', fontSize:10 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {players.length > 0 && (
        <>
          {/* Liste des joueurs */}
          <h2 style={{ color:'#ff6b9d', fontSize:14, fontWeight:700, margin:'0 0 10px' }}>👥 Joueurs</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:24 }}>
            {players.map(p => {
              const totalRes = p.resources.reduce((a, b) => a + b, 0);
              const kirha    = parseFloat(formatEther(p.kirhaWei));
              const expanded = expandedCity === p.cityId;
              return (
                <div key={p.cityId} style={{ background:'rgba(196,48,112,0.06)', border:'1px solid rgba(196,48,112,0.18)', borderRadius:12, overflow:'hidden' }}>
                  {/* Ligne principale */}
                  <div
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer' }}
                    onClick={() => setExpandedCity(expanded ? null : p.cityId)}
                  >
                    <span style={{ color:'#ff6b9d', fontSize:13, fontWeight:900, minWidth:28 }}>#{p.cityId}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ color:'#e0c8d8', fontSize:13, fontWeight:700 }}>{p.pseudo || '?'}</div>
                      <div style={{ color:'#7a4060', fontSize:9, fontFamily:'monospace' }}>{p.wallet.slice(0,10)}…{p.wallet.slice(-6)}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ color:'#f9a825', fontSize:11, fontWeight:700 }}>{kirha.toFixed(2)} $K</div>
                      <div style={{ color:'#7a4060', fontSize:9 }}>{totalRes.toFixed(0)} res.</div>
                    </div>
                    <span style={{ color:'#7a4060', fontSize:12 }}>{expanded ? '▲' : '▼'}</span>
                  </div>

                  {/* Détail étendu */}
                  {expanded && (
                    <div style={{ borderTop:'1px solid rgba(196,48,112,0.15)', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>

                      {/* Niveaux métiers */}
                      <div>
                        <p style={{ color:'#9a6080', fontSize:10, margin:'0 0 6px', fontWeight:700 }}>MÉTIERS</p>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                          {METIER_NAMES.map((name, i) => (
                            <span key={i} style={{ background:'rgba(196,48,112,0.1)', border:'1px solid rgba(196,48,112,0.2)', borderRadius:8, padding:'3px 8px', fontSize:10, color:'#e0c8d8' }}>
                              {name} <strong style={{ color:'#ff6b9d' }}>Nv.{p.levels[i] ?? 1}</strong>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Ressources non-nulles */}
                      <div>
                        <p style={{ color:'#9a6080', fontSize:10, margin:'0 0 6px', fontWeight:700 }}>RESSOURCES ON-CHAIN</p>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          {Array.from({length:50}, (_, i) => i+1)
                            .filter(rid => (p.resources[rid] ?? 0) >= 0.01)
                            .map(rid => (
                              <span key={rid} style={{ background:'rgba(106,191,68,0.1)', border:'1px solid rgba(106,191,68,0.2)', borderRadius:6, padding:'2px 6px', fontSize:10, color:'#aed6a2' }}>
                                {emojiByResourceId(rid)} ×{p.resources[rid].toFixed(1)}
                              </span>
                            ))
                          }
                          {Array.from({length:50}, (_, i) => i+1).every(rid => (p.resources[rid] ?? 0) < 0.01) && (
                            <span style={{ color:'#7a4060', fontSize:10 }}>Aucune ressource sauvegardée on-chain</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Top ressources globales */}
          {topResources.length > 0 && (
            <>
              <h2 style={{ color:'#ff6b9d', fontSize:14, fontWeight:700, margin:'0 0 10px' }}>📊 Top ressources (on-chain)</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {topResources.map(r => (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px', background:'rgba(196,48,112,0.04)', borderRadius:8 }}>
                    <span style={{ fontSize:16, width:24 }}>{emojiByResourceId(r.id)}</span>
                    <span style={{ color:'#e0c8d8', fontSize:12, flex:1 }}>{getNomRessource(r.id, 'fr')}</span>
                    <span style={{ color:'#ff6b9d', fontSize:12, fontWeight:700 }}>×{r.qty.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!loading && totalCities === null && (
        <div style={{ textAlign:'center', padding:'40px 0', color:'#7a4060', fontSize:13 }}>
          Clique sur <strong style={{ color:'#ff6b9d' }}>Charger</strong> pour lire les données on-chain.
        </div>
      )}
    </div>
  );
}
