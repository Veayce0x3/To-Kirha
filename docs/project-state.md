# 🌸 TO-KIRHA — Project State v1.6

> État actuel du projet. Voir aussi `HANDOFF.md` pour reprendre une session.  
> `saveVersion` : **26** · jeu en ligne : [veayce0x3.github.io/To-Kirha](https://veayce0x3.github.io/To-Kirha/)

## Vision

Jeu web idle/RPG **zen sakura** pensé pour **durer des années** : récolte parallèle active, **économie spécialisée** (choix de carrière obligatoire), craft ciblé (outils + cuisine), ferme éleveur, **Cuisine au cœur du donjon**, combat DQ à 3, saisons / prestige.

## Boucle économique (phase 1 — beta)

```
Choix carrière (2 récolte + 2 bâtiments + type d'arme)
  → produire / vendre / HDV test (ressources manquantes)
  → parchemins (HDV) + ingrédients
  → Cuisine (repas coûteux, parchemins obligatoires)
  → Combat rapide (clés) → Donjon (clé consommée, repas en combat)
  → Équipement (drops combat + donjon) → fusion → progression
```

## Choix de carrière

- Au **premier lancement** (ou après reset) : modal **« Choisis ta voie »** — **obligatoire**
- Tant que non confirmé : navigation limitée à **Perso** et **Options** ; métiers et ferme **invisibles / verrouillés**
- Choix : **2 métiers récolte** + **2 bâtiments ferme** + **type d'arme de départ** (+ **Puits** gratuit pour tous)
- Métiers / bâtiments non choisis : inaccessibles en récolte/ferme → **HDV test**
- Fichiers : `js/systems/careerChoice.js`, `js/systems/testHdv.js`, `js/ui/careerChoiceUi.js`, garde nav dans `js/ui/render.js`

## Progression (3 axes)

1. **Personnage** — XP combat, stats HP/ATK/DEF, équipement (10 slots), plafond par saison
2. **Métiers** — récolte (2 choisis) + éleveur (2 bâtiments + puits) + **Outilleur** + **Cuisinier**
3. **Économie** — Kirha, **5 zones** monde, Renaissance, parchemins, HDV

### Saisons

- Cap S1 : perso **55**, métiers **95**
- Prestige : Lotus, 100k Kirha vie, boss Lotus, missions Lotus
- Voir `docs/progression-matrix.md`

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
