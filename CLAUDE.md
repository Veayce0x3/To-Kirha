# To-Kirha — Contexte Projet

## Description
Jeu Web3 thème sakura inspiré de Dofus / Sunflower Land.
Web app React accessible navigateur mobile et PC, hébergée sur GitHub Pages.
Gameplay 100% off-chain (localStorage), sauvegarde on-chain via batch mint ERC-1155.

---

## Stack technique
- **Frontend** : React + Vite, TypeScript, Zustand (persist localStorage), React Router (HashRouter)
- **Wallet** : Wagmi v2 + Viem, RainbowKit
- **Blockchain** : Base Sepolia (testnet) / Base Mainnet
- **Smart contracts** : Hardhat + Solidity 0.8.24 + OpenZeppelin 5.x
- **Hébergement** : GitHub Pages (branche `gh-pages`, CI via GitHub Actions)

---

## Commandes principales
```bash
# Toujours utiliser Node 20 (Node 24 incompatible avec Hardhat + ts-node)
source ~/.nvm/nvm.sh && nvm use 20

# Dev
npm run dev

# Build production
npm run build

# Compiler les contrats Solidity
npm run compile

# Déployer sur Base Sepolia
npm run deploy:sepolia
```

---

## Architecture des fichiers
```
src/
├── App.tsx                  # HashRouter + Routes + Guard (redirect si non connecté)
├── main.tsx                 # WagmiProvider + RainbowKitProvider + QueryClientProvider
├── index.css
├── assets/bucheron.ts       # URLs images Bûcheron (BASE_URL + chemin public/)
├── components/harvest/
│   ├── HarvestGrid.tsx      # Grille 5×2 emplacements de récolte
│   └── HarvestSlot.tsx      # Slot interactif : lock / vide / actif / prêt
├── config/wagmi.ts          # getDefaultConfig RainbowKit, chain baseSepolia
├── contracts/
│   ├── abis/KirhaGame.json  # ABI manuel (batchMintResources + getNonce)
│   └── addresses.ts         # Adresses déployées (généré par deploy.ts)
├── data/
│   ├── metiers.ts           # 5 métiers × 10 ressources = 50 IDs ERC-1155
│   └── resources.ts         # Enum ResourceId (1-50)
├── hooks/
│   ├── useHarvest.ts        # Timer setInterval, demarrer(), collecter()
│   └── useSave.ts           # batchMintResources on-chain via Wagmi
├── pages/
│   ├── ConnectPage.tsx      # Accueil + ConnectButton RainbowKit
│   ├── VillePage.tsx        # Carte ville, 5 métiers (Bûcheron unlocked)
│   └── BucheronPage.tsx     # Écran récolte Bûcheron complet
└── store/gameStore.ts       # Zustand + persist localStorage

contracts/
├── KirhaToken.sol           # ERC-20 $KIRHA, mintable par KirhaGame
├── KirhaResources.sol       # ERC-1155, 50 IDs ressources
└── KirhaGame.sol            # batchMintResources + ECDSA nonce anti-replay

scripts/deploy.ts            # Déploie les 3 contrats + setMinter + écrit addresses.ts
public/assets/
├── metiers/bucheron/background.jpg
├── metiers/bucheron/frene/{arbre, tronc_coupe, inventaire}.jpg
└── token/kirha_token.jpg
```

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

## État d'avancement (11 mars 2026)

### FAIT
- [x] Architecture complète React + Vite (zéro Expo/React Native)
- [x] Zustand store avec persist localStorage
- [x] RainbowKit + Wagmi v2 configurés (Base Sepolia)
- [x] Pages : ConnectPage, VillePage, BucheronPage
- [x] Composants HarvestGrid + HarvestSlot (grille 5×2)
- [x] Hook useHarvest (timer, démarrer, collecter)
- [x] Hook useSave (batchMintResources on-chain)
- [x] Smart contracts compilés : KirhaToken, KirhaResources, KirhaGame
- [x] CI/CD GitHub Actions → GitHub Pages configuré
- [x] .gitignore propre (env, dist, artifacts)
- [x] tsconfig.hardhat.json pour compiler les scripts Hardhat en CJS

### EN COURS / BLOQUÉ
- [ ] **DÉPLOIEMENT BASE SEPOLIA** — wallet à court de fonds testnet
  - Wallet déployeur : `0x5A9d55c76c38eDe9b8B34ED6e7F35578cE919b0C`
  - Action requise : récupérer ETH Sepolia sur https://faucet.base.org
  - Ensuite attendre 5 min que le mempool se vide, puis `npm run deploy:sepolia`
  - Gas price configuré : 1.5 gwei (fichier hardhat.config.ts)

### À FAIRE
- [ ] Déployer les contrats sur Base Sepolia
- [ ] Pousser sur GitHub + activer GitHub Pages
- [ ] Pages des 4 autres métiers (Paysan, Pêcheur, Mineur, Alchimiste)
- [ ] Assets images pour les 9 autres arbres Bûcheron + toutes autres ressources
- [ ] Configurer WalletConnect Project ID proprement (format UUID simple)

---

## Problèmes connus et solutions

### Node 24 incompatible
Toujours utiliser Node 20 : `source ~/.nvm/nvm.sh && nvm use 20`

### Hardhat + type:module
`"type": "module"` a été retiré de package.json (Hardhat ne supporte pas ESM natif).
Les scripts Hardhat sont pré-compilés via `tsconfig.hardhat.json` (module: commonjs).
Script de déploiement : `npx tsc --project tsconfig.hardhat.json && npx hardhat run dist-hardhat/scripts/deploy.js`

### Mempool Base Sepolia congestionné
Si erreur "replacement transaction underpriced" :
1. Attendre 5-10 min
2. Relancer `npm run deploy:sepolia`
Ne pas augmenter le gas price à plus de 2-3 gwei sur testnet (risque de vider le wallet).

### evmVersion Cancun
OpenZeppelin 5.x utilise l'opcode `mcopy` (Cancun). Le hardhat.config.ts a `evmVersion: 'cancun'`.

---

## Variables d'environnement (.env)
```
VITE_WALLETCONNECT_PROJECT_ID=   # À clarifier (format UUID simple depuis cloud.walletconnect.com)
DEPLOYER_PRIVATE_KEY=0x...       # Clé privée wallet déployeur
BASESCAN_API_KEY=                # Optionnel, pour vérification contrats
```

## Notes pour Claude
- Toujours utiliser Node 20 (`nvm use 20`) avant les commandes Hardhat
- Ne pas monter le gasPrice au-delà de 3 gwei sur Base Sepolia testnet
- Le projet n'a pas de `"type": "module"` dans package.json (retiré pour Hardhat)
- Demander confirmation avant de modifier plusieurs fichiers à la fois
