import {
  LEADERBOARD_TABS,
  fetchLeaderboard,
  submitLeaderboardSnapshot,
  buildLeaderboardSnapshot,
} from '../systems/leaderboard.js';
import { getAuthState, getOnlineBlockReason, canUseOnlineFeatures } from '../core/auth.js';
import { showAccountRequiredModal } from './authUi.js';
import { isLeaderboardEnabled, isMaintenanceMode } from '../systems/gameConfig.js';

/** Nombre de joueurs listés (le tri change juste l’ordre / qui est 1er). */
const LB_LIMIT = 100;

/** @type {string} sortKey SQL */
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

function sortLabel(sortKey) {
  return LEADERBOARD_TABS.find((t) => t.sortKey === sortKey)?.label || 'Niveau';
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

/** Toutes les infos utiles d’un joueur, sur une seule ligne. */
function statsLine(row, sortKey) {
  const bits = [
    { key: 'char_level', text: `Perso Nv.${row.char_level || 1}` },
    { key: 'max_job_level', text: `Métier Nv.${row.max_job_level || 1}` },
    { key: 'season', text: `S${row.season || 1}` },
    { key: 'total_earned', text: `${fmtNum(row.total_earned)} 💰` },
    { key: 'total_harvests', text: `${fmtNum(row.total_harvests)} récoltes` },
    { key: 'seasons_completed', text: `${fmtNum(row.seasons_completed)} renais.` },
    { key: 'boss_kills_total', text: `${fmtNum(row.boss_kills_total)} boss` },
    { key: 'total_discoveries', text: `${fmtNum(row.total_discoveries)} découv.` },
  ];
  // Toujours perso / métier / saison / fortune + critère trié s’il manque
  const prefer = new Set(['char_level', 'max_job_level', 'season', 'total_earned']);
  if (sortKey && sortKey !== 'season') prefer.add(sortKey);
  return bits
    .filter((b) => prefer.has(b.key))
    .map((b) => {
      const hl = b.key === sortKey || (sortKey === 'char_level' && b.key === 'char_level');
      return `<span class="lb-stat${hl ? ' lb-stat-hl' : ''}">${esc(b.text)}</span>`;
    })
    .join('<span class="lb-stat-sep" aria-hidden="true">·</span>');
}

function listRowHtml(row, index, sortKey, { isMe = false } = {}) {
  const name = esc(row.display_name || 'Voyageur');
  return `
    <li class="lb-row${isMe ? ' is-me' : ''}${index >= 0 && index < 3 ? ' is-top' : ''}">
      <span class="lb-row-rank">${rankLabel(index)}</span>
      <div class="lb-row-body">
        <span class="lb-row-name">${name}${isMe ? ' <em>(toi)</em>' : ''}</span>
        <div class="lb-row-stats">${statsLine(row, sortKey)}</div>
      </div>
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

  if (!LEADERBOARD_TABS.some((t) => t.sortKey === activeSortKey)) {
    activeSortKey = 'char_level';
  }

  el.classList.add('lb-page');
  el.innerHTML = `
    <div class="lb-page-inner">
      <header class="lb-topbar">
        <h2 class="lb-title">🏆 Classement</h2>
        <button type="button" class="btn btn-muted btn-sm lb-refresh" id="lb-refresh" title="Actualiser" aria-label="Actualiser">↻</button>
      </header>
      <div class="lb-sort-bar">
        <label class="lb-sort-label" for="lb-sort">Qui est 1er selon</label>
        <select class="auth-input lb-sort-select" id="lb-sort">
          ${LEADERBOARD_TABS.map((t) => `
            <option value="${t.sortKey}" ${t.sortKey === activeSortKey ? 'selected' : ''}>${t.label}</option>
          `).join('')}
        </select>
      </div>
      <div class="leaderboard-panel lb-panel-compact">
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
  const showSyncWarn = !sync.ok && rows.length === 0;
  const panel = el.querySelector('.leaderboard-panel');
  if (!panel) return;

  const criterion = sortLabel(activeSortKey);

  panel.innerHTML = `
    <div class="lb-you${myRank >= 0 ? '' : ' lb-you-out'}">
      <span class="lb-you-rank">${rankLabel(myRank)}</span>
      <div class="lb-you-body">
        <strong class="lb-you-name">${esc(mySnap.display_name)}</strong>
        <div class="lb-row-stats">${statsLine(mySnap, activeSortKey)}</div>
      </div>
    </div>
    ${showSyncWarn ? `<p class="auth-error lb-msg">Sync : ${esc(sync.reason || 'échec')}</p>` : ''}
    ${!result.ok ? `<p class="auth-error lb-msg">${esc(result.reason || 'Chargement impossible.')}</p>` : ''}
    ${myRank < 0 && result.ok ? `<p class="lb-msg">Hors top ${LB_LIMIT} pour « ${esc(criterion)} »</p>` : ''}
    <p class="lb-msg lb-msg-count">Top ${Math.min(LB_LIMIT, rows.length || LB_LIMIT)} · tri ${esc(criterion)}</p>
    <ol class="lb-list" aria-label="Classement">
      ${rows.length
        ? rows.map((row, i) => listRowHtml(row, i, activeSortKey, { isMe: row.user_id === auth.userId })).join('')
        : `<li class="lb-empty">${emptyHint(activeSortKey)}</li>`}
    </ol>
  `;
}
