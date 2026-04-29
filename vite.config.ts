import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Base URL pour GitHub Pages : https://user.github.io/To-Kirha/
  base: '/To-Kirha/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@rainbow-me') || id.includes('node_modules/wagmi') || id.includes('node_modules/viem')) {
            return 'wallet-vendor';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          if (id.includes('src/pages/')) {
            return 'pages';
          }
          return undefined;
        },
      },
    },
  },
});
