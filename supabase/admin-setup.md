# Administration To-Kirha

Système admin complet in-game : modération, ban, classement, HDV, annonces, config live.

## Déploiement SQL

Exécuter `supabase/admin_system.sql` dans le SQL Editor Supabase (ou via migration MCP).

## Premier superadmin

Après création de ton compte test :

```sql
update profiles
set role = 'superadmin'
where user_id = (
  select id from auth.users where email = 'ton-email@example.com'
);
```

## Rôles

| Rôle | Droits |
|------|--------|
| `player` | Jeu normal |
| `moderator` | Dashboard, joueurs, signalements, classement, HDV, logs, ban |
| `admin` | + annonces, config live, reset save cloud |
| `superadmin` | + promotion/rétrogradation des rôles |

## Accès in-game

- Menu sidebar : **🛡️ Admin** — visible **uniquement** si le serveur confirme `admin_access` (rôles `admin` ou `superadmin`)
- Options → Compte → lien **Administration** (même condition)
- Les joueurs normaux ne voient **aucune** trace du panneau (pas de bouton, pas de mention de rôle)

## Comment nommer des admins

### 1. Premier superadmin (obligatoire, une seule fois)

Dans le SQL Editor Supabase, avec **ton** email :

```sql
update profiles
set role = 'superadmin'
where user_id = (
  select id from auth.users where email = 'ton-email@example.com'
);
```

### 2. Promouvoir d'autres admins (in-game)

1. Connecte-toi avec le compte **superadmin**
2. Menu **🛡️ Admin** → onglet **Joueurs**
3. Recherche le pseudo ou l'UUID
4. **Voir** → liste déroulante rôle → choisir **Admin** ou **Modérateur** → **Changer rôle**

Seul un **superadmin** peut modifier les rôles. Un admin peut modérer (ban, HDV, etc.) mais ne peut pas promouvoir d'autres admins.

### 3. Via SQL (secours)

```sql
update profiles set role = 'admin' where display_name ilike '%Pseudo%';
-- ou
update profiles set role = 'moderator' where user_id = 'uuid-du-joueur';
```

## Rôles

| Rôle | Voit le panneau Admin | Droits |
|------|----------------------|--------|
| `player` | Non | Jeu normal |
| `moderator` | Non* | Modération via RPC si besoin futur |
| `admin` | **Oui** | Dashboard, joueurs, signalements, classement, HDV, annonces, config |
| `superadmin` | **Oui** | Tout admin + promotion des rôles |

\* Les modérateurs n'ont pas le bouton in-game pour l'instant ; passe-les en `admin` si tu veux qu'ils accèdent au panneau.

## Config live (`game_config`)

- `maintenance_mode` — limite le online
- `leaderboard_enabled`
- `market_p2p_enabled`
- `test_hdv_enabled`
- `reporting_enabled`

## Signalements joueurs

Bouton 🚩 sur le classement → formulaire de signalement → file modération (onglet Signalements).

## Sécurité

- Rôles et bans **uniquement côté serveur** (RPC + trigger anti-escalade)
- Joueurs bannis : RLS bloque save/classement/HDV
- Journal `moderation_logs` pour audit
