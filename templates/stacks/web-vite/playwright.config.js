// Plantilla del arnés (stack web-vite). La suite e2e graba lo que la aceptación necesita: una captura por criterio,
// un vídeo por test con su locución (tests/e2e/fixtures/evidence.js) y el JUnit que lee `sdd accept`.
// Se puede ajustar webServer o projects; outputDir, reporter y use (screenshot, video) los necesita la aceptación.
import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = execSync('git rev-parse --show-toplevel').toString().trim();
const fase = process.env.SDD_FASE ?? '0';
export const evidenceDir = path.join(root, process.env.SDD_EVIDENCE_DIR ?? 'evidencias', `FASE-${fase}`);
const port = process.env.PORT ?? '5173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  outputDir: path.join(evidenceDir, '.playwright'),
  reporter: [['list'], ['junit', { outputFile: path.join(root, '.sdd/junit/playwright.xml') }]],
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
