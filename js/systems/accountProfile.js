/**
 * Compte joueur — renommage gratuit (1×), suppression, vérif pseudo.
 */

import { getSupabaseClient, isSupabaseConfigured } from '../core/supabaseClient.js';
import { isRegisteredAccount } from '../core/auth.js';
import { validateNickname } from './character.js';

function isRpcMissing(error) {
  if (!error) return false;
  if (error.code === 'PGRST202') return true;
  const msg = error.message || '';
  return msg.includes('Could not find the function') || msg.includes('schema cache');
}

async function rpc(name, params = {}) {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'Supabase non configuré.' };
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc(name, params);
  if (error) return { ok: false, reason: error.message, error };
  return { ok: true, data };
}

/** Fallback si la RPC n'est pas encore déployée : lecture publique table profiles. */
async function isDisplayNameTaken(supabase, name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return false;
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .ilike('display_name', trimmed)
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

export async function checkDisplayNameAvailable(name) {
  if (!isSupabaseConfigured()) return { ok: true, available: true };
  const check = validateNickname(name, { nicknameMaxLength: 20, nicknameMinLength: 3 });
  if (!check.ok) return check;

  const supabase = await getSupabaseClient();
  const rpcResult = await rpc('check_display_name_available', { p_name: check.name });
  if (rpcResult.ok) {
    return { ok: true, available: rpcResult.data === true };
  }
  if (!isRpcMissing(rpcResult.error)) {
    return { ok: false, reason: rpcResult.reason };
  }

  try {
    const taken = await isDisplayNameTaken(supabase, check.name);
    return { ok: true, available: !taken };
  } catch (e) {
    return { ok: false, reason: e.message || 'Vérification du pseudo impossible.' };
  }
}

export async function createProfileOnSignup(supabase, userId, displayName) {
  const trimmed = (displayName || '').trim();
  const rpcResult = await supabase.rpc('create_profile_on_signup', { p_display_name: trimmed });
  if (!rpcResult.error) return { ok: true, displayName: rpcResult.data?.display_name || trimmed };

  if (!isRpcMissing(rpcResult.error)) {
    return { ok: false, reason: rpcResult.error.message };
  }

  const taken = await isDisplayNameTaken(supabase, trimmed);
  if (taken) return { ok: false, reason: 'Pseudo déjà pris' };

  const { error } = await supabase.from('profiles').insert({
    user_id: userId,
    display_name: trimmed,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === '23505' || error.message?.includes('unique')) {
      return { ok: false, reason: 'Pseudo déjà pris' };
    }
    return { ok: false, reason: error.message };
  }
  return { ok: true, displayName: trimmed };
}

export async function changeDisplayNameFree(newName, characterConfig) {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  const check = validateNickname(newName, characterConfig);
  if (!check.ok) return check;
  return rpc('change_my_display_name', { p_new_name: check.name });
}

export async function deleteMyAccount() {
  if (!isRegisteredAccount()) return { ok: false, reason: 'Compte requis.' };
  return rpc('delete_my_account');
}
