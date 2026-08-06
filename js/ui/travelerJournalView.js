/**
 * Vue Carnet du voyageur — lore optionnel.
 */

import { iconHtml, getNavIcon } from '../core/assets.js';

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
          <p class="journal-body">Continue ton aventure pour débloquer cette page.</p>
        </article>`;
    }
    const bodyHtml = String(e.body || '')
      .split(/\n\n+/)
      .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
    return `
      <article class="journal-card" id="journal-${e.id}">
        <header class="journal-card-head">
          <span class="journal-emoji">${e.emoji || '📔'}</span>
          <strong>${e.title}</strong>
        </header>
        <div class="journal-body">${bodyHtml}</div>
      </article>`;
  }).join('');

  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('traveler_journal'), 'view-header-icon', 'Carnet') || '📔'} ${vm.title}</h2>
      <p class="view-desc">${vm.description} Progression : <strong>${vm.unlockedCount}/${vm.total}</strong>.</p>
    </div>
    <div class="journal-panel">${cards}</div>
  `;
}
