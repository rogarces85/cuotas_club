import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Evita que vitest recoja artefactos compilados en dist/.
    include: ['src/**/*.test.ts'],
  },
});
