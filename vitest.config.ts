import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests for the money and document rules. They run in Node with no database:
// run with `npm test`, and CI runs them on every push to main.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
