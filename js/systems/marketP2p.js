/**
 * HDV joueur ↔ joueur — ventes directes + offres d'achat.
 * Nécessite Supabase (voir supabase/schema.sql).
 */

import { getSupabaseClient, isSupabaseConfigured } from '../core/supabaseClient.js';
import { isRegisteredAccount, getAuthState } from '../core/auth.js';
import { emit } from '../core/events.js';
import { isMarketP2pEnabled, isMaintenanceMode } from './gameConfig.js';

const MARKET_FEE_RATE = 0.05;

function marketOnlineBlocked() {
  if (isMaintenanceMode()) return 'Maintenance — HDV joueurs indisponible.';
  if (!isMarketP2pEnabled()) return 'HDV joueurs temporairement désactivé.';
  return null;
}

export function getMarketFeeRate() {
  return MARKET_FEE_RATE;
}

export function calcMarketFee(total) {
  return Math.max(0, Math.floor(total * MARKET_FEE_RATE));
}

export async function fetchSellListings({ resourceId = null, limit = 100 } = {}) {
  if (!isSupabaseConfigured()) return { ok: false, rows: [], reason: 'Supabase non configuré.' };
  const supabase = await getSupabaseClient();
  let q = supabase
    .from('market_sell_listings')
    .select('*, profiles(display_name)')
    .gt('qty_remaining', 0)
    .gt('expires_at', new Date().toISOString())
    .order('unit_price', { ascending: true })
    .limit(limit);
  if (resourceId) q = q.eq('resource_id', resourceId);
  const { data, error } = await q;
  return error ? { ok: false, rows: [], reason: error.message } : { ok: true, rows: data || [] };
}

export async function fetchBuyOffers({ resourceId = null, limit = 100 } = {}) {
  if (!isSupabaseConfigured()) return { ok: false, rows: [], reason: 'Supabase non configuré.' };
  const supabase = await getSupabaseClient();
  let q = supabase
    .from('market_buy_offers')
    .select('*, profiles(display_name)')
    .gt('qty_remaining', 0)
    .gt('expires_at', new Date().toISOString())
    .order('max_unit_price', { ascending: false })
    .limit(limit);
  if (resourceId) q = q.eq('resource_id', resourceId);
  const { data, error } = await q;
  return error ? { ok: false, rows: [], reason: error.message } : { ok: true, rows: data || [] };
}

/** Crée une annonce de vente — le serveur valide via RPC si disponible, sinon insert direct (dev). */
export async function createSellListing({ resourceId, qty, unitPrice, sellerDisplayName }) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const blocked = marketOnlineBlocked();
  if (blocked) return { ok: false, reason: blocked };
  const auth = getAuthState();
  const supabase = await getSupabaseClient();
  const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

  const { data, error } = await supabase.rpc('market_create_sell_listing', {
    p_resource_id: resourceId,
    p_qty: qty,
    p_unit_price: unitPrice,
    p_display_name: sellerDisplayName,
  }).maybeSingle();

  if (!error && data) return { ok: true, listingId: data };

  const { data: row, error: insErr } = await supabase.from('market_sell_listings').insert({
    seller_id: auth.userId,
    seller_name: sellerDisplayName,
    resource_id: resourceId,
    qty_total: qty,
    qty_remaining: qty,
    unit_price: unitPrice,
    expires_at: expiresAt,
  }).select('id').single();

  return insErr ? { ok: false, reason: insErr.message } : { ok: true, listingId: row?.id };
}

export async function createBuyOffer({ resourceId, qty, maxUnitPrice, buyerDisplayName }) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const blocked = marketOnlineBlocked();
  if (blocked) return { ok: false, reason: blocked };
  const auth = getAuthState();
  const supabase = await getSupabaseClient();
  const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  const escrow = qty * maxUnitPrice;

  const { data, error } = await supabase.rpc('market_create_buy_offer', {
    p_resource_id: resourceId,
    p_qty: qty,
    p_max_unit_price: maxUnitPrice,
    p_display_name: buyerDisplayName,
  }).maybeSingle();

  if (!error && data) return { ok: true, offerId: data };

  const { data: row, error: insErr } = await supabase.from('market_buy_offers').insert({
    buyer_id: auth.userId,
    buyer_name: buyerDisplayName,
    resource_id: resourceId,
    qty_total: qty,
    qty_remaining: qty,
    max_unit_price: maxUnitPrice,
    kirha_escrowed: escrow,
    expires_at: expiresAt,
  }).select('id').single();

  return insErr ? { ok: false, reason: insErr.message } : { ok: true, offerId: row?.id };
}

export async function buyFromListing(listingId, qty) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('market_buy_listing', {
    p_listing_id: listingId,
    p_qty: qty,
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, result: data };
}

/** Applique localement le résultat d'un achat P2P (kirha + inventaire). */
export function applyBuyListingResult(game, result) {
  if (!result || !game?.state) return { ok: false, reason: 'Résultat invalide.' };
  const qty = Number(result.qty) || 0;
  const total = Number(result.total) || (Number(result.unit_price) || 0) * qty;
  const resourceId = result.resource_id;
  if (!resourceId || qty <= 0) return { ok: false, reason: 'Données achat invalides.' };
  if ((game.state.kirha || 0) < total) {
    return { ok: false, reason: `Il manque ${total.toLocaleString('fr-FR')} 💰.` };
  }
  game.state.kirha -= total;
  game.state.inventory[resourceId] = (game.state.inventory[resourceId] || 0) + qty;
  game.scheduleSave?.();
  emit('stateChange', game.state);
  return { ok: true, total, resourceId, qty };
}

export async function fillBuyOffer(offerId, qty) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('market_fill_buy_offer', {
    p_offer_id: offerId,
    p_qty: qty,
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, result: data };
}

/** Applique localement la vente contre une offre d'achat P2P. */
export function applyFillBuyOfferResult(game, result) {
  if (!result || !game?.state) return { ok: false, reason: 'Résultat invalide.' };
  const qty = Number(result.qty) || 0;
  const resourceId = result.resource_id;
  const payout = Number(result.payout) || (Number(result.max_unit_price) || 0) * qty;
  const have = game.state.inventory?.[resourceId] || 0;
  if (!resourceId || qty <= 0) return { ok: false, reason: 'Données vente invalides.' };
  if (have < qty) return { ok: false, reason: `Stock insuffisant (×${have}).` };
  game.state.inventory[resourceId] = have - qty;
  if (game.state.inventory[resourceId] <= 0) delete game.state.inventory[resourceId];
  const fee = calcMarketFee(payout);
  game.state.kirha = (game.state.kirha || 0) + payout - fee;
  game.scheduleSave?.();
  emit('stateChange', game.state);
  return { ok: true, payout, fee, resourceId, qty };
}

export async function cancelSellListing(listingId) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('market_sell_listings')
    .delete()
    .eq('id', listingId)
    .eq('seller_id', getAuthState().userId);
  return error ? { ok: false, reason: error.message } : { ok: true };
}

export async function cancelBuyOffer(offerId) {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('market_buy_offers')
    .delete()
    .eq('id', offerId)
    .eq('buyer_id', getAuthState().userId);
  return error ? { ok: false, reason: error.message } : { ok: true };
}

export async function fetchMyListings() {
  if (!isRegisteredAccount()) return { sells: [], buys: [] };
  const auth = getAuthState();
  const supabase = await getSupabaseClient();
  if (!supabase) return { sells: [], buys: [] };
  const [sells, buys] = await Promise.all([
    supabase.from('market_sell_listings').select('*').eq('seller_id', auth.userId),
    supabase.from('market_buy_offers').select('*').eq('buyer_id', auth.userId),
  ]);
  return { sells: sells.data || [], buys: buys.data || [] };
}
