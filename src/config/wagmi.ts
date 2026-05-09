import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  roninWallet,
  metaMaskWallet,
  coinbaseWallet
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'viem/chains';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Mobile & Desktop',
      wallets: [
        roninWallet,
        injectedWallet,
        metaMaskWallet,
        coinbaseWallet,
      ],
    },
  ],
  {
    appName:        'To-Kirha',
    appDescription: 'Jeu Web3 thème sakura — récoltez, vendez, progressez.',
    appUrl:         'https://veayce0x3.github.io/To-Kirha',
    // On garde la clé si d'autres wallets RainbowKit la nécessitent à l'avenir.
    projectId:      import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID',
  }
);

export const wagmiConfig = createConfig({
  connectors,
  chains:    [baseSepolia],
  transports: { [baseSepolia.id]: http() },
  ssr:       false,
});
