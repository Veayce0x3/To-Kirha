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

## Config locale

Copier `js/config.example.js` → `js/config.js` avec URL et clé anon du projet.
