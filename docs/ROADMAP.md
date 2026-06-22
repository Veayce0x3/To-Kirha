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
| 8 | v1.5 | Carrière 2+2, HDV test, économie phase 1, cuisine pivot, GitHub Pages |

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

## Phase 9 — En cours

### Vision long terme (~10 ans)

- Saisons / Renaissance = pilier central
- **Économie spécialisée** : carrière → HDV test → HDV P2P
- **Cuisine** = pivot donjon → équipement
- Extensions : paliers > 200, nouvelles zones, événements saisonniers

### Livré récemment ✅

- [x] Fondations v1.2–v1.3 : ferme, durabilité, tutoriel, guidage, saisons
- [x] **Choix carrière** (2 récolte + 2 ferme + Puits)
- [x] **HDV test** (`testHdv.js`) — ressources non produites
- [x] **Économie phase 1** : clés DJ, drops équipement DJ, fusion, craft limité
- [x] **Cuisine pivot** : parchemins sur tous repas, % PV, coûts renforcés
- [x] Repas combat + inventaire · **GitHub Pages** live
- [x] `betaMode: false`

### Gameplay & contenu (reste)

- [ ] HDV joueur ↔ joueur (Supabase)
- [ ] Tutoriel adapté au choix carrière
- [ ] Balancing playtest (cuisine, HDV, fusion)
- [ ] Sets Brume / Lotus · paliers 200+

### UI & polish (reste)

- [ ] Sprites personnage + icônes ressources définitifs

### Technique (reste)

- [ ] Nettoyer legacy `dungeon.js` / `dungeons.json`
- [ ] Désactiver `testHdv` en prod finale
- [ ] Supabase · tests auto

### Plus tard

- [ ] 3ᵉ métier / bâtiment · carte monde · événements · PvP

---

## Historique versions

- **v1.5** — Carrière 2+2, HDV test, économie phase 1, cuisine pivot, GitHub Pages (`saveVersion` 26)
- **v1.3** — Ferme éleveur, durabilité outils, cuisine, tutoriel étendu (`saveVersion` 24)
- **v1.2** — Tutoriel, anti-idle, combat DQ équipe, saisons, guidage, assets récolte
- **v1.1** — Combat PA, 7 crafts, Hôtel des Ventes, zones combat, sets fixes
- **v1.0.0** — 5 métiers, slots, perso, donjons, burger mobile
- **v0.6.0** — UI 3 colonnes, minibar, banque
- **v0.5.0** — Refonte sidebar, métiers parallèles, équipement
- **v0.4.0** — Prestige + audio
- **v0.3.0** — Offline + Jade
- **v0.2.0** — Zones + craft
- **v0.1.0** — MVP
