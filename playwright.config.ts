import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
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
      testIgnore: [
        /.*\.mobile\.spec\.ts/,
        /top-opportunities-mobile-layout\.spec\.ts/,
        /portfolio-mobile-spacing\.spec\.ts/,
        /reserves-table-mobile-interactions\.spec\.ts/,
      ],
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
        /.*\.desktop\.spec\.ts/,
        /portfolio-results-inline-delta\.spec\.ts/,
        /reserves-table-market-filter-pin\.spec\.ts/,
        /reserves-table-interactions\.spec\.ts/,
        /reserves-table-stick\.spec\.ts/,
      ],
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
});
