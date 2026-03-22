# To-Kirha — Contexte Projet

## Description
Jeu Web3 thème sakura inspiré de Dofus / Sunflower Land.
Web app React accessible navigateur mobile et PC, hébergée sur GitHub Pages.
**Architecture City NFT** : chaque joueur possède un NFT ERC-721 "ville" qui contient toutes ses données (ressources, niveaux, $KIRHA in-game). Transférer le NFT transfère tout.
Gameplay 100% off-chain (localStorage), sauvegarde on-chain via `batchSave`.
**Langue par défaut : Français. Multilingue FR/EN — sélecteur sur ConnectPage.**

---

## Stack technique
- **Frontend** : React + Vite, TypeScript, Zustand v8 (persist localStorage), React Router (HashRouter)
- **Wallet** : Wagmi v2 + Viem, RainbowKit
- **Blockchain** : Base Sepolia (testnet) / Base Mainnet (futur)
- **Smart contracts** : Hardhat + Solidity 0.8.24 + OpenZeppelin 5.x + `viaIR: true` (stack too deep fix)
- **Hébergement** : GitHub Pages — https://veayce0x3.github.io/To-Kirha/
- **Relayer** : Cloudflare Workers — https://kirha-relayer.tokirha.workers.dev
- **CI/CD** : GitHub Actions (push main → build → deploy gh-pages + worker automatique)

---

## Workflow de développement
- **Petits fixes / UI** : modifier + `git add/commit/push` → GitHub Actions déploie automatiquement en 2-3 min. **Pas besoin de lancer le serveur local.**
- **Gros changements** (nouveaux contrats, refonte) : tester en local d'abord (`npm run dev`), puis push.
- **Serveur local** : `source ~/.nvm/nvm.sh && nvm use 20 && npm run dev`
- **Worker Cloudflare** : déployé automatiquement par GitHub Actions (job `deploy-worker`). Jamais besoin de déployer manuellement.

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
        ├── HDV         (/hdv)        → Boutique PNJ + HDV on-chain KirhaMarket
        ├── Banque      (/banque)     → Retrait/Dépôt $KIRHA + Pépites + VIP + Sauvegarde on-chain
        ├── Maison      (/maison)     → Inventaire + Stats + Personnage + Arbre de compétences
        ├── Craft       (/craft)      → Cuisine (5 recettes) + futures catégories
        ├── Ferme       (/ferme)      → Puits (eau quotidienne) + Animaux (Poule/Vache/Abeilles/Cerf/Koï)
        └── Temple      (/temple)     → Quêtes journalières

/admin  → AdminPage (wallet whitelist uniquement, token requis)
```

---

## Contrats déployés — Base Sepolia (chainId 84532)

**Déployés le 19 mars 2026 — wallet `0x5A9d55c76c38eDe9b8B34ED6e7F35578cE919b0C`**
**Version v4 — avec admin give tools + VIP + Pépites + authorizeRelayer**

| Contrat         | Adresse                                      |
|-----------------|----------------------------------------------|
| KirhaToken      | `0x5D6D96bE636A20e4AB811041bc339438AeA24CC4` |
| KirhaResources  | `0xd637F65F6f7DCA5D17edb1B6c99a8E56097084aD` |
| KirhaCity       | `0x65545059D2E87cae0737237E43dfAf835bf08b83` |
| KirhaGame       | `0x898bf53dC0E8DcE3A9De5fD48F996328BF651C5f` |
| KirhaMarket     | `0xe7B125dEf1b83E624BA7383Af0D286DdA428122C` |

**Relayer wallet** : `0xe1b9eC5dB0cB6F13cF5A2357304c092c8ed4c683` (financé en ETH Sepolia)

Permissions configurées :
- KirhaCity → `setGame(KirhaGame)`
- KirhaGame → minter sur KirhaResources + KirhaToken
- KirhaMarket → operator sur KirhaGame + minter sur KirhaToken

**Adresses écrites dans `src/contracts/addresses.ts`**

---

## Cloudflare Workers Relayer

**URL** : `https://kirha-relayer.tokirha.workers.dev`
**KV namespace** (rate limiting) : `c5c553e7009b4c9b8e7dcef8a545e1c6`

### Routes
| Route | Fonction | Rate limit |
|---|---|---|
| `POST /save` | `batchSave` on-chain | 20/heure par cityId |
| `POST /market/list` | `listResource` on-chain | 30/heure par cityId |
| `POST /market/buy` | `buyResource` on-chain | 50/heure par cityId |
| `POST /market/cancel` | `cancelListing` on-chain | — |
| `POST /admin/*` | Actions admin (ADMIN_PRIVATE_KEY) | Header X-Admin-Token requis |

### Secrets Cloudflare (configurés — ne pas retoucher)
- `ADMIN_PRIVATE_KEY` : clé privée du wallet déployeur (signe les txs admin)
- `ADMIN_TOKEN` : token bearer pour authentifier la page admin
- `RELAYER_PRIVATE_KEY` : clé privée du wallet relayer

### Routes admin
`/admin/reset-city`, `/admin/give-kirha`, `/admin/give-pepites`, `/admin/give-vip`,
`/admin/give-resource`, `/admin/set-metier-xp`, `/admin/delete-city`, `/admin/set-ban`

---

## Architecture City NFT — Principe fondamental

Toutes les données de jeu sont **indexées par cityId**, jamais par adresse wallet.

```solidity
// KirhaGame.sol
mapping(uint256 => mapping(uint256 => uint256)) public cityResources; // cityId→resourceId→montant (×1e4)
mapping(uint256 => uint256)                     public cityKirha;     // $KIRHA in-game (wei)
mapping(uint256 => uint256)                     public cityPepites;   // Pépites d'or
mapping(uint256 => uint64)                      public vipExpiry;     // timestamp UNIX
mapping(uint256 => mapping(uint8 => uint32))    public cityMetierLevel;
mapping(uint256 => string)                      public cityPseudo;

// KirhaCity.sol (ERC-721)
mapping(address => uint256) public ownerToCityId;
```

**`playerCityId(address)`** dans KirhaGame = `cityNft.ownerToCityId(player)` — la source de vérité.

### villeId — règle absolue
- **Toujours lu depuis la blockchain** via `playerCityId(address)` après connexion
- **Jamais initialisé depuis localStorage ou un compteur local**
- Store Zustand : `villeId: ''` par défaut, `setVilleId(cityId.toString())` appelé dans VilleIdGuard/ConnectPage

---

## Architecture des fichiers (état actuel — 22 mars 2026)
```
src/
├── App.tsx                  # Routes + Guards (VersionGuard v0.6.0, VilleIdGuard avec chain sync complet)
│                            # Routes: /, /home, /recolte, /hdv, /banque, /maison, /craft, /ferme, /admin, /temple
├── main.tsx                 # WagmiProvider + RainbowKitProvider + QueryClientProvider
├── index.css                # Desktop max-width 820px, responsive slots-grid, height:100svh, bottom-menu 52px
├── components/
│   ├── BottomMenu.tsx       # 3 boutons : Accueil / Inventaire (modal 2 onglets) / 💾 Sauvegarder
│   │                        # Indicateur actif sur le bouton Home, inventaire affiche ressources < 1
│   ├── Character.tsx        # Personnage 6 calques CSS, 4 directions
│   └── SettingsModal.tsx    # Paramètres : langue, save, transfert ville NFT, déconnexion
│                            # Bouton "🔄 Actualiser et synchroniser" (visible à tous)
│                            # Bouton "⚙️ Page Admin" visible uniquement wallet whitelist
├── contracts/
│   ├── abis/
│   │   ├── KirhaGame.json   # batchSave / withdrawKirha / depositKirha / getCityResources
│   │   │                    # getCityMetiers / playerCityId / cityKirha / cityPepites / vipExpiry
│   │   │                    # isRelayerFor / adminResetCity / adminGiveKirha / adminGivePepites
│   │   │                    # adminGiveVip / adminGiveResource / adminSetMetierXp / adminDeleteCity
│   │   ├── KirhaCity.json   # ownerOf / ownerToCityId / mintCity / safeTransferFrom
│   │   └── KirhaMarket.json # listResource / buyResource / cancelListing / getActiveListings
│   └── addresses.ts         # 5 contrats + RELAYER_ADDRESS
├── data/
│   ├── metiers.ts           # 5 métiers × 10 ressources = 50 IDs | TEST_MODE exported → true (2s)
│   ├── resources.ts         # Enum ResourceId (1-62) : 1-50 on-chain, 51-62 off-chain (Ferme+Cuisine)
│   │                        # FERME_IDS [51-57], CUISINE_IDS [58-62] — NE PAS ajouter à ALL_RESOURCE_IDS
│   ├── ferme.ts             # Config Puits (cooldown, canCollectPuits, getSecondsUntilPuitsReset)
│   │                        # ANIMALS[] : Poule(5), Vache(15), Abeilles(30), Cerf Sakura(60), Koï(90)
│   └── vetements.ts
├── hooks/
│   ├── useHarvest.ts        # Timer, planterRessource(), collecterEtRelancer() — PAS d'auto-collect
│   │                        # Applique le bonus de compétences (+5%/point rendement et XP)
│   ├── useSave.ts           # batchSave on-chain via relayer (fallback wallet direct)
│   │                        # NB: seules les ressources ID 1-50 sont sauvegardées on-chain
│   ├── useWithdraw.ts       # withdrawKirha(cityId, amount)
│   ├── useDeposit.ts        # depositKirha(cityId, amount)
│   ├── useMarket.ts         # HDV on-chain via relayer (list/buy/cancel)
│   └── useVip.ts            # buyPepites(packType) + buyVip(durationType) on-chain
├── pages/
│   ├── ConnectPage.tsx      # Landing + pseudo on-chain + LangToggle + register/login flow
│   ├── HomePage.tsx         # Map principale (7 cards) + badge VIP + modal relayer + modal info VIP
│   │                        # Cards avec prop locked (grayed out + "Bientôt disponible")
│   ├── RecoltePage.tsx      # Sélecteur métier (barre XP bleue/violette) + Zone récolte
│   ├── HdvPage.tsx          # Onglets : Boutique PNJ (Fleur de Cerisier) + Acheter + Vendre + Mes ventes + Historique
│   │                        # Ressources ID>50 filtrées de l'onglet Vendre (non vendables on-chain)
│   ├── BanquePage.tsx       # Retrait/Dépôt $KIRHA + Pépites d'or (4 packs) + VIP (3 durées)
│   ├── MaisonPage.tsx       # Inventaire (toutes ressources y compris ID>50) + stats métiers
│   │                        # Onglet Personnage : niveau, XP, arbre de compétences (allouer/retirer/reset)
│   ├── CraftPage.tsx        # Grille catégories → Cuisine (5 recettes) + barre XP personnage
│   │                        # Recettes : Pain de Blé, Riz au Lait, Galette Sakura, Miel Sakura, Thé Wisteria
│   ├── FermePage.tsx        # Puits (1 eau/jour, reset 00h00 Paris) + Animaux (timer + récolte manuelle)
│   ├── AdminPage.tsx        # /admin — token worker, actions give/reset sans wallet popup
│   │                        # Alerte solde relayer (rouge si < 0.05 ETH)
│   └── TemplePage.tsx       # Quêtes journalières
├── store/gameStore.ts       # Zustand persist v10, soft migration (jamais full reset)
│                            # setChainBalances / setMetierFromChain / addInventaireFromChain
│                            # ajouterXpPersonage / allouerCompetence / retirerCompetence / reinitialiserCompetences
│                            # setPuitsDerniereRecolte / setAnimauxDerniereRecolte
└── utils/
    ├── i18n.ts              # Traductions FR/EN complètes (62 ressources + UI + Ferme/Cuisine)
    └── resourceUtils.ts     # emojiByResourceId(), getNomRessource() — SOURCE UNIQUE (IDs 1-62)

contracts/
├── KirhaToken.sol           # ERC-20 $KIRHA, mintable par KirhaGame + KirhaMarket
├── KirhaResources.sol       # ERC-1155, 50 IDs ressources
├── KirhaCity.sol            # ERC-721 city NFT — ownerToCityId updated dans _update() override
├── KirhaGame.sol            # batchSave + withdrawKirha + depositKirha + registerPseudo
│                            # buyPepites (4 packs) + buyVip (3 durées) + isVip()
│                            # authorizeRelayer + isRelayerFor (session key gasless)
│                            # adminGiveKirha/Pepites/Vip/Resource + adminSetMetierXp + adminResetCity
│                            # ECDSA désactivé sur testnet (à réactiver avant mainnet)
└── KirhaMarket.sol          # HDV city-to-city, taxe 50% (VIP vendeur → 25%), burn/mint $KIRHA
                             # onlyCityOwnerOrRelayer sur list/buy/cancel

kirha-relayer/
├── src/index.ts             # Cloudflare Worker — toutes les routes
└── wrangler.toml            # Config worker, KV binding, ALLOWED_ORIGIN

scripts/
├── deploy.ts                # Déploie 5 contrats, nonces séquentiels, gasPrice 15 gwei
├── flush-nonces.ts          # Purge mempool (20 gwei), scanner +30 nonces
└── gen-character-assets.ts

.github/workflows/
└── deploy.yml               # 2 jobs : deploy-frontend (gh-pages) + deploy-worker (wrangler)
```

---

## Routing
```
/         → ConnectPage
/home     → HomePage (Guard: wallet connecté + villeId requis)
/recolte  → RecoltePage (Guard)
/hdv      → HdvPage (Guard)
/banque   → BanquePage (Guard)
/maison   → MaisonPage (Guard)
/craft    → CraftPage (Guard)
/ferme    → FermePage (Guard)
/admin    → AdminPage (Guard + whitelist wallet)
/temple   → TemplePage (Guard)
```

---

## Fonctionnalités implémentées (22 mars 2026)

### Connexion / Inscription (ConnectPage)
- Login : lit `playerCityId(address)` + `cityPseudo(cityId)` on-chain → `/home`
- Register : formulaire pseudo → `registerPseudo(pseudo)` → mint ville NFT
- Délai 1.5s après tx receipt pour laisser le RPC propager

### Chain sync au login (VilleIdGuard — App.tsx)
À chaque connexion wallet, lit on-chain et sync dans Zustand :
- `cityKirha` → `soldeKirha = chainKirha + kirhaEarned` (chaîne = source de vérité, on ajoute les gains PNJ non sauvegardés)
- `cityPepites` → `pepitesOr` (direct depuis chaîne)
- `vipExpiry` → `vipExpiry` (Math.max — garde le plus grand)
- `getCityMetiers` → niveaux + XP de chaque métier (Math.max)
- `getCityResources` (50 IDs) → inventaire complet (Math.max)
- Si cityId = 0n (ville supprimée) → `resetGameData()` + redirect vers `/`
- Si reset admin détecté (tout à zéro on-chain mais local a données) → `forceChainSync()` écrase le local

### Système de récolte (useHarvest)
- **Pas d'auto-collect** — le joueur collecte manuellement en cliquant le slot "Prêt"
- `collecterEtRelancer()` : collecte + redémarre immédiatement
- 5 slots débloqués par défaut, jusqu'à 20 par métier

### Sauvegarde on-chain (useSave)
- Via relayer Cloudflare (gasless) si session active, sinon wallet direct
- `batchSave(cityId, resourceIds[], resourceAmts[], metierIds[], metierLevels[], metierXps[], metierXpTotals[], kirhaGained)`
- Ressources scaled ×1e4, floor des quantités fractionnaires
- Auto-save sur `beforeunload` si pending_mints.length > 0

### HDV on-chain (KirhaMarket + useMarket)
- Toutes les ops passent par le relayer (list/buy/cancel)
- Struct `Listing` : `sellerCityId`, `resourceId`, `quantity`, `pricePerUnit`
- Taxe 50% → 25% si vendeur est VIP
- `getCityPseudos(cityIds[])` : batch getter pseudos vendeurs
- Indicateur affordabilité sur chaque listing : ✓ (vert) ou ✗ (rouge) + coût total, mis à jour en temps réel

### Auto-switch réseau
- Tous les hooks (`useSave`, `useWithdraw`, `useDeposit`, `useMarket`, `useVip`) appellent `switchChainAsync({ chainId: baseSepolia.id })` avant tout `writeContractAsync`
- L'appel est wrapped dans try/catch — en cas de refus, wagmi v2 gère la vérification via `chainId` dans writeContractAsync
- `useVip` : ajout de `switchChainAsync` pour `buyPepites` et `buyVip`

### Menu mobile (iOS/Android)
- `index.html` : **sans** `viewport-fit=cover` → viewport s'arrête au-dessus de la barre iOS, pas de descente du menu
- `index.css` : `#root` utilise `height: 100svh` (small viewport = exclut toujours la nav bar) avec fallbacks `dvh`/`vh`
- `.bottom-menu` : `padding-bottom: 52px !important` (fixe, sans env()) → boutons toujours accessibles au-dessus de la nav bar Android

### VIP + Pépites d'or (useVip + BanquePage)
- **Pépites d'or** : monnaie premium achetée avec $KIRHA
  - Pack Petit : 50 pépites — 5 $KIRHA
  - Pack Moyen : 150 pépites — 13 $KIRHA (+10%)
  - Pack Grand : 400 pépites — 32 $KIRHA (+25%)
  - Pack Premium : 1000 pépites — 65 $KIRHA (+50%)
- **VIP** : réduit la taxe HDV de 50% → 25%
  - 7 jours : 100 pépites
  - 30 jours : 300 pépites
  - 90 jours : 700 pépites
- Badge VIP dans HomePage, modal info avec date d'expiration

### Page Admin (/admin)
- Accessible depuis SettingsModal (wallet whitelist uniquement)
- **Token ADMIN_TOKEN** requis dans l'interface (stocké en sessionStorage)
- **Toutes les actions passent par le worker Cloudflare** (ADMIN_PRIVATE_KEY) — aucun popup wallet
- Actions : give kirha/pépites/VIP/ressource, set XP métier, reset city, ban/unban, delete city
- Alerte rouge si solde relayer < 0.05 ETH
- Stats on-chain : villes créées, joueurs, listings actifs
- Set XP : deux modes — additive (+XP) et niveau direct (calcule automatiquement xpTotal cumulatif)
- charger() : per-city try/catch → ignore les villes supprimées sans bloquer le chargement
- give-kirha : utilise `parseEther(amtStr)` (précision exacte, pas BigInt flottant)

### SettingsModal
- Bouton "🔄 Actualiser et synchroniser" (visible à tous les joueurs) : sauvegarde si relayer actif, puis reload
- VilleIdGuard re-sync depuis blockchain au rechargement → utile après action admin (give/retrait KIRHA, pépites, VIP)

### Multilingue (i18n)
- FR/EN complet : navigation, UI, 62 noms de ressources (50 on-chain + 12 off-chain)
- `useT()` hook → `t(key)` + `lang`
- Sélecteur 🇫🇷/🇬🇧 sur ConnectPage + SettingsModal

### Système de Personnage (niv. 1-100)
- Niveau et XP indépendants des métiers
- XP gagnée **uniquement via le Craft Cuisine** (volontaire — force l'utilisation de l'HDV)
- Chaque niveau débloque 1 point de compétence
- Affiché dans l'onglet Personnage de la Maison + barre dans CraftPage
- Courbe XP : `100 × N^1.8` (identique aux métiers)

### Arbre de compétences (MaisonPage — onglet Personnage)
- 5 métiers × max 10 points → +5%/point de rendement et XP de récolte
- Bonus appliqué en temps réel dans `useHarvest`
- `allouerCompetence(metier)` / `retirerCompetence(metier)` dans le store
- Réinitialisation complète : coûte **100 Pépites d'or** (`reinitialiserCompetences()`)

### Page Ferme (/ferme)
- **Le Puits** : 1 💧 Eau par jour, reset à 00h00 heure française. TEST_MODE : cooldown 30s
- **Animaux** débloqués par niveau personnage :
  | Animal       | Niv. requis | Production   | Cooldown (réel) |
  |--------------|-------------|--------------|-----------------|
  | Poule 🐔      | 5           | Œuf 🥚        | 4h              |
  | Vache 🐄      | 15          | Lait 🥛       | 6h              |
  | Abeilles 🐝   | 30          | Miel 🍯       | 8h              |
  | Cerf Sakura 🦌| 60          | Musc Sakura ✨| 24h             |
  | Koï Dorée 🐟  | 90          | Écaille de Koï 🔮| 48h          |
- Toutes les productions ajoutées directement à l'inventaire (off-chain)

### Cuisine (CraftPage)
- Grille de catégories → Cuisine active + Alchimie (placeholder)
- 5 recettes disponibles :
  | Recette          | Ingrédients                         | XP perso |
  |------------------|-------------------------------------|----------|
  | Pain de Blé 🍞   | 5 Blé + 2 Eau                       | 20       |
  | Riz au Lait 🍚   | 5 Riz + 2 Lait + 1 Eau             | 35       |
  | Galette Sakura 🥞| 3 Sarrasin + 2 Eau + 1 Miel        | 50       |
  | Miel Sakura 🍯   | 3 Miel + 2 Fleur de Cerisier        | 75       |
  | Thé Wisteria 🍵  | 3 Wisteria + 1 Fleur de Cerisier + 2 Eau | 60  |
- Indicateur vert/rouge par ingrédient selon stock disponible

### Fleur de Cerisier (HdvPage — onglet Boutique)
- Ressource exclusive, achetée uniquement via la **Boutique PNJ** dans HdvPage (onglet par défaut)
- Prix : **2 $KIRHA/unité** — transaction locale (pas de popup wallet, pas de gas)
- **Invendable** sur le HDV player-to-player (toutes ressources ID > 50 filtrées de l'onglet Vendre)
- Utilisée dans les recettes Miel Sakura et Thé Wisteria

### Courbe XP exponentielle (métiers + personnage)
- `xpRequis(N) = Math.round(100 × N^1.8)`
- Niveaux 1-5 rapides (100→1838 XP), mur exponentiel à partir du niveau 6
- Remplace l'ancienne formule quadratique `N² × 50`

---

## Zustand Store v10 — Règles
- **Version actuelle : 10** — ne jamais incrémenter sans changement de structure
- **Migration douce** : `migrate()` remplit les champs manquants avec valeurs par défaut, ne retourne JAMAIS `undefined`
- La migration v9→v10 conserve les slots (reset slots uniquement si version < 9)
- Champs clés : `villeId`, `soldeKirha`, `pepitesOr`, `vipExpiry`, `pseudo`, `inventaire`, `metiers`, `kirhaEarned`
- Champs personnage : `personageNiveau`, `personageXp`, `personageXpTotal`
- Champs compétences : `competencesPoints`, `competences` (Partial<Record<MetierId, number>>)
- Champs ferme : `puitsDerniereRecolte` (timestamp ms), `animauxDerniereRecolte` (Record<animalId, timestamp>)
- `setChainBalances(kirha, pepites, vipExpiry)` :
  - `soldeKirha = kirha + state.kirhaEarned` (chaîne autoritaire + gains PNJ non sauvegardés)
  - `pepitesOr = pepites` (direct depuis chaîne — reflète les actions admin)
  - `vipExpiry = Math.max(...)` (garde le plus grand)
- `setMetierFromChain(metierId, niveau, xp, xpTotal)` : merge Math.max
- `addInventaireFromChain(resourceId, qty)` : merge Math.max
- `forceChainSync(...)` : écrase tout le local depuis la chaîne (reset admin détecté)
- `resetGameData()` : remet à zéro toutes les données de jeu (garde address/villeId/pseudo/langue)
- `ajouterXpPersonage(xp)` : incrémente XP personnage, level-up auto + +1 competencesPoints par niveau
- `allouerCompetence(metier)` / `retirerCompetence(metier)` : dépense/récupère 1 point (max 10/métier)
- `reinitialiserCompetences()` : remet tout à 0, coûte 100 Pépites

---

## Ressources — IDs complets

### IDs 1-50 — On-chain (ERC-1155 KirhaResources)
| Métier      | IDs   | Ressources (niveau 1→90)                                                              |
|-------------|-------|---------------------------------------------------------------------------------------|
| Bûcheron    | 1-10  | Frêne, Séquoia, Chêne, Bouleau, Érable, Bambou, Ginkgo, Magnolia, Cerisier Doré, Sakura |
| Paysan      | 11-20 | Blé, Orge, Seigle, Avoine, Maïs, Riz, Millet, Sarrasin, Riz Violet, Riz Sakura      |
| Pêcheur     | 21-30 | Carpe Japonaise, Crabe, Saumon, Homard, Naso, Pieuvre, Calmar, Crevette Sakura, Fugu, Carpe Koï Dorée |
| Mineur      | 31-40 | Pierre, Charbon, Cuivre, Fer, Topaze, Émeraude, Jade, Diamant, Saphir Sakura, Cristal Koï |
| Alchimiste  | 41-50 | Pissenlit, Menthe, Ortie, Lavande, Pivoine, Wisteria, Chrysanthème, Ginseng, Fleur Lotus Sakura, Herbe Koï |

**Metier IDs on-chain** : bucheron=0, paysan=1, pecheur=2, mineur=3, alchimiste=4

### IDs 51-62 — Off-chain (localStorage uniquement, NON sauvegardés on-chain)
> À intégrer dans les smart contracts lors du prochain redéploiement

| ID  | Ressource         | Source                  |
|-----|-------------------|-------------------------|
| 51  | Eau 💧             | Puits (Ferme)           |
| 52  | Fleur de Cerisier 🌸 | Boutique PNJ (HDV)   |
| 53  | Œuf 🥚             | Poule (Ferme)           |
| 54  | Lait 🥛            | Vache (Ferme)           |
| 55  | Miel 🍯            | Abeilles (Ferme)        |
| 56  | Musc Sakura ✨     | Cerf Sakura (Ferme)     |
| 57  | Écaille de Koï 🔮  | Koï Dorée (Ferme)       |
| 58  | Pain de Blé 🍞     | Recette Cuisine         |
| 59  | Riz au Lait 🍚     | Recette Cuisine         |
| 60  | Galette Sakura 🥞  | Recette Cuisine         |
| 61  | Miel Sakura 🍯     | Recette Cuisine         |
| 62  | Thé Wisteria 🍵    | Recette Cuisine         |

**Règle** : `ALL_RESOURCE_IDS` dans resources.ts contient **uniquement les IDs 1-50**. Les IDs 51+ sont dans `FERME_IDS` et `CUISINE_IDS`. Ne jamais les ajouter à `ALL_RESOURCE_IDS` (utilisé dans VilleIdGuard pour les requêtes on-chain).

---

## État du projet (22 mars 2026)

### CE QUI EST FAIT ET FONCTIONNEL ✅
| Composant                        | Fichier                        | État             |
|----------------------------------|--------------------------------|------------------|
| Routing + Guards + chain sync    | App.tsx                        | ✅ v0.6.0        |
| Architecture City NFT complète   | KirhaCity + KirhaGame          | ✅ Déployée v4   |
| Page connexion + pseudo on-chain | ConnectPage.tsx                | ✅ Complet       |
| Map principale (7 cards + VIP)   | HomePage.tsx                   | ✅ Complet       |
| Récolte (sélecteur + zones)      | RecoltePage.tsx                | ✅ Complet       |
| HDV On-chain + Boutique PNJ      | HdvPage.tsx + useMarket        | ✅ Complet       |
| Banque (retrait/dépôt/VIP/pép.)  | BanquePage.tsx + useVip        | ✅ Complet       |
| Maison (inventaire+stats+perso)  | MaisonPage.tsx                 | ✅ Complet       |
| Arbre de compétences             | MaisonPage.tsx + gameStore     | ✅ Complet       |
| Cuisine (5 recettes)             | CraftPage.tsx                  | ✅ Complet       |
| Page Ferme (Puits + Animaux)     | FermePage.tsx + data/ferme.ts  | ✅ Complet       |
| Système personnage niv. 1-100    | gameStore.ts                   | ✅ Complet       |
| Courbe XP exponentielle          | gameStore.ts (xpRequis)        | ✅ 100×N^1.8     |
| Ressources off-chain (51-62)     | resources.ts + resourceUtils   | ✅ Ferme+Cuisine |
| Menu bas (3 boutons + actif)     | BottomMenu.tsx                 | ✅ Complet       |
| SettingsModal + transfert ville  | SettingsModal.tsx              | ✅ Complet       |
| Personnage (Character.tsx)       | Character.tsx                  | ✅ 4 dirs        |
| Hook sauvegarde (relayer)        | hooks/useSave.ts               | ✅ On-chain      |
| Hook retrait                     | hooks/useWithdraw.ts           | ✅ On-chain      |
| Hook dépôt                       | hooks/useDeposit.ts            | ✅ On-chain      |
| Hook marché (relayer)            | hooks/useMarket.ts             | ✅ Complet       |
| Hook VIP + Pépites               | hooks/useVip.ts                | ✅ Complet       |
| Bonus compétences dans récolte   | hooks/useHarvest.ts            | ✅ +5%/point     |
| Traductions FR/EN                | utils/i18n.ts                  | ✅ 62 res.       |
| Emojis/noms ressources           | utils/resourceUtils.ts         | ✅ Centralisé    |
| Store Zustand                    | store/gameStore.ts             | ✅ v10 soft migr.|
| Page Admin (worker, no popup)    | AdminPage.tsx                  | ✅ Complet       |
| Relayer Cloudflare Workers       | kirha-relayer/                 | ✅ Déployé       |
| CI/CD GitHub Pages + Worker      | .github/workflows/deploy.yml   | ✅ En place      |
| Menu iOS/Android corrigé         | index.html + index.css         | ✅ 100svh + 52px |
| Auto-save fermeture page         | App.tsx BeforeUnloadGuard      | ✅ Systématique  |
| Décompte relayer 12h persistant  | HomePage + HdvPage             | ✅ localStorage  |
| Indicateur affordabilité HDV     | HdvPage.tsx                    | ✅ ✓/✗ + coût   |

### CE QUI MANQUE / EST EN ATTENTE ⏳
| Élément                                    | Priorité   | Notes                                               |
|--------------------------------------------|------------|-----------------------------------------------------|
| TEST_MODE → false                          | Haute      | Avant production (timers réels ~30 min + Ferme)     |
| Vérification ECDSA on-chain                | Haute      | Avant mainnet (KirhaGame, nonce anti-replay)        |
| Contrats mis à jour (IDs 51-62 on-chain)   | Haute      | Redéploiement nécessaire pour sauvegarder Ferme/Cuisine |
| Sprites ressources pixel art               | Moyenne    | 62 assets à créer                                   |
| MaisonPage — vêtements/bonus               | Basse      | Système équipement à brancher                       |
| Frames animation marche/récolte            | Basse      | Après gameplay complet (EN PAUSE)                   |
| Alchimie CraftPage                         | Basse      | Placeholder visible, logique à concevoir            |

---

## Testnet v1 → Mainnet v2
- `TEST_MODE = false` dans `metiers.ts` (timers réels ~30 min)
- ECDSA activé sur KirhaGame (nonce anti-replay)
- Redéploiement complet sur Base Mainnet
- Nouveau store Zustand (version++)
- Clé déployeur dédiée mainnet
- Nouveau relayer wallet financé en ETH Mainnet

---

## Problèmes connus et solutions

### Node 24 incompatible
Toujours utiliser Node 20 : `source ~/.nvm/nvm.sh && nvm use 20`

### Hardhat + type:module
`"type": "module"` retiré de package.json. Scripts compilés via `tsconfig.hardhat.json`.
Déploiement : `npx tsc --project tsconfig.hardhat.json && npx hardhat run dist-hardhat/scripts/deploy.js --network base-sepolia`

### viaIR: true — stack too deep
`KirhaGame.batchSave` a trop de paramètres → `viaIR: true` dans `hardhat.config.ts`.
Ne pas retirer cette option.

### Mempool Base Sepolia congestionné
Le script `flush-nonces.ts` utilise **20 gwei** et scanne +30 nonces.
Le script `deploy.ts` utilise des **nonces séquentiels** — ne JAMAIS appeler `getTransactionCount('pending')` plusieurs fois dans le même script.

### writeFileSync dans deploy.ts
Le path `__dirname` résout vers `dist-hardhat/scripts/` après compilation TS.
Si `addresses.ts` n'est pas écrit automatiquement → l'écrire manuellement depuis les adresses console.

### evmVersion Cancun
OpenZeppelin 5.x utilise l'opcode `mcopy`. `hardhat.config.ts` a `evmVersion: 'cancun'`.

### BigInt et quantités fractionnaires
`BigInt(0.4)` plante. Dans `useSave` : toujours `Math.floor(quantite)` et filtrer `>= 1` avant de construire les args. Les montants sont scaled ×1e4 : `BigInt(Math.round(quantite * 1e4))`.

### Race condition RPC après transaction
Après `waitForTransactionReceipt`, attendre 1.5s avant de lire l'état on-chain. Sans ce délai, le RPC retourne l'état avant propagation.

### Zustand soft migration
La fonction `migrate()` ne doit jamais retourner `undefined` — ça cause un full reset du store.
Toujours retourner `{ ...state, champManquant: state.champManquant ?? valeurDefaut }`.

---

## Variables d'environnement (.env)
```
VITE_WALLETCONNECT_PROJECT_ID=   # UUID depuis cloud.walletconnect.com (aussi dans GitHub Secrets)
DEPLOYER_PRIVATE_KEY=0x...       # Clé privée wallet déployeur — NE JAMAIS COMMITER
BASESCAN_API_KEY=                # Optionnel, vérification contrats
```

### GitHub Secrets (CI/CD)
- `VITE_WALLETCONNECT_PROJECT_ID` : build frontend
- `CLOUDFLARE_API_TOKEN` : deploy worker

### Cloudflare Worker Secrets (configurés, ne pas retoucher)
- `RELAYER_PRIVATE_KEY` : wallet relayer
- `ADMIN_PRIVATE_KEY` : wallet déployeur (actions admin)
- `ADMIN_TOKEN` : token bearer page admin

---

## Notes pour Claude
- Toujours utiliser Node 20 (`nvm use 20`) avant les commandes Hardhat
- Ne pas monter le gasPrice au-delà de **20 gwei** sur Base Sepolia testnet
- Le projet n'a pas de `"type": "module"` dans package.json
- Demander confirmation avant de modifier plusieurs fichiers à la fois
- **Animations personnage EN PAUSE** — ne pas travailler dessus avant que le gameplay soit complet
- `TEST_MODE = true` dans `metiers.ts` → temps de récolte 2s. Passer à `false` avant production
- **Interface 100% cards/pages React** — pas de map Tiled, les fichiers grid/tiled/tmx/TileMap ont été supprimés
- `resourceUtils.ts` est la **source unique** pour emojis et noms de ressources — ne jamais dupliquer dans d'autres fichiers
- Le nom du jeu ($KIRHA, Pépites d'or) reste en français même en version EN
- KirhaGame testnet : **ECDSA désactivé** — à réactiver avant mainnet avec nonce anti-replay
- KirhaMarket : taxe **50% hardcodée** (TAX_BPS = 5000) — VIP réduit à 25% pour le vendeur
- **Worker Cloudflare** : déployé auto par CI — ne jamais déployer manuellement sauf urgence
- **Zustand version = 9** — ne jamais incrémenter sans vrai changement de structure
- `villeId` ne vient **jamais** du localStorage — toujours de `playerCityId(address)` on-chain
- `setChainBalances` : `soldeKirha = kirha + state.kirhaEarned`, `pepitesOr = pepites` (direct chaîne, pas Math.max)
- **Liste de corrections** : quand l'utilisateur donne une liste de points, traiter **un point à la fois** dans l'ordre, sans en sauter
- **Commits** : traiter tous les points un par un jusqu'à la fin, puis un seul commit+push quand toute la liste est terminée
