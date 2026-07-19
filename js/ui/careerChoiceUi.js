/** Onboarding : pseudo + arme de départ (Paysan débloqué automatiquement). */

import { emit } from '../core/events.js';
import { SaveProvider } from '../core/save.js';
import { forceAppRefresh, forceNewGameReload } from '../core/reload.js';
import {
  STARTER_WEAPON_CHOICES,
  STARTER_WEAPON_TYPES,
  validateOnboarding,
} from '../systems/careerChoice.js';
import { validateNickname } from '../systems/character.js';
import { needsAuthChoice } from '../core/auth.js';
import { showAuthModalIfNeeded } from './authUi.js';

let modalEl = null;
let gameRef = null;
let selectedWeaponType = null;
let selectedNickname = '';
let listenersBound = false;

function closeCareerModal() {
  document.body.classList.remove('career-choice-pending');
  modalEl?.classList.remove('active');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderCareerModal() {
  if (!modalEl || !gameRef) return;
  const body = modalEl.querySelector('#career-choice-body');
  if (!body) return;

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

  const check = validateOnboarding(selectedWeaponType);
  const nickInfo = gameRef.getNicknameRenameInfo?.() || { hasNickname: false };
  const needsNickname = !nickInfo.hasNickname;
  const maxNicknameLength = gameRef.characterConfig?.nicknameMaxLength || 20;
  const nicknameCheck = needsNickname ? validateNickname(selectedNickname, gameRef.characterConfig) : { ok: true };
  const canConfirm = check.ok && nicknameCheck.ok;

  const nicknameHtml = needsNickname ? `
    <section class="career-section">
      <h3>Pseudo</h3>
      <input id="career-nickname" class="nickname-input career-nickname-input" type="text" maxlength="${maxNicknameLength}" value="${escapeHtml(selectedNickname)}" placeholder="Ex. Kira" autocomplete="nickname" />
    </section>
  ` : `<section class="career-section"><p>Tu joues avec <strong>${escapeHtml(gameRef.getCharacterDisplayName())}</strong>.</p></section>`;

  const season = gameRef.state?.season || 1;
  const welcomeTitle = season > 1 ? `🌸 Saison ${season}` : '🌸 Bienvenue à To-Kirha';
  const welcomeDesc = season > 1
    ? `Nouvelle saison ! Tu repars Paysan avec le Blé. Tes bonus permanents sont conservés (+Kirha / +XP). Choisis ton arme de départ.`
    : `Tu commences en tant que <strong>Paysan</strong> avec une ligne de production de Blé. Les autres métiers se débloquent en progressant. Le reste s'achète à la Place marchande.`;

  body.innerHTML = `
    <h2>${welcomeTitle}</h2>
    <p class="modal-desc">${welcomeDesc}</p>
    ${nicknameHtml}
    <section class="career-section">
      <h3>Arme de départ</h3>
      <p class="view-desc">Ton héros et tes équipiers recevront automatiquement les trois rôles (Guerrier, Archer, Mage).</p>
      <div class="career-weapon-grid">${weaponHtml}</div>
    </section>
    <p class="career-status">${canConfirm ? '✅ Tu peux commencer !' : (check.reason || nicknameCheck.reason || 'Choisis ton arme.')}</p>
    <p class="career-error save-warn hidden" id="career-error" role="alert"></p>
    <div class="career-actions">
      <button type="button" class="btn btn-prestige" id="career-confirm" ${canConfirm ? '' : 'disabled'}>${season > 1 ? 'Commencer la saison' : "Commencer l'aventure"}</button>
      <button type="button" class="btn btn-muted" id="career-reload">Actualiser</button>
      <button type="button" class="btn btn-muted" id="career-reset">Réinitialiser</button>
    </div>
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
    const check = validateOnboarding(selectedWeaponType);
    if (!check.ok) {
      renderCareerModal();
      setCareerError(check.reason || 'Sélection incomplète.');
      return;
    }
    const nickInfo = gameRef.getNicknameRenameInfo?.() || { hasNickname: false };
    if (!nickInfo.hasNickname) {
      const nicknameCheck = validateNickname(selectedNickname, gameRef.characterConfig);
      if (!nicknameCheck.ok) {
        renderCareerModal();
        setCareerError(nicknameCheck.reason || 'Pseudo invalide.');
        return;
      }
      const nickResult = gameRef.setCharacterNickname(selectedNickname, false, { silent: true });
      if (!nickResult.ok) {
        setCareerError(nickResult.reason || 'Impossible de valider ton pseudo.');
        return;
      }
    }

    const result = gameRef.doApplyCareerChoice(null, null, selectedWeaponType);
    if (!result.ok) {
      setCareerError(result.reason || 'Impossible de valider.');
      return;
    }

    closeCareerModal();
    emit('nicknameChange', { name: gameRef.getCharacterDisplayName(), renamed: false });
    emit('navRefresh');
  } catch (err) {
    console.error('Onboarding failed:', err);
    setCareerError('Erreur pendant la validation. Actualise la page.');
  }
}

function bindCareerModalListeners() {
  if (!modalEl || listenersBound) return;
  listenersBound = true;

  modalEl.addEventListener('click', (e) => {
    const weaponBtn = e.target.closest('[data-weapon-type]');
    if (weaponBtn) {
      selectedWeaponType = weaponBtn.dataset.weaponType;
      renderCareerModal();
      return;
    }
    if (e.target.closest('#career-confirm')) {
      confirmCareerChoice();
      return;
    }
    if (e.target.closest('#career-reload')) {
      forceAppRefresh(gameRef);
      return;
    }
    if (e.target.closest('#career-reset')) {
      SaveProvider.beginReset();
      SaveProvider.clear().then(() => forceNewGameReload());
    }
  });

  modalEl.addEventListener('input', (e) => {
    if (!e.target.closest('#career-nickname')) return;
    selectedNickname = e.target.value;
    renderCareerModal();
  });
}

export function initCareerChoiceModal(game) {
  gameRef = game;
  modalEl = document.getElementById('career-choice-modal');
  if (!modalEl) return;
  bindCareerModalListeners();
  selectedWeaponType = null;
  selectedNickname = '';
}

export function showCareerChoiceIfNeeded(game) {
  gameRef = game;
  if (needsAuthChoice(game.state)) {
    closeCareerModal();
    // Compte perdu (ex. bug prestige) → rouvrir l’auth plutôt que bloquer sans UI
    showAuthModalIfNeeded(game);
    return;
  }
  if (!game.needsCareerChoice()) {
    closeCareerModal();
    return;
  }
  selectedWeaponType = game.state.careerChoice?.weaponType || null;
  selectedNickname = game.state.character?.nickname?.trim() || '';
  document.body.classList.add('career-choice-pending');
  modalEl?.classList.add('active');
  renderCareerModal();
}

export function hideCareerChoiceModal() {
  closeCareerModal();
}
