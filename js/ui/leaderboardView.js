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
  const showSyncWarn = !sync.ok && rows.length === 0;
  const tabLabel = tabDef.label;

  el.innerHTML = `
    <div class="view-header">
      <h2>🏆 Classement</h2>
      <p class="view-desc">${game.getCharacterDisplayName()} · tri par ${tabLabel.toLowerCase()}</p>
    </div>
    <nav class="leaderboard-tabs" role="tablist" aria-label="Critères">
      ${LEADERBOARD_TABS.map((t) => `
        <button type="button" class="leaderboard-tab${t.id === activeLeaderboardTab ? ' active' : ''}" data-lb-tab="${t.id}" role="tab" aria-selected="${t.id === activeLeaderboardTab}">${t.label}</button>
      `).join('')}
    </nav>
    <div class="panel-inner leaderboard-panel">
      ${showSyncWarn ? `<p class="auth-error">Sync : ${sync.reason || 'échec'}</p>` : ''}
      ${!result.ok ? `<p class="auth-error">${result.reason || 'Impossible de charger le classement.'}</p>` : ''}
      ${result.devLocal ? '<p class="view-desc">Mode local — classement solo.</p>' : ''}
      <ol class="leaderboard-list">
        ${rows.map((row, i) => `
          <li class="leaderboard-row${row.user_id === auth.userId ? ' me' : ''}">
            <span class="lb-rank">#${i + 1}</span>
            <span class="lb-name">${row.display_name || 'Voyageur'}</span>
            <span class="lb-value">${formatLeaderboardValue(activeLeaderboardTab, row)}</span>
          </li>
        `).join('') || '<li class="leaderboard-empty">Aucun joueur classé pour l’instant.</li>'}
      </ol>
      ${mySnap ? `<p class="view-desc lb-you">Toi · ${tabLabel} : ${formatLeaderboardValue(activeLeaderboardTab, { ...mySnap, display_name: game.getCharacterDisplayName() })}</p>` : ''}
    </div>
  `;

  el.querySelectorAll('[data-lb-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeLeaderboardTab = btn.dataset.lbTab;
      renderLeaderboard(game, el);
    });
  });
}
