import { emit } from './events.js';
import { DEV_FAKE_ACCOUNT, SUPABASE_URL } from '../config.js';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import { validateNickname } from '../systems/character.js';
import { checkDisplayNameAvailable, createProfileOnSignup } from '../systems/accountProfile.js';

const GUEST_ADJECTIVES = ['Pétale', 'Brise', 'Jade', 'Lotus', 'Brume', 'Cerisier', 'Kiri', 'Zen'];
const AUTH_SESSION_KEY = 'tokirha_auth_mode';

/** Comptes propriétaires (filet de sécurité si la RPC rôle échoue côté client). */
const OWNER_SUPERADMIN_IDS = {
  '4262ac27-fcc8-45b8-9251-0b42a1e6d148': 'superadmin', // Veayce
};

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

/** Panneau Admin — admin / superadmin (pas simple modérateur). */
export function isAdmin() {
  if (authState.mode !== 'registered' || authState.isBanned) return false;
  bootstrapOwnerRole();
  const role = getProfileRole();
  return role === 'admin' || role === 'superadmin' || authState.adminAccess === true;
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
  hydrateStaffRoleFromCache();
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
    hydrateStaffRoleFromCache();
  }
}

function normalizeProfilePayload(data) {
  if (!data) return null;
  let payload = data;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (Array.isArray(payload)) payload = payload[0];
  if (!payload || typeof payload !== 'object') return null;
  return payload;
}

function staffCacheKey(userId = authState.userId) {
  return userId ? `tokirha_staff_role_${userId}` : 'tokirha_staff_role';
}

function writeStaffRoleCache(role) {
  try {
    if (!['moderator', 'admin', 'superadmin'].includes(role)) return;
    if (!authState.userId) return;
    // Uniquement par userId — jamais de clé globale (sinon un autre compte hérite du staff)
    localStorage.setItem(staffCacheKey(), role);
    sessionStorage.setItem(staffCacheKey(), role);
    localStorage.removeItem('tokirha_staff_role');
    sessionStorage.removeItem('tokirha_staff_role');
  } catch {
    // ignore
  }
}

function clearStaffRoleCache() {
  try {
    localStorage.removeItem('tokirha_staff_role');
    sessionStorage.removeItem('tokirha_staff_role');
    if (authState.userId) {
      localStorage.removeItem(staffCacheKey());
      sessionStorage.removeItem(staffCacheKey());
    }
  } catch {
    // ignore
  }
}

function readStaffRoleCache() {
  try {
    if (!authState.userId) return null;
    const cached = sessionStorage.getItem(staffCacheKey()) || localStorage.getItem(staffCacheKey());
    if (cached && ['moderator', 'admin', 'superadmin'].includes(cached)) return cached;
  } catch {
    // ignore
  }
  return null;
}

/** Owners connus (UUID) : garantit le superadmin même si la sync RPC rate. */
function bootstrapOwnerRole() {
  if (authState.mode !== 'registered' || authState.isBanned || !authState.userId) return false;
  const byId = OWNER_SUPERADMIN_IDS[authState.userId];
  if (byId) {
    authState.role = byId;
    authState.adminAccess = true;
    writeStaffRoleCache(byId);
    return true;
  }
  return false;
}

function hydrateStaffRoleFromCache() {
  if (authState.mode !== 'registered' || authState.isBanned) return;
  if (bootstrapOwnerRole()) return;
  if (['moderator', 'admin', 'superadmin'].includes(authState.role)) return;
  const cached = readStaffRoleCache();
  if (!cached) return;
  authState.role = cached;
  authState.adminAccess = cached === 'admin' || cached === 'superadmin' || cached === 'moderator';
}

function applyProfileData(profile) {
  const normalized = normalizeProfilePayload(profile);
  if (!normalized) return;

  authState.profileSynced = true;
  const rawRole = normalized.role;
  let role = (typeof rawRole === 'string' && rawRole.trim()) ? rawRole.trim() : 'player';
  const accessFlag = normalized.admin_access === true
    || normalized.admin_access === 'true'
    || normalized.adminAccess === true
    || role === 'admin'
    || role === 'superadmin'
    || role === 'moderator';

  if (accessFlag && !['moderator', 'admin', 'superadmin'].includes(role)) {
    const cached = readStaffRoleCache();
    if (cached) role = cached;
    else if (normalized.admin_access === true || normalized.admin_access === 'true') role = 'admin';
  }

  // Owner bootstrap : ne jamais rétrograder Veayce à player via une RPC foireuse
  // Filet owner UUID uniquement (pas le pseudo — évite faux admin + Accès refusé serveur)
  if (OWNER_SUPERADMIN_IDS[authState.userId] && !['admin', 'superadmin'].includes(role)) {
    role = 'superadmin';
  }

  authState.role = role;
  authState.adminAccess = accessFlag
    || role === 'admin'
    || role === 'superadmin'
    || role === 'moderator';
  authState.isBanned = !!normalized.is_banned;
  authState.bannedReason = normalized.banned_reason || null;
  authState.cheatFlagged = !!normalized.cheat_flagged;
  if (normalized.display_name) {
    authState.displayName = normalized.display_name;
  }
  authState.freeRenameUsed = !!normalized.free_rename_used;

  if (['moderator', 'admin', 'superadmin'].includes(authState.role)) {
    writeStaffRoleCache(authState.role);
  } else if (authState.profileSynced && authState.role === 'player' && !authState.adminAccess) {
    // Ne jamais effacer le cache owner
    if (!OWNER_SUPERADMIN_IDS[authState.userId]) clearStaffRoleCache();
  }

  bootstrapOwnerRole();
}

/** Panneau Admin visible pour admin / superadmin (serveur, cache ou owner). */
export function canSeeAdminPanel() {
  if (authState.mode !== 'registered' || authState.isBanned) return false;
  bootstrapOwnerRole();
  const role = getProfileRole();
  if (role === 'admin' || role === 'superadmin') return true;
  if (authState.adminAccess === true) return true;
  const cached = readStaffRoleCache();
  return cached === 'admin' || cached === 'superadmin';
}

export function getProfileRole() {
  bootstrapOwnerRole();
  const live = authState.role || 'player';
  if (['moderator', 'admin', 'superadmin'].includes(live)) return live;
  if (authState.adminAccess) {
    return readStaffRoleCache() || 'admin';
  }
  return readStaffRoleCache() || live;
}

export function isStaff() {
  if (authState.mode !== 'registered' || authState.isBanned) return false;
  bootstrapOwnerRole();
  const role = getProfileRole();
  if (['moderator', 'admin', 'superadmin'].includes(role)) return true;
  if (authState.adminAccess === true) return true;
  const cached = readStaffRoleCache();
  return cached === 'moderator' || cached === 'admin' || cached === 'superadmin';
}

export function isSuperAdmin() {
  if (authState.mode !== 'registered' || authState.isBanned) return false;
  return getProfileRole() === 'superadmin';
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
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData?.session?.user;
    if (!sessionUser && authState.userId !== 'dev_local_user') {
      console.warn('[auth] syncProfile: pas de session');
      return null;
    }

    // Toujours aligner le userId local sur le JWT (sinon onglet Admin faux + Accès refusé)
    if (sessionUser?.id && authState.userId !== sessionUser.id) {
      authState.userId = sessionUser.id;
      authState.email = sessionUser.email || authState.email;
      authState.mode = 'registered';
      authState.isGuest = false;
    }

    const { data, error } = await supabase.rpc('get_my_profile');
    const profile = normalizeProfilePayload(data);
    if (!error && profile) {
      applyProfileData(profile);
      emit('authChange', getAuthState());
      emit('navRefresh');
      return profile;
    }
    if (error) console.warn('[auth] get_my_profile:', error.message);

    if (authState.userId && authState.userId !== 'dev_local_user') {
      const { data: row, error: rowErr } = await supabase
        .from('profiles')
        .select('user_id, display_name, role, is_banned, banned_reason, cheat_flagged, free_rename_used')
        .eq('user_id', authState.userId)
        .maybeSingle();
      if (!rowErr && row) {
        applyProfileData({
          ...row,
          admin_access: row.role === 'admin' || row.role === 'superadmin',
        });
        emit('authChange', getAuthState());
        emit('navRefresh');
        return row;
      }
      if (rowErr) console.warn('[auth] profiles select:', rowErr.message);
    }
    emit('navRefresh');
    return null;
  } catch (err) {
    console.warn('[auth] syncProfile failed', err);
    emit('navRefresh');
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

  if (authState.mode === 'registered') {
    await syncProfileFromServer();
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
  const { markCloudSyncReady, loadCloudSave, mergeCloudAndLocal, isEmptyOrStarterSave } = await import('./cloudSave.js');
  markCloudSyncReady(false);

  const previousLocal = game.state;
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

  try {
    const cloud = await loadCloudSave(user.id);
    if (cloud?.data) {
      const merged = await mergeCloudAndLocal(cloud, previousLocal, game.balance, { userId: user.id });
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
    } else if (isEmptyOrStarterSave(previousLocal)) {
      // Nouveau compte / pas encore de cloud — garder l’état actuel
    }
  } finally {
    markCloudSyncReady(true);
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
    options: {
      data: { display_name: nickCheck.name },
      emailRedirectTo: typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : undefined,
    },
  });
  if (error) return { ok: false, reason: error.message };
  if (!data.session) {
    return {
      ok: true,
      needsEmailConfirm: true,
      message: 'Compte créé ! Vérifie ta boîte mail et clique sur le lien pour activer ton compte — tu seras alors connecté automatiquement.',
    };
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

let authListenerBound = false;

/** Écoute la confirmation email / session URL → connexion auto. */
export async function setupAuthStateListener(game) {
  if (authListenerBound || !isSupabaseConfigured()) return;
  const supabase = await getSupabaseClient();
  if (!supabase) return;
  authListenerBound = true;

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event !== 'SIGNED_IN') return;
    const user = session?.user;
    if (!user) return;

    if (authState.mode === 'registered' && authState.userId === user.id && authState.profileSynced) {
      window.dispatchEvent(new CustomEvent('tokirha:auth-session-ready'));
      emit('navRefresh');
      return;
    }

    try {
      await completeRegisteredLogin(game, user);
      try {
        if (window.location.hash || /[?&](code|type)=/.test(window.location.search)) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch {
        // ignore
      }
      window.dispatchEvent(new CustomEvent('tokirha:auth-session-ready'));
      emit('navRefresh');
    } catch (err) {
      console.warn('[auth] session auto-login failed', err);
    }
  });
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
