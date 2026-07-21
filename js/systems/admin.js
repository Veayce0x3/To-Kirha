/**
 * Administration To-Kirha — wrappers RPC Supabase (staff only côté serveur).
 */

import { getSupabaseClient, isSupabaseConfigured } from '../core/supabaseClient.js';
import { isStaff, isAdmin, isSuperAdmin, canSeeAdminPanel } from '../core/auth.js';

function mapRpcError(message) {
  if (!message) return 'Erreur inconnue.';
  if (message.includes('Could not find the function') || message.includes('PGRST202')) {
    return 'Système admin non déployé — exécute supabase/admin_system.sql dans le SQL Editor Supabase.';
  }
  return message;
}

async function rpc(name, params = {}) {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'Supabase non configuré.' };
  const supabase = await getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    return { ok: false, reason: 'Session expirée — déconnecte-toi puis reconnecte-toi avec le compte Veayce.' };
  }
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    const msg = mapRpcError(error.message);
    if (/accès refusé/i.test(msg)) {
      return {
        ok: false,
        reason: `${msg} — le serveur ne te voit pas comme staff. Reconnecte-toi (compte Veayce).`,
      };
    }
    return { ok: false, reason: msg };
  }
  return { ok: true, data };
}

/** Répare le rôle superadmin owner côté serveur (Veayce). */
export async function claimOwnerSuperadmin() {
  return rpc('claim_owner_superadmin');
}

function denyIfNotStaff() {
  // canSeeAdminPanel couvre le bootstrap owner ; isStaff le rôle live/cache
  if (canSeeAdminPanel() || isStaff()) return null;
  return { ok: false, reason: 'Accès refusé.' };
}

export const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', minRole: 'moderator' },
  { id: 'players', label: 'Joueurs', icon: '👥', minRole: 'moderator' },
  { id: 'reports', label: 'Signalements', icon: '🚩', minRole: 'moderator' },
  { id: 'leaderboard', label: 'Classement', icon: '🏆', minRole: 'moderator' },
  { id: 'saves', label: 'Saves', icon: '💾', minRole: 'admin' },
  { id: 'announcements', label: 'Annonces', icon: '📢', minRole: 'admin' },
  { id: 'config', label: 'Config', icon: '⚙️', minRole: 'admin' },
  { id: 'logs', label: 'Journal', icon: '📜', minRole: 'moderator' },
];

const ROLE_RANK = { player: 0, moderator: 1, admin: 2, superadmin: 3 };

export function canAccessAdminTab(tabId, role) {
  const tab = ADMIN_TABS.find((t) => t.id === tabId);
  if (!tab) return false;
  return (ROLE_RANK[role] || 0) >= (ROLE_RANK[tab.minRole] || 99);
}

export function getVisibleAdminTabs(role) {
  return ADMIN_TABS.filter((t) => canAccessAdminTab(t.id, role));
}

export function canAccessAdminPanel() {
  return canSeeAdminPanel();
}

export async function fetchDashboard() {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_get_dashboard');
}

export async function searchPlayers(query, limit = 30) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_search_players', { p_query: query, p_limit: limit });
}

export async function getPlayerDetail(userId) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  const res = await rpc('admin_get_player_detail', { p_user_id: userId });
  if (res.ok) return res;
  // Fallback si la RPC plante (ex. save post-prestige) : lire profile + save côté client
  try {
    const fallback = await buildPlayerDetailFallback(userId);
    if (fallback.ok) return fallback;
  } catch (err) {
    console.warn('[admin] detail fallback failed', err);
  }
  return res;
}

async function buildPlayerDetailFallback(userId) {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'Supabase non configuré.' };
  const supabase = await getSupabaseClient();
  const [{ data: profile, error: pErr }, { data: saveRow, error: sErr }, { data: lb }] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('saves').select('save_data, updated_at').eq('user_id', userId).maybeSingle(),
    supabase.from('leaderboard_entries').select('*').eq('user_id', userId).maybeSingle(),
  ]);
  if (pErr) return { ok: false, reason: pErr.message };
  if (!profile) return { ok: false, reason: 'Joueur introuvable' };
  if (sErr) return { ok: false, reason: sErr.message };

  const save = saveRow?.save_data || null;
  const jobs = save?.jobs && typeof save.jobs === 'object' ? save.jobs : {};
  const jobs_summary = {};
  for (const [id, data] of Object.entries(jobs)) {
    jobs_summary[id] = Number(data?.level) || 1;
  }

  const inventory = save?.inventory && typeof save.inventory === 'object' ? save.inventory : {};
  const inventory_summary = Object.entries(inventory)
    .filter(([, qty]) => Number(qty) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 30)
    .map(([id, qty]) => ({ id, qty: Number(qty) || 0 }));

  const owned = Array.isArray(save?.ownedCombatItems) ? save.ownedCombatItems : [];
  const instances = Array.isArray(save?.combatItemInstances) ? save.combatItemInstances : [];
  const combat_items = owned.map((ref) => {
    const inst = instances.find((e) => e?.instanceId === ref);
    return {
      ref,
      item_id: inst?.itemId || ref,
      rarity: inst?.rarity || 'common',
    };
  });

  return {
    ok: true,
    data: {
      profile: {
        user_id: profile.user_id,
        display_name: profile.display_name,
        role: profile.role,
        is_banned: profile.is_banned,
        banned_at: profile.banned_at,
        banned_reason: profile.banned_reason,
        cheat_flagged: profile.cheat_flagged,
        cheat_notes: profile.cheat_notes,
        free_rename_used: profile.free_rename_used,
        email: null,
        created_at: profile.created_at,
      },
      name_history: [],
      leaderboard: lb || null,
      save_summary: save ? {
        kirha: Number(save.kirha) || 0,
        season: Number(save.season) || 1,
        char_level: Number(save.character?.level) || 1,
        nickname: save.character?.nickname || null,
        last_online: save.lastOnline || null,
        career_confirmed: !!save.careerChoice?.confirmed,
        career_harvest: save.careerChoice?.harvest || null,
        career_farm: save.careerChoice?.farm || null,
        career_weapon: save.careerChoice?.weaponType || null,
        career_team: save.careerChoice?.teamWeaponTypes || null,
        playtime_foreground_ms: Number(save.playtime?.foregroundMs) || 0,
        playtime_background_ms: Number(save.playtime?.backgroundMs) || 0,
        lifetime_earned: Number(save.lifetimeStats?.totalEarned) || 0,
        season_earned: Number(save.stats?.totalEarned) || 0,
        seasons_completed: Number(save.lifetimeStats?.seasonsCompleted) || 0,
        season_history: Array.isArray(save.seasonHistory) ? save.seasonHistory : [],
      } : null,
      inventory_summary,
      jobs_summary,
      combat_items,
      market_sells_active: 0,
      market_buys_active: 0,
      reports_against: 0,
      reports_by: 0,
      _fallback: true,
    },
  };
}

export async function banUser(userId, reason) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_ban_user', { p_target: userId, p_reason: reason });
}

export async function unbanUser(userId, reason = null) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_unban_user', { p_target: userId, p_reason: reason });
}

export async function setUserRole(userId, role) {
  if (!isSuperAdmin()) return { ok: false, reason: 'Superadmin requis.' };
  return rpc('admin_set_role', { p_target: userId, p_role: role });
}

export async function flagCheat(userId, flagged, notes = null) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_flag_cheat', { p_target: userId, p_flagged: flagged, p_notes: notes });
}

export async function deleteLeaderboardEntry(userId) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_delete_leaderboard', { p_user_id: userId });
}

export async function wipeAllLeaderboard() {
  if (!isSuperAdmin()) return { ok: false, reason: 'Superadmin requis.' };
  return rpc('admin_wipe_all_leaderboard');
}

export async function rebuildLeaderboardFromSaves() {
  if (!isAdmin()) return { ok: false, reason: 'Admin requis.' };
  return rpc('rebuild_leaderboard_from_saves');
}

export async function wipePlayerMarket(userId) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_wipe_market', { p_user_id: userId });
}

export async function resetCloudSave(userId) {
  if (!isAdmin()) return { ok: false, reason: 'Admin requis.' };
  return rpc('admin_reset_cloud_save', { p_user_id: userId });
}

export async function grantAllJobsLevel(userId) {
  if (!isAdmin()) return { ok: false, reason: 'Admin requis.' };
  return rpc('admin_grant_all_jobs_level', { p_user_id: userId });
}

export async function fetchModerationLogs(limit = 50, action = null) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_get_logs', { p_limit: limit, p_action: action || null });
}

export async function fetchPlayerList(filter = 'recent', limit = 40) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_list_players', { p_filter: filter, p_limit: limit });
}

export async function fetchCloudSaves(limit = 40) {
  if (!isAdmin()) return { ok: false, reason: 'Admin requis.' };
  return rpc('admin_list_saves', { p_limit: limit });
}

export async function fetchReports(status = 'pending', limit = 50) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_get_reports', { p_status: status, p_limit: limit });
}

export async function reviewReport(reportId, status, note = null) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_review_report', { p_report_id: reportId, p_status: status, p_note: note });
}

export async function fetchAnnouncementsAdmin(limit = 50) {
  if (!isAdmin()) return { ok: false, reason: 'Admin requis.' };
  return rpc('admin_list_announcements', { p_limit: limit });
}

export async function createAnnouncement(title, body, kind = 'info', hours = 72) {
  if (!isAdmin()) return { ok: false, reason: 'Admin requis.' };
  return rpc('admin_create_announcement', {
    p_title: title, p_body: body, p_kind: kind, p_hours: hours,
  });
}

export async function toggleAnnouncement(id, active) {
  if (!isAdmin()) return { ok: false, reason: 'Admin requis.' };
  return rpc('admin_toggle_announcement', { p_id: id, p_active: active });
}

export async function fetchAdminConfig() {
  if (!isAdmin()) return { ok: false, reason: 'Admin requis.' };
  return rpc('admin_get_config');
}

export async function setAdminConfig(key, value) {
  if (!isAdmin()) return { ok: false, reason: 'Admin requis.' };
  return rpc('admin_set_config', { p_key: key, p_value: value });
}

export async function fetchMarketAdmin(limit = 50) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_list_market', { p_limit: limit });
}

export async function deleteListing(listingId) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_delete_listing', { p_listing_id: listingId });
}

export async function deleteBuyOffer(offerId) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_delete_buy_offer', { p_offer_id: offerId });
}

export async function fetchLeaderboardAdmin(sort = 'char_level', limit = 50) {
  const deny = denyIfNotStaff();
  if (deny) return deny;
  return rpc('admin_list_leaderboard', { p_sort: sort, p_limit: limit });
}

export async function submitPlayerReport(reportedUserId, reason, details = null) {
  return rpc('submit_player_report', {
    p_reported_user_id: reportedUserId,
    p_reason: reason,
    p_details: details,
  });
}

export async function fetchActiveAnnouncements() {
  if (!isSupabaseConfigured()) return { ok: true, data: [] };
  return rpc('get_active_announcements');
}

export const ROLE_LABELS = {
  player: 'Joueur',
  moderator: 'Modérateur',
  admin: 'Admin',
  superadmin: 'Superadmin',
};

export const REPORT_STATUS_LABELS = {
  pending: 'En attente',
  reviewed: 'Examiné',
  dismissed: 'Rejeté',
  actioned: 'Action prise',
};

export const PLAYER_FILTER_LABELS = {
  recent: 'Actifs',
  new: 'Nouveaux',
  banned: 'Bannis',
  flagged: 'Flag',
  staff: 'Staff',
};

export const LOG_ACTION_LABELS = {
  ban: 'Ban',
  unban: 'Déban',
  set_role: 'Changement rôle',
  flag_cheat: 'Flag triche',
  delete_leaderboard: 'Retrait classement',
  wipe_market: 'HDV vidé',
  reset_cloud_save: 'Reset save',
  review_report: 'Signalement',
  create_announcement: 'Annonce créée',
  toggle_announcement: 'Annonce toggle',
  set_config: 'Config',
  delete_listing: 'Annonce HDV suppr.',
  delete_buy_offer: 'Offre HDV suppr.',
  grant_all_jobs_level: '+1 métiers / ferme',
  wipe_all_leaderboard: 'Wipe classement',
};

export const ANN_KIND_LABELS = {
  info: 'Info',
  warn: 'Avertissement',
  maintenance: 'Maintenance',
  event: 'Événement',
};
