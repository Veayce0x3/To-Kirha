/**
 * HDV joueur ↔ joueur — ventes directes + offres d'achat.
 * Économie validée côté serveur (Supabase RPC + saves.save_data).
 */

import { getSupabaseClient, isSupabaseConfigured } from '../core/supabaseClient.js';
import { isRegisteredAccount, getAuthState } from '../core/auth.js';
import { loadCloudSave } from '../core/cloudSave.js';
import { emit } from '../core/events.js';
import { isMarketP2pEnabled, isMaintenanceMode } from './gameConfig.js';

const MARKET_FEE_RATE = 0.05;
let marketChannel = null;
let marketChannelOwner = null;

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

/** Applique kirha + inventaire + équipement combat depuis le cloud (après un échange HDV). */
export async function syncMarketEconomy(game) {
  const auth = getAuthState();
  if (!auth.userId || !game?.state) return { ok: false, reason: 'Compte requis.' };
  const cloud = await loadCloudSave(auth.userId);
  if (!cloud?.data) return { ok: false, reason: 'Synchronisation impossible.' };
  applyCloudSaveSlice(game, cloud.data);
  game.scheduleSave?.();
  emit('stateChange', game.state);
  return { ok: true };
}

function applyCloudSaveSlice(game, saveData) {
  if (!saveData || !game?.state) return;
  if (saveData.kirha != null) game.state.kirha = Number(saveData.kirha) || 0;
  if (saveData.inventory && typeof saveData.inventory === 'object') {
    game.state.inventory = { ...saveData.inventory };
  }
  if (Array.isArray(saveData.ownedCombatItems)) {
    game.state.ownedCombatItems = [...saveData.ownedCombatItems];
  }
  if (Array.isArray(saveData.combatItemInstances)) {
    game.state.combatItemInstances = saveData.combatItemInstances.map((i) => ({ ...i }));
  }
  if (saveData.combatEquipment && typeof saveData.combatEquipment === 'object') {
    game.state.combatEquipment = { ...game.state.combatEquipment, ...saveData.combatEquipment };
  }
}

/** Applique le save partiel renvoyé par une RPC (kirha + clés inventaire / combat touchées). */
export function applyServerSave(game, saveData) {
  if (!saveData || !game?.state) return { ok: false, reason: 'Save invalide.' };
  if (saveData.kirha != null) game.state.kirha = Number(saveData.kirha) || 0;
  if (saveData.inventory && typeof saveData.inventory === 'object') {
    for (const [id, qty] of Object.entries(saveData.inventory)) {
      if (!qty || qty <= 0) delete game.state.inventory[id];
      else game.state.inventory[id] = qty;
    }
  }
  if (Array.isArray(saveData.ownedCombatItems)) {
    game.state.ownedCombatItems = [...saveData.ownedCombatItems];
  }
  if (Array.isArray(saveData.combatItemInstances)) {
    game.state.combatItemInstances = saveData.combatItemInstances.map((i) => ({ ...i }));
  }
  if (saveData.combatEquipment && typeof saveData.combatEquipment === 'object') {
    game.state.combatEquipment = { ...game.state.combatEquipment, ...saveData.combatEquipment };
  }
  emit('stateChange', game.state);
  return { ok: true };
}

/** Recharge les Kirha depuis le cloud (ex. vente reçue pendant que tu es sur l'HDV). */
export async function refreshKirhaFromCloud(game) {
  const auth = getAuthState();
  if (!auth.userId) return;
  const cloud = await loadCloudSave(auth.userId);
  if (cloud?.data?.kirha != null && game?.state) {
    game.state.kirha = Number(cloud.data.kirha) || 0;
    emit('stateChange', game.state);
  }
}

export async function fetchSellListings({ resourceId = null, limit = 100 } = {}) {
  if (!isSupabaseConfigured()) return { ok: false, rows: [], reason: 'Supabase non configuré.' };
  const supabase = await getSupabaseClient();
  let q = supabase
    .from('market_sell_listings')
    .select('id, seller_id, seller_name, resource_id, qty_remaining, unit_price, created_at, expires_at, listing_kind, combat_instance')
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
    .select('id, buyer_id, buyer_name, resource_id, qty_remaining, max_unit_price, kirha_escrowed, created_at, expires_at, listing_kind, combat_item_id')
    .gt('qty_remaining', 0)
    .gt('expires_at', new Date().toISOString())
    .order('max_unit_price', { ascending: false })
    .limit(limit);
  if (resourceId) q = q.eq('resource_id', resourceId);
  const { data, error } = await q;
  return error ? { ok: false, rows: [], reason: error.message } : { ok: true, rows: data || [] };
}

export async function createSellListing({ resourceId, qty, unitPrice, sellerDisplayName }) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const blocked = marketOnlineBlocked();
  if (blocked) return { ok: false, reason: blocked };
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('market_create_sell_listing', {
    p_resource_id: resourceId,
    p_qty: qty,
    p_unit_price: unitPrice,
    p_display_name: sellerDisplayName,
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, listingId: data?.listing_id, save: data?.save };
}

export async function createBuyOffer({ resourceId, qty, maxUnitPrice, buyerDisplayName }) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const blocked = marketOnlineBlocked();
  if (blocked) return { ok: false, reason: blocked };
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('market_create_buy_offer', {
    p_resource_id: resourceId,
    p_qty: qty,
    p_max_unit_price: maxUnitPrice,
    p_display_name: buyerDisplayName,
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, offerId: data?.offer_id, save: data?.save };
}

export async function buyFromListing(listingId, qty) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const blocked = marketOnlineBlocked();
  if (blocked) return { ok: false, reason: blocked };
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('market_buy_listing', {
    p_listing_id: listingId,
    p_qty: qty,
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, result: data };
}

export async function createCombatSellListing({ instanceId, unitPrice, sellerDisplayName }) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const blocked = marketOnlineBlocked();
  if (blocked) return { ok: false, reason: blocked };
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('market_create_combat_sell_listing', {
    p_instance_id: instanceId,
    p_unit_price: unitPrice,
    p_display_name: sellerDisplayName,
  });
  if (error) {
    const msg = error.message || '';
    if (msg.includes('market_create_combat_sell_listing') || msg.includes('schema cache')) {
      return { ok: false, reason: 'HDV équipement pas encore activé sur le serveur.' };
    }
    return { ok: false, reason: error.message };
  }
  return { ok: true, listingId: data?.listing_id, save: data?.save };
}

export async function createCombatBuyOffer({ itemId, qty, maxUnitPrice, buyerDisplayName }) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const blocked = marketOnlineBlocked();
  if (blocked) return { ok: false, reason: blocked };
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('market_create_combat_buy_offer', {
    p_item_id: itemId,
    p_qty: qty,
    p_max_unit_price: maxUnitPrice,
    p_display_name: buyerDisplayName,
  });
  if (error) {
    const msg = error.message || '';
    if (msg.includes('market_create_combat_buy_offer') || msg.includes('schema cache')) {
      return { ok: false, reason: 'HDV équipement pas encore activé sur le serveur.' };
    }
    return { ok: false, reason: error.message };
  }
  return { ok: true, offerId: data?.offer_id, save: data?.save };
}

export async function fillBuyOffer(offerId, qty, instanceId = null) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const blocked = marketOnlineBlocked();
  if (blocked) return { ok: false, reason: blocked };
  const supabase = await getSupabaseClient();
  const args = { p_offer_id: offerId, p_qty: qty };
  if (instanceId) args.p_instance_id = instanceId;
  const { data, error } = await supabase.rpc('market_fill_buy_offer', args);
  if (error) return { ok: false, reason: error.message };
  return { ok: true, result: data };
}

export async function cancelSellListing(listingId) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('market_cancel_sell_listing', {
    p_listing_id: listingId,
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, save: data?.save };
}

export async function cancelBuyOffer(offerId) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc('market_cancel_buy_offer', {
    p_offer_id: offerId,
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, save: data?.save };
}

export async function fetchMyListings() {
  if (!isRegisteredAccount()) return { sells: [], buys: [] };
  const auth = getAuthState();
  const supabase = await getSupabaseClient();
  if (!supabase) return { sells: [], buys: [] };
  const [sells, buys] = await Promise.all([
    supabase.from('market_sell_listings').select('*').eq('seller_id', auth.userId).gt('qty_remaining', 0),
    supabase.from('market_buy_offers').select('*').eq('buyer_id', auth.userId).gt('qty_remaining', 0),
  ]);
  return { sells: sells.data || [], buys: buys.data || [] };
}

/** Abonnement temps réel — rafraîchit la liste quand le marché change. */
export async function subscribeMarketChanges(game, onChange) {
  if (!isSupabaseConfigured() || typeof onChange !== 'function') return () => {};
  const auth = getAuthState();
  const supabase = await getSupabaseClient();
  if (!supabase) return () => {};

  if (marketChannel) {
    marketChannel.unsubscribe();
    marketChannel = null;
  }

  marketChannelOwner = auth.userId;
  marketChannel = supabase
    .channel(`market-p2p-${auth.userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'market_sell_listings' }, (payload) => {
      const myId = marketChannelOwner;
      if (game && payload.eventType === 'UPDATE' && payload.new?.seller_id === myId
        && payload.old?.qty_remaining > payload.new?.qty_remaining) {
        refreshKirhaFromCloud(game).catch(() => {});
      }
      onChange();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'market_buy_offers' }, () => onChange())
    .subscribe();

  return () => {
    marketChannel?.unsubscribe();
    marketChannel = null;
    marketChannelOwner = null;
  };
}

export function unsubscribeMarketChanges() {
  marketChannel?.unsubscribe();
  marketChannel = null;
  marketChannelOwner = null;
}
