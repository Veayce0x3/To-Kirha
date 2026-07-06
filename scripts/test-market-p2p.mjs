/**
 * Test HDV P2P — deux comptes Supabase (fetch natif).
 * Usage: node scripts/test-market-p2p.mjs
 */
const URL = 'https://jmakrpkocxlyykgfnmlv.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWtycGtvY3hseXlrZ2ZubWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzQ5OTcsImV4cCI6MjA5NzcxMDk5N30.QDkUpvMkQIvFxgSqYgMPr2LERlYA_S684WnFlGaIAds';

const SELLER = {
  email: 'tokirha.test.bot+cursor@gmail.com',
  password: 'TestKira2026!',
  name: 'TestKira',
};
const BUYER = {
  email: 'tokirha.test.bot+hdv2@gmail.com',
  password: 'TestHdv2026!',
  name: 'HdvTest2',
};

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${URL}${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token || ANON}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    const msg = json?.message || json?.error_description || json?.error || text;
    throw new Error(`${method} ${path}: ${msg}`);
  }
  return json;
}

async function signIn(email, password) {
  const data = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  });
  return { token: data.access_token, userId: data.user.id };
}

async function signUp(email, password, displayName) {
  await api('/auth/v1/signup', {
    method: 'POST',
    body: { email, password, data: { display_name: displayName } },
  });
}

async function rpc(token, fn, args) {
  return api(`/rest/v1/rpc/${fn}`, { method: 'POST', token, body: args });
}

async function ensureBuyer() {
  try {
    return await signIn(BUYER.email, BUYER.password);
  } catch {
    console.log('→ Création compte acheteur HdvTest2…');
    await signUp(BUYER.email, BUYER.password, BUYER.name);
    return await signIn(BUYER.email, BUYER.password);
  }
}

async function main() {
  console.log('=== Test HDV P2P ===\n');

  const seller = await signIn(SELLER.email, SELLER.password);
  console.log(`✓ Vendeur: ${SELLER.name}`);

  let buyer;
  try {
    buyer = await ensureBuyer();
    console.log(`✓ Acheteur: ${BUYER.name}`);
  } catch (e) {
    console.log(`⚠ Acheteur: ${e.message}`);
    console.log('  (confirme l\'email via Supabase SQL si besoin)');
    throw e;
  }

  const listingData = await rpc(seller.token, 'market_create_sell_listing', {
    p_resource_id: 'wood',
    p_qty: 3,
    p_unit_price: 5,
    p_display_name: SELLER.name,
  });
  const listingId = listingData?.listing_id;
  console.log(`✓ Annonce: ${listingId}`);

  const buyData = await rpc(buyer.token, 'market_buy_listing', {
    p_listing_id: listingId,
    p_qty: 2,
  });
  console.log(`✓ Achat ×2 — ${buyData?.total}💰`);

  const rows = await api(
    `/rest/v1/market_sell_listings?id=eq.${listingId}&select=qty_remaining`,
    { token: buyer.token },
  );
  console.log(`  Stock restant: ${rows?.[0]?.qty_remaining ?? '?'}`);

  const saves = await api(
    `/rest/v1/saves?user_id=eq.${buyer.userId}&select=save_data`,
    { token: buyer.token },
  );
  const sd = saves?.[0]?.save_data;
  console.log(`  Acheteur → wood: ${sd?.inventory?.wood ?? 0}, kirha: ${sd?.kirha}`);

  const sellerSaves = await api(
    `/rest/v1/saves?user_id=eq.${seller.userId}&select=save_data`,
    { token: seller.token },
  );
  console.log(`  Vendeur → kirha: ${sellerSaves?.[0]?.save_data?.kirha}`);

  if (rows?.[0]?.qty_remaining > 0) {
    await rpc(seller.token, 'market_cancel_sell_listing', { p_listing_id: listingId });
    console.log('✓ Reste annulé');
  }

  console.log('\n=== OK ===');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
