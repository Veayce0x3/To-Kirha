# 🌸 To-Kirha — Note de reprise (v1.4)

> Colle ce fichier en contexte au début d'une nouvelle conversation Cursor.

## Lancer le jeu

```bash
npm run dev
```

→ http://localhost:5173 (ES modules = HTTP obligatoire, pas `file://`)

## Vision en une phrase

Jeu web **zen sakura** : récolte parallèle, ferme éleveur, 8 ateliers craft + cuisine, **combat DQ à 3** (héros + 2 équipiers), économie Kirha, outils à durabilité.

## Décisions design validées

| Sujet | Choix |
|-------|--------|
| Combat | **DQ direct** — 1 action / membre / tour, pas de PA |
| Drops combat | **Pépites d'or** + XP perso — pas de Kirha |
| Énergie | **Supprimée** (v17) — jeu libre, limites = slots / niveau / combat |
| Beta | `betaMode: true` — équipiers débloqués, reset masqué |
| Équipe | Héros + **2 équipiers** achetables en Kirha |
| Équipiers | Niveau = héros ; **arme + tenue + charme** (craft répétable) |
| Craft combat | Héros = unique / équipe = instances répétables ; pas de `requiresZone` |
| Héros | 10 slots set complet |
| Classe | Arme équipée → compétences |
| Outils | **Durabilité** (`maxUses`) — usure à chaque récolte/ferme ; refab Outilleur |
| Récolte début | **1ʳᵉ ressource Nv.1** sans outil (lent) ; paliers outil au-delà |
| Ferme | 6 bâtiments, rations choisies, coût affiché, outil éleveur requis |
| Cuisine | Repas → buff **1 run** de donjon |
| Atelier Outilleur | **Tous** les outils équipables métier dans cet onglet |

## Boucle de jeu

```
Zone → récolte (slots) → ferme (optionnel) → combat (pépites + XP)
→ craft → équipement / outils → zone suivante
```

## Zones

| Zone monde | Déblocage Kirha | Zone combat | Accès combat |
|------------|-----------------|-------------|--------------|
| 🌸 Village Sakura | Départ | Temple du Cerisier | Perso Nv. 1 |
| 🌿 Forêt des Pétales | 500 💰 | Tanière des Pétales | Perso Nv. 10 |
| ⛩️ Montagnes de Jade | 2000 💰 | Grotte de Jade | Perso Nv. 25 |

## Fichiers clés

```
data/
  resources.json          # ressources récolte + ferme + cuisine
  jobs.json                 # 5 récoltes + éleveur + 8 crafts (dont cook)
  farm.json                 # 6 bâtiments, rations, cycles
  balance.json              # zones, slots, farmSlots, betaMode, saveVersion: 24
  combat_resources.json     # gold_nugget (pépites)
  recipes.json              # outils (maxUses) + sets combat + repas
  tutorial.json             # tutoriel guidé (récolte → ferme → donjon)
  character.json            # XP / stats perso
  combat_equipment.json     # 10 slots, 3 sets complets
  combat_zones.json         # monstres + boss par zone
  combat_skills.json        # compétences par type d'arme
  companions.json           # équipiers + coûts recrutement
  merchant.json             # Hôtel des Ventes
  equipment.json            # outils de récolte / éleveur (equipable)
  enemies.json              # stats ennemis

js/
  core/game.js              # état, craft, combat, ferme, save
  systems/slots.js          # emplacements récolte
  systems/farm.js             # production animale, rations, slots ferme
  systems/tools.js            # blocage outil ferme / éleveur
  systems/toolDurability.js   # usure outils
  systems/toolTier.js         # paliers outil vs ressource
  systems/consumables.js      # repas / buffs donjon
  systems/equipmentDisplay.js # barres durabilité UI
  systems/craft.js            # craft + grantCombatItem
  systems/combat.js           # skills, équipement
  systems/combatZone.js       # zones combat, donjons DQ, drops, victoire
  systems/companions.js       # recrutement + équipement équipiers
  systems/character.js        # stats perso
  systems/merchant.js         # Hôtel des Ventes
  systems/tutorial.js         # progression tutoriel
  systems/dungeon.js          # LEGACY — non utilisé par le flux principal
  ui/views.js                 # écrans (métiers, ferme, atelier, cuisine)
  ui/router.js                # navigation (farm_*, cuisine, workshop)
  ui/render.js                # shell + toasts + events
  ui/tutorialUi.js            # overlay tutoriel + modales
```

## État technique

- Vanilla JS (ES modules), pas de framework
- Save : `localStorage` + export/import base64
- `saveVersion` **24** : ferme, durabilité outils, cuisine, tutoriel étendu
- `CloudSaveProvider` = stub Supabase (`docs/SUPABASE.md`)

## Ce qui manque / priorités

1. Balancing ferme + durabilité outils (playtest)
2. Sets Brume / Lotus
3. `betaMode: false` en release
4. Nettoyer `dungeon.js` / `dungeons.json`
5. GitHub Pages · sprites définitifs · tests auto

## Prompt type pour nouvelle session

```
Continue To-Kirha v1.4. Lis docs/HANDOFF.md et docs/project-state.md.
[Ta tâche ici]
```
