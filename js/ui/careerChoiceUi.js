import { emit } from '../core/events.js';
import { SaveProvider } from '../core/save.js';
import { forceAppRefresh } from '../core/reload.js';
import {
  GATHERING_JOB_IDS,
  PICKABLE_FARM_BUILDINGS,
  CAREER_PICK_COUNTS,
  STARTER_WEAPON_CHOICES,
  RECOMMENDED_FARM_BY_GATHERING,
  getRecommendedFarmBuildingsForGathering,
  validateCareerSelection,
} from '../systems/careerChoice.js';
import { FARM_BUILDING_LABELS } from '../systems/farm.js';

let modalEl = null;
let gameRef = null;
let selectedGathering = new Set();
let selectedFarm = new Set();
let selectedWeaponType = null;
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

  const recommendedFarmIds = getRecommendedFarmBuildingsForGathering([...selectedGathering]);
  const recommendedFarmSet = new Set(recommendedFarmIds);
  const recommendationLines = [...selectedGathering].map((jobId) => {
    const rec = RECOMMENDED_FARM_BY_GATHERING[jobId];
    if (!rec) return '';
    const job = gameRef.jobs[jobId];
    const label = FARM_BUILDING_LABELS[rec.building] || rec.building;
    return `${job?.emoji || ''} ${job?.name || jobId} → ${label} (${rec.reason})`;
  }).filter(Boolean);

  const farmHtml = PICKABLE_FARM_BUILDINGS.map((id) => {
    const picked = selectedFarm.has(id);
    const label = FARM_BUILDING_LABELS[id] || id;
    const recommended = recommendedFarmSet.has(id);
    return `<button type="button" class="career-pick-btn${picked ? ' picked' : ''}${recommended ? ' recommended' : ''}" data-farm="${id}">
      ${label}${recommended ? '<span class="career-rec-badge">Conseillé</span>' : ''}
    </button>`;
  }).join('');

  const weaponHtml = STARTER_WEAPON_CHOICES.map((choice) => {
    const item = gameRef.combatEquipment?.items?.[choice.itemId];
    const picked = selectedWeaponType === choice.weaponType;
    const stats = item?.stats
      ? `❤️ +${item.stats.hp || 0} · ⚔️ +${item.stats.atk || 0} · 🛡️ +${item.stats.def || 0}`
      : '';
    return `<button type="button" class="career-weapon-btn${picked ? ' picked' : ''}" data-weapon-type="${choice.weaponType}">
      <span class="career-weapon-emoji">${choice.emoji}</span>
      <span class="career-weapon-main">
        <strong>${choice.label}</strong>
        <small>${choice.bonus}</small>
        <small>${choice.description}</small>
        ${stats ? `<small>${stats}</small>` : ''}
      </span>
    </button>`;
  }).join('');

  const check = validateCareerSelection([...selectedGathering], [...selectedFarm], selectedWeaponType);
  const missingRecommended = recommendedFarmIds.filter((id) => !selectedFarm.has(id));
  const recommendationHtml = recommendationLines.length
    ? `<p class="career-recommendation">Conseillé : ${recommendationLines.join(' · ')}</p>`
    : '<p class="career-recommendation">Choisis tes métiers de récolte pour voir les bâtiments de ferme conseillés.</p>';
  const status = check.ok
    ? missingRecommended.length
      ? `✅ Parcours valide. Conseil confort : remplace par ${missingRecommended.map((id) => FARM_BUILDING_LABELS[id] || id).join(' + ')} si tu veux un départ plus simple.`
      : '✅ Tu peux valider ton parcours conseillé.'
    : check.reason || `Choisis ${CAREER_PICK_COUNTS.gathering} métiers de récolte, ${CAREER_PICK_COUNTS.farm} bâtiments de ferme et ton arme de départ. Le Puits est gratuit pour tous.`;

  body.innerHTML = `
    <h2>🌸 Choisis ta voie</h2>
    <p class="modal-desc">Spécialise-toi pour l'économie : tu produiras pour le marché, le reste s'achète à l'Hôtel des Ventes.</p>
    <section class="career-section">
      <h3>Récolte (${selectedGathering.size}/${CAREER_PICK_COUNTS.gathering})</h3>
      <div class="career-pick-grid">${gatheringHtml}</div>
    </section>
    <section class="career-section">
      <h3>Ferme (${selectedFarm.size}/${CAREER_PICK_COUNTS.farm}) + 🪣 Puits gratuit</h3>
      ${recommendationHtml}
      <div class="career-pick-grid">${farmHtml}</div>
    </section>
    <section class="career-section">
      <h3>Arme de départ</h3>
      <p class="view-desc">Ton héros garde cette arme. Les deux équipiers recevront automatiquement les deux autres rôles pour former une équipe Guerrier + Archer + Mage.</p>
      <div class="career-weapon-grid">${weaponHtml}</div>
    </section>
    <p class="career-status" id="career-status">${status}</p>
    <p class="career-error save-warn hidden" id="career-error" role="alert"></p>
    <div class="career-actions">
      <button type="button" class="btn btn-prestige" id="career-confirm" aria-disabled="${check.ok ? 'false' : 'true'}">Commencer l'aventure</button>
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
  try {
    setCareerError('');
    const check = validateCareerSelection([...selectedGathering], [...selectedFarm], selectedWeaponType);
    if (!check.ok) {
      renderCareerModal();
      setCareerError(check.reason || 'Sélection incomplète.');
      return;
    }

    const result = gameRef.doApplyCareerChoice([...selectedGathering], [...selectedFarm], selectedWeaponType);
    if (!result.ok) {
      setCareerError(result.reason || 'Impossible de valider ton parcours.');
      return;
    }

    closeCareerModal();
    emit('navRefresh');
  } catch (err) {
    console.error('Career choice failed:', err);
    setCareerError('Erreur pendant la validation. Actualise la page puis réessaie.');
  }
}

async function resetFromCareerModal() {
  if (!gameRef) return;
  const ok = confirm('Réinitialiser toute la progression et recommencer une nouvelle partie ?');
  if (!ok) return;

  await SaveProvider.clear();
  gameRef.resetSave();
  selectedGathering = new Set();
  selectedFarm = new Set();
  selectedWeaponType = null;
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

    const weaponBtn = e.target.closest('[data-weapon-type]');
    if (weaponBtn) {
      selectedWeaponType = weaponBtn.dataset.weaponType;
      renderCareerModal();
      return;
    }

    if (e.target.closest('#career-confirm')) {
      e.preventDefault();
      confirmCareerChoice();
      return;
    }

    if (e.target.closest('#career-reload')) {
      forceAppRefresh(gameRef);
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
  selectedWeaponType = null;
}

export function showCareerChoiceIfNeeded(game) {
  gameRef = game;
  if (!game.needsCareerChoice()) {
    closeCareerModal();
    return;
  }
  selectedGathering = new Set(game.state.careerChoice?.gatheringJobs || [...selectedGathering]);
  selectedFarm = new Set(game.state.careerChoice?.farmBuildings || [...selectedFarm]);
  selectedWeaponType = game.state.careerChoice?.weaponType || selectedWeaponType;
  document.body.classList.add('career-choice-pending');
  modalEl?.classList.add('active');
  renderCareerModal();
}

export function hideCareerChoiceModal() {
  closeCareerModal();
}
