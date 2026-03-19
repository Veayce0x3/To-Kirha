# To-Kirha — Contexte Projet

## Description
Jeu Web3 thème sakura inspiré de Dofus / Sunflower Land.
Web app React accessible navigateur mobile et PC, hébergée sur GitHub Pages.
**Architecture City NFT (Option B)** : chaque joueur possède un NFT ERC-721 "ville" qui contient toutes ses données (ressources, niveaux, $KIRHA in-game). Transférer le NFT transfère tout.
Gameplay 100% off-chain (localStorage), sauvegarde on-chain via `batchSave`.
**Langue par défaut : Français. Multilingue FR/EN — sélecteur sur ConnectPage.**

---

## Stack technique
- **Frontend** : React + Vite, TypeScript, Zustand v7 (persist localStorage), React Router (HashRouter)
- **Wallet** : Wagmi v2 + Viem, RainbowKit
- **Blockchain** : Base Sepolia (testnet) / Base Mainnet (futur)
- **Smart contracts** : Hardhat + Solidity 0.8.24 + OpenZeppelin 5.x + `viaIR: true` (stack too deep fix)
- **Hébergement** : GitHub Pages — https://veayce0x3.github.io/To-Kirha/
- **CI/CD** : GitHub Actions (push main → build → deploy gh-pages automatique)

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

# Déployer les 5 contrats sur Base Sepolia
npm run deploy:sepolia

# Vider le mempool si stuck
npx tsc --project tsconfig.hardhat.json && npx hardhat run dist-hardhat/scripts/flush-nonces.js --network base-sepolia
```

---

## Architecture de navigation

### Flow principal
```
ConnectPage (/)
  └── HomePage (/home)
        ├── Récolte     (/recolte)    → Sélecteur métier → Zone ressources + timer
        ├── HDV         (/hdv)        → Vente PNJ + HDV on-chain KirhaMarket
        ├── Banque      (/banque)     → Retrait/Dépôt $KIRHA + Sauvegarde on-chain
        ├── Maison      (/maison)     → Inventaire + Stats + Perso
        └── Craft       (/craft)      → Crafting (WIP)

/admin  → AdminPage (wallet whitelist uniquement)
```

---

## Contrats déployés — Base Sepolia (chainId 84532)

**Déployés le 19 mars 2026 — wallet `0x5A9d55c76c38eDe9b8B34ED6e7F35578cE919b0C`**
**Version : v2 City NFT (architecture complète cityId-indexée)**

| Contrat         | Adresse                                      |
|-----------------|----------------------------------------------|
| KirhaToken      | `0xA3FA9725B70735F8d102CaF3A6CE1eD3d7dFD9d3` |
| KirhaResources  | `0x92395a2D56E5Ae7f406009c91a962A9840d159EE` |
| KirhaCity       | `0x5e1E573Ca5b503643b22f59a4D2d93a815Fa4d4E` |
| KirhaGame       | `0xDD953d02f953c166C100FA2A9b9d1cdAf51Ff846` |
| KirhaMarket     | `0xf90F7BDF45757a1bd9a3C599dFdCbF987c1E651a` |

Permissions configurées :
- KirhaCity → `setGame(KirhaGame)`
- KirhaGame → minter sur KirhaResources + KirhaToken
- KirhaMarket → operator sur KirhaGame + minter sur KirhaToken

**Adresses écrites dans `src/contracts/addresses.ts`**

---

## Architecture City NFT (Option B) — Principe fondamental

Toutes les données de jeu sont **indexées par cityId**, jamais par adresse wallet.

```solidity
// KirhaGame.sol
mapping(uint256 => mapping(uint256 => uint256)) public cityResources; // cityId→resourceId→montant (×1e4)
mapping(uint256 => uint256)                     public cityKirha;     // $KIRHA in-game (wei)
mapping(uint256 => mapping(uint8 => uint32))    public cityMetierLevel;
mapping(uint256 => string)                      public cityPseudo;

// KirhaCity.sol (ERC-721)
mapping(address => uint256) public ownerToCityId;  // reverse mapping — mis à jour sur chaque transfert
```

**Conséquence** : transférer le NFT KirhaCity transfère automatiquement ressources, niveaux, $KIRHA in-game et pseudo — car tout est stocké par cityId dans KirhaGame.

**`playerCityId(address)`** dans KirhaGame = `cityNft.ownerToCityId(player)` — la source de vérité.

### villeId — règle absolue
- **Toujours lu depuis la blockchain** via `playerCityId(address)` après connexion
- **Jamais initialisé depuis localStorage ou un compteur local**
- Store Zustand : `villeId: ''` par défaut, `setVilleId(cityId.toString())` appelé dans ConnectPage après 1.5s de délai RPC
- Tout hook utilisant villeId vérifie `villeId && villeId !== '0'` avant d'appeler les contrats

---

## Architecture des fichiers (état actuel — 19 mars 2026)
```
src/
├── App.tsx                  # Routes + Guards (VersionGuard v0.5.0, BeforeUnloadGuard)
│                            # Routes: /, /home, /recolte, /hdv, /banque, /maison, /craft, /admin
├── main.tsx                 # WagmiProvider + RainbowKitProvider + QueryClientProvider
├── index.css                # Desktop max-width 820px, responsive slots-grid
├── assets/
│   ├── bucheron.ts          # KirhaTokenImg
│   └── personnage/index.ts  # resolveSprite()
├── components/
│   ├── BottomMenu.tsx       # Barre permanente : Accueil / Inventaire (modal 2 onglets) / 💾 Sauvegarder
│   ├── Character.tsx        # Personnage 6 calques CSS, 4 directions
│   └── SettingsModal.tsx    # Paramètres : langue, save, transfert ville NFT, déconnexion
├── config/wagmi.ts
├── contracts/
│   ├── abis/
│   │   ├── KirhaGame.json   # batchSave / withdrawKirha / depositKirha / getCityResources
│   │   │                    # getCityMetiers / getCityPseudos / playerCityId / playerCount
│   │   ├── KirhaCity.json   # ownerOf / ownerToCityId / mintCity / safeTransferFrom
│   │   └── KirhaMarket.json # listResource / buyResource / cancelListing / getActiveListings
│   │                        # (listingId contient sellerCityId, pas d'escrow ERC-1155)
│   └── addresses.ts         # 5 contrats déployés (Token, Resources, City, Game, Market)
├── data/
│   ├── metiers.ts           # 5 métiers × 10 ressources = 50 IDs | TEST_MODE=true → 2s
│   ├── resources.ts         # Enum ResourceId (1-50)
│   └── vetements.ts
├── hooks/
│   ├── useHarvest.ts        # Timer, planterRessource(), collecterEtRelancer() — PAS d'auto-collect
│   ├── useSave.ts           # batchSave on-chain (ressources ×1e4 + 5 métiers + kirhaEarned)
│   ├── useWithdraw.ts       # withdrawKirha(cityId, amount)
│   ├── useDeposit.ts        # depositKirha(cityId, amount) — KirhaGame burn ERC-20, crédite cityKirha
│   └── useMarket.ts         # HDV : cityId pour toutes ops, getCityPseudos batch, pas d'approbation ERC-1155
├── pages/
│   ├── ConnectPage.tsx      # Landing + pseudo on-chain + LangToggle + register/login flow
│   ├── HomePage.tsx         # Map principale (5 cards) + pseudo + "Ville #X"
│   ├── RecoltePage.tsx      # Sélecteur métier + Zone récolte (slots + timer)
│   ├── HdvPage.tsx          # PNJ off-chain + On-chain (sellerPseudo affiché, plus d'approbation ERC-1155)
│   ├── BanquePage.tsx       # Retrait $KIRHA / Dépôt / Sauvegarde / wallet_watchAsset
│   ├── MaisonPage.tsx       # Inventaire + stats métiers + perso
│   ├── CraftPage.tsx        # WIP
│   └── AdminPage.tsx        # /admin — whitelist wallet, stats on-chain complètes
├── store/gameStore.ts       # Zustand persist v7, villeId='', kirhaEarned, resetKirhaEarned, setVilleId
└── utils/
    ├── grid.ts              # Pathfinding A* (gardé pour usage futur)
    ├── tiled.ts             # Parser Tiled JSON (gardé pour usage futur)
    ├── i18n.ts              # Traductions FR/EN complètes (50 ressources + UI)
    ├── resourceUtils.ts     # emojiByResourceId(), getNomRessource() — SOURCE UNIQUE, ne pas dupliquer
    └── cityId.ts            # (obsolète — plus utilisé, villeId vient du on-chain)

contracts/
├── KirhaToken.sol           # ERC-20 $KIRHA, mintable par KirhaGame + KirhaMarket
├── KirhaResources.sol       # ERC-1155, 50 IDs ressources (utilisé pour opérations mais non transféré en HDV)
├── KirhaCity.sol            # ERC-721 city NFT — ownerToCityId updated dans _update() override
├── KirhaGame.sol            # batchSave + withdrawKirha + depositKirha + registerPseudo
│                            # getCityResources / getCityMetiers / getCityPseudos / playerCityId
│                            # operator fns: operatorDeductResource, operatorAddKirha, etc.
│                            # ECDSA désactivé sur testnet (à réactiver avant mainnet)
└── KirhaMarket.sol          # HDV city-to-city : escrow dans cityResources (pas ERC-1155)
                             # taxe 50% (TAX_BPS = 5000), burn/mint $KIRHA

scripts/
├── deploy.ts                # Déploie 5 contrats, nonces séquentiels, gasPrice 15 gwei
├── flush-nonces.ts          # Purge mempool (20 gwei), scanner +30 nonces
└── gen-character-assets.ts
```

---

## Routing
```
/         → ConnectPage
/home     → HomePage (Guard: wallet connecté requis)
/recolte  → RecoltePage (Guard)
/hdv      → HdvPage (Guard)
/banque   → BanquePage (Guard)
/maison   → MaisonPage (Guard)
/craft    → CraftPage (Guard)
/admin    → AdminPage (Guard + whitelist wallet 0x5A9d55c76c38eDe9b8B34ED6e7F35578cE919b0C)
```

---

## Fonctionnalités implémentées (19 mars 2026)

### Connexion / Inscription (ConnectPage)
- Deux boutons : "Se connecter" (mode login) / "Créer une ville" (mode register)
- Login : lit `playerPseudo(address)` on-chain → si pseudo trouvé → lit `playerCityId` → `/home`
- Register : formulaire pseudo → vérifie `isPseudoAvailable` → `registerPseudo(pseudo)` → mint ville NFT
- Délai 1.5s après `waitForTransactionReceipt` pour laisser le RPC propager avant de lire `playerCityId`
- **`villeId` source de vérité = on-chain uniquement** — jamais de localStorage

### Système de récolte (useHarvest)
- **Pas d'auto-collect** — le joueur collecte manuellement en cliquant le slot "Prêt"
- Ressource "en main" : bouton Choisir → ressource sélectionnée → cliquer un slot pour planter
- `collecterEtRelancer()` : collecte + redémarre immédiatement avec la même ressource
- Badges métier : "X actifs" (couleur métier), "✓ Prêt" (vert), "Inactif" (rouge)
- 5 slots débloqués par défaut, jusqu'à 20 slots par métier (coût ressources + $KIRHA)

### Sauvegarde on-chain (useSave + batchSave)
- Appelle `batchSave(cityId, resourceIds[], resourceAmts[], metierIds[], metierLevels[], metierXps[], metierXpTotals[], kirhaGained)` en une seule tx
- **Ressources scaled ×1e4** : 1.4 unités → 14000 on-chain (pas de float en Solidity)
- **Floor des quantités** : seule la partie entière est mintée (ex: 1.4 → mint 1, garde 0.4 en local)
- `soustraireMintesPending` : soustrait uniquement les entiers mintés, conserve les fractions
- `kirhaEarned` : $KIRHA accumulé via ventes PNJ depuis la dernière save → envoyé en wei via `parseEther`
- Bouton 💾 dans BottomMenu : badge rouge = nb ressources en attente
- Auto-save sur `beforeunload` si pending_mints.length > 0

### Paramètres + Transfert de ville (SettingsModal)
- Accessible via ⚙️ sur HomePage
- **Transfert de ville NFT** : `safeTransferFrom(from, to, cityId)` sur KirhaCity
  - Ressources, niveaux, $KIRHA in-game et pseudo suivent automatiquement
  - Auto-déconnexion + retour `/` après succès
- Sauvegarde manuelle, sélecteur langue, déconnexion

### Banque (BanquePage)
- **Retrait** : `withdrawKirha(cityId, amount)` → mint $KIRHA ERC-20 vers le joueur, déduit cityKirha
- **Dépôt** : `depositKirha(cityId, amount)` → KirhaGame brûle les ERC-20, crédite cityKirha
- **wallet_watchAsset** : bouton "+ Ajouter $KIRHA au wallet" (EIP-747, compatible Rabby)

### HDV on-chain (KirhaMarket + useMarket)
- **Pas d'approbation ERC-1155** — tout passe par les fonctions operator de KirhaGame
- Struct `Listing` : `sellerCityId` (pas d'adresse), `resourceId`, `quantity`, `pricePerUnit`
- `getCityPseudos(cityIds[])` : batch getter — récupère les pseudos vendeurs en 1 appel
- **Onglet PNJ** : vente off-chain à prix fixe
- **Onglet On-chain** : 3 sous-onglets
  - *Acheter* : listings triés prix, `sellerPseudo` affiché, filtre ressource
  - *Vendre* : panier multi-ressources → 1 signature `batchListResources`
  - *Mes ventes* : `cancelListing`, montant estimé affiché
- `waitForTransactionReceipt` avant refetch (fix listing invisible)
- Taxe 50% treasury affichée dans l'UI (TAX_BPS = 5000 — non modifiable sans redéploiement)

### Page Admin (/admin)
- Whitelist : `['0x5A9d55c76c38eDe9b8B34ED6e7F35578cE919b0C']` — accès refusé sinon
- Données lues on-chain sur bouton "Charger" (pas d'auto-fetch)
- Stats globales : villes créées, joueurs, listings total, listings actifs
- Liste joueurs expandable : cityId, pseudo, wallet, $KIRHA, ressources on-chain, niveaux métiers
- Top 15 ressources globales (somme tous joueurs)

### Multilingue (i18n)
- FR/EN complet : navigation, UI, 50 noms de ressources
- `useT()` hook → `t(key)` + `lang`
- `getNomRessource(id, lang)` dans `resourceUtils.ts`
- Sélecteur 🇫🇷/🇬🇧 sur ConnectPage (avant connexion wallet) + SettingsModal

---

## Zustand Store v7 — Champs clés
```typescript
villeId:      ''        // Jamais depuis localStorage — setVilleId() appelé depuis ConnectPage
kirhaEarned:  0         // $KIRHA ventes PNJ depuis dernière save — resetKirhaEarned() après batchSave
pseudo:       null      // setPseudo() appelé depuis ConnectPage après on-chain read
```

**Migration v7** : reset complet + suppression des clés localStorage héritées (`kirha_city_id`, `kirha_next_city_id`, `kirha_pseudos`).

---

## ERC-1155 — IDs ressources on-chain
| Métier      | IDs   | Ressources (niveau 1→90)                                                              |
|-------------|-------|---------------------------------------------------------------------------------------|
| Bûcheron    | 1-10  | Frêne, Séquoia, Chêne, Bouleau, Érable, Bambou, Ginkgo, Magnolia, Cerisier Doré, Sakura |
| Paysan      | 11-20 | Blé, Orge, Seigle, Avoine, Maïs, Riz, Millet, Sarrasin, Riz Violet, Riz Sakura      |
| Pêcheur     | 21-30 | Carpe Japonaise, Crabe, Saumon, Homard, Naso, Pieuvre, Calmar, Crevette Sakura, Fugu, Carpe Koï Dorée |
| Mineur      | 31-40 | Pierre, Charbon, Cuivre, Fer, Topaze, Émeraude, Jade, Diamant, Saphir Sakura, Cristal Koï |
| Alchimiste  | 41-50 | Pissenlit, Menthe, Ortie, Lavande, Pivoine, Wisteria, Chrysanthème, Ginseng, Fleur Lotus Sakura, Herbe Koï |

**Metier IDs on-chain** : bucheron=0, paysan=1, pecheur=2, mineur=3, alchimiste=4

---

## État du projet (19 mars 2026)

### CE QUI EST FAIT ET FONCTIONNEL ✅
| Composant                        | Fichier                        | État             |
|----------------------------------|--------------------------------|------------------|
| Routing + Guards                 | App.tsx                        | ✅ v0.5.0        |
| Architecture City NFT complète   | KirhaCity + KirhaGame          | ✅ Déployée      |
| Page connexion + pseudo on-chain | ConnectPage.tsx                | ✅ Complet       |
| Fix villeId (source on-chain)    | ConnectPage + gameStore v7     | ✅ Complet       |
| Map principale (5 cards)         | HomePage.tsx                   | ✅ Complet       |
| Récolte (sélecteur + zones)      | RecoltePage.tsx                | ✅ Complet       |
| HDV PNJ + On-chain (cityId)      | HdvPage.tsx + useMarket        | ✅ Complet       |
| Banque (retrait/dépôt/save)      | BanquePage.tsx                 | ✅ Complet       |
| Maison (inventaire+stats)        | MaisonPage.tsx                 | ✅ Complet       |
| Menu bas + bouton 💾             | BottomMenu.tsx                 | ✅ Complet       |
| SettingsModal + transfert ville  | SettingsModal.tsx              | ✅ Complet       |
| Personnage (Maison)              | Character.tsx                  | ✅ 4 dirs        |
| Hook sauvegarde (batchSave)      | hooks/useSave.ts               | ✅ On-chain      |
| Hook retrait                     | hooks/useWithdraw.ts           | ✅ On-chain      |
| Hook dépôt                       | hooks/useDeposit.ts            | ✅ On-chain      |
| Hook marché (cityId, pseudos)    | hooks/useMarket.ts             | ✅ Complet       |
| Traductions FR/EN                | utils/i18n.ts                  | ✅ 50 res.       |
| Emojis/noms ressources           | utils/resourceUtils.ts         | ✅ Centralisé    |
| Store Zustand                    | store/gameStore.ts             | ✅ v7            |
| Page Admin /admin                | AdminPage.tsx                  | ✅ Complet       |
| CI/CD GitHub Pages               | .github/workflows/             | ✅ En place      |

### CE QUI MANQUE / EST EN ATTENTE ⏳
| Élément                           | Priorité   | Notes                                        |
|-----------------------------------|------------|----------------------------------------------|
| TEST_MODE → false                 | Haute      | Avant production (timers réels ~30 min)      |
| Vérification ECDSA on-chain       | Haute      | Avant mainnet (KirhaGame, nonce anti-replay) |
| Session key (gasless)             | Moyenne    | Nécessite backend relayer (ERC-4337)         |
| Sprites ressources pixel art      | Moyenne    | 50 assets à créer                            |
| CraftPage (contenu)               | Basse      | À concevoir                                  |
| MaisonPage — vêtements/bonus      | Basse      | Système équipement à brancher                |
| Frames animation marche/récolte   | Basse      | Après gameplay complet (EN PAUSE)            |
| Pépites d'or                      | Très basse | Monnaie premium, usage à définir             |

---

## Testnet v1 → Mainnet v2
La v1 testnet est entièrement wipeble pour la v2 mainnet. Migration impliquera :
- `TEST_MODE = false` dans `metiers.ts` (timers réels ~30 min)
- ECDSA activé sur KirhaGame (nonce anti-replay)
- Redéploiement complet sur Base Mainnet
- Nouveau store Zustand (version++)
- Clé déployeur dédiée mainnet

---

## Problèmes connus et solutions

### Node 24 incompatible
Toujours utiliser Node 20 : `source ~/.nvm/nvm.sh && nvm use 20`

### Hardhat + type:module
`"type": "module"` retiré de package.json. Scripts compilés via `tsconfig.hardhat.json`.
Déploiement : `npx tsc --project tsconfig.hardhat.json && npx hardhat run dist-hardhat/scripts/deploy.js --network base-sepolia`

### viaIR: true — stack too deep
`KirhaGame.batchSave` a trop de paramètres → `viaIR: true` dans `hardhat.config.ts` sous `settings`.
Ne pas retirer cette option.

### Mempool Base Sepolia congestionné
Le script `flush-nonces.ts` utilise **20 gwei** et scanne +30 nonces.
Le script `deploy.ts` utilise des **nonces séquentiels** (variable `nonce++`) — ne JAMAIS appeler `getTransactionCount('pending')` plusieurs fois dans le même script.

### writeFileSync dans deploy.ts
Le path `__dirname` résout vers `dist-hardhat/scripts/` après compilation TS.
Si `addresses.ts` n'est pas écrit automatiquement → l'écrire manuellement depuis les adresses console.

### evmVersion Cancun
OpenZeppelin 5.x utilise l'opcode `mcopy`. `hardhat.config.ts` a `evmVersion: 'cancun'`.

### BigInt et quantités fractionnaires
`BigInt(0.4)` plante. Dans `useSave` : toujours `Math.floor(quantite)` et filtrer `>= 1` avant de construire les args. Les montants sont scaled ×1e4 : `BigInt(Math.round(quantite * 1e4))`.

### Race condition RPC après transaction
Après `waitForTransactionReceipt`, attendre 1.5s avant de lire l'état on-chain (ex: `playerCityId`). Sans ce délai, le RPC retourne l'état avant propagation.

### Listing HDV invisible après transaction
Toujours utiliser `waitForTransactionReceipt` avant `refetchListings()`.

### Ville #0 / Ville #1 pour tous (BUG CORRIGÉ)
Cause : `villeId` initialisé depuis localStorage counter.
Fix : `villeId: ''` dans store, `setVilleId()` appelé uniquement depuis ConnectPage après lecture on-chain.

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
- Ne pas monter le gasPrice au-delà de **20 gwei** sur Base Sepolia testnet
- Le projet n'a pas de `"type": "module"` dans package.json
- Demander confirmation avant de modifier plusieurs fichiers à la fois
- **Animations personnage EN PAUSE** — ne pas travailler dessus avant que le gameplay soit complet
- `TEST_MODE = true` dans `metiers.ts` → temps de récolte 2s. Passer à `false` avant production
- **Interface 100% cards/pages React** — plus de map Tiled, grid.ts et tiled.ts gardés mais inactifs
- `resourceUtils.ts` est la **source unique** pour emojis et noms de ressources — ne jamais dupliquer
- Le nom du jeu ($KIRHA, Pépites d'or) reste en français même en version EN
- KirhaGame testnet : **ECDSA désactivé** — à réactiver avant mainnet avec nonce anti-replay
- KirhaMarket : taxe **50% hardcodée** (TAX_BPS = 5000) — non modifiable sans redéploiement
- **Workflow** : petits fixes → push direct sur main. Gros changements → local d'abord.
- `.claude/` est dans `.gitignore` — ne jamais commiter les settings locaux Claude
- `villeId` ne vient **jamais** du localStorage — toujours de `playerCityId(address)` on-chain
- `cityId.ts` dans utils est obsolète — ne plus l'utiliser
