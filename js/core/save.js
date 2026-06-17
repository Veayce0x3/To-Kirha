import { getDefaultSettings } from '../systems/prestige.js';

const SAVE_KEY = 'tokirha_save';

export const SaveProvider = {
  async save(data) {
    try {
      const payload = { ...data, lastOnline: Date.now() };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error('Save failed:', err);
      return false;
    }
  },

  async load() {
    try {
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('newgame') === '1') {
        localStorage.removeItem(SAVE_KEY);
        window.history.replaceState({}, '', window.location.pathname);
        return null;
      }
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('Load failed:', err);
      return null;
    }
  },

  async clear() {
    localStorage.removeItem(SAVE_KEY);
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
