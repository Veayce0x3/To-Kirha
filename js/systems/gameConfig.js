import { getSupabaseClient, isSupabaseConfigured } from '../core/supabaseClient.js';

let cachedConfig = {
  maintenance_mode: false,
  leaderboard_enabled: true,
  market_p2p_enabled: true,
  test_hdv_enabled: true,
  reporting_enabled: true,
};

export function getGameConfig() {
  return { ...cachedConfig };
}

export function isMaintenanceMode() {
  return !!cachedConfig.maintenance_mode;
}

export function isLeaderboardEnabled() {
  return cachedConfig.leaderboard_enabled !== false;
}

export function isMarketP2pEnabled() {
  return cachedConfig.market_p2p_enabled !== false;
}

export function isReportingEnabled() {
  return cachedConfig.reporting_enabled !== false;
}

export function isTestHdvLiveEnabled() {
  return cachedConfig.test_hdv_enabled !== false;
}

function parseConfigValue(val) {
  if (val === true || val === false) return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  return val;
}

export async function loadGameConfig() {
  if (!isSupabaseConfigured()) return cachedConfig;
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.rpc('get_game_config_public');
    if (!error && data && typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) {
        cachedConfig[k] = parseConfigValue(v);
      }
    }
  } catch {}
  return cachedConfig;
}

export async function refreshGameConfig() {
  return loadGameConfig();
}
