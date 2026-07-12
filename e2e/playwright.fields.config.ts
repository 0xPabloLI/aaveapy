import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for API field verification E2E tests.
 *
 * Starts the frontend dev server pointed at the staging API so the
 * rendered UI consumes the real markets‑v3 response with renamed fields.
 *
 * Usage:
 *   npx playwright test --config=e2e/playwright.fields.config.ts api-fields-verification
 */
export default defineConfig({
  testDir: '.',
  testMatch: /api-fields-verification/,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev:staging -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 1200 },
      },
    },
  ],
});