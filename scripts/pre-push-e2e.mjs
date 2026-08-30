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
 *       • Wallet reconnect → requires live wallet store/SDK state (AAV-562)
 *
 * Flaky tolerance:
 *   - Tests that pass on retry ("flaky") do NOT block the push — only tests
 *     that fail after all retries do. This avoids blocking pushes on staging
 *     API timing flakiness while still catching real regressions.
 */
import { spawn } from 'node:child_process';
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
  'Explorer',          // Cloudflare blocks headless browsers
  'Staging smoke',     // staging.aaveapy.com behind Vercel Auth
  'visual regression', // macOS screenshot baselines (slow, display-sensitive)
  'header visual',     // screenshot pixel-diff
  'Wallet Sync',       // requires live Aave SDK GraphQL
  'Watch Mode',        // requires live SDK + wallet
  'Wallet reconnect',  // requires live wallet store/SDK state (AAV-562)
].join('|');

console.log('');
console.log('🧪 Running e2e tests (desktop chromium, 2 workers, staging API)...');
console.log('   Excludes: explorer links, staging-smoke, visual, wallet-sync, watch-mode, wallet-reconnect.');
console.log('   This typically takes ~2-3 min.');
console.log('');

// Use spawn (async) instead of execSync so we can stream stdout to the
// terminal in real-time while also capturing it for summary parsing.
const result = await new Promise((resolve) => {
  const child = spawn(
    'npx',
    ['playwright', 'test', '--project=chromium', '--retries=1', '--workers=2', '--grep-invert', GREP_INVERT],
    {
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env },
    },
  );

  let stdout = '';
  child.stdout.on('data', (data) => {
    process.stdout.write(data);
    stdout += data.toString();
  });

  child.on('close', (code) => {
    resolve({ code: code ?? 1, stdout });
  });

  child.on('error', (err) => {
    console.error(`Failed to spawn playwright: ${err.message}`);
    resolve({ code: 1, stdout: '' });
  });
});

// --- 4. Parse Playwright summary and decide exit code ---
// Strip ANSI colour codes before regex matching.
const ANSI = /\x1b\[[0-9;]*m/g;
const clean = result.stdout.replace(ANSI, '');

const failedMatch = clean.match(/^\s+(\d+)\s+failed\b/m);
const failedCount = failedMatch ? parseInt(failedMatch[1], 10) : 0;
const flakyMatch = clean.match(/^\s+(\d+)\s+flaky\b/m);
const flakyCount = flakyMatch ? parseInt(flakyMatch[1], 10) : 0;

console.log('');

if (result.code === 0) {
  console.log('✅ e2e tests passed.');
  console.log('');
  process.exit(0);
}

// Non-zero exit — distinguish actual failures from flaky-only.
if (failedCount > 0) {
  console.error(`❌ e2e tests failed — ${failedCount} test(s) failed after retry. Push blocked.`);
  console.error('   Fix the failing tests, or use `git push --no-verify` to skip (not recommended).');
  console.error('');
  process.exit(1);
}

if (flakyCount > 0) {
  console.log(`⚠️  ${flakyCount} flaky test(s) passed on retry — push allowed.`);
  console.log('   Consider fixing flaky tests to improve CI stability.');
  console.log('');
  process.exit(0);
}

// Non-zero exit with no recognisable summary — treat conservatively.
console.error('❌ e2e tests exited abnormally — push blocked.');
console.error('   Investigate the output above, or use `git push --no-verify` to skip (not recommended).');
console.error('');
process.exit(1);
