# Supabase — Online To-Kirha

> Comptes, save cloud, classement, HDV P2P, admin et config live — **implémenté** (beta).

## Architecture

```
js/config.js              → URL + clé anon (commitée, publique côté client)
js/core/supabaseClient.js → client Supabase (ESM esm.sh)
js/core/auth.js           → session, profil, rôles staff, ban
js/core/cloudSave.js      → sync save ↔ table saves
js/systems/leaderboard.js → classement serveur
js/systems/marketP2p.js   → HDV joueurs
js/systems/admin.js       → RPC modération / admin
js/systems/gameConfig.js  → maintenance, toggles live
supabase/*.sql            → schéma, RLS, RPC (à déployer dans le SQL Editor)
```

**Fallback local :** sans compte ou sans Supabase, le jeu tourne sur `localStorage` (`SaveProvider`).

## Config (`js/config.js`)

```javascript
export const SUPABASE_URL = 'https://xxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...';  // rôle "anon"
export const DEV_FAKE_ACCOUNT = false;      // true = compte dev fictif sans serveur
```

| Clé | Dans Git ? | Sensible ? |
|-----|------------|------------|
| **anon** (`SUPABASE_ANON_KEY`) | **Oui** — requis pour GitHub Pages | **Non** — conçue pour le navigateur ; sécurité = **RLS + RPC** |
| **service_role** | **Jamais** | **Oui** — bypass RLS ; dashboard Supabase / CI secrets uniquement |
| Mots de passe joueurs | Jamais | Oui — gérés par Supabase Auth |

La clé anon est visible dans le JS déployé (local ou `veayce0x3.github.io`) : c’est le modèle normal d’une SPA Supabase. Ne pas la traiter comme un secret ; traiter **RLS et policies** comme la vraie barrière.

`js/config.example.js` sert de modèle si tu clones le repo sur une autre machine.

## Déploiement SQL

1. Exécuter `supabase/schema.sql` (tables de base)
2. Exécuter `supabase/rpc_market.sql` si besoin (marché)
3. Exécuter `supabase/admin_system.sql` (admin, signalements, config live)

Voir aussi `supabase/auth-setup.md`, `supabase/admin-setup.md`, `scripts/deploy-admin-sql.md`.

## Auth (email)

- Inscription / connexion avant le choix de carrière si pas de compte
- Profil `profiles` (pseudo unique)
- Rôles staff : `moderator`, `admin`, `superadmin` — panneau in-game si `admin_access` serveur

URLs redirect Supabase : ajouter `https://veayce0x3.github.io/To-Kirha/**` en prod.

## Save cloud

- Table `saves` (`save_data` jsonb, `user_id`)
- Sync au login et périodiquement ; merge côté client
- Validation serveur (`saveIntegrity`, RPC leaderboard) pour limiter la triche évidente

## Ce qui ne doit jamais être commité

- `service_role` / clé secrète Supabase
- `.env`, tokens Cursor (`.cursor/`)
- Mots de passe comptes admin ou joueurs

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `js/core/save.js` | Local + pont cloud |
| `js/ui/authUi.js` | Modals connexion / invité |
| `js/ui/adminView.js` | Panneau admin in-game |
| `js/ui/leaderboardView.js` | Classement + signalements |
| `js/ui/marketP2pView.js` | HDV P2P |

## Dépendance

Supabase JS chargé à la volée (pas de `npm install`) :

```javascript
import('https://esm.sh/@supabase/supabase-js@2.49.8')
```
