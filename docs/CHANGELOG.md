# Changelog

## [1.6.0] — 2026-07-04

### UI Perso, HDV et UX récolte

**Page Perso**
- Refonte layout compact : stats pills, grille équipement 10 slots
- Onglets : Sac · Équipement · Outils · Équipe (Fusion retirée)
- **Clic sur un slot** → bottom sheet avec pièces compatibles en inventaire (+ retirer)

**Atelier**
- Onglet **🔮 Fusion** déplacé depuis Perso

**Carrière**
- Modal « Choisis ta voie » **obligatoire** — nav limitée à Perso + Options tant que non confirmé
- Métiers / ferme verrouillés avant confirmation ; pseudo enregistré avant validation
- Reset modal sans valeurs persistantes entre parties

**HDV**
- Refonte mobile-first : barre sticky, chips par métier, bottom sheet quantité
- Catégories par métier (plus de vue « toutes ») ; refresh partiel

**Récolte**
- Son + badge « Prêt » + toast quand un slot redevient récoltable
- Pulse nav métier concerné

**Combat**
- Drops équipement en **combat rapide** solo (en plus du donjon)
- Pépites d'or visibles Sac + HDV
- Retrait onglets Sorts / Défense en modal combat

## [1.5.0] — 2026-06-22

### Économie spécialisée & cuisine pivot (`saveVersion` 26)

**Choix de carrière**
- Modal début : **2 métiers récolte** + **2 bâtiments ferme** ; Puits gratuit
- Navigation et slots filtrés selon le choix (`careerChoice.js`)

**Hôtel des Ventes test**
- Vendeurs dynamiques pour ressources des métiers/bâtiments **non choisis** (`testHdv.js`)
- Prix réduits (`balance.testHdv`) — en attendant HDV joueur ↔ joueur

**Combat & donjon**
- **Clés DJ** : drop combat rapide, 1 clé consommée à l'entrée
- **Équipement commun** : drop donjon uniquement
- **Fusion** : même pièce + set, coûts Kirha par rareté
- Suppression limites journalières combat
- Repas en combat (menu Objets) + hors combat (Sac/Banque)
- Snapshot PV équipe à l'entrée DJ

**Cuisine**
- Toutes recettes avec **Parchemins des Anciens** + coûts Kirha renforcés
- Repas **% PV max** par palier perso
- Boucle : Cuisine → donjon → équipement

**Craft**
- Atelier limité à **Outilleur + Cuisinier** (plus de craft équipement combat)

**Technique**
- Fix chargement **GitHub Pages** (`farm.js`, `import.meta.url`, `.nojekyll`)
- `betaMode: false` — équipiers à débloquer en jeu
- Config agent Cursor (`.cursor/permissions.json`, `sandbox.json`)

## [1.4.0] — 2026-06-21

### Correctifs post-économie phase 1

- Fix `state is not defined` dans `farm.js` (écran vide)
- Consommation repas inventaire + fusion UI Perso

## [1.3.0] — 2026-06-11

### Ferme, durabilité outils & refonte tuto/atelier (`saveVersion` 24)

**Ferme éleveur**
- Métier **Éleveur** + 6 bâtiments (Puits, Poulailler, Étable, Bergerie, Porcherie, Ruches)
- Emplacements par bâtiment (1 → 4), production timer, XP Éleveur
- **Rations** : toutes les options visibles ; coût par production (`stock/requis`) ; alternatives via `feedEfficiency`
- Outil éleveur requis (seau, palier) — `js/systems/farm.js`, `data/farm.json`

**Durabilité outils**
- `maxUses` sur outils de récolte / éleveur — usure à chaque emploi
- Affichage : craft (hint + barre), page métier, minibar, Perso → Outils, ferme
- Outil usé → refabrication ; migration `toolDurability` sur saves existantes

**Récolte & outils**
- 1ʳᵉ ressource Nv.1 récoltable **sans outil** (lente)
- Paliers outil (`toolTier`) vs palier ressource
- Atelier **Outilleur** : tous les outils équipables métier regroupés

**Cuisine**
- Métier **Cuisinier** + vue Cuisine
- Repas craftés → buff **1 donjon** (HP/ATK/DEF, regain entre salles)

**Tutoriel & UI**
- Étape hache : modale « Recevoir ma hache »
- Étapes ferme : puits + poulailler
- Fix bouton ferme bloqué après production ; sync slots

## [1.2.6] — 2026-06-11

### Récolte repousse + assets (`saveVersion` 18)

- **Récolte fixe 3 s** — action identique pour toutes les ressources
- **Repousse séparée** : 8–30 s selon tier + zone ; bonus vitesse réduit la repousse (pas le clic)
- **Assets intégrés** : sprites paysan/bûcheron, logo Kirha, pépites d'or, icônes métiers
- Sauvegarde des emplacements récolte entre sessions + reprise des timers

## [1.2.5] — 2026-06-11

### Suppression énergie + Fontaine (`saveVersion` 17)

- Mécanique **énergie** retirée entièrement (récolte, combat, donjons libres)
- Vue **Fontaine du Cerisier** supprimée
- Fichier `energy.js` supprimé

## [1.2.4] — 2026-06-11

### Beta test — énergie idle, donjons DQ, équipe débloquée (`saveVersion` 16)

- **Énergie** : max 300, regen passive (+1 ⚡ / 3 min), plus de quota journalier
- **Donjons DQ** : enchaînement 4 salles (monstres + boss), combat tour par tour à 3, HP conservés
- **`betaMode`** : les 2 équipiers sont débloqués d'office
- **Options** : copie/téléchargement save, reset masqué en beta, import dans un panneau séparé
- Save renforcée : `visibilitychange` + sauvegarde entre les salles de donjon

## [1.2.3] — 2026-06-11

### Craft équipement — option B + simplification zones

- **Héros** : set complet reste `unique` (1 craft par slot / zone)
- **Répétable** : toutes les armes (Sakura, Pétales, Jade) + tenues/charmes équipiers
- Suppression de `requiresZone` sur les recettes combat — progression via ingrédients + niveau métier

## [1.2.2] — 2026-06-11

### Énergie + pépites d'or (`saveVersion` 15)

- **Énergie** : limite récolte et donjons (max 100, pas de regen passive)
- **Fontaine du Cerisier** : repos gratuit 1×/jour, recharge via pépites ou Kirha
- **Quota donjons** : ~30 points/jour (boss = 2 points)
- **Drops combat** : uniquement **pépites d'or** (`gold_nugget`) + XP perso — plus de Kirha en combat
- **Craft combat** : anciens mats remplacés par `gold_nugget` dans `recipes.json`
- Migration : anciens mats combat → pépites dans l'inventaire

## [1.2.1] — 2026-06-11

### 6 classes d'armes + choix dès le départ (`saveVersion` 14)

- **Classes** : Paladin, Chevalier, Archer, Miko, Assassin, Lancier
- **6 armes de départ** craftables au Village Sakura (Nv. métier 1, mats récolte)
- Crafts d'armes **répétables** (instances pour équiper toute l'équipe)
- Skills dague + lance ajoutés
- Affichage classe sur armes (UI Perso + Combat)

## [1.2.0] — 2026-06-11

### Combat Dragon Quest + équipe à 3 (`saveVersion` 13)

**Combat refondu**
- Tour DQ : 1 action par membre (héros puis équipiers), puis ennemi
- Suppression du système PA
- Menu « Que fait [Nom] ? » + compétences + Défense
- 3 sprites alliés en combat, scaling HP ennemi par taille d'équipe

**Équipiers**
- 2 compagnons recrutables en Kirha (`data/companions.json`)
- Niveau synchronisé au héros
- Équipement : arme (classe) + tenue + charme
- Recettes équipier zone Sakura / Pétales / Jade

**UI**
- Section Équipe sur l'écran Perso
- Modal combat multi-alliés

## [1.1.0] — 2026-06-11

### Combat PA, zones, 7 métiers craft, Hôtel des Ventes

**Combat refondu** (`saveVersion` 11)
- Zones de combat : monstres libres + boss rejouable (`combat_zones.json`)
- Tour par tour : 6 PA, 4 compétences selon type d'arme
- Types d'armes : épée+bouclier, épée 2 mains, arc, bâton
- Matériaux de combat (drops) requis pour craft équipement
- Remplace l'ancien flux donjon 4 salles + combat auto

**7 métiers craft** (`saveVersion` 12)
- Outilleur, Forgeron, Sculpteur, Armurier, Tailleur, Cordonnier, Bijoutier
- Remplace l'ancien métier Artisan unique
- Migration : récolte conservée, craft reset niveau 1

**Hôtel des Ventes** (`saveVersion` 10)
- Parchemin des Anciens : achat marchand, requis pour la plupart des crafts

**Renommage sakura** (`saveVersion` 9)
- Noms et emojis ressources thème sakura (IDs techniques inchangés)

**Design**
- Stats d'équipement **fixes** — pas de jets aléatoires
- Équipement combat non vendable (`ownedCombatItems`)

## [1.0.0] — 2026-06-10

### Fondations idle/RPG + personnage + donjons

**5 métiers de récolte** : Bûcheron, Pêcheur, Mineur, Paysan, Alchimiste
- ~55 ressources, `requiredJobLevel` tous les ~20 niveaux
- Zones filtre dur : Village Sakura / Forêt des Pétales / Montagnes de Jade

**Emplacements récolte** : 2 au départ, jusqu'à 10 achetables
- Assignation ressource par slot, timers parallèles indépendants

**Personnage** : niveau perso distinct des métiers
- Stats HP / ATK / DEF · XP via donjons
- Équipement combat séparé des outils de métier

**Donjons** (remplacés en v1.1) : 3 donjons, 4 salles + boss, combat auto
- Temple du Cerisier · Tanière des Pétales · Grotte de Jade

**Craft** : sets combat par zone · outils par métier

**UI** : menu burger mobile (même sidebar PC) · minibar · banque cliquable

**Technique** : `saveVersion` 7 · migration ressources legacy · `character.json`, `dungeons.json`, `enemies.json`, `combat_equipment.json`

## [0.6.0] — 2026-06-10

- UI : layout 3 colonnes, tuiles métiers, minibar, banque

## [0.5.0] — 2026-06-10

- Refonte sidebar, métiers parallèles, équipement

## [0.4.0] — Prestige, audio, polish

## [0.3.0] — Jade, offline, export save

## [0.2.0] — Zones, craft, pêcheur

## [0.1.0] — MVP Village Sakura
