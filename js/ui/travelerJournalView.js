/**
 * Vue Carnet du voyageur — lore optionnel + modal lecture.
 */

import { iconHtml, getNavIcon } from '../core/assets.js';

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

export function renderTravelerJournal(game, el) {
  const vm = game.getTravelerJournalView?.();
  if (!vm || !el) {
    if (el) el.innerHTML = '<p class="view-desc">Carnet indisponible.</p>';
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

  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('traveler_journal'), 'view-header-icon', 'Carnet') || '📔'} ${vm.title}</h2>
      <p class="view-desc">${vm.description} Progression : <strong>${vm.unlockedCount}/${vm.total}</strong>.</p>
    </div>
    <div class="journal-panel">${cards}</div>
  `;

  const openById = (id) => {
    const entry = vm.entries.find((x) => x.id === id && x.unlocked);
    if (entry) openJournalPageModal(entry);
  };

  el.querySelectorAll('[data-journal-open]').forEach((card) => {
    card.addEventListener('click', () => openById(card.getAttribute('data-journal-open')));
    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openById(card.getAttribute('data-journal-open'));
      }
    });
  });
}
