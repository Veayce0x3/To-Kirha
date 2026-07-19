/** Intégrité save locale — anti-édition casual + sanity checks. */

const INTEGRITY_VERSION = 1;
const INTEGRITY_SALT = 'tokirha-v1-integrity';
const MAX_STACK = 999_999;
const MAX_KIRHA = 999_999_999;

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export async function computeSaveHash(state) {
  if (!globalThis.crypto?.subtle) return null;
  const payload = stripIntegrityMeta(JSON.parse(JSON.stringify(state)));
  const data = new TextEncoder().encode(stableStringify(payload) + INTEGRITY_SALT);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function stripIntegrityMeta(state) {
  if (!state || typeof state !== 'object') return state;
  const copy = { ...state };
  if (copy.meta) {
    const meta = { ...copy.meta };
    delete meta.integrityHash;
    delete meta.integrityVersion;
    copy.meta = Object.keys(meta).length ? meta : undefined;
    if (!copy.meta) delete copy.meta;
  }
  return copy;
}

export async function attachIntegrityMeta(state) {
  if (!state.meta) state.meta = {};
  const hash = await computeSaveHash(state);
  if (hash) {
    state.meta.integrityHash = hash;
    state.meta.integrityVersion = INTEGRITY_VERSION;
  }
  return state;
}

export async function verifySaveIntegrity(state) {
  if (!state?.meta?.integrityHash) return { ok: true, skipped: true };
  if (!globalThis.crypto?.subtle) return { ok: true, skipped: true };
  const expected = state.meta.integrityHash;
  const copy = JSON.parse(JSON.stringify(state));
  const actual = await computeSaveHash(copy);
  if (actual !== expected) {
    return { ok: false, reason: 'Sauvegarde locale altérée ou corrompue.' };
  }
  return { ok: true };
}

export function validateSaveSanity(state, balance = {}) {
  const issues = [];
  if (!state || typeof state !== 'object') {
    return { ok: false, reason: 'Sauvegarde invalide.' };
  }

  const inv = state.inventory || {};
  for (const [id, qty] of Object.entries(inv)) {
    const n = Number(qty);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      issues.push(`Inventaire invalide : ${id}`);
    } else if (n > MAX_STACK) {
      issues.push(`Stock suspect : ${id} (×${n})`);
    }
  }

  const kirha = Number(state.kirha) || 0;
  if (kirha < 0 || kirha > MAX_KIRHA) issues.push('Kirha invalide');

  const earned = Number(state.lifetimeStats?.totalEarned) || 0;
  if (kirha > earned + (balance.startingKirha || 0) + 50000) {
    issues.push('Kirha incohérent avec les gains lifetime');
  }

  const season = Math.max(1, state.season || 1);
  const charCap = balance.prestige?.levelCaps?.character;
  const maxChar = charCap
    ? charCap.firstSeasonCap + (season - 1) * charCap.perSeason
    : 200;
  const charLevel = state.character?.level || 1;
  if (charLevel < 1 || charLevel > maxChar + 5) {
    issues.push('Niveau personnage suspect');
  }

  if (issues.length) {
    return { ok: false, reason: issues[0], issues };
  }
  return { ok: true };
}
