# 🌸 TO-KIRHA — Prompt Projet (v6)

> Source de vérité du concept. Référence principale pour reprendre le projet.

Tu es un développeur full-stack senior + game designer expert en jeux web économiques (idle / RPG / simulation).

## Identité

- **Nom :** TO-KIRHA
- **Monnaie :** 💰 Kirha
- **Format :** Jeu web 2D, 100% navigateur
- **Version actuelle :** v1.6 (`saveVersion` 26)

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
| **Carrière spécialisée** | 2 métiers récolte + 2 bâtiments ferme choisis au départ |
| **Ferme** | 6 bâtiments, rations, production animale, métier Éleveur |
| **Craft ciblé** | Outilleur + Cuisinier + Fusion (pas de forge d'équipement) |
| **Progression par zone** | **5 zones** monde, sets d'équipement par zone |
| **Combat PvE** | Donjons DQ à 3, combat rapide solo, clés + drops |
| **Économie Kirha** | Vente récolte, HDV test, parchemins, prestige saisons |

## Architecture gameplay

### 3 progressions distinctes

1. **Personnage** — niveau + XP (combat), stats HP/ATK/DEF, équipement combat (10 slots)
2. **Métiers** — 2 récoltes choisies + éleveur + outilleur + cuisinier ; niveaux **indépendants** du perso
3. **Économie** — Kirha, zones, prestige « Nouvelle Saison »

### Choix de carrière (obligatoire)

- Modal **« Choisis ta voie »** au premier lancement ou après reset
- **2 métiers récolte** + **2 bâtiments ferme** + **type d'arme** ; Puits gratuit
- Tant que non confirmé : accès **Perso + Options** uniquement
- Le reste s'achète via **HDV test** (puis HDV P2P plus tard)

### Métiers de récolte (5 au total, 2 choisis)

Bûcheron · Pêcheur · Mineur · Paysan · Alchimiste

- ~11 ressources par métier (noms thème sakura)
- Déblocage par **niveau de métier**
- **1ʳᵉ ressource Nv.1** sans outil (lente) ; outil requis au-delà
- Outils à **durabilité** : usure par récolte, paliers outil vs ressource

### Ferme (Éleveur)

Puits · Poulailler · Étable · Bergerie · Porcherie · Ruches

- **2 bâtiments choisis** + Puits pour tous
- Métier **Éleveur** (XP indépendant) · emplacements par bâtiment (1 → 4)
- **Rations** consommées par cycle
- Outil éleveur requis · durabilité comme les outils de récolte

### Craft actif (atelier)

| Atelier | Rôle |
|---------|------|
| **Outilleur** | Tous les outils récolte / éleveur |
| **Cuisinier** (vue Cuisine) | Repas combat (% PV max) |
| **Fusion** (onglet Atelier) | Monter rareté équipement droppé |

- **Forgeron → Bijoutier** : données JSON conservées pour sets/drops, **craft UI désactivé**
- Niveau métier = verrou de recette
- **Stats d'équipement fixes** — pas de jets aléatoires sur les stats de base

### Récolte (emplacements parallèles)

- Écran métier = **emplacements** (slots)
- **2 slots** gratuits, jusqu'à **10** achetables en Kirha
- Timer récolte + **repousse** séparée
- **Pas de gain passif** : pas d'aides auto ni production offline
- Feedback : sons (clic, harvest, ready), badge « Prêt », indicateurs nav

### Boucle zone → combat → équipement

```
Carrière → récolter / fermer → vendre / HDV test
→ parchemins + cuisine → clés (combat rapide) → donjon → équipement → fusion
```

### Combat

- **Combat rapide** : héros seul — XP réduit, farm **clés**, drops équipement (taux zone)
- **Donjon DQ à 3** : 1 clé consommée, multi-salles, repas en menu Objets
- **5 zones combat** (alignées sur les 5 zones monde)
- 6 classes d'armes (choix au départ + drops)
- Récompenses : XP personnage, **pépites d'or**, clés, équipement
- **Fusion** à l'Atelier (même pièce + set)

### Hôtel des Ventes

- **Parchemin des Anciens** : marchand fixe — requis pour repas
- **HDV test** : ressources des métiers/bâtiments **non choisis**, UI par métier, bottom sheet mobile
- Futur : marché **joueur ↔ joueur** (Supabase)

### Cuisine (pilier)

- Repas : **% PV max** selon palier perso ; recettes coûteuses (mats + Kirha + parchemins)
- **Sans repas → donjon difficile** ; sans équipement → progression bloquée

## Économie (Kirha)

```
récolter → vendre → améliorer métiers / slots → craft outils/repas → combat → prestige
```

- Progression exponentielle douce (`coût = base × 1.15^niveau`)
- Prestige « Renaissance du Cerisier » : plafond par saison + bonus permanents
- **Pas d'idle** : récolte active uniquement
- Détail : `docs/progression-matrix.md`

## Zones (5)

| Zone | Contenu |
|------|---------|
| 🌸 Village Sakura | Début · Temple du Cerisier |
| 🌿 Forêt des Pétales | Milieu · Tanière des Pétales |
| 🌫️ Rivière de Brume | Intermédiaire · Sanctuaire de Brume |
| ⛩️ Montagnes de Jade | Avancé · Grotte de Jade |
| 🪷 Sanctuaire du Lotus | Fin de saison · Hall du Lotus |

## UI

- **Desktop :** sidebar catégories + top bar + contenu + dock métiers
- **Mobile :** burger ☰ → sidebar overlay ; bottom sheets (HDV, picker équipement, récolte)
- **Perso :** grille 10 slots — clic → liste équipement ; onglets Sac · Équipement · Outils · Équipe
- **Atelier :** Outilleur + Fusion
- Écrans : Perso, Monde, Missions, métiers récolte (filtrés), ferme (filtrée), Atelier, Cuisine, Banque, HDV, Combat, Options

## Sauvegarde

- **Actuel :** localStorage + export/import base64
- **Futur :** Supabase (`CloudSaveProvider` stub)
- `saveVersion: 26` dans `data/balance.json`

## Systèmes livrés

- [x] Récolte slots + repousse + feedback sonore / visuel
- [x] Choix carrière obligatoire + HDV test par métier
- [x] Outilleur + Cuisinier + Fusion (pas de forge équipement)
- [x] Combat solo + donjon DQ · clés · drops · fusion
- [x] Perso refonte + picker équipement par slot
- [x] HDV mobile-first · GitHub Pages live
- [x] Prestige saisons · ferme éleveur · durabilité outils
- [x] Tutoriel guidé + guidage dynamique
- [x] Audio Web Audio procédural

## Retiré / désactivé

- Craft équipement aux ateliers Forgeron–Bijoutier
- Aides / récolte passive automatique (legacy code)
- Gains offline de ressources (modale zen seulement)
- Limites journalières combat
- Fusion sur page Perso (→ Atelier)
- Onglets Sorts / Défense en modal combat

## Contraintes strictes

- Pas de Web3 / crypto / NFT
- Pas de pay-to-win
- Pas de framework JS (vanilla + modules ES6)
- Mobile-first (boutons min 44px)
- Textes UI en **français**
- Pas de jets aléatoires sur les stats d'équipement de base

## Règles de développement

1. Fonctionnel d'abord
2. Simple ensuite — pas de sur-ingénierie
3. Réutiliser systèmes existants (`game.js`, `systems/*`)
4. Mettre à jour `ROADMAP.md`, `CHANGELOG.md`, `project-state.md`, `HANDOFF.md` à chaque version

## Phases

Voir `ROADMAP.md` pour le détail phases 0 → 9.
