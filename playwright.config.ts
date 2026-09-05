import { defineConfig, devices } from '@playwright/test';

// Live-SDK wallet tests (watch mode + Aave positions) hit api.v3.aave.com /
// api.aave.com from inside the browser. On networks that require proxy
// egress, run with `E2E_PROXY=http://127.0.0.1:<port>`; Chromium never
// proxies loopback, so the local dev server is unaffected.
const browserProxy = process.env.E2E_PROXY
  ? { proxy: { server: process.env.E2E_PROXY } }
  : {};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...browserProxy,
  },
  webServer: {
    command: process.env.CI
      ? 'npm run build:staging && npm run preview:staging'
      : 'npm run dev:staging -- --host 127.0.0.1 --port 4173',
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
    {
      name: 'mobile-chromium',
      testIgnore: [
        /reserves-table-simulation-full-after-scenario-pin\.spec\.ts/,
        /reserves-table-simulation-nested-scroll\.spec\.ts/,
        // RainbowKit's mobile modal only renders wallets passed via its
        // `wallets` prop, which the app does not configure — the injected
        // connect list is empty on mobile (existing product behavior, see
        // docs/specs/e2e-wallet-connect-injected.md). Lifecycle assertions
        // would fail against an empty modal, so this spec runs desktop-only.
        /wallet-connect-injected\.spec\.ts/,
      ],
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
});
