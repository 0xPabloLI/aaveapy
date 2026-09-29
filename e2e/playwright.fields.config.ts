import { defineConfig, devices } from '@playwright/test';
import { e2eBaseUrl, e2eDevServerCommand, resolveE2ePort } from '../scripts/lib/e2e-port.mjs';

/**
 * Playwright config for API field verification E2E tests.
 *
 * Starts the frontend dev server pointed at the staging API so the
 * rendered UI consumes the real markets‑v3 response with renamed fields.
 *
 * Usage:
 *   npx playwright test --config=e2e/playwright.fields.config.ts api-fields-verification
 */
export default (async () => {
  // Same per-run port rule as the root config, so this entry point cannot
  // collide with a main-suite run sitting on the default port.
  const port = await resolveE2ePort();
  const baseURL = e2eBaseUrl(port);

  return defineConfig({
    testDir: '.',
    testMatch: /api-fields-verification/,
    timeout: 120_000,
    expect: { timeout: 20_000 },
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [['list']],
    use: {
      baseURL,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
    },
    webServer: {
      command: e2eDevServerCommand(port),
      url: baseURL,
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
})();
