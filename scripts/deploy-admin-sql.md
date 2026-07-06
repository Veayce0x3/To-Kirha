# Déployer le système admin Supabase

## 1. SQL Editor

1. Ouvre [Supabase Dashboard](https://supabase.com/dashboard/project/jmakrpkocxlyykgfnmlv/sql/new)
2. Colle le contenu de `supabase/admin_system.sql`
3. Exécute (Run)

## 2. Vérifier

Dans le SQL Editor :

```sql
select proname from pg_proc
where proname like 'admin_%' or proname = 'get_my_profile'
order by proname;
```

Tu dois voir ~20 fonctions `admin_*` + `get_my_profile`, `get_game_config_public`, etc.

## 3. Premier superadmin

Remplace l’email par le tien :

```sql
update profiles
set role = 'superadmin'
where user_id = (
  select id from auth.users where email = 'ton-email@example.com'
);
```

## 4. Test in-game

1. `npm run dev` → connecte-toi avec le compte superadmin
2. Menu sidebar → **🛡️ Admin**
3. Dashboard doit afficher les stats (pas « Système admin non déployé »)
