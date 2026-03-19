import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'viem/chains';

// Obtenir un Project ID sur https://cloud.walletconnect.com
const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID';

export const wagmiConfig = getDefaultConfig({
  appName:        'To-Kirha',
  appDescription: 'Jeu Web3 thème sakura — récoltez, vendez, progressez.',
  appUrl:         'https://veayce0x3.github.io/To-Kirha',
  projectId:      PROJECT_ID,
  chains:         [baseSepolia],
  ssr:            false,
});
