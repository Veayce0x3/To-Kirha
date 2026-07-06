import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import { attachIntegrityMeta, stripIntegrityMeta, validateSaveSanity } from './saveIntegrity.js';
import { isRegisteredAccount } from './auth.js';

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

export async function saveCloudSave(userId, state, balance) {
  if (!isSupabaseConfigured() || !userId || !isRegisteredAccount()) return { ok: false };
  const { isMaintenanceMode } = await import('../systems/gameConfig.js');
  if (isMaintenanceMode()) return { ok: false, reason: 'Maintenance en cours.' };
  const payload = JSON.parse(JSON.stringify(stripIntegrityMeta(state)));
  const sanity = validateSaveSanity(payload, balance);
  if (!sanity.ok) return { ok: false, reason: sanity.reason };

  const supabase = await getSupabaseClient();
  const { error } = await supabase.from('saves').upsert({
    user_id: userId,
    save_data: payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  return error ? { ok: false, reason: error.message } : { ok: true };
}

export async function mergeCloudAndLocal(cloud, local, balance) {
  if (!cloud?.data) return local;
  if (!local) return cloud.data;
  const cloudTime = cloud.data.lastOnline || 0;
  const localTime = local.lastOnline || 0;
  const chosen = cloudTime >= localTime ? cloud.data : local;
  const sanity = validateSaveSanity(chosen, balance);
  return sanity.ok ? chosen : local;
}

export async function prepareSavePayload(state) {
  const copy = JSON.parse(JSON.stringify(state));
  return attachIntegrityMeta(copy);
}
