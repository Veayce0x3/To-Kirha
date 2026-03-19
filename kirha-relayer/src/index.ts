import { ethers } from 'ethers';

// ── ABI minimal pour batchSave ──────────────────────────────
const KIRHA_GAME_ABI = [
  'function batchSave(uint256 cityId, uint256[] resourceIds, uint256[] resourceAmts, uint8[] metierIds, uint32[] metierLevels, uint32[] metierXps, uint32[] metierXpTotals, uint256 kirhaGained) external',
];

interface Env {
  RELAYER_PRIVATE_KEY: string;
  RPC_URL: string;
  KIRHA_GAME_ADDRESS: string;
  ALLOWED_ORIGIN: string;
  RATE_LIMITER: KVNamespace;
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

function corsHeaders(origin: string, allowedOrigin: string) {
  const allowed = allowedOrigin === '*' || origin === allowedOrigin
    ? origin
    : allowedOrigin;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
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
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse body ───────────────────────────────────────────
    let body: SavePayload;
    try {
      body = await request.json() as SavePayload;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const {
      cityId, resourceIds, resourceAmts,
      metierIds, metierLevels, metierXps, metierXpTotals, kirhaGained,
    } = body;

    if (!cityId || !metierIds || !metierLevels) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── Rate limiting : max 20 saves par cityId par heure ────
    const hourBucket  = Math.floor(Date.now() / 3_600_000);
    const rateKey     = `save:${cityId}:${hourBucket}`;
    const countStr    = await env.RATE_LIMITER.get(rateKey);
    const count       = parseInt(countStr ?? '0', 10);

    if (count >= 20) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded (20/hour)' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    await env.RATE_LIMITER.put(rateKey, String(count + 1), { expirationTtl: 3600 });

    // ── Envoyer la transaction ───────────────────────────────
    try {
      const provider = new ethers.JsonRpcProvider(env.RPC_URL);
      const wallet   = new ethers.Wallet(env.RELAYER_PRIVATE_KEY, provider);
      const contract = new ethers.Contract(env.KIRHA_GAME_ADDRESS, KIRHA_GAME_ABI, wallet);

      const tx = await contract.batchSave(
        BigInt(cityId),
        (resourceIds  ?? []).map(BigInt),
        (resourceAmts ?? []).map(BigInt),
        metierIds,
        metierLevels,
        metierXps,
        metierXpTotals,
        BigInt(kirhaGained ?? '0'),
      );

      const receipt = await tx.wait();

      return new Response(JSON.stringify({ success: true, txHash: receipt.hash }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // Simplifier les messages d'erreur contrat pour le client
      const clean = msg.includes('city is banned')      ? 'Ville bannie.'
                  : msg.includes('not authorized')      ? 'Session expirée, veuillez re-autoriser.'
                  : msg.includes('Rate limit')          ? 'Trop de sauvegardes.'
                  : msg.slice(0, 120);

      return new Response(JSON.stringify({ error: clean }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
