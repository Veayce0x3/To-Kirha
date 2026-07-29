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
