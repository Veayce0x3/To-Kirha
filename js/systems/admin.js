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
  const { data, error } = await supabase.rpc(name, params);
  if (error) return { ok: false, reason: mapRpcError(error.message) };
  return { ok: true, data };
}

export const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', minRole: 'moderator' },
  { id: 'players', label: 'Joueurs', icon: '👥', minRole: 'moderator' },
  { id: 'reports', label: 'Signalements', icon: '🚩', minRole: 'moderator' },
  { id: 'leaderboard', label: 'Classement', icon: '🏆', minRole: 'moderator' },
  { id: 'market', label: 'HDV', icon: '🏪', minRole: 'moderator' },
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
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_get_dashboard');
}

export async function searchPlayers(query, limit = 30) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_search_players', { p_query: query, p_limit: limit });
}

export async function getPlayerDetail(userId) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_get_player_detail', { p_user_id: userId });
}

export async function banUser(userId, reason) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_ban_user', { p_target: userId, p_reason: reason });
}

export async function unbanUser(userId, reason = null) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_unban_user', { p_target: userId, p_reason: reason });
}

export async function setUserRole(userId, role) {
  if (!isSuperAdmin()) return { ok: false, reason: 'Superadmin requis.' };
  return rpc('admin_set_role', { p_target: userId, p_role: role });
}

export async function flagCheat(userId, flagged, notes = null) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_flag_cheat', { p_target: userId, p_flagged: flagged, p_notes: notes });
}

export async function deleteLeaderboardEntry(userId) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_delete_leaderboard', { p_user_id: userId });
}

export async function wipePlayerMarket(userId) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
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
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_get_logs', { p_limit: limit, p_action: action || null });
}

export async function fetchPlayerList(filter = 'recent', limit = 40) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_list_players', { p_filter: filter, p_limit: limit });
}

export async function fetchCloudSaves(limit = 40) {
  if (!isAdmin()) return { ok: false, reason: 'Admin requis.' };
  return rpc('admin_list_saves', { p_limit: limit });
}

export async function fetchReports(status = 'pending', limit = 50) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_get_reports', { p_status: status, p_limit: limit });
}

export async function reviewReport(reportId, status, note = null) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
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
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_list_market', { p_limit: limit });
}

export async function deleteListing(listingId) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_delete_listing', { p_listing_id: listingId });
}

export async function deleteBuyOffer(offerId) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
  return rpc('admin_delete_buy_offer', { p_offer_id: offerId });
}

export async function fetchLeaderboardAdmin(sort = 'char_level', limit = 50) {
  if (!isStaff()) return { ok: false, reason: 'Accès refusé.' };
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
  recent: 'Récents',
  banned: 'Bannis',
  flagged: 'Flag triche',
  staff: 'Équipe staff',
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
};

export const ANN_KIND_LABELS = {
  info: 'Info',
  warn: 'Avertissement',
  maintenance: 'Maintenance',
  event: 'Événement',
};
