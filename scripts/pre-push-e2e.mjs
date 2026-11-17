#!/usr/bin/env node
/**
 * Pre-push e2e gate — runs Playwright desktop chromium tests before push.
 *
 * Browser availability (AAV-1349):
 *   - Missing chromium is a BLOCKED gate, not a skip. A 0-test browser run must
 *     never be reported as a pass: e2e is not a required check on any branch, so a
 *     silent skip here is enough to merge with zero browser evidence. This used to
 *     `process.exit(0)` — the gate was green because it never ran.
 *   - The only way through without browsers is a per-push, explicit opt-out:
 *     `E2E_SKIP=1 git push`. It says out loud that this push carries no e2e
 *     evidence. Default is off; `E2E_SKIP=0`/empty/anything else leaves it off.
 *
 * Strategy:
 *   - Uses `dev:staging` webServer (Vite dev server, no build step → no OOM)
 *   - `--workers=1`: this path runs a cold dev server, and readiness waits
 *     (`waitForTableReady`, `waitForLoadState('networkidle')`) were timing out
 *     with 2 workers whenever another agent's gate shared the machine — two
 *     such specs went red on unrelated pushes (2026-09-30), both green on a
 *     quiet rerun. One worker serialises the load instead of teaching us to
 *     ignore red. CI keeps its 2-shard split, which runs against a built
 *     preview and is unaffected.
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
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { archiveFailingResults, findFailingResultDirs } from './lib/e2e-artifacts.mjs';
import { SKIP_ENV_VAR, decideBrowserGate, isSkipRequested, readBrowserCache } from './lib/e2e-browser-gate.mjs';

// --- 1. Resolve the browser cache path (Playwright's own default when unset) ---
const browsersPath =
  process.env.PLAYWRIGHT_BROWSERS_PATH ||
  (platform() === 'darwin'
    ? join(homedir(), 'Library', 'Caches', 'ms-playwright')
    : join(homedir(), '.cache', 'ms-playwright'));

// --- 2. Decide whether this gate can run at all ---
// The decision lives in scripts/lib/e2e-browser-gate.mjs so it can be tested
// without a browser; the exit-code contract lives here.
const gate = decideBrowserGate({
  browsersPath,
  skipRequested: isSkipRequested(),
  ...readBrowserCache(browsersPath),
});

if (gate.action === 'skip') {
  console.log('');
  console.log(`⚠️  [pre-push] e2e gate SKIPPED by explicit opt-out (${SKIP_ENV_VAR}=1).`);
  console.log('   No browser test ran. This push carries no e2e evidence.');
  console.log(`   Restore the gate: unset ${SKIP_ENV_VAR}. Install browsers: npx playwright install chromium`);
  console.log('');
  process.exit(0);
}

if (gate.action === 'block') {
  console.error('');
  console.error('❌ [pre-push] BLOCKED: e2e gate CANNOT RUN — Playwright chromium is not installed.');
  console.error(`   Reason: ${gate.reason}`);
  console.error('   A 0-test browser run is not a pass — this gate blocks until browsers exist (AAV-1349).');
  console.error('   Fix (one-off, ~120 MB): npx playwright install chromium');
  console.error(`   Deliberate skip (no e2e evidence for this push): ${SKIP_ENV_VAR}=1 git push`);
  console.error('');
  process.exit(1);
}

// --- 3. Run desktop chromium e2e tests ---
// Exclude tests that depend on external services or local-only resources.
// These are covered by manual testing or dedicated CI jobs.
const GREP_INVERT = [
  'Explorer', // Cloudflare blocks headless browsers
  'Staging smoke', // staging.aaveapy.com behind Vercel Auth
  'visual regression', // macOS screenshot baselines (slow, display-sensitive)
  'header visual', // screenshot pixel-diff
  'Wallet Sync', // requires live Aave SDK GraphQL
  'Watch Mode', // requires live SDK + wallet
  'Wallet reconnect', // requires live wallet store/SDK state (AAV-562)
  // 8-step scenario timing, CI-skipped by design ("run locally"); marginal
  // under 2-worker load — 2026-09-26 A/B (3 samples): fails under suite load
  // on both sides of the diff (base passed its single sample, HEAD 2/3),
  // isolated runs pass, app bundle identical across samples → load flake.
  'does not force pin',
  // Load-flake, 2026-09-28. Both fail only under full-suite 2-worker load
  // against the dev server; isolating their spec files with the same flags →
  // 10 passed (1.7m), and CI e2e-desktop (built preview, 2 shards) passes them.
  // The change that surfaced them (AAV-1320: CSP + vercel.json) cannot affect
  // table scroll or row expansion. CI keeps covering both; local pre-push drops
  // them so a flaky suite doesn't block unrelated pushes.
  'M9 点整行', // scenario-input-modes.desktop — expansion timing
  '\\(1\\) not at anchor', // reserves-table-market-filter-pin — scroll-pin anchor (regex-escaped parens)
].join('|');

console.log('');
console.log('🧪 Running e2e tests (desktop chromium, 1 worker, staging API)...');
console.log(
  '   Excludes: explorer links, staging-smoke, visual, wallet-sync, watch-mode, wallet-reconnect, scenario-pin 8-step timing.',
);
console.log('   This typically takes ~2-3 min.');
console.log('');

// Use spawn (async) instead of execSync so we can stream stdout to the
// terminal in real-time while also capturing it for summary parsing.
const result = await new Promise((resolve) => {
  const child = spawn(
    'npx',
    ['playwright', 'test', '--project=chromium', '--retries=1', '--workers=1', '--grep-invert', GREP_INVERT],
    {
      stdio: ['ignore', 'pipe', 'inherit'],
      // Recording is debug-only overhead on a full-suite local run; CI keeps it.
      env: { ...process.env, E2E_NO_RECORDING: '1' },
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

/**
 * Copy whatever Playwright left behind (aria snapshot, screenshot, trace) into a
 * timestamped archive, because the next run wipes `test-results/` and an
 * unreproducible failure then has no evidence left to diagnose from. Logic and
 * its contract live in `scripts/lib/e2e-artifacts.mjs`.
 */
function archiveFailureArtifacts() {
  const { count, dest } = archiveFailingResults({
    resultsDir: 'test-results',
    archiveRoot: 'test-results-archive',
  });
  if (count === 0) return 0;
  console.log(`📦 失败现场已存进 ${dest}/（下一次运行会清空 test-results/，不复制就永久丢失）`);
  for (const entry of findFailingResultDirs('test-results')) console.log(`   · ${entry}`);
  return count;
}

if (result.code === 0) {
  console.log('✅ e2e tests passed.');
  console.log('');
  process.exit(0);
}

// Non-zero exit — distinguish actual failures from flaky-only.
if (failedCount > 0) {
  archiveFailureArtifacts();
  console.error(`❌ e2e tests failed — ${failedCount} test(s) failed after retry. Push blocked.`);
  console.error('   Fix the failing tests, or use `git push --no-verify` to skip (not recommended).');
  console.error('');
  process.exit(1);
}

if (flakyCount > 0) {
  // A flaky is the interesting case: it passed on retry, so nothing on disk will
  // show it ever failed once the next run clears the directory.
  archiveFailureArtifacts();
  console.log(`⚠️  ${flakyCount} flaky test(s) passed on retry — push allowed.`);
  console.log('   Consider fixing flaky tests to improve CI stability.');
  console.log('');
  process.exit(0);
}

// Non-zero exit with no recognisable summary — treat conservatively.
archiveFailureArtifacts();
console.error('❌ e2e tests exited abnormally — push blocked.');
console.error('   Investigate the output above, or use `git push --no-verify` to skip (not recommended).');
console.error('');
process.exit(1);
