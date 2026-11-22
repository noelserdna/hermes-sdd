import { defineConfig } from 'vite';
import { plugin } from './src/server/vite-plugin.js';

export default defineConfig({
  plugins: [plugin()],
  build: { outDir: 'dist' },
});
