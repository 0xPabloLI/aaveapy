/**
 * Preserve Playwright failure artifacts across runs.
 *
 * Why this exists: Playwright clears `test-results/` at the start of every run,
 * so a failure that nobody reproduced immediately afterwards loses its only
 * evidence (aria snapshot, screenshot, trace). On 2026-10-09 a pre-push e2e
 * failure became undiagnosable exactly this way — the next, successful run had
 * already wiped the directory. The pre-push gate therefore copies anything that
 * looks like a failing test into `test-results-archive/<stamp>/` before it
 * reports the outcome.
 *
 * Contract rows: `scripts/e2e-artifacts.test.mjs`.
 */
import { cpSync, existsSync, readdirSync, statSync } from 'node:fs';

/**
 * Directories whose names Playwright uses when a test failed at least once:
 * `error-context.md` (the aria snapshot) or a `test-failed-*` screenshot.
 *
 * @param {string} resultsDir path to `test-results`
 * @returns {string[]} failing entry names, sorted, empty when nothing qualifies
 */
export function findFailingResultDirs(resultsDir) {
  if (!existsSync(resultsDir)) return [];
  return readdirSync(resultsDir)
    .filter((entry) => {
      const dir = `${resultsDir}/${entry}`;
      if (!statSync(dir).isDirectory()) return false;
      const files = readdirSync(dir);
      return files.includes('error-context.md') || files.some((f) => f.startsWith('test-failed-'));
    })
    .sort();
}

/**
 * Copy every failing result dir into `<archiveRoot>/<stamp>/<entry>`.
 *
 * @param {{resultsDir: string, archiveRoot: string, now?: Date}} opts
 * @returns {{count: number, dest: string | null}} count 0 ⇒ dest null (nothing written)
 */
export function archiveFailingResults({ resultsDir, archiveRoot, now = new Date() }) {
  const failing = findFailingResultDirs(resultsDir);
  if (failing.length === 0) return { count: 0, dest: null };
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const dest = `${archiveRoot}/${stamp}`;
  for (const entry of failing) {
    cpSync(`${resultsDir}/${entry}`, `${dest}/${entry}`, { recursive: true });
  }
  return { count: failing.length, dest };
}
