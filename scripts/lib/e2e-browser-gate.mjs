/**
 * Can the local pre-push e2e gate actually run?
 *
 * Kept as a pure(-ish) module so the decision is testable without a browser and
 * without spawning anything: `scripts/pre-push-e2e.test.mjs` asserts both these
 * functions and the real script's exit code.
 *
 * The rule this encodes (AAV-1349): **a gate that cannot run must not report
 * success.** A 0-test browser run is indistinguishable from a green run once the
 * exit code is 0, and e2e is not a required check on any branch — so a silent skip
 * here lets a merge through with no browser evidence at all.
 *
 * The only way to skip is an explicit, per-push opt-out (`E2E_SKIP=1`). There is
 * deliberately no "auto" branch: auto-detection that fails open is what caused the
 * bug this module exists to prevent.
 */
import { readdirSync, statSync } from 'node:fs';

export const SKIP_ENV_VAR = 'E2E_SKIP';

/** Playwright's "install browsers inside the package" mode. */
export const BROWSERS_IN_PROJECT = '0';

const TRUTHY = new Set(['1', 'true']);

/**
 * Explicit opt-out only. `0`, `''` and `yes` all leave the gate on: a shell variable
 * left over from debugging must not become a silent permanent bypass.
 */
export function isSkipRequested(env = process.env) {
  const raw = env[SKIP_ENV_VAR];
  return typeof raw === 'string' && TRUTHY.has(raw.trim().toLowerCase());
}

/**
 * Directory names look like `chromium-1234` / `chromium_headless_shell-1234`.
 * The prefix test is intentionally loose: Playwright >= 1.49 runs headless chromium
 * through the shell build, so shell-only installs are usable. A half-broken install
 * that passes this check then fails loudly inside Playwright — still not a skip.
 */
export function hasChromiumBrowser(entries) {
  return entries.some((entry) => entry.startsWith('chromium'));
}

/**
 * Best-effort read of the browser cache. Any failure to read it (missing dir, not a
 * dir, permissions, race) reads as "no browsers" → the gate blocks. It must never
 * fall through to "run" on an unreadable cache, because `run` on a broken cache is
 * only a loud Playwright error, while the historical bug was the opposite direction.
 */
export function readBrowserCache(browsersPath) {
  if (browsersPath === BROWSERS_IN_PROJECT) return { cacheExists: false, entries: [] };
  try {
    if (!statSync(browsersPath).isDirectory()) return { cacheExists: false, entries: [] };
    return { cacheExists: true, entries: readdirSync(browsersPath) };
  } catch {
    return { cacheExists: false, entries: [] };
  }
}

/**
 * @returns {{action: 'run' | 'skip' | 'block', reason: string}}
 */
export function decideBrowserGate({ browsersPath, cacheExists, entries = [], skipRequested = false }) {
  if (skipRequested) {
    return { action: 'skip', reason: `${SKIP_ENV_VAR} is set` };
  }
  if (browsersPath === BROWSERS_IN_PROJECT) {
    // Browsers live in node_modules; the global cache is legitimately empty. Treating
    // this as "missing" would block every push from a machine that uses this mode.
    return { action: 'run', reason: 'browsers are installed inside the project' };
  }
  if (!cacheExists) {
    return { action: 'block', reason: `no Playwright browser cache at ${browsersPath}` };
  }
  if (!hasChromiumBrowser(entries)) {
    return { action: 'block', reason: `no chromium build in the cache at ${browsersPath}` };
  }
  return { action: 'run', reason: '' };
}
