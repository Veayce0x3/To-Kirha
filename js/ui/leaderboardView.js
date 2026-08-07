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

/** @type {string} id d’onglet LEADERBOARD_TABS */
let activeTabId = 'level';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rankLabel(i) {
  if (i < 0) return '—';
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return String(i + 1);
}

function emptyHint(tabId) {
  switch (tabId) {
    case 'harvest': return 'Récolte pour apparaître ici.';
    case 'discoveries': return 'Trouve des découvertes Kirha en récolte.';
    case 'combat': return 'Vaincs des boss pour être classé.';
    case 'seasons': return 'Passe une Renaissance pour apparaître.';
    case 'fortune': return 'Gagne des Kirha pour grimper.';
    case 'jobs': return 'Monte tes métiers pour apparaître.';
    default: return 'Joue un peu, puis actualise.';
  }
}

/** Score court pour la colonne de droite (lisible d’un coup d’œil). */
function shortScore(tabId, row) {
  switch (tabId) {
    case 'level': return `Nv.${row.char_level || 1}`;
    case 'jobs': return `Nv.${row.max_job_level || 1}`;
    case 'fortune': return `${Number(row.total_earned || 0).toLocaleString('fr-FR')} 💰`;
    case 'seasons': return `${row.seasons_completed || 0}`;
    case 'harvest': return Number(row.total_harvests || 0).toLocaleString('fr-FR');
    case 'discoveries': return Number(row.total_discoveries || 0).toLocaleString('fr-FR');
    case 'combat': return Number(row.boss_kills_total || 0).toLocaleString('fr-FR');
    default: return formatLeaderboardValue(tabId, row);
  }
}

function rowSub(tabId, row) {
  if (tabId === 'level') return `Saison ${row.season || 1}`;
  if (tabId === 'jobs') return `Perso Nv.${row.char_level || 1}`;
  if (tabId === 'fortune') return `En poche ${Number(row.kirha_current || 0).toLocaleString('fr-FR')} 💰`;
  if (tabId === 'seasons') return `Saison actuelle ${row.season || 1}`;
  return `Perso Nv.${row.char_level || 1} · S${row.season || 1}`;
}

function listRowHtml(row, index, tabId, { isMe = false } = {}) {
  const name = esc(row.display_name || 'Voyageur');
  return `
    <li class="lb-row${isMe ? ' is-me' : ''}${index >= 0 && index < 3 ? ' is-top' : ''}">
      <span class="lb-row-rank">${rankLabel(index)}</span>
      <div class="lb-row-main">
        <span class="lb-row-name">${name}${isMe ? ' <em>(toi)</em>' : ''}</span>
        <span class="lb-row-sub">${esc(rowSub(tabId, row))}</span>
      </div>
      <span class="lb-row-score">${esc(shortScore(tabId, row))}</span>
    </li>
  `;
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

  const tabDef = LEADERBOARD_TABS.find((t) => t.id === activeTabId) || LEADERBOARD_TABS[0];
  activeTabId = tabDef.id;

  el.innerHTML = `
    <div class="view-header lb-header">
      <div class="lb-header-row">
        <h2>🏆 Classement</h2>
        <button type="button" class="btn btn-muted btn-sm" id="lb-refresh" title="Actualiser">↻</button>
      </div>
    </div>
    <nav class="lb-chips" role="tablist" aria-label="Critère">
      ${LEADERBOARD_TABS.map((t) => `
        <button type="button" class="lb-chip${t.id === activeTabId ? ' active' : ''}"
          data-lb-tab="${t.id}" role="tab" aria-selected="${t.id === activeTabId}">${t.label}</button>
      `).join('')}
    </nav>
    <div class="panel-inner leaderboard-panel">
      <p class="lb-loading">Chargement…</p>
    </div>
  `;

  el.querySelector('#lb-refresh')?.addEventListener('click', () => renderLeaderboard(game, el));
  el.querySelectorAll('[data-lb-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTabId = btn.getAttribute('data-lb-tab') || 'level';
      renderLeaderboard(game, el);
    });
  });

  const sync = await submitLeaderboardSnapshot(game.state, game.getCharacterDisplayName());
  const result = await fetchLeaderboard(tabDef.sortKey, 50, game.state);
  const auth = getAuthState();
  const mySnap = {
    ...buildLeaderboardSnapshot(game.state),
    display_name: game.getCharacterDisplayName(),
    user_id: auth.userId,
  };
  const rows = result.rows || [];
  const myRank = rows.findIndex((r) => r.user_id === auth.userId);
  const showSyncWarn = !sync.ok && rows.length === 0;
  const panel = el.querySelector('.leaderboard-panel');
  if (!panel) return;

  const youBlock = `
    <div class="lb-you${myRank >= 0 ? '' : ' lb-you-out'}">
      <span class="lb-you-rank">${rankLabel(myRank)}</span>
      <div class="lb-you-main">
        <strong>${esc(mySnap.display_name)}</strong>
        <span class="lb-you-meta">${myRank >= 0 ? `Rang ${myRank + 1} · ${tabDef.label}` : `Hors top 50 · ${tabDef.label}`}</span>
      </div>
      <span class="lb-you-score">${esc(shortScore(activeTabId, mySnap))}</span>
    </div>
  `;

  panel.innerHTML = `
    ${youBlock}
    ${showSyncWarn ? `<p class="auth-error">Sync : ${esc(sync.reason || 'échec')}</p>` : ''}
    ${!result.ok ? `<p class="auth-error">${esc(result.reason || 'Chargement impossible.')}</p>` : ''}
    ${result.devLocal ? '<p class="view-desc">Mode local.</p>' : ''}
    <ol class="lb-list">
      ${rows.length
        ? rows.map((row, i) => listRowHtml(row, i, activeTabId, { isMe: row.user_id === auth.userId })).join('')
        : `<li class="lb-empty">${emptyHint(activeTabId)}</li>`}
    </ol>
  `;
}
