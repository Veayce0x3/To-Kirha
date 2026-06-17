# 🌸 TO-KIRHA — Project State v1.4

> État actuel du projet. Voir aussi `HANDOFF.md` pour reprendre une session.  
> `saveVersion` : **24**

## Vision

Jeu web idle/RPG **zen sakura** pensé pour **durer des années** : récolte parallèle, métiers, craft par zone, ferme éleveur, combat DQ à 3, saisons / prestige, guidage à règles (pas de LLM).

## Progression (3 axes)

1. **Personnage** — XP combat, stats HP/ATK/DEF, équipement (10 slots), **plafond par saison**
2. **Métiers** — 5 récoltes + 1 éleveur + 8 crafts (dont Cuisine), niveaux indépendants, **plafond par saison**
3. **Économie** — Kirha, zones, Renaissance du Cerisier (bonus permanents cumulés)

### Saisons

- Cap S1 : perso **55**, métiers **95** — finir Lotus OK, pas les paliers 110/200
- Chaque Renaissance : +11 perso / +12 métiers de plafond + +5 % Kirha/XP (pas de passif)
- Prestige requiert : Lotus, 100k Kirha vie, boss Lotus, missions Lotus
- Voir `docs/progression-matrix.md`

## Métiers

- **Récolte (5)** : Bûcheron, Pêcheur, Mineur, Paysan, Alchimiste — ~11 ressources/métier
- **Ferme (1)** : Éleveur — 6 bâtiments (Puits, Poulailler, Étable, Bergerie, Porcherie, Ruches)
- **Craft (8)** : Outilleur → Bijoutier + **Cuisinier** — sets combat par zone (sakura, petal, jade)

## Ferme éleveur

- Navigation sidebar **Ferme** → une vue par bâtiment (`farm_well`, `farm_chicken_coop`, …)
- **Emplacements** par bâtiment : 1 au départ, jusqu'à 4 achetables (Kirha + ressource)
- **Production** : timer par emplacement, XP Éleveur à la collecte
- **Rations** : choix parmi toutes les options (même si stock insuffisant) ; coût par production affiché (`stock/requis`)
- **Outil requis** : seau / outil éleveur équipé (`toolJob: breeder`, palier outil)
- Données : `data/farm.json` · logique : `js/systems/farm.js`, `js/systems/tools.js`

## Outils & durabilité

- Outils de récolte / éleveur : **`maxUses`** dans `recipes.json` — s'usent à chaque emploi
- **1ʳᵉ ressource Nv.1** de chaque métier récoltable **sans outil** (lent) ; au-delà, outil équipé obligatoire
- **Paliers outil** (`toolTier`) : outil insuffisant bloque les ressources de palier supérieur
- **Affichage** : hint au craft, barre sur page métier, minibar, Perso → Outils, ferme (outil éleveur)
- Outil **usé** → refabrication à l'atelier (onglet Outilleur regroupe **tous** les outils de métier)
- Logique : `js/systems/toolDurability.js`, `js/systems/toolTier.js`, `js/systems/equipmentDisplay.js`

## Cuisine

- Métier **Cuisinier** (`cook`) · vue **Cuisine** dans la sidebar
- Repas craftés → buff **1 donjon** (HP / ATK / DEF / regain entre salles)
- Consommation au lancement du donjon (`js/systems/consumables.js`)

## Combat

- Tour DQ plein écran, menu Attaquer/Sorts/Défense/Fuir
- Donjon multi-salles, équipe à 3
- Bonus set : 4 pièces / 8 pièces (`combatSetBonuses`)
- 5 zones combat alignées sur 5 zones monde
- Drops : **pépites d'or** + XP perso (pas de Kirha en combat)

## UI

- Sidebar : Missions, Récolte (5), **Ferme (6)**, Atelier, **Cuisine**, Gestion
- **Tutoriel guidé** (~5–10 min) : récolte, banque, hache offerte, puits, poulailler, arme, donjon, parchemins (`data/tutorial.json`)
- Bandeau **objectif actuel** (Personnage + Missions) via `guidance.js` — après tutoriel
- Stats Personnage : onglets Équipement / Stats / Métiers / Équipe / **Outils** (liste plate équipés + réserve)
- Preview craft combat : stats + rôle arme avant fabrication
- Atelier **Outilleur** : tous les outils équipables métier visibles dans un seul onglet
- Combat : fond sombre sakura, panneau dialogue clair

## Récolte mobile

- Grille **2×2** sur petit écran, picker repliable
- **Pas d'idle** : récolte active par slots uniquement (pas de passif prestige / aides / offline)
- Récolte **3 s** fixe ; repousse séparée (8–30 s selon tier/zone)
- Touch 44px+ sur combat DQ

## Stack

- Vanilla JS · JSON · localStorage (`saveVersion` 24)
- `npm run dev` → http://localhost:5173

## Docs

| Fichier | Rôle |
|---------|------|
| `PROMPT.md` | Vision design |
| `progression-matrix.md` | Grille zones × saisons × équilibre |
| `ROADMAP.md` | Planning |
| `HANDOFF.md` | Reprise session |
| `CHANGELOG.md` | Historique versions |

## Prochaines étapes

- [ ] Sets Brume / Lotus
- [ ] `betaMode: false` en prod
- [ ] Contenu paliers 200+ (vision 10 ans)
- [ ] GitHub Pages · Supabase · tests auto
- [ ] Sprites / icônes définitifs

## Livré récemment (v1.3–v1.4)

- **Ferme éleveur** : 6 bâtiments, rations, slots, XP métier, navigation dédiée
- **Durabilité outils** : usure, affichage craft/métier/minibar/ferme, refabrication
- **Outilleur unifié** : tous les outils de métier dans un onglet
- **Récolte sans outil** : 1ʳᵉ ressource Nv.1 lente ; paliers outil (`toolTier`)
- **Cuisine** : repas + buffs donjon
- **Tutoriel** : hache offerte, étapes ferme (puits + poulailler), corrections progression
- **UI ferme** : coûts rations visibles, bouton production après collecte, sync slots
