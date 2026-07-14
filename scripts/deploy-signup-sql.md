# Déployer les RPC d'inscription (pseudo unique)

## Option A — SQL Editor (recommandé)

1. Ouvre [SQL Editor Supabase](https://supabase.com/dashboard/project/jmakrpkocxlyykgfnmlv/sql/new)
2. Colle le contenu de `supabase/migrations/20260714120000_signup_pseudo_inventory_admin.sql`
3. Clique **Run**

## Option B — Script Node (avec mot de passe DB)

```bash
export SUPABASE_DB_URL="postgresql://postgres.jmakrpkocxlyykgfnmlv:[MOT_DE_PASSE]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
npm install pg
node scripts/deploy-signup-sql.mjs
```

## Vérifier

```sql
select proname from pg_proc
where proname in ('check_display_name_available', 'create_profile_on_signup')
order by proname;
```

## Note

Le jeu fonctionne **sans** cette migration grâce au fallback client (lecture table `profiles`). La migration renforce l'unicité côté serveur (index unique + RPC).
