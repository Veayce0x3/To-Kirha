# 🌸 TO-KIRHA — Prompt Projet (v4)

> Source de vérité du concept. Référence principale pour reprendre le projet.

Tu es un développeur full-stack senior + game designer expert en jeux web économiques (idle / RPG / simulation).

## Identité

- **Nom :** TO-KIRHA
- **Monnaie :** 💰 Kirha
- **Format :** Jeu web 2D, 100% navigateur
- **Version actuelle :** v1.1 (`saveVersion` 12)

## Objectif du projet

Créer un jeu web jouable directement dans un navigateur :

- 100% web (HTML / CSS / JavaScript vanilla)
- Sans installation
- Hébergeable via GitHub Pages
- Évolutif vers Supabase (cloud save) plus tard
- Jouable sur mobile et PC

## Direction artistique

Univers inspiré du Japon féodal fantastique — ambiance **zen sakura** :

- Rose pâle, vert forêt, violet sakura
- UI minimaliste, lisible, une activité par écran
- Police : Zen Maru Gothic (Google Fonts)

**Palette :** `#F8E8EE` · `#2D5A27` · `#4A3728` · `#9B59B6`

## Piliers gameplay

| Pilier | Description |
|--------|-------------|
| **Récolte parallèle** | Emplacements indépendants, timers par slot, filtre par zone |
| **Métiers & craft** | 5 récoltes + 7 ateliers spécialisés, recettes par niveau de métier |
| **Progression par zone** | 3 zones monde, sets d'équipement fixe par zone, matériaux de combat |
| **Combat PvE** | Zones de combat, monstres + boss rejouables, tour par tour (PA) |
| **Économie Kirha** | Vente récolte, upgrades, parchemins, prestige saisons |

## Architecture gameplay

### 3 progressions distinctes

1. **Personnage** — niveau + XP (combat), stats HP/ATK/DEF, équipement combat (10 slots)
2. **Métiers** — 5 récoltes + 7 crafts ; niveaux **indépendants** du perso
3. **Économie** — Kirha, zones, prestige « Nouvelle Saison »

### Métiers de récolte (tous dispos dès le début)

Bûcheron · Pêcheur · Mineur · Paysan · Alchimiste

- ~11 ressources par métier (noms thème sakura)
- Déblocage par **niveau de métier** (~tous les 20 niveaux)

### Métiers de craft (7 ateliers)

Outilleur · Forgeron · Sculpteur · Armurier · Tailleur · Cordonnier · Bijoutier

- Outilleur : 8 outils de récolte
- Autres : pièces d'équipement combat par zone
- Niveau métier = verrou de recette (pas de vente d'équipement combat)
- **Stats d'équipement fixes** — pas de jets aléatoires

### Récolte (emplacements parallèles)

- Écran métier = **emplacements** (slots)
- **2 slots** gratuits au départ, jusqu'à **10** achetables en Kirha
- Assigner une ressource → bouton **Récolter** → timer indépendant par slot
- **Pas de gain passif** : seuls les emplacements actifs produisent (pas d'aides auto ni offline)
- Ressource récoltable si : **niveau métier OK** + **zone actuelle OK** (filtre dur)

### Boucle zone → combat → craft

```
Débloquer zone → récolter ressources zone → combattre (mats + XP)
→ craft set aux ateliers → équiper sur Perso → zone / boss suivant
```

### Combat

- 3 zones de combat (`combat_zones.json`) : monstres libres + boss illimité
- Combat **tour par tour** : 6 PA, jusqu'à 4 compétences selon l'arme
- Types d'armes : épée+bouclier, épée 2 mains, arc, bâton
- Récompenses : XP personnage, Kirha, matériaux de combat (drops garantis ou à chance sur boss)
- Recettes équipement = mats récolte + mats combat + drop boss + parchemins

### Hôtel des Ventes

- **Parchemin des Anciens** : achat uniquement chez le marchand, requis pour la plupart des crafts

## Économie (Kirha)

```
récolter → vendre → améliorer métiers / acheter slots → craft → combat → prestige (late)
```

- Progression exponentielle douce (`coût = base × 1.15^niveau`)
- Prestige « Renaissance du Cerisier » : **plafond de niveau par saison** + bonus permanents cumulés (+5 % Kirha/XP uniquement)
- **Pas d'idle** : récolte active par emplacements uniquement (pas de gains passifs / offline / aides auto)
- **Sans reset** : impossible d’atteindre le max absolu (200) — plusieurs saisons requises (~12–24 mois actif)
- **Anti-rush** : première Renaissance cible 3–6 semaines (100k Kirha vie, coûts zones élevés)
- Détail : `docs/progression-matrix.md`

## Zones

| Zone | Contenu |
|------|---------|
| 🌸 Village Sakura | Ressources début (Nv. 1–20), Temple du Cerisier |
| 🌿 Forêt des Pétales | Ressources milieu (Nv. 40–80), Tanière des Pétales |
| ⛩️ Montagnes de Jade | Ressources fin (Nv. 100–200), Grotte de Jade |

## UI

- **Desktop :** sidebar catégories + top bar + contenu + minibar métiers
- **Mobile :** burger ☰ → même sidebar en overlay
- Écrans : Perso, Monde, 5 métiers récolte, 7 ateliers craft, Banque, Hôtel des Ventes, Stratégie, Combat, Options
- **Tutoriel début** : bandeau + spotlight (~5–10 min), puis Missions / guidage

## Sauvegarde

- **Actuel :** localStorage (`SaveProvider`) + export/import base64
- **Futur :** Supabase (`CloudSaveProvider` stub dans `js/core/save.js`)
- `saveVersion: 19` dans `data/balance.json`

## Systèmes livrés

- [x] Récolte slots parallèles
- [x] 7 métiers craft + sets combat par zone (stats fixes)
- [x] Combat PA + zones + 4 types d'armes
- [x] Hôtel des Ventes + parchemins
- [x] Offline progress (cap 6h via aides)
- [x] Aides semi-passives
- [x] Rentabilité (stratégie)
- [x] Audio Web Audio procédural + settings
- [x] Prestige saisons

## Fichiers clés

Voir `docs/HANDOFF.md` pour l'arborescence complète.

## Contraintes strictes

- Pas de Web3 / crypto / NFT
- Pas de pay-to-win
- Pas de framework JS (vanilla + modules ES6)
- Mobile-first (boutons min 44px)
- Textes UI en **français**
- Pas de jets aléatoires sur les stats d'équipement

## Règles de développement

1. Fonctionnel d'abord
2. Simple ensuite — pas de sur-ingénierie
3. Réutiliser systèmes existants (`game.js`, `systems/*`)
4. Mettre à jour `ROADMAP.md`, `CHANGELOG.md`, `project-state.md`, `HANDOFF.md` à chaque version

## Phases

Voir `ROADMAP.md` pour le détail phases 0 → 8.
