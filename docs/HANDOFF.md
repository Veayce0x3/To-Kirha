# 🌸 To-Kirha — Note de reprise (v1.6)

> Colle ce fichier en contexte au début d'une nouvelle conversation Cursor.

## Lancer le jeu

```bash
npm run dev
```

→ http://localhost:5173 · Prod : https://veayce0x3.github.io/To-Kirha/

## Vision en une phrase

Jeu web **zen sakura** : **carrière obligatoire** (2 récolte + 2 ferme + arme), HDV test, **Cuisine → donjon → équipement**, combat DQ à 3, fusion à l'atelier, saisons.

## Boucle de jeu (phase 1)

```
Carrière → récolte/ferme (2+2) → vendre / HDV test
→ parchemins + mats → Cuisine (repas) → clés (combat rapide) → donjon → équipement → fusion (atelier)
```

## Décisions design validées

| Sujet | Choix |
|-------|--------|
| Carrière | **2 récolte + 2 bâtiments + arme** au lancement ; **modal obligatoire** ; Puits gratuit |
| Nav avant carrière | **Perso + Options** seulement |
| Craft atelier | **Outilleur + Cuisinier + Fusion** ; pas de craft équipement |
| Équipement combat | Drops **combat rapide + donjon** + **fusion** |
| Clés donjon | Drop entraînement rapide ; **1 clé = 1 entrée DJ** |
| Repas | **% PV max** ; parchemins sur toutes recettes cuisine |
| Repas usage | Menu **Objets** en combat + **Sac/Banque** hors combat |
| Combat | DQ — 1 action / membre / tour ; modal sans onglets Sorts/Défense |
| Perso | Grille 10 slots — **clic slot → picker équipement** |
| Fusion | Onglet **Atelier → Fusion** (plus sur Perso) |
| Récolte prête | Son + badge slot + toast si hors page |
| `betaMode` | **false** — équipiers à débloquer en jeu |
| HDV test | `balance.testHdv.enabled` — par métier, UI mobile-first |
| Anti-idle | Pas d'aides auto, pas de gains offline ressources |

## Zones (5)

| Zone monde | Déblocage (indicatif) | Zone combat |
|------------|----------------------|-------------|
| 🌸 Village Sakura | Départ | Temple du Cerisier |
| 🌿 Forêt des Pétales | ~1 200 💰 + prérequis | Tanière des Pétales |
| 🌫️ Rivière de Brume | ~3 500 💰 | Sanctuaire de Brume |
| ⛩️ Montagnes de Jade | ~10 000 💰 | Grotte de Jade |
| 🪷 Sanctuaire du Lotus | ~25 000 💰 | Hall du Lotus |

## Fichiers clés

```
data/
  balance.json              # saveVersion: 26, testHdv, meals, combat keys/fusion
  resources.json            # mealTier, ressources récolte/ferme
  recipes.json              # repas, outils ; combatItem = drop only
  merchant.json             # parchemins
  farm.json                 # 6 bâtiments
  combat_zones.json         # 5 zones, dropRates équipement/clés
  combat_equipment.json     # sets, rareté

js/
  systems/careerChoice.js   # choix 2+2, visibilité nav, arme départ
  systems/testHdv.js        # vendeurs HDV test par métier
  systems/consumables.js    # repas % PV
  systems/combatZone.js     # solo + DJ, clés, drops équipement
  systems/equipmentFusion.js
  systems/crafting.js       # isAllowedCraftRecipe (toolmaker|cook)
  ui/careerChoiceUi.js      # modal parcours + pseudo
  ui/views.js               # HDV, Perso, picker équipement, récolte, fusion atelier
  ui/render.js              # navigate guard carrière, sons, nav harvest
  ui/router.js              # CRAFT_NAV: toolmaker + fusion
  core/audio.js             # SFX harvest, ready, levelup…
  main.js                   # import.meta.url pour GitHub Pages
```

## État technique

- Vanilla JS (ES modules)
- Save : `localStorage` + export/import · `saveVersion` **26**
- GitHub Pages live (parfois redeploy manuel si GitHub échoue)
- `CloudSaveProvider` = stub (`docs/SUPABASE.md`)

## Ce qui manque / priorités

1. HDV joueur ↔ joueur (Supabase)
2. Tutoriel adapté au choix carrière
3. Sets Brume / Lotus · `testHdv.enabled: false` en prod finale
4. Nettoyage legacy (aides, passive)
5. Sprites · tests auto

## Prompt type pour nouvelle session

```
Continue To-Kirha v1.6. Lis docs/HANDOFF.md et docs/project-state.md.
[Ta tâche ici]
```
