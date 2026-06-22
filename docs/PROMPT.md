# 🌸 TO-KIRHA — Prompt Projet (v5)

> Source de vérité du concept. Référence principale pour reprendre le projet.

Tu es un développeur full-stack senior + game designer expert en jeux web économiques (idle / RPG / simulation).

## Identité

- **Nom :** TO-KIRHA
- **Monnaie :** 💰 Kirha
- **Format :** Jeu web 2D, 100% navigateur
- **Version actuelle :** v1.4 (`saveVersion` 24)

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
| **Métiers & craft** | 5 récoltes + éleveur + 8 ateliers (dont Cuisine), recettes par niveau |
| **Ferme** | 6 bâtiments, rations, production animale, métier Éleveur |
| **Outils** | Durabilité (`maxUses`), paliers, refabrication |
| **Progression par zone** | 3 zones monde, sets d'équipement fixe par zone, pépites combat |
| **Combat PvE** | Donjons DQ à 3, monstres + boss, tour par tour |
| **Économie Kirha** | Vente récolte, upgrades, parchemins, prestige saisons |

## Architecture gameplay

### 3 progressions distinctes

1. **Personnage** — niveau + XP (combat), stats HP/ATK/DEF, équipement combat (10 slots)
2. **Métiers** — 5 récoltes + éleveur + 8 crafts ; niveaux **indépendants** du perso
3. **Économie** — Kirha, zones, prestige « Nouvelle Saison »

### Métiers de récolte (tous dispos dès le début)

Bûcheron · Pêcheur · Mineur · Paysan · Alchimiste

- ~11 ressources par métier (noms thème sakura)
- Déblocage par **niveau de métier** (~tous les 20 niveaux)
- **1ʳᵉ ressource Nv.1** récoltable sans outil (lente) ; outil équipé requis au-delà
- Outils à **durabilité** : usure par récolte, paliers outil vs palier ressource

### Ferme (Éleveur)

Puits · Poulailler · Étable · Bergerie · Porcherie · Ruches

- Métier **Éleveur** (XP indépendant) · emplacements par bâtiment (1 → 4)
- **Rations** consommées par cycle ; choix parmi plusieurs céréales/plantes
- Outil éleveur (seau) requis · durabilité comme les outils de récolte

### Métiers de craft (8 ateliers)

Outilleur · Forgeron · Sculpteur · Armurier · Tailleur · Cordonnier · Bijoutier · **Cuisinier**

- Outilleur : **tous** les outils de récolte / éleveur (regroupés dans un onglet)
- Forgeron → Bijoutier : pièces d'équipement combat par zone
- Cuisinier : repas → buff **1 donjon** (HP/ATK/DEF, regain entre salles)
- Niveau métier = verrou de recette (pas de vente d'équipement combat)
- **Stats d'équipement fixes** — pas de jets aléatoires

### Récolte (emplacements parallèles)

- Écran métier = **emplacements** (slots)
- **2 slots** gratuits au départ, jusqu'à **10** achetables en Kirha
- Assigner une ressource → bouton **Récolter** → timer indépendant par slot
- **Pas de gain passif** : seuls les emplacements actifs produisent (pas d'aides auto ni offline)
- Récolte **3 s** fixe ; **repousse** séparée (8–30 s selon tier/zone)
- Ressource récoltable si : **niveau métier OK** + **zone actuelle OK** + **outil palier OK** (ou 1ʳᵉ ressource sans outil)

### Boucle zone → combat → craft

```
Débloquer zone → récolter ressources zone → combattre (mats + XP)
→ craft set aux ateliers → équiper sur Perso → zone / boss suivant
```

### Combat

- Donjons **DQ à 3** (héros + 2 équipiers) : 1 action / membre / tour
- 3 zones de combat (`combat_zones.json`) : monstres libres + boss illimité
- 6 classes d'armes : Paladin, Chevalier, Archer, Miko, Assassin, Lancier
- Récompenses : XP personnage, **pépites d'or** (pas de Kirha en combat)
- **Repas** (Cuisine) : consommables en donjon (% PV max) — **obligatoires** pour progresser en DJ
- Équipement combat : **drops donjon** (commun) + fusion ; pas de craft atelier
- Clés donjon : farm en combat rapide, consommées à l'entrée

### Hôtel des Ventes

- **Parchemin des Anciens** : achat chez le marchand fixe, requis pour **tous les repas** et la plupart des crafts
- **HDV test** (`testHdv`) : ressources des métiers/bâtiments **non choisis** à prix réduits (beta)
- Futur : marché **joueur ↔ joueur** (Supabase)

### Cuisine (pilier)

- Métier **Cuisinier** — seul craft « consommable » combat
- Repas : **% PV max** selon palier perso ; recettes **coûteuses** (mats + Kirha + parchemins)
- **Sans repas → pas de donjon viable** ; sans donjon → pas d'équipement

### Choix de carrière

- Début de partie : **2 métiers récolte** + **2 bâtiments ferme** (+ Puits gratuit)
- Spécialisation économique : le reste s'achète (HDV test puis P2P)

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
- Écrans : Perso, Monde, 5 métiers récolte, **6 bâtiments ferme**, Atelier, **Cuisine**, Banque, Hôtel des Ventes, Combat, Options
- **Tutoriel début** : récolte → banque → hache → ferme → arme → donjon → parchemins (~5–10 min)
- Durabilité outils visible : craft, page métier, minibar, Perso → Outils

## Sauvegarde

- **Actuel :** localStorage (`SaveProvider`) + export/import base64
- **Futur :** Supabase (`CloudSaveProvider` stub dans `js/core/save.js`)
- `saveVersion: 26` dans `data/balance.json`

## Systèmes livrés

- [x] Récolte slots parallèles + repousse séparée
- [x] 8 métiers craft + sets combat par zone (stats fixes)
- [x] Combat DQ équipe à 3 + 6 classes d'armes
- [x] Hôtel des Ventes + parchemins
- [x] Choix carrière 2+2 + HDV test
- [x] Cuisine pivot donjon (repas % PV, parchemins, coûts)
- [x] Clés DJ, drops équipement, fusion, rareté
- [x] GitHub Pages en ligne
- [x] Prestige saisons + plafonds
- [x] Tutoriel guidé + guidage dynamique
- [x] Ferme éleveur (6 bâtiments, rations, slots)
- [x] Durabilité outils + paliers + Outilleur unifié
- [x] Cuisine (repas → buff donjon)
- [x] Audio Web Audio procédural + settings
- [x] Anti-idle (pas de passif / offline gains)

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
