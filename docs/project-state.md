# 🌸 TO-KIRHA — Project State v1.3

> État actuel du projet. Voir aussi `HANDOFF.md` pour reprendre une session.  
> `saveVersion` : **19**

## Vision

Jeu web idle/RPG **zen sakura** pensé pour **durer des années** : récolte parallèle, métiers, craft par zone, combat DQ à 3, saisons / prestige, guidage à règles (pas de LLM).

## Progression (3 axes)

1. **Personnage** — XP combat, stats HP/ATK/DEF, équipement (10 slots), **plafond par saison**
2. **Métiers** — 5 récoltes + 7 crafts, niveaux indépendants, **plafond par saison**
3. **Économie** — Kirha, zones, Renaissance du Cerisier (bonus permanents cumulés)

### Saisons

- Cap S1 : perso **55**, métiers **95** — finir Lotus OK, pas les paliers 110/200
- Chaque Renaissance : +11 perso / +12 métiers de plafond + +5 % Kirha/XP (pas de passif)
- Prestige requiert : Lotus, 100k Kirha vie, boss Lotus, missions Lotus
- Voir `docs/progression-matrix.md`

## Métiers

- **Récolte (5)** : Bûcheron, Pêcheur, Mineur, Paysan, Alchimiste — ~11 ressources/métier
- **Craft (7)** : Outilleur → Bijoutier — sets combat par zone (sakura, petal, jade)

## Combat

- Tour DQ plein écran, menu Attaquer/Sorts/Défense/Fuir
- Donjon multi-salles, équipe à 3
- Bonus set : 4 pièces / 8 pièces (`combatSetBonuses`)
- 5 zones combat alignées sur 5 zones monde

## UI

- Sidebar : icônes Missions (parchemin) + Atelier (craft)
- **Tutoriel guidé** (~5–10 min) : spotlight + bandeau bas, aligné quêtes village (`tutorial.json`)
- Bandeau **objectif actuel** (Personnage + Missions) via `guidance.js` — après tutoriel
- Stats Personnage : onglets Équipement / Stats / Métiers / Équipe
- Preview craft combat : stats + rôle arme avant fabrication
- Combat : fond sombre sakura, panneau dialogue clair

## Récolte mobile

- Grille **2×2** sur petit écran, picker repliable
- **Pas d'idle** : récolte active par slots uniquement (pas de passif prestige / aides / offline)
- Touch 44px+ sur combat DQ

## Stack

- Vanilla JS · JSON · localStorage (`saveVersion` 19)
- `npm run dev` → http://localhost:5173

## Docs

| Fichier | Rôle |
|---------|------|
| `PROMPT.md` | Vision design |
| `progression-matrix.md` | Grille zones × saisons × équilibre |
| `ROADMAP.md` | Planning |
| `HANDOFF.md` | Reprise session |

## Prochaines étapes

- [ ] Sets Brume / Lotus
- [ ] `betaMode: false` en prod
- [ ] Contenu paliers 200+ (vision 10 ans)
- [ ] GitHub Pages · Supabase · tests auto

## Livré session tutoriel / anti-idle

- Tutoriel guidé (`js/systems/tutorial.js`, `data/tutorial.json`, overlay UI)
- Anti-idle : pas de passif prestige, pas de tick aides, offline zen
- Preview craft équipement + rôles armes (`weapon_roles.json`)
- Personnage onglets, récolte 2×2 mobile, fond combat repensé
