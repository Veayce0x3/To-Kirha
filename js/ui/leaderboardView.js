import {
  LEADERBOARD_TABS,
  fetchLeaderboard,
  formatLeaderboardValue,
  submitLeaderboardSnapshot,
  buildLeaderboardSnapshot,
} from '../systems/leaderboard.js';
import { getAuthState, getOnlineBlockReason, canUseOnlineFeatures } from '../core/auth.js';
import { showAccountRequiredModal } from './authUi.js';
import { isLeaderboardEnabled, isMaintenanceMode } from '../systems/gameConfig.js';

let activeLeaderboardTab = 'level';

function medalForRank(i) {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return `#${i + 1}`;
}

function emptyHint(tabId) {
  switch (tabId) {
    case 'harvest': return 'Les récoltes de la saison comptent ici — récolte pour monter !';
    case 'discoveries': return 'Trouve des événements Kirha en récolte (météo du jour) pour apparaître ici.';
    case 'combat': return 'Vaincs des boss de zone pour apparaître ici.';
    case 'seasons': return 'Passe une Renaissance (nouvelle saison) pour être classé.';
    case 'fortune': return 'Gagne des Kirha (vente, etc.) pour grimper.';
    default: return 'Joue un peu puis reviens — ton score se synchronise automatiquement.';
  }
}

export async function renderLeaderboard(game, el) {
  if (!canUseOnlineFeatures()) {
    el.innerHTML = `
      <div class="view-header"><h2>🏆 Classement</h2></div>
      <div class="panel-inner">
        <p class="view-desc">${getOnlineBlockReason()}</p>
        <button type="button" class="btn btn-craft" id="lb-need-account">Créer un compte</button>
      </div>
    `;
    el.querySelector('#lb-need-account')?.addEventListener('click', () => showAccountRequiredModal(getOnlineBlockReason()));
    return;
  }

  if (isMaintenanceMode() || !isLeaderboardEnabled()) {
    el.innerHTML = `
      <div class="view-header"><h2>🏆 Classement</h2></div>
      <div class="panel-inner"><p class="view-desc">Classement temporairement indisponible.</p></div>
    `;
    return;
  }

  const sync = await submitLeaderboardSnapshot(game.state, game.getCharacterDisplayName());
  const tabDef = LEADERBOARD_TABS.find((t) => t.id === activeLeaderboardTab) || LEADERBOARD_TABS[0];
  const result = await fetchLeaderboard(tabDef.sortKey, 50, game.state);
  const auth = getAuthState();
  const mySnap = buildLeaderboardSnapshot(game.state);
  const rows = result.rows || [];
  const myRank = rows.findIndex((r) => r.user_id === auth.userId);
  const showSyncWarn = !sync.ok && rows.length === 0;
  const tabLabel = tabDef.label;
  const myValue = formatLeaderboardValue(activeLeaderboardTab, {
    ...mySnap,
    display_name: game.getCharacterDisplayName(),
  });

  el.innerHTML = `
    <div class="view-header">
      <h2>🏆 Classement</h2>
      <p class="view-desc">Compare-toi aux autres voyageurs · ${tabLabel}</p>
    </div>
    <nav class="leaderboard-tabs" role="tablist" aria-label="Critères">
      ${LEADERBOARD_TABS.map((t) => `
        <button type="button" class="leaderboard-tab${t.id === activeLeaderboardTab ? ' active' : ''}" data-lb-tab="${t.id}" role="tab" aria-selected="${t.id === activeLeaderboardTab}">${t.label}</button>
      `).join('')}
    </nav>
    <div class="panel-inner leaderboard-panel">
      <div class="lb-you-card">
        <span class="lb-you-rank">${myRank >= 0 ? medalForRank(myRank) : '—'}</span>
        <div>
          <strong>${game.getCharacterDisplayName()}</strong>
          <p class="view-desc lb-you-score">${myValue}</p>
        </div>
      </div>
      ${showSyncWarn ? `<p class="auth-error">Sync : ${sync.reason || 'échec'}</p>` : ''}
      ${!result.ok ? `<p class="auth-error">${result.reason || 'Impossible de charger le classement.'}</p>` : ''}
      ${result.devLocal ? '<p class="view-desc">Mode local — classement solo.</p>' : ''}
      <ol class="leaderboard-list">
        ${rows.map((row, i) => `
          <li class="leaderboard-row${row.user_id === auth.userId ? ' me' : ''}${i < 3 ? ' lb-podium' : ''}">
            <span class="lb-rank">${medalForRank(i)}</span>
            <span class="lb-name">${row.display_name || 'Voyageur'}</span>
            <span class="lb-value">${formatLeaderboardValue(activeLeaderboardTab, row)}</span>
          </li>
        `).join('') || `<li class="leaderboard-empty">${emptyHint(activeLeaderboardTab)}</li>`}
      </ol>
    </div>
  `;

  el.querySelectorAll('[data-lb-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeLeaderboardTab = btn.dataset.lbTab;
      renderLeaderboard(game, el);
    });
  });
}
