import { getSupabaseClient, isSupabaseConfigured } from '../core/supabaseClient.js';
import { isRegisteredAccount, getAuthState } from '../core/auth.js';
import { DEV_FAKE_ACCOUNT } from '../config.js';
import { isLeaderboardEnabled, isMaintenanceMode } from './gameConfig.js';

export const LEADERBOARD_TABS = [
  { id: 'level', label: 'Niveau', sortKey: 'char_level', desc: true },
  { id: 'jobs', label: 'Métiers', sortKey: 'max_job_level', desc: true },
  { id: 'fortune', label: 'Fortune', sortKey: 'total_earned', desc: true },
  { id: 'seasons', label: 'Renaissance', sortKey: 'seasons_completed', desc: true },
  { id: 'harvest', label: 'Récolte', sortKey: 'total_harvests', desc: true },
  { id: 'combat', label: 'Combat', sortKey: 'boss_kills_total', desc: true },
];

export function buildLeaderboardSnapshot(state) {
  const bossKills = Object.values(state.bossKills || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const maxJobLevel = Math.max(1, ...Object.values(state.jobs || {}).map((j) => j?.level || 1));
  return {
    char_level: state.character?.level || 1,
    max_job_level: maxJobLevel,
    season: state.season || 1,
    total_earned: state.lifetimeStats?.totalEarned || 0,
    seasons_completed: state.lifetimeStats?.seasonsCompleted || 0,
    total_harvests: state.lifetimeStats?.totalHarvests || state.stats?.totalHarvests || 0,
    boss_kills_total: bossKills,
    kirha_current: state.kirha || 0,
  };
}

export async function submitLeaderboardSnapshot(state, displayName) {
  if (!isSupabaseConfigured() || !isRegisteredAccount()) {
    return { ok: false, reason: 'Compte requis.' };
  }
  if (isMaintenanceMode() || !isLeaderboardEnabled()) {
    return { ok: false, reason: 'Classement temporairement désactivé.' };
  }
  const auth = getAuthState();
  const metrics = buildLeaderboardSnapshot(state);
  const supabase = await getSupabaseClient();
  const row = {
    user_id: auth.userId,
    display_name: displayName || 'Voyageur',
    ...metrics,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('leaderboard_entries').upsert(row, { onConflict: 'user_id' });
  return error ? { ok: false, reason: error.message } : { ok: true };
}

export async function fetchLeaderboard(sortKey = 'char_level', limit = 50, localState = null) {
  if (!isSupabaseConfigured()) {
    if (DEV_FAKE_ACCOUNT && isRegisteredAccount() && localState) {
      const auth = getAuthState();
      const snap = buildLeaderboardSnapshot(localState);
      return {
        ok: true,
        rows: [{ user_id: auth.userId, display_name: auth.displayName || 'DevLocal', ...snap }],
        devLocal: true,
      };
    }
    return { ok: false, reason: 'Supabase non configuré.', rows: [] };
  }
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('*')
    .order(sortKey, { ascending: false })
    .limit(limit);
  if (error) return { ok: false, reason: error.message, rows: [] };
  return { ok: true, rows: data || [] };
}

export function formatLeaderboardValue(tabId, row) {
  switch (tabId) {
    case 'level': return `Nv.${row.char_level} · S${row.season}`;
    case 'jobs': return `Métier max Nv.${row.max_job_level || 1}`;
    case 'fortune': return `${Number(row.total_earned || 0).toLocaleString('fr-FR')} 💰`;
    case 'seasons': return `${row.seasons_completed || 0} saison(s)`;
    case 'harvest': return `${Number(row.total_harvests || 0).toLocaleString('fr-FR')} récoltes`;
    case 'combat': return `${row.boss_kills_total || 0} victoires DJ`;
    default: return '';
  }
}
