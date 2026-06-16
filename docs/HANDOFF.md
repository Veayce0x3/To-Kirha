# 🌸 To-Kirha — Note de reprise (v1.1)

> Colle ce fichier en contexte au début d'une nouvelle conversation Cursor.

## Lancer le jeu

```bash
npm run dev
```

→ http://localhost:5173 (ES modules = HTTP obligatoire, pas `file://`)

## Vision en une phrase

Jeu web **zen sakura** : récolte parallèle, 7 ateliers craft, **combat DQ à 3** (héros + 2 équipiers), économie Kirha.

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

## Boucle de jeu

```
Zone → récolte (slots) → combat (pépites + XP) → craft → équipement → zone suivante
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
  resources.json          # ~55 ressources
  jobs.json                 # 5 récoltes + 7 crafts
  balance.json              # zones, upgrades, slots, betaMode, saveVersion: 17
  combat_resources.json     # gold_nugget (pépites)
  recipes.json              # outils + sets combat par zone
  character.json            # XP / stats perso
  combat_equipment.json     # 10 slots, 3 sets complets
  combat_zones.json         # monstres + boss par zone
  combat_skills.json        # compétences par type d'arme
  companions.json           # équipiers + coûts recrutement
  merchant.json             # Hôtel des Ventes
  equipment.json            # outils de récolte
  enemies.json              # stats ennemis

js/
  core/game.js              # état, craft, combat, save
  systems/slots.js          # emplacements récolte
  systems/craft.js          # craft + grantCombatItem
  systems/combat.js         # PA, skills, équipement
  systems/combatZone.js     # zones combat, donjons DQ, drops, victoire
  systems/companions.js     # recrutement + équipement équipiers
  systems/character.js      # stats perso
  systems/merchant.js       # Hôtel des Ventes
  systems/dungeon.js        # LEGACY — non utilisé par le flux principal
  ui/views.js               # écrans
  ui/router.js              # navigation
  ui/render.js              # shell + toasts
```

## État technique

- Vanilla JS (ES modules), pas de framework
- Save : `localStorage` + export/import base64
- `saveVersion` 17 : énergie supprimée, donjons DQ, betaMode
- `CloudSaveProvider` = stub Supabase (`docs/SUPABASE.md`)

## Ce qui manque / priorités

1. Balancing progression zone 1 → 2 → 3
2. Bonus de set et/ou boss débloque zone suivante
3. Plafond niveaux craft raisonnable
4. Nettoyer `dungeon.js` / `dungeons.json`
5. GitHub Pages · sprites · tutoriel

## Prompt type pour nouvelle session

```
Continue To-Kirha v1.1. Lis docs/HANDOFF.md et docs/project-state.md.
[Ta tâche ici]
```
