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

function safeInt(n, fallback = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.floor(v);
}

export function buildLeaderboardSnapshot(state) {
  const bossKills = Object.values(state.bossKills || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const jobLevels = Object.values(state.jobs || {}).map((j) => safeInt(j?.level, 1));
  const maxJobLevel = jobLevels.length ? Math.max(1, ...jobLevels) : 1;
  return {
    char_level: Math.max(1, safeInt(state.character?.level, 1)),
    max_job_level: maxJobLevel,
    season: Math.max(1, safeInt(state.season, 1)),
    total_earned: Math.max(0, safeInt(state.lifetimeStats?.totalEarned ?? state.stats?.totalEarned, 0)),
    seasons_completed: Math.max(0, safeInt(state.lifetimeStats?.seasonsCompleted, 0)),
    total_harvests: Math.max(0, safeInt(state.lifetimeStats?.totalHarvests ?? state.stats?.totalHarvests, 0)),
    boss_kills_total: Math.max(0, safeInt(bossKills, 0)),
    kirha_current: Math.max(0, safeInt(state.kirha, 0)),
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
  if (!auth.userId || auth.userId === 'dev_local_user') {
    return { ok: false, reason: 'Session invalide.' };
  }
  const metrics = buildLeaderboardSnapshot(state);
  const supabase = await getSupabaseClient();
  const name = (displayName || auth.displayName || 'Voyageur').slice(0, 40);

  const { error: rpcError } = await supabase.rpc('upsert_my_leaderboard', {
    p_display_name: name,
    p_char_level: metrics.char_level,
    p_max_job_level: metrics.max_job_level,
    p_season: metrics.season,
    p_total_earned: metrics.total_earned,
    p_seasons_completed: metrics.seasons_completed,
    p_total_harvests: metrics.total_harvests,
    p_boss_kills_total: metrics.boss_kills_total,
    p_kirha_current: metrics.kirha_current,
  });

  if (!rpcError) return { ok: true };

  // Repli upsert table (anciens déploiements)
  const row = {
    user_id: auth.userId,
    display_name: name,
    ...metrics,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('leaderboard_entries').upsert(row, { onConflict: 'user_id' });
  if (error) {
    console.warn('[leaderboard] upsert failed', rpcError?.message || error.message);
    return { ok: false, reason: error.message || rpcError.message };
  }
  return { ok: true };
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
  const col = LEADERBOARD_TABS.some((t) => t.sortKey === sortKey) ? sortKey : 'char_level';
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('*')
    .order(col, { ascending: false })
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
