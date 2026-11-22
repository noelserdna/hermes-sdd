import { defineConfig } from 'vite';
import { materialMontana } from './src/server/plugin.js';

// El plugin sirve la API (/api/*) tanto con `vite` (desarrollo y e2e) como con `vite preview` (`npm start`).
export default defineConfig({
  plugins: [materialMontana()],
});
