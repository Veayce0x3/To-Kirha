# Grille de progression To-Kirha

Référence équilibre long terme (vision ~10 ans).  
Règle joueur : **pour la zone X, vise Perso Nv.Y et métiers Nv.Z** — le max absolu (200) exige plusieurs **Renaissances**.

## Zones monde (5)

| Zone | Perso combat min | Métiers récolte (entrée zone) | Boss monde requis |
|------|------------------|-------------------------------|-------------------|
| Village Sakura | 1 | Nv. 1 | — |
| Forêt des Pétales | 10 | Nv. 20+ | Gardien du Cerisier |
| Rivière de Brume | 20 | Nv. 40+ | Esprit de la Forêt |
| Monts de Jade | 25 | Nv. 60+ | Seigneur de la Brume |
| Sanctuaire du Lotus | 35 | Nv. 80+ | Golem de Jade |

Coûts Kirha (anti-rush) : Forêt 1 200 · Brume 3 500 · Jade 10 000 · Lotus 25 000.

## Zones combat (5)

| Zone combat | Perso min | Boss | ATK conseillé |
|-------------|-----------|------|---------------|
| Temple du Cerisier | 1 | Gardien du Cerisier | ~12 |
| Tanière des Pétales | 10 | Esprit de la Forêt | ~19 |
| Sanctuaire de Brume | 20 | Seigneur de la Brume | ~24 |
| Grotte de Jade | 25 | Golem de Jade | ~29 |
| Hall du Lotus | 35 | Floraison Éternelle | ~36 |

ATK conseillé ≈ DEF boss + 4 (affiché en UI).

## Sets combat

| Zone | Set | Bonus 4 pièces | Bonus 8 pièces |
|------|-----|----------------|----------------|
| Village | sakura | +12 HP, +4 ATK, +3 DEF | +25/+8/+6 |
| Forêt | petal | idem | idem |
| Jade | jade | idem | idem |

Config : `balance.combatSetBonuses`.

## Saisons & plafonds

**Sans Renaissance** : cap dur par saison — impossible d’atteindre Nv.200 en une run.

| Saison | Perso max | Métiers max |
|--------|-----------|-------------|
| 1 | 55 | 95 |
| 2 | 66 | 107 |
| 5 | 99 | 143 |
| 10 | 154 | 200 (métiers) |
| ~14 | 200 | 200 |

Formule : `cap = min(200, firstSeasonCap + (season - 1) × perSeason)`  
Config : `balance.prestige.levelCaps`.

### Renaissance — prérequis

**Saison 1 → 2** (`prestige.seasonRequirements["1"]`) :
- 2 500 💰 total vie
- 5 succès Saison 1 (récoltes, Paysan 12, outil, repas, combats)

**Saison 2+** (défaut) :
- Zone Lotus débloquée
- **100 000** Kirha gagnés (total vie)
- Boss Lotus vaincu ≥ 1×
- Succès fin de parcours (ex-chapitre Lotus)
- Bonus par saison : +5 % Kirha · +5 % XP (cumulatif)

### Durée cible (joueur ~1 h/j)

| Palier | Durée |
|--------|-------|
| Saison 1 | 3–6 semaines |
| Saisons 2–5 | 2–4 semaines |
| Max Nv.200 | 12–24 mois actif |
| Vision 10 ans | saisons + extensions contenu (paliers > 200) |

Leviers anti-rush : `minTotalEarned`, coûts zones, `regrowthBaseMs` (11 s).

## XP récolte vs niveau métier

| Concept | Exemple Paysan | Config |
|---------|----------------|--------|
| XP par récolte Blé | **10** fixe | `harvestXpByTier` |
| XP par récolte Orge | **14** fixe | tier+1 → +4 |
| Niveau pour débloquer Orge | **Nv.12** métier | `resourceUnlock` |
| XP pour Paysan 1→2 | **100** puis ×1.12 | `jobs.json` |

Voir **`docs/progression-design.md`** pour le détail complet.

## Résumé par palier

| Tu es en… | Vise |
|-----------|------|
| Village | Perso 1–10 · métiers 1–20 · set Sakura |
| Forêt | Perso 10–20 · métiers 20–40 · set Pétale |
| Brume | Perso 20–25 · métiers 40–60 |
| Jade | Perso 25–35 · métiers 60–80 · set Jade |
| Lotus | Fin de saison → Renaissance |

## Dev

- `betaMode: true` en dev — passer à `false` avant release.
- `saveVersion: 24` — plafonds calculés depuis `state.season` (pas de migration).
