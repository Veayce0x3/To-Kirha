export function applyOfflineProgress(state, _aides, balance) {
  if (!state.lastOnline) return null;

  const offlineMs = Date.now() - state.lastOnline;
  if (offlineMs < 30000) return null;

  const cap = balance.offlineCapMs || 21600000;
  const effectiveMs = Math.min(offlineMs, cap);

  return {
    gains: {},
    effectiveMs,
    capped: offlineMs > cap,
    totalMs: offlineMs,
    zenOnly: true,
  };
}

export function formatOfflineDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}min`;
  if (mins > 0) return `${mins} min`;
  return 'moins d\'1 min';
}
