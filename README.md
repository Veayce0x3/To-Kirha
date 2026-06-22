# To-Kirha 🌸

Jeu web idle/RPG **zen sakura** — récolte parallèle, métiers spécialisés, cuisine, donjons, combat style Dragon Quest, saisons et prestige.  
100 % navigateur, sans installation.

**Version actuelle :** `0.6.0` · `saveVersion` **26**

## Jouer en ligne

**https://veayce0x3.github.io/To-Kirha/**

> Local : `npm install` puis `npm run dev` → [http://localhost:5173](http://localhost:5173)  
> Nouvelle partie : ajoute `?newgame=1` à l’URL pour voir le choix de carrière.

## Beta testeurs — à savoir

- **Choix de carrière** au départ : 2 métiers de récolte + 2 bâtiments de ferme (Puits gratuit).
- Le reste des ressources s’achète à l’**Hôtel des Ventes** (marché test, prix bas) en attendant l’HDV joueur.
- **Cuisine** = cœur du jeu : repas (parchemins + ingrédients) → **donjon** (clé) → **équipement**.
- Sauvegarde **localStorage** — pas de compte pour l’instant.
- Bug ou écran vide : **rechargement forcé** (Cmd+Shift+R) ou **Options → Réinitialiser**.
- Mobile et desktop · UI en **français** · boutons 44 px min.

### Parcours à tester

1. Choix carrière → récolte / ferme sur tes 2+2 métiers
2. HDV : parchemins + ressources des métiers que tu n’as pas choisis
3. **Cuisine** : fabriquer des repas (coûteux) → **Combat → Donjon**
4. Fusion d’équipement commun (Perso) · entraînement rapide pour les clés
5. Missions · Nouvelle Saison (prestige)

### Retours

Ouvre une **Issue** sur GitHub : navigateur + OS, étapes, capture si possible.

## Développement

```bash
npm install
npm run dev
```

| Dossier | Rôle |
|---------|------|
| `data/` | JSON (balance, recettes, quêtes, zones…) |
| `js/core/` | Boucle de jeu, sauvegarde |
| `js/systems/` | Métiers, craft, combat, HDV test, carrière… |
| `js/ui/` | Vues et rendu |
| `docs/` | Vision, roadmap, état du projet |
| `.cursor/` | Règles agent + permissions sandbox |

Docs : [`docs/PROMPT.md`](docs/PROMPT.md) · [`docs/ROADMAP.md`](docs/ROADMAP.md) · [`docs/project-state.md`](docs/project-state.md) · [`docs/HANDOFF.md`](docs/HANDOFF.md)

## Stack

- HTML / CSS / JavaScript vanilla (ES modules)
- Données JSON · sauvegarde `localStorage`
- Hébergement : **GitHub Pages**

## Licence

Projet privé — beta fermée. Tous droits réservés.
