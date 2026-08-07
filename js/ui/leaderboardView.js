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
  return `#${i + 1}`;
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

/** Valeur principale du critère de tri (colonne de droite). */
function primaryScore(sortKey, row) {
  switch (sortKey) {
    case 'char_level': return `Nv.${row.char_level || 1}`;
    case 'max_job_level': return `Nv.${row.max_job_level || 1}`;
    case 'total_earned': return `${fmtNum(row.total_earned)} 💰`;
    case 'seasons_completed': return `${fmtNum(row.seasons_completed)}`;
    case 'total_harvests': return fmtNum(row.total_harvests);
    case 'total_discoveries': return fmtNum(row.total_discoveries);
    case 'boss_kills_total': return fmtNum(row.boss_kills_total);
    default: return `Nv.${row.char_level || 1}`;
  }
}

/**
 * Grille fixe de 4 infos — toujours les mêmes cases, lisible.
 * La case liée au tri est mise en avant.
 */
function statsGridHtml(row, sortKey) {
  const cells = [
    { key: 'char_level', label: 'Perso', value: `Nv.${row.char_level || 1}` },
    { key: 'max_job_level', label: 'Métier', value: `Nv.${row.max_job_level || 1}` },
    { key: 'season', label: 'Saison', value: `S${row.season || 1}` },
    { key: 'total_earned', label: 'Fortune', value: `${fmtNum(row.total_earned)} 💰` },
  ];

  // Si le tri n’est pas une des 4 cases, remplace Fortune par le critère
  const coreKeys = new Set(cells.map((c) => c.key));
  if (sortKey && !coreKeys.has(sortKey)) {
    const meta = sortMeta(sortKey);
    cells[3] = {
      key: sortKey,
      label: meta.label,
      value: primaryScore(sortKey, row),
    };
  }

  return `
    <div class="lb-grid" role="group" aria-label="Stats">
      ${cells.map((c) => `
        <div class="lb-cell${c.key === sortKey ? ' is-hl' : ''}">
          <span class="lb-cell-lbl">${esc(c.label)}</span>
          <span class="lb-cell-val">${esc(c.value)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function playerBlockHtml(row, rankIndex, sortKey, { isMe = false, tag = 'li' } = {}) {
  const name = esc(row.display_name || 'Voyageur');
  const cls = `lb-entry${isMe ? ' is-me' : ''}${rankIndex >= 0 && rankIndex < 3 ? ' is-top' : ''}`;
  return `
    <${tag} class="${cls}">
      <div class="lb-entry-head">
        <span class="lb-entry-rank">${rankLabel(rankIndex)}</span>
        <span class="lb-entry-name">${name}${isMe ? ' <em>toi</em>' : ''}</span>
        <span class="lb-entry-score">${esc(primaryScore(sortKey, row))}</span>
      </div>
      ${statsGridHtml(row, sortKey)}
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
    <div class="lb-page-inner">
      <div class="lb-toolbar">
        <div class="lb-toolbar-title">
          <h2 class="lb-title">🏆 Classement</h2>
          <button type="button" class="btn btn-muted btn-sm lb-refresh" id="lb-refresh" aria-label="Actualiser">↻</button>
        </div>
        <label class="lb-sort-wrap">
          <span class="lb-sort-label">Classer par</span>
          <select class="auth-input lb-sort-select" id="lb-sort">
            ${LEADERBOARD_TABS.map((t) => `
              <option value="${t.sortKey}" ${t.sortKey === activeSortKey ? 'selected' : ''}>${t.label}</option>
            `).join('')}
          </select>
        </label>
      </div>
      <div class="leaderboard-panel lb-panel">
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
  const panel = el.querySelector('.leaderboard-panel');
  if (!panel) return;

  const errors = [];
  if (!sync.ok && rows.length === 0) errors.push(`Sync : ${sync.reason || 'échec'}`);
  if (!result.ok) errors.push(result.reason || 'Chargement impossible.');

  panel.innerHTML = `
    <section class="lb-section lb-section-you" aria-label="Ton rang">
      ${playerBlockHtml(mySnap, myRank, activeSortKey, { isMe: true, tag: 'div' })}
      ${myRank < 0 && result.ok ? `<p class="lb-hint">Pas encore dans le top ${LB_LIMIT} (« ${esc(meta.label)} »).</p>` : ''}
    </section>
    ${errors.map((m) => `<p class="auth-error lb-hint">${esc(m)}</p>`).join('')}
    <section class="lb-section lb-section-list" aria-label="Top joueurs">
      <p class="lb-list-caption">Top ${rows.length || LB_LIMIT} · ${esc(meta.label)}</p>
      <ol class="lb-list">
        ${rows.length
          ? rows.map((row, i) => playerBlockHtml(row, i, activeSortKey, {
              isMe: row.user_id === auth.userId,
              tag: 'li',
            })).join('')
          : `<li class="lb-empty">${emptyHint(activeSortKey)}</li>`}
      </ol>
    </section>
  `;
}
