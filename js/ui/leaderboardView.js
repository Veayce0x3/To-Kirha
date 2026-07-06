import {
  LEADERBOARD_TABS,
  fetchLeaderboard,
  formatLeaderboardValue,
  submitLeaderboardSnapshot,
  buildLeaderboardSnapshot,
} from '../systems/leaderboard.js';
import { getAuthState } from '../core/auth.js';
import { showAccountRequiredModal } from './authUi.js';
import { getOnlineBlockReason, canUseOnlineFeatures } from '../core/auth.js';
import { renderReportPlayerForm } from './adminView.js';
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

  await submitLeaderboardSnapshot(game.state, game.getCharacterDisplayName());
  const tabDef = LEADERBOARD_TABS.find((t) => t.id === activeLeaderboardTab) || LEADERBOARD_TABS[0];
  const result = await fetchLeaderboard(tabDef.sortKey, 50, game.state);
  const auth = getAuthState();
  const mySnap = buildLeaderboardSnapshot(game.state);

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
      ${!result.ok ? `<p class="auth-error">${result.reason || 'Impossible de charger le classement.'}</p>` : ''}
      ${result.devLocal ? '<p class="view-desc">Mode dev local — classement solo (Supabase non configuré).</p>' : ''}
      <ol class="leaderboard-list">
        ${(result.rows || []).map((row, i) => `
          <li class="leaderboard-row${row.user_id === auth.userId ? ' me' : ''}">
            <span class="lb-rank">#${i + 1}</span>
            <span class="lb-name">${row.display_name || 'Voyageur'}</span>
            <span class="lb-value">${formatLeaderboardValue(activeLeaderboardTab, row)}</span>
            ${row.user_id !== auth.userId ? `<button type="button" class="link-btn lb-report-btn" data-uid="${row.user_id}" data-name="${row.display_name || 'Joueur'}">🚩</button>` : ''}
          </li>
        `).join('') || '<li class="leaderboard-empty">Aucun joueur classé pour l\u2019instant.</li>'}
      </ol>
      ${mySnap ? `<p class="view-desc lb-you">Toi : ${formatLeaderboardValue(activeLeaderboardTab, { ...mySnap, display_name: game.getCharacterDisplayName() })}</p>` : ''}
      <div id="lb-report-root"></div>
    </div>
  `;

  el.querySelectorAll('[data-lb-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeLeaderboardTab = btn.dataset.lbTab;
      renderLeaderboard(game, el);
    });
  });

  el.querySelectorAll('.lb-report-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const root = el.querySelector('#lb-report-root');
      renderReportPlayerForm(root, btn.dataset.uid, btn.dataset.name);
    });
  });
}
