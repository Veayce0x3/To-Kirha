# 🌸 TO-KIRHA — Project State v1.7

> État actuel du projet. Voir **`docs/progression-design.md`** pour XP, déblocages et succès.  
> `saveVersion` : **31** · jeu en ligne : [veayce0x3.github.io/To-Kirha](https://veayce0x3.github.io/To-Kirha/)

## Vision

Jeu web idle/RPG **zen sakura** : récolte parallèle, progression Paysan → métiers, craft (outils + cuisine), ferme, combat DQ, **succès** et saisons.

## Boucle économique (beta)

```
Onboarding (arme) → Paysan seul → déblocages progressifs
  → production (coûts cumulatifs) → outils / cuisine
  → succès (bonus permanents) → Saison 2+
  → combat → donjons (repas) → équipement
```

## Progression (beta v31)

- **Démarrage** : Paysan seul → métiers via `jobUnlocks`
- **XP récolte** : fixe 10, 14, 18… (`harvestXpByTier`)
- **Niveau métier** : `xpPerLevel` × `xpScaling` (`jobs.json`)
- **Ressource suivante** : Nv. 12, 18, 24… (`resourceUnlock`)
- **Succès** : bonus permanents + prérequis Saison 1→2
- **Carrière 2+2** : obsolète (migration v30)

## Choix de départ (onboarding)

- Pseudo + **arme** (Guerrier / Archer / Mage)
- Fichiers : `careerChoice.js`, `careerChoiceUi.js`

## Progression (3 axes)

1. **Personnage** — XP combat, stats, équipement, plafond saison
2. **Métiers** — récolte progressive + éleveur + Outilleur + Cuisinier
3. **Économie** — Kirha, zones, succès, Renaissance

### Saisons

- Cap S1 : perso **55**, métiers **95**
- **Saison 1→2 (beta)** : succès S1 + 2 500 💰 (sans plafond obligatoire)
- **Saison 2+** : Lotus, 100k Kirha, boss Lotus, succès fin de jeu
- Voir `docs/progression-design.md` et `docs/progression-matrix.md`

## Métiers & craft

| Catégorie | Détail |
|-----------|--------|
| Récolte (5) | Bûcheron, Pêcheur, Mineur, Paysan, Alchimiste — **2 choisis** |
| Ferme | Éleveur — 6 bâtiments, **2 choisis** + Puits |
| Atelier | **Outilleur** (outils) + onglet **🔮 Fusion** (équipement combat) |
| Cuisine | **Cuisinier** — repas obligatoires pour les donjons |

- Recettes `combatItem` : **non craftables** — drops combat + fusion uniquement
- `isAllowedCraftRecipe` : `toolmaker` \| `cook` seulement
- **Retiré de l'UI** : Forgeron, Sculpteur, Armurier, Tailleur, Cordonnier, Bijoutier (données JSON conservées pour sets / drops)

## Cuisine (pilier donjon)

- Repas par paliers de niveau perso — soin **% PV max** en combat
- **Toutes les recettes** : Parchemins des Anciens + Kirha + ingrédients multi-métiers/ferme
- Consommation : menu **Objets** en combat **ou** Sac / Banque hors combat
- Sans repas → donjon très difficile

## Combat & donjon

- **Combat rapide** : héros seul — XP (×0,25), **clés DJ** (faible %), **drops équipement** (taux zone)
- **Donjon** : **1 clé** consommée, équipe à 3, multi-salles — drops équipement + repas entre salles
- **5 zones combat** alignées sur les 5 zones monde
- **Fusion** : même pièce + même set, coûts Kirha (`equipmentFusion.js`) — UI dans **Atelier**
- **Plus de limites journalières** ; déblocage donjon sans quota kills (`combatDaily.js` neutralisé)
- Modal combat : onglets Sorts / Défense **retirés** ; menu Objets pour repas
- Pépites d'or : visibles Sac + échange HDV

## Hôtel des Ventes

| Vendeur | Contenu |
|---------|---------|
| Marchand des Anciens | Parchemins |
| HDV test (par métier) | Ressources des métiers/bâtiments **non choisis** |

- UI **mobile-first** : barre sticky, chips métier, bottom sheet quantité, refresh partiel
- Catégories par métier (plus de vue « toutes »)
- Désactiver plus tard : `balance.testHdv.enabled: false`

## Récolte & feedback

- Slots parallèles, repousse séparée, indicateurs nav (prêt / en cours / repousse)
- **Son + badge « Prêt »** quand un slot redevient récoltable (`regrowthComplete`)
- Toast + nav si le joueur est sur une autre page

## Page Perso (refonte v1.6)

- Layout compact : stats pills, grille équipement style Dofus (10 slots)
- Onglets : **Sac · Équipement · Outils · Équipe**
- **Clic sur un slot** → bottom sheet liste des pièces compatibles (+ retirer si équipé)
- Fusion **déplacée** vers Atelier (plus d'onglet Fusion sur Perso)

## Ferme & outils

- 6 bâtiments, rations, slots, durabilité outil éleveur
- Outils récolte : `maxUses`, paliers `toolTier`, Outilleur unifié
- 1ʳᵉ ressource Nv.1 récoltable sans outil (lente)

## Ce qui n'est plus actif (legacy code)

| Élément | Statut |
|---------|--------|
| Aides / récolte passive auto | Code mort — **pas d'UI**, `tickAides` jamais appelé |
| Gains offline ressources | **Supprimé** — modale zen sans production (`offline.js`) |
| 6 ateliers équipement | Données présentes, **craft désactivé** |
| Limites journalières combat | Neutralisées |
| Prérequis kills pour donjon | `killsPerMonster: 0` — entrée directe si clé + déblocage zone |

## Stack & déploiement

- Vanilla JS · JSON · localStorage (`saveVersion` 26)
- `npm run dev` → http://localhost:5173
- Prod : **GitHub Pages** branche `main`, racine `/`, `.nojekyll`, JSON via `import.meta.url`

## Docs

| Fichier | Rôle |
|---------|------|
| `PROMPT.md` | Vision design |
| `progression-matrix.md` | Grille zones × saisons |
| `ROADMAP.md` | Planning |
| `HANDOFF.md` | Reprise session |
| `CHANGELOG.md` | Historique versions |
| `CONTENT-BIBLE.md` | Référence contenu combat / équipement |

## Prochaines étapes

- [ ] HDV joueur ↔ joueur (Supabase)
- [ ] Tutoriel adapté au choix de carrière
- [ ] Sets Brume / Lotus · paliers 200+
- [ ] Sprites définitifs · tests auto
- [ ] Nettoyer legacy (`aides`, `passive.js`, `dungeon.js` si inutilisé)
- [ ] Désactiver `testHdv` en prod finale

## Livré récemment (v1.6)

- HDV mobile-first (chips métier, bottom sheet, refresh partiel)
- Perso refonte + popup équipement par slot
- Fusion → Atelier ; carrière obligatoire + verrou nav
- Indicateur / son récolte prête
- Drops équipement combat rapide ; pépites Sac + HDV
- Combat : onglets Sorts/Défense retirés
