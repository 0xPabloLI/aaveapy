import { defineConfig, devices } from '@playwright/test';

// Live-SDK wallet tests (watch mode + Aave positions) hit api.v3.aave.com /
// api.aave.com from inside the browser. On networks that require proxy
// egress, run with `E2E_PROXY=http://127.0.0.1:<port>`; Chromium never
// proxies loopback, so the local dev server is unaffected.
const browserProxy = process.env.E2E_PROXY ? { proxy: { server: process.env.E2E_PROXY } } : {};

// Pre-push runs the whole desktop suite against a dev server. Recording video
// and trace for every test is debug-only overhead there, and it is a known
// contributor to load-flaky timing tests (AAV-1307 family). CI keeps both
// artifacts so failures stay diagnosable.
const recordingOff = process.env.E2E_NO_RECORDING === '1';

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
    // Pre-grant analytics consent so the ConsentBanner overlay never
    // intercepts pointer events in e2e runs (banner behavior itself is
    // covered by ConsentBanner.test.tsx unit tests + browser verification).
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://127.0.0.1:4173',
          localStorage: [
            {
              name: 'aaveapy:consent-v2',
              value: JSON.stringify({ analytics: 'granted', respondedAt: '1970-01-01T00:00:00.000Z' }),
            },
          ],
        },
      ],
    },
    trace: recordingOff ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: recordingOff ? 'off' : 'retain-on-failure',
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
      testIgnore: [/scenario-input-modes\.mobile\.spec\.ts/],
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
        /scenario-input-modes\.desktop\.spec\.ts/,
      ],
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
});
