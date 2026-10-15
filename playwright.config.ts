import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 3100);

// End-to-end tests against a real server on a throwaway database (scripts/e2e-server.mjs).
// Run with `npm run test:e2e`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: `http://localhost:${port}/api/health`,
    timeout: 20 * 60_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
