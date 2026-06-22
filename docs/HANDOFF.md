# 🌸 To-Kirha — Note de reprise (v1.5)

> Colle ce fichier en contexte au début d'une nouvelle conversation Cursor.

## Lancer le jeu

```bash
npm run dev
```

→ http://localhost:5173 · Prod : https://veayce0x3.github.io/To-Kirha/

## Vision en une phrase

Jeu web **zen sakura** : **carrière spécialisée** (2 récolte + 2 ferme), HDV test, **Cuisine → donjon → équipement**, combat DQ à 3, fusion, saisons.

## Décisions design validées

| Sujet | Choix |
|-------|--------|
| Carrière | **2 récolte + 2 bâtiments** au lancement ; Puits gratuit |
| Économie | Produire le tien, acheter le reste (HDV test → HDV P2P plus tard) |
| Craft atelier | **Outilleur + Cuisinier** seulement ; pas de craft équipement combat |
| Équipement combat | Drop **donjon** (commun) + **fusion** (même set/pièce) |
| Clés donjon | Drop entraînement rapide ; **1 clé = 1 entrée DJ** |
| Repas | **% PV max** par palier perso ; **parchemins** sur toutes recettes cuisine |
| Repas usage | Menu **Objets** en combat + **Sac/Banque** hors combat |
| Combat | DQ — 1 action / membre / tour |
| Drops combat rapide | XP + clés (pas d'équipement) |
| `betaMode` | **false** — équipiers à débloquer en jeu |
| HDV test | `balance.testHdv.enabled` — ressources non choisies à prix bas |

## Boucle de jeu (phase 1)

```
Carrière → récolte/ferme (2+2) → vendre / HDV test
→ parchemins + mats → Cuisine (repas) → clé + donjon → équipement → fusion
```

## Zones

| Zone monde | Déblocage Kirha | Zone combat |
|------------|-----------------|-------------|
| 🌸 Village Sakura | Départ | Temple du Cerisier |
| 🌿 Forêt des Pétales | 500 💰 | Tanière des Pétales |
| ⛩️ Montagnes de Jade | 2000 💰 | Grotte de Jade |

## Fichiers clés

```
data/
  balance.json              # saveVersion: 26, testHdv, meals, combat keys/fusion
  resources.json            # mealTier, ressources récolte/ferme
  recipes.json              # repas (parchemins), outils ; combatItem = drop only
  merchant.json             # parchemins (vendeur fixe)
  farm.json                 # 6 bâtiments
  combat_zones.json         # monstres + boss
  combat_equipment.json     # sets, rareté

js/
  systems/careerChoice.js   # choix 2+2, visibilité nav
  systems/testHdv.js        # vendeurs dynamiques HDV test
  systems/merchant.js       # achat HDV (+ flag testHdv)
  systems/consumables.js    # repas % PV, paliers
  systems/combatZone.js     # DJ, clés, drops équipement
  systems/dungeonKeys.js    # inventaire clés
  systems/equipmentFusion.js
  systems/equipmentRarity.js
  systems/crafting.js       # isAllowedCraftRecipe (toolmaker|cook)
  systems/farm.js           # normalizePurchasedFarmSlots(state, …)
  core/game.js              # useInventoryMeal, getMerchantVendors, carrière
  ui/careerChoiceUi.js
  ui/views.js               # HDV, combat Objets, fusion, inventaire repas
  main.js                   # load JSON via import.meta.url (GitHub Pages)

.cursor/
  permissions.json          # auto-approbation agent (git push, npm…)
  sandbox.json                # réseau sandbox
  rules/to-kirha.mdc
```

## État technique

- Vanilla JS (ES modules)
- Save : `localStorage` + export/import · `saveVersion` **26**
- GitHub Pages : `.nojekyll`, chemins JSON via `import.meta.url`
- `CloudSaveProvider` = stub (`docs/SUPABASE.md`)

## Ce qui manque / priorités

1. HDV joueur ↔ joueur (Supabase)
2. Tutoriel adapté au choix carrière
3. Sets Brume / Lotus · `testHdv.enabled: false` en prod finale
4. Sprites · tests auto

## Prompt type pour nouvelle session

```
Continue To-Kirha v1.5. Lis docs/HANDOFF.md et docs/project-state.md.
[Ta tâche ici]
```
