import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { KIRHA_GAME_ADDRESS, KIRHA_CITY_ADDRESS, KIRHA_MARKET_ADDRESS, RELAYER_ADDRESS } from '../contracts/addresses';
import KirhaGameAbi   from '../contracts/abis/KirhaGame.json';
import KirhaCityAbi   from '../contracts/abis/KirhaCity.json';
import KirhaMarketAbi from '../contracts/abis/KirhaMarket.json';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';
import { useGameStore } from '../store/gameStore';

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
  resources: number[];   // index 0 = unused, 1-62 = quantités réelles (÷1e4)
  levels:    number[];   // 0-4 = 5 métiers
  xp:        number[];   // 0-4 = 5 métiers
  xpTotal:   number[];   // 0-4 = 5 métiers
  isBanned:  boolean;
  pepites:   number;
}

const ALL_RESOURCE_IDS = Array.from({ length: 62 }, (_, i) => BigInt(i + 1));
const METIER_NAMES = ['Bûcheron', 'Paysan', 'Pêcheur', 'Mineur', 'Alchimiste'];

function xpTotalPourNiveau(n: number): number {
  let total = 0;
  for (let i = 1; i < n; i++) total += Math.round(i * i * 50);
  return total;
}

const ADMIN_WORKER_URL = 'https://kirha-relayer.tokirha.workers.dev';

export function AdminPage() {
  const navigate     = useNavigate();
  const { address }  = useAccount();
  const publicClient = usePublicClient();

  const [players, setPlayers]             = useState<PlayerData[]>([]);
  const [totalCities, setTotalCities]     = useState<number | null>(null);
  const [totalListings, setTotalListings] = useState<number | null>(null);
  const [activeListings, setActiveListings] = useState<number | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [expandedCity, setExpandedCity]   = useState<number | null>(null);
  const [relayerBalance, setRelayerBalance] = useState<bigint | null>(null);
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('kirha_admin_token') ?? '');
  const [tokenStatus, setTokenStatus] = useState<'unknown'|'ok'|'invalid'|'testing'>('unknown');

  // Delete confirmation state
  const [deleteStep, setDeleteStep]   = useState<Record<number, number>>({});
  const [deleteInput, setDeleteInput] = useState<Record<number, string>>({});

  // Reset confirmation state
  const [resetStep, setResetStep] = useState<Record<number, number>>({});

  // Give panel state per city
  const [showGive, setShowGive] = useState<Record<number, boolean>>({});
  const [giveKirha, setGiveKirha]       = useState<Record<number, string>>({});
  const [givePepites, setGivePepites]   = useState<Record<number, string>>({});
  const [giveVipDays, setGiveVipDays]   = useState<Record<number, string>>({});
  const [giveResId, setGiveResId]       = useState<Record<number, string>>({});
  const [giveResAmt, setGiveResAmt]     = useState<Record<number, string>>({});
  const [giveXpMetier, setGiveXpMetier] = useState<Record<number, string>>({});
  const [giveXpAmt, setGiveXpAmt]       = useState<Record<number, string>>({});
  const [giveNiveauDir, setGiveNiveauDir] = useState<Record<number, string>>({});
  const [giveStatus, setGiveStatus]     = useState<Record<string, 'idle'|'pending'|'ok'|'err'>>({});

  const [search, setSearch] = useState('');
  const [snapshots, setSnapshots] = useState<Record<number, PlayerData>>({});
  const [retirerStatus, setRetirerStatus] = useState<Record<number, 'idle'|'pending'|'ok'|'err'>>({});

  // Retirer panel state per city
  const [showRetirer, setShowRetirer] = useState<Record<number, boolean>>({});
  const [retirerKirha, setRetirerKirha] = useState<Record<number, string>>({});
  const [retirerPepites, setRetirerPepites] = useState<Record<number, string>>({});
  const [retirerResId, setRetirerResId] = useState<Record<number, string>>({});
  const [retirerResAmt, setRetirerResAmt] = useState<Record<number, string>>({});
  const [retirerOpStatus, setRetirerOpStatus] = useState<Record<string, 'idle'|'pending'|'ok'|'err'>>({});

  const isAdmin = !!address && ADMIN_WALLETS.includes(address.toLowerCase());

  // ── Paramètres jeu ─────────────────────────────────────
  const parcheminPrice    = useGameStore(s => s.parcheminPrice ?? 10);
  const setParcheminPrice = useGameStore(s => s.setParcheminPrice);
  const [parcheminInput, setParcheminInput] = useState<string>('');
  const [configStatus, setConfigStatus] = useState<'idle'|'pending'|'ok'|'err'>('idle');

  // Sync depuis le worker au montage
  React.useEffect(() => {
    fetch(`${ADMIN_WORKER_URL}/config`)
      .then(r => r.json() as Promise<{ parcheminPrice?: number }>)
      .then(data => { if (data.parcheminPrice) setParcheminPrice(data.parcheminPrice); })
      .catch(() => {});
  }, [setParcheminPrice]);

  async function appliquerParcheminPrice(price: number) {
    if (!adminToken) { setError('Token admin requis'); return; }
    setConfigStatus('pending');
    try {
      const res = await fetch(`${ADMIN_WORKER_URL}/admin/set-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
        body: JSON.stringify({ parcheminPrice: String(price) }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      setParcheminPrice(price);
      setConfigStatus('ok');
      setTimeout(() => setConfigStatus('idle'), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 80) : 'Erreur set-config');
      setConfigStatus('err');
    }
  }

  // ── Tester le token ────────────────────────────────────
  async function testerToken() {
    if (!adminToken) return;
    setTokenStatus('testing');
    try {
      const res = await fetch(`${ADMIN_WORKER_URL}/admin/ping`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
        body:    JSON.stringify({}),
      });
      setTokenStatus(res.ok ? 'ok' : 'invalid');
    } catch {
      setTokenStatus('invalid');
    }
  }

  // ── Chargement des données ─────────────────────────────
  async function charger() {
    if (!publicClient || loading) return;
    setLoading(true);
    setError(null);
    try {
      // 0. Balance du relayer
      const relBal = await publicClient.getBalance({ address: RELAYER_ADDRESS });
      setRelayerBalance(relBal);

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
        try {
          const [wallet, pseudo, resourcesRaw, metiersRaw, kirhaWei, isBanned, pepitesBn] = await Promise.all([
            publicClient.readContract({ address: KIRHA_CITY_ADDRESS, abi: KirhaCityAbi, functionName: 'ownerOf', args: [cid] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'cityPseudo', args: [cid] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'getCityResources', args: [cid, ALL_RESOURCE_IDS] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'getCityMetiers', args: [cid] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'cityKirha', args: [cid] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'bannedCities', args: [cid] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'cityPepites', args: [cid] }),
          ]);
          // resourcesRaw[0] = resource #1, ..., resourcesRaw[49] = resource #50
          const resources = [0, ...(resourcesRaw as bigint[]).map(r => Number(r) / 1e4)];
          const metiersArr = metiersRaw as { level: number; xp: number; xpTotal: number }[];
          const levels    = metiersArr.map(m => Number(m.level));
          const xp        = metiersArr.map(m => Number(m.xp));
          const xpTotal   = metiersArr.map(m => Number(m.xpTotal));
          list.push({
            cityId, pseudo: pseudo as string, wallet: wallet as string,
            kirhaWei: kirhaWei as bigint, resources, levels, xp, xpTotal,
            isBanned: isBanned as boolean, pepites: Number(pepitesBn as bigint),
          });
        } catch {
          // Ville supprimée ou inaccessible — ignorée
        }
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

  async function toggleBan(cityId: number, currentlyBanned: boolean) {
    if (!adminToken) { setError('Token admin requis'); return; }
    try {
      const res = await fetch(`${ADMIN_WORKER_URL}/admin/set-ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
        body: JSON.stringify({ cityId: String(cityId), banned: String(!currentlyBanned) }),
      });
      if (!res.ok) { const d = await res.json() as {error?:string}; throw new Error(d.error); }
      setPlayers(prev => prev.map(p => p.cityId === cityId ? { ...p, isBanned: !currentlyBanned } : p));
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 80) : 'Erreur toggleBan');
    }
  }

  async function deleteCity(cityId: number) {
    if (!adminToken) { setError('Token admin requis'); return; }
    try {
      const res = await fetch(`${ADMIN_WORKER_URL}/admin/delete-city`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
        body: JSON.stringify({ cityId: String(cityId) }),
      });
      if (!res.ok) { const d = await res.json() as {error?:string}; throw new Error(d.error); }
      setPlayers(prev => prev.filter(p => p.cityId !== cityId));
      setExpandedCity(null);
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 80) : 'Erreur deleteCity');
    }
  }

  async function adminWorkerCall(cityId: number, key: string, action: string, payload: Record<string, string>) {
    if (!adminToken) {
      setError('Token admin requis');
      return;
    }
    setGiveStatus(prev => ({ ...prev, [key]: 'pending' }));
    try {
      const res = await fetch(`${ADMIN_WORKER_URL}/admin/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
        body: JSON.stringify({ cityId: String(cityId), ...payload }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setGiveStatus(prev => ({ ...prev, [key]: 'ok' }));
      await new Promise(r => setTimeout(r, 1500));
      await refreshPlayer(cityId);
      setTimeout(() => setGiveStatus(prev => ({ ...prev, [key]: 'idle' })), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 80) : 'Erreur');
      setGiveStatus(prev => ({ ...prev, [key]: 'err' }));
    }
  }

  async function retirerDons(p: PlayerData) {
    const snap = snapshots[p.cityId];
    if (!snap || !adminToken) { setError('Snapshot introuvable ou token manquant'); return; }
    setRetirerStatus(prev => ({ ...prev, [p.cityId]: 'pending' }));
    try {
      // 1. Reset
      const res1 = await fetch(`${ADMIN_WORKER_URL}/admin/reset-city`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
        body: JSON.stringify({ cityId: String(p.cityId) }),
      });
      if (!res1.ok) throw new Error('Reset échoué');
      // 2. Restore kirha (in wei)
      if (snap.kirhaWei > 0n) {
        const res2 = await fetch(`${ADMIN_WORKER_URL}/admin/give-kirha`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
          body: JSON.stringify({ cityId: String(p.cityId), amount: snap.kirhaWei.toString() }),
        });
        if (!res2.ok) throw new Error('Restore kirha échoué');
      }
      // 3. Restore pepites
      if (snap.pepites > 0) {
        const res3 = await fetch(`${ADMIN_WORKER_URL}/admin/give-pepites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
          body: JSON.stringify({ cityId: String(p.cityId), amount: String(snap.pepites) }),
        });
        if (!res3.ok) throw new Error('Restore pepites échoué');
      }
      // 4. Restore resources
      for (let rid = 1; rid <= 62; rid++) {
        const qty = Math.floor(snap.resources[rid] ?? 0);
        if (qty >= 1) {
          await fetch(`${ADMIN_WORKER_URL}/admin/give-resource`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
            body: JSON.stringify({ cityId: String(p.cityId), resourceId: String(rid), amount: String(qty) }),
          });
        }
      }
      setRetirerStatus(prev => ({ ...prev, [p.cityId]: 'ok' }));
      setTimeout(() => setRetirerStatus(prev => ({ ...prev, [p.cityId]: 'idle' })), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur retirer');
      setRetirerStatus(prev => ({ ...prev, [p.cityId]: 'err' }));
    }
  }

  async function refreshPlayer(cityId: number) {
    if (!publicClient) return;
    try {
      const cid = BigInt(cityId);
      const [wallet, pseudo, resourcesRaw, metiersRaw, kirhaWei, isBanned, pepitesBn] = await Promise.all([
        publicClient.readContract({ address: KIRHA_CITY_ADDRESS, abi: KirhaCityAbi, functionName: 'ownerOf', args: [cid] }),
        publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'cityPseudo', args: [cid] }),
        publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'getCityResources', args: [cid, ALL_RESOURCE_IDS] }),
        publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'getCityMetiers', args: [cid] }),
        publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'cityKirha', args: [cid] }),
        publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'bannedCities', args: [cid] }),
        publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'cityPepites', args: [cid] }),
      ]);
      const resources = [0, ...(resourcesRaw as bigint[]).map(r => Number(r) / 1e4)];
      const metiersArr = metiersRaw as { level: number; xp: number; xpTotal: number }[];
      const updated: PlayerData = {
        cityId, pseudo: pseudo as string, wallet: wallet as string,
        kirhaWei: kirhaWei as bigint, resources,
        levels: metiersArr.map(m => Number(m.level)),
        xp: metiersArr.map(m => Number(m.xp)),
        xpTotal: metiersArr.map(m => Number(m.xpTotal)),
        isBanned: isBanned as boolean, pepites: Number(pepitesBn as bigint),
      };
      setPlayers(prev => prev.map(p => p.cityId === cityId ? updated : p));
      setSnapshots(prev => ({ ...prev, [cityId]: updated }));
    } catch {
      // ownerOf revert = ville supprimée → retirer de la liste
      setPlayers(prev => prev.filter(p => p.cityId !== cityId));
    }
  }

  async function retirerMontant(p: PlayerData, key: string, type: 'kirha' | 'pepites' | 'resource', amount: number, resourceId?: number) {
    if (!adminToken) { setError('Token admin requis'); return; }
    setRetirerOpStatus(prev => ({ ...prev, [key]: 'pending' }));
    try {
      const res1 = await fetch(`${ADMIN_WORKER_URL}/admin/reset-city`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
        body: JSON.stringify({ cityId: String(p.cityId) }),
      });
      if (!res1.ok) throw new Error('Reset échoué');

      const newKirhaEther = type === 'kirha'
        ? Math.max(0, parseFloat(formatEther(p.kirhaWei)) - amount)
        : parseFloat(formatEther(p.kirhaWei));
      if (newKirhaEther > 0) {
        const newKirhaWei = parseEther(newKirhaEther.toFixed(6));
        await fetch(`${ADMIN_WORKER_URL}/admin/give-kirha`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
          body: JSON.stringify({ cityId: String(p.cityId), amount: newKirhaWei.toString() }),
        });
      }

      const newPepites = type === 'pepites' ? Math.max(0, p.pepites - amount) : p.pepites;
      if (newPepites > 0) {
        await fetch(`${ADMIN_WORKER_URL}/admin/give-pepites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
          body: JSON.stringify({ cityId: String(p.cityId), amount: String(newPepites) }),
        });
      }

      for (let rid = 1; rid <= 62; rid++) {
        let qty = Math.floor(p.resources[rid] ?? 0);
        if (type === 'resource' && rid === resourceId) qty = Math.max(0, qty - amount);
        if (qty >= 1) {
          await fetch(`${ADMIN_WORKER_URL}/admin/give-resource`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
            body: JSON.stringify({ cityId: String(p.cityId), resourceId: String(rid), amount: String(qty) }),
          });
        }
      }

      setRetirerOpStatus(prev => ({ ...prev, [key]: 'ok' }));
      await new Promise(r => setTimeout(r, 1500));
      await refreshPlayer(p.cityId);
      setTimeout(() => setRetirerOpStatus(prev => ({ ...prev, [key]: 'idle' })), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur retrait');
      setRetirerOpStatus(prev => ({ ...prev, [key]: 'err' }));
    }
  }

  // ── Stats globales des ressources ──────────────────────
  const resourceTotals: number[] = Array(63).fill(0);
  for (const p of players) {
    for (let rid = 1; rid <= 62; rid++) {
      resourceTotals[rid] += p.resources[rid] ?? 0;
    }
  }
  const topResources = Array.from({ length: 62 }, (_, i) => ({ id: i + 1, qty: resourceTotals[i + 1] }))
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
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:'#0a0010', color:'#e0c8d8', fontFamily:'monospace', padding:'20px', paddingBottom:100 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, borderBottom:'1px solid rgba(196,48,112,0.3)', paddingBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button
            onClick={() => navigate('/home')}
            style={{ padding:'6px 12px', background:'rgba(196,48,112,0.12)', border:'1px solid rgba(196,48,112,0.3)', borderRadius:8, color:'#ff6b9d', fontSize:12, fontWeight:700, cursor:'pointer' }}
          >
            ← Retour
          </button>
          <div>
            <h1 style={{ color:'#ff6b9d', fontSize:20, fontWeight:900, margin:0 }}>⚙️ Admin — To-Kirha</h1>
            <p style={{ color:'#7a4060', fontSize:10, margin:'4px 0 0' }}>{address?.slice(0,10)}…</p>
          </div>
        </div>
        <button
          onClick={charger}
          disabled={loading}
          style={{ padding:'8px 16px', background: loading ? 'rgba(196,48,112,0.2)' : '#c43070', color:'#fff', border:'none', borderRadius:10, fontSize:12, fontWeight:700, cursor: loading ? 'default' : 'pointer' }}
        >
          {loading ? '⏳ Chargement…' : '🔄 Charger'}
        </button>
      </div>

      {/* Token admin */}
      <div style={{ marginBottom:16, background:'rgba(196,48,112,0.08)', border:`1px solid ${tokenStatus === 'ok' ? 'rgba(106,191,68,0.5)' : tokenStatus === 'invalid' ? 'rgba(255,100,100,0.5)' : 'rgba(196,48,112,0.2)'}`, borderRadius:10, padding:'8px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:'#ff6b9d', fontSize:11, fontWeight:700 }}>🔑 Token admin</span>
          <input
            type="password"
            placeholder="Token secret"
            value={adminToken}
            onChange={e => { setAdminToken(e.target.value); sessionStorage.setItem('kirha_admin_token', e.target.value); setTokenStatus('unknown'); }}
            style={{ flex:1, padding:'4px 8px', borderRadius:6, border:'1px solid rgba(196,48,112,0.3)', background:'rgba(0,0,0,0.3)', color:'#e0c8d8', fontSize:11, fontFamily:'monospace' }}
          />
          <button
            onClick={testerToken}
            disabled={!adminToken || tokenStatus === 'testing'}
            style={{ padding:'3px 8px', borderRadius:6, border:'1px solid rgba(196,48,112,0.4)', background:'rgba(196,48,112,0.15)', color:'#ff6b9d', fontSize:10, fontWeight:700, cursor:'pointer', flexShrink:0 }}
          >
            {tokenStatus === 'testing' ? '⏳' : 'Tester'}
          </button>
        </div>
        {tokenStatus === 'ok' && <p style={{ color:'#6abf44', fontSize:10, margin:'4px 0 0' }}>✅ Token valide — accès autorisé</p>}
        {tokenStatus === 'invalid' && <p style={{ color:'#ff6b6b', fontSize:10, margin:'4px 0 0' }}>❌ Token invalide ou erreur réseau</p>}
        {tokenStatus === 'unknown' && adminToken && <p style={{ color:'#9a6080', fontSize:10, margin:'4px 0 0' }}>Clique sur "Tester" pour valider le token.</p>}
      </div>

      {/* Relayer gas alert */}
      {relayerBalance !== null && (
        relayerBalance < 50000000000000000n ? (
          <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(196,48,112,0.12)', border:'1px solid rgba(196,48,112,0.4)', borderRadius:10, color:'#ff6b9d', fontSize:12, fontWeight:700 }}>
            ⚠️ Relayer bientôt à court de gas — Solde: {parseFloat(formatEther(relayerBalance)).toFixed(3)} ETH
          </div>
        ) : (
          <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(106,191,68,0.08)', border:'1px solid rgba(106,191,68,0.3)', borderRadius:10, color:'#6abf44', fontSize:12, fontWeight:700 }}>
            ⛽ Relayer OK — Solde: {parseFloat(formatEther(relayerBalance)).toFixed(3)} ETH
          </div>
        )
      )}

      {error && <p style={{ color:'#ff6b9d', fontSize:12, marginBottom:16 }}>❌ {error}</p>}

      {/* Paramètres Jeu */}
      <div style={{ marginBottom:20, background:'rgba(249,168,37,0.06)', border:'1px solid rgba(249,168,37,0.25)', borderRadius:12, padding:'14px 16px' }}>
        <h2 style={{ color:'#f9a825', fontSize:13, fontWeight:800, margin:'0 0 12px', letterSpacing:'0.05em' }}>⚙️ PARAMÈTRES JEU</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

          {/* Prix Parchemin des Anciens */}
          <div>
            <p style={{ color:'#f9a825', fontSize:10, fontWeight:700, margin:'0 0 4px' }}>
              📜 PRIX PARCHEMIN DES ANCIENS (HDV Boutique PNJ) — Actuel : <strong>{parcheminPrice} $KIRHA</strong>
            </p>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input
                type="number" min="1" max="9999"
                placeholder={`Nouveau prix (actuel: ${parcheminPrice})`}
                value={parcheminInput}
                onChange={e => setParcheminInput(e.target.value)}
                style={{ flex:1, padding:'5px 8px', borderRadius:6, border:'1px solid rgba(249,168,37,0.3)', background:'rgba(0,0,0,0.4)', color:'#e0c8d8', fontSize:11, fontFamily:'monospace', minWidth:0 }}
              />
              <button
                disabled={!parcheminInput || parseInt(parcheminInput) < 1 || configStatus === 'pending'}
                onClick={() => {
                  const val = parseInt(parcheminInput);
                  if (val >= 1) { appliquerParcheminPrice(val); setParcheminInput(''); }
                }}
                style={{ padding:'5px 12px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(249,168,37,0.3)', color:'#f9a825', flexShrink:0 }}
              >
                {configStatus === 'pending' ? '⏳' : configStatus === 'ok' ? '✅' : 'Appliquer'}
              </button>
              {[5, 10, 20, 50].map(v => (
                <button key={v} onClick={() => { appliquerParcheminPrice(v); setParcheminInput(''); }}
                  style={{ padding:'4px 8px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'1px solid rgba(249,168,37,0.25)', background: parcheminPrice === v ? 'rgba(249,168,37,0.3)' : 'transparent', color:'#f9a825', flexShrink:0 }}
                >
                  {v}
                </button>
              ))}
            </div>
            <p style={{ color:'#7a6020', fontSize:9, margin:'4px 0 0' }}>
              Stocké dans le KV Cloudflare — partagé pour tous les joueurs en temps réel.
            </p>
          </div>

        </div>
      </div>

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
          {/* Barre de recherche */}
          <div style={{ marginBottom:12 }}>
            <input
              type="text"
              placeholder="🔍 Rechercher par pseudo ou #cityId…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:'1px solid rgba(196,48,112,0.3)', background:'rgba(0,0,0,0.3)', color:'#e0c8d8', fontSize:12, fontFamily:'monospace', boxSizing:'border-box' as const }}
            />
          </div>

          {/* Liste des joueurs */}
          <h2 style={{ color:'#ff6b9d', fontSize:14, fontWeight:700, margin:'0 0 10px' }}>👥 Joueurs ({players.filter(p => !search || p.pseudo.toLowerCase().includes(search.toLowerCase()) || String(p.cityId).includes(search)).length})</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:24 }}>
            {players.filter(p => !search || p.pseudo.toLowerCase().includes(search.toLowerCase()) || String(p.cityId).includes(search)).map(p => {
              const totalRes = p.resources.reduce((a, b) => a + b, 0);
              const kirha    = parseFloat(formatEther(p.kirhaWei));
              const expanded = expandedCity === p.cityId;
              const step     = deleteStep[p.cityId] ?? 0;
              return (
                <div key={p.cityId} style={{ background: p.isBanned ? 'rgba(196,48,112,0.12)' : 'rgba(196,48,112,0.06)', border: p.isBanned ? '1px solid rgba(196,48,112,0.45)' : '1px solid rgba(196,48,112,0.18)', borderRadius:12, overflow:'hidden' }}>
                  {/* Ligne principale */}
                  <div
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer' }}
                    onClick={() => {
                      if (!expanded && !snapshots[p.cityId]) {
                        setSnapshots(prev => ({ ...prev, [p.cityId]: { ...p, resources: [...p.resources], levels: [...p.levels], xp: [...p.xp], xpTotal: [...p.xpTotal] } }));
                      }
                      setExpandedCity(expanded ? null : p.cityId);
                    }}
                  >
                    <span style={{ color:'#ff6b9d', fontSize:13, fontWeight:900, minWidth:28 }}>#{p.cityId}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ color:'#e0c8d8', fontSize:13, fontWeight:700 }}>
                        {p.pseudo || '?'}
                        {p.isBanned && <span style={{ marginLeft:6, background:'#c43070', color:'#fff', fontSize:9, padding:'1px 5px', borderRadius:6 }}>BANNI</span>}
                      </div>
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

                      {/* Niveaux métiers + XP */}
                      <div>
                        <p style={{ color:'#9a6080', fontSize:10, margin:'0 0 6px', fontWeight:700 }}>MÉTIERS</p>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                          {METIER_NAMES.map((name, i) => (
                            <span key={i} style={{ background:'rgba(196,48,112,0.1)', border:'1px solid rgba(196,48,112,0.2)', borderRadius:8, padding:'3px 8px', fontSize:10, color:'#e0c8d8' }}>
                              {name} <strong style={{ color:'#ff6b9d' }}>Nv.{p.levels[i] ?? 1}</strong>
                              <span style={{ color:'#9a6080', marginLeft:4 }}>XP:{p.xp[i] ?? 0}/{p.xpTotal[i] ?? 0}</span>
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

                      {/* ── ACTIONS ADMIN ─────────────────── */}
                      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        <p style={{ color:'#9a6080', fontSize:10, margin:0, fontWeight:700 }}>ACTIONS ADMIN</p>

                        {/* Ban / Débannir */}
                        <button
                          style={{ padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', background: p.isBanned ? 'rgba(106,191,68,0.2)' : 'rgba(196,48,112,0.2)', color: p.isBanned ? '#6abf44' : '#ff6b9d', alignSelf:'flex-start' }}
                          onClick={() => toggleBan(p.cityId, p.isBanned)}
                        >
                          {p.isBanned ? '✅ Débannir' : '🚫 Bannir'}
                        </button>

                        {/* Reset ville */}
                        {(resetStep[p.cityId] ?? 0) === 0 && (
                          <button
                            style={{ padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'1px solid rgba(255,165,0,0.4)', background:'transparent', color:'#ffa500', alignSelf:'flex-start' }}
                            onClick={() => setResetStep(prev => ({ ...prev, [p.cityId]: 1 }))}
                          >
                            🔄 Reset ville
                          </button>
                        )}
                        {(resetStep[p.cityId] ?? 0) === 1 && (
                          <div style={{ background:'rgba(255,165,0,0.08)', border:'1px solid rgba(255,165,0,0.3)', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                            <p style={{ color:'#ffa500', fontSize:11, fontWeight:700, margin:0 }}>⚠️ Remet à zéro ressources, $KIRHA et pépites. NFT, métiers et pseudo conservés.</p>
                            <div style={{ display:'flex', gap:8 }}>
                              <button
                                style={{ padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(255,165,0,0.3)', color:'#ffa500' }}
                                onClick={async () => { await adminWorkerCall(p.cityId, `reset_${p.cityId}`, 'reset-city', {}); setResetStep(prev => ({ ...prev, [p.cityId]: 0 })); }}
                              >
                                {giveStatus[`reset_${p.cityId}`] === 'pending' ? '⏳…' : 'Confirmer le reset'}
                              </button>
                              <button
                                style={{ padding:'5px 10px', borderRadius:8, fontSize:11, cursor:'pointer', border:'none', background:'rgba(255,255,255,0.05)', color:'#7a4060' }}
                                onClick={() => setResetStep(prev => ({ ...prev, [p.cityId]: 0 }))}
                              >Annuler</button>
                            </div>
                          </div>
                        )}

                        {/* Donner (panneau dépliant) */}
                        <button
                          style={{ padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'1px solid rgba(106,191,68,0.4)', background:'transparent', color:'#6abf44', alignSelf:'flex-start' }}
                          onClick={() => setShowGive(prev => ({ ...prev, [p.cityId]: !prev[p.cityId] }))}
                        >
                          🎁 {showGive[p.cityId] ? 'Fermer donner' : 'Donner…'}
                        </button>

                        {showGive[p.cityId] && (
                          <div style={{ background:'rgba(106,191,68,0.05)', border:'1px solid rgba(106,191,68,0.2)', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>

                            {/* $KIRHA */}
                            <div>
                              <p style={{ color:'#6abf44', fontSize:9, fontWeight:700, margin:'0 0 4px' }}>💠 DONNER $KIRHA IN-GAME</p>
                              <div style={{ display:'flex', gap:6 }}>
                                <input type="number" min="0" placeholder="Montant (ex: 10)"
                                  value={giveKirha[p.cityId] ?? ''}
                                  onChange={e => setGiveKirha(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                                  style={inputStyle}
                                />
                                <button style={giveBtnStyle}
                                  disabled={!giveKirha[p.cityId]}
                                  onClick={() => {
                                    const amtStr = (parseFloat(giveKirha[p.cityId] || '0')).toFixed(6);
                                    const amtWei = parseEther(amtStr);
                                    adminWorkerCall(p.cityId, `kirha_${p.cityId}`, 'give-kirha', { amount: amtWei.toString() });
                                  }}
                                >
                                  {giveStatus[`kirha_${p.cityId}`] === 'pending' ? '⏳' : giveStatus[`kirha_${p.cityId}`] === 'ok' ? '✅' : 'Donner'}
                                </button>
                              </div>
                            </div>

                            {/* Pépites */}
                            <div>
                              <p style={{ color:'#f9a825', fontSize:9, fontWeight:700, margin:'0 0 4px' }}>✨ DONNER PÉPITES D'OR</p>
                              <div style={{ display:'flex', gap:6 }}>
                                <input type="number" min="0" placeholder="Quantité (ex: 100)"
                                  value={givePepites[p.cityId] ?? ''}
                                  onChange={e => setGivePepites(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                                  style={inputStyle}
                                />
                                <button style={giveBtnStyle}
                                  disabled={!givePepites[p.cityId]}
                                  onClick={() => adminWorkerCall(p.cityId, `pep_${p.cityId}`, 'give-pepites', { amount: givePepites[p.cityId] || '0' })}
                                >
                                  {giveStatus[`pep_${p.cityId}`] === 'pending' ? '⏳' : giveStatus[`pep_${p.cityId}`] === 'ok' ? '✅' : 'Donner'}
                                </button>
                              </div>
                            </div>

                            {/* VIP */}
                            <div>
                              <p style={{ color:'#ab47bc', fontSize:9, fontWeight:700, margin:'0 0 4px' }}>👑 DONNER VIP</p>
                              <div style={{ display:'flex', gap:6 }}>
                                <select
                                  value={giveVipDays[p.cityId] ?? '7'}
                                  onChange={e => setGiveVipDays(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                                  style={{ ...inputStyle, flex:'none', width:100 }}
                                >
                                  <option value="7">7 jours</option>
                                  <option value="30">30 jours</option>
                                  <option value="90">90 jours</option>
                                </select>
                                <button style={giveBtnStyle}
                                  onClick={() => adminWorkerCall(p.cityId, `vip_${p.cityId}`, 'give-vip', { days: giveVipDays[p.cityId] ?? '7' })}
                                >
                                  {giveStatus[`vip_${p.cityId}`] === 'pending' ? '⏳' : giveStatus[`vip_${p.cityId}`] === 'ok' ? '✅' : 'Donner'}
                                </button>
                              </div>
                            </div>

                            {/* Ressource */}
                            <div>
                              <p style={{ color:'#29b6f6', fontSize:9, fontWeight:700, margin:'0 0 4px' }}>📦 DONNER RESSOURCE</p>
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                <select
                                  value={giveResId[p.cityId] ?? '1'}
                                  onChange={e => setGiveResId(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                                  style={{ ...inputStyle, flex:'none', width:100, fontSize:9 }}
                                >
                                  {Array.from({length:62}, (_, i) => i+1).map(id => (
                                    <option key={id} value={id}>{emojiByResourceId(id)} {getNomRessource(id, 'fr')}</option>
                                  ))}
                                </select>
                                <input type="number" min="1" placeholder="Qté"
                                  value={giveResAmt[p.cityId] ?? ''}
                                  onChange={e => setGiveResAmt(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                                  style={{ ...inputStyle, width:60 }}
                                />
                                <button style={giveBtnStyle}
                                  disabled={!giveResAmt[p.cityId]}
                                  onClick={() => adminWorkerCall(p.cityId, `res_${p.cityId}`, 'give-resource', { resourceId: giveResId[p.cityId] ?? '1', amount: giveResAmt[p.cityId] || '0' })}
                                >
                                  {giveStatus[`res_${p.cityId}`] === 'pending' ? '⏳' : giveStatus[`res_${p.cityId}`] === 'ok' ? '✅' : 'Donner'}
                                </button>
                              </div>
                            </div>

                            {/* XP */}
                            <div>
                              <p style={{ color:'#7a6cb0', fontSize:9, fontWeight:700, margin:'0 0 4px' }}>⭐ XP / NIVEAU MÉTIER</p>
                              {/* Sélecteur métier commun */}
                              <div style={{ marginBottom:6 }}>
                                <select
                                  value={giveXpMetier[p.cityId] ?? '0'}
                                  onChange={e => setGiveXpMetier(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                                  style={{ ...inputStyle, flex:'none', width:120 }}
                                >
                                  {METIER_NAMES.map((name, i) => (
                                    <option key={i} value={i}>{name} (Nv.{p.levels[i] ?? 1})</option>
                                  ))}
                                </select>
                              </div>
                              {/* Ajouter XP */}
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:4 }}>
                                <input type="number" min="1" placeholder="XP à ajouter"
                                  value={giveXpAmt[p.cityId] ?? ''}
                                  onChange={e => setGiveXpAmt(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                                  style={{ ...inputStyle, width:90 }}
                                />
                                <button style={giveBtnStyle}
                                  disabled={!giveXpAmt[p.cityId]}
                                  onClick={() => {
                                    const mid = parseInt(giveXpMetier[p.cityId] ?? '0');
                                    const xpAdd = parseInt(giveXpAmt[p.cityId] || '0');
                                    const curXp = (p.xp[mid] ?? 0) + xpAdd;
                                    const curXpTotal = (p.xpTotal[mid] ?? 0) + xpAdd;
                                    adminWorkerCall(p.cityId, `xp_${p.cityId}`, 'set-metier-xp', { metierId: String(mid), level: String(p.levels[mid] ?? 1), xp: String(curXp), xpTotal: String(curXpTotal) });
                                  }}
                                >
                                  {giveStatus[`xp_${p.cityId}`] === 'pending' ? '⏳' : giveStatus[`xp_${p.cityId}`] === 'ok' ? '✅' : '+ XP'}
                                </button>
                              </div>
                              {/* Niveau direct */}
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                                <input type="number" min="1" max="100" placeholder="Niveau cible"
                                  value={giveNiveauDir[p.cityId] ?? ''}
                                  onChange={e => setGiveNiveauDir(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                                  style={{ ...inputStyle, width:90 }}
                                />
                                {giveNiveauDir[p.cityId] && parseInt(giveNiveauDir[p.cityId]) >= 1 && (
                                  <span style={{ color:'#9a6cb0', fontSize:9 }}>
                                    xpTotal={xpTotalPourNiveau(parseInt(giveNiveauDir[p.cityId])).toLocaleString()}
                                  </span>
                                )}
                                <button style={{ ...giveBtnStyle, background:'rgba(122,108,176,0.25)', color:'#9a6cb0' }}
                                  disabled={!giveNiveauDir[p.cityId] || parseInt(giveNiveauDir[p.cityId]) < 1}
                                  onClick={() => {
                                    const mid = parseInt(giveXpMetier[p.cityId] ?? '0');
                                    const niveau = Math.max(1, parseInt(giveNiveauDir[p.cityId] || '1'));
                                    const total = xpTotalPourNiveau(niveau);
                                    adminWorkerCall(p.cityId, `xp_${p.cityId}`, 'set-metier-xp', { metierId: String(mid), level: String(niveau), xp: '0', xpTotal: String(total) });
                                  }}
                                >
                                  {giveStatus[`xp_${p.cityId}`] === 'pending' ? '⏳' : giveStatus[`xp_${p.cityId}`] === 'ok' ? '✅' : 'Définir niv.'}
                                </button>
                              </div>
                            </div>

                          </div>
                        )}

                        {/* Retirer (panneau dépliant) */}
                        <button
                          style={{ padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'1px solid rgba(255,100,0,0.4)', background:'transparent', color:'#ff6400', alignSelf:'flex-start' }}
                          onClick={() => setShowRetirer(prev => ({ ...prev, [p.cityId]: !prev[p.cityId] }))}
                        >
                          ↩️ {showRetirer[p.cityId] ? 'Fermer retirer' : 'Retirer…'}
                        </button>

                        {showRetirer[p.cityId] && (
                          <div style={{ background:'rgba(255,100,0,0.05)', border:'1px solid rgba(255,100,0,0.25)', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>

                            {/* Retirer $KIRHA */}
                            <div>
                              <p style={{ color:'#ff6400', fontSize:9, fontWeight:700, margin:'0 0 4px' }}>💠 RETIRER $KIRHA IN-GAME</p>
                              <div style={{ display:'flex', gap:6 }}>
                                <input type="number" min="0" placeholder={`Max: ${parseFloat(formatEther(p.kirhaWei)).toFixed(2)}`}
                                  value={retirerKirha[p.cityId] ?? ''}
                                  onChange={e => setRetirerKirha(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                                  style={inputStyle}
                                />
                                <button style={maxBtnStyle} onClick={() => setRetirerKirha(prev => ({ ...prev, [p.cityId]: parseFloat(formatEther(p.kirhaWei)).toFixed(4) }))}>MAX</button>
                                <button style={retirerBtnStyle}
                                  disabled={!retirerKirha[p.cityId] || retirerOpStatus[`rkirha_${p.cityId}`] === 'pending'}
                                  onClick={() => retirerMontant(p, `rkirha_${p.cityId}`, 'kirha', parseFloat(retirerKirha[p.cityId] || '0'))}
                                >
                                  {retirerOpStatus[`rkirha_${p.cityId}`] === 'pending' ? '⏳' : retirerOpStatus[`rkirha_${p.cityId}`] === 'ok' ? '✅' : 'Retirer'}
                                </button>
                              </div>
                            </div>

                            {/* Retirer Pépites */}
                            <div>
                              <p style={{ color:'#ff6400', fontSize:9, fontWeight:700, margin:'0 0 4px' }}>✨ RETIRER PÉPITES D'OR</p>
                              <div style={{ display:'flex', gap:6 }}>
                                <input type="number" min="0" placeholder={`Max: ${p.pepites}`}
                                  value={retirerPepites[p.cityId] ?? ''}
                                  onChange={e => setRetirerPepites(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                                  style={inputStyle}
                                />
                                <button style={maxBtnStyle} onClick={() => setRetirerPepites(prev => ({ ...prev, [p.cityId]: String(p.pepites) }))}>MAX</button>
                                <button style={retirerBtnStyle}
                                  disabled={!retirerPepites[p.cityId] || retirerOpStatus[`rpep_${p.cityId}`] === 'pending'}
                                  onClick={() => retirerMontant(p, `rpep_${p.cityId}`, 'pepites', parseInt(retirerPepites[p.cityId] || '0'))}
                                >
                                  {retirerOpStatus[`rpep_${p.cityId}`] === 'pending' ? '⏳' : retirerOpStatus[`rpep_${p.cityId}`] === 'ok' ? '✅' : 'Retirer'}
                                </button>
                              </div>
                            </div>

                            {/* Retirer Ressource */}
                            <div>
                              <p style={{ color:'#ff6400', fontSize:9, fontWeight:700, margin:'0 0 4px' }}>📦 RETIRER RESSOURCE</p>
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                <select
                                  value={retirerResId[p.cityId] ?? '1'}
                                  onChange={e => setRetirerResId(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                                  style={{ ...inputStyle, flex:'none', width:100, fontSize:9 }}
                                >
                                  {Array.from({length:62}, (_, i) => i+1).map(id => (
                                    <option key={id} value={id}>{emojiByResourceId(id)} {getNomRessource(id, 'fr')} (×{Math.floor(p.resources[id] ?? 0)})</option>
                                  ))}
                                </select>
                                <input type="number" min="1" placeholder="Qté"
                                  value={retirerResAmt[p.cityId] ?? ''}
                                  onChange={e => setRetirerResAmt(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                                  style={{ ...inputStyle, width:60 }}
                                />
                                <button style={maxBtnStyle} onClick={() => {
                                  const rid = parseInt(retirerResId[p.cityId] ?? '1');
                                  setRetirerResAmt(prev => ({ ...prev, [p.cityId]: String(Math.floor(p.resources[rid] ?? 0)) }));
                                }}>MAX</button>
                                <button style={retirerBtnStyle}
                                  disabled={!retirerResAmt[p.cityId] || retirerOpStatus[`rres_${p.cityId}`] === 'pending'}
                                  onClick={() => retirerMontant(p, `rres_${p.cityId}`, 'resource', parseInt(retirerResAmt[p.cityId] || '0'), parseInt(retirerResId[p.cityId] ?? '1'))}
                                >
                                  {retirerOpStatus[`rres_${p.cityId}`] === 'pending' ? '⏳' : retirerOpStatus[`rres_${p.cityId}`] === 'ok' ? '✅' : 'Retirer'}
                                </button>
                              </div>
                            </div>

                          </div>
                        )}

                        {/* Suppression en 3 étapes */}
                        {step === 0 && (
                          <button
                            style={{ padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'1px solid rgba(196,48,112,0.4)', background:'transparent', color:'#ff6b9d', alignSelf:'flex-start' }}
                            onClick={() => setDeleteStep(prev => ({ ...prev, [p.cityId]: 1 }))}
                          >
                            🗑️ Supprimer la ville
                          </button>
                        )}
                        {step === 1 && (
                          <div style={{ background:'rgba(196,48,112,0.08)', border:'1px solid rgba(196,48,112,0.3)', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                            <p style={{ color:'#ff6b9d', fontSize:11, fontWeight:700, margin:0 }}>⚠️ Attention : cette action est irréversible.</p>
                            <div style={{ display:'flex', gap:8 }}>
                              <button
                                style={{ padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(196,48,112,0.3)', color:'#ff6b9d' }}
                                onClick={() => setDeleteStep(prev => ({ ...prev, [p.cityId]: 2 }))}
                              >
                                Confirmer la suppression
                              </button>
                              <button
                                style={{ padding:'5px 10px', borderRadius:8, fontSize:11, cursor:'pointer', border:'none', background:'rgba(255,255,255,0.05)', color:'#7a4060' }}
                                onClick={() => setDeleteStep(prev => ({ ...prev, [p.cityId]: 0 }))}
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                        {step === 2 && (
                          <div style={{ background:'rgba(196,48,112,0.08)', border:'1px solid rgba(196,48,112,0.3)', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                            <p style={{ color:'#ff6b9d', fontSize:11, margin:0 }}>Saisir l'ID de la ville pour confirmer :</p>
                            <input
                              type="text"
                              placeholder={`Entrer ${p.cityId}`}
                              value={deleteInput[p.cityId] ?? ''}
                              onChange={e => setDeleteInput(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                              style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(196,48,112,0.4)', background:'rgba(0,0,0,0.3)', color:'#e0c8d8', fontSize:12, fontFamily:'monospace' }}
                            />
                            <div style={{ display:'flex', gap:8 }}>
                              <button
                                style={{ padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', background: deleteInput[p.cityId] === String(p.cityId) ? '#c43070' : 'rgba(196,48,112,0.15)', color:'#fff', opacity: deleteInput[p.cityId] === String(p.cityId) ? 1 : 0.4 }}
                                disabled={deleteInput[p.cityId] !== String(p.cityId)}
                                onClick={() => deleteCity(p.cityId)}
                              >
                                SUPPRIMER DÉFINITIVEMENT
                              </button>
                              <button
                                style={{ padding:'5px 10px', borderRadius:8, fontSize:11, cursor:'pointer', border:'none', background:'rgba(255,255,255,0.05)', color:'#7a4060' }}
                                onClick={() => { setDeleteStep(prev => ({ ...prev, [p.cityId]: 0 })); setDeleteInput(prev => ({ ...prev, [p.cityId]: '' })); }}
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
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

const inputStyle: React.CSSProperties = {
  flex: 1, padding:'5px 8px', borderRadius:6, border:'1px solid rgba(106,191,68,0.3)',
  background:'rgba(0,0,0,0.4)', color:'#e0c8d8', fontSize:11, fontFamily:'monospace',
  minWidth: 0,
};
const giveBtnStyle: React.CSSProperties = {
  padding:'5px 10px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer',
  border:'none', background:'rgba(106,191,68,0.25)', color:'#6abf44', flexShrink:0,
};
const retirerBtnStyle: React.CSSProperties = {
  padding:'5px 10px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer',
  border:'none', background:'rgba(255,100,0,0.25)', color:'#ff6400', flexShrink:0,
};
const maxBtnStyle: React.CSSProperties = {
  padding:'3px 7px', borderRadius:6, fontSize:9, fontWeight:800, cursor:'pointer',
  border:'1px solid rgba(255,200,0,0.4)', background:'rgba(255,200,0,0.12)', color:'#ffc800', flexShrink:0,
};
