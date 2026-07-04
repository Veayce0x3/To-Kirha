# 🌸 TO-KIRHA — Roadmap

> Source de vérité du planning. Mettre à jour à chaque feature livrée.

## Vision (2026)

Jeu web idle/RPG **zen sakura** : récolte parallèle active, carrière spécialisée, cuisine pivot donjon, combat PvE tour par tour, sets d'équipement, économie Kirha.

Monnaie : **Kirha**. Stack : vanilla JS, HTML, CSS, JSON. Hébergement : **GitHub Pages** (+ Supabase plus tard).

---

## Phases livrées ✅

| Phase | Version | Contenu |
|-------|---------|---------|
| 0 | v0.1 | Fondations, save, boucle Kirha |
| 1 | v0.1 | MVP Village, bûcheron, upgrades |
| 2 | v0.2 | Zones, pêcheur, craft, rentabilité |
| 3 | v0.3 | Jade, mineur, artisan, export save |
| 4 | v0.4 | Prestige, audio, polish, stub Supabase |
| 5 | v0.5–0.6 | UI sidebar, tuiles métiers, banque, minibar, burger mobile |
| 6 | v1.0 | 5 métiers récolte, slots parallèles, perso, donjons |
| 7 | v1.1 | Renommage sakura, Hôtel des Ventes, combat PA, zones combat |
| 8 | v1.5 | Carrière 2+2, HDV test, économie phase 1, cuisine pivot, GitHub Pages |
| 9 | v1.6 | Perso refonte, picker équipement, HDV mobile, fusion atelier, UX récolte |

---

## v1.6 — Livré ✅

- [x] **HDV mobile-first** : chips par métier, bottom sheet, refresh partiel
- [x] **Perso refonte** : stats pills, grille équipement, onglets Sac / Équipement / Outils / Équipe
- [x] **Picker équipement** : clic slot → liste pièces compatibles
- [x] **Fusion** déplacée vers Atelier (onglet 🔮)
- [x] **Carrière obligatoire** : nav verrouillée, pseudo avant validation, reset modal propre
- [x] **Récolte prête** : son + badge + toast + pulse nav
- [x] **Combat** : drops équipement solo, pépites Sac/HDV, retrait onglets Sorts/Défense

---

## Phase 10 — En cours

### Vision long terme (~10 ans)

- Saisons / Renaissance = pilier central
- **Économie spécialisée** : carrière → HDV test → HDV P2P
- **Cuisine** = pivot donjon → équipement
- Extensions : paliers > 200, nouvelles zones, événements saisonniers

### Gameplay & contenu (reste)

- [ ] HDV joueur ↔ joueur (Supabase)
- [ ] Tutoriel adapté au choix carrière
- [ ] Balancing playtest (cuisine, HDV, fusion, drops solo)
- [ ] Sets Brume / Lotus · paliers 200+

### UI & polish (reste)

- [ ] Sprites personnage + icônes ressources définitifs

### Technique (reste)

- [ ] Nettoyer legacy : `aides.json`, `passive.js`, `dungeon.js` / `dungeons.json`
- [ ] Désactiver `testHdv` en prod finale
- [ ] Supabase · tests auto

### Plus tard

- [ ] 3ᵉ métier / bâtiment · carte monde · événements · PvP

---

## Historique versions

- **v1.6** — Perso, picker équipe, HDV mobile, fusion atelier, carrière verrou, UX récolte
- **v1.5** — Carrière 2+2, HDV test, économie phase 1, cuisine pivot, GitHub Pages (`saveVersion` 26)
- **v1.3** — Ferme éleveur, durabilité outils, cuisine, tutoriel étendu (`saveVersion` 24)
- **v1.2** — Tutoriel, combat DQ équipe, saisons, guidage, assets récolte
- **v1.1** — Combat PA, Hôtel des Ventes, zones combat, sets fixes
- **v1.0.0** — 5 métiers, slots, perso, donjons, burger mobile
- **v0.6.0** — UI 3 colonnes, minibar, banque
- **v0.5.0** — Refonte sidebar, métiers parallèles, équipement
- **v0.4.0** — Prestige + audio
- **v0.3.0** — Export save + zones Jade
- **v0.2.0** — Zones + craft
- **v0.1.0** — MVP

---

## Retiré du scope actif

- 6 ateliers équipement (Forgeron–Bijoutier) — craft UI off, données conservées
- Aides / récolte passive automatique
- Gains offline ressources
- Limites journalières combat
- Prérequis kills avant entrée donjon
