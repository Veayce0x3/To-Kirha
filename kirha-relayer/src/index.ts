import { ethers } from 'ethers';

// ── ABIs minimaux ───────────────────────────────────────────
const KIRHA_GAME_ABI = [
  'function batchSave(uint256 cityId, uint256[] resourceIds, uint256[] resourceAmts, uint8[] metierIds, uint32[] metierLevels, uint32[] metierXps, uint32[] metierXpTotals, uint256 kirhaGained) external',
];

const KIRHA_MARKET_ABI = [
  'function listResource(uint256 cityId, uint256 resourceId, uint256 quantity, uint256 pricePerUnit) external returns (uint256)',
  'function buyResource(uint256 listingId, uint256 buyerCityId, uint256 quantity) external',
  'function cancelListing(uint256 listingId) external',
];

const KIRHA_GAME_ADMIN_ABI = [
  'function adminResetCity(uint256 cityId) external',
  'function adminGiveKirha(uint256 cityId, uint256 amount) external',
  'function adminGivePepites(uint256 cityId, uint256 amount) external',
  'function adminGiveVip(uint256 cityId, uint64 daysCount) external',
  'function adminGiveResource(uint256 cityId, uint256 resourceId, uint256 amount) external',
  'function adminSetMetierXp(uint256 cityId, uint8 metierId, uint32 level, uint32 xp, uint32 xpTotal) external',
  'function adminDeleteCity(uint256 cityId) external',
  'function setBan(uint256 cityId, bool banned) external',
];

interface Env {
  RELAYER_PRIVATE_KEY: string;
  RPC_URL: string;
  KIRHA_GAME_ADDRESS: string;
  KIRHA_MARKET_ADDRESS: string;
  ALLOWED_ORIGIN: string;
  RATE_LIMITER: KVNamespace;
  ADMIN_PRIVATE_KEY: string;
  ADMIN_TOKEN: string;
}

interface SavePayload {
  cityId: string;
  resourceIds: string[];
  resourceAmts: string[];
  metierIds: number[];
  metierLevels: number[];
  metierXps: number[];
  metierXpTotals: number[];
  kirhaGained: string;
}

interface ListPayload {
  cityId: string;
  resourceId: string;
  quantity: string;
  pricePerUnit: string;
}

interface BuyPayload {
  listingId: string;
  buyerCityId: string;
  quantity: string;
}

interface CancelPayload {
  listingId: string;
}

function corsHeaders(origin: string, allowedOrigin: string) {
  const allowed = allowedOrigin === '*' || origin === allowedOrigin
    ? origin
    : allowedOrigin;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(cors: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function cleanError(msg: string): string {
  if (msg.includes('city is banned'))    return 'Ville bannie.';
  if (msg.includes('not authorized'))    return 'Session expirée, veuillez re-autoriser.';
  if (msg.includes('Rate limit'))        return 'Trop de requêtes.';
  if (msg.includes('not enough stock'))  return 'Stock insuffisant.';
  if (msg.includes('not enough kirha'))  return 'Solde $KIRHA insuffisant.';
  return msg.slice(0, 120);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '*';
    const cors   = corsHeaders(origin, env.ALLOWED_ORIGIN ?? '*');

    // ── Preflight ────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return jsonResponse(cors, { error: 'Method not allowed' }, 405);
    }

    const url      = new URL(request.url);
    const pathname = url.pathname;

    // ── Parse body ───────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(cors, { error: 'Invalid JSON' }, 400);
    }

    // ── Provider / wallet ────────────────────────────────────
    const provider = new ethers.JsonRpcProvider(env.RPC_URL);
    const wallet   = new ethers.Wallet(env.RELAYER_PRIVATE_KEY, provider);

    // ════════════════════════════════════════════════════════
    // POST /save  — batchSave
    // ════════════════════════════════════════════════════════
    if (pathname === '/' || pathname === '/save') {
      const p = body as SavePayload;

      if (!p.cityId || !p.metierIds || !p.metierLevels) {
        return jsonResponse(cors, { error: 'Missing required fields' }, 400);
      }

      // Rate limiting : max 20 saves/heure par cityId
      const hourBucket = Math.floor(Date.now() / 3_600_000);
      const rateKey    = `save:${p.cityId}:${hourBucket}`;
      const countStr   = await env.RATE_LIMITER.get(rateKey);
      const count      = parseInt(countStr ?? '0', 10);
      if (count >= 20) {
        return jsonResponse(cors, { error: 'Rate limit exceeded (20/hour)' }, 429);
      }
      await env.RATE_LIMITER.put(rateKey, String(count + 1), { expirationTtl: 3600 });

      try {
        const contract = new ethers.Contract(env.KIRHA_GAME_ADDRESS, KIRHA_GAME_ABI, wallet);
        const tx = await contract.batchSave(
          BigInt(p.cityId),
          (p.resourceIds  ?? []).map(BigInt),
          (p.resourceAmts ?? []).map(BigInt),
          p.metierIds,
          p.metierLevels,
          p.metierXps,
          p.metierXpTotals,
          BigInt(p.kirhaGained ?? '0'),
        );
        const receipt = await tx.wait();
        return jsonResponse(cors, { success: true, txHash: receipt.hash });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return jsonResponse(cors, { error: cleanError(msg) }, 500);
      }
    }

    // ════════════════════════════════════════════════════════
    // POST /market/list  — listResource
    // ════════════════════════════════════════════════════════
    if (pathname === '/market/list') {
      const p = body as ListPayload;

      if (!p.cityId || !p.resourceId || !p.quantity || !p.pricePerUnit) {
        return jsonResponse(cors, { error: 'Missing required fields' }, 400);
      }

      // Rate limiting : max 30 mises en vente/heure par cityId
      const hourBucket = Math.floor(Date.now() / 3_600_000);
      const rateKey    = `list:${p.cityId}:${hourBucket}`;
      const countStr   = await env.RATE_LIMITER.get(rateKey);
      const count      = parseInt(countStr ?? '0', 10);
      if (count >= 30) {
        return jsonResponse(cors, { error: 'Rate limit exceeded (30/hour)' }, 429);
      }
      await env.RATE_LIMITER.put(rateKey, String(count + 1), { expirationTtl: 3600 });

      try {
        const contract = new ethers.Contract(env.KIRHA_MARKET_ADDRESS, KIRHA_MARKET_ABI, wallet);
        const tx = await contract.listResource(
          BigInt(p.cityId),
          BigInt(p.resourceId),
          BigInt(p.quantity),
          BigInt(p.pricePerUnit),
        );
        const receipt = await tx.wait();
        // Récupérer le listingId depuis l'event ResourceListed
        let listingId: string | undefined;
        for (const log of receipt.logs ?? []) {
          try {
            const iface = new ethers.Interface([
              'event ResourceListed(uint256 indexed listingId, uint256 indexed sellerCityId, uint256 resourceId, uint256 quantity, uint256 pricePerUnit)',
            ]);
            const parsed = iface.parseLog(log);
            if (parsed) listingId = parsed.args.listingId.toString();
          } catch {}
        }
        return jsonResponse(cors, { success: true, txHash: receipt.hash, listingId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return jsonResponse(cors, { error: cleanError(msg) }, 500);
      }
    }

    // ════════════════════════════════════════════════════════
    // POST /market/buy  — buyResource
    // ════════════════════════════════════════════════════════
    if (pathname === '/market/buy') {
      const p = body as BuyPayload;

      if (!p.listingId || !p.buyerCityId || !p.quantity) {
        return jsonResponse(cors, { error: 'Missing required fields' }, 400);
      }

      // Rate limiting : max 50 achats/heure par buyerCityId
      const hourBucket = Math.floor(Date.now() / 3_600_000);
      const rateKey    = `buy:${p.buyerCityId}:${hourBucket}`;
      const countStr   = await env.RATE_LIMITER.get(rateKey);
      const count      = parseInt(countStr ?? '0', 10);
      if (count >= 50) {
        return jsonResponse(cors, { error: 'Rate limit exceeded (50/hour)' }, 429);
      }
      await env.RATE_LIMITER.put(rateKey, String(count + 1), { expirationTtl: 3600 });

      try {
        const contract = new ethers.Contract(env.KIRHA_MARKET_ADDRESS, KIRHA_MARKET_ABI, wallet);
        const tx = await contract.buyResource(
          BigInt(p.listingId),
          BigInt(p.buyerCityId),
          BigInt(p.quantity),
        );
        const receipt = await tx.wait();
        return jsonResponse(cors, { success: true, txHash: receipt.hash });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return jsonResponse(cors, { error: cleanError(msg) }, 500);
      }
    }

    // ════════════════════════════════════════════════════════
    // POST /market/cancel  — cancelListing
    // ════════════════════════════════════════════════════════
    if (pathname === '/market/cancel') {
      const p = body as CancelPayload;

      if (!p.listingId) {
        return jsonResponse(cors, { error: 'Missing listingId' }, 400);
      }

      try {
        const contract = new ethers.Contract(env.KIRHA_MARKET_ADDRESS, KIRHA_MARKET_ABI, wallet);
        const tx = await contract.cancelListing(BigInt(p.listingId));
        const receipt = await tx.wait();
        return jsonResponse(cors, { success: true, txHash: receipt.hash });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return jsonResponse(cors, { error: cleanError(msg) }, 500);
      }
    }

    // ════════════════════════════════════════════════════════
    // POST /admin/*  — actions admin via ADMIN_PRIVATE_KEY
    // ════════════════════════════════════════════════════════
    if (pathname.startsWith('/admin/')) {
      // Check admin token
      const token = request.headers.get('X-Admin-Token');
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
        return jsonResponse(cors, { error: 'Unauthorized' }, 401);
      }

      const action = pathname.replace('/admin/', '');

      // Route de test simple (pas de tx on-chain)
      if (action === 'ping') {
        return jsonResponse(cors, { ok: true, msg: 'Token valide ✓' });
      }

      const p = body as Record<string, string>;

      try {
        const provider = new ethers.JsonRpcProvider(env.RPC_URL);
        const wallet = new ethers.Wallet(env.ADMIN_PRIVATE_KEY, provider);
        const contract = new ethers.Contract(env.KIRHA_GAME_ADDRESS, KIRHA_GAME_ADMIN_ABI, wallet);

        let tx;
        if (action === 'reset-city') {
          tx = await contract.adminResetCity(BigInt(p.cityId));
        } else if (action === 'give-kirha') {
          tx = await contract.adminGiveKirha(BigInt(p.cityId), BigInt(p.amount));
        } else if (action === 'give-pepites') {
          tx = await contract.adminGivePepites(BigInt(p.cityId), BigInt(p.amount));
        } else if (action === 'give-vip') {
          tx = await contract.adminGiveVip(BigInt(p.cityId), BigInt(p.days));
        } else if (action === 'give-resource') {
          tx = await contract.adminGiveResource(BigInt(p.cityId), BigInt(p.resourceId), BigInt(p.amount));
        } else if (action === 'set-metier-xp') {
          tx = await contract.adminSetMetierXp(BigInt(p.cityId), parseInt(p.metierId), parseInt(p.level), parseInt(p.xp), parseInt(p.xpTotal));
        } else if (action === 'delete-city') {
          tx = await contract.adminDeleteCity(BigInt(p.cityId));
        } else if (action === 'set-ban') {
          tx = await contract.setBan(BigInt(p.cityId), p.banned === 'true');
        } else {
          return jsonResponse(cors, { error: 'Unknown admin action' }, 404);
        }

        const receipt = await tx.wait();
        return jsonResponse(cors, { success: true, txHash: receipt.hash });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return jsonResponse(cors, { error: cleanError(msg) }, 500);
      }
    }

    return jsonResponse(cors, { error: 'Not found' }, 404);
  },
};
