import {
  LEADERBOARD_TABS,
  fetchLeaderboard,
  submitLeaderboardSnapshot,
  buildLeaderboardSnapshot,
} from '../systems/leaderboard.js';
import { getAuthState, getOnlineBlockReason, canUseOnlineFeatures } from '../core/auth.js';
import { showAccountRequiredModal } from './authUi.js';
import { isLeaderboardEnabled, isMaintenanceMode } from '../systems/gameConfig.js';

let activeSortKey = 'char_level';

function fmtNum(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

function medalForRank(i) {
  if (i < 0) return '—';
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return `#${i + 1}`;
}

function emptyHint(sortKey) {
  switch (sortKey) {
    case 'total_harvests': return 'Les récoltes de la saison comptent ici — récolte pour monter !';
    case 'total_discoveries': return 'Trouve des événements Kirha en récolte pour apparaître ici.';
    case 'boss_kills_total': return 'Vaincs des boss de zone pour apparaître ici.';
    case 'seasons_completed': return 'Passe une Renaissance pour être classé.';
    case 'total_earned': return 'Gagne des Kirha (vente, etc.) pour grimper.';
    case 'max_job_level': return 'Monte tes métiers pour apparaître ici.';
    default: return 'Joue un peu puis reviens — ton score se synchronise automatiquement.';
  }
}

function sortLabel(sortKey) {
  return LEADERBOARD_TABS.find((t) => t.sortKey === sortKey)?.label || 'Niveau';
}

/** Grille de stats style admin — la colonne triée est mise en avant. */
function statsGridHtml(row, sortKey) {
  const cells = [
    { key: 'char_level', label: 'Perso', value: `Nv.${row.char_level || 1}` },
    { key: 'max_job_level', label: 'Métier', value: `Nv.${row.max_job_level || 1}` },
    { key: 'season', label: 'Saison', value: `S${row.season || 1}` },
    { key: 'total_earned', label: 'Fortune', value: `${fmtNum(row.total_earned)} 💰` },
    { key: 'total_harvests', label: 'Récoltes', value: fmtNum(row.total_harvests) },
    { key: 'seasons_completed', label: 'Renais.', value: fmtNum(row.seasons_completed) },
    { key: 'boss_kills_total', label: 'Boss', value: fmtNum(row.boss_kills_total) },
    { key: 'total_discoveries', label: 'Découv.', value: fmtNum(row.total_discoveries) },
  ];
  const always = new Set(['char_level', 'max_job_level', 'season', 'total_earned']);
  if (sortKey) always.add(sortKey);
  const shown = cells.filter((c) => always.has(c.key));
  return `
    <div class="lb-stats">
      ${shown.map((c) => `
        <div class="lb-stat${c.key === sortKey ? ' lb-stat-hl' : ''}">
          <span class="lb-stat-lbl">${c.label}</span>
          <strong class="lb-stat-val">${c.value}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function playerCardHtml(row, rankIndex, sortKey, { isMe = false } = {}) {
  const rank = medalForRank(rankIndex);
  return `
    <article class="lb-card${isMe ? ' me' : ''}${rankIndex >= 0 && rankIndex < 3 ? ' podium' : ''}">
      <div class="lb-card-top">
        <span class="lb-card-rank" aria-label="Rang">${rank}</span>
        <div class="lb-card-identity">
          <strong class="lb-card-name">${row.display_name || 'Voyageur'}${isMe ? ' · toi' : ''}</strong>
          <span class="lb-card-sort-hint">Tri : ${sortLabel(sortKey)}</span>
        </div>
      </div>
      ${statsGridHtml(row, sortKey)}
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

  el.innerHTML = `
    <div class="view-header">
      <h2>🏆 Classement</h2>
      <p class="view-desc">Compare-toi aux autres voyageurs — mêmes infos que le panneau staff, en version joueur.</p>
    </div>
    <div class="panel-inner leaderboard-panel">
      <p class="lb-loading">Chargement…</p>
    </div>
  `;

  const sync = await submitLeaderboardSnapshot(game.state, game.getCharacterDisplayName());
  const result = await fetchLeaderboard(activeSortKey, 50, game.state);
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

  panel.innerHTML = `
    <div class="lb-toolbar">
      <label class="lb-sort-label" for="lb-sort">Classer par</label>
      <select class="auth-input lb-sort-select" id="lb-sort">
        ${LEADERBOARD_TABS.map((t) => `
          <option value="${t.sortKey}" ${t.sortKey === activeSortKey ? 'selected' : ''}>${t.label}</option>
        `).join('')}
      </select>
      <button type="button" class="btn btn-muted btn-sm" id="lb-refresh">Actualiser</button>
    </div>

    <section class="lb-you-section" aria-label="Ton rang">
      <h3 class="lb-section-title">Toi</h3>
      ${playerCardHtml(mySnap, myRank >= 0 ? myRank : -1, activeSortKey, { isMe: true })}
      ${myRank < 0 ? '<p class="view-desc lb-not-ranked">Pas encore dans le top 50 pour ce critère — continue à jouer puis Actualiser.</p>' : ''}
    </section>

    ${showSyncWarn ? `<p class="auth-error">Sync : ${sync.reason || 'échec'} — joue un peu puis Actualiser.</p>` : ''}
    ${!result.ok ? `<p class="auth-error">${result.reason || 'Impossible de charger le classement.'}</p>` : ''}
    ${result.devLocal ? '<p class="view-desc">Mode local — classement solo.</p>' : ''}

    <section class="lb-top-section" aria-label="Top joueurs">
      <h3 class="lb-section-title">Top ${Math.min(50, rows.length || 50)} · ${sortLabel(activeSortKey)}</h3>
      <div class="lb-card-list">
        ${rows.length
          ? rows.map((row, i) => playerCardHtml(row, i, activeSortKey, { isMe: row.user_id === auth.userId })).join('')
          : `<p class="leaderboard-empty">${emptyHint(activeSortKey)}</p>`}
      </div>
    </section>
  `;

  panel.querySelector('#lb-sort')?.addEventListener('change', (e) => {
    activeSortKey = e.target.value || 'char_level';
    renderLeaderboard(game, el);
  });
  panel.querySelector('#lb-refresh')?.addEventListener('click', () => renderLeaderboard(game, el));
}
