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
import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'viem/chains';

const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Mobile & Desktop',
      wallets: [
        walletConnectWallet, // fonctionne avec Rabby mobile, MetaMask mobile, etc.
        metaMaskWallet,
        coinbaseWallet,
        trustWallet,
        rainbowWallet,
        braveWallet,
        okxWallet,
        bybitWallet,
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
