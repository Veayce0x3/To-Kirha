/**
 * Compte joueur — renommage gratuit (1×) et suppression de compte.
 */

import { getSupabaseClient, isSupabaseConfigured } from '../core/supabaseClient.js';
import { isRegisteredAccount } from '../core/auth.js';
import { validateNickname } from './character.js';

async function rpc(name, params = {}) {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'Supabase non configuré.' };
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc(name, params);
  if (error) return { ok: false, reason: error.message };
  return { ok: true, data };
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
