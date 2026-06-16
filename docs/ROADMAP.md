# 🌸 TO-KIRHA — Roadmap

> Source de vérité du planning. Mettre à jour à chaque feature livrée.

## Vision (2026)

Jeu web idle/RPG **zen sakura** : récolte parallèle, métiers spécialisés, craft par zone, combat PvE tour par tour, sets d'équipement fixes, économie Kirha.

Monnaie : **Kirha**. Stack : vanilla JS, HTML, CSS, JSON. Hébergement cible : GitHub Pages + Supabase plus tard.

---

## Phases livrées ✅

| Phase | Version | Contenu |
|-------|---------|---------|
| 0 | v0.1 | Fondations, save, boucle Kirha |
| 1 | v0.1 | MVP Village, bûcheron, upgrades |
| 2 | v0.2 | Zones, pêcheur, craft, aides, rentabilité |
| 3 | v0.3 | Jade, mineur, artisan, offline, export save |
| 4 | v0.4 | Prestige, audio, polish, stub Supabase |
| 5 | v0.5–0.6 | UI sidebar, tuiles métiers, banque, minibar, burger mobile |
| 6 | v1.0 | 5 métiers récolte, slots parallèles, perso, donjons |
| 7 | v1.1 | Renommage sakura, Hôtel des Ventes, combat PA, 7 crafts, zones combat |

---

## v1.1 — Livré ✅

- [x] 5 métiers récolte + ~55 ressources (noms sakura)
- [x] 3 zones monde (filtre dur récolte)
- [x] Slots récolte : 2 au départ, max 10 achetables
- [x] 7 métiers craft (Outilleur → Bijoutier)
- [x] Hôtel des Ventes + Parchemin des Anciens
- [x] Combat tour par tour (PA), 4 types d'armes, zones + boss rejouables
- [x] Mats combat + recettes hybrides (récolte + combat + boss + parchemins)
- [x] 3 sets combat complets (stats fixes, 10 slots)
- [x] Niveau personnage distinct, XP combat
- [x] UI burger mobile = même sidebar PC
- [x] Prestige, offline, audio, export/import save

---

## Phase 8 — En cours

### Vision long terme (~10 ans)

- Saisons / Renaissance = pilier central (plafonds + bonus, pas de LLM)
- Moteur d’objectifs à règles (`guidance.js`) — toujours un but pertinent
- Extensions futures : paliers > 200, nouvelles zones, événements saisonniers

### Livré récemment ✅

- [x] Plafonds de saison (perso / métiers) — prestige obligatoire pour maxer
- [x] Calibrage anti-rush (100k Kirha, coûts zones, repousse récolte)
- [x] Bonus de set combat (4 / 8 pièces) + affichage Personnage
- [x] Guidage dynamique (`getCurrentObjective`) + bandeaux UI
- [x] Icônes Missions / Atelier, combat DQ plein écran
- [x] Recommandation ATK par zone combat
- [x] Atelier : blocage niveau vs ingrédients
- [x] `docs/progression-matrix.md`
- [x] Tutoriel guidé début de partie (spotlight + quêtes village)
- [x] Anti-idle (pas de passif prestige / aides / offline gains)
- [x] Preview craft équipement + rôles armes
- [x] Personnage onglets, récolte 2×2 mobile, fond combat sakura

### Gameplay & contenu (reste)

- [ ] Balancing fin XP métiers / perso / combat / slots (playtest)
- [ ] Sets Brume / Lotus
- [ ] Nourriture paysan → soin en combat
- [ ] Plus de zones + contenu (paliers 100–200+)

### UI & polish (reste)

- [ ] Sprites personnage + icônes ressources définitifs

### Technique (reste)

- [ ] Nettoyer legacy `dungeon.js` / `dungeons.json`
- [ ] `betaMode: false` en release
- [ ] GitHub Pages · Supabase · tests auto

### Plus tard

- [ ] Métiers craft additionnels (extension contenu)
- [ ] Carte monde (optionnel)
- [ ] Événements saisonniers
- [ ] PvP / multijoueur (hors scope actuel)

---

## Historique versions

- **v1.1** — Combat PA, 7 crafts, Hôtel des Ventes, zones combat, sets fixes
- **v1.0.0** — 5 métiers, slots, perso, donjons, burger mobile
- **v0.6.0** — UI 3 colonnes, minibar, banque
- **v0.5.0** — Refonte sidebar, métiers parallèles, équipement
- **v0.4.0** — Prestige + audio
- **v0.3.0** — Offline + Jade
- **v0.2.0** — Zones + craft
- **v0.1.0** — MVP
