import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import {
  KIRHA_GAME_ADDRESS,
  KIRHA_CITY_ADDRESS,
  KIRHA_MARKET_ADDRESS,
  RELAYER_ADDRESS,
} from '../contracts/addresses';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';
import KirhaCityAbi from '../contracts/abis/KirhaCity.json';
import KirhaMarketAbi from '../contracts/abis/KirhaMarket.json';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';
import { useGameStore } from '../store/gameStore';
import { MetierId } from '../data/metiers';
import { isAdminWallet, ADMIN_RELAYER_URL } from '../config/admin';
import { postAdminRelayer } from '../utils/adminRelayer';

const ALL_RESOURCE_IDS = Array.from({ length: 69 }, (_, i) => BigInt(i + 1));
const METIER_NAMES = ['Bûcheron', 'Paysan', 'Pêcheur', 'Mineur', 'Alchimiste'];
const METIER_IDS: MetierId[] = ['bucheron', 'paysan', 'pecheur', 'mineur', 'alchimiste'];
const MAX_RES = 69;

function xpTotalPourNiveau(n: number): number {
  let total = 0;
  for (let i = 1; i < n; i++) total += Math.round(i * i * 50);
  return total;
}

interface PlayerData {
  cityId: number;
  pseudo: string;
  wallet: string;
  kirhaWei: bigint;
  resources: number[];
  levels: number[];
  xp: number[];
  xpTotal: number[];
  isBanned: boolean;
  pepites: number;
  vipExpiry: number;
}

type Tab = 'stats' | 'joueurs' | 'config';

export function AdminPage() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const parcheminPrice = useGameStore(s => s.parcheminPrice ?? 10);
  const setParcheminPrice = useGameStore(s => s.setParcheminPrice);

  const [tab, setTab] = useState<Tab>('joueurs');
  const [adminToken, setAdminToken] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'ok' | 'bad'>('idle');

  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [totalCities, setTotalCities] = useState<number | null>(null);
  const [totalListings, setTotalListings] = useState<number | null>(null);
  const [activeListings, setActiveListings] = useState<number | null>(null);
  const [relayerBalance, setRelayerBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedCity, setExpandedCity] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<Record<number, PlayerData>>({});

  const [giveKirha, setGiveKirha] = useState<Record<number, string>>({});
  const [givePepites, setGivePepites] = useState<Record<number, string>>({});
  const [giveVipDays, setGiveVipDays] = useState<Record<number, string>>({});
  const [giveResId, setGiveResId] = useState<Record<number, string>>({});
  const [giveResAmt, setGiveResAmt] = useState<Record<number, string>>({});
  const [giveXpMetier, setGiveXpMetier] = useState<Record<number, string>>({});
  const [giveXpAmt, setGiveXpAmt] = useState<Record<number, string>>({});
  const [giveNiveauDir, setGiveNiveauDir] = useState<Record<number, string>>({});
  const [giveStatus, setGiveStatus] = useState<Record<string, 'idle' | 'pending' | 'ok' | 'err'>>({});

  const [retirerKirha, setRetirerKirha] = useState<Record<number, string>>({});
  const [retirerPepites, setRetirerPepites] = useState<Record<number, string>>({});
  const [retirerResId, setRetirerResId] = useState<Record<number, string>>({});
  const [retirerResAmt, setRetirerResAmt] = useState<Record<number, string>>({});
  const [retirerStatus, setRetirerStatus] = useState<Record<number, 'idle' | 'pending' | 'ok' | 'err'>>({});

  const [deleteStep, setDeleteStep] = useState<Record<number, number>>({});
  const [deleteInput, setDeleteInput] = useState<Record<number, string>>({});
  const [resetStep, setResetStep] = useState<Record<number, number>>({});
  const [panel, setPanel] = useState<Record<number, 'give' | 'take' | null>>({});

  const [parcheminInput, setParcheminInput] = useState('');
  const [configStatus, setConfigStatus] = useState<'idle' | 'pending' | 'ok' | 'err'>('idle');

  const isAdmin = isAdminWallet(address);

  React.useEffect(() => {
    fetch(`${ADMIN_RELAYER_URL}/config`)
      .then(r => r.json() as Promise<{ parcheminPrice?: number }>)
      .then(d => {
        if (d.parcheminPrice != null) setParcheminPrice(d.parcheminPrice);
      })
      .catch(() => {});
  }, [setParcheminPrice]);

  async function testerToken() {
    if (!adminToken) return;
    setTokenStatus('idle');
    try {
      await postAdminRelayer('ping', adminToken, {});
      setTokenStatus('ok');
    } catch {
      setTokenStatus('bad');
    }
  }

  async function adminTx(action: string, body: Record<string, string>, key: string, refreshCityId?: number) {
    if (!adminToken) {
      setError('Token admin requis (Cloudflare — variable ADMIN_TOKEN).');
      return;
    }
    setGiveStatus(prev => ({ ...prev, [key]: 'pending' }));
    setError(null);
    try {
      await postAdminRelayer(action, adminToken, body);
      setGiveStatus(prev => ({ ...prev, [key]: 'ok' }));
      if (refreshCityId != null) await refreshPlayer(refreshCityId);
      setTimeout(() => setGiveStatus(prev => ({ ...prev, [key]: 'idle' })), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 120) : 'Erreur');
      setGiveStatus(prev => ({ ...prev, [key]: 'err' }));
    }
  }

  async function charger() {
    if (!publicClient || loading) return;
    setLoading(true);
    setError(null);
    try {
      setRelayerBalance(await publicClient.getBalance({ address: RELAYER_ADDRESS }));
      const count = (await publicClient.readContract({
        address: KIRHA_GAME_ADDRESS,
        abi: KirhaGameAbi,
        functionName: 'playerCount',
      })) as bigint;
      const n = Number(count);
      setTotalCities(n);

      const list: PlayerData[] = [];
      for (let cityId = 1; cityId <= n; cityId++) {
        const cid = BigInt(cityId);
        try {
          const [wallet, pseudo, resourcesRaw, metiersRaw, cityStatus, isBanned] = await Promise.all([
            publicClient.readContract({
              address: KIRHA_CITY_ADDRESS,
              abi: KirhaCityAbi,
              functionName: 'ownerOf',
              args: [cid],
            }),
            publicClient.readContract({
              address: KIRHA_GAME_ADDRESS,
              abi: KirhaGameAbi,
              functionName: 'cityPseudo',
              args: [cid],
            }),
            publicClient.readContract({
              address: KIRHA_GAME_ADDRESS,
              abi: KirhaGameAbi,
              functionName: 'getCityResources',
              args: [cid, ALL_RESOURCE_IDS],
            }),
            publicClient.readContract({
              address: KIRHA_GAME_ADDRESS,
              abi: KirhaGameAbi,
              functionName: 'getCityMetiers',
              args: [cid],
            }),
            publicClient.readContract({
              address: KIRHA_GAME_ADDRESS,
              abi: KirhaGameAbi,
              functionName: 'getCityStatus',
              args: [cid],
            }),
            publicClient.readContract({
              address: KIRHA_GAME_ADDRESS,
              abi: KirhaGameAbi,
              functionName: 'bannedCities',
              args: [cid],
            }),
          ]);
          const resources = [0, ...(resourcesRaw as bigint[]).map(r => Number(r) / 1e4)];
          const metiersArr = metiersRaw as { level: number; xp: number; xpTotal: number }[];
          const [kirhaWei, pepitesBn, , vipExpBn] = cityStatus as [bigint, bigint, boolean, bigint];
          list.push({
            cityId,
            pseudo: pseudo as string,
            wallet: wallet as string,
            kirhaWei,
            resources,
            levels: metiersArr.map(m => Number(m.level)),
            xp: metiersArr.map(m => Number(m.xp)),
            xpTotal: metiersArr.map(m => Number(m.xpTotal)),
            isBanned: isBanned as boolean,
            pepites: Number(pepitesBn),
            vipExpiry: Number(vipExpBn),
          });
        } catch {
          /* skip */
        }
      }
      setPlayers(list);

      const nextId = (await publicClient.readContract({
        address: KIRHA_MARKET_ADDRESS,
        abi: KirhaMarketAbi,
        functionName: 'nextListingId',
      })) as bigint;
      setTotalListings(Number(nextId));
      const listingsResult = (await publicClient.readContract({
        address: KIRHA_MARKET_ADDRESS,
        abi: KirhaMarketAbi,
        functionName: 'getActiveListings',
        args: [0n, 500n],
      })) as [unknown[], unknown[]];
      setActiveListings(listingsResult[0].length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }

  async function refreshPlayer(cityId: number) {
    if (!publicClient) return;
    try {
      const cid = BigInt(cityId);
      const [wallet, pseudo, resourcesRaw, metiersRaw, cityStatus, isBanned] = await Promise.all([
        publicClient.readContract({
          address: KIRHA_CITY_ADDRESS,
          abi: KirhaCityAbi,
          functionName: 'ownerOf',
          args: [cid],
        }),
        publicClient.readContract({
          address: KIRHA_GAME_ADDRESS,
          abi: KirhaGameAbi,
          functionName: 'cityPseudo',
          args: [cid],
        }),
        publicClient.readContract({
          address: KIRHA_GAME_ADDRESS,
          abi: KirhaGameAbi,
          functionName: 'getCityResources',
          args: [cid, ALL_RESOURCE_IDS],
        }),
        publicClient.readContract({
          address: KIRHA_GAME_ADDRESS,
          abi: KirhaGameAbi,
          functionName: 'getCityMetiers',
          args: [cid],
        }),
        publicClient.readContract({
          address: KIRHA_GAME_ADDRESS,
          abi: KirhaGameAbi,
          functionName: 'getCityStatus',
          args: [cid],
        }),
        publicClient.readContract({
          address: KIRHA_GAME_ADDRESS,
          abi: KirhaGameAbi,
          functionName: 'bannedCities',
          args: [cid],
        }),
      ]);
      const resources = [0, ...(resourcesRaw as bigint[]).map(r => Number(r) / 1e4)];
      const metiersArr = metiersRaw as { level: number; xp: number; xpTotal: number }[];
      const [kirhaWei, pepitesBn, , vipExpBn] = cityStatus as [bigint, bigint, boolean, bigint];
      const updated: PlayerData = {
        cityId,
        pseudo: pseudo as string,
        wallet: wallet as string,
        kirhaWei,
        resources,
        levels: metiersArr.map(m => Number(m.level)),
        xp: metiersArr.map(m => Number(m.xp)),
        xpTotal: metiersArr.map(m => Number(m.xpTotal)),
        isBanned: isBanned as boolean,
        pepites: Number(pepitesBn),
        vipExpiry: Number(vipExpBn),
      };
      setPlayers(prev => prev.map(p => (p.cityId === cityId ? updated : p)));
      setSnapshots(prev => ({ ...prev, [cityId]: updated }));
    } catch {
      setPlayers(prev => prev.filter(p => p.cityId !== cityId));
    }
  }

  async function toggleBan(cityId: number, currentlyBanned: boolean) {
    const key = `ban_${cityId}`;
    setGiveStatus(prev => ({ ...prev, [key]: 'pending' }));
    setError(null);
    try {
      if (!adminToken) throw new Error('Token requis');
      await postAdminRelayer('set-ban', adminToken, {
        cityId: String(cityId),
        banned: currentlyBanned ? 'false' : 'true',
      });
      setPlayers(prev => prev.map(p => (p.cityId === cityId ? { ...p, isBanned: !currentlyBanned } : p)));
      setGiveStatus(prev => ({ ...prev, [key]: 'ok' }));
      setTimeout(() => setGiveStatus(prev => ({ ...prev, [key]: 'idle' })), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 120) : 'Erreur ban');
      setGiveStatus(prev => ({ ...prev, [key]: 'err' }));
    }
  }

  async function deleteCity(cityId: number) {
    const key = `del_${cityId}`;
    setGiveStatus(prev => ({ ...prev, [key]: 'pending' }));
    setError(null);
    try {
      if (!adminToken) throw new Error('Token requis');
      await postAdminRelayer('delete-city', adminToken, { cityId: String(cityId) });
      setPlayers(prev => prev.filter(p => p.cityId !== cityId));
      setExpandedCity(null);
      setGiveStatus(prev => ({ ...prev, [key]: 'ok' }));
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 120) : 'Erreur suppression');
      setGiveStatus(prev => ({ ...prev, [key]: 'err' }));
    }
  }

  async function clearProgress(cityId: number) {
    await adminTx('set-player-progress', { cityId: String(cityId), dataHex: '0x' }, `prog_${cityId}`, cityId);
  }

  async function clearVip(cityId: number) {
    await adminTx('set-vip-expiry', { cityId: String(cityId), expiry: '0' }, `vipclr_${cityId}`, cityId);
  }

  async function retirerDons(p: PlayerData) {
    const snap = snapshots[p.cityId];
    if (!snap || !adminToken) {
      setError(!adminToken ? 'Token requis' : 'Ouvre la ligne et utilise Refresh pour snapshot.');
      return;
    }
    setRetirerStatus(prev => ({ ...prev, [p.cityId]: 'pending' }));
    setError(null);
    try {
      await postAdminRelayer('reset-city', adminToken, { cityId: String(p.cityId) });
      if (snap.kirhaWei > 0n) {
        await postAdminRelayer('give-kirha', adminToken, {
          cityId: String(p.cityId),
          amount: snap.kirhaWei.toString(),
        });
      }
      if (snap.pepites > 0) {
        await postAdminRelayer('give-pepites', adminToken, {
          cityId: String(p.cityId),
          amount: String(snap.pepites),
        });
      }
      for (let rid = 1; rid <= MAX_RES; rid++) {
        const qty = Math.floor(snap.resources[rid] ?? 0);
        if (qty >= 1) {
          await postAdminRelayer('give-resource', adminToken, {
            cityId: String(p.cityId),
            resourceId: String(rid),
            amount: String(qty),
          });
        }
      }
      setRetirerStatus(prev => ({ ...prev, [p.cityId]: 'ok' }));
      await refreshPlayer(p.cityId);
      setTimeout(() => setRetirerStatus(prev => ({ ...prev, [p.cityId]: 'idle' })), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 120) : 'Erreur');
      setRetirerStatus(prev => ({ ...prev, [p.cityId]: 'err' }));
    }
  }

  async function retirerMontant(
    p: PlayerData,
    type: 'kirha' | 'pepites' | 'resource',
    amount: number,
    resourceId?: number,
  ) {
    if (!adminToken) {
      setError('Token requis');
      return;
    }
    setError(null);
    try {
      await postAdminRelayer('reset-city', adminToken, { cityId: String(p.cityId) });
      const kirha = parseFloat(formatEther(p.kirhaWei));
      const newKirha = type === 'kirha' ? Math.max(0, kirha - amount) : kirha;
      if (newKirha > 0) {
        await postAdminRelayer('give-kirha', adminToken, {
          cityId: String(p.cityId),
          amount: parseEther(newKirha.toFixed(6)).toString(),
        });
      }
      const newPepites = type === 'pepites' ? Math.max(0, p.pepites - amount) : p.pepites;
      if (newPepites > 0) {
        await postAdminRelayer('give-pepites', adminToken, {
          cityId: String(p.cityId),
          amount: String(newPepites),
        });
      }
      for (let rid = 1; rid <= MAX_RES; rid++) {
        let qty = Math.floor(p.resources[rid] ?? 0);
        if (type === 'resource' && rid === resourceId) qty = Math.max(0, qty - amount);
        if (qty >= 1) {
          await postAdminRelayer('give-resource', adminToken, {
            cityId: String(p.cityId),
            resourceId: String(rid),
            amount: String(qty),
          });
        }
      }
      await refreshPlayer(p.cityId);
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 120) : 'Erreur');
    }
  }

  async function appliquerParcheminPrice(price: number) {
    if (!adminToken) {
      setError('Token requis');
      return;
    }
    setConfigStatus('pending');
    try {
      await postAdminRelayer('set-config', adminToken, { parcheminPrice: String(price) });
      setParcheminPrice(price);
      setConfigStatus('ok');
      setTimeout(() => setConfigStatus('idle'), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 80) : 'Erreur');
      setConfigStatus('err');
    }
  }

  if (!isAdmin) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fdf0f5',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 40 }}>🚫</span>
        <p style={{ color: '#c43070', fontSize: 16, fontWeight: 700 }}>Accès refusé</p>
        <p style={{ color: '#7a4060', fontSize: 13 }}>Ce portail est réservé aux administrateurs.</p>
        <button
          type="button"
          onClick={() => navigate('/home')}
          style={{
            marginTop: 8,
            padding: '10px 20px',
            background: '#c43070',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Retour
        </button>
      </div>
    );
  }

  const filtered = players.filter(
    p =>
      !search ||
      p.pseudo.toLowerCase().includes(search.toLowerCase()) ||
      String(p.cityId).includes(search),
  );

  const resourceTotals: number[] = Array(MAX_RES + 1).fill(0);
  for (const p of players) {
    for (let rid = 1; rid <= MAX_RES; rid++) resourceTotals[rid] += p.resources[rid] ?? 0;
  }
  const topResources = Array.from({ length: MAX_RES }, (_, i) => ({
    id: i + 1,
    qty: resourceTotals[i + 1],
  }))
    .filter(r => r.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 12);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#fdf0f5',
        color: '#1e0a16',
        fontSize: 13,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          padding: '12px 14px',
          borderBottom: '1px solid rgba(212,100,138,0.2)',
          background: 'rgba(255,255,255,0.9)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => navigate('/home')}
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              border: '1px solid rgba(212,100,138,0.35)',
              background: '#fff',
              color: '#c43070',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← Retour
          </button>
          <span style={{ fontWeight: 800, color: '#c43070' }}>Administration</span>
          <span style={{ fontSize: 11, color: '#7a4060' }}>
            Relayer + token — aucune action sur ton inventaire local ici.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="password"
            placeholder="Token worker"
            value={adminToken}
            onChange={e => {
              setAdminToken(e.target.value);
              setTokenStatus('idle');
            }}
            style={{
              width: 140,
              padding: '6px 10px',
              borderRadius: 8,
              border: `1px solid ${tokenStatus === 'ok' ? 'rgba(106,191,68,0.5)' : tokenStatus === 'bad' ? 'rgba(255,80,80,0.5)' : 'rgba(212,100,138,0.25)'}`,
              fontSize: 12,
            }}
          />
          <button
            type="button"
            onClick={() => void testerToken()}
            disabled={!adminToken}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#c43070',
              color: '#fff',
              fontWeight: 700,
              cursor: adminToken ? 'pointer' : 'default',
              opacity: adminToken ? 1 : 0.5,
            }}
          >
            Tester
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(212,100,138,0.15)', flexShrink: 0 }}>
        {(
          [
            ['stats', '📊 Infra'],
            ['joueurs', `👥 Joueurs${players.length ? ` (${players.length})` : ''}`],
            ['config', '⚙️ Config'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderBottom: tab === id ? '2px solid #c43070' : '2px solid transparent',
              background: 'none',
              color: tab === id ? '#c43070' : '#7a4060',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            padding: '8px 14px',
            background: 'rgba(196,48,112,0.08)',
            borderBottom: '1px solid rgba(212,100,138,0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#c43070', fontSize: 12 }}>{error}</span>
          <button type="button" style={{ background: 'none', border: 'none', color: '#7a4060', cursor: 'pointer' }} onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, paddingBottom: 100 }}>
        {tab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              type="button"
              onClick={() => void charger()}
              disabled={loading}
              style={{
                padding: 12,
                background: '#c43070',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontWeight: 700,
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Chargement…' : 'Charger / rafraîchir les données'}
            </button>
            {relayerBalance != null && (
              <div
                style={{
                  border: '1px solid rgba(212,100,138,0.2)',
                  borderRadius: 12,
                  padding: 12,
                  background: '#fff',
                }}
              >
                <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#c43070', fontSize: 11 }}>Infra</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>
                    Relayer ETH
                    <strong style={{ display: 'block', color: relayerBalance < 50_000_000_000_000_000n ? '#c43070' : '#2e7d32' }}>
                      {parseFloat(formatEther(relayerBalance)).toFixed(4)}
                    </strong>
                  </div>
                  <div>
                    Villes
                    <strong style={{ display: 'block' }}>{totalCities ?? '—'}</strong>
                  </div>
                  <div>
                    Listings actifs
                    <strong style={{ display: 'block' }}>{activeListings ?? '—'}</strong>
                  </div>
                  <div>
                    Total listings
                    <strong style={{ display: 'block' }}>{totalListings ?? '—'}</strong>
                  </div>
                </div>
              </div>
            )}
            {topResources.length > 0 && (
              <div style={{ border: '1px solid rgba(212,100,138,0.2)', borderRadius: 12, padding: 12, background: '#fff' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 11, color: '#c43070' }}>Top ressources (agrégé)</p>
                {topResources.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                    <span>
                      {emojiByResourceId(r.id)} {getNomRessource(r.id, 'fr')}
                    </span>
                    <span style={{ fontWeight: 700 }}>×{r.qty.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'joueurs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {players.length === 0 && (
              <p style={{ textAlign: 'center', color: '#7a4060', padding: 32 }}>Charge d’abord l’onglet Infra.</p>
            )}
            <input
              type="search"
              placeholder="Pseudo ou #ville…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 10,
                border: '1px solid rgba(212,100,138,0.25)',
                boxSizing: 'border-box',
              }}
            />
            {filtered.map(p => {
              const open = expandedCity === p.cityId;
              const kirha = parseFloat(formatEther(p.kirhaWei));
              const step = deleteStep[p.cityId] ?? 0;
              const sub = panel[p.cityId];
              return (
                <div
                  key={p.cityId}
                  style={{
                    border: `1px solid ${p.isBanned ? 'rgba(196,48,112,0.45)' : 'rgba(212,100,138,0.2)'}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#fff',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!open && !snapshots[p.cityId]) {
                        setSnapshots(prev => ({
                          ...prev,
                          [p.cityId]: {
                            ...p,
                            resources: [...p.resources],
                            levels: [...p.levels],
                            xp: [...p.xp],
                            xpTotal: [...p.xpTotal],
                          },
                        }));
                      }
                      setExpandedCity(open ? null : p.cityId);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 14px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <strong style={{ color: '#c43070' }}>#{p.cityId}</strong>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700 }}>{p.pseudo || '—'}</span>
                      {p.isBanned && (
                        <span style={{ marginLeft: 6, fontSize: 10, background: '#c43070', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>BAN</span>
                      )}
                      <span style={{ display: 'block', fontSize: 11, color: '#7a4060' }}>
                        {p.wallet.slice(0, 8)}…{p.wallet.slice(-4)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12 }}>
                      <div style={{ fontWeight: 700 }}>{kirha.toFixed(2)} $K</div>
                      <div style={{ color: '#7a4060', fontSize: 11 }}>
                        {p.pepites} pép. · {p.resources.reduce((a, b) => a + b, 0).toFixed(0)} res.
                      </div>
                    </div>
                    <span style={{ color: '#7a4060' }}>{open ? '▲' : '▼'}</span>
                  </button>
                  {open && (
                    <div style={{ borderTop: '1px solid rgba(212,100,138,0.12)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {METIER_NAMES.map((name, i) => (
                          <span
                            key={name}
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              borderRadius: 8,
                              background: 'rgba(212,100,138,0.08)',
                            }}
                          >
                            {name} nv.{p.levels[i] ?? 1}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <button type="button" style={btnSm} onClick={() => void toggleBan(p.cityId, p.isBanned)}>
                          {p.isBanned ? 'Débannir' : 'Bannir'}
                        </button>
                        <button type="button" style={btnSm} onClick={() => setPanel(prev => ({ ...prev, [p.cityId]: sub === 'give' ? null : 'give' }))}>
                          Donner
                        </button>
                        <button type="button" style={btnSmOrange} onClick={() => setPanel(prev => ({ ...prev, [p.cityId]: sub === 'take' ? null : 'take' }))}>
                          Retirer
                        </button>
                        <button type="button" style={btnSm} onClick={() => void refreshPlayer(p.cityId)}>
                          Refresh
                        </button>
                        {snapshots[p.cityId] && (
                          <button type="button" style={btnSmWarn} disabled={retirerStatus[p.cityId] === 'pending'} onClick={() => void retirerDons(p)}>
                            Annuler dons (snapshot)
                          </button>
                        )}
                        <button type="button" style={btnSmDanger} onClick={() => void clearProgress(p.cityId)}>
                          Vider progression (blob)
                        </button>
                        <button type="button" style={btnSmOrange} onClick={() => void clearVip(p.cityId)}>
                          Retirer VIP
                        </button>
                      </div>

                      {sub === 'give' && (
                        <div style={panelBoxGreen}>
                          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 11, color: '#2e7d32' }}>Donner</p>
                          <div style={row}>
                            <span style={lab}>$KIRHA</span>
                            <input
                              style={inp}
                              type="number"
                              value={giveKirha[p.cityId] ?? ''}
                              onChange={e => setGiveKirha(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            />
                            <button
                              type="button"
                              style={btnGo}
                              disabled={!giveKirha[p.cityId]}
                              onClick={() => {
                                const w = parseEther(parseFloat(giveKirha[p.cityId] || '0').toFixed(6)).toString();
                                void adminTx('give-kirha', { cityId: String(p.cityId), amount: w }, `gk_${p.cityId}`, p.cityId);
                              }}
                            >
                              OK
                            </button>
                          </div>
                          <div style={row}>
                            <span style={lab}>Pépites</span>
                            <input
                              style={inp}
                              type="number"
                              value={givePepites[p.cityId] ?? ''}
                              onChange={e => setGivePepites(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            />
                            <button
                              type="button"
                              style={btnGo}
                              disabled={!givePepites[p.cityId]}
                              onClick={() =>
                                void adminTx(
                                  'give-pepites',
                                  { cityId: String(p.cityId), amount: givePepites[p.cityId] || '0' },
                                  `gp_${p.cityId}`,
                                  p.cityId,
                                )
                              }
                            >
                              OK
                            </button>
                          </div>
                          <div style={row}>
                            <span style={lab}>VIP +j</span>
                            <select
                              style={{ ...inp, flex: 'none', width: 100 }}
                              value={giveVipDays[p.cityId] ?? '7'}
                              onChange={e => setGiveVipDays(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            >
                              <option value="7">7</option>
                              <option value="30">30</option>
                              <option value="90">90</option>
                            </select>
                            <button
                              type="button"
                              style={btnGo}
                              onClick={() =>
                                void adminTx(
                                  'give-vip',
                                  { cityId: String(p.cityId), days: giveVipDays[p.cityId] ?? '7' },
                                  `gv_${p.cityId}`,
                                  p.cityId,
                                )
                              }
                            >
                              OK
                            </button>
                          </div>
                          <div style={row}>
                            <span style={lab}>Ressource</span>
                            <select
                              style={{ ...inp, fontSize: 11 }}
                              value={giveResId[p.cityId] ?? '1'}
                              onChange={e => setGiveResId(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            >
                              {Array.from({ length: MAX_RES }, (_, i) => i + 1).map(id => (
                                <option key={id} value={id}>
                                  {emojiByResourceId(id)} {getNomRessource(id, 'fr')}
                                </option>
                              ))}
                            </select>
                            <input
                              style={{ ...inp, width: 70 }}
                              type="number"
                              min={1}
                              value={giveResAmt[p.cityId] ?? ''}
                              onChange={e => setGiveResAmt(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            />
                            <button
                              type="button"
                              style={btnGo}
                              disabled={!giveResAmt[p.cityId]}
                              onClick={() =>
                                void adminTx(
                                  'give-resource',
                                  {
                                    cityId: String(p.cityId),
                                    resourceId: giveResId[p.cityId] ?? '1',
                                    amount: giveResAmt[p.cityId] || '0',
                                  },
                                  `gr_${p.cityId}`,
                                  p.cityId,
                                )
                              }
                            >
                              OK
                            </button>
                          </div>
                          <div style={{ ...row, flexWrap: 'wrap' }}>
                            <span style={lab}>XP métier</span>
                            <select
                              style={{ ...inp, width: 110 }}
                              value={giveXpMetier[p.cityId] ?? '0'}
                              onChange={e => setGiveXpMetier(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            >
                              {METIER_NAMES.map((n, i) => (
                                <option key={n} value={i}>
                                  {n}
                                </option>
                              ))}
                            </select>
                            <input
                              style={{ ...inp, width: 70 }}
                              placeholder="+XP"
                              type="number"
                              value={giveXpAmt[p.cityId] ?? ''}
                              onChange={e => setGiveXpAmt(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            />
                            <button
                              type="button"
                              style={btnGo}
                              disabled={!giveXpAmt[p.cityId]}
                              onClick={() => {
                                const mid = parseInt(giveXpMetier[p.cityId] ?? '0', 10);
                                const add = parseInt(giveXpAmt[p.cityId] || '0', 10);
                                void adminTx(
                                  'set-metier-xp',
                                  {
                                    cityId: String(p.cityId),
                                    metierId: String(mid),
                                    level: String(p.levels[mid] ?? 1),
                                    xp: String((p.xp[mid] ?? 0) + add),
                                    xpTotal: String((p.xpTotal[mid] ?? 0) + add),
                                  },
                                  `gx_${p.cityId}`,
                                  p.cityId,
                                );
                              }}
                            >
                              +XP
                            </button>
                            <input
                              style={{ ...inp, width: 56 }}
                              placeholder="Niv"
                              type="number"
                              value={giveNiveauDir[p.cityId] ?? ''}
                              onChange={e => setGiveNiveauDir(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            />
                            <button
                              type="button"
                              style={btnGo}
                              disabled={!giveNiveauDir[p.cityId]}
                              onClick={() => {
                                const mid = parseInt(giveXpMetier[p.cityId] ?? '0', 10);
                                const niv = Math.max(1, parseInt(giveNiveauDir[p.cityId] || '1', 10));
                                const tot = xpTotalPourNiveau(niv);
                                void adminTx(
                                  'set-metier-xp',
                                  {
                                    cityId: String(p.cityId),
                                    metierId: String(mid),
                                    level: String(niv),
                                    xp: '0',
                                    xpTotal: String(tot),
                                  },
                                  `gn_${p.cityId}`,
                                  p.cityId,
                                );
                              }}
                            >
                              →Niv
                            </button>
                          </div>
                          <div style={row}>
                            <span style={lab}>Reset eco</span>
                            {(resetStep[p.cityId] ?? 0) === 0 ? (
                              <button type="button" style={btnSmWarn} onClick={() => setResetStep(prev => ({ ...prev, [p.cityId]: 1 }))}>
                                Reset KIRHA / res / pépites
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  style={btnSmDanger}
                                  onClick={() => {
                                    void (async () => {
                                      await adminTx('reset-city', { cityId: String(p.cityId) }, `rs_${p.cityId}`, p.cityId);
                                      setResetStep(prev => ({ ...prev, [p.cityId]: 0 }));
                                    })();
                                  }}
                                >
                                  Confirmer
                                </button>
                                <button type="button" style={btnSm} onClick={() => setResetStep(prev => ({ ...prev, [p.cityId]: 0 }))}>
                                  Annuler
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {sub === 'take' && (
                        <div style={panelBoxOrange}>
                          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 11, color: '#e65100' }}>Retirer (reset puis restitute)</p>
                          <div style={row}>
                            <span style={lab}>$KIRHA</span>
                            <input
                              style={inp}
                              type="number"
                              value={retirerKirha[p.cityId] ?? ''}
                              onChange={e => setRetirerKirha(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            />
                            <button
                              type="button"
                              style={btnSm}
                              onClick={() => setRetirerKirha(prev => ({ ...prev, [p.cityId]: kirha.toFixed(4) }))}
                            >
                              Max
                            </button>
                            <button
                              type="button"
                              style={btnOrange}
                              disabled={!retirerKirha[p.cityId]}
                              onClick={() => void retirerMontant(p, 'kirha', parseFloat(retirerKirha[p.cityId] || '0'))}
                            >
                              Retirer
                            </button>
                          </div>
                          <div style={row}>
                            <span style={lab}>Pépites</span>
                            <input
                              style={inp}
                              type="number"
                              value={retirerPepites[p.cityId] ?? ''}
                              onChange={e => setRetirerPepites(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            />
                            <button
                              type="button"
                              style={btnSm}
                              onClick={() => setRetirerPepites(prev => ({ ...prev, [p.cityId]: String(p.pepites) }))}
                            >
                              Max
                            </button>
                            <button
                              type="button"
                              style={btnOrange}
                              disabled={!retirerPepites[p.cityId]}
                              onClick={() => void retirerMontant(p, 'pepites', parseInt(retirerPepites[p.cityId] || '0', 10))}
                            >
                              Retirer
                            </button>
                          </div>
                          <div style={row}>
                            <span style={lab}>Res.</span>
                            <select
                              style={{ ...inp, fontSize: 11 }}
                              value={retirerResId[p.cityId] ?? '1'}
                              onChange={e => setRetirerResId(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            >
                              {Array.from({ length: MAX_RES }, (_, i) => i + 1).map(id => (
                                <option key={id} value={id}>
                                  {emojiByResourceId(id)} (×{Math.floor(p.resources[id] ?? 0)})
                                </option>
                              ))}
                            </select>
                            <input
                              style={{ ...inp, width: 64 }}
                              type="number"
                              value={retirerResAmt[p.cityId] ?? ''}
                              onChange={e => setRetirerResAmt(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            />
                            <button
                              type="button"
                              style={btnOrange}
                              disabled={!retirerResAmt[p.cityId]}
                              onClick={() =>
                                void retirerMontant(
                                  p,
                                  'resource',
                                  parseInt(retirerResAmt[p.cityId] || '0', 10),
                                  parseInt(retirerResId[p.cityId] ?? '1', 10),
                                )
                              }
                            >
                              Retirer
                            </button>
                          </div>
                        </div>
                      )}

                      <div style={{ fontSize: 11, color: '#7a4060' }}>
                        Métiers internes :{' '}
                        {METIER_IDS.map((id, i) => (
                          <span key={id} style={{ marginRight: 6 }}>
                            {id}:{p.levels[i]}
                          </span>
                        ))}
                      </div>

                      {step === 0 && (
                        <button type="button" style={btnSmDanger} onClick={() => setDeleteStep(prev => ({ ...prev, [p.cityId]: 1 }))}>
                          Supprimer la ville (NFT + données)
                        </button>
                      )}
                      {step === 1 && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: '#c43070', fontWeight: 700 }}>Confirmer suppression ?</span>
                          <button type="button" style={btnSmDanger} onClick={() => setDeleteStep(prev => ({ ...prev, [p.cityId]: 2 }))}>
                            Continuer
                          </button>
                          <button type="button" style={btnSm} onClick={() => setDeleteStep(prev => ({ ...prev, [p.cityId]: 0 }))}>
                            Annuler
                          </button>
                        </div>
                      )}
                      {step === 2 && (
                        <div>
                          <p style={{ fontSize: 12 }}>Saisir {p.cityId} pour confirmer :</p>
                          <input
                            value={deleteInput[p.cityId] ?? ''}
                            onChange={e => setDeleteInput(prev => ({ ...prev, [p.cityId]: e.target.value }))}
                            style={{ ...inp, maxWidth: 200 }}
                          />
                          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              disabled={deleteInput[p.cityId] !== String(p.cityId)}
                              style={{ ...btnSmDanger, opacity: deleteInput[p.cityId] === String(p.cityId) ? 1 : 0.4 }}
                              onClick={() => void deleteCity(p.cityId)}
                            >
                              SUPPRIMER
                            </button>
                            <button
                              type="button"
                              style={btnSm}
                              onClick={() => {
                                setDeleteStep(prev => ({ ...prev, [p.cityId]: 0 }));
                                setDeleteInput(prev => ({ ...prev, [p.cityId]: '' }));
                              }}
                            >
                              Annuler
                            </button>
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

        {tab === 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: 14, borderRadius: 12, border: '1px solid rgba(249,168,37,0.35)', background: '#fff' }}>
              <p style={{ margin: '0 0 10px', fontWeight: 700, color: '#b07500' }}>Prix parchemin — actuel : {parcheminPrice} $KIRHA</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[5, 10, 20, 50].map(v => (
                  <button
                    key={v}
                    type="button"
                    disabled={configStatus === 'pending'}
                    onClick={() => void appliquerParcheminPrice(v)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      border: '1px solid rgba(249,168,37,0.4)',
                      background: parcheminPrice === v ? 'rgba(249,168,37,0.25)' : '#fff',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    {v} $K
                  </button>
                ))}
                <input
                  type="number"
                  value={parcheminInput}
                  onChange={e => setParcheminInput(e.target.value)}
                  placeholder="Autre"
                  style={{ width: 80, padding: 8, borderRadius: 8, border: '1px solid rgba(212,100,138,0.25)' }}
                />
                <button
                  type="button"
                  disabled={configStatus === 'pending'}
                  onClick={() => {
                    const v = parseInt(parcheminInput, 10);
                    if (v >= 1 && v <= 10000) void appliquerParcheminPrice(v);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#f9a825',
                    color: '#1e0a16',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {configStatus === 'pending' ? '…' : 'Appliquer'}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 11, color: '#7a4060', wordBreak: 'break-all' }}>Worker : {ADMIN_RELAYER_URL}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const btnSm: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(212,100,138,0.25)',
  background: '#fff',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  color: '#c43070',
};
const btnSmOrange: React.CSSProperties = { ...btnSm, color: '#e65100', borderColor: 'rgba(230,81,0,0.3)' };
const btnSmWarn: React.CSSProperties = { ...btnSm, color: '#f57c00' };
const btnSmDanger: React.CSSProperties = { ...btnSm, color: '#b71c1c', borderColor: 'rgba(183,28,28,0.35)' };
const btnOrange: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: 'none',
  background: '#ff9800',
  color: '#fff',
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
};
const panelBoxGreen: React.CSSProperties = {
  border: '1px solid rgba(106,191,68,0.35)',
  borderRadius: 10,
  padding: 10,
  background: 'rgba(106,191,68,0.06)',
};
const panelBoxOrange: React.CSSProperties = {
  border: '1px solid rgba(255,152,0,0.4)',
  borderRadius: 10,
  padding: 10,
  background: 'rgba(255,152,0,0.06)',
};
const row: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 };
const lab: React.CSSProperties = { width: 72, fontSize: 11, fontWeight: 600, color: '#7a4060' };
const inp: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid rgba(212,100,138,0.2)',
  fontSize: 12,
};
const btnGo: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#2e7d32',
  color: '#fff',
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
};
