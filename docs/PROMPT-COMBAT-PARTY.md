# 🌸 TO-KIRHA — Combat DQ + équipe à 3

> Spécification livrée en v1.2 (`saveVersion` 13).  
> **État actuel (v1.6)** : voir `project-state.md` — drops solo, clés, repas Objets, modal sans onglets Sorts/Défense.

## Résumé

- Combat **Dragon Quest direct** : 1 action par membre vivant, puis tour ennemi
- **Héros** : 10 slots équipement, progression XP
- **2 équipiers** : achat Kirha, niveau = niveau héros
- **Équipiers** : arme (classe) + tenue + charme
- Arme → `weaponType` → compétences (`combat_skills.json`)
- Ennemis scalés selon taille de l'équipe (+45 % HP par allié)
- Pas de PA, pas de jets aléatoires sur équipement

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `data/companions.json` | Définition équipiers + coûts recrutement |
| `js/systems/companions.js` | Recrutement, équipement équipiers |
| `js/systems/combat.js` | Party, tour DQ, skills par membre |
| `js/systems/combatZone.js` | Flux combat, victoire/défaite |
| `js/ui/views.js` | UI Perso (équipe) + modal combat |

## Hors scope (à faire plus tard)

- Noms / lore définitifs des équipiers
- Liste finale armes ↔ classes
- Objets consommables en combat
- IA auto des équipiers
