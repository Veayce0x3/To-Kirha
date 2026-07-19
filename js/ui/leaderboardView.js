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

  el.innerHTML = `
    <div class="view-header">
      <h2>🏆 Classement</h2>
      <p class="view-desc">Compte : ${game.getCharacterDisplayName()}</p>
    </div>
    <nav class="leaderboard-tabs" role="tablist">
      ${LEADERBOARD_TABS.map((t) => `
        <button type="button" class="leaderboard-tab${t.id === activeLeaderboardTab ? ' active' : ''}" data-lb-tab="${t.id}">${t.label}</button>
      `).join('')}
    </nav>
    <div class="panel-inner">
      ${showSyncWarn ? `<p class="auth-error">Sync classement : ${sync.reason || 'échec'}</p>` : ''}
      ${!result.ok ? `<p class="auth-error">${result.reason || 'Impossible de charger le classement.'}</p>` : ''}
      ${result.devLocal ? '<p class="view-desc">Mode dev local — classement solo (Supabase non configuré).</p>' : ''}
      <ol class="leaderboard-list">
        ${rows.map((row, i) => `
          <li class="leaderboard-row${row.user_id === auth.userId ? ' me' : ''}">
            <span class="lb-rank">#${i + 1}</span>
            <span class="lb-name">${row.display_name || 'Voyageur'}</span>
            <span class="lb-value">${formatLeaderboardValue(activeLeaderboardTab, row)}</span>
          </li>
        `).join('') || '<li class="leaderboard-empty">Aucun joueur classé pour l\u2019instant. Joue un peu puis reviens ici.</li>'}
      </ol>
      ${mySnap ? `<p class="view-desc lb-you">Toi : ${formatLeaderboardValue(activeLeaderboardTab, { ...mySnap, display_name: game.getCharacterDisplayName() })}</p>` : ''}
    </div>
  `;

  el.querySelectorAll('[data-lb-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeLeaderboardTab = btn.dataset.lbTab;
      renderLeaderboard(game, el);
    });
  });
}
