import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  roninWallet,
  walletConnectWallet,
  metaMaskWallet,
  coinbaseWallet
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'viem/chains';

const walletConnectProjectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '').trim();
export const isWalletConnectEnabled = walletConnectProjectId.length > 0 && walletConnectProjectId !== 'YOUR_PROJECT_ID';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Mobile & Desktop',
      wallets: [
        roninWallet,
        ...(isWalletConnectEnabled ? [walletConnectWallet] : []),
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
    projectId:      isWalletConnectEnabled ? walletConnectProjectId : 'DISABLED_WALLETCONNECT',
  }
);

export const wagmiConfig = createConfig({
  connectors,
  chains:    [baseSepolia],
  transports: { [baseSepolia.id]: http() },
  ssr:       false,
});
