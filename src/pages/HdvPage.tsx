import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicClient } from 'wagmi';
import { parseAbiItem, formatEther } from 'viem';
import { useGameStore } from '../store/gameStore';
import { getResourceById } from '../data/metiers';
import { ResourceId } from '../data/resources';
import { useT } from '../utils/i18n';
import { useMarket } from '../hooks/useMarket';
import { useSave } from '../hooks/useSave';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';
import { KIRHA_MARKET_ADDRESS, KIRHA_GAME_ADDRESS } from '../contracts/addresses';
import KirhaMarketAbi from '../contracts/abis/KirhaMarket.json';
import KirhaGameAbi from '../contracts/abis/KirhaGame.json';

// ── Historique des ventes ────────────────────────────────────

interface SaleRecord {
  listingId: bigint;
  sellerCityId: bigint;
  sellerPseudo: string;
  buyerCityId: bigint;
  buyerPseudo: string;
  resourceId: number;
  quantity: number;
  totalPaid: number;
  txHash: string;
}

function TabHistorique({ myCityId }: { myCityId: bigint | undefined }) {
  const [history, setHistory] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all'|'mine'>('all');
  const { lang } = useT();
  const publicClient = usePublicClient();

  const fetchHistory = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = latestBlock > 100000n ? latestBlock - 100000n : 0n;

      const logs = await publicClient.getLogs({
        address: KIRHA_MARKET_ADDRESS,
        event: parseAbiItem('event ResourceSold(uint256 indexed listingId, uint256 indexed buyerCityId, uint256 quantity, uint256 totalPaid, uint256 sellerReceives)'),
        fromBlock,
        toBlock: latestBlock,
      });

      if (logs.length === 0) { setHistory([]); setLoading(false); return; }

      const uniqueListingIds = [...new Set(logs.map(l => l.args.listingId!))];
      const listingDetails = await Promise.all(
        uniqueListingIds.map(async (lid) => {
          try {
            const listing = await publicClient.readContract({
              address: KIRHA_MARKET_ADDRESS,
              abi: KirhaMarketAbi,
              functionName: 'getListing',
              args: [lid],
            }) as { sellerCityId: bigint; resourceId: bigint; quantity: bigint; pricePerUnit: bigint; active: boolean };
            return { listingId: lid, sellerCityId: listing.sellerCityId, resourceId: Number(listing.resourceId) };
          } catch { return { listingId: lid, sellerCityId: 0n, resourceId: 0 }; }
        })
      );

      const listingMap = new Map(listingDetails.map(l => [l.listingId, l]));

      const allCityIds = [...new Set([
        ...logs.map(l => l.args.buyerCityId!),
        ...listingDetails.map(l => l.sellerCityId).filter(id => id > 0n),
      ])];

      const pseudos = allCityIds.length > 0
        ? await publicClient.readContract({
            address: KIRHA_GAME_ADDRESS,
            abi: KirhaGameAbi,
            functionName: 'getCityPseudos',
            args: [allCityIds],
          }) as string[]
        : [];

      const pseudoMap = new Map(allCityIds.map((id, i) => [id, pseudos[i] ?? '?']));

      const records: SaleRecord[] = [...logs].reverse().map(log => {
        const listing = listingMap.get(log.args.listingId!);
        const sellerCityId = listing?.sellerCityId ?? 0n;
        return {
          listingId:    log.args.listingId!,
          sellerCityId,
          sellerPseudo: pseudoMap.get(sellerCityId) ?? '?',
          buyerCityId:  log.args.buyerCityId!,
          buyerPseudo:  pseudoMap.get(log.args.buyerCityId!) ?? '?',
          resourceId:   listing?.resourceId ?? 0,
          quantity:     Number(log.args.quantity!) / 1e4,
          totalPaid:    parseFloat(formatEther(log.args.totalPaid!)),
          txHash:       log.transactionHash ?? '',
        };
      });

      setHistory(records);
    } catch (e) {
      console.error('History fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [publicClient]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const displayed = filter === 'mine' && myCityId
    ? history.filter(r => r.buyerCityId === myCityId || r.sellerCityId === myCityId)
    : history;

  return (
    <div style={{ padding: '14px', paddingBottom: 90 }}>
      {/* Filtre */}
      <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center' }}>
        <div style={{ display:'flex', gap:6, flex:1 }}>
          {(['all','mine'] as const).map(f => (
            <button key={f} style={{ flex:1, padding:'7px', background: filter===f ? 'rgba(196,48,112,0.15)' : 'rgba(212,100,138,0.06)', border: filter===f ? '1px solid rgba(196,48,112,0.5)' : '1px solid rgba(212,100,138,0.13)', borderRadius:10, color: filter===f ? '#c43070' : '#7a4060', fontSize:11, fontWeight:700, cursor:'pointer' }}
              onClick={() => setFilter(f)}>
              {f === 'all' ? '🌐 Toutes' : '👤 Mes transactions'}
            </button>
          ))}
        </div>
        <button onClick={fetchHistory} disabled={loading} style={{ padding:'7px 12px', background:'rgba(212,100,138,0.08)', border:'1px solid rgba(212,100,138,0.2)', borderRadius:10, color:'#7a4060', fontSize:11, cursor:'pointer' }}>
          {loading ? '⏳' : '🔄'}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign:'center', padding:'30px 0', color:'#7a4060', fontSize:12 }}>Chargement de l'historique…</div>
      )}

      {!loading && displayed.length === 0 && (
        <div style={s.empty}>
          <span style={{ fontSize:36 }}>📋</span>
          <p style={{ color:'#7a4060', fontSize:13, marginTop:10 }}>
            {filter === 'mine' ? 'Aucune transaction personnelle.' : 'Aucune vente enregistrée.'}
          </p>
        </div>
      )}

      {!loading && displayed.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {displayed.map((r, i) => {
            const isMySale = !!(myCityId && r.sellerCityId === myCityId);
            const isMyBuy  = !!(myCityId && r.buyerCityId === myCityId);
            return (
              <div key={i} style={{ ...s.itemRow, borderColor: isMySale ? 'rgba(106,191,68,0.3)' : isMyBuy ? 'rgba(41,182,246,0.3)' : 'rgba(212,100,138,0.15)' }}>
                <div style={{ ...s.itemIcon, borderColor: 'rgba(212,100,138,0.2)' }}>
                  <span style={{ fontSize:18 }}>{emojiByResourceId(r.resourceId)}</span>
                </div>
                <div style={{ flex:1 }}>
                  <span style={{ color:'#1e0a16', fontSize:12, fontWeight:700 }}>{getNomRessource(r.resourceId, lang)}</span>
                  <span style={{ color:'#7a4060', fontSize:10, display:'block' }}>
                    ×{r.quantity.toFixed(1)} · {r.sellerPseudo} → {r.buyerPseudo}
                  </span>
                </div>
                <div style={{ textAlign:'right' }}>
                  <span style={{ color:'#f9a825', fontSize:12, fontWeight:800, display:'block' }}>{r.totalPaid.toFixed(4)} $K</span>
                  {(isMySale || isMyBuy) && (
                    <span style={{ fontSize:9, fontWeight:700, color: isMySale ? '#6abf44' : '#29b6f6' }}>
                      {isMySale ? '💰 Vendu' : '🛒 Acheté'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Onglet HDV on-chain ─────────────────────────────────────

function TabOnchain() {
  const inventaire  = useGameStore(s => s.inventaire);
  const villeId     = useGameStore(s => s.villeId);
  const vipExpiry   = useGameStore(s => s.vipExpiry);
  const soldeKirha  = useGameStore(s => s.soldeKirha);
  const kirhaEarned = useGameStore(s => s.kirhaEarned);
  const pepitesOr   = useGameStore(s => s.pepitesOr);
  // Kirha réellement disponible on-chain (les gains PNJ non sauvegardés ne sont pas encore on-chain)
  const onChainKirha = Math.max(0, soldeKirha - kirhaEarned);
  const { lang } = useT();
  const villeIdBn   = villeId && villeId !== '0' ? BigInt(villeId) : undefined;
  const isVip = vipExpiry > 0 && vipExpiry > Math.floor(Date.now() / 1000);
  const taxRate = isVip ? 0.25 : 0.5;
  const taxLabel = isVip ? 'Taxe: 25% (VIP)' : 'Taxe: 50%';
  const {
    listings, myListings, status, error, isRelayerActive,
    activerRelayer, acheter, batchMettrEnVente, annulerListing,
  } = useMarket();
  const { sauvegarder, status: saveStatus, pendingCount } = useSave();

  const [tab, setTab]               = useState<'acheter'|'vendre'|'mesVentes'|'historique'>('acheter');
  const [relayerSecondsLeft, setRelayerSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!isRelayerActive || !villeId) { setRelayerSecondsLeft(null); return; }
    const at = parseInt(localStorage.getItem(`kirha_relayer_at_${villeId}`) ?? '0');
    const expiresAt = at ? at + 43200_000 : Date.now() + 43200_000;
    const update = () => setRelayerSecondsLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isRelayerActive, villeId]);
  const [sellResourceId, setSellResourceId] = useState('');
  const [sellQty, setSellQty]       = useState('');
  const [sellPrice, setSellPrice]   = useState('');
  const [buyResourceId, setBuyResourceId] = useState('');

  const [buyQty, setBuyQty]         = useState<Record<string, string>>({});

  type CartItem = { resourceId: number; quantity: number; pricePerUnit: number };
  const [cart, setCart] = useState<CartItem[]>([]);

  const inventaireItems = (Object.entries(inventaire) as [string, number][])
    .filter(([, qty]) => Math.floor(qty) >= 1)
    .map(([id, qty]) => ({ id: Number(id) as ResourceId, qty: Math.floor(qty) }));

  const selectedItem = inventaireItems.find(i => i.id === parseInt(sellResourceId));
  const maxQty = selectedItem?.qty ?? 0;

  useEffect(() => { setSellQty(''); setSellPrice(''); }, [sellResourceId]);

  useEffect(() => {
    if (!sellResourceId || sellPrice !== '') return;
    const rid = parseInt(sellResourceId);
    const resourceListings = listings.filter(l => l.resourceId === rid);
    if (resourceListings.length > 0) {
      const minPrice = Math.min(...resourceListings.map(l => l.pricePerUnit));
      setSellPrice(minPrice.toFixed(4));
    } else {
      setSellPrice('0.0100');
    }
  }, [sellResourceId, listings, sellPrice]);

  const busy = status === 'listing' || status === 'buying' || status === 'cancelling';
  const relayerActivating = status === 'listing' && !isRelayerActive;

  const priceNum = parseFloat(sellPrice || '0');
  const qtyNum   = parseInt(sellQty || '0');
  const totalNet  = priceNum * qtyNum * (1 - taxRate);

  const marketPrice = (() => {
    if (!sellResourceId) return null;
    const rid = parseInt(sellResourceId);
    const rl = listings.filter(l => l.resourceId === rid);
    if (rl.length === 0) return null;
    return Math.min(...rl.map(l => l.pricePerUnit));
  })();

  const buyResourceIds = [...new Set(listings.map(l => l.resourceId))].sort((a, b) => a - b);

  const listingsSorted = [...listings]
    .filter(l => buyResourceId !== '' && l.resourceId === parseInt(buyResourceId))
    .sort((a, b) => a.pricePerUnit - b.pricePerUnit);

  return (
    <div style={{ paddingBottom:130 }}>

      {/* Bannière relayer */}
      {isRelayerActive ? (
        <div style={{ margin:'12px 14px 0', padding:'10px 14px', background:'rgba(106,191,68,0.07)', border:'1px solid rgba(106,191,68,0.3)', borderRadius:12, display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:18 }}>⚡</span>
          <div style={{ flex:1 }}>
            <p style={{ color:'#1e0a16', fontSize:12, fontWeight:700, margin:'0 0 1px' }}>Mode gasless actif</p>
            {relayerSecondsLeft !== null && (
              <p style={{ color:'#7a4060', fontSize:10, margin:0 }}>
                Expire dans {Math.floor(relayerSecondsLeft / 3600)}h {Math.floor((relayerSecondsLeft % 3600) / 60)}min
              </p>
            )}
          </div>
          <span style={{ color:'#6abf44', fontSize:10, fontWeight:700, background:'rgba(106,191,68,0.15)', padding:'3px 8px', borderRadius:6 }}>✓ ACTIF</span>
        </div>
      ) : (
        <div style={{ margin:'12px 14px 0', padding:'12px 14px', background:'rgba(249,168,37,0.08)', border:'1px solid rgba(249,168,37,0.35)', borderRadius:12, display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:20 }}>⚡</span>
          <div style={{ flex:1 }}>
            <p style={{ color:'#1e0a16', fontSize:12, fontWeight:700, margin:'0 0 2px' }}>Mode gasless désactivé</p>
            <p style={{ color:'#7a4060', fontSize:10, margin:0 }}>Autorise le relayer une fois (12h) pour des transactions sans frais.</p>
          </div>
          <button
            style={{ padding:'7px 12px', background:'#f9a825', color:'#1e0a16', border:'none', borderRadius:10, fontSize:11, fontWeight:700, cursor: relayerActivating ? 'default' : 'pointer', opacity: relayerActivating ? 0.6 : 1 }}
            onClick={activerRelayer}
            disabled={relayerActivating}
          >
            {relayerActivating ? '⏳…' : 'Activer (12h)'}
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display:'flex', gap:8, padding:'12px 14px 0' }}>
        <div style={ms.statCard}>
          <span style={{ color:'#c43070', fontSize:17, fontWeight:900 }}>{listings.length}</span>
          <span style={{ color:'#9a6080', fontSize:9, fontWeight:700, marginTop:1 }}>OFFRES</span>
        </div>
        <div style={ms.statCard}>
          <span style={{ color:'#f9a825', fontSize:17, fontWeight:900 }}>{[...new Set(listings.map(l => l.resourceId))].length}</span>
          <span style={{ color:'#9a6080', fontSize:9, fontWeight:700, marginTop:1 }}>RESSOURCES</span>
        </div>
        <div style={{ ...ms.statCard, flex:2 }}>
          {isVip
            ? <span style={{ color:'#f9a825', fontSize:11, fontWeight:700 }}>👑 VIP actif — Taxe 25%</span>
            : <span style={{ color:'#9a6080', fontSize:11 }}>Taxe vendeur : 50%</span>
          }
        </div>
      </div>

      {/* Soldes */}
      <div style={{ display:'flex', gap:8, padding:'8px 14px 0' }}>
        <div style={{ ...ms.statCard, flex:1, flexDirection:'row', gap:6, alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:14 }}>💠</span>
          <div>
            <span style={{ color:'#1e0a16', fontSize:13, fontWeight:800 }}>{soldeKirha > 0 ? soldeKirha.toFixed(4) : '—'}</span>
            <span style={{ color:'#9a6080', fontSize:9, display:'block', fontWeight:700 }}>$KIRHA</span>
          </div>
        </div>
        <div style={{ ...ms.statCard, flex:1, flexDirection:'row', gap:6, alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:14 }}>🪙</span>
          <div>
            <span style={{ color:'#f9a825', fontSize:13, fontWeight:800 }}>{pepitesOr > 0 ? pepitesOr.toFixed(0) : '—'}</span>
            <span style={{ color:'#9a6080', fontSize:9, display:'block', fontWeight:700 }}>PÉPITES</span>
          </div>
        </div>
      </div>

      {/* Tab bar — pills */}
      <div style={{ display:'flex', gap:6, padding:'12px 14px 0', overflowX:'auto', scrollbarWidth:'none' }}>
        {(['acheter','vendre','mesVentes','historique'] as const).map(tid => (
          <button
            key={tid}
            style={{ padding:'8px 14px', background: tab===tid ? '#c43070' : 'rgba(196,48,112,0.07)', border: tab===tid ? 'none' : '1px solid rgba(196,48,112,0.2)', borderRadius:20, color: tab===tid ? '#fff' : '#9a6080', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
            onClick={() => setTab(tid)}
          >
            {tid === 'acheter' ? '🛒 Acheter' : tid === 'vendre' ? '💰 Vendre' : tid === 'mesVentes' ? '📋 Mes ventes' : '📜 Historique'}
          </button>
        ))}
      </div>

      <div style={{ padding:'12px 14px' }}>

        {/* ── Acheter ── */}
        {tab === 'acheter' && (
          <>
            {listings.length === 0 ? (
              <div style={s.empty}>
                <span style={{ fontSize:40 }}>🏪</span>
                <p style={{ color:'#7a4060', fontSize:13, marginTop:10 }}>Aucune offre sur le marché pour l'instant.</p>
              </div>
            ) : (
              <>
                {/* Grille ressources */}
                <p style={{ color:'#9a6080', fontSize:10, fontWeight:700, margin:'0 0 10px', letterSpacing:'0.06em' }}>🌸 RESSOURCES DISPONIBLES</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
                  {buyResourceIds.map(rid => {
                    const ridListings = listings.filter(l => l.resourceId === rid);
                    const bestPrice = Math.min(...ridListings.map(l => l.pricePerUnit));
                    const isSelected = buyResourceId === String(rid);
                    return (
                      <button
                        key={rid}
                        onClick={() => { setBuyResourceId(isSelected ? '' : String(rid)); setBuyQty({}); }}
                        style={{ background: isSelected ? 'linear-gradient(135deg, rgba(196,48,112,0.1), rgba(138,37,212,0.07))' : '#fff', border: isSelected ? '2px solid #c43070' : '1px solid rgba(212,100,138,0.2)', borderRadius:14, padding:'10px', cursor:'pointer', textAlign:'left', boxShadow: isSelected ? '0 2px 12px rgba(196,48,112,0.12)' : 'none' }}
                      >
                        <span style={{ fontSize:26, display:'block', marginBottom:4 }}>{emojiByResourceId(rid)}</span>
                        <span style={{ color:'#1e0a16', fontSize:11, fontWeight:700, display:'block', marginBottom:4, lineHeight:1.2 }}>{getNomRessource(rid, lang)}</span>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ background:'rgba(196,48,112,0.1)', color:'#c43070', fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:8 }}>
                            {ridListings.length} offre{ridListings.length > 1 ? 's' : ''}
                          </span>
                          <span style={{ color:'#f9a825', fontSize:10, fontWeight:800 }}>{bestPrice.toFixed(4)} $K</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Listings pour la ressource sélectionnée */}
                {buyResourceId !== '' && (
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                      <span style={{ fontSize:20 }}>{emojiByResourceId(parseInt(buyResourceId))}</span>
                      <span style={{ color:'#1e0a16', fontSize:13, fontWeight:700 }}>{getNomRessource(parseInt(buyResourceId), lang)}</span>
                      <span style={{ color:'#9a6080', fontSize:10 }}>{listingsSorted.length} offre{listingsSorted.length > 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {listingsSorted.map((l, idx) => {
                        const key = l.listingId.toString();
                        const isMine = villeIdBn !== undefined && l.sellerCityId === villeIdBn;
                        const isCheapest = idx === 0;
                        const qtyVal = buyQty[key] ?? '1';
                        return (
                          <div key={key} style={{ background:'#fff', border: isCheapest && !isMine ? '1.5px solid rgba(106,191,68,0.45)' : '1px solid rgba(212,100,138,0.15)', borderRadius:14, padding:'12px', display:'flex', alignItems:'center', gap:10, opacity: isMine ? 0.65 : 1, boxShadow: isCheapest && !isMine ? '0 2px 10px rgba(106,191,68,0.08)' : 'none' }}>
                            <div style={{ width:46, height:46, borderRadius:12, background: isCheapest ? 'rgba(106,191,68,0.1)' : 'rgba(196,48,112,0.05)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <span style={{ fontSize:24 }}>{emojiByResourceId(l.resourceId)}</span>
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2, flexWrap:'wrap' }}>
                                <span style={{ color:'#c43070', fontSize:17, fontWeight:900, lineHeight:1 }}>{l.pricePerUnit.toFixed(4)}</span>
                                <span style={{ color:'#9a6080', fontSize:10 }}>$K/u</span>
                                {isCheapest && !isMine && <span style={{ background:'rgba(106,191,68,0.15)', color:'#4a8f2a', fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:8 }}>🌸 Meilleur</span>}
                              </div>
                              <span style={{ color:'#9a6080', fontSize:10 }}>
                                ×{l.quantity} dispo · {isMine ? <span style={{ color:'#6abf44', fontWeight:700 }}>Votre vente</span> : `🏪 ${l.sellerPseudo}`}
                              </span>
                            </div>
                            {isMine ? (
                              <span style={{ color:'#b08080', fontSize:10, fontStyle:'italic' }}>En vente</span>
                            ) : (
                              <div style={{ display:'flex', flexDirection:'column', gap:5, alignItems:'flex-end' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                                  <button
                                    style={{ width:22, height:22, background:'rgba(196,48,112,0.1)', border:'1px solid rgba(196,48,112,0.25)', borderRadius:5, color:'#c43070', fontSize:14, fontWeight:700, cursor:'pointer', lineHeight:1, padding:0 }}
                                    onClick={() => setBuyQty(prev => ({ ...prev, [key]: String(Math.max(1, (parseInt(prev[key] ?? '1') || 1) - 1)) }))}
                                  >−</button>
                                  <input
                                    type="number" min="1" max={l.quantity} value={qtyVal}
                                    onChange={e => setBuyQty(prev => ({ ...prev, [key]: e.target.value }))}
                                    style={{ width:40, padding:'4px 4px', border:'1.5px solid rgba(212,100,138,0.3)', borderRadius:6, fontSize:12, color:'#1e0a16', textAlign:'center', outline:'none' }}
                                  />
                                  <button
                                    style={{ width:22, height:22, background:'rgba(196,48,112,0.1)', border:'1px solid rgba(196,48,112,0.25)', borderRadius:5, color:'#c43070', fontSize:14, fontWeight:700, cursor:'pointer', lineHeight:1, padding:0 }}
                                    onClick={() => setBuyQty(prev => ({ ...prev, [key]: String(Math.min(l.quantity, (parseInt(prev[key] ?? '1') || 1) + 1)) }))}
                                  >+</button>
                                </div>
                                <div style={{ display:'flex', gap:3 }}>
                                  <button
                                    style={{ background:'rgba(196,48,112,0.08)', color:'#c43070', border:'1px solid rgba(196,48,112,0.2)', borderRadius:6, padding:'3px 6px', fontSize:9, fontWeight:700, cursor:'pointer' }}
                                    onClick={() => setBuyQty(prev => ({ ...prev, [key]: String(l.quantity) }))}
                                  >MAX</button>
                                  {(() => {
                                    const qty = Math.max(1, Math.min(l.quantity, parseInt(qtyVal) || 1));
                                    const totalCost = qty * l.pricePerUnit;
                                    const insuffisant = totalCost > onChainKirha;
                                    return insuffisant ? (
                                      <button
                                        style={{ background:'rgba(196,48,112,0.08)', color:'#c43070', border:'1px solid rgba(196,48,112,0.3)', borderRadius:7, padding:'4px 8px', fontSize:9, fontWeight:700, cursor:'default' }}
                                        disabled
                                        title={`Solde on-chain insuffisant (${onChainKirha.toFixed(4)} $K). Sauvegarde tes gains PNJ d'abord.`}
                                      >💾 Sauv. d'abord</button>
                                    ) : (
                                      <button
                                        style={{ background: busy ? 'rgba(106,191,68,0.3)' : 'linear-gradient(135deg, #6abf44, #3a8f1e)', color:'#fff', border:'none', borderRadius:7, padding:'4px 10px', fontSize:10, fontWeight:700, cursor: busy ? 'default' : 'pointer' }}
                                        disabled={busy}
                                        onClick={() => acheter(l.listingId, qty, l.resourceId, l.pricePerUnit)}
                                      >
                                        {status === 'buying' ? '⏳' : '✓ Acheter'}
                                      </button>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {status === 'success' && <p style={{ color:'#6abf44', fontSize:12, fontWeight:700, textAlign:'center', marginTop:8 }}>✅ Achat confirmé !</p>}
            {error && <p style={{ color:'#c43070', fontSize:10, marginTop:4 }}>{error.slice(0,120)}</p>}
          </>
        )}

        {/* ── Vendre ── */}
        {tab === 'vendre' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {pendingCount > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'rgba(249,168,37,0.1)', border:'1px solid rgba(249,168,37,0.4)', borderRadius:12 }}>
                <span style={{ fontSize:18 }}>⚠️</span>
                <div style={{ flex:1 }}>
                  <p style={{ color:'#1e0a16', fontSize:12, fontWeight:700, margin:'0 0 2px' }}>Ressources non sauvegardées</p>
                  <p style={{ color:'#7a4060', fontSize:10, margin:0 }}>Sauvegarde d'abord tes ressources avant de les vendre sur le marché.</p>
                </div>
                <button
                  style={{ padding:'7px 12px', background:'#f9a825', color:'#1e0a16', border:'none', borderRadius:10, fontSize:11, fontWeight:700, cursor: saveStatus !== 'idle' ? 'default' : 'pointer', opacity: saveStatus !== 'idle' ? 0.6 : 1, flexShrink:0 }}
                  onClick={sauvegarder}
                  disabled={saveStatus !== 'idle'}
                >
                  {saveStatus === 'signing' || saveStatus === 'pending' ? '⏳…' : '💾 Sauvegarder'}
                </button>
              </div>
            )}
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', background: isVip ? 'rgba(249,168,37,0.1)' : 'rgba(196,48,112,0.07)', border: isVip ? '1px solid rgba(249,168,37,0.3)' : '1px solid rgba(196,48,112,0.2)', borderRadius:20, alignSelf:'flex-start' }}>
              <span style={{ fontSize:13 }}>{isVip ? '👑' : 'ℹ️'}</span>
              <span style={{ color: isVip ? '#f9a825' : '#9a6080', fontSize:11, fontWeight:700 }}>{taxLabel}</span>
            </div>

            <div style={{ background:'#fff', border:'1px solid rgba(212,100,138,0.15)', borderRadius:14, padding:14 }}>
              <p style={{ color:'#1e0a16', fontSize:12, fontWeight:700, margin:'0 0 12px' }}>Ajouter au panier de vente</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div>
                  <label style={s.label}>Ressource</label>
                  {inventaireItems.filter(item => !cart.some(c => c.resourceId === item.id)).length === 0 ? (
                    <p style={{ color:'#9a6080', fontSize:12, margin:'4px 0' }}>Aucune ressource disponible en inventaire.</p>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:6 }}>
                      {inventaireItems.filter(item => !cart.some(c => c.resourceId === item.id)).map(item => {
                        const isSelected = sellResourceId === String(item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => setSellResourceId(isSelected ? '' : String(item.id))}
                            style={{ background: isSelected ? 'linear-gradient(135deg, rgba(196,48,112,0.1), rgba(138,37,212,0.07))' : '#fff', border: isSelected ? '2px solid #c43070' : '1px solid rgba(212,100,138,0.2)', borderRadius:14, padding:'10px', cursor:'pointer', textAlign:'left', boxShadow: isSelected ? '0 2px 12px rgba(196,48,112,0.12)' : 'none' }}
                          >
                            <span style={{ fontSize:26, display:'block', marginBottom:4 }}>{emojiByResourceId(item.id)}</span>
                            <span style={{ color:'#1e0a16', fontSize:11, fontWeight:700, display:'block', marginBottom:4, lineHeight:1.2 }}>{getNomRessource(item.id, lang)}</span>
                            <span style={{ background:'rgba(196,48,112,0.1)', color:'#c43070', fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:8 }}>
                              ×{item.qty} dispo
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {sellResourceId && (
                  <>
                    <div style={{ display:'flex', gap:8 }}>
                      <div style={{ flex:1 }}>
                        <label style={s.label}>Quantité (max {maxQty})</label>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <button
                            style={{ width:28, height:28, background:'rgba(196,48,112,0.1)', border:'1px solid rgba(196,48,112,0.25)', borderRadius:7, color:'#c43070', fontSize:16, fontWeight:700, cursor:'pointer', lineHeight:1, padding:0, flexShrink:0 }}
                            onClick={() => setSellQty(String(Math.max(1, (parseInt(sellQty) || 1) - 1)))}
                          >−</button>
                          <input type="number" min="1" max={maxQty} value={sellQty} onChange={e => setSellQty(e.target.value)} placeholder="1" style={{ ...s.input, flex:1, textAlign:'center' }} />
                          <button
                            style={{ width:28, height:28, background:'rgba(196,48,112,0.1)', border:'1px solid rgba(196,48,112,0.25)', borderRadius:7, color:'#c43070', fontSize:16, fontWeight:700, cursor:'pointer', lineHeight:1, padding:0, flexShrink:0 }}
                            onClick={() => setSellQty(String(Math.min(maxQty, (parseInt(sellQty) || 1) + 1)))}
                          >+</button>
                          <button
                            style={{ padding:'0 10px', height:28, background:'rgba(196,48,112,0.1)', border:'1px solid rgba(196,48,112,0.25)', borderRadius:7, color:'#c43070', fontSize:10, fontWeight:700, cursor:'pointer', flexShrink:0 }}
                            onClick={() => setSellQty(String(maxQty))}
                          >MAX</button>
                        </div>
                      </div>
                      <div style={{ flex:1 }}>
                        <label style={s.label}>
                          Prix/unité ($K)
                          {marketPrice !== null && <span style={{ color:'#6abf44', fontWeight:400 }}> ↳ {marketPrice.toFixed(4)}</span>}
                        </label>
                        <input type="number" min="0.0001" step="0.0001" value={sellPrice} onChange={e => setSellPrice(e.target.value)} style={s.input} />
                      </div>
                    </div>
                    {qtyNum > 0 && priceNum > 0 && (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'rgba(106,191,68,0.07)', border:'1px solid rgba(106,191,68,0.15)', borderRadius:10 }}>
                        <span style={{ color:'#7a4060', fontSize:11 }}>{qtyNum} × {priceNum.toFixed(4)} $K</span>
                        <span style={{ color:'#6abf44', fontSize:13, fontWeight:800 }}>→ {totalNet.toFixed(4)} $K</span>
                      </div>
                    )}
                    <button
                      style={{ padding:'10px', background: (qtyNum < 1 || priceNum <= 0) ? 'rgba(196,48,112,0.06)' : 'rgba(196,48,112,0.1)', border:'1.5px solid rgba(196,48,112,0.3)', borderRadius:10, color:'#c43070', fontSize:12, fontWeight:700, cursor:'pointer', opacity: (qtyNum < 1 || priceNum <= 0) ? 0.4 : 1 }}
                      disabled={qtyNum < 1 || priceNum <= 0}
                      onClick={() => { setCart(prev => [...prev, { resourceId: parseInt(sellResourceId), quantity: qtyNum, pricePerUnit: priceNum }]); setSellResourceId(''); }}
                    >
                      + Ajouter au panier
                    </button>
                  </>
                )}
              </div>
            </div>

            {cart.length > 0 && (
              <div>
                <p style={{ color:'#1e0a16', fontSize:12, fontWeight:700, margin:'0 0 8px' }}>💰 Panier de vente ({cart.length})</p>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
                  {cart.map((item, i) => {
                    const brut = item.quantity * item.pricePerUnit;
                    return (
                      <div key={i} style={{ background:'#fff', border:'1px solid rgba(212,100,138,0.15)', borderRadius:12, padding:'8px 10px', display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:38, height:38, borderRadius:10, background:'rgba(212,100,138,0.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span style={{ fontSize:20 }}>{emojiByResourceId(item.resourceId)}</span>
                        </div>
                        <div style={{ flex:1 }}>
                          <span style={{ color:'#1e0a16', fontSize:12, fontWeight:700 }}>{getNomRessource(item.resourceId, lang)}</span>
                          <span style={{ color:'#7a4060', fontSize:10, display:'block' }}>×{item.quantity} · {item.pricePerUnit.toFixed(4)} $K/u</span>
                        </div>
                        <div style={{ textAlign:'right', marginRight:6 }}>
                          <span style={{ color:'#6abf44', fontSize:11, fontWeight:700, display:'block' }}>{(brut * (1 - taxRate)).toFixed(4)} $K</span>
                          <span style={{ color:'#b08080', fontSize:9 }}>après taxe</span>
                        </div>
                        <button style={{ color:'#c43070', background:'none', border:'none', cursor:'pointer', fontSize:14 }} onClick={() => setCart(prev => prev.filter((_, j) => j !== i))}>✕</button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ background:'rgba(106,191,68,0.06)', border:'1px solid rgba(106,191,68,0.2)', borderRadius:12, padding:'12px 14px', marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ color:'#7a4060', fontSize:12 }}>Total brut</span>
                    <span style={{ color:'#1e0a16', fontSize:12, fontWeight:700 }}>{cart.reduce((acc, i) => acc + i.quantity * i.pricePerUnit, 0).toFixed(4)} $K</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid rgba(106,191,68,0.2)', paddingTop:6 }}>
                    <span style={{ color:'#1e0a16', fontSize:13, fontWeight:700 }}>Vous recevez</span>
                    <span style={{ color:'#6abf44', fontSize:14, fontWeight:800 }}>{(cart.reduce((acc, i) => acc + i.quantity * i.pricePerUnit, 0) * (1 - taxRate)).toFixed(4)} $K</span>
                  </div>
                </div>
                <button
                  style={{ width:'100%', padding:12, background: busy ? 'rgba(196,48,112,0.3)' : 'linear-gradient(135deg, #c43070, #8a25d4)', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor: busy ? 'default' : 'pointer' }}
                  disabled={busy}
                  onClick={() => batchMettrEnVente(cart).then(() => { setCart([]); setTab('mesVentes'); })}
                >
                  {status === 'listing' ? '⏳ Confirmation en cours…' : `💰 Publier ${cart.length} vente${cart.length > 1 ? 's' : ''}`}
                </button>
              </div>
            )}

            {cart.length === 0 && inventaireItems.length === 0 && (
              <div style={s.empty}>
                <span style={{ fontSize:40 }}>📦</span>
                <p style={{ color:'#7a4060', fontSize:13, marginTop:10 }}>Aucune ressource en stock.</p>
              </div>
            )}
            {status === 'success' && <p style={{ color:'#6abf44', fontSize:12, fontWeight:700, textAlign:'center', margin:0 }}>✅ Ventes publiées !</p>}
            {error && <p style={{ color:'#c43070', fontSize:10, margin:0 }}>{error.slice(0,120)}</p>}
          </div>
        )}

        {/* ── Mes ventes ── */}
        {tab === 'mesVentes' && (
          <>
            {myListings.length === 0 ? (
              <div style={s.empty}>
                <span style={{ fontSize:40 }}>📋</span>
                <p style={{ color:'#7a4060', fontSize:13, marginTop:10 }}>Aucune vente en cours.</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {myListings.map(l => {
                  const res = getResourceById(l.resourceId as ResourceId);
                  return (
                    <div key={l.listingId.toString()} style={{ background:'#fff', border:'1px solid rgba(212,100,138,0.15)', borderRadius:14, padding:'12px', display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:44, height:44, borderRadius:12, background:'rgba(212,100,138,0.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ fontSize:22 }}>{emojiByResourceId(l.resourceId)}</span>
                      </div>
                      <div style={{ flex:1 }}>
                        <span style={{ color:'#1e0a16', fontSize:12, fontWeight:700 }}>
                          {res ? getNomRessource(l.resourceId, lang) : `Ressource #${l.resourceId}`}
                        </span>
                        <span style={{ color:'#7a4060', fontSize:10, display:'block' }}>×{l.quantity} · {l.pricePerUnit.toFixed(4)} $K/u</span>
                        <span style={{ color:'#6abf44', fontSize:10 }}>Vous recevrez : {(l.pricePerUnit * l.quantity * (1 - taxRate)).toFixed(4)} $K</span>
                      </div>
                      <button
                        style={{ padding:'6px 12px', background:'rgba(196,48,112,0.08)', border:'1px solid rgba(196,48,112,0.25)', borderRadius:10, color:'#c43070', fontSize:11, fontWeight:700, cursor:'pointer' }}
                        onClick={() => annulerListing(l.listingId)}
                        disabled={busy}
                      >
                        {status === 'cancelling' ? '⏳' : 'Annuler'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Historique ── */}
        {tab === 'historique' && <TabHistorique myCityId={villeIdBn} />}

      </div>
    </div>
  );
}

// ── Page principale ─────────────────────────────────────────

export function HdvPage() {
  const navigate  = useNavigate();
  const { t }     = useT();

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/home')}>{t('hdv.back_home')}</button>
        <span style={s.headerTitle}>{t('hdv.title')}</span>
        <div style={{ width:60 }} />
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>
        <TabOnchain />
      </div>
    </div>
  );
}

const ms: Record<string, React.CSSProperties> = {
  statCard: { flex:1, background:'rgba(196,48,112,0.06)', border:'1px solid rgba(196,48,112,0.15)', borderRadius:10, padding:'8px 10px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 },
};

const s: Record<string, React.CSSProperties> = {
  page:    { position:'absolute', inset:0, background:'#fdf0f5', display:'flex', flexDirection:'column' },
  header:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'rgba(253,240,245,0.96)', backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(212,100,138,0.15)', flexShrink:0 },
  backBtn: { color:'#7a4060', fontSize:'13px', fontWeight:600, background:'none', border:'none', cursor:'pointer' },
  headerTitle: { color:'#1e0a16', fontSize:'16px', fontWeight:800 },
  empty: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 0', gap:8 },
  itemRow: { display:'flex', alignItems:'center', gap:'10px', background:'#ffffff', border:'1px solid rgba(212,100,138,0.15)', borderRadius:12, padding:'10px 12px' },
  itemIcon: { width:40, height:40, borderRadius:8, border:'1.5px solid rgba(212,100,138,0.25)', background:'rgba(212,100,138,0.05)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  sellBtn: { color:'#f9a825', fontSize:'10px', fontWeight:700, background:'rgba(249,168,37,0.12)', border:'1px solid rgba(249,168,37,0.25)', borderRadius:6, padding:'5px 10px', cursor:'pointer' },
  mainBtn: { width:'100%', padding:'12px', background:'linear-gradient(135deg, #c43070, #8a25d4)', color:'#fff', border:'none', borderRadius:12, fontSize:'14px', fontWeight:700, cursor:'pointer' },
  label:   { color:'#7a4060', fontSize:'11px', fontWeight:600, display:'block', marginBottom:4 },
  select:  { width:'100%', padding:'9px 10px', border:'1.5px solid rgba(212,100,138,0.25)', borderRadius:10, fontSize:12, color:'#1e0a16', background:'#fff' },
  input:   { width:'100%', padding:'9px 10px', border:'1.5px solid rgba(212,100,138,0.25)', borderRadius:10, fontSize:12, color:'#1e0a16', boxSizing:'border-box' as const },
  summary: { background:'rgba(212,100,138,0.05)', border:'1px solid rgba(212,100,138,0.15)', borderRadius:12, padding:'12px 14px' },
};
