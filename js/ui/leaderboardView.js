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

function initial(name) {
  const s = String(name || '?').trim();
  return (s.charAt(0) || '?').toUpperCase();
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
    case 'total_earned': return `${fmtNum(row.total_earned)} 💰`;
    case 'seasons_completed': return `${fmtNum(row.seasons_completed)} ren.`;
    case 'total_harvests': return `${fmtNum(row.total_harvests)}`;
    case 'total_discoveries': return `${fmtNum(row.total_discoveries)}`;
    case 'boss_kills_total': return `${fmtNum(row.boss_kills_total)}`;
    default: return `Nv.${row.char_level || 1}`;
  }
}

function metaLine(row) {
  return `Perso Nv.${row.char_level || 1} · Métier Nv.${row.max_job_level || 1} · S${row.season || 1}`;
}

function medal(i) {
  if (i < 0) return '—';
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return String(i + 1);
}

function playerRow(row, rankIndex, sortKey, { isMe = false, featured = false } = {}) {
  const name = row.display_name || 'Voyageur';
  const rankCls = rankIndex >= 0 && rankIndex <= 2 ? ` lb-rank-${rankIndex}` : '';
  return `
    <article class="lb-card${isMe ? ' lb-card-me' : ''}${featured ? ' lb-card-feat' : ''}${rankCls}">
      <div class="lb-card-rank" aria-label="Rang">${medal(rankIndex)}</div>
      <div class="lb-card-avatar" aria-hidden="true">${esc(initial(name))}</div>
      <div class="lb-card-info">
        <div class="lb-card-name">${esc(name)}${isMe ? '<span class="lb-badge-me">toi</span>' : ''}</div>
        <div class="lb-card-meta">${esc(metaLine(row))}</div>
      </div>
      <div class="lb-card-score">
        <span class="lb-card-score-val">${esc(primaryScore(sortKey, row))}</span>
      </div>
    </article>
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
    <div class="lb-wrap">
      <header class="lb-top">
        <div class="lb-top-left">
          <h2 class="lb-title">Classement</h2>
          <p class="lb-subtitle">Qui mène selon <strong>${esc(meta.label)}</strong></p>
        </div>
        <button type="button" class="lb-icon-btn" id="lb-refresh" aria-label="Actualiser" title="Actualiser">↻</button>
      </header>

      <label class="lb-select-wrap">
        <span class="lb-select-lbl">Critère</span>
        <select class="lb-select" id="lb-sort">
          ${LEADERBOARD_TABS.map((t) => `
            <option value="${t.sortKey}" ${t.sortKey === activeSortKey ? 'selected' : ''}>${t.label}</option>
          `).join('')}
        </select>
      </label>

      <div class="lb-main" id="lb-main">
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
  const main = el.querySelector('#lb-main');
  if (!main) return;

  const top = rows.slice(0, 3);
  const rest = rows.slice(3);

  const errors = [];
  if (!sync.ok && rows.length === 0) errors.push(`Sync : ${sync.reason || 'échec'}`);
  if (!result.ok) errors.push(result.reason || 'Chargement impossible.');

  main.innerHTML = `
    <section class="lb-me" aria-label="Ton rang">
      ${playerRow(mySnap, myRank, activeSortKey, { isMe: true })}
      ${myRank < 0 && result.ok
        ? `<p class="lb-note">Pas encore dans le top ${LB_LIMIT}.</p>`
        : myRank >= 0
          ? `<p class="lb-note">Tu es <strong>#${myRank + 1}</strong> sur ${rows.length}.</p>`
          : ''}
    </section>

    ${errors.map((m) => `<p class="auth-error lb-note">${esc(m)}</p>`).join('')}

    ${top.length ? `
      <section class="lb-podium" aria-label="Podium">
        <h3 class="lb-section-lbl">Podium</h3>
        <div class="lb-podium-list">
          ${top.map((row, i) => playerRow(row, i, activeSortKey, {
            featured: true,
            isMe: row.user_id === auth.userId,
          })).join('')}
        </div>
      </section>
    ` : ''}

    <section class="lb-rest" aria-label="Suite du classement">
      <h3 class="lb-section-lbl">${rest.length ? `Suite · ${rest.length} joueurs` : (rows.length ? '' : 'Classement')}</h3>
      <div class="lb-list">
        ${rest.length
          ? rest.map((row, i) => playerRow(row, i + 3, activeSortKey, {
              isMe: row.user_id === auth.userId,
            })).join('')
          : (!rows.length ? `<p class="lb-empty">${emptyHint(activeSortKey)}</p>` : '')}
      </div>
    </section>
  `;
}
