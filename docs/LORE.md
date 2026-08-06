# To-Kirha — Bible histoire (Carnet du voyageur)

> Décisions figées (août 2026). Source narrative pour textes UI / Carnet.

## Identité

| Élément | Décision |
|---------|----------|
| Titre du jeu | **To-Kirha** |
| Village | **Village de To-Kirha** (pas « Sakura » comme toponyme) |
| Ambiance | Zen sakura (cerisiers, palette) — thème, pas le nom du lieu |
| Monnaie | **Kirha** = monnaie du village |
| Héros | Nouvel arrivant |
| Mission | Donnée par le **Conseil du village** |
| Livre | **Carnet du voyageur** — pages au fil de la progression, lecture optionnelle |
| Mystère | On ne sait pas encore pourquoi le village s’est vidé — révélation progressive |
| Adversaire | Pas de grand méchant annoncé ; le vide / l’oubli |
| Saisons | Chaque **nouvelle saison prestige** = page narrative dans le carnet |
| Textes | 3–8 lignes ; jamais bloquants |
| PNJ | Habitants déjà là (noyau) ; le village se remplit *autour* d’eux |

## Phrase d’univers

Tu arrives au village de To-Kirha, presque vide. Quelques habitants sont encore là. Le Conseil te confie de le faire revivre. Ton Carnet du voyageur se remplit au fil des gestes et des saisons. Pourquoi le village s’est vidé ? On ne sait pas encore — tu le découvres en jouant.

## Ton

Calme, mystérieux, chaleureux, contemplatif. Mix de voix PNJ (courtois, direct, gentil…). Pas sauver le monde : reconstruire le village et retrouver les savoirs.

## Système

- Data : `data/traveler_journal.json`
- Logique : `js/systems/travelerJournal.js`
- UI : vue Monde → **Carnet** (`traveler_journal`)
- Persistance : survit au prestige (comme le Livre de Cuisine)
