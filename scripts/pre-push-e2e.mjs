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
 * Sets CI=true so Playwright's webServer uses `build:staging && preview:staging`
 * (pre-compiled, instant page loads) instead of `dev:staging` (Vite dev server,
 * on-demand compilation, slow page loads that cause timeout failures).
 * This also skips tests that are known to fail in CI environments:
 *   - staging-smoke (staging.aaveapy.com behind Vercel Authentication)
 *   - explorer-links (Cloudflare blocks external blockchain explorers)
 *   - *-visual (screenshot baselines are macOS-specific)
 *   - watch-resubmit-refresh / wallet-reconnect (require live Aave SDK GraphQL)
 *   - portfolio-wallet-sync-precision (requires live SDK connections)
 *   - reserves-table-scenario-pin 2nd+3rd tests (complex multi-step timing)
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
console.log('🧪 Running e2e tests (desktop chromium, staging API, CI mode)...');
console.log('   Uses build+preview (fast page loads). Skips tests known to fail outside local dev.');
console.log('   This typically takes ~2-3 min (including build).');
console.log('');

try {
  execSync('npx playwright test --project=chromium --retries=1', {
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' },
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
