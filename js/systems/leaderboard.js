/**
 * Classement joueurs (Supabase).
 */

import { getSupabaseClient, isSupabaseConfigured } from '../core/supabaseClient.js';
import { isRegisteredAccount, getAuthState } from '../core/auth.js';
import { DEV_FAKE_ACCOUNT } from '../config.js';
import { isLeaderboardEnabled, isMaintenanceMode } from './gameConfig.js';
import { getTotalDiscoveries } from './harvestEvents.js';

export const LEADERBOARD_TABS = [
  { id: 'general', label: 'Général', sortKey: 'general', desc: true, clientSort: true },
  { id: 'level', label: 'Niveau', sortKey: 'char_level', desc: true },
  { id: 'jobs', label: 'Métiers', sortKey: 'max_job_level', desc: true },
  { id: 'fortune', label: 'Fortune', sortKey: 'total_earned', desc: true },
  { id: 'seasons', label: 'Renaissance', sortKey: 'seasons_completed', desc: true },
  { id: 'harvest', label: 'Récolte', sortKey: 'total_harvests', desc: true },
  { id: 'discoveries', label: 'Découvertes', sortKey: 'total_discoveries', desc: true },
  { id: 'combat', label: 'Combat', sortKey: 'boss_kills_total', desc: true },
];

function safeInt(n, fallback = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.floor(v);
}

/**
 * Score global (progression complète) — calcul client, pas de colonne DB.
 * Mélange niveau, métiers, saisons, fortune, récolte, découvertes, combat.
 */
export function computeGeneralScore(row) {
  const n = (v) => Math.max(0, Number(v) || 0);
  const earned = n(row.total_earned);
  return Math.floor(
    n(row.char_level) * 100
    + n(row.max_job_level) * 80
    + n(row.seasons_completed) * 900
    + n(row.season) * 50
    + Math.sqrt(earned) * 2.5
    + n(row.total_harvests) * 0.12
    + n(row.total_discoveries) * 45
    + n(row.boss_kills_total) * 55
  );
}

function withGeneralScore(row) {
  return { ...row, general_score: computeGeneralScore(row) };
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
    total_harvests: Math.max(
      0,
      safeInt(state.lifetimeStats?.totalHarvests, 0) + safeInt(state.stats?.totalHarvests, 0)
    ),
    total_discoveries: Math.max(0, getTotalDiscoveries(state)),
    boss_kills_total: Math.max(0, safeInt(bossKills, 0) + safeInt(state.lifetimeStats?.bossKillsTotal, 0)),
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
    p_total_discoveries: metrics.total_discoveries,
  });

  if (!rpcError) return { ok: true };

  // Ancienne signature RPC (sans découvertes)
  const { error: rpcLegacy } = await supabase.rpc('upsert_my_leaderboard', {
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
  if (!rpcLegacy) return { ok: true };

  // Repli upsert table
  const row = {
    user_id: auth.userId,
    display_name: name,
    ...metrics,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('leaderboard_entries').upsert(row, { onConflict: 'user_id' });
  if (error) {
    // Colonne total_discoveries absente : retry sans
    const { total_discoveries, ...rest } = row;
    const { error: err2 } = await supabase.from('leaderboard_entries').upsert(rest, { onConflict: 'user_id' });
    if (err2) {
      console.warn('[leaderboard] upsert failed', rpcError?.message || error.message);
      return { ok: false, reason: err2.message || error.message || rpcError.message };
    }
  }
  return { ok: true };
}

export async function fetchLeaderboard(sortKey = 'general', limit = 50, localState = null) {
  if (!isSupabaseConfigured()) {
    if (DEV_FAKE_ACCOUNT && isRegisteredAccount() && localState) {
      const auth = getAuthState();
      const snap = withGeneralScore({
        user_id: auth.userId,
        display_name: auth.displayName || 'DevLocal',
        ...buildLeaderboardSnapshot(localState),
      });
      return { ok: true, rows: [snap], devLocal: true };
    }
    return { ok: false, reason: 'Supabase non configuré.', rows: [] };
  }

  const tab = LEADERBOARD_TABS.find((t) => t.sortKey === sortKey) || LEADERBOARD_TABS[0];
  const isGeneral = tab.sortKey === 'general' || tab.clientSort;
  const supabase = await getSupabaseClient();

  // Général : on tire un pool plus large puis on trie côté client
  const fetchLimit = isGeneral ? Math.max(limit * 3, 200) : limit;
  let col = isGeneral ? 'char_level' : tab.sortKey;
  let { data, error } = await supabase
    .from('leaderboard_entries')
    .select('*')
    .order(col, { ascending: false })
    .limit(fetchLimit);

  // Colonne découvertes pas encore migrée → repli sur récoltes
  if (error && col === 'total_discoveries') {
    col = 'total_harvests';
    ({ data, error } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .order(col, { ascending: false })
      .limit(fetchLimit));
  }

  if (error) return { ok: false, reason: error.message, rows: [] };

  let rows = (data || []).map(withGeneralScore);
  if (isGeneral) {
    rows.sort((a, b) => (b.general_score || 0) - (a.general_score || 0));
    rows = rows.slice(0, limit);
  }
  return { ok: true, rows };
}

export function formatLeaderboardValue(tabId, row) {
  switch (tabId) {
    case 'general': return `${Number(row.general_score ?? computeGeneralScore(row)).toLocaleString('fr-FR')} pts`;
    case 'level': return `Perso Nv.${row.char_level} · Saison ${row.season}`;
    case 'jobs': return `Métier max Nv.${row.max_job_level || 1}`;
    case 'fortune': return `${Number(row.total_earned || 0).toLocaleString('fr-FR')} 💰 gagnés`;
    case 'seasons': return `${row.seasons_completed || 0} renaissance(s)`;
    case 'harvest': return `${Number(row.total_harvests || 0).toLocaleString('fr-FR')} récoltes`;
    case 'discoveries': return `${Number(row.total_discoveries || 0).toLocaleString('fr-FR')} découverte(s)`;
    case 'combat': return `${Number(row.boss_kills_total || 0).toLocaleString('fr-FR')} boss vaincu(s)`;
    default: return '';
  }
}
