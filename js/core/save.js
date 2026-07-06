import { getDefaultSettings } from '../systems/prestige.js';

import { attachIntegrityMeta, verifySaveIntegrity, validateSaveSanity } from './saveIntegrity.js';

const SAVE_KEY = 'tokirha_save';
const RESET_FLAG_KEY = 'tokirha_resetting';

function storageHasResetFlag() {
  try {
    return sessionStorage.getItem(RESET_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export const SaveProvider = {
  async save(data, balance = null) {
    try {
      if (storageHasResetFlag()) return false;
      const payload = await attachIntegrityMeta({ ...data, lastOnline: Date.now() });
      if (balance) {
        const sanity = validateSaveSanity(payload, balance);
        if (!sanity.ok) {
          console.warn('[Save] Sanity check failed:', sanity.reason);
          return false;
        }
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error('Save failed:', err);
      return false;
    }
  },

  async load(balance = null) {
    try {
      const resetRequested = typeof window !== 'undefined'
        && (new URLSearchParams(window.location.search).get('newgame') === '1' || storageHasResetFlag());
      if (resetRequested) {
        localStorage.removeItem(SAVE_KEY);
        try {
          sessionStorage.removeItem(RESET_FLAG_KEY);
        } catch {}
        if (new URLSearchParams(window.location.search).get('newgame') === '1') {
          window.history.replaceState({}, '', window.location.pathname);
        }
        return null;
      }
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const integrity = await verifySaveIntegrity(data);
      if (!integrity.ok) {
        console.warn('[Save] Integrity failed:', integrity.reason);
        return null;
      }
      if (balance) {
        const sanity = validateSaveSanity(data, balance);
        if (!sanity.ok) {
          console.warn('[Save] Sanity failed:', sanity.reason);
          return null;
        }
      }
      return data;
    } catch (err) {
      console.error('Load failed:', err);
      return null;
    }
  },

  async clear() {
    localStorage.removeItem(SAVE_KEY);
  },

  beginReset() {
    try {
      sessionStorage.setItem(RESET_FLAG_KEY, '1');
    } catch {}
  },

  isResetting() {
    return storageHasResetFlag();
  },

  encode(data) {
    const payload = {
      version: data.saveVersion || 4,
      exportedAt: Date.now(),
      data,
    };
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  },

  decode(encoded) {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(encoded.trim()))));
    if (!parsed.data || typeof parsed.data !== 'object') {
      throw new Error('Format invalide');
    }
    return parsed;
  },
};

export function createSaveProvider(type = 'local') {
  if (type === 'cloud') {
    return CloudSaveProvider;
  }
  return SaveProvider;
}

/**
 * Stub Supabase — à brancher en Phase 5+
 * Config future : docs/SUPABASE.md
 */
export const CloudSaveProvider = {
  async save(_data) {
    console.warn('[CloudSaveProvider] Non implémenté — utiliser Supabase');
    return false;
  },

  async load() {
    return null;
  },

  async login(_email, _password) {
    throw new Error('Cloud save non disponible');
  },

  async logout() {
    return true;
  },

  isAvailable() {
    return false;
  },
};

export function mergeSettings(saved) {
  return { ...getDefaultSettings(), ...(saved || {}) };
}
