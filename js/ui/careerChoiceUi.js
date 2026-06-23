import { emit } from '../core/events.js';
import { SaveProvider } from '../core/save.js';
import {
  GATHERING_JOB_IDS,
  PICKABLE_FARM_BUILDINGS,
  CAREER_PICK_COUNTS,
  validateCareerSelection,
} from '../systems/careerChoice.js';
import { FARM_BUILDING_LABELS } from '../systems/farm.js';

let modalEl = null;
let gameRef = null;
let selectedGathering = new Set();
let selectedFarm = new Set();
let listenersBound = false;

function closeCareerModal() {
  document.body.classList.remove('career-choice-pending');
  modalEl?.classList.remove('active');
}

function togglePick(set, id, max) {
  if (set.has(id)) {
    set.delete(id);
    return;
  }
  if (set.size >= max) return;
  set.add(id);
}

function renderCareerModal() {
  if (!modalEl || !gameRef) return;
  const body = modalEl.querySelector('#career-choice-body');
  if (!body) return;

  const gatheringHtml = GATHERING_JOB_IDS.map((id) => {
    const job = gameRef.jobs[id];
    const picked = selectedGathering.has(id);
    return `<button type="button" class="career-pick-btn${picked ? ' picked' : ''}" data-gather="${id}">
      ${job?.emoji || '⚒️'} ${job?.name || id}
    </button>`;
  }).join('');

  const farmHtml = PICKABLE_FARM_BUILDINGS.map((id) => {
    const picked = selectedFarm.has(id);
    const label = FARM_BUILDING_LABELS[id] || id;
    return `<button type="button" class="career-pick-btn${picked ? ' picked' : ''}" data-farm="${id}">${label}</button>`;
  }).join('');

  const check = validateCareerSelection([...selectedGathering], [...selectedFarm]);
  const status = check.ok
    ? '✅ Tu peux valider ton parcours.'
    : `Choisis ${CAREER_PICK_COUNTS.gathering} métiers de récolte et ${CAREER_PICK_COUNTS.farm} bâtiments de ferme. Le Puits est gratuit pour tous.`;

  body.innerHTML = `
    <h2>🌸 Choisis ta voie</h2>
    <p class="modal-desc">Spécialise-toi pour l'économie : tu produiras pour le marché, le reste s'achète à l'Hôtel des Ventes.</p>
    <section class="career-section">
      <h3>Récolte (${selectedGathering.size}/${CAREER_PICK_COUNTS.gathering})</h3>
      <div class="career-pick-grid">${gatheringHtml}</div>
    </section>
    <section class="career-section">
      <h3>Ferme (${selectedFarm.size}/${CAREER_PICK_COUNTS.farm}) + 🪣 Puits gratuit</h3>
      <div class="career-pick-grid">${farmHtml}</div>
    </section>
    <p class="career-status" id="career-status">${status}</p>
    <p class="career-error save-warn hidden" id="career-error" role="alert"></p>
    <div class="career-actions">
      <button type="button" class="btn btn-prestige" id="career-confirm" ${check.ok ? '' : 'disabled'}>Commencer l'aventure</button>
      <button type="button" class="btn btn-muted" id="career-reload">Actualiser la page</button>
      <button type="button" class="btn btn-muted" id="career-reset">Réinitialiser la partie</button>
    </div>
    <p class="view-desc career-reset-hint">Bloqué ou sauvegarde abîmée ? Actualise la page, ou réinitialise pour repartir de zéro.</p>
  `;
}

function setCareerError(msg) {
  const el = modalEl?.querySelector('#career-error');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  } else {
    el.textContent = '';
    el.classList.add('hidden');
  }
}

async function confirmCareerChoice() {
  if (!gameRef) return;
  setCareerError('');
  const check = validateCareerSelection([...selectedGathering], [...selectedFarm]);
  if (!check.ok) {
    setCareerError(check.reason || 'Sélection incomplète.');
    renderCareerModal();
    return;
  }

  const result = gameRef.doApplyCareerChoice([...selectedGathering], [...selectedFarm]);
  if (!result.ok) {
    setCareerError(result.reason || 'Impossible de valider ton parcours.');
    return;
  }

  closeCareerModal();
  emit('navRefresh');
}

async function resetFromCareerModal() {
  if (!gameRef) return;
  const ok = confirm('Réinitialiser toute la progression et recommencer une nouvelle partie ?');
  if (!ok) return;

  await SaveProvider.clear();
  gameRef.resetSave();
  selectedGathering = new Set();
  selectedFarm = new Set();
  setCareerError('');
  showCareerChoiceIfNeeded(gameRef);
}

function bindCareerModalListeners() {
  if (!modalEl || listenersBound) return;
  listenersBound = true;

  modalEl.addEventListener('click', (e) => {
    const gatherBtn = e.target.closest('[data-gather]');
    if (gatherBtn) {
      togglePick(selectedGathering, gatherBtn.dataset.gather, CAREER_PICK_COUNTS.gathering);
      renderCareerModal();
      return;
    }

    const farmBtn = e.target.closest('[data-farm]');
    if (farmBtn) {
      togglePick(selectedFarm, farmBtn.dataset.farm, CAREER_PICK_COUNTS.farm);
      renderCareerModal();
      return;
    }

    if (e.target.closest('#career-confirm')) {
      confirmCareerChoice();
      return;
    }

    if (e.target.closest('#career-reload')) {
      window.location.reload();
      return;
    }

    if (e.target.closest('#career-reset')) {
      resetFromCareerModal();
    }
  });
}

export function initCareerChoiceModal(game) {
  gameRef = game;
  modalEl = document.getElementById('career-choice-modal');
  if (!modalEl) return;
  bindCareerModalListeners();
  selectedGathering = new Set();
  selectedFarm = new Set();
}

export function showCareerChoiceIfNeeded(game) {
  gameRef = game;
  if (!game.needsCareerChoice()) {
    closeCareerModal();
    return;
  }
  document.body.classList.add('career-choice-pending');
  modalEl?.classList.add('active');
  renderCareerModal();
}

export function hideCareerChoiceModal() {
  closeCareerModal();
}
