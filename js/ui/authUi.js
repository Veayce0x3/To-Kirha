import { emit } from '../core/events.js';
import {
  applyGuestToState,
  completeRegisteredLogin,
  generateGuestDisplayName,
  getAuthState,
  hasFreeRenameAvailable,
  applyServerDisplayNameToGame,
  refreshProfile,
  isSupabaseOnline,
  needsAuthChoice,
  signInWithEmail,
  signUpWithEmail,
  isAccountBanned,
  canSeeAdminPanel,
  signOutAccount,
  logoutToWelcomeScreen,
} from '../core/auth.js';
import { changeDisplayNameFree, deleteMyAccount } from '../systems/accountProfile.js';

let gameRef = null;
let modalEl = null;
let resolveAuthPromise = null;

export function initAuthModal(game) {
  gameRef = game;
  modalEl = document.getElementById('auth-modal');
  if (!modalEl) return;
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) return;
  });
}

export function showBannedModalIfNeeded() {
  if (!isAccountBanned()) return false;
  if (!modalEl) return false;
  const auth = getAuthState();
  const body = modalEl.querySelector('#auth-modal-body');
  body.innerHTML = `
    <h2 class="auth-title">⛔ Compte suspendu</h2>
    <p class="auth-desc">${auth.bannedReason || 'Ton compte a été suspendu par un modérateur.'}</p>
    <p class="auth-desc">Tu peux encore jouer en mode invité sur cet appareil, ou contacter l'équipe si tu penses qu'il s'agit d'une erreur.</p>
    <button type="button" class="btn btn-muted" id="auth-banned-signout">Se déconnecter</button>
    <button type="button" class="btn btn-craft" id="auth-banned-guest">Jouer en invité</button>
  `;
  modalEl.classList.add('active');
  document.body.classList.add('auth-modal-open');
  body.querySelector('#auth-banned-signout')?.addEventListener('click', async () => {
    await logoutToWelcomeScreen(gameRef);
  });
  body.querySelector('#auth-banned-guest')?.addEventListener('click', async () => {
    await logoutToWelcomeScreen(gameRef);
    const name = applyGuestToState(gameRef.state, generateGuestDisplayName());
    gameRef.scheduleSave?.();
    emit('nicknameChange', { name, renamed: false });
    finishAuth();
  });
  return true;
}

export function showAuthModalIfNeeded(game) {
  if (!needsAuthChoice(game.state)) return Promise.resolve(getAuthState());
  return new Promise((resolve) => {
    resolveAuthPromise = resolve;
    openAuthModal('welcome');
  });
}

function closeAuthModal() {
  modalEl?.classList.remove('active');
  document.body.classList.remove('auth-modal-open');
}

function finishAuth() {
  closeAuthModal();
  const state = getAuthState();
  resolveAuthPromise?.(state);
  resolveAuthPromise = null;
  emit('authChange', state);
  emit('navRefresh');
}

function openAuthModal(mode = 'welcome') {
  if (!modalEl) return;
  renderAuthBody(mode);
  modalEl.classList.add('active');
  document.body.classList.add('auth-modal-open');
}

/** Écran d'accueil connexion / invité / créer un compte (après déconnexion ou premier lancement). */
export function showAuthWelcomeScreen() {
  resolveAuthPromise = null;
  openAuthModal('welcome');
}

function renderAuthBody(mode) {
  const body = modalEl.querySelector('#auth-modal-body');
  if (!body) return;

  const supabaseOk = isSupabaseOnline();

  if (mode === 'welcome') {
    body.innerHTML = `
      <h2 class="auth-title">🌸 Bienvenue sur To-Kirha</h2>
      <p class="auth-desc">Choisis comment tu veux jouer.</p>
      <div class="auth-guest-box">
        <h3>Mode invité</h3>
        <p>Progression <strong>uniquement sur cet appareil</strong>. Pas d’HDV ni de classement. Un pseudo sera généré automatiquement.</p>
        <button type="button" class="btn btn-muted btn-auth-guest" id="auth-guest-btn">Jouer en invité</button>
      </div>
      <div class="auth-account-box">
        <h3>Compte</h3>
        <p>Save cloud, HDV test + joueurs, classement.${supabaseOk ? '' : ' <em>(Configure js/config.js pour activer Supabase.)</em>'}</p>
        <button type="button" class="btn btn-craft" id="auth-show-signup" ${supabaseOk ? '' : 'disabled'}>Créer un compte</button>
        <button type="button" class="btn btn-muted" id="auth-show-login" ${supabaseOk ? '' : 'disabled'}>Se connecter</button>
      </div>
    `;
    body.querySelector('#auth-guest-btn')?.addEventListener('click', () => {
      const name = applyGuestToState(gameRef.state, generateGuestDisplayName());
      gameRef.scheduleSave?.();
      emit('nicknameChange', { name, renamed: false });
      finishAuth();
    });
    body.querySelector('#auth-show-signup')?.addEventListener('click', () => renderAuthBody('signup'));
    body.querySelector('#auth-show-login')?.addEventListener('click', () => renderAuthBody('login'));
    return;
  }

  if (mode === 'signup') {
    body.innerHTML = `
      <h2 class="auth-title">Créer un compte</h2>
      <p class="auth-desc">Email et mot de passe</p>
      <label class="auth-label">Pseudo <span class="auth-hint">(3–20 car., lettres/chiffres/espaces/tirets/apostrophes, unique)</span></label>
      <input type="text" class="nickname-input auth-input" id="auth-signup-name" maxlength="20" minlength="3" placeholder="Ex. Kira" autocomplete="username" />
      <p class="auth-field-hint" id="auth-name-hint" hidden></p>
      <label class="auth-label">Email</label>
      <input type="email" class="auth-input" id="auth-signup-email" autocomplete="email" />
      <label class="auth-label">Mot de passe <span class="auth-hint">(6–72 car., tous caractères autorisés)</span></label>
      <input type="password" class="auth-input" id="auth-signup-password" autocomplete="new-password" minlength="6" maxlength="72" />
      <label class="auth-label">Confirmer le mot de passe</label>
      <input type="password" class="auth-input" id="auth-signup-password-confirm" autocomplete="new-password" minlength="6" maxlength="72" />
      <p class="auth-error" id="auth-error" hidden></p>
      <button type="button" class="btn btn-craft" id="auth-signup-submit">Créer mon compte</button>
      <button type="button" class="btn btn-link auth-back" id="auth-back">← Retour</button>
    `;
    bindAuthError(body);
    const nameInput = body.querySelector('#auth-signup-name');
    let nameCheckTimer = null;
    nameInput?.addEventListener('input', () => {
      clearTimeout(nameCheckTimer);
      nameCheckTimer = setTimeout(async () => {
        const hint = body.querySelector('#auth-name-hint');
        const name = nameInput.value?.trim() || '';
        if (!name) { hint.hidden = true; return; }
        const { validateNickname } = await import('../systems/character.js');
        const format = validateNickname(name, { nicknameMaxLength: 20, nicknameMinLength: 3 });
        if (!format.ok) {
          hint.hidden = false;
          hint.className = 'auth-field-hint auth-error';
          hint.textContent = format.reason;
          return;
        }
        const { checkDisplayNameAvailable } = await import('../systems/accountProfile.js');
        const avail = await checkDisplayNameAvailable(format.name);
        hint.hidden = false;
        hint.className = avail.ok && avail.available ? 'auth-field-hint auth-info' : 'auth-field-hint auth-error';
        hint.textContent = avail.ok
          ? (avail.available ? 'Pseudo disponible ✓' : 'Ce pseudo est déjà pris')
          : (avail.reason || 'Vérification impossible');
      }, 400);
    });
    body.querySelector('#auth-signup-submit')?.addEventListener('click', async () => {
      const name = body.querySelector('#auth-signup-name')?.value || '';
      const email = body.querySelector('#auth-signup-email')?.value || '';
      const password = body.querySelector('#auth-signup-password')?.value || '';
      const passwordConfirm = body.querySelector('#auth-signup-password-confirm')?.value || '';
      if (password !== passwordConfirm) {
        return showAuthError(body, 'Les mots de passe ne correspondent pas.');
      }
      const result = await signUpWithEmail(email, password, name);
      if (!result.ok) return showAuthError(body, result.reason);
      if (result.needsEmailConfirm) {
        body.innerHTML = `
          <h2 class="auth-title">Compte créé ✓</h2>
          <p class="auth-desc auth-info">${result.message}</p>
          <p class="auth-desc">Ouvre le mail (et les indésirables si besoin), clique sur le lien, puis reviens ici — la connexion se fait toute seule.</p>
          <p class="auth-desc" id="auth-confirm-wait">En attente de confirmation…</p>
          <button type="button" class="btn btn-muted" id="auth-back">← Retour</button>
        `;
        const waitEl = body.querySelector('#auth-confirm-wait');
        const onReady = () => {
          window.removeEventListener('tokirha:auth-session-ready', onReady);
          if (waitEl) waitEl.textContent = 'Connecté ! Bonne aventure.';
          if (isAccountBanned()) {
            showBannedModalIfNeeded();
            resolveAuthPromise?.(getAuthState());
            resolveAuthPromise = null;
            return;
          }
          finishAuth();
        };
        window.addEventListener('tokirha:auth-session-ready', onReady);
        body.querySelector('#auth-back')?.addEventListener('click', () => {
          window.removeEventListener('tokirha:auth-session-ready', onReady);
          renderAuthBody('welcome');
        });
        return;
      }
      await completeRegisteredLogin(gameRef, result.user);
      if (isAccountBanned()) {
        showBannedModalIfNeeded();
        resolveAuthPromise?.(getAuthState());
        resolveAuthPromise = null;
        return;
      }
      finishAuth();
    });
    body.querySelector('#auth-back')?.addEventListener('click', () => renderAuthBody('welcome'));
    return;
  }

  if (mode === 'login') {
    body.innerHTML = `
      <h2 class="auth-title">Connexion</h2>
      <label class="auth-label">Email</label>
      <input type="email" class="auth-input" id="auth-login-email" autocomplete="email" />
      <label class="auth-label">Mot de passe <span class="auth-hint">(6–72 car.)</span></label>
      <input type="password" class="auth-input" id="auth-login-password" autocomplete="current-password" minlength="6" maxlength="72" />
      <p class="auth-error" id="auth-error" hidden></p>
      <button type="button" class="btn btn-craft" id="auth-login-submit">Se connecter</button>
      <button type="button" class="btn btn-link auth-back" id="auth-back">← Retour</button>
    `;
    bindAuthError(body);
    body.querySelector('#auth-login-submit')?.addEventListener('click', async () => {
      const email = body.querySelector('#auth-login-email')?.value || '';
      const password = body.querySelector('#auth-login-password')?.value || '';
      const result = await signInWithEmail(email, password);
      if (!result.ok) return showAuthError(body, result.reason);
      await completeRegisteredLogin(gameRef, result.user);
      if (isAccountBanned()) {
        showBannedModalIfNeeded();
        resolveAuthPromise?.(getAuthState());
        resolveAuthPromise = null;
        return;
      }
      finishAuth();
    });
    body.querySelector('#auth-back')?.addEventListener('click', () => renderAuthBody('welcome'));
  }
}

function bindAuthError(body) {
  body.querySelector('#auth-error')?.setAttribute('hidden', '');
}

function showAuthError(body, msg, kind = 'error') {
  const el = body.querySelector('#auth-error');
  if (!el) return;
  el.hidden = false;
  el.textContent = msg;
  el.className = kind === 'info' ? 'auth-info' : 'auth-error';
}

/** Modal « compte requis » pour HDV / classement. */
export function showAccountRequiredModal(reason) {
  if (!modalEl) return;
  const body = modalEl.querySelector('#auth-modal-body');
  body.innerHTML = `
    <h2 class="auth-title">Compte requis</h2>
    <p class="auth-desc">${reason || 'Crée un compte pour accéder à cette fonctionnalité.'}</p>
    <button type="button" class="btn btn-craft" id="auth-goto-signup">Créer un compte</button>
    <button type="button" class="btn btn-muted" id="auth-goto-login">Se connecter</button>
    <button type="button" class="btn btn-link" id="auth-modal-close">Fermer</button>
  `;
  modalEl.classList.add('active');
  document.body.classList.add('auth-modal-open');
  body.querySelector('#auth-goto-signup')?.addEventListener('click', () => renderAuthBody('signup'));
  body.querySelector('#auth-goto-login')?.addEventListener('click', () => renderAuthBody('login'));
  body.querySelector('#auth-modal-close')?.addEventListener('click', closeAuthModal);
}

export function renderAccountPanel(game, container, { hideDelete = false } = {}) {
  const auth = getAuthState();
  const isGuest = auth.mode === 'guest';
  container.innerHTML = `
    <div class="panel-inner account-panel">
      <h3>👤 Compte</h3>
      ${isGuest ? `
        <p class="guest-banner warn">Mode invité — progression locale uniquement. Pas d’HDV ni de classement.</p>
        <p class="view-desc">Pseudo : <strong>${auth.displayName || '—'}</strong></p>
        <button type="button" class="btn btn-craft" id="account-upgrade">Créer un compte</button>
      ` : auth.mode === 'registered' ? `
        <p class="view-desc">Connecté · ${auth.email || auth.userId}</p>
        <p class="view-desc">Pseudo : <strong>${game.getCharacterDisplayName()}</strong></p>
        ${hasFreeRenameAvailable() ? `
          <div class="account-free-rename">
            <label class="auth-label" for="account-free-rename-input">Changer de pseudo (gratuit, 1 fois)</label>
            <div class="nickname-row">
              <input id="account-free-rename-input" class="auth-input" type="text" maxlength="20" value="${game.getCharacterDisplayName()}" />
              <button type="button" class="btn btn-craft btn-sm" id="account-free-rename">Valider</button>
            </div>
          </div>
        ` : ''}
        ${auth.isBanned ? '<p class="guest-banner warn">Compte suspendu</p>' : ''}
        ${canSeeAdminPanel() ? `<p class="view-desc"><button type="button" class="link-btn" id="account-goto-admin">Administration</button></p>` : ''}
        <button type="button" class="btn btn-muted" id="account-signout">Se déconnecter</button>
        ${hideDelete ? '' : `
        <button type="button" class="btn btn-danger btn-sm" id="account-delete">Supprimer mon compte</button>
        <p class="view-desc account-delete-hint">Supprime définitivement ton compte et tes données en ligne. Tu pourras recréer un compte avec la même adresse email.</p>
        `}
      ` : `
        <p class="view-desc">Non connecté</p>
        <button type="button" class="btn btn-craft" id="account-login">Se connecter</button>
      `}
    </div>
  `;
  container.querySelector('#account-upgrade')?.addEventListener('click', () => openAuthModal('signup'));
  container.querySelector('#account-login')?.addEventListener('click', () => openAuthModal('login'));
  container.querySelector('#account-goto-admin')?.addEventListener('click', async () => {
    const { navigate } = await import('./router.js');
    navigate('admin');
  });
  container.querySelector('#account-signout')?.addEventListener('click', async () => {
    const btn = container.querySelector('#account-signout');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Déconnexion…';
    }
    try {
      await logoutToWelcomeScreen(game);
    } catch {
      emit('nicknameError', { reason: 'Impossible de se déconnecter. Réessaie.' });
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Se déconnecter';
      }
    }
  });

  container.querySelector('#account-free-rename')?.addEventListener('click', async () => {
    const input = container.querySelector('#account-free-rename-input');
    const result = await changeDisplayNameFree(input?.value || '', game.characterConfig);
    if (!result.ok) {
      emit('nicknameError', { reason: result.reason });
      return;
    }
    const name = result.data?.display_name || input?.value?.trim();
    applyServerDisplayNameToGame(game, name);
    await refreshProfile();
    game.scheduleSave?.();
    emit('nicknameChange', { name, renamed: true, free: true });
    emit('navRefresh');
    renderAccountPanel(game, container);
  });

  container.querySelector('#account-delete')?.addEventListener('click', async () => {
    const typed = prompt('Tape SUPPRIMER pour confirmer la suppression définitive de ton compte :');
    if (typed !== 'SUPPRIMER') return;
    const result = await deleteMyAccount();
    if (!result.ok) {
      emit('nicknameError', { reason: result.reason || 'Impossible de supprimer le compte.' });
      return;
    }
    await signOutAccount();
    delete game.state.meta?.account;
    location.href = `${location.pathname}?newgame=1`;
  });
}

export function renderGuestBanner(game) {
  if (game.state?.meta?.account?.mode !== 'guest') return '';
  return `<p class="guest-banner sticky-hint">Mode invité — sauvegarde locale uniquement · <button type="button" class="link-btn" id="guest-upgrade-hdv">Créer un compte</button></p>`;
}
