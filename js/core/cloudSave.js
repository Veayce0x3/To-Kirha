import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import { attachIntegrityMeta, stripIntegrityMeta, validateSaveSanity } from './saveIntegrity.js';
import { isRegisteredAccount } from './auth.js';
import { adoptAdminPatchedFields, getAdminRevision } from './adminPatch.js';

/** Empêche d’écraser le cloud avant la fusion locale/cloud au démarrage. */
let cloudSyncReady = true;

/** Bloque les uploads cloud pendant un don admin (évite d’écraser le patch RPC). */
let adminGrantLockUntil = 0;

export function beginAdminGrantLock(ms = 5000) {
  adminGrantLockUntil = Date.now() + Math.max(0, Number(ms) || 0);
}

export function endAdminGrantLock() {
  adminGrantLockUntil = 0;
}

export function isAdminGrantLocked() {
  return Date.now() < adminGrantLockUntil;
}

/** Rang de saison : une renaissance locale ne doit jamais être écrasée par une vieille save cloud. */
export function getSeasonRank(state) {
  const seasonsDone = Math.max(0, Number(state?.lifetimeStats?.seasonsCompleted) || 0);
  const season = Math.max(1, Number(state?.season) || 1);
  return seasonsDone * 1000 + season;
}

/** Compteur de resets partie : un reset local doit battre l’ancienne progression cloud. */
export function getResetRank(state) {
  return Math.max(0, Number(state?.lifetimeStats?.gameResets) || 0);
}

export function markCloudSyncReady(ready = true) {
  cloudSyncReady = !!ready;
}

export function isCloudSyncReady() {
  return cloudSyncReady;
}

export function isEmptyOrStarterSave(state) {
  if (!state) return true;
  if (!state.careerChoice?.confirmed) return true;
  const harvests = Number(state.stats?.totalHarvests || state.lifetimeStats?.totalHarvests || 0);
  const earned = Number(state.lifetimeStats?.totalEarned || state.stats?.totalEarned || 0);
  const crafted = state.crafted?.length || 0;
  const charLevel = Number(state.character?.level || 1);
  return harvests <= 0 && earned <= 0 && crafted <= 0 && charLevel <= 1;
}

function sameRegisteredUser(local, userId) {
  return local?.meta?.account?.mode === 'registered'
    && local?.meta?.account?.userId === userId;
}

export async function loadCloudSave(userId) {
  if (!isSupabaseConfigured() || !userId) return null;
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('saves')
    .select('save_data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data?.save_data) return null;
  return { data: data.save_data, updatedAt: data.updated_at };
}

export async function saveCloudSave(userId, state, balance, { force = false } = {}) {
  if (!isSupabaseConfigured() || !userId || !isRegisteredAccount()) return { ok: false };
  if (!cloudSyncReady && !force) return { ok: false, reason: 'Sync cloud en cours.' };
  const { isMaintenanceMode } = await import('../systems/gameConfig.js');
  if (isMaintenanceMode() && !force) return { ok: false, reason: 'Maintenance en cours.' };

  // Pendant un don admin : on adopte le cloud si plus récent, on n’upload pas l’ancien local.
  if (!force && isAdminGrantLocked()) {
    const existing = await loadCloudSave(userId);
    if (existing?.data && getAdminRevision(existing.data) > getAdminRevision(state)) {
      const adopted = adoptAdminPatchedFields(state, existing.data);
      if (adopted.changed) {
        return { ok: true, adoptedAdmin: true, state: adopted.state, deferred: true };
      }
    }
    return { ok: false, reason: 'Don admin en cours — sync reportée.', deferred: true };
  }

  let payload = JSON.parse(JSON.stringify(stripIntegrityMeta(state)));
  if ('speedMode' in payload) delete payload.speedMode;

  // Ne jamais uploader une save vide/starter si une progression cloud existe déjà
  // (sauf wipe forcé après reset joueur, ou reset local plus récent)
  if (!force && isEmptyOrStarterSave(payload)) {
    const existing = await loadCloudSave(userId);
    if (existing?.data && !isEmptyOrStarterSave(existing.data)) {
      if (getResetRank(payload) <= getResetRank(existing.data)) {
        console.warn('[cloudSave] Refus d’écraser la save cloud avec une partie vide.');
        return { ok: false, reason: 'Save locale vide — cloud conservé.' };
      }
    }
  }

  if (!force) {
    let adoptedAdmin = false;

    // Jusqu’à 3 essais : un don admin peut arriver entre le load et l’upsert.
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await loadCloudSave(userId);
      if (existing?.data) {
        const localResets = getResetRank(payload);
        const cloudResets = getResetRank(existing.data);
        const localRank = getSeasonRank(payload);
        const cloudRank = getSeasonRank(existing.data);
        if (cloudRank > localRank && localResets <= cloudResets) {
          return { ok: false, reason: 'Save cloud plus récente (saison) — recharge le jeu.' };
        }
        if (
          cloudRank === localRank
          && getAdminRevision(existing.data) > getAdminRevision(payload)
        ) {
          const adopted = adoptAdminPatchedFields(payload, existing.data);
          if (adopted.changed) {
            payload = adopted.state;
            adoptedAdmin = true;
          }
        }
      }

      const sanity = validateSaveSanity(payload, balance);
      if (!sanity.ok) return { ok: false, reason: sanity.reason };

      const supabase = await getSupabaseClient();
      const { error } = await supabase.from('saves').upsert({
        user_id: userId,
        save_data: payload,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) return { ok: false, reason: error.message };

      // Vérifie qu’on n’a pas écrasé un patch admin concurrent
      const verify = await loadCloudSave(userId);
      if (
        verify?.data
        && getSeasonRank(verify.data) === getSeasonRank(payload)
        && getAdminRevision(verify.data) > getAdminRevision(payload)
      ) {
        const adopted = adoptAdminPatchedFields(payload, verify.data);
        if (adopted.changed) {
          payload = adopted.state;
          adoptedAdmin = true;
          continue;
        }
      }

      return { ok: true, adoptedAdmin, state: payload };
    }

    return { ok: true, adoptedAdmin, state: payload };
  }

  const sanity = validateSaveSanity(payload, balance);
  if (!sanity.ok) return { ok: false, reason: sanity.reason };

  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('saves').upsert({
    user_id: userId,
    save_data: payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, wiped: true, state: payload };
}

/** Écrase la save cloud avec l’état local (après reset partie). */
export async function forceWipeCloudSave(userId, state, balance) {
  markCloudSyncReady(true);
  return saveCloudSave(userId, state, balance, { force: true });
}

/**
 * Fusion cloud / local.
 * Priorité : save réelle > save vide ; même compte + les deux réelles → lastOnline.
 * Les patches admin (adminRevision) gagnent toujours sur les champs concernés.
 */
export async function mergeCloudAndLocal(cloud, local, balance, { userId } = {}) {
  if (!cloud?.data) return local;
  if (!local) return cloud.data;

  const localEmpty = isEmptyOrStarterSave(local);
  const cloudEmpty = isEmptyOrStarterSave(cloud.data);
  const localIsOurs = userId ? sameRegisteredUser(local, userId) : true;
  const localResets = getResetRank(local);
  const cloudResets = getResetRank(cloud.data);

  let chosen;
  if (localResets > cloudResets) {
    // Reset local plus récent que le cloud → ne jamais restaurer l’ancienne partie
    chosen = local;
  } else if (cloudResets > localResets) {
    chosen = cloud.data;
  } else if (localEmpty && !cloudEmpty) {
    chosen = cloud.data;
  } else if (!localEmpty && cloudEmpty) {
    chosen = local;
  } else if (!localIsOurs) {
    // Invité / autre compte local ne doit jamais battre le cloud du compte connecté
    chosen = cloudEmpty ? local : cloud.data;
  } else {
    const localRank = getSeasonRank(local);
    const cloudRank = getSeasonRank(cloud.data);
    if (localRank > cloudRank) {
      chosen = local;
    } else if (cloudRank > localRank) {
      chosen = cloud.data;
    } else {
      const cloudTime = Number(cloud.data.lastOnline || 0);
      const localTime = Number(local.lastOnline || 0);
      // En cas d’égalité / doute, préférer le cloud (source de vérité multi-appareils)
      chosen = cloudTime >= localTime ? cloud.data : local;
    }
  }

  // Toujours fusionner un patch admin plus récent (même saison uniquement)
  if (getSeasonRank(chosen) === getSeasonRank(cloud.data)) {
    const withAdmin = adoptAdminPatchedFields(chosen, cloud.data);
    if (withAdmin.changed) chosen = withAdmin.state;
  }
  if (chosen && 'speedMode' in chosen) {
    chosen = { ...chosen };
    delete chosen.speedMode;
  }

  const sanity = validateSaveSanity(chosen, balance);
  if (sanity.ok) return chosen;
  // Fallback : l’autre save si la choisie est corrompue
  const fallback = chosen === cloud.data ? local : cloud.data;
  const fallbackSanity = validateSaveSanity(fallback, balance);
  return fallbackSanity.ok ? fallback : local;
}

export async function prepareSavePayload(state) {
  const copy = JSON.parse(JSON.stringify(state));
  return attachIntegrityMeta(copy);
}

/** Tire le cloud et applique un patch admin si plus récent (onglet repris, etc.). */
export async function pullAdminPatchIfNeeded(userId, state, balance) {
  if (!userId || !state) return { changed: false };
  const cloud = await loadCloudSave(userId);
  if (!cloud?.data) return { changed: false };
  if (getSeasonRank(state) !== getSeasonRank(cloud.data)) return { changed: false };
  const adopted = adoptAdminPatchedFields(state, cloud.data);
  if (!adopted.changed) return { changed: false };
  const sanity = validateSaveSanity(adopted.state, balance);
  if (!sanity.ok) return { changed: false };
  return { changed: true, state: adopted.state };
}
