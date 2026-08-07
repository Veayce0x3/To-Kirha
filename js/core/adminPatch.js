/**
 * Empêche l’autosave joueur d’écraser un patch admin (Kirha, inventaire, niveaux…).
 * Quand le cloud a un adminRevision plus élevé, on adopte ces champs.
 */

export function getAdminRevision(state) {
  return Math.max(0, Math.floor(Number(state?.adminRevision) || 0));
}

function cloneJson(value, fallback) {
  if (value == null) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

/** Quantités inventaire en entiers (évite le rejet sanity après don admin). */
function normalizeInventory(inv) {
  const src = inv && typeof inv === 'object' ? inv : {};
  const out = {};
  for (const [id, qty] of Object.entries(src)) {
    const n = Math.floor(Number(qty) || 0);
    if (n > 0) out[id] = n;
  }
  return out;
}

/**
 * @returns {{ state: object, changed: boolean }}
 */
export function adoptAdminPatchedFields(local, cloud) {
  if (!local || !cloud) return { state: local, changed: false };
  const remoteRev = getAdminRevision(cloud);
  const localRev = getAdminRevision(local);
  if (remoteRev <= localRev) return { state: local, changed: false };

  const next = { ...local };
  if (cloud.kirha != null) next.kirha = Number(cloud.kirha) || 0;
  next.inventory = normalizeInventory(cloud.inventory);
  if (cloud.jobs && typeof cloud.jobs === 'object') {
    next.jobs = cloneJson(cloud.jobs, next.jobs);
  }
  if (cloud.character && typeof cloud.character === 'object') {
    next.character = { ...(next.character || {}), ...cloneJson(cloud.character, {}) };
  }
  if (cloud.farmBuildingMeta && typeof cloud.farmBuildingMeta === 'object') {
    next.farmBuildingMeta = cloneJson(cloud.farmBuildingMeta, next.farmBuildingMeta || {});
  }
  if (cloud.lifetimeStats && typeof cloud.lifetimeStats === 'object') {
    next.lifetimeStats = { ...(next.lifetimeStats || {}), ...cloneJson(cloud.lifetimeStats, {}) };
  }
  if (cloud.stats && typeof cloud.stats === 'object') {
    next.stats = { ...(next.stats || {}), ...cloneJson(cloud.stats, {}) };
  }
  next.adminRevision = remoteRev;
  next.adminPatchedAt = Number(cloud.adminPatchedAt) || Date.now();
  if ('speedMode' in next) delete next.speedMode;

  return { state: next, changed: true };
}

export function applyAdminFieldsToState(target, source) {
  if (!target || !source) return false;
  const { state, changed } = adoptAdminPatchedFields(target, source);
  if (!changed) return false;
  target.kirha = state.kirha;
  target.inventory = state.inventory;
  target.jobs = state.jobs;
  target.character = state.character;
  target.farmBuildingMeta = state.farmBuildingMeta;
  target.lifetimeStats = state.lifetimeStats;
  target.stats = state.stats;
  target.adminRevision = state.adminRevision;
  target.adminPatchedAt = state.adminPatchedAt;
  if ('speedMode' in target) delete target.speedMode;
  return true;
}

function clampLevel(n, min = 1, max = 200) {
  const v = Math.trunc(Number(n) || min);
  return Math.max(min, Math.min(max, v));
}

/**
 * Applique localement un payload admin (miroir RPC) pour feedback immédiat.
 * @param {object} target — state mutable
 * @param {object} payload
 * @param {{ adminRevision?: number }} [meta]
 * @returns {boolean}
 */
export function applyAdminPayloadToState(target, payload, meta = {}) {
  if (!target || !payload || typeof payload !== 'object') return false;
  let changed = false;

  const kirhaDelta = Number(payload.kirha_delta) || 0;
  if (kirhaDelta !== 0) {
    target.kirha = Math.max(0, (Number(target.kirha) || 0) + kirhaDelta);
    if (kirhaDelta > 0) {
      target.lifetimeStats = target.lifetimeStats || {};
      target.lifetimeStats.totalEarned = (Number(target.lifetimeStats.totalEarned) || 0) + kirhaDelta;
      if (target.stats) {
        target.stats.totalEarned = (Number(target.stats.totalEarned) || 0) + kirhaDelta;
      }
    }
    changed = true;
  }

  let inv = { ...(target.inventory || {}) };
  let invTouched = false;
  if (payload.inventory_clear) {
    inv = {};
    invTouched = true;
  }
  const invDeltas = payload.inventory_deltas || payload.inventory_delta;
  if (invDeltas && typeof invDeltas === 'object') {
    for (const [id, delta] of Object.entries(invDeltas)) {
      const next = Math.floor((Number(inv[id]) || 0) + (Number(delta) || 0));
      if (next <= 0) delete inv[id];
      else inv[id] = next;
      invTouched = true;
    }
  }
  if (invTouched) {
    target.inventory = normalizeInventory(inv);
    changed = true;
  }

  if (payload.job_level_deltas && typeof payload.job_level_deltas === 'object'
    && Object.keys(payload.job_level_deltas).length) {
    target.jobs = target.jobs && typeof target.jobs === 'object' ? { ...target.jobs } : {};
    for (const [jobId, delta] of Object.entries(payload.job_level_deltas)) {
      const cur = target.jobs[jobId] || { level: 1, xp: 0 };
      target.jobs[jobId] = {
        ...cur,
        level: clampLevel((Number(cur.level) || 1) + Math.trunc(Number(delta) || 0)),
        xp: Number(cur.xp) || 0,
      };
    }
    changed = true;
  }
  if (payload.job_level_sets && typeof payload.job_level_sets === 'object'
    && Object.keys(payload.job_level_sets).length) {
    target.jobs = target.jobs && typeof target.jobs === 'object' ? { ...target.jobs } : {};
    for (const [jobId, set] of Object.entries(payload.job_level_sets)) {
      const cur = target.jobs[jobId] || { level: 1, xp: 0 };
      target.jobs[jobId] = { ...cur, level: clampLevel(set), xp: 0 };
    }
    changed = true;
  }

  if (payload.char_level_set != null) {
    target.character = { ...(target.character || {}) };
    target.character.level = clampLevel(payload.char_level_set);
    target.character.xp = 0;
    changed = true;
  } else if (payload.char_level_delta != null && Number(payload.char_level_delta) !== 0) {
    target.character = { ...(target.character || {}) };
    target.character.level = clampLevel(
      (Number(target.character.level) || 1) + Math.trunc(Number(payload.char_level_delta) || 0),
    );
    changed = true;
  }

  if (payload.farm_level_deltas && typeof payload.farm_level_deltas === 'object'
    && Object.keys(payload.farm_level_deltas).length) {
    target.farmBuildingMeta = { ...(target.farmBuildingMeta || {}) };
    for (const [buildingId, delta] of Object.entries(payload.farm_level_deltas)) {
      const cur = target.farmBuildingMeta[buildingId] || { level: 1 };
      const level = clampLevel((Number(cur.level) || 1) + Math.trunc(Number(delta) || 0));
      target.farmBuildingMeta[buildingId] = { ...cur, level };
    }
    changed = true;
  }

  if (!changed) return false;

  const rev = Number(meta.adminRevision);
  if (Number.isFinite(rev) && rev > getAdminRevision(target)) {
    target.adminRevision = Math.floor(rev);
  } else {
    target.adminRevision = getAdminRevision(target) + 1;
  }
  target.adminPatchedAt = Date.now();
  if ('speedMode' in target) delete target.speedMode;
  return true;
}
