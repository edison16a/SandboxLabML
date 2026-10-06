import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/** Engine tests run in plain Node. The engine must never touch the DOM. */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'content/**/*.test.ts', 'scripts/**/*.test.ts'],
    testTimeout: 60_000,
    pool: 'threads',
  },
});
