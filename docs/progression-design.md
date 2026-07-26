# Progression To-Kirha — référence design (v31+)

> **Ne pas confondre** XP récolte, niveau métier, déblocage ressource et passage de saison.

## 1. XP par récolte (fixe par ressource)

- Config : `balance.harvestXpByTier` → `base: 10`, `step: 4`
- Formule : **tier 0 = 10 XP**, tier 1 = 14, tier 2 = 18… (Blé, Orge, Seigle…)
- Code : `getHarvestXpForResource()` dans `js/systems/progression.js`
- **Indépendant** du coût pour monter de niveau

## 2. XP pour monter de niveau (courbe croissante)

- Config : `data/jobs.json` → `xpPerLevel` + `xpScaling` (ex. 100 × 1.12^(n-1))
- Code : `getXpForLevel()` dans `js/systems/harvest.js`
- Plafond par saison : `balance.prestige.levelCaps`

## 3. Paliers déblocage ressource (niveau métier requis)

- Config : `balance.resourceUnlock` → starter **1**, puis **12 + (tier-1)×6**
  - Tier 1 ressource → Nv.12 · Tier 2 → Nv.18 · Tier 3 → Nv.24…
- Code : `getResourceUnlockJobLevel()` — utilisé pour le bouton Déblocage production
- **≠ XP récolte** (10/14/18)

## 4. Déblocage métiers / bâtiments / combat

- Config : `balance.jobUnlocks`
- **Chaîne de métiers** : chaque métier de récolte exige aussi le métier précédent (ex. Pêcheur = Bûcheron Nv.10 + Paysan Nv.10)
- **Ferme / craft** : mélange Paysan, Éleveur, Bûcheron, Mineur, Alchimiste selon le bâtiment
- L’UI affiche **tous** les prérequis (pas seulement Paysan)
- Code : `js/systems/jobUnlock.js`

## 5. Lignes de production

- 1 ressource starter gratuite · max 5 unités · coûts cumulatifs (pas de reset à 10💰)
- Code : `js/systems/productionLines.js`

## 6. Succès (ex-Missions)

- Données : `data/achievements.json`
- Code : `js/systems/achievements.js`
- UI : onglet **Succès** (Monde)
- Bonus permanents cumulatifs : `state.achievements.bonuses` (kirha, xp, harvestSpeed)
- Flag : `balance.achievementsEnabled: true`

### Saison 1 → 2 (beta)

Prérequis dans `balance.prestige.seasonRequirements["1"]` :

- 2 500 💰 gagnés (total vie)
- Succès : 30 récoltes, Paysan Nv.12, 1 outil, 1 repas, 5 combats
- **Pas** de plafond saison obligatoire en S1 (`requireAtSeasonCap: false`)

Saison 2+ : règles globales (Lotus, 100k 💰, boss…).

## 7. Fichiers clés

| Fichier | Rôle |
|---------|------|
| `data/balance.json` | saveVersion, harvestXpByTier, resourceUnlock, jobUnlocks, prestige |
| `data/achievements.json` | Liste des succès |
| `js/systems/progression.js` | Tiers ressource, XP récolte, unlock level |
| `js/systems/achievements.js` | Logique succès + bonus |
| `js/systems/prestige.js` | Passage de saison + prérequis par saison |

## 8. Migrations save

- **v30** : efface legacy carrière (Paysan-only)
- **v31** : `quests` → `achievements`, cache progression

Test propre : `?newgame=1` ou reset save cloud.
