# To-Kirha — Bible contenu combat & équipement

> Référence pour **renommer**, **rééquilibrer** et **étendre** le contenu.  
> Fichiers sources : `data/combat_zones.json`, `data/enemies.json`, `data/combat_equipment.json`, `data/combat_skills.json`, `data/weapon_roles.json`, `data/recipes.json`.

Colonne **Nouveau nom** : à remplir lors de la refonte narrative, puis mettre à jour les JSON.

---

## Zones monde (récolte)


| ID                | Nom actuel          | Emoji | Déblocage Kirha | Nouveau nom |
| ----------------- | ------------------- | ----- | --------------- | ----------- |
| `village_sakura`  | Village Sakura      | 🌸    | 0               |             |
| `petal_forest`    | Forêt des Pétales   | 🌿    | 1 200           |             |
| `mist_river`      | Rivière de Brume    | 🌫️   | 3 500           |             |
| `jade_mountains`  | Montagnes de Jade   | ⛩️    | 10 000          |             |
| `lotus_sanctuary` | Sanctuaire du Lotus | 🪷    | 25 000          |             |


---

## Zones combat


| ID                | Nom affiché         | Zone monde | Nv. perso min | Boss                 |
| ----------------- | ------------------- | ---------- | ------------- | -------------------- |
| `village_sakura`  | Temple du Cerisier  | Village    | 1             | Gardien du Cerisier  |
| `petal_forest`    | Tanière des Pétales | Forêt      | 10            | Esprit de la Forêt   |
| `mist_river`      | Sanctuaire de Brume | Brume      | 20            | Seigneur de la Brume |
| `jade_mountains`  | Grotte de Jade      | Jade       | 25            | Golem de Jade        |
| `lotus_sanctuary` | Hall du Lotus       | Lotus      | 35            | Floraison Éternelle  |


### Progression donjon (v1.5+)

- **Combat rapide** : héros seul — XP réduit, farm **clés**, drops **équipement** (taux par zone dans `combat_zones.json`).
- **Donjon** : équipe à 3, multi-salles — **1 clé consommée** à l'entrée ; drops équipement + repas entre salles.
- **Plus de limites journalières** (`combatDaily.js` : limites à `null`).
- **Plus de prérequis kills** avant entrée donjon (`killsPerMonster: 0`).

### Craft équipement

- Les recettes `combatItem` dans `recipes.json` servent aux **sets / drops / fusion**.
- **Craft atelier désactivé** — seuls Outilleur + Cuisinier actifs ; fusion via Atelier.

---

## Ennemis — stats de base


| ID               | Nom actuel                 | HP  | ATK | DEF | Emoji | Nouveau nom |
| ---------------- | -------------------------- | --- | --- | --- | ----- | ----------- |
| `spirit_lantern` | Esprit Lanterne            | 40  | 6   | 2   | 👻    |             |
| `petal_slime`    | Slime Pétale               | 55  | 8   | 3   | 🌸    |             |
| `temple_guard`   | Garde du Temple            | 70  | 10  | 5   | ⛩️    |             |
| `sakura_boss`    | Gardien du Cerisier        | 120 | 14  | 8   | 🌺    |             |
| `wild_fox`       | Renard des Bois            | 90  | 14  | 6   | 🦊    |             |
| `thorn_beast`    | Bête Épine                 | 110 | 16  | 8   | 🌹    |             |
| `root_golem`     | Golem Racine               | 140 | 18  | 12  | 🌳    |             |
| `petal_boss`     | Esprit de la Forêt         | 220 | 24  | 15  | 🌺    |             |
| `mist_koi`       | Koï de Brume               | 130 | 18  | 8   | 🐟    |             |
| `mist_wisp`      | Feu follet                 | 150 | 20  | 10  | ✨     |             |
| `mist_serpent`   | Serpent brumeux            | 175 | 24  | 12  | 🐍    |             |
| `mist_boss`      | Seigneur de la Brume       | 300 | 32  | 20  | 🌫️   |             |
| `cave_bat`       | Chauve-souris des Cavernes | 160 | 22  | 10  | 🦇    |             |
| `crystal_sprite` | Sprite de Cristal          | 190 | 26  | 14  | 💎    |             |
| `stone_warden`   | Gardien de Pierre          | 230 | 30  | 18  | 🗿    |             |
| `jade_boss`      | Golem de Jade              | 400 | 38  | 25  | 🌙    |             |
| `lotus_guard`    | Gardien du Lotus           | 260 | 34  | 22  | 🪷    |             |
| `lotus_spirit`   | Esprit pétale              | 280 | 36  | 24  | 🌸    |             |
| `lotus_monk`     | Moine du sanctuaire        | 310 | 40  | 26  | 🧘    |             |
| `lotus_boss`     | Floraison Éternelle        | 520 | 48  | 32  | 🪷    |             |
| `training_dummy` | Mannequin d'entraînement   | 12  | 0   | 0   | 🎯    |             |


*En donjon (équipe à 3), les HP ennemis sont multipliés par ~1,9.*

---

## Ennemis par zone combat

### Temple du Cerisier (`village_sakura`)


| Mob                          | ID               | XP combat |
| ---------------------------- | ---------------- | --------- |
| Esprit Lanterne              | `spirit_lantern` | 12        |
| Slime Pétale                 | `petal_slime`    | 15        |
| Garde du Temple              | `temple_guard`   | 20        |
| **Boss** Gardien du Cerisier | `sakura_boss`    | 150       |


### Tanière des Pétales (`petal_forest`)


| Mob                         | ID            | XP  |
| --------------------------- | ------------- | --- |
| Renard des Bois             | `wild_fox`    | 30  |
| Bête Épine                  | `thorn_beast` | 35  |
| Golem Racine                | `root_golem`  | 42  |
| **Boss** Esprit de la Forêt | `petal_boss`  | 400 |


### Sanctuaire de Brume (`mist_river`)


| Mob                           | ID             | XP  |
| ----------------------------- | -------------- | --- |
| Koï de Brume                  | `mist_koi`     | 45  |
| Feu follet                    | `mist_wisp`    | 52  |
| Serpent brumeux               | `mist_serpent` | 60  |
| **Boss** Seigneur de la Brume | `mist_boss`    | 650 |


### Grotte de Jade (`jade_mountains`)


| Mob                        | ID               | XP  |
| -------------------------- | ---------------- | --- |
| Chauve-souris des Cavernes | `cave_bat`       | 50  |
| Sprite de Cristal          | `crystal_sprite` | 58  |
| Gardien de Pierre          | `stone_warden`   | 70  |
| **Boss** Golem de Jade     | `jade_boss`      | 900 |


### Hall du Lotus (`lotus_sanctuary`)


| Mob                          | ID             | XP   |
| ---------------------------- | -------------- | ---- |
| Gardien du Lotus             | `lotus_guard`  | 75   |
| Esprit pétale                | `lotus_spirit` | 85   |
| Moine du sanctuaire          | `lotus_monk`   | 95   |
| **Boss** Floraison Éternelle | `lotus_boss`   | 1200 |


---

## Types d'armes & classes


| weaponType     | Classe    | Rôle                | Coup signature   | Nouveau nom classe |
| -------------- | --------- | ------------------- | ---------------- | ------------------ |
| `sword_shield` | Paladin   | Soutien · Tank      | Coup de bouclier |                    |
| `longsword`    | Chevalier | Dégâts · Polyvalent | Frappe chargée   |                    |
| `bow`          | Archer    | Dégâts · Agilité    | Tir précis       |                    |
| `staff`        | Miko      | Soutien · Soins     | Soin léger       |                    |
| `dagger`       | Assassin  | Burst · Fragile     | Coup critique    |                    |
| `spear`        | Lancier   | Mobile · Perçant    | Charge           |                    |


---

## Compétences par arme

### Sans arme


| ID               | Nom               | PA  | Effet    |
| ---------------- | ----------------- | --- | -------- |
| `punch`          | Coup de poing     | 1   | ×0.5 ATK |
| `kick`           | Coup de pied      | 2   | ×0.7 ATK |
| `throw_pebble`   | Lancer de caillou | 1   | ×0.4 ATK |
| `desperate_blow` | Coup désespéré    | 3   | ×1.0 ATK |


### Paladin (`sword_shield`)


| ID               | Nom              | PA  | Effet           |
| ---------------- | ---------------- | --- | --------------- |
| `ss_slash`       | Entaille         | 2   | ×1.0 dégâts     |
| `ss_guard`       | Garde            | 1   | +4 DEF          |
| `ss_shield_bash` | Coup de bouclier | 2   | ×0.75, 20% stun |
| `ss_riposte`     | Riposte          | 3   | ×1.35 dégâts    |


### Chevalier (`longsword`)


| ID             | Nom             | PA  | Effet |
| -------------- | --------------- | --- | ----- |
| `ls_slash`     | Entaille        | 1   | ×0.85 |
| `ls_thrust`    | Estoc           | 2   | ×1.1  |
| `ls_charged`   | Frappe chargée  | 3   | ×1.5  |
| `ls_whirlwind` | Lame circulaire | 3   | ×1.25 |


### Archer (`bow`)


| ID            | Nom             | PA  | Effet               |
| ------------- | --------------- | --- | ------------------- |
| `bow_quick`   | Tir rapide      | 1   | ×0.8                |
| `bow_precise` | Tir précis      | 2   | ×1.15, ignore 2 DEF |
| `bow_volley`  | Volée           | 3   | ×1.3                |
| `bow_pierce`  | Flèche perçante | 3   | ×1.2, ignore 4 DEF  |


### Miko (`staff`)


| ID            | Nom        | PA  | Effet               |
| ------------- | ---------- | --- | ------------------- |
| `staff_spark` | Éclat      | 2   | ×1.0                |
| `staff_bind`  | Entrave    | 2   | ×0.6, -3 ATK ennemi |
| `staff_heal`  | Soin léger | 2   | +12% HP             |
| `staff_orb`   | Orbe       | 3   | ×1.45               |


### Assassin (`dagger`)


| ID          | Nom               | PA  | Effet               |
| ----------- | ----------------- | --- | ------------------- |
| `dg_stab`   | Coup rapide       | 1   | ×0.9                |
| `dg_sneak`  | Attaque sournoise | 2   | ×1.15, ignore 3 DEF |
| `dg_poison` | Poison pétale     | 2   | ×0.7, -4 ATK        |
| `dg_crit`   | Coup critique     | 3   | ×1.55               |


### Lancier (`spear`)


| ID          | Nom            | PA  | Effet               |
| ----------- | -------------- | --- | ------------------- |
| `sp_thrust` | Estoc          | 1   | ×0.95, ignore 1 DEF |
| `sp_charge` | Charge         | 3   | ×1.4                |
| `sp_brace`  | Garde de lance | 1   | +3 DEF              |
| `sp_sweep`  | Balayage       | 2   | ×1.1                |


---

## Équipement combat — Set Sakura (16 pièces)


| ID                          | Nom actuel          | Slot       | HP  | ATK | DEF | Arme (type)  | Nouveau nom |
| --------------------------- | ------------------- | ---------- | --- | --- | --- | ------------ | ----------- |
| `set_sakura_helmet`         | Casque du Cerisier  | helmet     | 15  | 2   | 3   | —            |             |
| `set_sakura_cape`           | Cape du Cerisier    | cape       | 18  | 1   | 4   | —            |             |
| `set_sakura_chest`          | Haubert du Cerisier | chest      | 25  | 3   | 5   | —            |             |
| `set_sakura_shield`         | Bouclier Pétale     | shield     | 20  | 0   | 6   | —            |             |
| `set_sakura_boots`          | Bottes du Cerisier  | boots      | 10  | 1   | 2   | —            |             |
| `set_sakura_ring`           | Anneau Pétale       | ring_left  | 8   | 4   | 1   | —            |             |
| `set_sakura_ring_right`     | Anneau Brume        | ring_right | 8   | 3   | 2   | —            |             |
| `set_sakura_belt`           | Ceinture du Temple  | belt       | 14  | 2   | 3   | —            |             |
| `set_sakura_amulet`         | Amulette du Temple  | amulet     | 12  | 2   | 2   | —            |             |
| `set_sakura_weapon`         | Katana Sakura       | weapon     | 0   | 10  | 0   | longsword    |             |
| `set_sakura_guardian_blade` | Épée du Gardien     | weapon     | 5   | 8   | 2   | sword_shield |             |
| `set_sakura_bow`            | Arc du Cerisier     | weapon     | 0   | 9   | 0   | bow          |             |
| `set_sakura_staff`          | Bâton du Temple     | weapon     | 5   | 6   | 0   | staff        |             |
| `set_sakura_dagger`         | Dague Pétale        | weapon     | 0   | 9   | 0   | dagger       |             |
| `set_sakura_spear`          | Lance du Cerisier   | weapon     | 0   | 9   | 1   | spear        |             |


**Sets manquants** : Brume (`mist_river`), Lotus (`lotus_sanctuary`).

---

## Équipement — Set Pétale (10 pièces, 1 arme)


| ID                     | Nom                  | Slot         | HP  | ATK | DEF |
| ---------------------- | -------------------- | ------------ | --- | --- | --- |
| `set_petal_helmet`     | Couronne Florale     | helmet       | 30  | 5   | 6   |
| `set_petal_cape`       | Cape Florale         | cape         | 38  | 4   | 8   |
| `set_petal_chest`      | Armure Florale       | chest        | 45  | 8   | 10  |
| `set_petal_shield`     | Bouclier des Pétales | shield       | 42  | 2   | 12  |
| `set_petal_boots`      | Bottes Florales      | boots        | 20  | 2   | 4   |
| `set_petal_ring`       | Anneau des Pétales   | ring_left    | 16  | 6   | 2   |
| `set_petal_ring_right` | Anneau Rosée         | ring_right   | 16  | 5   | 3   |
| `set_petal_belt`       | Ceinture Florale     | belt         | 28  | 5   | 6   |
| `set_petal_amulet`     | Amulette Florale     | amulet       | 22  | 4   | 4   |
| `set_petal_weapon`     | Arc des Pétales      | weapon (bow) | 0   | 22  | 0   |


---

## Équipement — Set Jade (10 pièces, 1 arme)


| ID                    | Nom              | Slot           | HP  | ATK | DEF |
| --------------------- | ---------------- | -------------- | --- | --- | --- |
| `set_jade_helmet`     | Heaume de Jade   | helmet         | 55  | 10  | 12  |
| `set_jade_cape`       | Cape de Jade     | cape           | 70  | 8   | 14  |
| `set_jade_chest`      | Plastron de Jade | chest          | 80  | 15  | 18  |
| `set_jade_shield`     | Bouclier de Jade | shield         | 75  | 4   | 20  |
| `set_jade_boots`      | Bottes de Jade   | boots          | 35  | 5   | 8   |
| `set_jade_ring`       | Anneau de Jade   | ring_left      | 28  | 10  | 4   |
| `set_jade_ring_right` | Anneau Lunaire   | ring_right     | 28  | 8   | 5   |
| `set_jade_belt`       | Ceinture de Jade | belt           | 50  | 8   | 10  |
| `set_jade_amulet`     | Amulette de Jade | amulet         | 40  | 6   | 6   |
| `set_jade_weapon`     | Bâton de Jade    | weapon (staff) | 10  | 35  | 0   |


---

## Compagnons (placeholders)


| ID            | Nom actuel    | Déblocage Kirha | Nouveau nom |
| ------------- | ------------- | --------------- | ----------- |
| `companion_1` | Équipier 1 🥷 | 5 000           |             |
| `companion_2` | Équipier 2 🏹 | 25 000          |             |


---

## Craft & tutoriel (v1.4)

- **Équipement combat** : pas de `requiredJobLevel` (difficulté = ressources + parchemins + pépites).
- **Formation** : arme imposée Chevalier → recette `tutorial_sakura_blade` (5 frêne, 3 blé).
- **Démantèlement** : Personnage → Pièces possédées → ~45 % des mats (`balance.dismantle.recoveryRate`).

---

## Comment renommer

1. Modifier la colonne dans ce doc pour valider les noms.
2. Mettre à jour `name` dans :
  - `combat_zones.json` (mobs/boss)
  - `enemies.json` (si affiché via DB — les noms UI viennent surtout de combat_zones)
  - `combat_equipment.json` + `recipes.json`
  - `weapon_roles.json` (labels classes)
  - `combat_skills.json` (noms attaques)
3. Pas de changement code si les **IDs** restent identiques.

