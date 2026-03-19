import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  rabbyWallet,
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
  trustWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'viem/chains';

const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommandés',
      wallets: [
        rabbyWallet,
        metaMaskWallet,
        walletConnectWallet,
        coinbaseWallet,
        trustWallet,
        rainbowWallet,
      ],
    },
  ],
  {
    appName:        'To-Kirha',
    appDescription: 'Jeu Web3 thème sakura — récoltez, vendez, progressez.',
    appUrl:         'https://veayce0x3.github.io/To-Kirha',
    projectId:      PROJECT_ID,
  }
);

export const wagmiConfig = createConfig({
  connectors,
  chains:    [baseSepolia],
  transports: { [baseSepolia.id]: http() },
  ssr:       false,
});
