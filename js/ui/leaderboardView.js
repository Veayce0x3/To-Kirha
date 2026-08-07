import {
  LEADERBOARD_TABS,
  fetchLeaderboard,
  submitLeaderboardSnapshot,
  buildLeaderboardSnapshot,
} from '../systems/leaderboard.js';
import { getAuthState, getOnlineBlockReason, canUseOnlineFeatures } from '../core/auth.js';
import { showAccountRequiredModal } from './authUi.js';
import { isLeaderboardEnabled, isMaintenanceMode } from '../systems/gameConfig.js';

const LB_LIMIT = 100;

/** @type {string} */
let activeSortKey = 'char_level';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

function rankLabel(i) {
  if (i < 0) return '—';
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return String(i + 1);
}

function sortMeta(sortKey) {
  return LEADERBOARD_TABS.find((t) => t.sortKey === sortKey) || LEADERBOARD_TABS[0];
}

function emptyHint(sortKey) {
  switch (sortKey) {
    case 'total_harvests': return 'Récolte pour apparaître ici.';
    case 'total_discoveries': return 'Trouve des découvertes Kirha en récolte.';
    case 'boss_kills_total': return 'Vaincs des boss pour être classé.';
    case 'seasons_completed': return 'Passe une Renaissance pour apparaître.';
    case 'total_earned': return 'Gagne des Kirha pour grimper.';
    case 'max_job_level': return 'Monte tes métiers pour apparaître.';
    default: return 'Joue un peu, puis actualise.';
  }
}

function primaryScore(sortKey, row) {
  switch (sortKey) {
    case 'char_level': return `Nv.${row.char_level || 1}`;
    case 'max_job_level': return `Nv.${row.max_job_level || 1}`;
    case 'total_earned': return `${fmtNum(row.total_earned)}`;
    case 'seasons_completed': return `${fmtNum(row.seasons_completed)}`;
    case 'total_harvests': return fmtNum(row.total_harvests);
    case 'total_discoveries': return fmtNum(row.total_discoveries);
    case 'boss_kills_total': return fmtNum(row.boss_kills_total);
    default: return `Nv.${row.char_level || 1}`;
  }
}

function primarySuffix(sortKey) {
  if (sortKey === 'total_earned') return '💰';
  return '';
}

/** Colonnes fixes affichées (hors score de tri). */
function sideStats(row) {
  return [
    { key: 'char_level', short: `Nv.${row.char_level || 1}` },
    { key: 'max_job_level', short: `Nv.${row.max_job_level || 1}` },
    { key: 'season', short: `S${row.season || 1}` },
    { key: 'total_earned', short: `${fmtNum(row.total_earned)}` },
  ];
}

function colsHeadHtml(sortKey) {
  const scoreLabel = sortMeta(sortKey).label;
  return `
    <div class="lb-cols" aria-hidden="true">
      <span class="lb-cols-rank">#</span>
      <span class="lb-cols-name">Joueur</span>
      <span class="lb-cols-stat${sortKey === 'char_level' ? ' is-hl' : ''}">Perso</span>
      <span class="lb-cols-stat${sortKey === 'max_job_level' ? ' is-hl' : ''}">Métier</span>
      <span class="lb-cols-stat">Saison</span>
      <span class="lb-cols-stat${sortKey === 'total_earned' ? ' is-hl' : ''}">Fortune</span>
      <span class="lb-cols-score is-hl">${esc(scoreLabel)}</span>
    </div>
  `;
}

function rowHtml(row, rankIndex, sortKey, { isMe = false, tag = 'li' } = {}) {
  const name = esc(row.display_name || 'Voyageur');
  const stats = sideStats(row);
  const score = primaryScore(sortKey, row);
  const suffix = primarySuffix(sortKey);
  const cls = [
    'lb-row',
    isMe ? 'is-me' : '',
    rankIndex >= 0 && rankIndex < 3 ? 'is-top' : '',
  ].filter(Boolean).join(' ');

  return `
    <${tag} class="${cls}">
      <span class="lb-row-rank">${rankLabel(rankIndex)}</span>
      <span class="lb-row-name">${name}${isMe ? '<em>toi</em>' : ''}</span>
      ${stats.map((s) => `
        <span class="lb-row-stat${s.key === sortKey ? ' is-hl' : ''}" data-col="${s.key}">${esc(s.short)}</span>
      `).join('')}
      <span class="lb-row-score">${esc(score)}${suffix ? ` ${suffix}` : ''}</span>
    </${tag}>
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

  if (!LEADERBOARD_TABS.some((t) => t.sortKey === activeSortKey)) {
    activeSortKey = 'char_level';
  }

  const meta = sortMeta(activeSortKey);

  el.classList.add('lb-page');
  el.innerHTML = `
    <div class="lb-shell">
      <header class="lb-head">
        <div class="lb-head-row">
          <h2 class="lb-title">🏆 Classement</h2>
          <button type="button" class="btn btn-muted btn-sm lb-refresh" id="lb-refresh" aria-label="Actualiser">↻</button>
        </div>
        <label class="lb-sort">
          <span class="lb-sort-lbl">Classer par</span>
          <select class="auth-input lb-sort-select" id="lb-sort">
            ${LEADERBOARD_TABS.map((t) => `
              <option value="${t.sortKey}" ${t.sortKey === activeSortKey ? 'selected' : ''}>${t.label}</option>
            `).join('')}
          </select>
        </label>
      </header>
      <div class="lb-body" id="lb-body">
        <p class="lb-loading">Chargement…</p>
      </div>
    </div>
  `;

  el.querySelector('#lb-refresh')?.addEventListener('click', () => renderLeaderboard(game, el));
  el.querySelector('#lb-sort')?.addEventListener('change', (e) => {
    activeSortKey = e.target.value || 'char_level';
    renderLeaderboard(game, el);
  });

  const sync = await submitLeaderboardSnapshot(game.state, game.getCharacterDisplayName());
  const result = await fetchLeaderboard(activeSortKey, LB_LIMIT, game.state);
  const auth = getAuthState();
  const mySnap = {
    ...buildLeaderboardSnapshot(game.state),
    display_name: game.getCharacterDisplayName(),
    user_id: auth.userId,
  };
  const rows = result.rows || [];
  const myRank = rows.findIndex((r) => r.user_id === auth.userId);
  const body = el.querySelector('#lb-body');
  if (!body) return;

  const errors = [];
  if (!sync.ok && rows.length === 0) errors.push(`Sync : ${sync.reason || 'échec'}`);
  if (!result.ok) errors.push(result.reason || 'Chargement impossible.');

  body.innerHTML = `
    <div class="lb-you-wrap">
      ${rowHtml(mySnap, myRank, activeSortKey, { isMe: true, tag: 'div' })}
      ${myRank < 0 && result.ok
        ? `<p class="lb-hint">Pas encore dans le top ${LB_LIMIT} pour « ${esc(meta.label)} ».</p>`
        : ''}
    </div>
    ${errors.map((m) => `<p class="auth-error lb-hint">${esc(m)}</p>`).join('')}
    <div class="lb-board">
      <div class="lb-board-top">
        <p class="lb-board-title">Top ${rows.length || 0}</p>
        ${colsHeadHtml(activeSortKey)}
      </div>
      <ol class="lb-list">
        ${rows.length
          ? rows.map((row, i) => rowHtml(row, i, activeSortKey, {
              isMe: row.user_id === auth.userId,
              tag: 'li',
            })).join('')
          : `<li class="lb-empty">${emptyHint(activeSortKey)}</li>`}
      </ol>
    </div>
  `;
}
