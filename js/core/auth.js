import { emit } from './events.js';
import { DEV_FAKE_ACCOUNT, SUPABASE_URL } from '../config.js';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import { validateNickname } from '../systems/character.js';
import { checkDisplayNameAvailable, createProfileOnSignup } from '../systems/accountProfile.js';

const GUEST_ADJECTIVES = ['Pétale', 'Brise', 'Jade', 'Lotus', 'Brume', 'Cerisier', 'Kiri', 'Zen'];
const AUTH_SESSION_KEY = 'tokirha_auth_mode';

let authState = {
  mode: null, // 'guest' | 'registered' | null
  userId: null,
  email: null,
  isGuest: true,
  displayName: null,
  role: 'player',
  adminAccess: false,
  profileSynced: false,
  isBanned: false,
  bannedReason: null,
  cheatFlagged: false,
  freeRenameUsed: false,
  ready: false,
};

export function getAuthState() {
  return { ...authState };
}

export function isRegisteredAccount() {
  return authState.mode === 'registered' && !!authState.userId;
}

export function isAccountBanned() {
  return authState.isBanned === true;
}

export function isStaff() {
  return authState.mode === 'registered'
    && !authState.isBanned
    && authState.profileSynced
    && ['moderator', 'admin', 'superadmin'].includes(authState.role);
}

/** Panneau Admin visible uniquement pour admin / superadmin (confirmé par le serveur). */
export function canSeeAdminPanel() {
  return authState.mode === 'registered'
    && !authState.isBanned
    && authState.profileSynced
    && authState.adminAccess === true;
}

export function isAdmin() {
  return canSeeAdminPanel();
}

export function isSuperAdmin() {
  return authState.mode === 'registered'
    && !authState.isBanned
    && authState.profileSynced
    && authState.role === 'superadmin';
}

export function getProfileRole() {
  return authState.role || 'player';
}

export function isGuestAccount() {
  return authState.mode === 'guest';
}

export function canUseOnlineFeatures() {
  return isRegisteredAccount() && !authState.isBanned;
}

export function generateGuestDisplayName() {
  const adj = GUEST_ADJECTIVES[Math.floor(Math.random() * GUEST_ADJECTIVES.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj}#${num}`;
}

export function applyGuestToState(state, displayName) {
  const name = displayName || generateGuestDisplayName();
  if (!state.meta) state.meta = {};
  state.meta.account = {
    mode: 'guest',
    guestId: `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  if (!state.character) state.character = { level: 1, xp: 0 };
  state.character.nickname = name;
  state.character.nicknameUpdatedAt = Date.now();
  authState = {
    mode: 'guest',
    userId: state.meta.account.guestId,
    email: null,
    isGuest: true,
    displayName: name,
    role: 'player',
    adminAccess: false,
    profileSynced: false,
    isBanned: false,
    bannedReason: null,
    cheatFlagged: false,
    freeRenameUsed: false,
    ready: true,
  };
  try {
    sessionStorage.setItem(AUTH_SESSION_KEY, 'guest');
  } catch {}
  emit('authChange', getAuthState());
  return name;
}

export function applyRegisteredToState(state, { userId, email, displayName }) {
  if (!state.meta) state.meta = {};
  state.meta.account = {
    mode: 'registered',
    userId,
    email: email || null,
    linkedAt: Date.now(),
  };
  authState = {
    mode: 'registered',
    userId,
    email: email || null,
    isGuest: false,
    displayName: displayName || state.character?.nickname || null,
    role: 'player',
    adminAccess: false,
    profileSynced: false,
    isBanned: false,
    bannedReason: null,
    cheatFlagged: false,
    freeRenameUsed: false,
    ready: true,
  };
  try {
    sessionStorage.setItem(AUTH_SESSION_KEY, 'registered');
  } catch {}
  emit('authChange', getAuthState());
}

export function syncAuthFromState(state) {
  const acc = state?.meta?.account;
  if (acc?.mode === 'guest') {
    authState = {
      mode: 'guest',
      userId: acc.guestId || null,
      email: null,
      isGuest: true,
      displayName: state.character?.nickname?.trim() || null,
      role: 'player',
      adminAccess: false,
      profileSynced: false,
      isBanned: false,
      bannedReason: null,
      cheatFlagged: false,
      freeRenameUsed: false,
      ready: true,
    };
    return;
  }
  if (acc?.mode === 'registered' && acc.userId) {
    authState = {
      mode: 'registered',
      userId: acc.userId,
      email: acc.email || null,
      isGuest: false,
      displayName: state.character?.nickname?.trim() || null,
      role: 'player',
      adminAccess: false,
      profileSynced: false,
      isBanned: false,
      bannedReason: null,
      cheatFlagged: false,
      freeRenameUsed: false,
      ready: true,
    };
  }
}

function applyProfileData(profile) {
  if (!profile) return;
  authState.profileSynced = true;
  const role = profile.role || 'player';
  authState.role = role;
  // admin_access serveur + repli sur le rôle (évite faux négatif après reset/sync)
  authState.adminAccess = profile.admin_access === true
    || role === 'admin'
    || role === 'superadmin';
  authState.isBanned = !!profile.is_banned;
  authState.bannedReason = profile.banned_reason || null;
  authState.cheatFlagged = !!profile.cheat_flagged;
  if (profile.display_name) {
    authState.displayName = profile.display_name;
  }
  authState.freeRenameUsed = !!profile.free_rename_used;
}

export function hasFreeRenameAvailable() {
  return isRegisteredAccount() && !authState.freeRenameUsed;
}

/** Applique le pseudo serveur au personnage après connexion. */
export function applyServerDisplayNameToGame(game, displayName) {
  const name = displayName?.trim();
  if (!name || !game?.state) return;
  game.state.character = game.state.character || { level: 1, xp: 0 };
  game.state.character.nickname = name;
  game.state.character.nicknameUpdatedAt = Date.now();
}

export async function syncProfileFromServer() {
  if (!isSupabaseConfigured() || authState.mode !== 'registered') return null;
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.rpc('get_my_profile');
    if (!error && data) {
      applyProfileData(data);
      emit('authChange', getAuthState());
      emit('navRefresh');
    }
    return data;
  } catch {
    return null;
  }
}

export async function refreshProfile() {
  return syncProfileFromServer();
}

export async function initAuth(game) {
  syncAuthFromState(game.state);

  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const localAcc = game.state?.meta?.account;
    const sessionUser = session?.user;
    const sessionMatchesLocal = sessionUser
      && localAcc?.mode === 'registered'
      && localAcc.userId === sessionUser.id;
    const shouldAdoptSession = sessionUser && (
      !localAcc?.mode
      || localAcc.mode === 'guest'
      || (localAcc.mode === 'registered' && localAcc.userId !== sessionUser.id)
    );

    if (sessionMatchesLocal || shouldAdoptSession) {
      applyRegisteredToState(game.state, {
        userId: sessionUser.id,
        email: sessionUser.email,
        displayName: null,
      });
      await ensureProfile(supabase, sessionUser);
      const profile = await syncProfileFromServer();
      const serverName = profile?.display_name
        || sessionUser.user_metadata?.display_name
        || sessionUser.email?.split('@')[0]
        || 'Voyageur';
      authState.displayName = serverName;
      applyServerDisplayNameToGame(game, serverName);
      authState.ready = true;
      emit('authChange', getAuthState());
      emit('nicknameChange', { name: serverName, renamed: false });
      return getAuthState();
    }
  }

  if (DEV_FAKE_ACCOUNT && !authState.mode) {
    if (!game.state) game.state = game.getDefaultState();
    applyRegisteredToState(game.state, {
      userId: 'dev_local_user',
      email: 'dev@local.test',
      displayName: game.state.character?.nickname || 'DevLocal',
    });
    if (!game.state.character?.nickname) {
      game.state.character.nickname = 'DevLocal';
    }
    authState.ready = true;
    emit('authChange', getAuthState());
    return getAuthState();
  }

  if (authState.mode) {
    authState.ready = true;
    return getAuthState();
  }

  authState.ready = true;
  return getAuthState();
}

export function needsAuthChoice(state) {
  return !state?.meta?.account?.mode;
}

export async function ensureProfile(supabase, user) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) return;

  const displayName = (user.user_metadata?.display_name || user.email?.split('@')[0] || 'Voyageur').trim();
  const result = await createProfileOnSignup(supabase, user.id, displayName);
  if (!result.ok) throw new Error(result.reason || 'Impossible de créer le profil');
}

/** Finalise connexion / inscription : profil serveur, pseudo, save cloud. */
export async function completeRegisteredLogin(game, user) {
  applyRegisteredToState(game.state, {
    userId: user.id,
    email: user.email,
    displayName: null,
  });
  const supabase = await getSupabaseClient();
  if (supabase) await ensureProfile(supabase, user);
  const profile = await syncProfileFromServer();
  const serverName = profile?.display_name
    || user.user_metadata?.display_name
    || user.email?.split('@')[0]
    || 'Voyageur';
  authState.displayName = serverName;
  applyServerDisplayNameToGame(game, serverName);

  const { loadCloudSave, mergeCloudAndLocal } = await import('./cloudSave.js');
  const cloud = await loadCloudSave(user.id);
  if (cloud?.data) {
    const merged = await mergeCloudAndLocal(cloud, game.state, game.balance);
    if (merged) {
      game.state = game.mergeState(merged);
      applyRegisteredToState(game.state, {
        userId: user.id,
        email: user.email,
        displayName: serverName,
      });
      applyServerDisplayNameToGame(game, serverName);
      await syncProfileFromServer();
    }
  }

  game.scheduleSave?.();
  emit('authChange', getAuthState());
  emit('nicknameChange', { name: serverName, renamed: false });
  emit('stateChange', game.state);
  emit('navRefresh');
  return profile;
}

export async function signUpWithEmail(email, password, displayName) {
  const supabase = await getSupabaseClient();
  if (!supabase) return { ok: false, reason: 'Supabase non configuré (js/config.js).' };
  const nickCheck = validateNickname(displayName, { nicknameMaxLength: 20, nicknameMinLength: 3 });
  if (!nickCheck.ok) return nickCheck;

  if (password.length < 6) return { ok: false, reason: 'Mot de passe : minimum 6 caractères.' };
  if (password.length > 72) return { ok: false, reason: 'Mot de passe : maximum 72 caractères.' };

  const avail = await checkDisplayNameAvailable(nickCheck.name);
  if (!avail.ok) return { ok: false, reason: avail.reason };
  if (!avail.available) return { ok: false, reason: 'Ce pseudo est déjà pris.' };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: nickCheck.name } },
  });
  if (error) return { ok: false, reason: error.message };
  if (!data.session) {
    return { ok: true, needsEmailConfirm: true, message: 'Vérifie ta boîte mail pour confirmer le compte.' };
  }
  return { ok: true, user: data.user, session: data.session };
}

export async function signInWithEmail(email, password) {
  const supabase = await getSupabaseClient();
  if (!supabase) return { ok: false, reason: 'Supabase non configuré.' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, reason: error.message };
  return { ok: true, user: data.user, session: data.session };
}

export async function signOutAccount() {
  try {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseClient();
      if (supabase) await supabase.auth.signOut();
    }
  } catch (err) {
    console.warn('[auth] signOut Supabase:', err);
  }
  authState = {
    mode: null, userId: null, email: null, isGuest: true, displayName: null,
    role: 'player', adminAccess: false, profileSynced: false,
    isBanned: false, bannedReason: null, cheatFlagged: false, freeRenameUsed: false, ready: true,
  };
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch {}
  emit('authChange', getAuthState());
  return { ok: true };
}

/** Déconnexion complète : Supabase + efface le compte local + sauvegarde + écran d'accueil auth. */
export async function logoutToWelcomeScreen(game) {
  await signOutAccount();
  if (game?.state?.meta) {
    delete game.state.meta.account;
  }
  if (game?.state) {
    const { SaveProvider } = await import('./save.js');
    await SaveProvider.save(game.state, game.balance);
  }
  emit('authLoggedOut');
  return { ok: true };
}

export function getOnlineBlockReason() {
  if (isAccountBanned()) {
    return authState.bannedReason || 'Compte suspendu.';
  }
  if (canUseOnlineFeatures()) return null;
  if (isGuestAccount()) {
    return 'Mode invité — crée un compte pour accéder à l’HDV et au classement. Progression locale uniquement.';
  }
  return 'Connecte-toi pour accéder à cette fonctionnalité.';
}

export function isSupabaseOnline() {
  return isSupabaseConfigured() && !!SUPABASE_URL;
}
