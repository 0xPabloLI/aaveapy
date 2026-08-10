#!/usr/bin/env node
/**
 * Pre-push e2e gate — runs Playwright desktop chromium tests before push.
 *
 * Skips gracefully if Playwright browsers aren't installed (first-time setup,
 * fresh clone, etc.) so the push isn't blocked by missing infrastructure.
 *
 * When browsers ARE installed, runs `npx playwright test --project=chromium`
 * (desktop only — mobile tests are covered by the CI matrix).
 *
 * Playwright's webServer config (playwright.config.ts) automatically starts
 * `npm run dev:staging` on port 4173 if no server is already running there.
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

// --- 1. Determine Playwright browser cache path ---
const browserCache = process.env.PLAYWRIGHT_BROWSERS_PATH
  || (platform() === 'darwin'
    ? join(homedir(), 'Library', 'Caches', 'ms-playwright')
    : join(homedir(), '.cache', 'ms-playwright'));

// --- 2. Check if chromium browser is installed ---
const hasChromium = existsSync(browserCache)
  && readdirSync(browserCache).some(dir => dir.startsWith('chromium'));

if (!hasChromium) {
  console.log('');
  console.log('⚠️  Playwright chromium browser not installed — skipping e2e gate.');
  console.log('   Install with: npx playwright install chromium');
  console.log('');
  process.exit(0);
}

// --- 3. Run desktop chromium e2e tests ---
console.log('');
console.log('🧪 Running e2e tests (desktop chromium, staging API)...');
console.log('   This typically takes ~2 min. Playwright will start a dev server on port 4173.');
console.log('');

try {
  execSync('npx playwright test --project=chromium --retries=1', {
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log('');
  console.log('✅ e2e tests passed.');
  console.log('');
} catch {
  console.error('');
  console.error('❌ e2e tests failed — push blocked.');
  console.error('   Fix the failing tests, or use `git push --no-verify` to skip (not recommended).');
  console.error('');
  process.exit(1);
}
