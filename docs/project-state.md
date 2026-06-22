# 🌸 TO-KIRHA — Project State v1.5

> État actuel du projet. Voir aussi `HANDOFF.md` pour reprendre une session.  
> `saveVersion` : **26** · jeu en ligne : [veayce0x3.github.io/To-Kirha](https://veayce0x3.github.io/To-Kirha/)

## Vision

Jeu web idle/RPG **zen sakura** pensé pour **durer des années** : récolte parallèle, **économie spécialisée** (choix de carrière), craft ciblé, ferme éleveur, **Cuisine au cœur du donjon**, combat DQ à 3, saisons / prestige.

## Boucle économique (phase 1 — beta)

```
Choix carrière (2 récolte + 2 bâtiments ferme)
  → produire / vendre / HDV test (ressources manquantes)
  → parchemins (HDV) + ingrédients
  → Cuisine (repas coûteux, parchemins obligatoires)
  → Donjon (clé consommée, repas en combat)
  → Équipement commun (drop DJ uniquement) → fusion → progression
```

## Choix de carrière

- Au **premier lancement** : modal « Choisis ta voie »
- **2 métiers de récolte** parmi 5 + **2 bâtiments ferme** parmi 5 (+ **Puits** gratuit pour tous)
- Métiers / bâtiments non choisis : **inaccessibles en récolte/ferme**
- **HDV test** (`balance.testHdv`) : achat des ressources des métiers/bâtiments non choisis à prix réduits (en attendant HDV joueur ↔ joueur)
- Fichiers : `js/systems/careerChoice.js`, `js/systems/testHdv.js`, `js/ui/careerChoiceUi.js`

## Progression (3 axes)

1. **Personnage** — XP combat, stats HP/ATK/DEF, équipement (10 slots), plafond par saison
2. **Métiers** — récolte partielle + éleveur + **Outilleur + Cuisinier** (craft équipement combat désactivé en atelier)
3. **Économie** — Kirha, zones, Renaissance, parchemins, HDV

### Saisons

- Cap S1 : perso **55**, métiers **95**
- Prestige : Lotus, 100k Kirha vie, boss Lotus, missions Lotus
- Voir `docs/progression-matrix.md`

## Métiers & craft

| Catégorie | Détail |
|-----------|--------|
| Récolte (5) | Bûcheron, Pêcheur, Mineur, Paysan, Alchimiste — **2 choisis** |
| Ferme | Éleveur — 6 bâtiments, **2 choisis** + Puits |
| Atelier | **Outilleur** uniquement (outils métier) |
| Cuisine | **Cuisinier** — repas obligatoires pour les donjons |

- Recettes `combatItem` : **non craftables** en atelier (drops donjon + fusion)
- `isAllowedCraftRecipe` : `toolmaker` + `cook` seulement

## Cuisine (pilier donjon)

- **7 repas** par paliers de niveau perso (1–9, 10–19, 20–29, 30–39)
- Soin **% PV max** en combat (`consumables.js`, `balance.meals`)
- **Toutes les recettes** exigent des **Parchemins des Anciens** + coût Kirha + ingrédients multi-métiers/ferme
- Consommation : menu **Objets** en combat **ou** Sac / Banque hors combat (PV entraînement solo)
- Sans repas → donjon très difficile ; sans donjon → pas d'équipement commun

## Combat & donjon

- Combat rapide (héros seul) : farm **clés DJ** (faible % mob/boss)
- Entrée donjon : **1 clé consommée**, équipe à 3, multi-salles
- **Équipement** : drop **commun** en donjon uniquement (pas en entraînement rapide)
- **Fusion** : même pièce + même set, coûts Kirha (`equipmentFusion.js`)
- Plus de limites journalières combat (`combatDaily.js`)
- PV équipe : snapshot à l'entrée DJ, repas entre salles, restauration à l'échec

## Hôtel des Ventes

| Vendeur | Contenu |
|---------|---------|
| Marchand des Anciens | Parchemins (achat / revente) |
| HDV test (dynamique) | Ressources des métiers/bâtiments **non choisis** |

- Désactiver plus tard : `balance.testHdv.enabled: false`
- Futur : HDV joueur ↔ joueur (Supabase)

## Ferme, outils, UI

- Ferme : 6 bâtiments, rations, slots, durabilité outil éleveur — inchangé (v1.3+)
- Outils : `maxUses`, paliers `toolTier`, Outilleur unifié
- Sidebar filtrée selon carrière après choix
- Fusion : Perso → section dédiée
- GitHub Pages : `import.meta.url` pour JSON, `.nojekyll`, fix `farm.js`

## Stack & déploiement

- Vanilla JS · JSON · localStorage (`saveVersion` 26)
- `npm run dev` → http://localhost:5173
- Prod : **GitHub Pages** branche `main`, racine `/`
- Agent Cursor : `.cursor/permissions.json`, `.cursor/sandbox.json`

## Docs

| Fichier | Rôle |
|---------|------|
| `PROMPT.md` | Vision design |
| `progression-matrix.md` | Grille zones × saisons |
| `ROADMAP.md` | Planning |
| `HANDOFF.md` | Reprise session |
| `CHANGELOG.md` | Historique versions |

## Prochaines étapes

- [ ] HDV joueur ↔ joueur (Supabase)
- [ ] 3ᵉ métier / 3ᵉ bâtiment (extension carrière)
- [ ] Sets Brume / Lotus · paliers 200+
- [ ] Tutoriel adapté au choix de carrière
- [ ] Sprites définitifs · tests auto
- [ ] Désactiver `testHdv` en prod finale

## Livré récemment (v1.5)

- Choix carrière 2+2 + Puits gratuit
- HDV test (ressources non produites)
- Économie phase 1 : clés DJ, drops équipement DJ, fusion, rareté
- Cuisine renforcée (parchemins, coûts, pivot donjon)
- Repas % PV, conso combat + inventaire
- Fix chargement GitHub Pages
- `betaMode: false` (équipiers à débloquer en jeu)
