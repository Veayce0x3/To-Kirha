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
import { ResourceId } from '../data/resources';
import { MetierId } from '../data/metiers';

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
  resources: number[];
  levels:    number[];
  xp:        number[];
  xpTotal:   number[];
  isBanned:  boolean;
  pepites:   number;
  vipExpiry: number; // timestamp Unix (0 = pas VIP)
}

const ALL_RESOURCE_IDS = Array.from({ length: 50 }, (_, i) => BigInt(i + 1));
const METIER_NAMES = ['Bûcheron', 'Paysan', 'Pêcheur', 'Mineur', 'Alchimiste'];
const METIER_IDS: MetierId[] = ['bucheron', 'paysan', 'pecheur', 'mineur', 'alchimiste'];

function xpTotalPourNiveau(n: number): number {
  let total = 0;
  for (let i = 1; i < n; i++) total += Math.round(i * i * 50);
  return total;
}

const ADMIN_WORKER_URL = 'https://kirha-relayer.tokirha.workers.dev';

type MainTab = 'dashboard' | 'joueurs' | 'config' | 'devtools';

export function AdminPage() {
  const navigate     = useNavigate();
  const { address }  = useAccount();
  const publicClient = usePublicClient();
  const [mainTab, setMainTab] = useState<MainTab>('dashboard');

  // ── Auth ────────────────────────────────────────────────
  const [adminToken, setAdminToken] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'unknown'|'ok'|'invalid'|'testing'>('unknown');

  // ── Data ────────────────────────────────────────────────
  const [players, setPlayers]             = useState<PlayerData[]>([]);
  const [totalCities, setTotalCities]     = useState<number | null>(null);
  const [totalListings, setTotalListings] = useState<number | null>(null);
  const [activeListings, setActiveListings] = useState<number | null>(null);
  const [relayerBalance, setRelayerBalance] = useState<bigint | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [search, setSearch]               = useState('');
  const [expandedCity, setExpandedCity]   = useState<number | null>(null);
  const [snapshots, setSnapshots]         = useState<Record<number, PlayerData>>({});

  // ── Player action state ─────────────────────────────────
  const [deleteStep, setDeleteStep]   = useState<Record<number, number>>({});
  const [deleteInput, setDeleteInput] = useState<Record<number, string>>({});
  const [resetStep, setResetStep]     = useState<Record<number, number>>({});
  const [actionTab, setActionTab]     = useState<Record<number, 'give' | 'retirer' | null>>({});
  const [giveKirha, setGiveKirha]     = useState<Record<number, string>>({});
  const [givePepites, setGivePepites] = useState<Record<number, string>>({});
  const [giveVipDays, setGiveVipDays] = useState<Record<number, string>>({});
  const [giveResId, setGiveResId]     = useState<Record<number, string>>({});
  const [giveResAmt, setGiveResAmt]   = useState<Record<number, string>>({});
  const [giveXpMetier, setGiveXpMetier] = useState<Record<number, string>>({});
  const [giveXpAmt, setGiveXpAmt]     = useState<Record<number, string>>({});
  const [giveNiveauDir, setGiveNiveauDir] = useState<Record<number, string>>({});
  const [giveStatus, setGiveStatus]   = useState<Record<string, 'idle'|'pending'|'ok'|'err'>>({});
  const [retirerKirha, setRetirerKirha] = useState<Record<number, string>>({});
  const [retirerPepites, setRetirerPepites] = useState<Record<number, string>>({});
  const [retirerResId, setRetirerResId] = useState<Record<number, string>>({});
  const [retirerResAmt, setRetirerResAmt] = useState<Record<number, string>>({});
  const [retirerOpStatus, setRetirerOpStatus] = useState<Record<string, 'idle'|'pending'|'ok'|'err'>>({});
  const [retirerStatus, setRetirerStatus] = useState<Record<number, 'idle'|'pending'|'ok'|'err'>>({});

  // ── Config ──────────────────────────────────────────────
  const parcheminPrice    = useGameStore(s => s.parcheminPrice ?? 10);
  const setParcheminPrice = useGameStore(s => s.setParcheminPrice);
  const [parcheminInput, setParcheminInput] = useState('');
  const [configStatus, setConfigStatus] = useState<'idle'|'pending'|'ok'|'err'>('idle');

  // ── Dev Tools — store local ─────────────────────────────
  const ajouterXpPersonage   = useGameStore(s => s.ajouterXpPersonage);
  const addArtefact           = useGameStore(s => s.addArtefact);
  const ajouterRessource      = useGameStore(s => s.ajouterRessource);
  const setMetierFromChain    = useGameStore(s => s.setMetierFromChain);
  const resetGameData         = useGameStore(s => s.resetGameData);
  const ajouterKirha          = useGameStore(s => s.ajouterKirha);
  const ajouterPepites        = useGameStore(s => s.ajouterPepites);
  const personageNiveau       = useGameStore(s => s.personageNiveau);
  const personageXp           = useGameStore(s => s.personageXp);
  const soldeKirha            = useGameStore(s => s.soldeKirha);
  const pepitesOr             = useGameStore(s => s.pepitesOr);

  const [devXp, setDevXp]           = useState('');
  const [devArtefactId, setDevArtefactId] = useState('200');
  const [devResId, setDevResId]     = useState('1');
  const [devResAmt, setDevResAmt]   = useState('');
  const [devMetier, setDevMetier]   = useState('0');
  const [devNiveau, setDevNiveau]   = useState('');
  const [devKirha, setDevKirha]     = useState('');
  const [devPepites, setDevPepites] = useState('');
  const [devLog, setDevLog]         = useState<string[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  function devLogMsg(msg: string) {
    setDevLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);
  }

  const isAdmin = !!address && ADMIN_WALLETS.includes(address.toLowerCase());

  // ── Sync config ─────────────────────────────────────────
  React.useEffect(() => {
    fetch(`${ADMIN_WORKER_URL}/config`)
      .then(r => r.json() as Promise<{ parcheminPrice?: number }>)
      .then(data => { if (data.parcheminPrice) setParcheminPrice(data.parcheminPrice); })
      .catch(() => {});
  }, [setParcheminPrice]);

  // ── Token ────────────────────────────────────────────────
  async function testerToken() {
    if (!adminToken) return;
    setTokenStatus('testing');
    try {
      const res = await fetch(`${ADMIN_WORKER_URL}/admin/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
        body: JSON.stringify({}),
      });
      setTokenStatus(res.ok ? 'ok' : 'invalid');
    } catch {
      setTokenStatus('invalid');
    }
  }

  // ── Charger données ──────────────────────────────────────
  async function charger() {
    if (!publicClient || loading) return;
    setLoading(true);
    setError(null);
    try {
      const relBal = await publicClient.getBalance({ address: RELAYER_ADDRESS });
      setRelayerBalance(relBal);

      const count = await publicClient.readContract({
        address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'playerCount',
      }) as bigint;
      const n = Number(count);
      setTotalCities(n);

      const list: PlayerData[] = [];
      for (let cityId = 1; cityId <= n; cityId++) {
        const cid = BigInt(cityId);
        try {
          const [wallet, pseudo, resourcesRaw, metiersRaw, cityStatus, isBanned] = await Promise.all([
            publicClient.readContract({ address: KIRHA_CITY_ADDRESS, abi: KirhaCityAbi, functionName: 'ownerOf', args: [cid] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'cityPseudo', args: [cid] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'getCityResources', args: [cid, ALL_RESOURCE_IDS] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'getCityMetiers', args: [cid] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'getCityStatus', args: [cid] }),
            publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'bannedCities', args: [cid] }),
          ]);
          const resources = [0, ...(resourcesRaw as bigint[]).map(r => Number(r) / 1e4)];
          const metiersArr = metiersRaw as { level: number; xp: number; xpTotal: number }[];
          const [kirhaWei, pepitesBn, , vipExpBn] = cityStatus as [bigint, bigint, boolean, bigint];
          list.push({
            cityId, pseudo: pseudo as string, wallet: wallet as string,
            kirhaWei, resources,
            levels: metiersArr.map(m => Number(m.level)),
            xp: metiersArr.map(m => Number(m.xp)),
            xpTotal: metiersArr.map(m => Number(m.xpTotal)),
            isBanned: isBanned as boolean, pepites: Number(pepitesBn),
            vipExpiry: Number(vipExpBn),
          });
        } catch { /* ville supprimée */ }
      }
      setPlayers(list);

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

  async function refreshPlayer(cityId: number) {
    if (!publicClient) return;
    try {
      const cid = BigInt(cityId);
      const [wallet, pseudo, resourcesRaw, metiersRaw, cityStatus, isBanned] = await Promise.all([
        publicClient.readContract({ address: KIRHA_CITY_ADDRESS, abi: KirhaCityAbi, functionName: 'ownerOf', args: [cid] }),
        publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'cityPseudo', args: [cid] }),
        publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'getCityResources', args: [cid, ALL_RESOURCE_IDS] }),
        publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'getCityMetiers', args: [cid] }),
        publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'getCityStatus', args: [cid] }),
        publicClient.readContract({ address: KIRHA_GAME_ADDRESS, abi: KirhaGameAbi, functionName: 'bannedCities', args: [cid] }),
      ]);
      const resources = [0, ...(resourcesRaw as bigint[]).map(r => Number(r) / 1e4)];
      const metiersArr = metiersRaw as { level: number; xp: number; xpTotal: number }[];
      const [kirhaWei, pepitesBn, , vipExpBn] = cityStatus as [bigint, bigint, boolean, bigint];
      const updated: PlayerData = {
        cityId, pseudo: pseudo as string, wallet: wallet as string,
        kirhaWei, resources,
        levels: metiersArr.map(m => Number(m.level)),
        xp: metiersArr.map(m => Number(m.xp)),
        xpTotal: metiersArr.map(m => Number(m.xpTotal)),
        isBanned: isBanned as boolean, pepites: Number(pepitesBn),
        vipExpiry: Number(vipExpBn),
      };
      setPlayers(prev => prev.map(p => p.cityId === cityId ? updated : p));
      setSnapshots(prev => ({ ...prev, [cityId]: updated }));
    } catch {
      setPlayers(prev => prev.filter(p => p.cityId !== cityId));
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
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
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
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      setPlayers(prev => prev.filter(p => p.cityId !== cityId));
      setExpandedCity(null);
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 80) : 'Erreur deleteCity');
    }
  }

  async function adminWorkerCall(cityId: number, key: string, action: string, payload: Record<string, string>) {
    if (!adminToken) { setError('Token admin requis'); return; }
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
      const res1 = await fetch(`${ADMIN_WORKER_URL}/admin/reset-city`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
        body: JSON.stringify({ cityId: String(p.cityId) }),
      });
      if (!res1.ok) throw new Error('Reset échoué');
      if (snap.kirhaWei > 0n) {
        await fetch(`${ADMIN_WORKER_URL}/admin/give-kirha`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
          body: JSON.stringify({ cityId: String(p.cityId), amount: snap.kirhaWei.toString() }),
        });
      }
      if (snap.pepites > 0) {
        await fetch(`${ADMIN_WORKER_URL}/admin/give-pepites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
          body: JSON.stringify({ cityId: String(p.cityId), amount: String(snap.pepites) }),
        });
      }
      for (let rid = 1; rid <= 50; rid++) {
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
      const kirha = parseFloat(formatEther(p.kirhaWei));
      const newKirha = type === 'kirha' ? Math.max(0, kirha - amount) : kirha;
      if (newKirha > 0) {
        await fetch(`${ADMIN_WORKER_URL}/admin/give-kirha`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
          body: JSON.stringify({ cityId: String(p.cityId), amount: parseEther(newKirha.toFixed(6)).toString() }),
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
      for (let rid = 1; rid <= 50; rid++) {
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

  // ── Stats globales ───────────────────────────────────────
  const resourceTotals: number[] = Array(51).fill(0);
  for (const p of players) {
    for (let rid = 1; rid <= 50; rid++) resourceTotals[rid] += p.resources[rid] ?? 0;
  }
  const topResources = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, qty: resourceTotals[i + 1] }))
    .filter(r => r.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 15);

  // ── Accès refusé ─────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0010', gap:12 }}>
        <span style={{ fontSize:40 }}>🚫</span>
        <p style={{ color:'#ff6b9d', fontSize:16, fontWeight:700 }}>Accès refusé</p>
        <p style={{ color:'#9a6080', fontSize:12 }}>Wallet non autorisé</p>
      </div>
    );
  }

  const filteredPlayers = players.filter(p =>
    !search || p.pseudo.toLowerCase().includes(search.toLowerCase()) || String(p.cityId).includes(search)
  );

  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', background:'#0a0010', color:'#e0c8d8', fontFamily:'monospace', fontSize:12 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid rgba(196,48,112,0.3)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => navigate('/home')} style={btnBack}>← Retour</button>
          <span style={{ color:'#ff6b9d', fontSize:15, fontWeight:900 }}>⚙️ Admin</span>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <input
            type="password"
            placeholder="Token admin"
            value={adminToken}
            onChange={e => { setAdminToken(e.target.value); setTokenStatus('unknown'); }}
            style={{ width:130, padding:'4px 8px', borderRadius:6, border:`1px solid ${tokenStatus==='ok'?'rgba(106,191,68,0.5)':tokenStatus==='invalid'?'rgba(255,100,100,0.5)':'rgba(196,48,112,0.3)'}`, background:'rgba(0,0,0,0.5)', color:'#e0c8d8', fontSize:11 }}
          />
          <button onClick={testerToken} disabled={!adminToken || tokenStatus === 'testing'}
            style={{ ...btnSmall, background: tokenStatus==='ok'?'rgba(106,191,68,0.2)':tokenStatus==='invalid'?'rgba(255,100,100,0.2)':'rgba(196,48,112,0.2)', color: tokenStatus==='ok'?'#6abf44':tokenStatus==='invalid'?'#ff6464':'#ff6b9d' }}>
            {tokenStatus==='testing'?'⏳':tokenStatus==='ok'?'✅ OK':tokenStatus==='invalid'?'❌':'Tester'}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(196,48,112,0.2)', flexShrink:0 }}>
        {([
          ['dashboard', '📊 Dashboard'],
          ['joueurs',   '👥 Joueurs' + (players.length > 0 ? ` (${players.length})` : '')],
          ['config',    '⚙️ Config'],
          ['devtools',  '🛠️ Dev Tools'],
        ] as [MainTab, string][]).map(([id, label]) => (
          <button key={id}
            style={{ flex:1, padding:'10px 4px', background:'none', border:'none', borderBottom: mainTab===id ? '2px solid #ff6b9d' : '2px solid transparent', color: mainTab===id ? '#ff6b9d' : '#7a4060', fontSize:10, fontWeight:700, cursor:'pointer' }}
            onClick={() => setMainTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding:'6px 16px', background:'rgba(196,48,112,0.1)', borderBottom:'1px solid rgba(196,48,112,0.2)', flexShrink:0 }}>
          <span style={{ color:'#ff6b9d', fontSize:11 }}>❌ {error}</span>
          <button style={{ marginLeft:8, fontSize:10, color:'#9a6080', background:'none', border:'none', cursor:'pointer' }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── Contenu ── */}
      <div style={{ flex:1, overflowY:'auto', padding:16, paddingBottom:100 }}>

        {/* ─── DASHBOARD ─── */}
        {mainTab === 'dashboard' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={charger} disabled={loading}
                style={{ flex:1, padding:'10px', background:'#c43070', color:'#fff', border:'none', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {loading ? '⏳ Chargement…' : '🔄 Charger données on-chain'}
              </button>
            </div>

            {/* Infra */}
            {relayerBalance !== null && (
              <div style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${relayerBalance < 50000000000000000n ? 'rgba(196,48,112,0.5)' : 'rgba(106,191,68,0.3)'}`, borderRadius:12, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                <p style={{ color:'#ff6b9d', fontSize:10, fontWeight:700, margin:0, letterSpacing:'0.05em' }}>INFRA</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'8px 10px' }}>
                    <span style={{ color:'#9a6080', fontSize:9 }}>⛽ Relayer ETH</span>
                    <p style={{ color: relayerBalance < 50000000000000000n ? '#ff6b9d' : '#6abf44', fontSize:14, fontWeight:900, margin:'2px 0 0' }}>
                      {parseFloat(formatEther(relayerBalance)).toFixed(4)}
                    </p>
                    {relayerBalance < 50000000000000000n && <span style={{ color:'#ff6b9d', fontSize:9 }}>⚠️ Recharge requis</span>}
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'8px 10px' }}>
                    <span style={{ color:'#9a6080', fontSize:9 }}>🏙️ Villes</span>
                    <p style={{ color:'#e0c8d8', fontSize:14, fontWeight:900, margin:'2px 0 0' }}>{totalCities ?? '—'}</p>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'8px 10px' }}>
                    <span style={{ color:'#9a6080', fontSize:9 }}>📋 Listings actifs</span>
                    <p style={{ color:'#e0c8d8', fontSize:14, fontWeight:900, margin:'2px 0 0' }}>{activeListings ?? '—'}</p>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'8px 10px' }}>
                    <span style={{ color:'#9a6080', fontSize:9 }}>📦 Total listings</span>
                    <p style={{ color:'#e0c8d8', fontSize:14, fontWeight:900, margin:'2px 0 0' }}>{totalListings ?? '—'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Top ressources */}
            {topResources.length > 0 && (
              <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(196,48,112,0.15)', borderRadius:12, padding:'12px 14px' }}>
                <p style={{ color:'#ff6b9d', fontSize:10, fontWeight:700, margin:'0 0 10px', letterSpacing:'0.05em' }}>📊 TOP RESSOURCES ON-CHAIN</p>
                <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  {topResources.map(r => (
                    <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
                      <span style={{ fontSize:14, width:22 }}>{emojiByResourceId(r.id)}</span>
                      <span style={{ flex:1, color:'#9a9080', fontSize:10 }}>{getNomRessource(r.id, 'fr')}</span>
                      <span style={{ color:'#ff6b9d', fontSize:11, fontWeight:700 }}>×{r.qty.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalCities === null && !loading && (
              <p style={{ color:'#7a4060', fontSize:12, textAlign:'center', padding:'40px 0' }}>
                Clique sur <strong style={{ color:'#ff6b9d' }}>Charger données on-chain</strong> pour commencer.
              </p>
            )}
          </div>
        )}

        {/* ─── JOUEURS ─── */}
        {mainTab === 'joueurs' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {players.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <p style={{ color:'#7a4060', fontSize:12 }}>Charge les données depuis l'onglet Dashboard d'abord.</p>
              </div>
            )}

            {players.length > 0 && (
              <input
                type="text" placeholder="🔍 Pseudo ou #ID…" value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(196,48,112,0.25)', background:'rgba(0,0,0,0.35)', color:'#e0c8d8', fontSize:12, boxSizing:'border-box' }}
              />
            )}

            {filteredPlayers.map(p => {
              const expanded = expandedCity === p.cityId;
              const kirha = parseFloat(formatEther(p.kirhaWei));
              const step = deleteStep[p.cityId] ?? 0;
              const tab = actionTab[p.cityId] ?? null;

              return (
                <div key={p.cityId} style={{ background: p.isBanned ? 'rgba(196,48,112,0.08)' : 'rgba(255,255,255,0.03)', border:`1px solid ${p.isBanned ? 'rgba(196,48,112,0.4)' : 'rgba(196,48,112,0.15)'}`, borderRadius:12, overflow:'hidden' }}>

                  {/* Ligne principale */}
                  <div
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', cursor:'pointer' }}
                    onClick={() => {
                      if (!expanded && !snapshots[p.cityId]) setSnapshots(prev => ({ ...prev, [p.cityId]: { ...p, resources: [...p.resources], levels: [...p.levels], xp: [...p.xp], xpTotal: [...p.xpTotal] } }));
                      setExpandedCity(expanded ? null : p.cityId);
                    }}
                  >
                    <span style={{ color:'#ff6b9d', fontWeight:900, minWidth:24 }}>#{p.cityId}</span>
                    <div style={{ flex:1 }}>
                      <span style={{ color:'#e0c8d8', fontWeight:700 }}>{p.pseudo || '?'}</span>
                      {p.isBanned && <span style={{ marginLeft:6, background:'#c43070', color:'#fff', fontSize:8, padding:'1px 4px', borderRadius:4 }}>BANNI</span>}
                      {p.vipExpiry > Math.floor(Date.now()/1000) && <span style={{ marginLeft:4, background:'rgba(249,168,37,0.2)', color:'#f9a825', fontSize:8, padding:'1px 4px', borderRadius:4 }}>⭐ VIP</span>}
                      <span style={{ color:'#7a4060', fontSize:9, display:'block' }}>{p.wallet.slice(0, 8)}…{p.wallet.slice(-4)}</span>
                    </div>
                    <div style={{ textAlign:'right', marginRight:6 }}>
                      <span style={{ color:'#f9a825', fontWeight:700, fontSize:11 }}>{kirha.toFixed(2)} $K</span>
                      <span style={{ color:'#7a4060', fontSize:9, display:'block' }}>{p.pepites} 🪙 · {p.resources.reduce((a, b) => a + b, 0).toFixed(0)} res.</span>
                    </div>
                    <span style={{ color:'#7a4060', fontSize:10 }}>{expanded ? '▲' : '▼'}</span>
                  </div>

                  {/* Détail */}
                  {expanded && (
                    <div style={{ borderTop:'1px solid rgba(196,48,112,0.12)', padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>

                      {/* Métiers */}
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                        {METIER_NAMES.map((name, i) => (
                          <span key={i} style={{ background:'rgba(196,48,112,0.08)', border:'1px solid rgba(196,48,112,0.18)', borderRadius:8, padding:'2px 8px', fontSize:10 }}>
                            {name} <strong style={{ color:'#ff6b9d' }}>Nv.{p.levels[i] ?? 1}</strong>
                          </span>
                        ))}
                      </div>

                      {/* VIP */}
                      <div style={{ display:'flex', gap:6, alignItems:'center', padding:'5px 8px', background: p.vipExpiry > Math.floor(Date.now()/1000) ? 'rgba(249,168,37,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${p.vipExpiry > Math.floor(Date.now()/1000) ? 'rgba(249,168,37,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius:8 }}>
                        <span style={{ fontSize:12 }}>⭐</span>
                        <span style={{ fontSize:10, color: p.vipExpiry > Math.floor(Date.now()/1000) ? '#f9a825' : '#7a4060' }}>
                          {p.vipExpiry > Math.floor(Date.now()/1000)
                            ? `VIP actif — expire ${new Date(p.vipExpiry * 1000).toLocaleDateString('fr-FR')}`
                            : 'Pas de VIP'}
                        </span>
                      </div>

                      {/* Ressources */}
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {Array.from({ length: 50 }, (_, i) => i + 1).filter(rid => (p.resources[rid] ?? 0) >= 0.01).map(rid => (
                          <span key={rid} style={{ background:'rgba(106,191,68,0.08)', border:'1px solid rgba(106,191,68,0.2)', borderRadius:6, padding:'2px 5px', fontSize:10, color:'#aed6a2' }}>
                            {emojiByResourceId(rid)} ×{p.resources[rid].toFixed(1)}
                          </span>
                        ))}
                      </div>

                      {/* Boutons action rapide */}
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <button
                          style={{ ...btnSmall, background: p.isBanned ? 'rgba(106,191,68,0.2)' : 'rgba(196,48,112,0.15)', color: p.isBanned ? '#6abf44' : '#ff6b9d' }}
                          onClick={() => toggleBan(p.cityId, p.isBanned)}
                        >
                          {p.isBanned ? '✅ Débannir' : '🚫 Bannir'}
                        </button>
                        <button
                          style={{ ...btnSmall, background: tab === 'give' ? 'rgba(106,191,68,0.3)' : 'rgba(106,191,68,0.1)', color:'#6abf44' }}
                          onClick={() => setActionTab(prev => ({ ...prev, [p.cityId]: tab === 'give' ? null : 'give' }))}
                        >
                          🎁 Donner
                        </button>
                        <button
                          style={{ ...btnSmall, background: tab === 'retirer' ? 'rgba(255,100,0,0.3)' : 'rgba(255,100,0,0.1)', color:'#ff6400' }}
                          onClick={() => setActionTab(prev => ({ ...prev, [p.cityId]: tab === 'retirer' ? null : 'retirer' }))}
                        >
                          ↩️ Retirer
                        </button>
                        <button
                          style={{ ...btnSmall, background:'rgba(196,48,112,0.1)', color:'#ff6b9d' }}
                          onClick={() => refreshPlayer(p.cityId)}
                        >
                          🔄 Refresh
                        </button>
                        {snapshots[p.cityId] && (
                          <button
                            style={{ ...btnSmall, background: retirerStatus[p.cityId] === 'pending' ? 'rgba(255,165,0,0.3)' : 'rgba(255,165,0,0.1)', color:'#ffa500' }}
                            onClick={() => retirerDons(p)}
                            disabled={retirerStatus[p.cityId] === 'pending'}
                          >
                            {retirerStatus[p.cityId] === 'pending' ? '⏳' : retirerStatus[p.cityId] === 'ok' ? '✅' : '↩️ Retirer tout dons'}
                          </button>
                        )}
                      </div>

                      {/* Panel Donner */}
                      {tab === 'give' && (
                        <div style={{ background:'rgba(106,191,68,0.04)', border:'1px solid rgba(106,191,68,0.18)', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                          <p style={{ color:'#6abf44', fontSize:10, fontWeight:700, margin:0 }}>🎁 DONNER</p>
                          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                            <span style={labelSm}>💠 KIRHA</span>
                            <input type="number" min="0" placeholder="Montant" value={giveKirha[p.cityId] ?? ''} onChange={e => setGiveKirha(prev => ({ ...prev, [p.cityId]: e.target.value }))} style={inputSm} />
                            <button style={giveSm} disabled={!giveKirha[p.cityId]}
                              onClick={() => { const w = parseEther((parseFloat(giveKirha[p.cityId] || '0')).toFixed(6)); adminWorkerCall(p.cityId, `kirha_${p.cityId}`, 'give-kirha', { amount: w.toString() }); }}>
                              {giveStatus[`kirha_${p.cityId}`] === 'pending' ? '⏳' : giveStatus[`kirha_${p.cityId}`] === 'ok' ? '✅' : 'Donner'}
                            </button>
                          </div>
                          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                            <span style={labelSm}>✨ Pépites</span>
                            <input type="number" min="0" placeholder="Quantité" value={givePepites[p.cityId] ?? ''} onChange={e => setGivePepites(prev => ({ ...prev, [p.cityId]: e.target.value }))} style={inputSm} />
                            <button style={giveSm} disabled={!givePepites[p.cityId]}
                              onClick={() => adminWorkerCall(p.cityId, `pep_${p.cityId}`, 'give-pepites', { amount: givePepites[p.cityId] || '0' })}>
                              {giveStatus[`pep_${p.cityId}`] === 'pending' ? '⏳' : giveStatus[`pep_${p.cityId}`] === 'ok' ? '✅' : 'Donner'}
                            </button>
                          </div>
                          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                            <span style={labelSm}>👑 VIP</span>
                            <select value={giveVipDays[p.cityId] ?? '7'} onChange={e => setGiveVipDays(prev => ({ ...prev, [p.cityId]: e.target.value }))} style={{ ...inputSm, flex:'none', width:90 }}>
                              <option value="7">7 jours</option><option value="30">30 jours</option><option value="90">90 jours</option>
                            </select>
                            <button style={giveSm}
                              onClick={() => adminWorkerCall(p.cityId, `vip_${p.cityId}`, 'give-vip', { days: giveVipDays[p.cityId] ?? '7' })}>
                              {giveStatus[`vip_${p.cityId}`] === 'pending' ? '⏳' : giveStatus[`vip_${p.cityId}`] === 'ok' ? '✅' : 'Donner'}
                            </button>
                          </div>
                          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                            <span style={labelSm}>📦 Res.</span>
                            <select value={giveResId[p.cityId] ?? '1'} onChange={e => setGiveResId(prev => ({ ...prev, [p.cityId]: e.target.value }))} style={{ ...inputSm, flex:'none', width:120, fontSize:9 }}>
                              {Array.from({ length: 50 }, (_, i) => i + 1).map(id => <option key={id} value={id}>{emojiByResourceId(id)} {getNomRessource(id, 'fr')}</option>)}
                            </select>
                            <input type="number" min="1" placeholder="Qté" value={giveResAmt[p.cityId] ?? ''} onChange={e => setGiveResAmt(prev => ({ ...prev, [p.cityId]: e.target.value }))} style={{ ...inputSm, width:55 }} />
                            <button style={giveSm} disabled={!giveResAmt[p.cityId]}
                              onClick={() => adminWorkerCall(p.cityId, `res_${p.cityId}`, 'give-resource', { resourceId: giveResId[p.cityId] ?? '1', amount: giveResAmt[p.cityId] || '0' })}>
                              {giveStatus[`res_${p.cityId}`] === 'pending' ? '⏳' : giveStatus[`res_${p.cityId}`] === 'ok' ? '✅' : 'Donner'}
                            </button>
                          </div>
                          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                            <span style={labelSm}>⭐ XP</span>
                            <select value={giveXpMetier[p.cityId] ?? '0'} onChange={e => setGiveXpMetier(prev => ({ ...prev, [p.cityId]: e.target.value }))} style={{ ...inputSm, flex:'none', width:90 }}>
                              {METIER_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
                            </select>
                            <input type="number" min="1" placeholder="XP" value={giveXpAmt[p.cityId] ?? ''} onChange={e => setGiveXpAmt(prev => ({ ...prev, [p.cityId]: e.target.value }))} style={{ ...inputSm, width:70 }} />
                            <button style={giveSm} disabled={!giveXpAmt[p.cityId]}
                              onClick={() => { const mid = parseInt(giveXpMetier[p.cityId] ?? '0'); const xpAdd = parseInt(giveXpAmt[p.cityId] || '0'); adminWorkerCall(p.cityId, `xp_${p.cityId}`, 'set-metier-xp', { metierId: String(mid), level: String(p.levels[mid] ?? 1), xp: String((p.xp[mid] ?? 0) + xpAdd), xpTotal: String((p.xpTotal[mid] ?? 0) + xpAdd) }); }}>
                              {giveStatus[`xp_${p.cityId}`] === 'pending' ? '⏳' : giveStatus[`xp_${p.cityId}`] === 'ok' ? '✅' : '+XP'}
                            </button>
                            <input type="number" min="1" max="100" placeholder="→Niv" value={giveNiveauDir[p.cityId] ?? ''} onChange={e => setGiveNiveauDir(prev => ({ ...prev, [p.cityId]: e.target.value }))} style={{ ...inputSm, width:55 }} />
                            <button style={{ ...giveSm, background:'rgba(122,108,176,0.25)', color:'#9a6cb0' }} disabled={!giveNiveauDir[p.cityId] || parseInt(giveNiveauDir[p.cityId]) < 1}
                              onClick={() => { const mid = parseInt(giveXpMetier[p.cityId] ?? '0'); const niv = Math.max(1, parseInt(giveNiveauDir[p.cityId] || '1')); const tot = xpTotalPourNiveau(niv); adminWorkerCall(p.cityId, `xp_${p.cityId}`, 'set-metier-xp', { metierId: String(mid), level: String(niv), xp: '0', xpTotal: String(tot) }); }}>
                              {giveStatus[`xp_${p.cityId}`] === 'pending' ? '⏳' : '→Niv'}
                            </button>
                          </div>
                          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                            <span style={labelSm}>🔄 Reset</span>
                            {(resetStep[p.cityId] ?? 0) === 0
                              ? <button style={{ ...giveSm, background:'rgba(255,165,0,0.2)', color:'#ffa500' }} onClick={() => setResetStep(prev => ({ ...prev, [p.cityId]: 1 }))}>Reset ville</button>
                              : <>
                                  <button style={{ ...giveSm, background:'rgba(255,165,0,0.35)', color:'#ffa500' }}
                                    onClick={async () => { await adminWorkerCall(p.cityId, `reset_${p.cityId}`, 'reset-city', {}); setResetStep(prev => ({ ...prev, [p.cityId]: 0 })); }}>
                                    {giveStatus[`reset_${p.cityId}`] === 'pending' ? '⏳' : 'Confirmer'}
                                  </button>
                                  <button style={{ ...giveSm, background:'rgba(255,255,255,0.05)', color:'#7a4060' }} onClick={() => setResetStep(prev => ({ ...prev, [p.cityId]: 0 }))}>Annuler</button>
                                </>
                            }
                          </div>
                        </div>
                      )}

                      {/* Panel Retirer */}
                      {tab === 'retirer' && (
                        <div style={{ background:'rgba(255,100,0,0.04)', border:'1px solid rgba(255,100,0,0.2)', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                          <p style={{ color:'#ff6400', fontSize:10, fontWeight:700, margin:0 }}>↩️ RETIRER</p>
                          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                            <span style={{ ...labelSm, color:'#ff6400' }}>💠 KIRHA</span>
                            <input type="number" min="0" placeholder={`Max:${kirha.toFixed(2)}`} value={retirerKirha[p.cityId] ?? ''} onChange={e => setRetirerKirha(prev => ({ ...prev, [p.cityId]: e.target.value }))} style={inputSm} />
                            <button style={maxSm} onClick={() => setRetirerKirha(prev => ({ ...prev, [p.cityId]: kirha.toFixed(4) }))}>MAX</button>
                            <button style={retirerSm} disabled={!retirerKirha[p.cityId] || retirerOpStatus[`rkirha_${p.cityId}`] === 'pending'}
                              onClick={() => retirerMontant(p, `rkirha_${p.cityId}`, 'kirha', parseFloat(retirerKirha[p.cityId] || '0'))}>
                              {retirerOpStatus[`rkirha_${p.cityId}`] === 'pending' ? '⏳' : retirerOpStatus[`rkirha_${p.cityId}`] === 'ok' ? '✅' : 'Retirer'}
                            </button>
                          </div>
                          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                            <span style={{ ...labelSm, color:'#ff6400' }}>✨ Pépites</span>
                            <input type="number" min="0" placeholder={`Max:${p.pepites}`} value={retirerPepites[p.cityId] ?? ''} onChange={e => setRetirerPepites(prev => ({ ...prev, [p.cityId]: e.target.value }))} style={inputSm} />
                            <button style={maxSm} onClick={() => setRetirerPepites(prev => ({ ...prev, [p.cityId]: String(p.pepites) }))}>MAX</button>
                            <button style={retirerSm} disabled={!retirerPepites[p.cityId] || retirerOpStatus[`rpep_${p.cityId}`] === 'pending'}
                              onClick={() => retirerMontant(p, `rpep_${p.cityId}`, 'pepites', parseInt(retirerPepites[p.cityId] || '0'))}>
                              {retirerOpStatus[`rpep_${p.cityId}`] === 'pending' ? '⏳' : retirerOpStatus[`rpep_${p.cityId}`] === 'ok' ? '✅' : 'Retirer'}
                            </button>
                          </div>
                          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                            <span style={{ ...labelSm, color:'#ff6400' }}>📦 Res.</span>
                            <select value={retirerResId[p.cityId] ?? '1'} onChange={e => setRetirerResId(prev => ({ ...prev, [p.cityId]: e.target.value }))} style={{ ...inputSm, flex:'none', width:120, fontSize:9 }}>
                              {Array.from({ length: 50 }, (_, i) => i + 1).map(id => <option key={id} value={id}>{emojiByResourceId(id)} {getNomRessource(id, 'fr')} (×{Math.floor(p.resources[id] ?? 0)})</option>)}
                            </select>
                            <input type="number" min="1" placeholder="Qté" value={retirerResAmt[p.cityId] ?? ''} onChange={e => setRetirerResAmt(prev => ({ ...prev, [p.cityId]: e.target.value }))} style={{ ...inputSm, width:55 }} />
                            <button style={maxSm} onClick={() => { const rid = parseInt(retirerResId[p.cityId] ?? '1'); setRetirerResAmt(prev => ({ ...prev, [p.cityId]: String(Math.floor(p.resources[rid] ?? 0)) })); }}>MAX</button>
                            <button style={retirerSm} disabled={!retirerResAmt[p.cityId] || retirerOpStatus[`rres_${p.cityId}`] === 'pending'}
                              onClick={() => retirerMontant(p, `rres_${p.cityId}`, 'resource', parseInt(retirerResAmt[p.cityId] || '0'), parseInt(retirerResId[p.cityId] ?? '1'))}>
                              {retirerOpStatus[`rres_${p.cityId}`] === 'pending' ? '⏳' : retirerOpStatus[`rres_${p.cityId}`] === 'ok' ? '✅' : 'Retirer'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Suppression */}
                      {step === 0 && (
                        <button style={{ ...btnSmall, background:'rgba(196,48,112,0.1)', color:'#ff6b9d', alignSelf:'flex-start' }}
                          onClick={() => setDeleteStep(prev => ({ ...prev, [p.cityId]: 1 }))}>
                          🗑️ Supprimer
                        </button>
                      )}
                      {step === 1 && (
                        <div style={{ background:'rgba(196,48,112,0.07)', border:'1px solid rgba(196,48,112,0.25)', borderRadius:8, padding:'8px 10px', display:'flex', gap:6, alignItems:'center' }}>
                          <p style={{ color:'#ff6b9d', fontSize:10, fontWeight:700, margin:0 }}>⚠️ Irréversible.</p>
                          <button style={{ ...giveSm, background:'rgba(196,48,112,0.25)', color:'#ff6b9d' }} onClick={() => setDeleteStep(prev => ({ ...prev, [p.cityId]: 2 }))}>Confirmer</button>
                          <button style={{ ...giveSm, background:'rgba(255,255,255,0.05)', color:'#7a4060' }} onClick={() => setDeleteStep(prev => ({ ...prev, [p.cityId]: 0 }))}>Annuler</button>
                        </div>
                      )}
                      {step === 2 && (
                        <div style={{ background:'rgba(196,48,112,0.07)', border:'1px solid rgba(196,48,112,0.25)', borderRadius:8, padding:'8px 10px', display:'flex', flexDirection:'column', gap:6 }}>
                          <p style={{ color:'#ff6b9d', fontSize:10, margin:0 }}>Saisir #{p.cityId} pour confirmer :</p>
                          <input type="text" placeholder={`Entrer ${p.cityId}`} value={deleteInput[p.cityId] ?? ''} onChange={e => setDeleteInput(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            style={{ padding:'5px 8px', borderRadius:6, border:'1px solid rgba(196,48,112,0.35)', background:'rgba(0,0,0,0.3)', color:'#e0c8d8', fontSize:12 }} />
                          <div style={{ display:'flex', gap:6 }}>
                            <button disabled={deleteInput[p.cityId] !== String(p.cityId)}
                              style={{ ...giveSm, background: deleteInput[p.cityId] === String(p.cityId) ? '#c43070' : 'rgba(196,48,112,0.1)', color:'#fff', opacity: deleteInput[p.cityId] === String(p.cityId) ? 1 : 0.4 }}
                              onClick={() => deleteCity(p.cityId)}>SUPPRIMER</button>
                            <button style={{ ...giveSm, background:'rgba(255,255,255,0.05)', color:'#7a4060' }} onClick={() => { setDeleteStep(prev => ({ ...prev, [p.cityId]: 0 })); setDeleteInput(prev => ({ ...prev, [p.cityId]: '' })); }}>Annuler</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── CONFIG ─── */}
        {mainTab === 'config' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Prix Parchemin */}
            <div style={{ background:'rgba(249,168,37,0.05)', border:'1px solid rgba(249,168,37,0.25)', borderRadius:12, padding:'14px' }}>
              <p style={{ color:'#f9a825', fontSize:11, fontWeight:700, margin:'0 0 10px' }}>
                📜 Prix Parchemin Ancien — Actuel : <strong>{parcheminPrice} $KIRHA</strong>
              </p>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                {[5, 10, 20, 50].map(v => (
                  <button key={v}
                    style={{ padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'1px solid rgba(249,168,37,0.3)', background: parcheminPrice === v ? 'rgba(249,168,37,0.35)' : 'rgba(249,168,37,0.1)', color:'#f9a825' }}
                    onClick={() => { appliquerParcheminPrice(v); setParcheminInput(''); }}>
                    {v} $K
                  </button>
                ))}
                <input type="number" min="1" max="10000" placeholder="Autre…" value={parcheminInput}
                  onChange={e => setParcheminInput(e.target.value)}
                  style={{ width:70, padding:'5px 8px', borderRadius:6, border:'1px solid rgba(249,168,37,0.25)', background:'rgba(0,0,0,0.4)', color:'#e0c8d8', fontSize:11 }} />
                <button
                  disabled={!parcheminInput || parseInt(parcheminInput) < 1 || parseInt(parcheminInput) > 10000 || configStatus === 'pending'}
                  style={{ padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(249,168,37,0.25)', color:'#f9a825' }}
                  onClick={() => { const v = parseInt(parcheminInput); if (v >= 1 && v <= 10000) { appliquerParcheminPrice(v); setParcheminInput(''); } }}>
                  {configStatus === 'pending' ? '⏳' : configStatus === 'ok' ? '✅' : 'Appliquer'}
                </button>
              </div>
            </div>

            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(196,48,112,0.15)', borderRadius:12, padding:'14px' }}>
              <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'0 0 6px' }}>📡 WORKER URL</p>
              <p style={{ color:'#e0c8d8', fontSize:10, fontFamily:'monospace', margin:0, wordBreak:'break-all' }}>{ADMIN_WORKER_URL}</p>
            </div>
          </div>
        )}

        {/* ─── DEV TOOLS ─── */}
        {mainTab === 'devtools' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'rgba(138,37,212,0.06)', border:'1px solid rgba(138,37,212,0.25)', borderRadius:12, padding:'12px 14px' }}>
              <p style={{ color:'#ab47bc', fontSize:10, fontWeight:700, margin:'0 0 4px' }}>⚠️ LOCAL ONLY — modifie le store localStorage de ta ville admin uniquement.</p>
              <p style={{ color:'#7a4060', fontSize:9, margin:0 }}>Perso Nv.{personageNiveau} · {personageXp} XP · {soldeKirha.toFixed(4)} $K · {Math.floor(pepitesOr)} Pépites</p>
            </div>

            {/* XP Personnage */}
            <div style={devCard}>
              <p style={devLabel}>👤 XP Personnage</p>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <input type="number" min="1" placeholder="XP à ajouter" value={devXp}
                  onChange={e => setDevXp(e.target.value)}
                  style={inputSm} />
                <button style={giveSm} disabled={!devXp}
                  onClick={() => {
                    const xp = parseInt(devXp);
                    if (xp > 0) { ajouterXpPersonage(xp); devLogMsg(`+${xp} XP Personnage`); setDevXp(''); }
                  }}>+XP</button>
              </div>
            </div>

            {/* Kirha / Pépites */}
            <div style={devCard}>
              <p style={devLabel}>💰 Monnaies</p>
              <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
                <span style={labelSm}>💠 KIRHA</span>
                <input type="number" min="0.0001" step="0.01" placeholder="Montant" value={devKirha}
                  onChange={e => setDevKirha(e.target.value)} style={inputSm} />
                <button style={giveSm} disabled={!devKirha}
                  onClick={() => { const v = parseFloat(devKirha); if (v > 0) { ajouterKirha(v); devLogMsg(`+${v} $KIRHA`); setDevKirha(''); } }}>Ajouter</button>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <span style={labelSm}>✨ Pépites</span>
                <input type="number" min="1" placeholder="Quantité" value={devPepites}
                  onChange={e => setDevPepites(e.target.value)} style={inputSm} />
                <button style={giveSm} disabled={!devPepites}
                  onClick={() => { const v = parseInt(devPepites); if (v > 0) { ajouterPepites(v); devLogMsg(`+${v} Pépites`); setDevPepites(''); } }}>Ajouter</button>
              </div>
            </div>

            {/* Ressource */}
            <div style={devCard}>
              <p style={devLabel}>📦 Ressource (inventaire local)</p>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                <select value={devResId} onChange={e => setDevResId(e.target.value)}
                  style={{ ...inputSm, flex:'none', width:140, fontSize:9 }}>
                  {Array.from({ length: 69 }, (_, i) => i + 1).map(id => (
                    <option key={id} value={id}>{emojiByResourceId(id)} {getNomRessource(id, 'fr')}</option>
                  ))}
                </select>
                <input type="number" min="1" placeholder="Qté" value={devResAmt}
                  onChange={e => setDevResAmt(e.target.value)} style={{ ...inputSm, width:60 }} />
                <button style={giveSm} disabled={!devResAmt}
                  onClick={() => {
                    const rid = parseInt(devResId) as ResourceId;
                    const qty = parseFloat(devResAmt);
                    if (qty > 0) { ajouterRessource(rid, qty); devLogMsg(`+${qty} ${getNomRessource(rid, 'fr')}`); setDevResAmt(''); }
                  }}>Ajouter</button>
              </div>
            </div>

            {/* Métier niveau */}
            <div style={devCard}>
              <p style={devLabel}>⚔️ Métier — définir niveau</p>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                <select value={devMetier} onChange={e => setDevMetier(e.target.value)}
                  style={{ ...inputSm, flex:'none', width:110 }}>
                  {METIER_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
                </select>
                <input type="number" min="1" max="100" placeholder="Niveau" value={devNiveau}
                  onChange={e => setDevNiveau(e.target.value)} style={{ ...inputSm, width:60 }} />
                <button style={giveSm} disabled={!devNiveau}
                  onClick={() => {
                    const mid = parseInt(devMetier);
                    const niv = Math.max(1, Math.min(100, parseInt(devNiveau)));
                    const tot = xpTotalPourNiveau(niv);
                    setMetierFromChain(METIER_IDS[mid], niv, 0, tot);
                    devLogMsg(`${METIER_NAMES[mid]} → Nv.${niv}`);
                    setDevNiveau('');
                  }}>Appliquer</button>
              </div>
            </div>

            {/* Artefact */}
            <div style={devCard}>
              <p style={devLabel}>🏆 Artefact (local)</p>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <select value={devArtefactId} onChange={e => setDevArtefactId(e.target.value)}
                  style={{ ...inputSm, flex:'none', width:180 }}>
                  {[200, 201, 202, 203, 204].map(id => (
                    <option key={id} value={id}>#{id}</option>
                  ))}
                </select>
                <button style={giveSm}
                  onClick={() => {
                    const id = parseInt(devArtefactId);
                    addArtefact(id);
                    devLogMsg(`Artefact #${id} ajouté`);
                  }}>Ajouter</button>
              </div>
            </div>

            {/* Reset */}
            <div style={{ ...devCard, borderColor:'rgba(196,48,112,0.35)' }}>
              <p style={{ ...devLabel, color:'#ff6b9d' }}>🗑️ Reset données locales</p>
              {!showResetConfirm ? (
                <button style={{ ...btnSmall, background:'rgba(196,48,112,0.15)', color:'#ff6b9d' }}
                  onClick={() => setShowResetConfirm(true)}>
                  Réinitialiser tout (localStorage)
                </button>
              ) : (
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ color:'#ff6b9d', fontSize:10 }}>⚠️ Confirmer le reset ?</span>
                  <button style={{ ...giveSm, background:'#c43070', color:'#fff' }}
                    onClick={() => { resetGameData(); devLogMsg('Store local réinitialisé'); setShowResetConfirm(false); }}>OUI</button>
                  <button style={{ ...giveSm, background:'rgba(255,255,255,0.05)', color:'#7a4060' }}
                    onClick={() => setShowResetConfirm(false)}>Non</button>
                </div>
              )}
            </div>

            {/* Log */}
            {devLog.length > 0 && (
              <div style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(196,48,112,0.15)', borderRadius:10, padding:'10px 12px' }}>
                <p style={{ color:'#9a6080', fontSize:9, fontWeight:700, margin:'0 0 6px' }}>LOG</p>
                {devLog.map((l, i) => (
                  <p key={i} style={{ color:'#6abf44', fontSize:10, margin:'2px 0', fontFamily:'monospace' }}>{l}</p>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

const btnBack: React.CSSProperties = { padding:'5px 10px', background:'rgba(196,48,112,0.12)', border:'1px solid rgba(196,48,112,0.3)', borderRadius:8, color:'#ff6b9d', fontSize:11, fontWeight:700, cursor:'pointer' };
const btnSmall: React.CSSProperties = { padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none' };
const inputSm: React.CSSProperties = { flex:1, padding:'4px 6px', borderRadius:6, border:'1px solid rgba(106,191,68,0.25)', background:'rgba(0,0,0,0.4)', color:'#e0c8d8', fontSize:11, fontFamily:'monospace', minWidth:0 };
const giveSm: React.CSSProperties = { padding:'4px 8px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(106,191,68,0.2)', color:'#6abf44', flexShrink:0 };
const maxSm: React.CSSProperties = { padding:'3px 6px', borderRadius:5, fontSize:9, fontWeight:700, cursor:'pointer', border:'1px solid rgba(106,191,68,0.3)', background:'transparent', color:'#6abf44', flexShrink:0 };
const retirerSm: React.CSSProperties = { padding:'4px 8px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(255,100,0,0.2)', color:'#ff6400', flexShrink:0 };
const labelSm: React.CSSProperties = { color:'#9a9080', fontSize:9, fontWeight:700, width:60, flexShrink:0 };
const devCard: React.CSSProperties = { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(138,37,212,0.2)', borderRadius:12, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 };
const devLabel: React.CSSProperties = { color:'#ab47bc', fontSize:10, fontWeight:700, margin:'0 0 4px' };
