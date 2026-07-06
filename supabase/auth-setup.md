# Auth To-Kirha — email uniquement

Projet : **To-Kirha** (`jmakrpkocxlyykgfnmlv`)

## Dashboard Supabase

1. **Email activé**  
   https://supabase.com/dashboard/project/jmakrpkocxlyykgfnmlv/auth/providers → **Email**

2. **URLs du jeu** (redirect après actions auth si besoin)  
   https://supabase.com/dashboard/project/jmakrpkocxlyykgfnmlv/auth/url-configuration  
   - Site URL : `http://localhost:5173` (dev)  
   - Redirect URLs : `http://localhost:5173/**`, `http://127.0.0.1:5173/**`, URL GitHub Pages en prod

3. **(Optionnel dev)** Désactiver *Confirm email* sur le provider Email pour tester sans mail.

## Config

`js/config.js` est **dans le repo** (clé **anon** publique — nécessaire pour GitHub Pages).

Pour un clone local : le fichier est déjà présent ; sinon copier `js/config.example.js` → `js/config.js` et remplir URL + clé anon du dashboard Supabase → Settings → API.

**Ne jamais** y mettre la clé `service_role`.
