import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Base URL pour GitHub Pages : https://user.github.io/To-Kirha/
  base: '/To-Kirha/',
});
