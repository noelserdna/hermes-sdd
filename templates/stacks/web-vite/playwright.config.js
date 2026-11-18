// Plantilla del arnés (stack web-vite). La suite e2e graba lo que la aceptación necesita: una captura por criterio,
// un vídeo por test con su locución (tests/e2e/fixtures/evidence.js) y el JUnit que lee `sdd accept`.
// Se puede ajustar webServer o projects; outputDir, reporter y use (screenshot, video) los necesita la aceptación.
import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const root = execSync('git rev-parse --show-toplevel').toString().trim();
const fase = process.env.SDD_FASE ?? '0';
export const evidenceDir = path.join(root, process.env.SDD_EVIDENCE_DIR ?? 'evidencias', `FASE-${fase}`);
const port = process.env.PORT ?? '5173';
// Con SDD_FASE=N corren solo los recorridos de esa FASE (tests/e2e/fase-N-*.spec.js) si los hay: aceptar una FASE no
// vuelve a grabar las anteriores (material-montana3: la FASE-1 grababa también los 18 vídeos de la FASE-0). Sin
// SDD_FASE, o sin ficheros con ese nombre, corre toda la suite.
let deLaFase = false;
try { deLaFase = readdirSync(path.join(root, 'tests/e2e')).some((f) => f.startsWith(`fase-${fase}-`) || f === `fase-${fase}.spec.js`); } catch { /* sin carpeta */ }

export default defineConfig({
  testDir: './tests/e2e',
  ...(process.env.SDD_FASE && deLaFase ? { testMatch: [`fase-${fase}-*.spec.js`, `fase-${fase}.spec.js`] } : {}),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  outputDir: path.join(evidenceDir, '.playwright'),
  // Un JUnit por FASE: el cierre de una entrega lee el de cada FASE entregada (antes se pisaban y solo quedaba el último)
  reporter: [['list'], ['junit', { outputFile: path.join(root, `.sdd/junit/playwright-fase-${fase}.xml`) }]],
  use: {
    baseURL: process.env.BASE_URL || `http://127.0.0.1:${port}`,
    screenshot: 'on',
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
    locale: 'es-ES',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } }],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
