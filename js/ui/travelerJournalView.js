/**
 * Vue Carnet du voyageur + Herbier (ressources / butin / bestiaire) + Livre de cuisine.
 * Le carnet s’affiche comme un livre feuilletable (toutes les pages visibles progressivement).
 */

import { iconHtml, getNavIcon } from '../core/assets.js';
import { renderResourceIcon } from '../systems/resourceVisual.js';

let loreTab = 'journal'; // 'journal' | 'herbarium' | 'cookbook'
let herbFilter = 'all';
let journalPageIndex = 0;

/** Ouvre le carnet sur la dernière page débloquée (après toast unlock). */
export function focusLatestJournalPage() {
  journalPageIndex = 9999;
}

export function closeJournalPageModal() {
  const modal = document.getElementById('journal-page-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

/** Conservé pour découvertes Kirha / contenus ponctuels hors carnet. */
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

/** Découverte Kirha météo — même modal que le carnet, fermable ✕. */
export function openHarvestDiscoveryModal(discovery, kirhaGain = 0) {
  if (!discovery) return;
  const gain = Math.max(0, Math.floor(Number(kirhaGain) || 0));
  const body = gain > 0
    ? `${discovery.flavor || 'Vous trouvez quelque chose…'}\n\n+${gain} 💰`
    : (discovery.flavor || 'Vous trouvez quelque chose…');
  openJournalPageModal({
    emoji: '✨',
    title: discovery.label || discovery.title || 'Découverte',
    body,
  });
}

function formatJournalBody(body) {
  return String(body || '')
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function renderJournalPanel(game, panel) {
  const vm = game.getTravelerJournalView?.();
  if (!vm) {
    panel.innerHTML = '<p class="view-desc">Carnet indisponible.</p>';
    return;
  }

  const unlocked = vm.entries.filter((e) => e.unlocked);
  const locked = vm.entries.filter((e) => !e.unlocked);
  if (journalPageIndex >= unlocked.length) journalPageIndex = Math.max(0, unlocked.length - 1);
  if (journalPageIndex < 0) journalPageIndex = 0;

  const page = unlocked[journalPageIndex] || null;
  const pageNum = unlocked.length ? journalPageIndex + 1 : 0;

  const dots = unlocked.map((e, i) => `
    <button type="button" class="journal-book-dot${i === journalPageIndex ? ' active' : ''}"
      data-journal-page="${i}" aria-label="Page ${i + 1} : ${e.title}"
      aria-current="${i === journalPageIndex ? 'page' : 'false'}"></button>
  `).join('');

  const sealedPreview = locked.slice(0, 3).map((e) => `
    <li class="journal-sealed-item">
      <span aria-hidden="true">❓</span>
      <span>${e.hint || e.unlockHint || 'Page scellée'}</span>
    </li>
  `).join('');

  panel.innerHTML = `
    <p class="view-desc">${vm.description} Progression : <strong>${vm.unlockedCount}/${vm.total}</strong>.</p>
    <div class="journal-book" role="region" aria-label="Carnet du voyageur">
      <div class="journal-book-spine" aria-hidden="true"></div>
      <div class="journal-book-page">
        ${page ? `
          <header class="journal-book-head">
            <span class="journal-book-emoji">${page.emoji || '📔'}</span>
            <div>
              <p class="journal-book-folio">Page ${pageNum} / ${unlocked.length}</p>
              <h3 class="journal-book-title">${page.title}</h3>
            </div>
          </header>
          <div class="journal-book-text">${formatJournalBody(page.body)}</div>
        ` : `
          <p class="journal-book-empty">Aucune page ouverte pour l’instant. Commence l’aventure pour écrire la première.</p>
        `}
      </div>
      <div class="journal-book-nav">
        <button type="button" class="btn btn-muted journal-book-prev" ${journalPageIndex <= 0 ? 'disabled' : ''} aria-label="Page précédente">‹</button>
        <div class="journal-book-dots">${dots || '<span class="journal-book-dots-empty">—</span>'}</div>
        <button type="button" class="btn btn-muted journal-book-next" ${journalPageIndex >= unlocked.length - 1 ? 'disabled' : ''} aria-label="Page suivante">›</button>
      </div>
    </div>
    ${locked.length ? `
      <section class="journal-sealed">
        <h4 class="journal-sealed-title">Pages à venir (${locked.length})</h4>
        <ul class="journal-sealed-list">${sealedPreview}${locked.length > 3 ? `<li class="journal-sealed-item">… et ${locked.length - 3} autres</li>` : ''}</ul>
      </section>
    ` : ''}
  `;

  const rerender = () => renderJournalPanel(game, panel);
  panel.querySelector('.journal-book-prev')?.addEventListener('click', () => {
    if (journalPageIndex > 0) {
      journalPageIndex -= 1;
      rerender();
    }
  });
  panel.querySelector('.journal-book-next')?.addEventListener('click', () => {
    if (journalPageIndex < unlocked.length - 1) {
      journalPageIndex += 1;
      rerender();
    }
  });
  panel.querySelectorAll('[data-journal-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      journalPageIndex = Number(btn.getAttribute('data-journal-page')) || 0;
      rerender();
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
    if (e.kind === 'enemy') {
      if (!e.discovered) {
        return `
          <article class="herbarium-card locked">
            <span class="herbarium-emoji">❓</span>
            <strong>???</strong>
            <span class="herbarium-meta">${e.group.emoji} ${e.group.label}</span>
            <p class="herbarium-blurb">${e.blurb}</p>
          </article>`;
      }
      return `
        <article class="herbarium-card${e.isBoss ? ' herbarium-boss' : ''}">
          <span class="herbarium-emoji">${e.emoji || '👹'}</span>
          <strong>${e.name}</strong>
          <span class="herbarium-meta">${e.isBoss ? '👑 Boss' : '👹 Monstre'} · ${e.zoneName}</span>
          <p class="herbarium-blurb">${e.blurb}</p>
        </article>`;
    }

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

function renderCookbookCollectionPanel(game, panel) {
  const vm = game.getCookbookView?.();
  if (!vm) {
    panel.innerHTML = '<p class="view-desc">Livre de cuisine indisponible.</p>';
    return;
  }

  const groups = {};
  for (const entry of vm.entries) {
    const jobId = entry.recipe.craftJob;
    if (!groups[jobId]) groups[jobId] = [];
    groups[jobId].push(entry);
  }

  const sections = Object.entries(groups).map(([jobId, entries]) => {
    const job = vm.jobs[jobId] || { label: jobId, emoji: '🍳' };
    const found = entries.filter((e) => e.discovered).length;
    const cards = entries.map((e) => {
      if (!e.discovered) {
        return `
          <article class="cookbook-card locked">
            <span class="cookbook-emoji">❓</span>
            <strong>???</strong>
            <span class="cookbook-meta">${e.quality.emoji} ${e.quality.label}</span>
            <p class="cookbook-effect">Pas encore craftée</p>
          </article>`;
      }
      return `
        <article class="cookbook-card">
          <span class="cookbook-emoji">${e.recipe.emoji || e.output?.emoji || '🍽️'}</span>
          <strong>${e.recipe.name}</strong>
          <span class="cookbook-meta">${e.quality.emoji} ${e.quality.label} · ${job.emoji} ${job.label}</span>
          <p class="cookbook-effect">${e.effectLabel}</p>
        </article>`;
    }).join('');
    return `
      <section class="cookbook-section">
        <h3>${job.emoji} ${job.label} <span class="school-tab-count">${found}/${entries.length}</span></h3>
        <div class="cookbook-grid">${cards}</div>
      </section>`;
  }).join('');

  panel.innerHTML = `
    <p class="view-desc">Recettes découvertes en les craftant au moins une fois. Progression : <strong>${vm.found}/${vm.total}</strong>.</p>
    <div class="cookbook-panel">${sections || '<p class="empty-text">Aucune recette.</p>'}</div>
  `;
}

function renderLorePanel(game, panel) {
  if (loreTab === 'herbarium') renderHerbariumPanel(game, panel);
  else if (loreTab === 'cookbook') renderCookbookCollectionPanel(game, panel);
  else renderJournalPanel(game, panel);
}

export function renderTravelerJournal(game, el) {
  if (!el) return;
  if (loreTab !== 'journal' && loreTab !== 'herbarium' && loreTab !== 'cookbook') {
    loreTab = 'journal';
  }

  const jVm = game.getTravelerJournalView?.();
  const hVm = game.getHerbariumView?.();
  const cVm = game.getCookbookView?.();
  const jCount = jVm ? `${jVm.unlockedCount}/${jVm.total}` : '';
  const hCount = hVm ? `${hVm.found}/${hVm.total}` : '';
  const cCount = cVm ? `${cVm.found}/${cVm.total}` : '';

  el.innerHTML = `
    <div class="view-header">
      <h2>${iconHtml(getNavIcon('traveler_journal'), 'view-header-icon', 'Carnet') || '📔'} Carnet & Collections</h2>
      <p class="view-desc">Histoire du village, herbier (ressources & bestiaire) et livre de cuisine.</p>
    </div>
    <nav class="cuisine-tabs char-tabs lore-tabs" role="tablist" aria-label="Carnet et collections">
      <button type="button" class="char-tab-btn${loreTab === 'journal' ? ' active' : ''}"
        data-lore-tab="journal" role="tab">📔 Carnet${jCount ? ` · ${jCount}` : ''}</button>
      <button type="button" class="char-tab-btn${loreTab === 'herbarium' ? ' active' : ''}"
        data-lore-tab="herbarium" role="tab">🌿 Herbier${hCount ? ` · ${hCount}` : ''}</button>
      <button type="button" class="char-tab-btn${loreTab === 'cookbook' ? ' active' : ''}"
        data-lore-tab="cookbook" role="tab">📖 Cuisine${cCount ? ` · ${cCount}` : ''}</button>
    </nav>
    <div id="lore-tab-panel"></div>
  `;

  const panel = el.querySelector('#lore-tab-panel');

  el.querySelectorAll('[data-lore-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-lore-tab');
      loreTab = tab === 'herbarium' || tab === 'cookbook' ? tab : 'journal';
      el.querySelectorAll('[data-lore-tab]').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-lore-tab') === loreTab);
      });
      renderLorePanel(game, panel);
    });
  });

  renderLorePanel(game, panel);
}
