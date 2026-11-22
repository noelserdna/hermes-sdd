import { defineConfig } from 'vitest/config';

// La máquina la comparten otras etapas y el navegador de los e2e: como mucho 2 workers.
export default defineConfig({
  test: {
    maxWorkers: 2,
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
  },
});
