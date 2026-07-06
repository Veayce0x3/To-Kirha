/**
 * Config Supabase (clé anon = publique côté client, protégée par RLS).
 * Nécessaire pour GitHub Pages — ne jamais mettre la service_role ici.
 */
export const SUPABASE_URL = 'https://jmakrpkocxlyykgfnmlv.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWtycGtvY3hseXlrZ2ZubWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzQ5OTcsImV4cCI6MjA5NzcxMDk5N30.QDkUpvMkQIvFxgSqYgMPr2LERlYA_S684WnFlGaIAds';

/** false en prod — true = compte dev fictif sans Supabase. */
export const DEV_FAKE_ACCOUNT = false;
