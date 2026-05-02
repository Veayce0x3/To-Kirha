import { ethers } from 'ethers';

// ── ABIs minimaux ───────────────────────────────────────────
const KIRHA_GAME_ABI = [
  'function batchSave(uint256 cityId, uint256[] resourceIds, uint256[] resourceAmts, uint8[] metierIds, uint32[] metierLevels, uint32[] metierXps, uint32[] metierXpTotals, uint256 kirhaGained) external',
  'function batchSaveSigned(uint256 cityId, uint256[] resourceIds, uint256[] resourceAmts, uint8[] metierIds, uint32[] metierLevels, uint32[] metierXps, uint32[] metierXpTotals, uint256 kirhaGained, uint64 deadline, uint256 nonce, bytes signature) external',
  'function setPlayerProgress(uint256 cityId, bytes data) external',
  'function playerCityId(address player) external view returns (uint256)',
];

const KIRHA_MARKET_ABI = [
  'function listResource(uint256 cityId, uint256 resourceId, uint256 quantity, uint256 pricePerUnit) external returns (uint256)',
  'function buyResource(uint256 listingId, uint256 buyerCityId, uint256 quantity) external',
  'function cancelListing(uint256 listingId) external',
  'function getListing(uint256 listingId) external view returns (tuple(uint256 sellerCityId,uint256 resourceId,uint256 quantity,uint256 pricePerUnit,bool active))',
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
  'function adminSetPlayerProgress(uint256 cityId, bytes data) external',
  'function adminSetVipExpiry(uint256 cityId, uint64 expiryTimestamp) external',
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
  wallet: string;
  nonce: string;
  deadline: string;
  signature: string;
}

interface ListPayload {
  cityId: string;
  resourceId: string;
  quantity: string;
  pricePerUnit: string;
  wallet: string;
  nonce: string;
  deadline: string;
  signature: string;
}

interface BuyPayload {
  listingId: string;
  buyerCityId: string;
  quantity: string;
  wallet: string;
  nonce: string;
  deadline: string;
  signature: string;
}

interface CancelPayload {
  listingId: string;
  cityId: string;
  wallet: string;
  nonce: string;
  deadline: string;
  signature: string;
}

interface ProgressPayload {
  cityId: string;
  dataHex: string;
  wallet: string;
  nonce: string;
  deadline: string;
  signature: string;
}

const PARCHEMIN_PRICE_MIN = 1;
const PARCHEMIN_PRICE_MAX = 10_000;

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function buildSignMessage(action: string, fields: Record<string, string>): string {
  const sorted = Object.keys(fields).sort().map(k => `${k}:${fields[k]}`);
  return ['To-Kirha Relayer', `action:${action}`, ...sorted].join('\n');
}

async function assertSignedRequest(
  env: Env,
  action: string,
  wallet: string,
  cityId: string,
  nonce: string,
  deadline: string,
  signature: string,
  extraFields: Record<string, string> = {},
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const now = Math.floor(Date.now() / 1000);
  const deadlineInt = parsePositiveInt(deadline);
  if (!deadlineInt || deadlineInt < now) {
    return { ok: false, status: 401, error: 'Signature expirée.' };
  }

  if (!ethers.isAddress(wallet)) {
    return { ok: false, status: 400, error: 'Wallet invalide.' };
  }

  if (!signature || !signature.startsWith('0x')) {
    return { ok: false, status: 400, error: 'Signature manquante.' };
  }

  const nonceInt = parsePositiveInt(nonce);
  if (!nonceInt) {
    return { ok: false, status: 400, error: 'Nonce invalide.' };
  }

  const msg = buildSignMessage(action, {
    wallet: wallet.toLowerCase(),
    cityId,
    nonce,
    deadline,
    ...extraFields,
  });

  let recovered: string;
  try {
    recovered = ethers.verifyMessage(msg, signature).toLowerCase();
  } catch {
    return { ok: false, status: 401, error: 'Signature invalide.' };
  }

  if (recovered !== wallet.toLowerCase()) {
    return { ok: false, status: 401, error: 'Signer invalide.' };
  }

  const nonceKey = `nonce:${wallet.toLowerCase()}:${nonce}`;
  const seen = await env.RATE_LIMITER.get(nonceKey);
  if (seen) {
    return { ok: false, status: 409, error: 'Nonce déjà utilisé.' };
  }
  await env.RATE_LIMITER.put(nonceKey, '1', { expirationTtl: 3600 });
  return { ok: true };
}

function corsHeaders(origin: string, allowedOrigin: string) {
  const allowed = allowedOrigin === '*' || origin === allowedOrigin
    ? origin
    : allowedOrigin;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  if (msg.includes('invalid signature')) return 'Signature invalide.';
  if (msg.includes('signature expired')) return 'Signature expirée.';
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

    const url      = new URL(request.url);
    const pathname = url.pathname;

    // ════════════════════════════════════════════════════════
    // GET /config  — paramètres jeu publics (parcheminPrice, etc.)
    // ════════════════════════════════════════════════════════
    if (request.method === 'GET' && pathname === '/config') {
      const priceStr = await env.RATE_LIMITER.get('game:parcheminPrice');
      const parsed = priceStr ? parseInt(priceStr, 10) : 10;
      const parcheminPrice = Number.isFinite(parsed)
        ? Math.min(PARCHEMIN_PRICE_MAX, Math.max(PARCHEMIN_PRICE_MIN, parsed))
        : 10;
      return jsonResponse(cors, { parcheminPrice });
    }

    if (request.method !== 'POST') {
      return jsonResponse(cors, { error: 'Method not allowed' }, 405);
    }

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

      if (!p.cityId || !p.metierIds || !p.metierLevels || !p.wallet || !p.signature || !p.nonce || !p.deadline) {
        return jsonResponse(cors, { error: 'Missing required fields' }, 400);
      }

      const signed = await assertSignedRequest(
        env,
        'save',
        p.wallet,
        p.cityId,
        p.nonce,
        p.deadline,
        p.signature,
        { kirhaGained: p.kirhaGained ?? '0' },
      );
      if (!signed.ok) return jsonResponse(cors, { error: signed.error }, signed.status);

      const gameReader = new ethers.Contract(env.KIRHA_GAME_ADDRESS, KIRHA_GAME_ABI, provider);
      const ownerCityId = await gameReader.playerCityId(p.wallet);
      if (ownerCityId.toString() !== p.cityId) {
        return jsonResponse(cors, { error: 'CityId ne correspond pas au wallet.' }, 403);
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
        const tx = await contract.batchSaveSigned(
          BigInt(p.cityId),
          (p.resourceIds  ?? []).map(BigInt),
          (p.resourceAmts ?? []).map(BigInt),
          p.metierIds,
          p.metierLevels,
          p.metierXps,
          p.metierXpTotals,
          BigInt(p.kirhaGained ?? '0'),
          BigInt(p.deadline),
          BigInt(p.nonce),
          p.signature,
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

      if (!p.cityId || !p.resourceId || !p.quantity || !p.pricePerUnit || !p.wallet || !p.signature || !p.nonce || !p.deadline) {
        return jsonResponse(cors, { error: 'Missing required fields' }, 400);
      }

      const signed = await assertSignedRequest(
        env,
        'market_list',
        p.wallet,
        p.cityId,
        p.nonce,
        p.deadline,
        p.signature,
        { resourceId: p.resourceId, quantity: p.quantity, pricePerUnit: p.pricePerUnit },
      );
      if (!signed.ok) return jsonResponse(cors, { error: signed.error }, signed.status);

      const gameReader = new ethers.Contract(env.KIRHA_GAME_ADDRESS, KIRHA_GAME_ABI, provider);
      const ownerCityId = await gameReader.playerCityId(p.wallet);
      if (ownerCityId.toString() !== p.cityId) {
        return jsonResponse(cors, { error: 'CityId ne correspond pas au wallet.' }, 403);
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

      if (!p.listingId || !p.buyerCityId || !p.quantity || !p.wallet || !p.signature || !p.nonce || !p.deadline) {
        return jsonResponse(cors, { error: 'Missing required fields' }, 400);
      }

      const signed = await assertSignedRequest(
        env,
        'market_buy',
        p.wallet,
        p.buyerCityId,
        p.nonce,
        p.deadline,
        p.signature,
        { listingId: p.listingId, quantity: p.quantity },
      );
      if (!signed.ok) return jsonResponse(cors, { error: signed.error }, signed.status);

      const gameReader = new ethers.Contract(env.KIRHA_GAME_ADDRESS, KIRHA_GAME_ABI, provider);
      const ownerCityId = await gameReader.playerCityId(p.wallet);
      if (ownerCityId.toString() !== p.buyerCityId) {
        return jsonResponse(cors, { error: 'BuyerCityId ne correspond pas au wallet.' }, 403);
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

      if (!p.listingId || !p.cityId || !p.wallet || !p.signature || !p.nonce || !p.deadline) {
        return jsonResponse(cors, { error: 'Missing required fields' }, 400);
      }

      const signed = await assertSignedRequest(
        env,
        'market_cancel',
        p.wallet,
        p.cityId,
        p.nonce,
        p.deadline,
        p.signature,
        { listingId: p.listingId },
      );
      if (!signed.ok) return jsonResponse(cors, { error: signed.error }, signed.status);

      const gameReader = new ethers.Contract(env.KIRHA_GAME_ADDRESS, KIRHA_GAME_ABI, provider);
      const ownerCityId = await gameReader.playerCityId(p.wallet);
      if (ownerCityId.toString() !== p.cityId) {
        return jsonResponse(cors, { error: 'CityId ne correspond pas au wallet.' }, 403);
      }

      const hourBucket = Math.floor(Date.now() / 3_600_000);
      const cancelRateKey = `cancel:${p.cityId}:${hourBucket}`;
      const cancelCount = parseInt(await env.RATE_LIMITER.get(cancelRateKey) ?? '0', 10);
      if (cancelCount >= 50) {
        return jsonResponse(cors, { error: 'Rate limit exceeded (50/hour)' }, 429);
      }
      await env.RATE_LIMITER.put(cancelRateKey, String(cancelCount + 1), { expirationTtl: 3600 });

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
    // POST /progress — setPlayerProgress (blob progression client)
    // ════════════════════════════════════════════════════════
    if (pathname === '/progress') {
      const p = body as ProgressPayload;

      if (!p.cityId || !p.dataHex || !p.wallet || !p.signature || !p.nonce || !p.deadline) {
        return jsonResponse(cors, { error: 'Missing required fields' }, 400);
      }

      let dataBytes: Uint8Array;
      try {
        dataBytes = ethers.getBytes(p.dataHex);
      } catch {
        return jsonResponse(cors, { error: 'dataHex invalide' }, 400);
      }

      const payloadDigest = ethers.keccak256(dataBytes);
      const signed = await assertSignedRequest(
        env,
        'progress',
        p.wallet,
        p.cityId,
        p.nonce,
        p.deadline,
        p.signature,
        { payloadDigest },
      );
      if (!signed.ok) return jsonResponse(cors, { error: signed.error }, signed.status);

      const gameReader = new ethers.Contract(env.KIRHA_GAME_ADDRESS, KIRHA_GAME_ABI, provider);
      const ownerCityId = await gameReader.playerCityId(p.wallet);
      if (ownerCityId.toString() !== p.cityId) {
        return jsonResponse(cors, { error: 'CityId ne correspond pas au wallet.' }, 403);
      }

      if (dataBytes.length > 32000) {
        return jsonResponse(cors, { error: 'Payload trop volumineux' }, 400);
      }

      const hourBucket = Math.floor(Date.now() / 3_600_000);
      const rateKey    = `progress:${p.cityId}:${hourBucket}`;
      const countStr   = await env.RATE_LIMITER.get(rateKey);
      const count      = parseInt(countStr ?? '0', 10);
      if (count >= 40) {
        return jsonResponse(cors, { error: 'Rate limit exceeded (40/hour)' }, 429);
      }
      await env.RATE_LIMITER.put(rateKey, String(count + 1), { expirationTtl: 3600 });

      try {
        const contract = new ethers.Contract(env.KIRHA_GAME_ADDRESS, KIRHA_GAME_ABI, wallet);
        const tx = await contract.setPlayerProgress(BigInt(p.cityId), dataBytes);
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
      const hourBucket = Math.floor(Date.now() / 3_600_000);
      const adminRateKey = `admin:${action}:${hourBucket}`;
      const adminCount = parseInt(await env.RATE_LIMITER.get(adminRateKey) ?? '0', 10);
      if (adminCount >= 200) {
        return jsonResponse(cors, { error: 'Rate limit exceeded (200/hour)' }, 429);
      }
      await env.RATE_LIMITER.put(adminRateKey, String(adminCount + 1), { expirationTtl: 3600 });

      // Route de test simple (pas de tx on-chain)
      if (action === 'ping') {
        return jsonResponse(cors, { ok: true, msg: 'Token valide ✓' });
      }

      const p = body as Record<string, string>;

      // ── Paramètres jeu (KV, pas de tx on-chain) ───────────
      if (action === 'set-config') {
        const updates: Record<string, string> = {};
        if (p.parcheminPrice !== undefined) {
          const parsed = parseInt(p.parcheminPrice, 10);
          if (!Number.isFinite(parsed)) {
            return jsonResponse(cors, { error: 'Invalid parcheminPrice' }, 400);
          }
          const price = Math.min(PARCHEMIN_PRICE_MAX, Math.max(PARCHEMIN_PRICE_MIN, parsed));
          await env.RATE_LIMITER.put('game:parcheminPrice', String(price));
          updates.parcheminPrice = String(price);
        }
        return jsonResponse(cors, { success: true, updated: updates });
      }

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
        } else if (action === 'set-player-progress') {
          const hex = p.dataHex ?? '0x';
          tx = await contract.adminSetPlayerProgress(BigInt(p.cityId), hex);
        } else if (action === 'set-vip-expiry') {
          tx = await contract.adminSetVipExpiry(BigInt(p.cityId), BigInt(p.expiry ?? '0'));
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
