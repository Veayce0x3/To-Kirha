/**
 * Exemple — la config prod est dans js/config.js (clé anon publique, OK à committer).
 * Ne jamais y mettre la service_role Supabase.
 */
export const SUPABASE_URL = 'https://VOTRE_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...';

/** false en prod — true permet de tester sans Supabase (compte dev fictif). */
export const DEV_FAKE_ACCOUNT = false;
