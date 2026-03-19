import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { getResourceById } from '../data/metiers';
import { ResourceId } from '../data/resources';
import { useT } from '../utils/i18n';
import { useMarket } from '../hooks/useMarket';
import { emojiByResourceId, getNomRessource } from '../utils/resourceUtils';

// ── Onglet PNJ (off-chain) ──────────────────────────────────

const PNJ_PRICES: Partial<Record<ResourceId, number>> = {};

function TabPnj() {
  const inventaire  = useGameStore(s => s.inventaire);
  const vendreAuPnj = useGameStore(s => s.vendreAuPnj);
  const soldeKirha  = useGameStore(s => s.soldeKirha);
  const [venduIds, setVenduIds] = useState<ResourceId[]>([]);
  const { t, lang } = useT();

  const items = (Object.entries(inventaire) as [string, number][])
    .filter(([, qty]) => Math.floor(qty) >= 1)
    .map(([id, qty]) => {
      const rid = Number(id) as ResourceId;
      const res = getResourceById(rid);
      if (!res) return null;
      const price = PNJ_PRICES[rid] ?? 0.01;
      return { id: rid, qty, res, price };
    })
    .filter(Boolean) as { id: ResourceId; qty: number; res: NonNullable<ReturnType<typeof getResourceById>>; price: number }[];

  const navigate = useNavigate();

  return (
    <div style={{ padding:'16px', paddingBottom:90 }}>
      <div style={s.pnjCard}>
        <span style={{ fontSize:'32px' }}>🧙</span>
        <div>
          <p style={{ color:'#1e0a16', fontSize:'14px', fontWeight:700, margin:0 }}>{t('hdv.pnj_name')}</p>
          <p style={{ color:'#7a4060', fontSize:'11px', margin:'3px 0 0' }}>{t('hdv.pnj_subtitle')}</p>
        </div>
        <span style={{ color:'#f9a825', fontSize:'11px', fontWeight:700, marginLeft:'auto' }}>{t('hdv.open')}</span>
      </div>
      <p style={{ color:'#7a4060', fontSize:'10px', marginBottom:6 }}>
        Solde : {soldeKirha.toFixed(2)} $KIRHA
      </p>

      {items.length === 0 ? (
        <div style={s.empty}>
          <span style={{ fontSize:'40px' }}>📦</span>
          <p style={{ color:'#7a4060', fontSize:'14px', marginTop:12 }}>{t('hdv.empty')}</p>
          <button style={s.goBtn} onClick={() => navigate('/recolte')}>{t('hdv.go_harvest')}</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {items.map(({ id, qty, res, price }) => {
            const vendu = venduIds.includes(id);
            return (
              <div key={id} style={s.itemRow}>
                <div style={s.itemIcon}>
                  <span style={{ fontSize:'20px' }}>{emojiByResourceId(id)}</span>
                </div>
                <div style={{ flex:1 }}>
                  <span style={{ color:'#1e0a16', fontSize:'13px', fontWeight:700 }}>
                    {getNomRessource(id, lang)}
                  </span>
                  <span style={{ color:'#7a4060', fontSize:'10px', display:'block' }}>
                    ×{Math.floor(qty)} {t('hdv.in_stock')} · {price} {t('hdv.per_unit')}
                  </span>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:'#f9a825', fontSize:'13px', fontWeight:800, margin:0 }}>
                    {(price * Math.floor(qty)).toFixed(0)} $K
                  </p>
                  {vendu ? (
                    <span style={{ color:'#6abf44', fontSize:'10px', fontWeight:700 }}>{t('hdv.sold')}</span>
                  ) : (
                    <button style={s.sellBtn} onClick={() => { vendreAuPnj(id, Math.floor(qty), price); setVenduIds(v => [...v, id]); }}>
                      {t('hdv.sell_all')}
                    </button>
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
  const { t, lang } = useT();
  const villeIdBn   = villeId && villeId !== '0' ? BigInt(villeId) : undefined;
  const isVip = vipExpiry > 0 && vipExpiry > Math.floor(Date.now() / 1000);
  const taxRate = isVip ? 0.25 : 0.5;
  const taxLabel = isVip ? 'Taxe: 25% (VIP)' : 'Taxe: 50%';
  const {
    listings, myListings, isApproved, status, error,
    approveMarket, batchMettrEnVente, batchAcheter, annulerListing,
  } = useMarket();

  const [tab, setTab]               = useState<'acheter'|'vendre'|'mesVentes'>('acheter');
  const [sellResourceId, setSellResourceId] = useState('');
  const [sellQty, setSellQty]       = useState('');
  const [sellPrice, setSellPrice]   = useState('');
  const [buyResourceId, setBuyResourceId] = useState('');

  // Quantités d'achat par listing et panier
  const [buyQty, setBuyQty]         = useState<Record<string, string>>({});
  type BuyCartItem = { listingId: bigint; resourceId: number; quantity: number; pricePerUnit: number; maxQty: number };
  const [buyCart, setBuyCart]       = useState<BuyCartItem[]>([]);

  // Panier de vente (pending avant publication)
  type CartItem = { resourceId: number; quantity: number; pricePerUnit: number };
  const [cart, setCart] = useState<CartItem[]>([]);

  // Ressources dispo en inventaire
  const inventaireItems = (Object.entries(inventaire) as [string, number][])
    .filter(([, qty]) => Math.floor(qty) >= 1)
    .map(([id, qty]) => ({ id: Number(id) as ResourceId, qty: Math.floor(qty) }));

  // Quantité max pour la ressource sélectionnée
  const selectedItem = inventaireItems.find(i => i.id === parseInt(sellResourceId));
  const maxQty = selectedItem?.qty ?? 0;

  // Reset qty + prix quand la ressource change
  useEffect(() => {
    setSellQty('');
    setSellPrice('');
  }, [sellResourceId]);

  // Auto-remplir le prix uniquement quand le prix est vide (première sélection ou changement de ressource)
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

  const priceNum = parseFloat(sellPrice || '0');
  const qtyNum   = parseInt(sellQty || '0');
  const totalBrut = priceNum * qtyNum;
  const totalNet  = totalBrut * (1 - taxRate);

  // Prix du marché auto-rempli ?
  const marketPrice = (() => {
    if (!sellResourceId) return null;
    const rid = parseInt(sellResourceId);
    const rl = listings.filter(l => l.resourceId === rid);
    if (rl.length === 0) return null;
    return Math.min(...rl.map(l => l.pricePerUnit));
  })();

  // Ressources uniques présentes dans les listings
  const buyResourceIds = [...new Set(listings.map(l => l.resourceId))].sort((a, b) => a - b);

  // Listings pour la ressource sélectionnée, triés par prix croissant
  const listingsSorted = [...listings]
    .filter(l => buyResourceId !== '' && l.resourceId === parseInt(buyResourceId))
    .sort((a, b) => a.pricePerUnit - b.pricePerUnit);

  return (
    <div style={{ paddingBottom:90 }}>
      {/* Sous-onglets */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(212,100,138,0.15)' }}>
        {(['acheter','vendre','mesVentes'] as const).map(tid => (
          <button key={tid} style={{ flex:1, padding:'10px 4px', background:'none', border:'none', borderBottom: tab===tid ? '2px solid #c43070':'2px solid transparent', color: tab===tid ? '#c43070':'#7a4060', fontSize:'11px', fontWeight:700, cursor:'pointer' }} onClick={() => setTab(tid)}>
            {tid === 'acheter' ? '🛒 Acheter' : tid === 'vendre' ? '💰 Vendre' : '📋 Mes ventes'}
          </button>
        ))}
      </div>

      <div style={{ padding:'14px' }}>

        {/* ── Acheter ── */}
        {tab === 'acheter' && (
          <>
            {/* Sélecteur de ressource (obligatoire) */}
            <div style={{ marginBottom:12 }}>
              <label style={s.label}>Quelle ressource cherches-tu ?</label>
              <select
                value={buyResourceId}
                onChange={e => { setBuyResourceId(e.target.value); setBuyQty({}); }}
                style={s.select}
              >
                <option value="">-- Choisir une ressource --</option>
                {buyResourceIds.map(rid => (
                  <option key={rid} value={rid}>
                    {emojiByResourceId(rid)} {getNomRessource(rid, lang)} ({listings.filter(l => l.resourceId === rid).length} offre{listings.filter(l => l.resourceId === rid).length > 1 ? 's' : ''})
                  </option>
                ))}
              </select>
              {listings.length === 0 && (
                <p style={{ color:'#9a6080', fontSize:'11px', margin:'6px 0 0' }}>Aucune offre sur le marché pour l'instant.</p>
              )}
            </div>

            {/* Listings pour la ressource sélectionnée */}
            {buyResourceId !== '' && (
              listingsSorted.length === 0 ? (
                <div style={s.empty}>
                  <span style={{ fontSize:'36px' }}>🏪</span>
                  <p style={{ color:'#7a4060', fontSize:'13px', marginTop:10 }}>Aucune offre pour cette ressource.</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <p style={{ color:'#7a4060', fontSize:'11px', margin:'0 0 4px' }}>
                    {listingsSorted.length} offre{listingsSorted.length > 1 ? 's' : ''} — triées du moins cher au plus cher
                  </p>
                  {listingsSorted.map((l, idx) => {
                    const key = l.listingId.toString();
                    const isMine = villeIdBn !== undefined && l.sellerCityId === villeIdBn;
                    const isCheapest = idx === 0;
                    const inCart = buyCart.some(c => c.listingId === l.listingId);
                    const qtyVal = buyQty[key] ?? '1';

                    return (
                      <div key={key} style={{ ...s.itemRow, opacity: isMine ? 0.7 : 1, border: isCheapest ? '1.5px solid rgba(106,191,68,0.5)' : '1px solid rgba(212,100,138,0.15)' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                            <span style={{ color:'#c43070', fontSize:'15px', fontWeight:800 }}>{l.pricePerUnit.toFixed(4)} $K</span>
                            <span style={{ color:'#7a4060', fontSize:'10px' }}>/unité</span>
                            {isCheapest && !isMine && <span style={{ background:'rgba(106,191,68,0.15)', color:'#4a8f2a', fontSize:'9px', fontWeight:700, padding:'1px 6px', borderRadius:8 }}>Moins cher</span>}
                          </div>
                          <span style={{ color:'#7a4060', fontSize:'10px', display:'block' }}>
                            ×{l.quantity} disponible · {isMine ? <span style={{ color:'#6abf44', fontWeight:700 }}>Votre vente</span> : l.sellerPseudo}
                          </span>
                        </div>
                        {isMine ? (
                          <span style={{ color:'#9a6080', fontSize:'10px', fontStyle:'italic' }}>En vente</span>
                        ) : inCart ? (
                          <span style={{ color:'#6abf44', fontSize:'10px', fontWeight:700 }}>✓ Dans le panier</span>
                        ) : (
                          <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                            <input
                              type="number" min="1" max={l.quantity} value={qtyVal}
                              onChange={e => setBuyQty(prev => ({ ...prev, [key]: e.target.value }))}
                              style={{ width:44, padding:'4px 6px', border:'1px solid rgba(212,100,138,0.25)', borderRadius:8, fontSize:11, color:'#1e0a16', textAlign:'center' }}
                            />
                            <button
                              style={{ ...s.sellBtn, background:'rgba(106,191,68,0.12)', borderColor:'rgba(106,191,68,0.3)', color:'#4a8f2a', whiteSpace:'nowrap' }}
                              onClick={() => {
                                const qty = Math.max(1, Math.min(l.quantity, parseInt(qtyVal) || 1));
                                setBuyCart(prev => [...prev, { listingId: l.listingId, resourceId: l.resourceId, quantity: qty, pricePerUnit: l.pricePerUnit, maxQty: l.quantity }]);
                              }}
                            >
                              + Panier
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* ── Panier d'achat ── */}
            {buyCart.length > 0 && (
              <div style={{ marginTop:16 }}>
                <p style={{ color:'#1e0a16', fontSize:'12px', fontWeight:700, margin:'0 0 8px' }}>Panier ({buyCart.length})</p>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
                  {buyCart.map((item, i) => (
                    <div key={i} style={{ ...s.itemRow, padding:'8px 10px' }}>
                      <span style={{ fontSize:'18px' }}>{emojiByResourceId(item.resourceId)}</span>
                      <div style={{ flex:1 }}>
                        <span style={{ color:'#1e0a16', fontSize:'12px', fontWeight:700 }}>{getNomRessource(item.resourceId, lang)}</span>
                        <span style={{ color:'#7a4060', fontSize:'10px', display:'block' }}>×{item.quantity} · {item.pricePerUnit.toFixed(4)} $K/u</span>
                      </div>
                      <span style={{ color:'#f9a825', fontSize:'12px', fontWeight:800, marginRight:8 }}>
                        {(item.quantity * item.pricePerUnit).toFixed(4)} $K
                      </span>
                      <button
                        style={{ color:'#c43070', background:'none', border:'none', cursor:'pointer', fontSize:'14px' }}
                        onClick={() => setBuyCart(prev => prev.filter((_, j) => j !== i))}
                      >✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ ...s.summary, marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ color:'#1e0a16', fontSize:'13px', fontWeight:700 }}>Total</span>
                    <span style={{ color:'#f9a825', fontSize:'14px', fontWeight:800 }}>
                      {buyCart.reduce((a, i) => a + i.quantity * i.pricePerUnit, 0).toFixed(4)} $K
                    </span>
                  </div>
                </div>
                <button
                  style={{ ...s.mainBtn, background:'linear-gradient(135deg, #6abf44, #3a8f1e)', opacity: busy ? 0.5 : 1 }}
                  disabled={busy}
                  onClick={() => batchAcheter(buyCart).then(() => { setBuyCart([]); setBuyResourceId(''); })}
                >
                  {status === 'buying' ? '⏳ Achat en cours…' : `🛒 Acheter le panier (${buyCart.length} article${buyCart.length > 1 ? 's' : ''}, 1 signature)`}
                </button>
                {status === 'success' && <p style={{ color:'#6abf44', fontSize:'12px', fontWeight:700, textAlign:'center', marginTop:8 }}>✅ Achat confirmé ! Ressources ajoutées à ton inventaire.</p>}
                {error && <p style={{ color:'#c43070', fontSize:'10px', marginTop:4 }}>{error.slice(0,120)}</p>}
              </div>
            )}
          </>
        )}

        {/* ── Vendre ── */}
        {tab === 'vendre' && (
          <>
            {!isApproved && (
              <div style={{ background:'rgba(249,168,37,0.08)', border:'1px solid rgba(249,168,37,0.3)', borderRadius:12, padding:'12px 14px', marginBottom:12, display:'flex', gap:10, alignItems:'center' }}>
                <span>⚠️</span>
                <div style={{ flex:1 }}>
                  <p style={{ color:'#1e0a16', fontSize:'12px', fontWeight:700, margin:'0 0 4px' }}>Autorisation requise</p>
                  <p style={{ color:'#7a4060', fontSize:'11px', margin:0 }}>Le contrat HDV doit être autorisé à transférer vos ressources.</p>
                </div>
                <button style={{ ...s.sellBtn, padding:'7px 12px', fontSize:'11px' }} onClick={approveMarket} disabled={busy}>
                  Autoriser
                </button>
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

              {/* ── Info taxe ── */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background: isVip ? 'rgba(249,168,37,0.08)' : 'rgba(212,100,138,0.05)', border:'1px solid rgba(212,100,138,0.15)', borderRadius:10 }}>
                <span style={{ fontSize:'13px' }}>{isVip ? '👑' : 'ℹ️'}</span>
                <span style={{ color: isVip ? '#f9a825' : '#7a4060', fontSize:'11px', fontWeight:700 }}>{taxLabel}</span>
              </div>

              {/* ── Formulaire d'ajout au panier ── */}
              <div style={{ background:'rgba(212,100,138,0.04)', border:'1px solid rgba(212,100,138,0.13)', borderRadius:12, padding:'12px' }}>
                <p style={{ color:'#1e0a16', fontSize:'12px', fontWeight:700, margin:'0 0 10px' }}>Ajouter au panier</p>

                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div>
                    <label style={s.label}>Ressource</label>
                    <select value={sellResourceId} onChange={e => setSellResourceId(e.target.value)} style={s.select}>
                      <option value="">-- Choisir --</option>
                      {inventaireItems
                        .filter(item => !cart.some(c => c.resourceId === item.id))
                        .map(item => (
                          <option key={item.id} value={item.id}>
                            {emojiByResourceId(item.id)} {getNomRessource(item.id, lang)} (×{item.qty})
                          </option>
                        ))}
                    </select>
                  </div>

                  {sellResourceId && (
                    <>
                      <div style={{ display:'flex', gap:8 }}>
                        <div style={{ flex:1 }}>
                          <label style={s.label}>Quantité (max {maxQty})</label>
                          <input type="number" min="1" max={maxQty} value={sellQty} onChange={e => setSellQty(e.target.value)} placeholder="1" style={s.input} />
                        </div>
                        <div style={{ flex:1 }}>
                          <label style={s.label}>
                            Prix/unité ($K)
                            {marketPrice !== null && <span style={{ color:'#6abf44', fontWeight:400 }}> ↳ marché: {marketPrice.toFixed(4)}</span>}
                          </label>
                          <input type="number" min="0.0001" step="0.0001" value={sellPrice} onChange={e => setSellPrice(e.target.value)} style={s.input} />
                        </div>
                      </div>

                      {qtyNum > 0 && priceNum > 0 && (
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', background:'rgba(106,191,68,0.07)', borderRadius:8 }}>
                          <span style={{ color:'#7a4060', fontSize:'11px' }}>{qtyNum} × {priceNum.toFixed(4)} $K → vous recevez</span>
                          <span style={{ color:'#6abf44', fontSize:'12px', fontWeight:800 }}>{totalNet.toFixed(4)} $K</span>
                        </div>
                      )}

                      <button
                        style={{ ...s.sellBtn, padding:'9px', textAlign:'center', opacity: (qtyNum < 1 || priceNum <= 0) ? 0.5 : 1 }}
                        disabled={qtyNum < 1 || priceNum <= 0}
                        onClick={() => {
                          setCart(prev => [...prev, { resourceId: parseInt(sellResourceId), quantity: qtyNum, pricePerUnit: priceNum }]);
                          setSellResourceId('');
                        }}
                      >
                        + Ajouter au panier
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ── Panier ── */}
              {cart.length > 0 && (
                <div>
                  <p style={{ color:'#1e0a16', fontSize:'12px', fontWeight:700, margin:'0 0 8px' }}>Panier ({cart.length})</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
                    {cart.map((item, i) => {
                      const brut = item.quantity * item.pricePerUnit;
                      return (
                        <div key={i} style={{ ...s.itemRow, padding:'8px 10px' }}>
                          <div style={s.itemIcon}>
                            <span style={{ fontSize:'18px' }}>{emojiByResourceId(item.resourceId)}</span>
                          </div>
                          <div style={{ flex:1 }}>
                            <span style={{ color:'#1e0a16', fontSize:'12px', fontWeight:700 }}>{getNomRessource(item.resourceId, lang)}</span>
                            <span style={{ color:'#7a4060', fontSize:'10px', display:'block' }}>×{item.quantity} · {item.pricePerUnit.toFixed(4)} $K/u</span>
                          </div>
                          <div style={{ textAlign:'right', marginRight:8 }}>
                            <span style={{ color:'#6abf44', fontSize:'11px', fontWeight:700, display:'block' }}>{(brut * (1 - taxRate)).toFixed(4)} $K</span>
                            <span style={{ color:'#9a6080', fontSize:'9px' }}>après taxe</span>
                          </div>
                          <button
                            style={{ color:'#c43070', background:'none', border:'none', cursor:'pointer', fontSize:'14px', padding:'0 4px' }}
                            onClick={() => setCart(prev => prev.filter((_, j) => j !== i))}
                          >✕</button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total panier */}
                  <div style={{ ...s.summary, marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ color:'#7a4060', fontSize:'12px' }}>Total brut</span>
                      <span style={{ color:'#1e0a16', fontSize:'12px', fontWeight:700 }}>
                        {cart.reduce((acc, i) => acc + i.quantity * i.pricePerUnit, 0).toFixed(4)} $K
                      </span>
                    </div>
                    <div style={{ borderTop:'1px solid rgba(212,100,138,0.2)', marginTop:6, paddingTop:6, display:'flex', justifyContent:'space-between' }}>
                      <span style={{ color:'#1e0a16', fontSize:'13px', fontWeight:700 }}>Vous recevez</span>
                      <span style={{ color:'#6abf44', fontSize:'14px', fontWeight:800 }}>
                        {(cart.reduce((acc, i) => acc + i.quantity * i.pricePerUnit, 0) * (1 - taxRate)).toFixed(4)} $K
                      </span>
                    </div>
                  </div>

                  <button
                    style={{ ...s.mainBtn, opacity: busy ? 0.5 : 1 }}
                    disabled={busy}
                    onClick={() => {
                      batchMettrEnVente(cart).then(() => { setCart([]); setTab('mesVentes'); });
                    }}
                  >
                    {status === 'listing' ? '⏳ Confirmation en cours…' : `💰 Publier ${cart.length} vente${cart.length > 1 ? 's' : ''} (1 signature)`}
                  </button>
                </div>
              )}

              {cart.length === 0 && inventaireItems.length === 0 && (
                <div style={s.empty}>
                  <span style={{ fontSize:'36px' }}>📦</span>
                  <p style={{ color:'#7a4060', fontSize:'13px', marginTop:10 }}>Aucune ressource en stock.</p>
                </div>
              )}

              {status === 'success' && (
                <p style={{ color:'#6abf44', fontSize:'12px', fontWeight:700, textAlign:'center', margin:0 }}>✅ Ventes publiées !</p>
              )}
              {error && <p style={{ color:'#c43070', fontSize:'10px', margin:0 }}>{error.slice(0,120)}</p>}
            </div>
          </>
        )}

        {/* ── Mes ventes ── */}
        {tab === 'mesVentes' && (
          <>
            {myListings.length === 0 ? (
              <div style={s.empty}>
                <span style={{ fontSize:'36px' }}>📋</span>
                <p style={{ color:'#7a4060', fontSize:'13px', marginTop:10 }}>Aucune vente en cours.</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {myListings.map(l => {
                  const res = getResourceById(l.resourceId as ResourceId);
                  return (
                    <div key={l.listingId.toString()} style={s.itemRow}>
                      <div style={s.itemIcon}>
                        <span style={{ fontSize:'20px' }}>{emojiByResourceId(l.resourceId)}</span>
                      </div>
                      <div style={{ flex:1 }}>
                        <span style={{ color:'#1e0a16', fontSize:'12px', fontWeight:700 }}>
                          {res ? getNomRessource(l.resourceId, lang) : `Ressource #${l.resourceId}`}
                        </span>
                        <span style={{ color:'#7a4060', fontSize:'10px', display:'block' }}>
                          ×{l.quantity} · {l.pricePerUnit.toFixed(4)} $K/unité
                        </span>
                        <span style={{ color:'#6abf44', fontSize:'10px' }}>
                          Vous recevrez : {(l.pricePerUnit * l.quantity * (1 - taxRate)).toFixed(4)} $K
                        </span>
                      </div>
                      <button
                        style={{ ...s.sellBtn, background:'rgba(196,48,112,0.08)', borderColor:'rgba(196,48,112,0.25)', color:'#c43070' }}
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
      </div>
    </div>
  );
}

// ── Page principale ─────────────────────────────────────────

export function HdvPage() {
  const navigate  = useNavigate();
  const { t }     = useT();
  const [hdvTab, setHdvTab] = useState<'pnj'|'onchain'>('onchain');

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/home')}>{t('hdv.back_home')}</button>
        <span style={s.headerTitle}>{t('hdv.title')}</span>
        <div style={{ width:60 }} />
      </div>

      {/* Onglets principaux */}
      <div style={{ display:'flex', borderBottom:'2px solid rgba(212,100,138,0.15)', flexShrink:0 }}>
        <button style={{ flex:1, padding:'11px', background:'none', border:'none', borderBottom: hdvTab==='pnj' ? '2px solid #c43070':'2px solid transparent', color: hdvTab==='pnj' ? '#c43070':'#7a4060', fontSize:'13px', fontWeight:700, cursor:'pointer', marginBottom:-2 }} onClick={() => setHdvTab('pnj')}>
          🧙 PNJ
        </button>
        <button style={{ flex:1, padding:'11px', background:'none', border:'none', borderBottom: hdvTab==='onchain' ? '2px solid #8a25d4':'2px solid transparent', color: hdvTab==='onchain' ? '#8a25d4':'#7a4060', fontSize:'13px', fontWeight:700, cursor:'pointer', marginBottom:-2 }} onClick={() => setHdvTab('onchain')}>
          🏪 Hôtel des Ventes
        </button>
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>
        {hdvTab === 'pnj' ? <TabPnj /> : <TabOnchain />}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:    { position:'absolute', inset:0, background:'#fdf0f5', display:'flex', flexDirection:'column' },
  header:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'rgba(253,240,245,0.96)', backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(212,100,138,0.15)', flexShrink:0 },
  backBtn: { color:'#7a4060', fontSize:'13px', fontWeight:600, background:'none', border:'none', cursor:'pointer' },
  headerTitle: { color:'#1e0a16', fontSize:'16px', fontWeight:800 },
  pnjCard: { display:'flex', alignItems:'center', gap:'12px', background:'#ffffff', border:'1px solid rgba(249,168,37,0.2)', borderRadius:14, padding:'14px', marginBottom:16 },
  empty: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 0', gap:8 },
  goBtn: { marginTop:12, padding:'10px 20px', background:'#6abf44', color:'#1e0a16', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', fontSize:'13px' },
  itemRow: { display:'flex', alignItems:'center', gap:'10px', background:'#ffffff', border:'1px solid rgba(212,100,138,0.15)', borderRadius:12, padding:'10px 12px' },
  itemIcon: { width:40, height:40, borderRadius:8, border:'1.5px solid rgba(212,100,138,0.25)', background:'rgba(212,100,138,0.05)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  sellBtn: { color:'#f9a825', fontSize:'10px', fontWeight:700, background:'rgba(249,168,37,0.12)', border:'1px solid rgba(249,168,37,0.25)', borderRadius:6, padding:'5px 10px', cursor:'pointer' },
  mainBtn: { width:'100%', padding:'12px', background:'linear-gradient(135deg, #c43070, #8a25d4)', color:'#fff', border:'none', borderRadius:12, fontSize:'14px', fontWeight:700, cursor:'pointer' },
  label:   { color:'#7a4060', fontSize:'11px', fontWeight:600, display:'block', marginBottom:4 },
  select:  { width:'100%', padding:'9px 10px', border:'1.5px solid rgba(212,100,138,0.25)', borderRadius:10, fontSize:12, color:'#1e0a16', background:'#fff' },
  input:   { width:'100%', padding:'9px 10px', border:'1.5px solid rgba(212,100,138,0.25)', borderRadius:10, fontSize:12, color:'#1e0a16', boxSizing:'border-box' as const },
  summary: { background:'rgba(212,100,138,0.05)', border:'1px solid rgba(212,100,138,0.15)', borderRadius:12, padding:'12px 14px' },
};
