#!/usr/bin/env node
/**
 * Pre-push e2e gate — runs Playwright desktop chromium tests before push.
 *
 * Skips gracefully if Playwright browsers aren't installed (first-time setup,
 * fresh clone, etc.) so the push isn't blocked by missing infrastructure.
 *
 * Strategy:
 *   - Uses `dev:staging` webServer (Vite dev server, no build step → no OOM)
 *   - `--workers=2` to limit staging API load (default 6 causes timeouts)
 *   - `--retries=1` for flaky tolerance
 *   - `--grep-invert` excludes tests that depend on external services or
 *     local-only resources that can't work in a pre-push context:
 *       • Explorer links → Cloudflare blocks headless browsers
 *       • Staging smoke  → staging.aaveapy.com behind Vercel Authentication
 *       • Visual regression → macOS screenshot baselines (slow, display-sensitive)
 *       • Wallet Sync → requires live Aave SDK GraphQL connections
 *       • Watch Mode  → requires live SDK + wallet extension
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
// Exclude tests that depend on external services or local-only resources.
// These are covered by manual testing or dedicated CI jobs.
const GREP_INVERT = [
  'Explorer',                      // Cloudflare blocks headless browsers
  'Staging smoke',                 // staging.aaveapy.com behind Vercel Auth
  'visual regression',             // macOS screenshot baselines
  'header visual',                 // screenshot pixel-diff
  'Wallet Sync',                   // requires live Aave SDK GraphQL
  'Watch Mode',                    // requires live SDK + wallet
  'Scenario input pin scroll',     // flaky scroll-position assertions (pre-existing)
  'native columns show percentage', // data-dependent assertion on staging incentives
].join('|');

console.log('');
console.log('🧪 Running e2e tests (desktop chromium, 2 workers, staging API)...');
console.log('   Excludes: explorer, staging-smoke, visual, wallet-sync, watch-mode, scenario-pin, native-columns.');
console.log('   This typically takes ~2-3 min.');
console.log('');

try {
  execSync(
    `npx playwright test --project=chromium --retries=1 --workers=2 --grep-invert "${GREP_INVERT}"`,
    {
      stdio: 'inherit',
      env: { ...process.env },
    },
  );
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
