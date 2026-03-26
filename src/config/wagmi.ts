import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
  trustWallet,
  braveWallet,
  okxWallet,
  bybitWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, createStorage, http } from 'wagmi';
import { baseSepolia } from 'viem/chains';

const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID';

const connectors = connectorsForWallets(
  [
    {
      // WalletConnect en premier : meilleure compatibilité mobile (gère le retour depuis MetaMask sur Android)
      groupName: 'Recommandé',
      wallets: [
        walletConnectWallet,
        metaMaskWallet,
        trustWallet,
        rainbowWallet,
        okxWallet,
        bybitWallet,
      ],
    },
    {
      groupName: 'Desktop',
      wallets: [
        coinbaseWallet,
        braveWallet,
      ],
    },
  ],
  {
    appName:        'To-Kirha',
    appDescription: 'Jeu Web3 thème sakura — récoltez, vendez, progressez.',
    appUrl:         'https://veayce0x3.github.io/To-Kirha',
    appIcon:        'https://veayce0x3.github.io/To-Kirha/assets/icons/icon-192.png',
    projectId:      PROJECT_ID,
  }
);

export const wagmiConfig = createConfig({
  connectors,
  chains:    [baseSepolia],
  transports: { [baseSepolia.id]: http() },
  ssr:        false,
  // Persiste la session WalletConnect dans localStorage → survit aux rechargements de page sur mobile
  storage:    createStorage({ storage: window.localStorage }),
});
