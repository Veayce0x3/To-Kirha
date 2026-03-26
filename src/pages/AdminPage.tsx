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

  // Action tab per city ('give' | 'retirer' | null)
  const [actionTab, setActionTab] = useState<Record<number, 'give' | 'retirer' | null>>({});
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

  // (showRetirer removed — replaced by actionTab)
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
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:'#0a0010', color:'#e0c8d8', fontFamily:'monospace', fontSize:12, padding:16, paddingBottom:100 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, paddingBottom:10, borderBottom:'1px solid rgba(196,48,112,0.25)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => navigate('/home')} style={btnBack}>← Retour</button>
          <h1 style={{ color:'#ff6b9d', fontSize:16, fontWeight:900, margin:0 }}>⚙️ Admin To-Kirha</h1>
        </div>
        <button onClick={charger} disabled={loading} style={btnLoad}>
          {loading ? '⏳' : '🔄 Charger'}
        </button>
      </div>

      {/* Token */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12, padding:'8px 10px', background:'rgba(196,48,112,0.06)', border:`1px solid ${tokenStatus==='ok'?'rgba(106,191,68,0.4)':tokenStatus==='invalid'?'rgba(255,100,100,0.4)':'rgba(196,48,112,0.2)'}`, borderRadius:10 }}>
        <span style={{ color:'#ff6b9d', fontSize:10, fontWeight:700, flexShrink:0 }}>🔑 Token</span>
        <input type="password" placeholder="Token admin" value={adminToken}
          onChange={e => { setAdminToken(e.target.value); sessionStorage.setItem('kirha_admin_token', e.target.value); setTokenStatus('unknown'); }}
          style={{ flex:1, padding:'4px 8px', borderRadius:6, border:'1px solid rgba(196,48,112,0.3)', background:'rgba(0,0,0,0.4)', color:'#e0c8d8', fontSize:11, fontFamily:'monospace' }}
        />
        <button onClick={testerToken} disabled={!adminToken||tokenStatus==='testing'} style={{ ...btnSmall, background:'rgba(196,48,112,0.2)', color:'#ff6b9d' }}>
          {tokenStatus==='testing'?'⏳':tokenStatus==='ok'?'✅':tokenStatus==='invalid'?'❌':'Tester'}
        </button>
      </div>

      {error && <p style={{ color:'#ff6b9d', fontSize:11, margin:'0 0 10px' }}>❌ {error}</p>}

      {/* Infra + Stats */}
      {relayerBalance !== null && (
        <div style={{ marginBottom:12, padding:'8px 12px', background: relayerBalance < 50000000000000000n ? 'rgba(196,48,112,0.1)' : 'rgba(106,191,68,0.07)', border:`1px solid ${relayerBalance < 50000000000000000n ? 'rgba(196,48,112,0.4)' : 'rgba(106,191,68,0.25)'}`, borderRadius:10, display:'flex', gap:14, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ color: relayerBalance < 50000000000000000n ? '#ff6b9d' : '#6abf44', fontWeight:700 }}>⛽ Relayer: {parseFloat(formatEther(relayerBalance)).toFixed(3)} ETH</span>
          {totalCities !== null && <span style={{ color:'#9a6080' }}>🏙️ {totalCities} villes</span>}
          {activeListings !== null && <span style={{ color:'#9a6080' }}>📋 {activeListings} listings actifs</span>}
        </div>
      )}

      {/* Prix Parchemin */}
      <div style={{ marginBottom:12, padding:'10px 12px', background:'rgba(249,168,37,0.05)', border:'1px solid rgba(249,168,37,0.2)', borderRadius:10 }}>
        <p style={{ color:'#f9a825', fontSize:10, fontWeight:700, margin:'0 0 6px' }}>📜 Prix Parchemin — Actuel: <strong>{parcheminPrice} $KIRHA</strong></p>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          {[5,10,20,50].map(v => (
            <button key={v} onClick={() => { appliquerParcheminPrice(v); setParcheminInput(''); }}
              style={{ ...btnSmall, background: parcheminPrice===v ? 'rgba(249,168,37,0.35)' : 'rgba(249,168,37,0.1)', color:'#f9a825', border:'1px solid rgba(249,168,37,0.3)' }}>
              {v}
            </button>
          ))}
          <input type="number" min="1" placeholder="Autre…" value={parcheminInput}
            onChange={e => setParcheminInput(e.target.value)}
            style={{ width:70, padding:'3px 6px', borderRadius:6, border:'1px solid rgba(249,168,37,0.25)', background:'rgba(0,0,0,0.4)', color:'#e0c8d8', fontSize:11, fontFamily:'monospace' }}
          />
          <button disabled={!parcheminInput||parseInt(parcheminInput)<1||configStatus==='pending'}
            onClick={() => { const v=parseInt(parcheminInput); if(v>=1){appliquerParcheminPrice(v);setParcheminInput('');} }}
            style={{ ...btnSmall, background:'rgba(249,168,37,0.25)', color:'#f9a825' }}>
            {configStatus==='pending'?'⏳':configStatus==='ok'?'✅':'Appliquer'}
          </button>
        </div>
      </div>

      {/* Search */}
      {players.length > 0 && (
        <input type="text" placeholder="🔍 Pseudo ou #ID…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(196,48,112,0.25)', background:'rgba(0,0,0,0.35)', color:'#e0c8d8', fontSize:12, fontFamily:'monospace', boxSizing:'border-box', marginBottom:10 }}
        />
      )}

      {/* Players */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {players
          .filter(p => !search || p.pseudo.toLowerCase().includes(search.toLowerCase()) || String(p.cityId).includes(search))
          .map(p => {
            const expanded = expandedCity === p.cityId;
            const kirha = parseFloat(formatEther(p.kirhaWei));
            const step = deleteStep[p.cityId] ?? 0;
            const tab = actionTab[p.cityId] ?? null;
            return (
              <div key={p.cityId} style={{ background: p.isBanned ? 'rgba(196,48,112,0.1)' : 'rgba(255,255,255,0.03)', border:`1px solid ${p.isBanned ? 'rgba(196,48,112,0.4)' : 'rgba(196,48,112,0.15)'}`, borderRadius:12, overflow:'hidden' }}>

                {/* Ligne principale */}
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', cursor:'pointer' }}
                  onClick={() => { if(!expanded && !snapshots[p.cityId]) setSnapshots(prev=>({...prev,[p.cityId]:{...p,resources:[...p.resources],levels:[...p.levels],xp:[...p.xp],xpTotal:[...p.xpTotal]}})); setExpandedCity(expanded?null:p.cityId); }}>
                  <span style={{ color:'#ff6b9d', fontWeight:900, minWidth:24, fontSize:12 }}>#{p.cityId}</span>
                  <div style={{ flex:1 }}>
                    <span style={{ color:'#e0c8d8', fontWeight:700 }}>{p.pseudo||'?'}</span>
                    {p.isBanned && <span style={{ marginLeft:6, background:'#c43070', color:'#fff', fontSize:8, padding:'1px 4px', borderRadius:4 }}>BANNI</span>}
                    <span style={{ color:'#7a4060', fontSize:9, display:'block' }}>{p.wallet.slice(0,8)}…{p.wallet.slice(-4)}</span>
                  </div>
                  <div style={{ textAlign:'right', marginRight:6 }}>
                    <span style={{ color:'#f9a825', fontWeight:700, fontSize:11 }}>{kirha.toFixed(2)} $K</span>
                    <span style={{ color:'#7a4060', fontSize:9, display:'block' }}>{p.resources.reduce((a,b)=>a+b,0).toFixed(0)} res.</span>
                  </div>
                  <span style={{ color:'#7a4060', fontSize:10 }}>{expanded?'▲':'▼'}</span>
                </div>

                {/* Détail */}
                {expanded && (
                  <div style={{ borderTop:'1px solid rgba(196,48,112,0.12)', padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>

                    {/* Métiers */}
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {METIER_NAMES.map((name, i) => (
                        <span key={i} style={{ background:'rgba(196,48,112,0.08)', border:'1px solid rgba(196,48,112,0.18)', borderRadius:8, padding:'2px 8px', fontSize:10 }}>
                          {name} <strong style={{ color:'#ff6b9d' }}>Nv.{p.levels[i]??1}</strong>
                        </span>
                      ))}
                    </div>

                    {/* Ressources on-chain */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {Array.from({length:50},(_,i)=>i+1).filter(rid=>(p.resources[rid]??0)>=0.01).map(rid=>(
                        <span key={rid} style={{ background:'rgba(106,191,68,0.08)', border:'1px solid rgba(106,191,68,0.2)', borderRadius:6, padding:'2px 5px', fontSize:10, color:'#aed6a2' }}>
                          {emojiByResourceId(rid)} ×{p.resources[rid].toFixed(1)}
                        </span>
                      ))}
                    </div>

                    {/* Actions rapides */}
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <button onClick={()=>toggleBan(p.cityId,p.isBanned)}
                        style={{ ...btnSmall, background: p.isBanned?'rgba(106,191,68,0.2)':'rgba(196,48,112,0.15)', color: p.isBanned?'#6abf44':'#ff6b9d' }}>
                        {p.isBanned?'✅ Débannir':'🚫 Bannir'}
                      </button>
                      <button onClick={()=>setActionTab(prev=>({...prev,[p.cityId]:tab==='give'?null:'give'}))}
                        style={{ ...btnSmall, background: tab==='give'?'rgba(106,191,68,0.3)':'rgba(106,191,68,0.1)', color:'#6abf44' }}>
                        🎁 Donner
                      </button>
                      <button onClick={()=>setActionTab(prev=>({...prev,[p.cityId]:tab==='retirer'?null:'retirer'}))}
                        style={{ ...btnSmall, background: tab==='retirer'?'rgba(255,100,0,0.3)':'rgba(255,100,0,0.1)', color:'#ff6400' }}>
                        ↩️ Retirer
                      </button>
                    </div>

                    {/* Panel Donner */}
                    {tab === 'give' && (
                      <div style={{ background:'rgba(106,191,68,0.04)', border:'1px solid rgba(106,191,68,0.18)', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                        {/* KIRHA */}
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ color:'#6abf44', fontSize:9, fontWeight:700, width:70, flexShrink:0 }}>💠 KIRHA</span>
                          <input type="number" min="0" placeholder="Montant" value={giveKirha[p.cityId]??''} onChange={e=>setGiveKirha(prev=>({...prev,[p.cityId]:e.target.value}))} style={inputSm} />
                          <button style={giveSm} disabled={!giveKirha[p.cityId]} onClick={()=>{const w=parseEther((parseFloat(giveKirha[p.cityId]||'0')).toFixed(6));adminWorkerCall(p.cityId,`kirha_${p.cityId}`,'give-kirha',{amount:w.toString()});}}>
                            {giveStatus[`kirha_${p.cityId}`]==='pending'?'⏳':giveStatus[`kirha_${p.cityId}`]==='ok'?'✅':'Donner'}
                          </button>
                        </div>
                        {/* Pépites */}
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ color:'#f9a825', fontSize:9, fontWeight:700, width:70, flexShrink:0 }}>✨ Pépites</span>
                          <input type="number" min="0" placeholder="Quantité" value={givePepites[p.cityId]??''} onChange={e=>setGivePepites(prev=>({...prev,[p.cityId]:e.target.value}))} style={inputSm} />
                          <button style={giveSm} disabled={!givePepites[p.cityId]} onClick={()=>adminWorkerCall(p.cityId,`pep_${p.cityId}`,'give-pepites',{amount:givePepites[p.cityId]||'0'})}>
                            {giveStatus[`pep_${p.cityId}`]==='pending'?'⏳':giveStatus[`pep_${p.cityId}`]==='ok'?'✅':'Donner'}
                          </button>
                        </div>
                        {/* VIP */}
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ color:'#ab47bc', fontSize:9, fontWeight:700, width:70, flexShrink:0 }}>👑 VIP</span>
                          <select value={giveVipDays[p.cityId]??'7'} onChange={e=>setGiveVipDays(prev=>({...prev,[p.cityId]:e.target.value}))} style={{ ...inputSm, flex:'none', width:90 }}>
                            <option value="7">7 jours</option><option value="30">30 jours</option><option value="90">90 jours</option>
                          </select>
                          <button style={giveSm} onClick={()=>adminWorkerCall(p.cityId,`vip_${p.cityId}`,'give-vip',{days:giveVipDays[p.cityId]??'7'})}>
                            {giveStatus[`vip_${p.cityId}`]==='pending'?'⏳':giveStatus[`vip_${p.cityId}`]==='ok'?'✅':'Donner'}
                          </button>
                        </div>
                        {/* Ressource */}
                        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                          <span style={{ color:'#29b6f6', fontSize:9, fontWeight:700, width:70, flexShrink:0 }}>📦 Ressource</span>
                          <select value={giveResId[p.cityId]??'1'} onChange={e=>setGiveResId(prev=>({...prev,[p.cityId]:e.target.value}))} style={{ ...inputSm, flex:'none', width:120, fontSize:9 }}>
                            {Array.from({length:62},(_,i)=>i+1).map(id=><option key={id} value={id}>{emojiByResourceId(id)} {getNomRessource(id,'fr')}</option>)}
                          </select>
                          <input type="number" min="1" placeholder="Qté" value={giveResAmt[p.cityId]??''} onChange={e=>setGiveResAmt(prev=>({...prev,[p.cityId]:e.target.value}))} style={{ ...inputSm, width:55 }} />
                          <button style={giveSm} disabled={!giveResAmt[p.cityId]} onClick={()=>adminWorkerCall(p.cityId,`res_${p.cityId}`,'give-resource',{resourceId:giveResId[p.cityId]??'1',amount:giveResAmt[p.cityId]||'0'})}>
                            {giveStatus[`res_${p.cityId}`]==='pending'?'⏳':giveStatus[`res_${p.cityId}`]==='ok'?'✅':'Donner'}
                          </button>
                        </div>
                        {/* XP */}
                        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                          <span style={{ color:'#9a6cb0', fontSize:9, fontWeight:700, width:70, flexShrink:0 }}>⭐ XP</span>
                          <select value={giveXpMetier[p.cityId]??'0'} onChange={e=>setGiveXpMetier(prev=>({...prev,[p.cityId]:e.target.value}))} style={{ ...inputSm, flex:'none', width:90 }}>
                            {METIER_NAMES.map((n,i)=><option key={i} value={i}>{n}</option>)}
                          </select>
                          <input type="number" min="1" placeholder="XP" value={giveXpAmt[p.cityId]??''} onChange={e=>setGiveXpAmt(prev=>({...prev,[p.cityId]:e.target.value}))} style={{ ...inputSm, width:70 }} />
                          <button style={giveSm} disabled={!giveXpAmt[p.cityId]} onClick={()=>{const mid=parseInt(giveXpMetier[p.cityId]??'0');const xpAdd=parseInt(giveXpAmt[p.cityId]||'0');adminWorkerCall(p.cityId,`xp_${p.cityId}`,'set-metier-xp',{metierId:String(mid),level:String(p.levels[mid]??1),xp:String((p.xp[mid]??0)+xpAdd),xpTotal:String((p.xpTotal[mid]??0)+xpAdd)});}}>
                            {giveStatus[`xp_${p.cityId}`]==='pending'?'⏳':giveStatus[`xp_${p.cityId}`]==='ok'?'✅':'+XP'}
                          </button>
                          {/* Niveau direct */}
                          <input type="number" min="1" max="100" placeholder="Niv." value={giveNiveauDir[p.cityId]??''} onChange={e=>setGiveNiveauDir(prev=>({...prev,[p.cityId]:e.target.value}))} style={{ ...inputSm, width:55 }} />
                          <button style={{ ...giveSm, background:'rgba(122,108,176,0.25)', color:'#9a6cb0' }} disabled={!giveNiveauDir[p.cityId]||parseInt(giveNiveauDir[p.cityId])<1}
                            onClick={()=>{const mid=parseInt(giveXpMetier[p.cityId]??'0');const niv=Math.max(1,parseInt(giveNiveauDir[p.cityId]||'1'));const tot=xpTotalPourNiveau(niv);adminWorkerCall(p.cityId,`xp_${p.cityId}`,'set-metier-xp',{metierId:String(mid),level:String(niv),xp:'0',xpTotal:String(tot)});}}>
                            {giveStatus[`xp_${p.cityId}`]==='pending'?'⏳':'→Niv'}
                          </button>
                        </div>
                        {/* Reset */}
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ color:'#ffa500', fontSize:9, fontWeight:700, width:70, flexShrink:0 }}>🔄 Reset</span>
                          {(resetStep[p.cityId]??0)===0
                            ? <button style={{ ...giveSm, background:'rgba(255,165,0,0.2)', color:'#ffa500' }} onClick={()=>setResetStep(prev=>({...prev,[p.cityId]:1}))}>Reset ville</button>
                            : <><button style={{ ...giveSm, background:'rgba(255,165,0,0.35)', color:'#ffa500' }} onClick={async()=>{await adminWorkerCall(p.cityId,`reset_${p.cityId}`,'reset-city',{});setResetStep(prev=>({...prev,[p.cityId]:0}));}}>
                                {giveStatus[`reset_${p.cityId}`]==='pending'?'⏳':'Confirmer'}
                              </button>
                              <button style={{ ...giveSm, background:'rgba(255,255,255,0.05)', color:'#7a4060' }} onClick={()=>setResetStep(prev=>({...prev,[p.cityId]:0}))}>Annuler</button>
                            </>
                          }
                        </div>
                      </div>
                    )}

                    {/* Panel Retirer */}
                    {tab === 'retirer' && (
                      <div style={{ background:'rgba(255,100,0,0.04)', border:'1px solid rgba(255,100,0,0.2)', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                        {/* KIRHA */}
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ color:'#ff6400', fontSize:9, fontWeight:700, width:70, flexShrink:0 }}>💠 KIRHA</span>
                          <input type="number" min="0" placeholder={`Max:${kirha.toFixed(2)}`} value={retirerKirha[p.cityId]??''} onChange={e=>setRetirerKirha(prev=>({...prev,[p.cityId]:e.target.value}))} style={inputSm} />
                          <button style={maxSm} onClick={()=>setRetirerKirha(prev=>({...prev,[p.cityId]:kirha.toFixed(4)}))}>MAX</button>
                          <button style={retirerSm} disabled={!retirerKirha[p.cityId]||retirerOpStatus[`rkirha_${p.cityId}`]==='pending'} onClick={()=>retirerMontant(p,`rkirha_${p.cityId}`,'kirha',parseFloat(retirerKirha[p.cityId]||'0'))}>
                            {retirerOpStatus[`rkirha_${p.cityId}`]==='pending'?'⏳':retirerOpStatus[`rkirha_${p.cityId}`]==='ok'?'✅':'Retirer'}
                          </button>
                        </div>
                        {/* Pépites */}
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ color:'#ff6400', fontSize:9, fontWeight:700, width:70, flexShrink:0 }}>✨ Pépites</span>
                          <input type="number" min="0" placeholder={`Max:${p.pepites}`} value={retirerPepites[p.cityId]??''} onChange={e=>setRetirerPepites(prev=>({...prev,[p.cityId]:e.target.value}))} style={inputSm} />
                          <button style={maxSm} onClick={()=>setRetirerPepites(prev=>({...prev,[p.cityId]:String(p.pepites)}))}>MAX</button>
                          <button style={retirerSm} disabled={!retirerPepites[p.cityId]||retirerOpStatus[`rpep_${p.cityId}`]==='pending'} onClick={()=>retirerMontant(p,`rpep_${p.cityId}`,'pepites',parseInt(retirerPepites[p.cityId]||'0'))}>
                            {retirerOpStatus[`rpep_${p.cityId}`]==='pending'?'⏳':retirerOpStatus[`rpep_${p.cityId}`]==='ok'?'✅':'Retirer'}
                          </button>
                        </div>
                        {/* Ressource */}
                        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                          <span style={{ color:'#ff6400', fontSize:9, fontWeight:700, width:70, flexShrink:0 }}>📦 Ressource</span>
                          <select value={retirerResId[p.cityId]??'1'} onChange={e=>setRetirerResId(prev=>({...prev,[p.cityId]:e.target.value}))} style={{ ...inputSm, flex:'none', width:120, fontSize:9 }}>
                            {Array.from({length:62},(_,i)=>i+1).map(id=><option key={id} value={id}>{emojiByResourceId(id)} {getNomRessource(id,'fr')} (×{Math.floor(p.resources[id]??0)})</option>)}
                          </select>
                          <input type="number" min="1" placeholder="Qté" value={retirerResAmt[p.cityId]??''} onChange={e=>setRetirerResAmt(prev=>({...prev,[p.cityId]:e.target.value}))} style={{ ...inputSm, width:55 }} />
                          <button style={maxSm} onClick={()=>{const rid=parseInt(retirerResId[p.cityId]??'1');setRetirerResAmt(prev=>({...prev,[p.cityId]:String(Math.floor(p.resources[rid]??0))}));}}>MAX</button>
                          <button style={retirerSm} disabled={!retirerResAmt[p.cityId]||retirerOpStatus[`rres_${p.cityId}`]==='pending'} onClick={()=>retirerMontant(p,`rres_${p.cityId}`,'resource',parseInt(retirerResAmt[p.cityId]||'0'),parseInt(retirerResId[p.cityId]??'1'))}>
                            {retirerOpStatus[`rres_${p.cityId}`]==='pending'?'⏳':retirerOpStatus[`rres_${p.cityId}`]==='ok'?'✅':'Retirer'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Suppression */}
                    {step===0 && <button style={{ ...btnSmall, background:'rgba(196,48,112,0.1)', color:'#ff6b9d', alignSelf:'flex-start' }} onClick={()=>setDeleteStep(prev=>({...prev,[p.cityId]:1}))}>🗑️ Supprimer</button>}
                    {step===1 && (
                      <div style={{ background:'rgba(196,48,112,0.07)', border:'1px solid rgba(196,48,112,0.25)', borderRadius:8, padding:'8px 10px', display:'flex', flexDirection:'column', gap:6 }}>
                        <p style={{ color:'#ff6b9d', fontSize:10, fontWeight:700, margin:0 }}>⚠️ Action irréversible.</p>
                        <div style={{ display:'flex', gap:6 }}>
                          <button style={{ ...giveSm, background:'rgba(196,48,112,0.25)', color:'#ff6b9d' }} onClick={()=>setDeleteStep(prev=>({...prev,[p.cityId]:2}))}>Confirmer</button>
                          <button style={{ ...giveSm, background:'rgba(255,255,255,0.05)', color:'#7a4060' }} onClick={()=>setDeleteStep(prev=>({...prev,[p.cityId]:0}))}>Annuler</button>
                        </div>
                      </div>
                    )}
                    {step===2 && (
                      <div style={{ background:'rgba(196,48,112,0.07)', border:'1px solid rgba(196,48,112,0.25)', borderRadius:8, padding:'8px 10px', display:'flex', flexDirection:'column', gap:6 }}>
                        <p style={{ color:'#ff6b9d', fontSize:10, margin:0 }}>Saisir #{p.cityId} pour confirmer :</p>
                        <input type="text" placeholder={`Entrer ${p.cityId}`} value={deleteInput[p.cityId]??''} onChange={e=>setDeleteInput(prev=>({...prev,[p.cityId]:e.target.value}))}
                          style={{ padding:'5px 8px', borderRadius:6, border:'1px solid rgba(196,48,112,0.35)', background:'rgba(0,0,0,0.3)', color:'#e0c8d8', fontSize:12, fontFamily:'monospace' }} />
                        <div style={{ display:'flex', gap:6 }}>
                          <button disabled={deleteInput[p.cityId]!==String(p.cityId)} onClick={()=>deleteCity(p.cityId)}
                            style={{ ...giveSm, background: deleteInput[p.cityId]===String(p.cityId)?'#c43070':'rgba(196,48,112,0.1)', color:'#fff', opacity: deleteInput[p.cityId]===String(p.cityId)?1:0.4 }}>
                            SUPPRIMER
                          </button>
                          <button style={{ ...giveSm, background:'rgba(255,255,255,0.05)', color:'#7a4060' }} onClick={()=>{setDeleteStep(prev=>({...prev,[p.cityId]:0}));setDeleteInput(prev=>({...prev,[p.cityId]:''}))}}>Annuler</button>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })
        }
      </div>

      {/* Top ressources */}
      {topResources.length > 0 && players.length > 0 && (
        <div style={{ marginTop:20 }}>
          <p style={{ color:'#ff6b9d', fontSize:12, fontWeight:700, margin:'0 0 8px' }}>📊 Top ressources on-chain</p>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {topResources.map(r => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 8px', background:'rgba(196,48,112,0.03)', borderRadius:6 }}>
                <span style={{ fontSize:14, width:22 }}>{emojiByResourceId(r.id)}</span>
                <span style={{ flex:1, color:'#e0c8d8', fontSize:11 }}>{getNomRessource(r.id,'fr')}</span>
                <span style={{ color:'#ff6b9d', fontSize:11, fontWeight:700 }}>×{r.qty.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && totalCities === null && (
        <div style={{ textAlign:'center', padding:'40px 0', color:'#7a4060', fontSize:12 }}>
          Clique sur <strong style={{ color:'#ff6b9d' }}>Charger</strong> pour lire les données on-chain.
        </div>
      )}
    </div>
  );
}

const btnBack: React.CSSProperties = { padding:'5px 10px', background:'rgba(196,48,112,0.12)', border:'1px solid rgba(196,48,112,0.3)', borderRadius:8, color:'#ff6b9d', fontSize:11, fontWeight:700, cursor:'pointer' };
const btnLoad: React.CSSProperties = { padding:'6px 14px', background:'#c43070', color:'#fff', border:'none', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' };
const btnSmall: React.CSSProperties = { padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none' };
const inputSm: React.CSSProperties = { flex:1, padding:'4px 6px', borderRadius:6, border:'1px solid rgba(106,191,68,0.25)', background:'rgba(0,0,0,0.4)', color:'#e0c8d8', fontSize:11, fontFamily:'monospace', minWidth:0 };
const giveSm: React.CSSProperties = { padding:'4px 8px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(106,191,68,0.2)', color:'#6abf44', flexShrink:0 };
const maxSm: React.CSSProperties = { padding:'3px 6px', borderRadius:5, fontSize:9, fontWeight:700, cursor:'pointer', border:'1px solid rgba(106,191,68,0.3)', background:'transparent', color:'#6abf44', flexShrink:0 };
const retirerSm: React.CSSProperties = { padding:'4px 8px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(255,100,0,0.2)', color:'#ff6400', flexShrink:0 };
