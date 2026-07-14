#!/usr/bin/env node
/**
 * Déploie les RPC d'inscription Supabase (pseudo unique).
 * Usage : SUPABASE_DB_URL="postgresql://postgres.[ref]:[password]@..." node scripts/deploy-signup-sql.mjs
 *
 * URL : Supabase Dashboard → Project Settings → Database → Connection string (URI)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Définis SUPABASE_DB_URL (connection string PostgreSQL Supabase).');
  process.exit(1);
}

const root = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(root, '../supabase/migrations/20260714120000_signup_pseudo_inventory_admin.sql');
const sql = readFileSync(sqlPath, 'utf8');

let pg;
try {
  pg = await import('pg');
} catch {
  console.error('Installe pg : npm install pg');
  process.exit(1);
}

const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query(sql);
  console.log('Migration signup/admin déployée avec succès.');
} catch (e) {
  console.error('Échec :', e.message);
  process.exit(1);
} finally {
  await client.end();
}
