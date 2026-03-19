# To-Kirha — Contexte Projet

## Description
Jeu Web3 thème sakura inspiré de Dofus / Sunflower Land.
Web app React accessible navigateur mobile et PC, hébergée sur GitHub Pages.
Gameplay 100% off-chain (localStorage), sauvegarde on-chain via batch mint ERC-1155.
**Langue par défaut : Français. Multilingue FR/EN disponible — sélecteur sur ConnectPage.**

---

## Stack technique
- **Frontend** : React + Vite, TypeScript, Zustand (persist localStorage), React Router (HashRouter)
- **Wallet** : Wagmi v2 + Viem, RainbowKit
- **Blockchain** : Base Sepolia (testnet) / Base Mainnet
- **Smart contracts** : Hardhat + Solidity 0.8.24 + OpenZeppelin 5.x
- **Hébergement** : GitHub Pages — https://veayce0x3.github.io/To-Kirha/

---

## Workflow de développement
- **Petits fixes / UI** : modifier + `git add/commit/push` → GitHub Actions déploie automatiquement en 2-3 min. **Pas besoin de lancer le serveur local.**
- **Gros changements** (nouveaux contrats, refonte) : tester en local d'abord (`npm run dev`), puis push.
- **Serveur local** : `source ~/.nvm/nvm.sh && nvm use 20 && npm run dev`

---

## Commandes principales
```bash
# Toujours utiliser Node 20 (Node 24 incompatible avec Hardhat + ts-node)
source ~/.nvm/nvm.sh && nvm use 20

# Dev local
npm run dev

# Build production
npm run build

# Compiler les contrats Solidity
npm run compile

# Déployer les 4 contrats sur Base Sepolia
npm run deploy:sepolia

# Redéployer uniquement KirhaGame (garde Token/Resources/Market)
npx tsc --project tsconfig.hardhat.json && npx hardhat run dist-hardhat/scripts/deploy-game.js --network base-sepolia

# Vider le mempool si stuck
npx tsc --project tsconfig.hardhat.json && npx hardhat run dist-hardhat/scripts/flush-nonces.js --network base-sepolia
```

---

## Architecture de navigation

### Flow principal
```
ConnectPage (/)
  └── Map Principale (/home)
        ├── Récolte     (/recolte)     → Sélecteur métier → Zone ressources + timer
        ├── HDV         (/hdv)         → Vente PNJ + HDV on-chain KirhaMarket
        ├── Banque      (/banque)      → Retrait/Dépôt $KIRHA + Sauvegarde on-chain
        ├── Maison      (/maison)      → Inventaire + Stats + Perso
        └── Craft       (/craft)       → Crafting (WIP)
```

---

## Contrats déployés — Base Sepolia (chainId 84532)

**Déployés le 19 mars 2026 — wallet `0x5A9d55c76c38eDe9b8B34ED6e7F35578cE919b0C`**

| Contrat         | Adresse                                        | Dernière MAJ  |
|-----------------|------------------------------------------------|---------------|
| KirhaToken      | `0x7DF9F321829c9096622D81E640968e601e43a025`   | 19 mars 2026  |
| KirhaResources  | `0x581334a6725C5A6057cF63283655eb38AC1cA295`   | 19 mars 2026  |
| KirhaGame       | `0x9c9f9a2567099dc35C20e0E7e28E4E531Ae003Fb`   | 19 mars 2026  |
| KirhaMarket     | `0x0b98d02DFA79794e7f28943C5b757A43a4a3dc92`   | 19 mars 2026  |

Permissions configurées :
- KirhaGame → minter sur KirhaResources + KirhaToken
- KirhaMarket → minter sur KirhaToken

**Adresses écrites dans `src/contracts/addresses.ts`**

---

## Architecture des fichiers (état actuel — 19 mars 2026)
```
src/
├── App.tsx                  # Routes + Guards (VersionGuard v0.5.0, BeforeUnloadGuard)
├── main.tsx                 # WagmiProvider + RainbowKitProvider + QueryClientProvider
├── index.css                # Desktop max-width 820px, responsive slots-grid
├── assets/
│   ├── bucheron.ts          # KirhaTokenImg
│   └── personnage/index.ts  # resolveSprite()
├── components/
│   ├── BottomMenu.tsx       # Barre permanente : Accueil / Inventaire / 💾 Sauvegarder
│   └── Character.tsx        # Personnage 6 calques CSS, 4 directions
├── config/wagmi.ts
├── contracts/
│   ├── abis/
│   │   ├── KirhaGame.json   # batchMintResources + withdrawKirha + registerPseudo + isPseudoAvailable
│   │   └── KirhaMarket.json # listResource / batchListResources / buyResource / cancelListing / getActiveListings
│   └── addresses.ts         # Adresses déployées (les 4 contrats)
├── data/
│   ├── metiers.ts           # 5 métiers × 10 ressources = 50 IDs | TEST_MODE=true → 2s
│   ├── resources.ts         # Enum ResourceId (1-50)
│   └── vetements.ts
├── hooks/
│   ├── useHarvest.ts        # Timer, planterRessource(), collecterEtRelancer() — PAS d'auto-collect
│   ├── useSave.ts           # batchMintResources on-chain — floor() les quantités, garde les fractions
│   ├── useWithdraw.ts       # withdrawKirha on-chain
│   ├── useDeposit.ts        # KirhaToken.transfer → KIRHA_GAME_ADDRESS
│   └── useMarket.ts         # HDV on-chain : listings, approbation ERC-1155, batch list/buy/cancel
├── pages/
│   ├── ConnectPage.tsx      # Landing + pseudo on-chain + LangToggle
│   ├── HomePage.tsx         # Map principale (5 cards)
│   ├── RecoltePage.tsx      # Sélecteur métier + Zone récolte (slots + timer)
│   ├── HdvPage.tsx          # 2 onglets : PNJ (off-chain) + On-chain (KirhaMarket)
│   ├── BanquePage.tsx       # Retrait $KIRHA / Dépôt / Sauvegarde / wallet_watchAsset
│   ├── MaisonPage.tsx       # Inventaire + stats métiers + perso
│   └── CraftPage.tsx        # WIP
├── store/gameStore.ts       # Zustand persist v5, retirerRessource, soustraireMintesPending
└── utils/
    ├── grid.ts              # Pathfinding A* (gardé pour usage futur)
    ├── tiled.ts             # Parser Tiled JSON (gardé pour usage futur)
    ├── i18n.ts              # Traductions FR/EN complètes (50 ressources + UI)
    ├── resourceUtils.ts     # emojiByResourceId(), getNomRessource() — source unique
    └── cityId.ts

contracts/
├── KirhaToken.sol           # ERC-20 $KIRHA, mintable par KirhaGame + KirhaMarket
├── KirhaResources.sol       # ERC-1155, 50 IDs ressources
├── KirhaGame.sol            # batchMintResources + withdrawKirha + registerPseudo (ECDSA désactivé testnet)
└── KirhaMarket.sol          # HDV on-chain : escrow ERC-1155, burn/mint $KIRHA, taxe 50%, batchListResources

scripts/
├── deploy.ts                # Déploie 4 contrats, nonces séquentiels, gasPrice 15 gwei
├── deploy-game.ts           # Redéploie uniquement KirhaGame + configure permissions
├── flush-nonces.ts          # Purge mempool (20 gwei), scanner +30 nonces
└── gen-character-assets.ts
```

---

## Routing
```
/         → ConnectPage
/home     → HomePage
/recolte  → RecoltePage
/hdv      → HdvPage
/banque   → BanquePage
/maison   → MaisonPage
/craft    → CraftPage
```

---

## Fonctionnalités implémentées (19 mars 2026)

### Système de récolte (useHarvest)
- **Pas d'auto-collect** — le joueur collecte manuellement en cliquant le slot "Prêt"
- Ressource "en main" : bouton Choisir → ressource sélectionnée → cliquer un slot pour planter
- `collecterEtRelancer()` : collecte + redémarre immédiatement avec la même ressource
- Badges métier : "X actifs" (couleur métier), "✓ Prêt" (vert), "Inactif" (rouge)

### Sauvegarde on-chain (useSave)
- `batchMintResources(ids[], amounts[])` — sans nonce ni signature (testnet)
- **Floor des quantités** : seule la partie entière est mintée (ex: 1.4 → mint 1, garde 0.4)
- `soustraireMintesPending` : soustrait uniquement les entiers mintés, conserve les fractions
- Bouton 💾 dans le menu bas : badge rouge = nb ressources en attente, état erreur si échec
- Auto-save sur `beforeunload` si pending_mints.length > 0

### Pseudo unique on-chain (KirhaGame + ConnectPage)
- `registerPseudo(string)` : enregistre le pseudo on-chain (unique global, payé en gas une fois)
- `isPseudoAvailable(string)` : vérifié avant signature
- `playerPseudo(address)` : getter auto — reconnecte les joueurs existants sans saisie
- ConnectPage vérifie on-chain au connect : si pseudo existe → direct /home, sinon → formulaire
- Plus de localStorage pour les pseudos — tout est on-chain

### Banque (BanquePage)
- **Retrait** : `withdrawKirha(amount)` → mint $KIRHA vers le joueur
- **Dépôt** : `KirhaToken.transfer(KIRHA_GAME_ADDRESS, amount)` → crédite le solde in-game
- **wallet_watchAsset** : bouton "+ Ajouter $KIRHA au wallet" (EIP-747, compatible Rabby)
- Sauvegarde on-chain manuelle

### HDV on-chain (KirhaMarket + useMarket)
- **Onglet PNJ** : vente off-chain à prix fixe
- **Onglet On-chain** : 3 sous-onglets
  - *Acheter* : listings triés du moins cher au plus cher, filtre par ressource, ses propres listings visibles avec badge "Votre vente"
  - *Vendre* : système **panier** — ajouter N ressources, 1 seule signature via `batchListResources`
    - Prix pré-rempli avec le plus bas du marché (ou 0.01 si aucune offre)
    - Récapitulatif : total brut / taxe 50% / montant reçu
    - Après succès : `retirerRessource` décrémente l'inventaire local
  - *Mes ventes* : liste ses propres listings, `cancelListing`, montant estimé affiché
- `waitForTransactionReceipt` avant tout refetch (fix listing invisible)
- Taxe 50% treasury affichée dans l'UI

### Multilingue (i18n)
- FR/EN complet : navigation, UI, 50 noms de ressources
- `useT()` hook → `t(key)` + `lang`
- `getNomRessource(id, lang)` dans `resourceUtils.ts`
- Sélecteur 🇫🇷/🇬🇧 sur ConnectPage

---

## ERC-1155 — IDs ressources
| Métier      | IDs   | Ressources (niveau 1→90)                                                          |
|-------------|-------|-----------------------------------------------------------------------------------|
| Bûcheron    | 1-10  | Frêne, Séquoia, Chêne, Bouleau, Érable, Bambou, Ginkgo, Magnolia, Cerisier Doré, Sakura |
| Paysan      | 11-20 | Blé, Orge, Seigle, Avoine, Maïs, Riz, Millet, Sarrasin, Riz Violet, Riz Sakura  |
| Pêcheur     | 21-30 | Carpe Japonaise, Crabe, Saumon, Homard, Naso, Pieuvre, Calmar, Crevette Sakura, Fugu, Carpe Koï Dorée |
| Mineur      | 31-40 | Pierre, Charbon, Cuivre, Fer, Topaze, Émeraude, Jade, Diamant, Saphir Sakura, Cristal Koï |
| Alchimiste  | 41-50 | Pissenlit, Menthe, Ortie, Lavande, Pivoine, Wisteria, Chrysanthème, Ginseng, Fleur Lotus Sakura, Herbe Koï |

---

## État du projet (19 mars 2026)

### CE QUI EST FAIT ET FONCTIONNEL ✅
| Composant                      | Fichier                        | État             |
|--------------------------------|--------------------------------|------------------|
| Routing + Guards               | App.tsx                        | ✅ v0.5.0        |
| Page connexion + pseudo on-chain | ConnectPage.tsx              | ✅ Complet       |
| Map principale (5 cards)       | HomePage.tsx                   | ✅ Complet       |
| Récolte (sélecteur + zones)    | RecoltePage.tsx                | ✅ Complet       |
| HDV PNJ + On-chain (panier)    | HdvPage.tsx                    | ✅ Complet       |
| Banque (retrait/dépôt/save)    | BanquePage.tsx                 | ✅ Complet       |
| Maison (inventaire+stats)      | MaisonPage.tsx                 | ✅ Complet       |
| Menu bas + bouton 💾           | BottomMenu.tsx                 | ✅ Complet       |
| Personnage (Maison)            | Character.tsx                  | ✅ 4 dirs        |
| Hook récolte                   | hooks/useHarvest.ts            | ✅ Manuel        |
| Hook sauvegarde (floor fix)    | hooks/useSave.ts               | ✅ On-chain      |
| Hook retrait                   | hooks/useWithdraw.ts           | ✅ On-chain      |
| Hook dépôt                     | hooks/useDeposit.ts            | ✅ On-chain      |
| Hook marché (batch + refetch)  | hooks/useMarket.ts             | ✅ Complet       |
| Traductions FR/EN              | utils/i18n.ts                  | ✅ 50 res.       |
| Emojis/noms ressources         | utils/resourceUtils.ts         | ✅ Centralisé    |
| Store Zustand                  | store/gameStore.ts             | ✅ v5            |
| Données métiers                | data/metiers.ts                | ✅ TEST_MODE     |
| Smart contracts                | contracts/                     | ✅ Déployés      |
| CI/CD GitHub Pages             | .github/workflows/deploy.yml   | ✅ En place      |
| Pseudo unique global on-chain  | KirhaGame.sol + ConnectPage    | ✅ Complet       |
| Reset parties (Zustand v5)     | store/gameStore.ts             | ✅ Fait          |

### CE QUI MANQUE / EST EN ATTENTE ⏳
| Élément                           | Priorité   | Notes                                        |
|-----------------------------------|------------|----------------------------------------------|
| TEST_MODE → false                 | Haute      | Avant production (timers réels 30 min)       |
| Vérification ECDSA on-chain       | Haute      | Avant mainnet (KirhaGame)                    |
| Session key (gasless)             | Moyenne    | Nécessite backend relayer (ERC-4337)         |
| Sprites ressources pixel art      | Moyenne    | 50 assets à créer                            |
| CraftPage (contenu)               | Basse      | À concevoir                                  |
| MaisonPage — vêtements/bonus      | Basse      | Système équipement à brancher                |
| NFT de progression                | Basse      | Tokenisation compte joueur                   |
| Frames animation marche/récolte   | Basse      | Après gameplay complet                       |
| Pépites d'or                      | Très basse | Monnaie premium, usage à définir             |

---

## Testnet v1 → Mainnet v2
La v1 testnet est entièrement wipeble pour la v2 mainnet. La migration impliquera :
- `TEST_MODE = false` dans `metiers.ts` (timers réels ~30 min)
- ECDSA activé sur KirhaGame (nonce anti-replay)
- Redéploiement complet sur Base Mainnet
- Nouveau store Zustand v1 (reset)
- Vraie clé déployeur dédiée mainnet

---

## Problèmes connus et solutions

### Node 24 incompatible
Toujours utiliser Node 20 : `source ~/.nvm/nvm.sh && nvm use 20`

### Hardhat + type:module
`"type": "module"` retiré de package.json. Scripts compilés via `tsconfig.hardhat.json`.
Déploiement : `npx tsc --project tsconfig.hardhat.json && npx hardhat run dist-hardhat/scripts/deploy.js --network base-sepolia`

### Mempool Base Sepolia congestionné — solution définitive
Le script `flush-nonces.ts` utilise **20 gwei** et scanne +30 nonces.
Le script `deploy.ts` utilise des **nonces séquentiels** (variable `nonce++`) pour éviter les doublons.
Ne JAMAIS appeler `getTransactionCount('pending')` plusieurs fois de suite — utiliser un compteur local.

### writeFileSync dans deploy.ts
Le path `__dirname` résout vers `dist-hardhat/scripts/` après compilation TS.
Si le fichier `addresses.ts` n'est pas écrit automatiquement, l'écrire manuellement depuis les adresses affichées en console.

### evmVersion Cancun
OpenZeppelin 5.x utilise l'opcode `mcopy`. `hardhat.config.ts` a `evmVersion: 'cancun'`.

### BigInt et quantités fractionnaires
`BigInt(0.4)` plante. Dans `useSave`, toujours utiliser `Math.floor(quantite)` et filtrer `>= 1` avant de construire les args du contrat.

### Listing HDV invisible après transaction
Toujours utiliser `waitForTransactionReceipt` avant `refetchListings()` — sinon le listing n'est pas encore indexé.

---

## Variables d'environnement (.env)
```
VITE_WALLETCONNECT_PROJECT_ID=   # UUID depuis cloud.walletconnect.com (aussi dans GitHub Secrets)
DEPLOYER_PRIVATE_KEY=0x...       # Clé privée wallet déployeur — NE JAMAIS COMMITER
BASESCAN_API_KEY=                # Optionnel, vérification contrats
```

---

## Notes pour Claude
- Toujours utiliser Node 20 (`nvm use 20`) avant les commandes Hardhat
- Ne pas monter le gasPrice au-delà de 20 gwei sur Base Sepolia testnet
- Le projet n'a pas de `"type": "module"` dans package.json
- Demander confirmation avant de modifier plusieurs fichiers à la fois
- Animations personnage **EN PAUSE** — ne pas travailler dessus avant que le gameplay soit complet
- `TEST_MODE = true` dans `metiers.ts` → temps de récolte 2s. Passer à `false` avant production
- **Plus de navigation par map Tiled** — l'interface est 100% cards/pages React
- `resourceUtils.ts` est la **source unique** pour emojis et noms de ressources — ne pas dupliquer ailleurs
- Le nom du jeu ($KIRHA, Pépites d'or) reste en français même en version EN
- KirhaGame testnet : ECDSA désactivé — à réactiver avant mainnet avec nonce anti-replay
- KirhaMarket : taxe 50% hardcodée (TAX_BPS = 5000) — non modifiable sans redéploiement
- **Workflow** : petits fixes → push direct sur main (pas besoin de serveur local). Gros changements → local d'abord.
- `.claude/` est dans `.gitignore` — ne jamais commiter les settings locaux Claude
