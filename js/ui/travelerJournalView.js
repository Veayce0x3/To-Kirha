/**
 * Vue Carnet du voyageur + Herbier (collection ressources).
 */

import { iconHtml, getNavIcon } from '../core/assets.js';
import { renderResourceIcon } from '../systems/resourceVisual.js';

let loreTab = 'journal'; // 'journal' | 'herbarium'
let herbFilter = 'all';

export function closeJournalPageModal() {
  const modal = document.getElementById('journal-page-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

export function openJournalPageModal(entry) {
  const modal = document.getElementById('journal-page-modal');
  const body = document.getElementById('journal-page-modal-body');
  if (!modal || !body || !entry) return;

  const bodyHtml = String(entry.body || '')
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');

  body.innerHTML = `
    <button type="button" class="journal-modal-close" id="journal-page-close" aria-label="Fermer">✕</button>
    <div class="journal-modal-emoji">${entry.emoji || '📔'}</div>
    <h2 class="journal-modal-title">${entry.title || 'Page du carnet'}</h2>
    <div class="journal-modal-text">${bodyHtml}</div>
    <button type="button" class="btn btn-craft" id="journal-page-ok">Continuer</button>
  `;

  const close = () => closeJournalPageModal();
  body.querySelector('#journal-page-close')?.addEventListener('click', close);
  body.querySelector('#journal-page-ok')?.addEventListener('click', close);
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function renderJournalPanel(game, panel) {
  const vm = game.getTravelerJournalView?.();
  if (!vm) {
    panel.innerHTML = '<p class="view-desc">Carnet indisponible.</p>';
    return;
  }

  const cards = vm.entries.map((e) => {
    if (!e.unlocked) {
      return `
        <article class="journal-card locked">
          <span class="journal-emoji">❓</span>
          <strong>Page scellée</strong>
          <p class="journal-hint">💡 ${e.hint || 'Continue ton aventure pour débloquer cette page.'}</p>
        </article>`;
    }
    return `
      <article class="journal-card unlocked" role="button" tabindex="0" data-journal-open="${e.id}">
        <header class="journal-card-head">
          <span class="journal-emoji">${e.emoji || '📔'}</span>
          <strong>${e.title}</strong>
        </header>
        <p class="journal-card-teaser">Touche pour relire</p>
      </article>`;
  }).join('');

  panel.innerHTML = `
    <p class="view-desc">${vm.description} Progression : <strong>${vm.unlockedCount}/${vm.total}</strong>.</p>
    <div class="journal-panel">${cards}</div>
  `;

  const openById = (id) => {
    const entry = vm.entries.find((x) => x.id === id && x.unlocked);
    if (entry) openJournalPageModal(entry);
  };

  panel.querySelectorAll('[data-journal-open]').forEach((card) => {
    card.addEventListener('click', () => openById(card.getAttribute('data-journal-open')));
    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openById(card.getAttribute('data-journal-open'));
      }
    });
  });
}

function renderHerbariumPanel(game, panel) {
  const vm = game.getHerbariumView?.();
  if (!vm) {
    panel.innerHTML = '<p class="view-desc">Herbier indisponible.</p>';
    return;
  }

  if (!herbFilter || (herbFilter !== 'all' && !vm.groups.some((g) => g.id === herbFilter))) {
    herbFilter = 'all';
  }

  const filterTabs = [
    { id: 'all', label: 'Tout', emoji: '🌿', found: vm.found, total: vm.total },
    ...vm.groups.map((g) => ({
      id: g.id,
      label: g.label,
      emoji: g.emoji,
      found: g.found,
      total: g.total,
    })),
  ];

  const entries = herbFilter === 'all'
    ? vm.entries
    : vm.entries.filter((e) => e.groupId === herbFilter);

  const cards = entries.map((e) => {
    if (!e.discovered) {
      return `
        <article class="herbarium-card locked">
          <span class="herbarium-emoji">❓</span>
          <strong>???</strong>
          <span class="herbarium-meta">${e.group.emoji} ${e.group.label}</span>
          <p class="herbarium-blurb">Pas encore découverte</p>
        </article>`;
    }
    const icon = renderResourceIcon(e.resource, 'herbarium-res-icon') || e.resource.emoji || '🌿';
    return `
      <article class="herbarium-card">
        <span class="herbarium-emoji">${icon}</span>
        <strong>${e.resource.name || e.resource.id}</strong>
        <span class="herbarium-meta">${e.group.emoji} ${e.jobName}</span>
        <p class="herbarium-blurb">${e.blurb}</p>
      </article>`;
  }).join('');

  panel.innerHTML = `
    <p class="view-desc">${vm.description} Collection : <strong>${vm.found}/${vm.total}</strong>.</p>
    <nav class="herbarium-filters char-tabs" role="tablist" aria-label="Filtres herbier">
      ${filterTabs.map((t) => `
        <button type="button" class="char-tab-btn${herbFilter === t.id ? ' active' : ''}"
          data-herb-filter="${t.id}" role="tab">
          ${t.emoji} ${t.label}
          <span class="school-tab-count">${t.found}/${t.total}</span>
        </button>
      `).join('')}
    </nav>
    <div class="herbarium-grid">${cards || '<p class="empty-text">Aucune entrée.</p>'}</div>
  `;

  panel.querySelectorAll('[data-herb-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      herbFilter = btn.getAttribute('data-herb-filter') || 'all';
      renderHerbariumPanel(game, panel);
    });
  });
}

export function renderTravelerJournal(game, el) {
  if (!el) return;
  if (loreTab !== 'journal' && loreTab !== 'herbarium') loreTab = 'journal';

  const jVm = game.getTravelerJournalView?.();
  const hVm = game.getHerbariumView?.();
  const jCount = jVm ? `${jVm.unlockedCount}/${jVm.total}` : '';
  const hCount = hVm ? `${hVm.found}/${hVm.total}` : '';

  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('traveler_journal'), 'view-header-icon', 'Carnet') || '📔'} Carnet & Herbier</h2>
      <p class="view-desc">Histoire du village et collection des ressources découvertes.</p>
    </div>
    <nav class="cuisine-tabs char-tabs lore-tabs" role="tablist" aria-label="Carnet et Herbier">
      <button type="button" class="char-tab-btn${loreTab === 'journal' ? ' active' : ''}"
        data-lore-tab="journal" role="tab">📔 Carnet${jCount ? ` · ${jCount}` : ''}</button>
      <button type="button" class="char-tab-btn${loreTab === 'herbarium' ? ' active' : ''}"
        data-lore-tab="herbarium" role="tab">🌿 Herbier${hCount ? ` · ${hCount}` : ''}</button>
    </nav>
    <div id="lore-tab-panel"></div>
  `;

  const panel = el.querySelector('#lore-tab-panel');

  el.querySelectorAll('[data-lore-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      loreTab = btn.getAttribute('data-lore-tab') === 'herbarium' ? 'herbarium' : 'journal';
      el.querySelectorAll('[data-lore-tab]').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-lore-tab') === loreTab);
      });
      if (loreTab === 'herbarium') renderHerbariumPanel(game, panel);
      else renderJournalPanel(game, panel);
    });
  });

  if (loreTab === 'herbarium') renderHerbariumPanel(game, panel);
  else renderJournalPanel(game, panel);
}
