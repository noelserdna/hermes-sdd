import { defineConfig } from 'vitest/config';

// maxWorkers: 2 — la máquina la comparten otras etapas y el navegador de los e2e (AGENTS.md).
// El entorno por defecto es node; los tests de UI piden jsdom con `// @vitest-environment jsdom` (D-PA-002).
export default defineConfig({
  test: {
    maxWorkers: 2,
    // PROP-005 (multas.test.js) hace cientos de hashes scrypt reales: con 2 workers y la máquina compartida pasa de los 5 s por defecto.
    testTimeout: 60000,
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/api/**/*.test.js'],
  },
});
