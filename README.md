# To-Kirha 🌸

Jeu web idle/RPG **zen sakura** — récolte parallèle, métiers, craft, combat style Dragon Quest, saisons et prestige.  
100 % navigateur, sans installation.

**Version actuelle :** `0.5.0` · `saveVersion` 22

## Jouer en ligne (beta)

Une fois GitHub Pages activé sur ce dépôt :

1. **Settings → Pages → Source** : branche `main`, dossier `/ (root)`
2. Le jeu sera accessible à : `https://<ton-compte>.github.io/To-Kirha/`

> Si tu testes en local : `npm install` puis `npm run dev` → [http://localhost:5173](http://localhost:5173)

## Beta testeurs — à savoir

- **Nouvelle partie recommandée** pour cette beta (durabilité des outils, suppression des améliorations métier Kirha).
- Sauvegarde dans le **localStorage** du navigateur (pas de compte pour l’instant).
- En cas de bug bizarre : **Options → Réinitialiser la partie**.
- Mobile et desktop supportés ; boutons pensés pour le tactile (44 px min).
- UI en **français**.

### Parcours à tester

1. Tutoriel guidé (récolte → arme → forge → donjon → parchemin)
2. Craft **Outilleur** → équiper → récolter → usure de l’outil → **Refabriquer**
3. Combat (zones, donjon, équipe à 3)
4. Missions / quêtes et **Nouvelle Saison** (prestige)

### Retours bienvenus

Ouvre une **Issue** sur GitHub avec :

- Navigateur + OS (ex. Safari iOS, Chrome Windows)
- Étapes pour reproduire le bug
- Capture d’écran si possible

## Développement

```bash
npm install
npm run dev
```

| Dossier | Rôle |
|---------|------|
| `data/` | JSON (balance, recettes, quêtes, zones…) |
| `js/core/` | Boucle de jeu, sauvegarde |
| `js/systems/` | Métiers, craft, combat, prestige… |
| `js/ui/` | Vues et rendu |
| `docs/` | Vision, roadmap, état du projet |

Docs utiles : [`docs/PROMPT.md`](docs/PROMPT.md) · [`docs/ROADMAP.md`](docs/ROADMAP.md) · [`docs/project-state.md`](docs/project-state.md)

## Stack

- HTML / CSS / JavaScript vanilla (pas de framework)
- Données JSON
- Sauvegarde `localStorage`
- Hébergement statique (GitHub Pages)

## Licence

Projet privé — beta fermée. Tous droits réservés.
