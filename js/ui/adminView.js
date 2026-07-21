/**
 * Panneau d'administration To-Kirha — in-game pour staff (mod / admin / superadmin).
 */

import { navigate } from './router.js';
import { on } from '../core/events.js';
import {
  getProfileRole,
  getAuthState,
  isAdmin,
  isSuperAdmin,
  refreshProfile,
  canSeeAdminPanel,
} from '../core/auth.js';
import {
  ADMIN_TABS,
  ROLE_LABELS,
  REPORT_STATUS_LABELS,
  PLAYER_FILTER_LABELS,
  LOG_ACTION_LABELS,
  ANN_KIND_LABELS,
  canAccessAdminTab,
  getVisibleAdminTabs,
  fetchDashboard,
  searchPlayers,
  fetchPlayerList,
  getPlayerDetail,
  banUser,
  unbanUser,
  setUserRole,
  grantAllJobsLevel,
  flagCheat,
  deleteLeaderboardEntry,
  wipeAllLeaderboard,
  rebuildLeaderboardFromSaves,
  resetCloudSave,
  fetchModerationLogs,
  fetchReports,
  reviewReport,
  fetchAnnouncementsAdmin,
  createAnnouncement,
  toggleAnnouncement,
  fetchAdminConfig,
  setAdminConfig,
  fetchLeaderboardAdmin,
  fetchCloudSaves,
  submitPlayerReport,
  claimOwnerSuperadmin,
} from '../systems/admin.js';
import { refreshGameConfig, isReportingEnabled } from '../systems/gameConfig.js';
import { getSupabaseClient, isSupabaseConfigured } from '../core/supabaseClient.js';
import { formatPlayDuration } from '../systems/playtime.js';

let gameRef = null;
let activeTab = 'dashboard';
let selectedPlayerId = null;
let statusMsg = '';
let panelBodyEl = null;
let playerSheetEl = null;

on('navigate', (viewId) => {
  if (viewId !== 'admin') closePlayerSheet();
});

function closePlayerSheet() {
  playerSheetEl?.remove();
  playerSheetEl = null;
  document.body.classList.remove('admin-sheet-open');
}

function getOrCreatePlayerSheet() {
  if (playerSheetEl?.isConnected) return playerSheetEl;
  closePlayerSheet();
  const overlay = document.createElement('div');
  overlay.className = 'admin-player-sheet-overlay';
  overlay.innerHTML = `
    <div class="admin-player-sheet" role="dialog" aria-modal="true" aria-label="Fiche joueur">
      <div class="admin-player-sheet-header">
        <button type="button" class="btn btn-muted btn-sm admin-sheet-back" aria-label="Fermer">← Retour</button>
        <h3 class="admin-player-sheet-title">Fiche joueur</h3>
      </div>
      <div class="admin-player-sheet-body" id="admin-player-sheet-body">
        <p class="admin-loading">Chargement…</p>
      </div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePlayerSheet();
  });
  overlay.querySelector('.admin-sheet-back')?.addEventListener('click', () => closePlayerSheet());
  document.body.appendChild(overlay);
  document.body.classList.add('admin-sheet-open');
  playerSheetEl = overlay;
  return overlay;
}

function toolbarHtml(extra = '') {
  return `
    <div class="admin-toolbar">
      ${extra}
      <button type="button" class="btn btn-muted btn-sm admin-refresh-btn" title="Actualiser">↻ Actualiser</button>
    </div>
  `;
}

function bindRefresh(container, fn) {
  container.querySelector('.admin-refresh-btn')?.addEventListener('click', fn);
}

function bindPlayerTable(container) {
  container.querySelectorAll('.admin-view-player').forEach((btn) => {
    btn.addEventListener('click', () => loadPlayerDetail(btn.dataset.uid));
  });
}

function goToTab(tabId, userId = null) {
  if (tabId !== 'players') closePlayerSheet();
  activeTab = tabId;
  if (userId) selectedPlayerId = userId;
  const tabsEl = panelBodyEl?.parentElement?.previousElementSibling;
  tabsEl?.querySelectorAll('.admin-tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  if (panelBodyEl) renderAdminPanel(panelBodyEl);
}

function showAdminModal({ title, bodyHtml, okLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';
    overlay.innerHTML = `
      <div class="admin-modal" role="dialog" aria-modal="true">
        <h4 class="admin-modal-title">${title}</h4>
        <div class="admin-modal-body">${bodyHtml}</div>
        <div class="admin-modal-actions">
          <button type="button" class="btn btn-muted" data-act="cancel">${cancelLabel}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-craft'}" data-act="ok">${okLabel}</button>
        </div>
      </div>
    `;
    const close = (val) => {
      overlay.remove();
      resolve(val);
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    overlay.querySelector('[data-act="cancel"]')?.addEventListener('click', () => close(null));
    overlay.querySelector('[data-act="ok"]')?.addEventListener('click', () => {
      const fields = {};
      overlay.querySelectorAll('[data-field]').forEach((el) => {
        fields[el.dataset.field] = el.type === 'checkbox' ? el.checked : el.value;
      });
      close(fields);
    });
    document.body.appendChild(overlay);
    overlay.querySelector('input, textarea, select')?.focus();
  });
}

async function promptBanReason() {
  const fields = await showAdminModal({
    title: 'Bannir le joueur',
    danger: true,
    okLabel: 'Bannir',
    bodyHtml: `
      <label class="admin-modal-label">Raison (obligatoire)
        <input type="text" class="auth-input" data-field="reason" maxlength="500" placeholder="Triche, insultes…" />
      </label>
    `,
  });
  const reason = fields?.reason?.trim();
  return reason || null;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

/** Dates ISO, epoch ms (number / string numérique), ou Date. */
function fmtDate(value) {
  if (value == null || value === '') return '—';
  try {
    let d;
    if (value instanceof Date) {
      d = value;
    } else if (typeof value === 'number') {
      d = new Date(value < 1e12 ? value * 1000 : value);
    } else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      const n = Number(value);
      d = new Date(n < 1e12 ? n * 1000 : n);
    } else {
      d = new Date(value);
    }
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

/** Relatif court : « il y a 2 h », sinon date courte. */
function fmtLastSeen(rowOrTs) {
  const raw = rowOrTs && typeof rowOrTs === 'object'
    ? (rowOrTs.last_online ?? rowOrTs.save_updated_at ?? rowOrTs.created_at)
    : rowOrTs;
  if (raw == null || raw === '') return '—';
  let ms;
  if (typeof raw === 'number') {
    ms = raw < 1e12 ? raw * 1000 : raw;
  } else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    const n = Number(raw);
    ms = n < 1e12 ? n * 1000 : n;
  } else {
    ms = new Date(raw).getTime();
  }
  if (!Number.isFinite(ms) || Number.isNaN(ms)) return '—';
  const diff = Date.now() - ms;
  if (diff < 0) return fmtDate(ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 14) return `il y a ${days} j`;
  return fmtDate(ms);
}

function setStatus(msg, isError = false) {
  statusMsg = msg;
  const el = document.getElementById('admin-status');
  if (el) {
    el.textContent = msg;
    el.className = isError ? 'admin-status error' : 'admin-status ok';
  }
}

function roleBadge(role) {
  const cls = role === 'superadmin' ? 'super' : role === 'admin' ? 'admin' : role === 'moderator' ? 'mod' : '';
  return `<span class="admin-badge ${cls}">${ROLE_LABELS[role] || role}</span>`;
}

function playerStatusChip(r) {
  if (r.is_banned) return '<span class="admin-chip-status banned">Banni</span>';
  if (r.cheat_flagged) return '<span class="admin-chip-status flagged">Flag</span>';
  return '<span class="admin-chip-status ok">OK</span>';
}

function playerTableHtml(rows) {
  if (!rows.length) return '<p class="view-desc">Aucun joueur.</p>';
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Pseudo</th>
            <th>Rôle</th>
            <th>Nv.</th>
            <th>Dernière connexion</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows.map((r) => `
          <tr class="${r.is_banned ? 'row-banned' : ''}${r.cheat_flagged ? ' row-flagged' : ''}">
            <td class="admin-td-name">${r.display_name || '?'}</td>
            <td>${roleBadge(r.role)}</td>
            <td>${r.char_level || 1}</td>
            <td class="admin-td-muted" title="${fmtDate(r.last_online || r.save_updated_at)}">${fmtLastSeen(r)}</td>
            <td>${playerStatusChip(r)}</td>
            <td><button type="button" class="btn btn-muted btn-sm admin-view-player" data-uid="${r.user_id}">Fiche</button></td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
}

async function renderDashboard(container) {
  container.innerHTML = '<p class="admin-loading">Chargement…</p>';
  const res = await fetchDashboard();
  if (!res.ok) {
    container.innerHTML = `<p class="admin-error">${res.reason}</p>`;
    return;
  }
  const d = res.data || {};
  const cfg = d.config || {};
  const maintenance = cfg.maintenance_mode === true || cfg.maintenance_mode === 'true';
  const pending = d.pending_reports || [];
  const recentLogs = d.recent_logs || [];
  const recentPlayers = d.recent_players || [];

  container.innerHTML = `
    ${toolbarHtml()}
    ${maintenance ? '<div class="admin-alert warn">Mode maintenance actif — online limité pour les joueurs.</div>' : ''}
    ${d.reports_pending > 0 ? `<div class="admin-alert info">${d.reports_pending} signalement(s) en attente — <button type="button" class="btn-link admin-goto-tab" data-tab="reports">Traiter</button></div>` : ''}
    <div class="admin-stat-grid admin-stat-grid-primary">
      <div class="admin-stat"><span class="admin-stat-val">${fmtNum(d.players_total)}</span><span class="admin-stat-lbl">Joueurs</span></div>
      <div class="admin-stat accent"><span class="admin-stat-val">+${fmtNum(d.players_new_24h)}</span><span class="admin-stat-lbl">Nouveaux 24 h</span></div>
      <div class="admin-stat"><span class="admin-stat-val">${fmtNum(d.reports_pending)}</span><span class="admin-stat-lbl">Signalements</span></div>
      <div class="admin-stat warn"><span class="admin-stat-val">${fmtNum(d.players_banned)}</span><span class="admin-stat-lbl">Bannis</span></div>
      <div class="admin-stat warn"><span class="admin-stat-val">${fmtNum(d.players_flagged)}</span><span class="admin-stat-lbl">Flags</span></div>
    </div>
    <p class="admin-meta-line">Classement ${fmtNum(d.leaderboard_entries)} · Saves ${fmtNum(d.saves_total)} · Staff ${fmtNum(d.staff_count)} · Annonces ${fmtNum(d.announcements_active)}</p>
    <div class="admin-dash-cols">
      <section class="admin-dash-section">
        <h4 class="admin-section-title">Signalements</h4>
        ${pending.length ? pending.map((r) => `
          <div class="admin-mini-row">
            <div class="admin-mini-text">
              <strong>${r.reported_name || '?'}</strong>
              <span class="admin-td-muted">${(r.reason || '').slice(0, 70) || '—'}</span>
            </div>
            <button type="button" class="btn btn-muted btn-sm admin-goto-player" data-uid="${r.reported_user_id}">Fiche</button>
          </div>
        `).join('') : '<p class="view-desc">Rien en attente.</p>'}
      </section>
      <section class="admin-dash-section">
        <h4 class="admin-section-title">Inscriptions récentes</h4>
        ${recentPlayers.length ? recentPlayers.map((p) => `
          <div class="admin-mini-row">
            <div class="admin-mini-text">
              <strong>${p.display_name}</strong>
              <span class="admin-td-muted">${fmtDate(p.created_at)} · ${ROLE_LABELS[p.role] || p.role}</span>
            </div>
            <button type="button" class="btn btn-muted btn-sm admin-goto-player" data-uid="${p.user_id}">Fiche</button>
          </div>
        `).join('') : '<p class="view-desc">Aucun joueur.</p>'}
      </section>
      <section class="admin-dash-section admin-dash-wide">
        <h4 class="admin-section-title">Dernières actions staff</h4>
        ${recentLogs.length ? `
          <div class="admin-table-wrap">
            <table class="admin-table admin-table-compact">
              <thead><tr><th>Quand</th><th>Qui</th><th>Action</th><th>Cible</th></tr></thead>
              <tbody>${recentLogs.map((l) => `
                <tr>
                  <td class="admin-td-muted">${fmtLastSeen(l.created_at)}</td>
                  <td>${l.actor_name || '—'}</td>
                  <td>${LOG_ACTION_LABELS[l.action] || l.action}</td>
                  <td>${l.target_name || '—'}</td>
                </tr>
              `).join('')}</tbody>
            </table>
          </div>
        ` : '<p class="view-desc">Aucune action récente.</p>'}
      </section>
    </div>
  `;

  bindRefresh(container, () => renderDashboard(container));
  container.querySelectorAll('.admin-goto-tab').forEach((btn) => {
    btn.addEventListener('click', () => goToTab(btn.dataset.tab));
  });
  container.querySelectorAll('.admin-goto-player').forEach((btn) => {
    btn.addEventListener('click', () => goToTab('players', btn.dataset.uid));
  });
}

async function renderPlayers(container) {
  const filter = container.dataset.filter || 'recent';
  container.innerHTML = `
    ${toolbarHtml(`
      <div class="admin-filter-chips">
        ${Object.entries(PLAYER_FILTER_LABELS).map(([id, label]) => `
          <button type="button" class="admin-chip${filter === id ? ' active' : ''}" data-filter="${id}">${label}</button>
        `).join('')}
      </div>
      <input type="search" class="auth-input admin-search" id="admin-player-search" placeholder="Recherche pseudo / UUID…" minlength="2" />
      <button type="button" class="btn btn-craft" id="admin-player-search-btn">Rechercher</button>
    `)}
    <div id="admin-players-results"><p class="admin-loading">Chargement…</p></div>
  `;
  const resultsEl = container.querySelector('#admin-players-results');

  async function loadList(f) {
    resultsEl.innerHTML = '<p class="admin-loading">Chargement…</p>';
    const res = await fetchPlayerList(f);
    if (!res.ok) {
      resultsEl.innerHTML = `<p class="admin-error">${res.reason}</p>`;
      return;
    }
    resultsEl.innerHTML = playerTableHtml(res.data || []);
    bindPlayerTable(resultsEl);
  }

  async function doSearch() {
    const q = container.querySelector('#admin-player-search')?.value?.trim();
    if (!q || q.length < 2) {
      setStatus('Entre au moins 2 caractères.', true);
      return;
    }
    resultsEl.innerHTML = '<p class="admin-loading">Recherche…</p>';
    const res = await searchPlayers(q);
    if (!res.ok) {
      resultsEl.innerHTML = `<p class="admin-error">${res.reason}</p>`;
      return;
    }
    resultsEl.innerHTML = playerTableHtml(res.data || []);
    bindPlayerTable(resultsEl);
  }

  container.querySelectorAll('.admin-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      container.dataset.filter = chip.dataset.filter;
      renderPlayers(container);
    });
  });

  container.querySelector('#admin-player-search-btn')?.addEventListener('click', doSearch);
  container.querySelector('#admin-player-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });
  bindRefresh(container, () => renderPlayers(container));

  await loadList(filter);
  if (selectedPlayerId) {
    const uid = selectedPlayerId;
    selectedPlayerId = null;
    loadPlayerDetail(uid);
  }
}

async function loadPlayerDetail(userId) {
  selectedPlayerId = userId;
  const sheet = getOrCreatePlayerSheet();
  const detailEl = sheet.querySelector('#admin-player-sheet-body');
  const titleEl = sheet.querySelector('.admin-player-sheet-title');
  if (titleEl) titleEl.textContent = 'Fiche joueur';
  detailEl.innerHTML = '<p class="admin-loading">Chargement fiche…</p>';
  try {
    const res = await getPlayerDetail(userId);
    if (!res.ok) {
      detailEl.innerHTML = `<p class="admin-error">${res.reason || 'Erreur RPC'}</p>`;
      return;
    }
    paintPlayerDetail(userId, res.data, detailEl, titleEl);
  } catch (err) {
    console.warn('[admin] player detail failed', err);
    detailEl.innerHTML = `<p class="admin-error">Impossible d’afficher la fiche (${err?.message || 'erreur'}). La save cloud est peut‑être incomplète après une nouvelle saison.</p>
      <button type="button" class="btn btn-muted" id="admin-detail-retry">Réessayer</button>`;
    detailEl.querySelector('#admin-detail-retry')?.addEventListener('click', () => loadPlayerDetail(userId));
  }
}

function paintPlayerDetail(userId, data, detailEl, titleEl) {
  const { profile, leaderboard, save_summary, reports_against, reports_by, name_history, inventory_summary, jobs_summary, combat_items } = data || {};
  if (!profile) {
    detailEl.innerHTML = '<p class="admin-error">Profil manquant dans la réponse serveur.</p>';
    return;
  }
  const canSetRole = isSuperAdmin();
  const canResetSave = isAdmin();
  const canGrantJobs = isAdmin();

  if (titleEl) titleEl.textContent = profile.display_name || 'Fiche joueur';

  const jobsHtml = jobs_summary && typeof jobs_summary === 'object' && Object.keys(jobs_summary).length
    ? Object.entries(jobs_summary).map(([id, lv]) => `<span class="admin-tag">${id} Nv.${lv}</span>`).join(' ')
    : '—';

  const invHtml = Array.isArray(inventory_summary) && inventory_summary.length
    ? inventory_summary.map((r) => `<span class="admin-tag">${r?.id || '?'} ×${r?.qty ?? 0}</span>`).join(' ')
    : '—';

  const combatHtml = Array.isArray(combat_items) && combat_items.length
    ? combat_items.map((c) => `<span class="admin-tag">${c?.item_id || c?.ref || '?'} ${c?.rarity || ''}</span>`).join(' ')
    : '—';

  const careerLabel = (() => {
    if (!save_summary?.career_confirmed) return 'Non choisie';
    const weapon = save_summary.career_weapon || save_summary.career_harvest;
    const team = save_summary.career_team || save_summary.career_farm;
    if (weapon || team) return `${weapon || '?'} / ${team || '?'}`;
    return 'Confirmée';
  })();

  detailEl.innerHTML = `
    <div class="admin-detail-head">
      <div>
        <h4 class="admin-detail-title">${profile.display_name} ${roleBadge(profile.role)}</h4>
        <p class="admin-detail-id">
          <code id="admin-copy-uuid">${profile.user_id}</code>
          <button type="button" class="btn btn-muted btn-sm" id="admin-copy-btn">Copier</button>
        </p>
      </div>
      <div class="admin-last-seen-card" title="${fmtDate(save_summary?.last_online || save_summary?.save_updated_at)}">
        <span class="admin-last-seen-lbl">Dernière connexion</span>
        <span class="admin-last-seen-val">${save_summary ? fmtLastSeen(save_summary) : 'Jamais (pas de save)'}</span>
        <span class="admin-td-muted">${save_summary?.last_online ? fmtDate(save_summary.last_online) : (save_summary ? 'via save cloud' : '—')}</span>
      </div>
    </div>
    <p class="admin-meta-line">Inscrit le ${fmtDate(profile.created_at)}${profile.email ? ` · ${profile.email}` : ''}</p>
    ${profile.is_banned ? `<p class="guest-banner warn">Banni · ${profile.banned_reason || '—'} · ${fmtDate(profile.banned_at)}</p>` : ''}
    ${profile.cheat_flagged ? `<p class="guest-banner warn">Flag triche · ${profile.cheat_notes || '—'}</p>` : ''}
    <div class="admin-detail-grid">
      <div class="admin-info-card"><span class="admin-info-lbl">Classement</span><span class="admin-info-val">${leaderboard ? `Nv.${leaderboard.char_level} · S${leaderboard.season}` : '—'}</span><span class="admin-td-muted">${leaderboard ? `${fmtNum(leaderboard.total_earned)} 💰 gagnés · ${fmtNum(leaderboard.kirha_current || 0)} en poche` : ''}</span></div>
      <div class="admin-info-card"><span class="admin-info-lbl">Save cloud</span><span class="admin-info-val">${save_summary ? `${save_summary.nickname || '?'} · Nv.${save_summary.char_level}` : 'Aucune'}</span><span class="admin-td-muted">${save_summary ? `S${save_summary.season} · ${fmtNum(save_summary.kirha)} 💰` : ''}</span></div>
      <div class="admin-info-card"><span class="admin-info-lbl">Carrière</span><span class="admin-info-val">${careerLabel}</span></div>
      <div class="admin-info-card"><span class="admin-info-lbl">Signalements</span><span class="admin-info-val">${reports_against ?? 0} reçus · ${reports_by || 0} envoyés</span></div>
      <div class="admin-info-card"><span class="admin-info-lbl">Renommage</span><span class="admin-info-val">${profile.free_rename_used ? 'Utilisé' : 'Disponible'}</span></div>
      <div class="admin-info-card admin-info-card-wide">
        <span class="admin-info-lbl">Temps de jeu</span>
        <span class="admin-info-val">${(() => {
          const fg = Number(save_summary?.playtime_foreground_ms) || 0;
          const bg = Number(save_summary?.playtime_background_ms) || 0;
          if (!save_summary || (fg <= 0 && bg <= 0)) return 'Pas encore mesuré';
          const total = fg + bg;
          return `${formatPlayDuration(total)} au total`;
        })()}</span>
        <span class="admin-td-muted">${(() => {
          const fg = Number(save_summary?.playtime_foreground_ms) || 0;
          const bg = Number(save_summary?.playtime_background_ms) || 0;
          if (!save_summary || (fg <= 0 && bg <= 0)) return 'Compteur depuis la maj Admin';
          return `Premier plan ${formatPlayDuration(fg)} · Arrière-plan ${formatPlayDuration(bg)}`;
        })()}</span>
      </div>
    </div>
    <details class="admin-fold" open>
      <summary>Métiers & inventaire</summary>
      <h5 class="admin-section-title">Métiers</h5>
      <div class="admin-inventory-wrap">${jobsHtml}</div>
      <h5 class="admin-section-title">Ressources (top 30)</h5>
      <div class="admin-inventory-wrap">${invHtml}</div>
      <h5 class="admin-section-title">Équipement combat (${Array.isArray(combat_items) ? combat_items.length : 0})</h5>
      <div class="admin-inventory-wrap">${combatHtml}</div>
    </details>
    ${Array.isArray(name_history) && name_history.length ? `
      <details class="admin-fold">
        <summary>Historique pseudo (${name_history.length})</summary>
        <div class="admin-table-wrap">
          <table class="admin-table admin-table-compact">
            <thead><tr><th>Date</th><th>Ancien</th><th>Nouveau</th><th>Type</th></tr></thead>
            <tbody>${name_history.map((h) => `
              <tr>
                <td>${fmtDate(h.created_at)}</td>
                <td>${h.old_name}</td>
                <td>${h.new_name}</td>
                <td>${h.change_type}</td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>
      </details>
    ` : ''}
    <div class="admin-actions-block">
      <h5 class="admin-section-title">Modération</h5>
      <div class="admin-actions">
        ${profile.is_banned
          ? `<button type="button" class="btn btn-craft" id="admin-unban">Débannir</button>`
          : `<button type="button" class="btn btn-danger" id="admin-ban">Bannir</button>`}
        <button type="button" class="btn btn-muted" id="admin-flag">${profile.cheat_flagged ? 'Retirer flag' : 'Flag triche'}</button>
      </div>
    </div>
    <div class="admin-actions-block">
      <h5 class="admin-section-title">Données</h5>
      <div class="admin-actions">
        <button type="button" class="btn btn-muted" id="admin-del-lb">Retirer classement</button>
        ${canResetSave ? '<button type="button" class="btn btn-muted" id="admin-reset-save">Reset save cloud</button>' : ''}
        ${canGrantJobs ? '<button type="button" class="btn btn-muted" id="admin-grant-jobs">+1 métiers + ferme + perso</button>' : ''}
        ${canGrantJobs ? '<button type="button" class="btn btn-muted" id="admin-grant-jobs-5">+5 métiers + ferme + perso</button>' : ''}
        ${canGrantJobs ? '<p class="view-desc admin-grant-hint">Le joueur doit <strong>recharger le jeu</strong> (ou se reconnecter) pour voir les niveaux. Ne pas jouer en parallèle sinon sa save locale écrase le gift.</p>' : ''}
      </div>
    </div>
    ${canSetRole ? `
      <div class="admin-actions-block">
        <h5 class="admin-section-title">Rôle staff</h5>
        <div class="admin-actions admin-actions-role">
          <select class="auth-input admin-role-select" id="admin-role-select">
            ${['player', 'moderator', 'admin', 'superadmin'].map((r) => `
              <option value="${r}" ${profile.role === r ? 'selected' : ''}>${ROLE_LABELS[r]}</option>
            `).join('')}
          </select>
          <button type="button" class="btn btn-craft" id="admin-set-role">Appliquer</button>
        </div>
      </div>
    ` : ''}
  `;

  bindPlayerDetailActions(userId, profile, detailEl);
}

function bindPlayerDetailActions(userId, profile, detailEl) {
  detailEl.querySelector('#admin-copy-btn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(profile.user_id);
      setStatus('UUID copié.');
    } catch {
      setStatus('Copie impossible.', true);
    }
  });

  detailEl.querySelector('#admin-ban')?.addEventListener('click', async () => {
    const reason = await promptBanReason();
    if (!reason) return;
    const r = await banUser(userId, reason);
    setStatus(r.ok ? 'Joueur banni.' : r.reason, !r.ok);
    if (r.ok) loadPlayerDetail(userId);
  });

  detailEl.querySelector('#admin-unban')?.addEventListener('click', async () => {
    if (!confirm('Débannir ce joueur ?')) return;
    const r = await unbanUser(userId, 'Déban manuel');
    setStatus(r.ok ? 'Joueur débanni.' : r.reason, !r.ok);
    if (r.ok) loadPlayerDetail(userId);
  });

  detailEl.querySelector('#admin-flag')?.addEventListener('click', async () => {
    const notes = profile.cheat_flagged ? null : prompt('Notes triche (optionnel) :');
    const r = await flagCheat(userId, !profile.cheat_flagged, notes);
    setStatus(r.ok ? 'Flag mis à jour.' : r.reason, !r.ok);
    if (r.ok) loadPlayerDetail(userId);
  });

  detailEl.querySelector('#admin-del-lb')?.addEventListener('click', async () => {
    if (!confirm('Retirer du classement ?')) return;
    const r = await deleteLeaderboardEntry(userId);
    setStatus(r.ok ? 'Entrée supprimée.' : r.reason, !r.ok);
    if (r.ok) loadPlayerDetail(userId);
  });

  detailEl.querySelector('#admin-reset-save')?.addEventListener('click', async () => {
    if (!confirm('Supprimer la save cloud ? Irréversible.')) return;
    const r = await resetCloudSave(userId);
    setStatus(r.ok ? 'Save cloud supprimée.' : r.reason, !r.ok);
    if (r.ok) loadPlayerDetail(userId);
  });

  detailEl.querySelector('#admin-grant-jobs')?.addEventListener('click', async () => {
    if (!confirm('Ajouter +1 niveau (métiers + bâtiments ferme + perso) sur la save cloud ?\nLe joueur doit recharger après.')) return;
    const r = await grantAllJobsLevel(userId);
    setStatus(r.ok ? 'Niveaux +1 appliqués (cloud). Demande au joueur de recharger.' : r.reason, !r.ok);
    if (r.ok) loadPlayerDetail(userId);
  });

  detailEl.querySelector('#admin-grant-jobs-5')?.addEventListener('click', async () => {
    if (!confirm('Ajouter +5 niveaux (5× +1 métiers/ferme/perso) ?\nLe joueur doit recharger après.')) return;
    let ok = true;
    let lastReason = '';
    for (let i = 0; i < 5; i++) {
      const r = await grantAllJobsLevel(userId);
      if (!r.ok) {
        ok = false;
        lastReason = r.reason;
        break;
      }
    }
    setStatus(ok ? 'Niveaux +5 appliqués (cloud). Demande au joueur de recharger.' : lastReason, !ok);
    if (ok) loadPlayerDetail(userId);
  });

  detailEl.querySelector('#admin-set-role')?.addEventListener('click', async () => {
    const role = detailEl.querySelector('#admin-role-select')?.value;
    if (!role || !confirm(`Passer ce joueur en ${ROLE_LABELS[role]} ?`)) return;
    const r = await setUserRole(userId, role);
    setStatus(r.ok ? 'Rôle mis à jour.' : r.reason, !r.ok);
    if (r.ok) {
      await refreshProfile();
      loadPlayerDetail(userId);
    }
  });
}

async function renderReports(container) {
  container.innerHTML = '<p class="admin-loading">Chargement…</p>';
  const status = container.dataset.filter || 'pending';
  const res = await fetchReports(status);
  if (!res.ok) {
    container.innerHTML = `<p class="admin-error">${res.reason}</p>`;
    return;
  }
  const rows = res.data || [];
  container.innerHTML = `
    ${toolbarHtml(`
      <select class="auth-input" id="admin-reports-filter">
        <option value="pending" ${status === 'pending' ? 'selected' : ''}>En attente</option>
        <option value="actioned" ${status === 'actioned' ? 'selected' : ''}>Action prise</option>
        <option value="dismissed" ${status === 'dismissed' ? 'selected' : ''}>Rejetés</option>
        <option value="all" ${status === 'all' ? 'selected' : ''}>Tous</option>
      </select>
    `)}
    ${rows.length ? rows.map((r) => `
      <div class="admin-report-card">
        <div class="admin-report-head">
          <strong>${r.reported_name || '?'}</strong> signalé par ${r.reporter_name || '?'}
          <span class="admin-report-date">${fmtDate(r.created_at)}</span>
        </div>
        <p><strong>${r.reason}</strong></p>
        ${r.details ? `<p class="view-desc">${r.details}</p>` : ''}
        ${r.review_note ? `<p class="view-desc">Note mod : ${r.review_note}</p>` : ''}
        <p class="admin-report-status">${REPORT_STATUS_LABELS[r.status] || r.status}</p>
        ${r.status === 'pending' ? `
          <div class="admin-actions">
            <button type="button" class="btn btn-danger btn-sm admin-report-ban" data-uid="${r.reported_user_id}">Bannir</button>
            <button type="button" class="btn btn-muted btn-sm admin-report-flag" data-uid="${r.reported_user_id}">Flag triche</button>
            <button type="button" class="btn btn-craft btn-sm admin-report-action" data-id="${r.id}" data-action="actioned">Action prise</button>
            <button type="button" class="btn btn-muted btn-sm admin-report-action" data-id="${r.id}" data-action="dismissed">Rejeter</button>
            <button type="button" class="btn btn-muted btn-sm admin-view-reported" data-uid="${r.reported_user_id}">Voir joueur</button>
          </div>
        ` : ''}
      </div>
    `).join('') : '<p class="view-desc">Aucun signalement.</p>'}
  `;

  bindRefresh(container, () => renderReports(container));

  container.querySelector('#admin-reports-filter')?.addEventListener('change', (e) => {
    container.dataset.filter = e.target.value;
    renderReports(container);
  });

  container.querySelectorAll('.admin-report-action').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const fields = await showAdminModal({
        title: btn.dataset.action === 'dismissed' ? 'Rejeter le signalement' : 'Marquer comme traité',
        bodyHtml: '<label class="admin-modal-label">Note (optionnel)<textarea class="auth-input admin-textarea" data-field="note" rows="2"></textarea></label>',
      });
      if (!fields) return;
      const r = await reviewReport(btn.dataset.id, btn.dataset.action, fields.note?.trim() || null);
      setStatus(r.ok ? 'Signalement traité.' : r.reason, !r.ok);
      if (r.ok) renderReports(container);
    });
  });

  container.querySelectorAll('.admin-report-ban').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const reason = await promptBanReason();
      if (!reason) return;
      const r = await banUser(btn.dataset.uid, reason);
      if (r.ok) setStatus('Joueur banni.');
      else setStatus(r.reason, true);
    });
  });

  container.querySelectorAll('.admin-report-flag').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const fields = await showAdminModal({
        title: 'Flag triche',
        bodyHtml: '<label class="admin-modal-label">Notes<textarea class="auth-input admin-textarea" data-field="notes" rows="2"></textarea></label>',
      });
      if (!fields) return;
      const r = await flagCheat(btn.dataset.uid, true, fields.notes?.trim() || null);
      setStatus(r.ok ? 'Flag ajouté.' : r.reason, !r.ok);
    });
  });

  container.querySelectorAll('.admin-view-reported').forEach((btn) => {
    btn.addEventListener('click', () => goToTab('players', btn.dataset.uid));
  });
}

async function renderLeaderboardAdmin(container) {
  const sort = container.dataset.sort || 'char_level';
  container.innerHTML = '<p class="admin-loading">Chargement…</p>';
  const res = await fetchLeaderboardAdmin(sort, 50);
  if (!res.ok) {
    container.innerHTML = `<p class="admin-error">${res.reason}</p>`;
    return;
  }
  const rows = res.data || [];
  container.innerHTML = `
    ${toolbarHtml(`
      <select class="auth-input" id="admin-lb-sort">
        <option value="char_level" ${sort === 'char_level' ? 'selected' : ''}>Par niveau</option>
        <option value="total_earned" ${sort === 'total_earned' ? 'selected' : ''}>Par fortune</option>
        <option value="seasons_completed" ${sort === 'seasons_completed' ? 'selected' : ''}>Par saisons</option>
        <option value="max_job_level" ${sort === 'max_job_level' ? 'selected' : ''}>Par métier max</option>
        <option value="total_harvests" ${sort === 'total_harvests' ? 'selected' : ''}>Par récoltes</option>
      </select>
      ${isAdmin() ? '<button type="button" class="btn btn-craft btn-sm" id="admin-rebuild-lb">Reconstruire depuis les saves</button>' : ''}
      ${isSuperAdmin() ? '<button type="button" class="btn btn-muted btn-sm" id="admin-wipe-lb">Vider tout le classement</button>' : ''}
    `)}
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>#</th><th>Pseudo</th><th>Nv.</th><th>Métier</th><th>Saison</th><th>Fortune</th><th>Récoltes</th><th>Statut</th><th></th></tr></thead>
        <tbody>${rows.map((r, i) => `
          <tr class="${r.is_banned ? 'row-banned' : ''}${r.cheat_flagged ? ' row-flagged' : ''}">
            <td>${i + 1}</td>
            <td>${r.display_name}</td>
            <td>Nv.${r.char_level}</td>
            <td>${r.max_job_level || 1}</td>
            <td>S${r.season}</td>
            <td>${fmtNum(r.total_earned)} 💰</td>
            <td>${fmtNum(r.total_harvests || 0)}</td>
            <td>${r.is_banned ? '⛔' : r.cheat_flagged ? '⚠️' : '✓'}</td>
            <td>
              <button type="button" class="btn btn-muted btn-sm admin-view-player" data-uid="${r.user_id}">Voir</button>
              <button type="button" class="btn btn-muted btn-sm admin-del-lb-row" data-uid="${r.user_id}">Retirer</button>
            </td>
          </tr>
        `).join('') || '<tr><td colspan="9">Aucun joueur classé.</td></tr>'}</tbody>
      </table>
    </div>
  `;
  container.querySelector('#admin-lb-sort')?.addEventListener('change', (e) => {
    container.dataset.sort = e.target.value;
    renderLeaderboardAdmin(container);
  });
  container.querySelector('#admin-rebuild-lb')?.addEventListener('click', async () => {
    if (!confirm('Reconstruire le classement depuis toutes les saves cloud ?')) return;
    const r = await rebuildLeaderboardFromSaves();
    setStatus(r.ok ? `Classement reconstruit (${r.data?.upserted ?? '?'} entrées).` : r.reason, !r.ok);
    if (r.ok) renderLeaderboardAdmin(container);
  });
  container.querySelector('#admin-wipe-lb')?.addEventListener('click', async () => {
    if (!confirm('Vider TOUT le classement ? (parties reset)')) return;
    const r = await wipeAllLeaderboard();
    setStatus(r.ok ? `Classement vidé (${r.data?.deleted ?? 0}).` : r.reason, !r.ok);
    if (r.ok) renderLeaderboardAdmin(container);
  });
  bindRefresh(container, () => renderLeaderboardAdmin(container));
  container.querySelectorAll('.admin-view-player').forEach((btn) => {
    btn.addEventListener('click', () => goToTab('players', btn.dataset.uid));
  });
  container.querySelectorAll('.admin-del-lb-row').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Retirer cette entrée du classement ?')) return;
      const r = await deleteLeaderboardEntry(btn.dataset.uid);
      setStatus(r.ok ? 'Entrée supprimée.' : r.reason, !r.ok);
      if (r.ok) renderLeaderboardAdmin(container);
    });
  });
}

async function renderAnnouncements(container) {
  container.innerHTML = '<p class="admin-loading">Chargement…</p>';
  const res = await fetchAnnouncementsAdmin();
  if (!res.ok) {
    container.innerHTML = `<p class="admin-error">${res.reason}</p>`;
    return;
  }
  const rows = res.data || [];
  container.innerHTML = `
    <div class="admin-form">
      <h4>Nouvelle annonce</h4>
      <input type="text" class="auth-input" id="ann-title" placeholder="Titre" maxlength="200" />
      <textarea class="auth-input admin-textarea" id="ann-body" placeholder="Message…" rows="3"></textarea>
      <select class="auth-input" id="ann-kind">
        <option value="info">Info</option>
        <option value="warn">Avertissement</option>
        <option value="maintenance">Maintenance</option>
        <option value="event">Événement</option>
      </select>
      <input type="number" class="auth-input" id="ann-hours" value="72" min="0" max="720" placeholder="Durée (h, 0=illimité)" />
      <button type="button" class="btn btn-craft" id="ann-create">Publier</button>
    </div>
    <h4 class="admin-section-title">Annonces</h4>
    ${rows.length ? rows.map((a) => `
      <div class="admin-ann-card ${a.active ? '' : 'inactive'}">
        <strong>${a.title}</strong> · ${ANN_KIND_LABELS[a.kind] || a.kind} · ${a.active ? '✅ Active' : '⏸ Désactivée'}
        <p>${a.body}</p>
        <p class="view-desc">${fmtDate(a.starts_at)} → ${a.ends_at ? fmtDate(a.ends_at) : '∞'}</p>
        <button type="button" class="btn btn-muted btn-sm admin-toggle-ann" data-id="${a.id}" data-active="${!a.active}">
          ${a.active ? 'Désactiver' : 'Activer'}
        </button>
      </div>
    `).join('') : '<p class="view-desc">Aucune annonce.</p>'}
  `;

  bindRefresh(container, () => renderAnnouncements(container));

  container.querySelector('#ann-create')?.addEventListener('click', async () => {
    const title = container.querySelector('#ann-title')?.value?.trim();
    const body = container.querySelector('#ann-body')?.value?.trim();
    const kind = container.querySelector('#ann-kind')?.value || 'info';
    const hours = Number(container.querySelector('#ann-hours')?.value) || 72;
    if (!title || !body) {
      setStatus('Titre et message requis.', true);
      return;
    }
    const r = await createAnnouncement(title, body, kind, hours);
    setStatus(r.ok ? 'Annonce publiée.' : r.reason, !r.ok);
    if (r.ok) renderAnnouncements(container);
  });

  container.querySelectorAll('.admin-toggle-ann').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = await toggleAnnouncement(btn.dataset.id, btn.dataset.active === 'true');
      setStatus(r.ok ? 'Annonce mise à jour.' : r.reason, !r.ok);
      if (r.ok) renderAnnouncements(container);
    });
  });
}

async function renderConfig(container) {
  container.innerHTML = '<p class="admin-loading">Chargement…</p>';
  const res = await fetchAdminConfig();
  if (!res.ok) {
    container.innerHTML = `<p class="admin-error">${res.reason}</p>`;
    return;
  }
  const cfg = res.data || {};
  const toggles = [
    { key: 'maintenance_mode', label: 'Mode maintenance', desc: 'Bloque les fonctionnalités online' },
    { key: 'leaderboard_enabled', label: 'Classement actif', desc: 'Autorise les mises à jour classement' },
    { key: 'market_p2p_enabled', label: 'HDV joueurs actif', desc: 'Autorise le marché P2P' },
    { key: 'test_hdv_enabled', label: 'HDV test actif', desc: 'Marché test à prix fixe' },
    { key: 'reporting_enabled', label: 'Signalements actifs', desc: 'Les joueurs peuvent signaler' },
  ];

  container.innerHTML = `
    ${toolbarHtml()}
    <div class="admin-config-list">
      ${toggles.map((t) => {
        const val = cfg[t.key] === true || cfg[t.key] === 'true';
        return `
          <label class="admin-config-row">
            <input type="checkbox" class="admin-config-toggle" data-key="${t.key}" ${val ? 'checked' : ''} />
            <span><strong>${t.label}</strong><br><span class="view-desc">${t.desc}</span></span>
          </label>
        `;
      }).join('')}
    </div>
    <section class="admin-dash-section">
      <h4 class="admin-section-title">🧪 Beta testeurs (save v31)</h4>
      <p class="view-desc">XP récolte (10/14/18…) séparée des paliers déblocage (12/18/24…). Onglet Succès actif. Saison 1→2 : 5 succès + 2500💰. Doc : <code>docs/progression-design.md</code></p>
      <p class="view-desc">Pour remonter un testeur : fiche joueur → « +1 tous les métiers » (plusieurs fois) ou reset save.</p>
    </section>
    <button type="button" class="btn btn-craft" id="admin-save-config">Enregistrer la config</button>
    <p class="view-desc admin-hint">Les changements s'appliquent immédiatement aux joueurs connectés (rechargement config).</p>
  `;

  bindRefresh(container, () => renderConfig(container));

  container.querySelector('#admin-save-config')?.addEventListener('click', async () => {
    const checks = container.querySelectorAll('.admin-config-toggle');
    for (const el of checks) {
      await setAdminConfig(el.dataset.key, el.checked);
    }
    await refreshGameConfig();
    setStatus('Configuration enregistrée.');
  });
}

async function renderLogs(container) {
  const action = container.dataset.action || '';
  container.innerHTML = '<p class="admin-loading">Chargement…</p>';
  const res = await fetchModerationLogs(100, action || null);
  if (!res.ok) {
    container.innerHTML = `<p class="admin-error">${res.reason}</p>`;
    return;
  }
  const rows = res.data || [];
  container.innerHTML = `
    ${toolbarHtml(`
      <select class="auth-input" id="admin-log-filter">
        <option value="">Toutes actions</option>
        ${Object.entries(LOG_ACTION_LABELS).map(([k, v]) => `
          <option value="${k}" ${action === k ? 'selected' : ''}>${v}</option>
        `).join('')}
      </select>
    `)}
    ${rows.length ? `
      <div class="admin-table-wrap">
        <table class="admin-table admin-table-compact">
          <thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Cible</th><th>Raison / détail</th></tr></thead>
          <tbody>${rows.map((l) => `
            <tr>
              <td>${fmtDate(l.created_at)}</td>
              <td>${l.actor_name || '—'}</td>
              <td>${LOG_ACTION_LABELS[l.action] || l.action}</td>
              <td>${l.target_name ? `<button type="button" class="btn-link admin-goto-player" data-uid="${l.target_user_id}">${l.target_name}</button>` : '—'}</td>
              <td>${l.reason || (l.details ? JSON.stringify(l.details).slice(0, 80) : '—')}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    ` : '<p class="view-desc">Aucun log.</p>'}
  `;
  container.querySelector('#admin-log-filter')?.addEventListener('change', (e) => {
    container.dataset.action = e.target.value;
    renderLogs(container);
  });
  bindRefresh(container, () => renderLogs(container));
  container.querySelectorAll('.admin-goto-player').forEach((btn) => {
    btn.addEventListener('click', () => goToTab('players', btn.dataset.uid));
  });
}

async function renderSaves(container) {
  container.innerHTML = '<p class="admin-loading">Chargement…</p>';
  const res = await fetchCloudSaves(50);
  if (!res.ok) {
    container.innerHTML = `<p class="admin-error">${res.reason}</p>`;
    return;
  }
  const rows = res.data || [];
  container.innerHTML = `
    ${toolbarHtml()}
    ${rows.length ? `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Pseudo</th><th>Save</th><th>Nv.</th><th>Saison</th><th>Kirha</th><th>Màj</th><th>Statut</th><th></th></tr></thead>
          <tbody>${rows.map((s) => `
            <tr class="${s.is_banned ? 'row-banned' : ''}${s.cheat_flagged ? ' row-flagged' : ''}">
              <td>${s.display_name}</td>
              <td>${s.nickname || '—'}</td>
              <td>Nv.${s.char_level}</td>
              <td>S${s.season}</td>
              <td>${fmtNum(s.kirha)} 💰</td>
              <td>${fmtDate(s.updated_at)}</td>
              <td>${s.is_banned ? '⛔' : s.cheat_flagged ? '⚠️' : '✓'}</td>
              <td>
                <button type="button" class="btn btn-muted btn-sm admin-view-player" data-uid="${s.user_id}">Voir</button>
                <button type="button" class="btn btn-muted btn-sm admin-reset-save-row" data-uid="${s.user_id}">Reset</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    ` : '<p class="view-desc">Aucune save cloud.</p>'}
  `;
  bindRefresh(container, () => renderSaves(container));
  container.querySelectorAll('.admin-view-player').forEach((btn) => {
    btn.addEventListener('click', () => goToTab('players', btn.dataset.uid));
  });
  container.querySelectorAll('.admin-reset-save-row').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer la save cloud de ce joueur ? Irréversible.')) return;
      const r = await resetCloudSave(btn.dataset.uid);
      setStatus(r.ok ? 'Save supprimée.' : r.reason, !r.ok);
      if (r.ok) renderSaves(container);
    });
  });
}

async function renderAdminPanel(bodyEl) {
  if (!bodyEl) return;
  const role = getProfileRole();
  if (!canAccessAdminTab(activeTab, role)) {
    activeTab = getVisibleAdminTabs(role)[0]?.id || 'dashboard';
  }
  switch (activeTab) {
    case 'dashboard': await renderDashboard(bodyEl); break;
    case 'players': await renderPlayers(bodyEl); break;
    case 'reports': await renderReports(bodyEl); break;
    case 'leaderboard': await renderLeaderboardAdmin(bodyEl); break;
    case 'saves': await renderSaves(bodyEl); break;
    case 'announcements': await renderAnnouncements(bodyEl); break;
    case 'config': await renderConfig(bodyEl); break;
    case 'logs': await renderLogs(bodyEl); break;
    default: await renderDashboard(bodyEl);
  }
}

export function renderAdmin(game, el) {
  gameRef = game;
  el.innerHTML = `
    <div class="view-header"><h2>🛡️ Administration</h2></div>
    <p class="view-desc">Vérification des droits…</p>
  `;

  (async () => {
    try {
      if (isSupabaseConfigured()) {
        const supabase = await getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          el.innerHTML = `
            <div class="view-header"><h2>🛡️ Administration</h2></div>
            <p class="admin-error">Session expirée — reconnecte-toi avec le compte Veayce.</p>
          `;
          return;
        }
        if (game.state?.meta?.account) {
          game.state.meta.account.mode = 'registered';
          game.state.meta.account.userId = session.user.id;
          game.state.meta.account.email = session.user.email || game.state.meta.account.email;
        }
      }

      await refreshProfile().catch(() => null);

      // Répare le rôle owner côté serveur si la RPC existe
      const claim = await claimOwnerSuperadmin().catch(() => ({ ok: false }));
      if (claim?.ok) await refreshProfile().catch(() => null);

      paintAdmin(game, el);
    } catch (err) {
      console.warn('[admin] init failed', err);
      const uid = getAuthState()?.userId || '?';
      el.innerHTML = `
        <div class="view-header"><h2>🛡️ Administration</h2></div>
        <p class="admin-error">Impossible de charger l’admin (${err?.message || 'erreur'}). Compte : ${uid}</p>
        <button type="button" class="btn btn-muted" id="admin-retry-profile">Réessayer</button>
      `;
      el.querySelector('#admin-retry-profile')?.addEventListener('click', () => renderAdmin(game, el));
    }
  })();
}

function paintAdmin(game, el) {
  if (!canSeeAdminPanel()) {
    el.innerHTML = `
      <div class="view-header"><h2>Personnage</h2></div>
      <p class="view-desc">Page introuvable.</p>
    `;
    return;
  }
  const role = getProfileRole();
  const tabs = getVisibleAdminTabs(role);

  if (!tabs.length) {
    el.innerHTML = `
      <div class="view-header"><h2>🛡️ Administration</h2></div>
      <p class="admin-error">Accès refusé — rôle staff requis (actuel : ${ROLE_LABELS[role] || role}).</p>
      <button type="button" class="btn btn-muted" id="admin-retry-profile">Resynchroniser le profil</button>
    `;
    el.querySelector('#admin-retry-profile')?.addEventListener('click', () => {
      renderAdmin(game, el);
    });
    return;
  }

  el.innerHTML = `
    <div class="view-header admin-header">
      <h2>Administration</h2>
      <p class="view-desc">${roleBadge(role)} · panneau staff</p>
    </div>
    <p id="admin-status" class="admin-status${statusMsg ? (statusMsg.includes('refusé') || statusMsg.includes('erreur') ? ' error' : ' ok') : ''}">${statusMsg || ''}</p>
    <nav class="admin-tabs" role="tablist">
      ${tabs.map((t) => `
        <button type="button" class="admin-tab-btn${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}" role="tab">
          <span class="admin-tab-icon" aria-hidden="true">${t.icon}</span>
          <span class="admin-tab-label">${t.label}</span>
        </button>
      `).join('')}
    </nav>
    <div class="panel-inner admin-panel" id="admin-panel-body"></div>
  `;

  const bodyEl = el.querySelector('#admin-panel-body');
  panelBodyEl = bodyEl;
  el.querySelectorAll('.admin-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      el.querySelectorAll('.admin-tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      renderAdminPanel(bodyEl);
    });
  });

  renderAdminPanel(bodyEl);
}

/** Formulaire signalement joueur (classement). */
export function renderReportPlayerForm(container, reportedUserId, reportedName) {
  if (!isReportingEnabled()) {
    container.innerHTML = '<p class="view-desc">Signalements désactivés.</p>';
    return;
  }
  container.innerHTML = `
    <details class="admin-report-form">
      <summary>🚩 Signaler ${reportedName || 'ce joueur'}</summary>
      <input type="text" class="auth-input" id="report-reason" placeholder="Raison (triche, insulte…)" maxlength="500" />
      <textarea class="auth-input admin-textarea" id="report-details" placeholder="Détails (optionnel)" rows="2"></textarea>
      <button type="button" class="btn btn-muted btn-sm" id="report-submit">Envoyer</button>
      <p class="admin-report-feedback" id="report-feedback"></p>
    </details>
  `;
  container.querySelector('#report-submit')?.addEventListener('click', async () => {
    const reason = container.querySelector('#report-reason')?.value?.trim();
    const details = container.querySelector('#report-details')?.value?.trim();
    const fb = container.querySelector('#report-feedback');
    if (!reason) {
      fb.textContent = 'Indique une raison.';
      return;
    }
    const r = await submitPlayerReport(reportedUserId, reason, details || null);
    fb.textContent = r.ok ? 'Signalement envoyé. Merci.' : (r.reason || 'Erreur.');
  });
}

export function resetAdminUiState() {
  activeTab = 'dashboard';
  selectedPlayerId = null;
  statusMsg = '';
}
