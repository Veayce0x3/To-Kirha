import { emit } from '../core/events.js';
import {
  GATHERING_JOB_IDS,
  PICKABLE_FARM_BUILDINGS,
  CAREER_PICK_COUNTS,
  validateCareerSelection,
} from '../systems/careerChoice.js';
import { FARM_BUILDING_LABELS } from '../systems/farm.js';

let modalEl = null;
let selectedGathering = new Set();
let selectedFarm = new Set();

function togglePick(set, id, max) {
  if (set.has(id)) {
    set.delete(id);
    return;
  }
  if (set.size >= max) return;
  set.add(id);
}

function renderCareerModal(game) {
  if (!modalEl) return;
  const body = modalEl.querySelector('#career-choice-body');
  if (!body) return;

  const gatheringHtml = GATHERING_JOB_IDS.map((id) => {
    const job = game.jobs[id];
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
    <p class="career-status">${status}</p>
    <button type="button" class="btn btn-prestige" id="career-confirm" ${check.ok ? '' : 'disabled'}>Commencer l'aventure</button>
  `;

  body.querySelectorAll('[data-gather]').forEach((btn) => {
    btn.addEventListener('click', () => {
      togglePick(selectedGathering, btn.dataset.gather, CAREER_PICK_COUNTS.gathering);
      renderCareerModal(game);
    });
  });
  body.querySelectorAll('[data-farm]').forEach((btn) => {
    btn.addEventListener('click', () => {
      togglePick(selectedFarm, btn.dataset.farm, CAREER_PICK_COUNTS.farm);
      renderCareerModal(game);
    });
  });
  body.querySelector('#career-confirm')?.addEventListener('click', () => {
    const result = game.doApplyCareerChoice([...selectedGathering], [...selectedFarm]);
    if (!result.ok) return;
    modalEl.classList.remove('active');
    emit('navRefresh');
    emit('stateChange', game.state);
  });
}

export function initCareerChoiceModal(game) {
  modalEl = document.getElementById('career-choice-modal');
  if (!modalEl) return;
  selectedGathering = new Set();
  selectedFarm = new Set();
  renderCareerModal(game);
}

export function showCareerChoiceIfNeeded(game) {
  if (!game.needsCareerChoice()) return;
  modalEl?.classList.add('active');
  renderCareerModal(game);
}
