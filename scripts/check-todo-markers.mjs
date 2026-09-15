#!/usr/bin/env node
/**
 * Technical-debt marker policy (ratchet).
 *
 * Policy: every TODO / FIXME / HACK marker in committed code must link a
 * Linear ticket — `TODO(AAV-123)`, `FIXME(AAV-456)` — or a public issue/linear
 * URL. Bare markers are unverifiable debt: nobody knows whether they are still
 * real, so agents cannot distinguish "known, tracked debt" from rot.
 *
 * Enforced as a ratchet: `.todo-baseline.json` records the count of legacy
 * bare markers. CI / pre-push fail only when the count grows, so existing debt
 * is paid off opportunistically while new bare markers are blocked.
 *
 * Usage: node scripts/check-todo-markers.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_FILE = join(ROOT, '.todo-baseline.json');
const SCAN_DIRS = ['src', 'e2e', 'scripts'];
// The policy definition itself discusses TODO markers (and encodes the rule
// as regexes) — it is not debt. Exclude it from its own scan.
const SELF_BASENAME = 'check-todo-markers.mjs';
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.css']);

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'generated',
  'test-results',
  'playwright-report',
  'coverage',
  '__snapshots__',
]);

/**
 * Matches a TODO/FIXME/HACK/XXX comment without a ticket reference anywhere
 * later on the line. Two shapes, to avoid matching regex literals or prose
 * that merely mentions the words:
 *   - comment-opener anchored to line start: `/* TODO`, `* TODO` (JSDoc), `# TODO`
 *   - comment-opener anywhere in the line for trailing comments: `// TODO`, `# TODO`
 * (`//` inside regex source is virtually always written escaped, `\/\/`,
 * so inline matching stays safe.)
 */
const START_MARKER = /^[ \t]*(?:\/?\*+|#)[^\n]*\b(TODO|FIXME|HACK|XXX)\b(?![^\n]*\((?:AAV-\d+|https?:\/\/[^\s)]+)\))/;
const INLINE_MARKER = /(?:\/\/|#)[^\n]*\b(TODO|FIXME|HACK|XXX)\b(?![^\n]*\((?:AAV-\d+|https?:\/\/[^\s)]+)\))/;

function isBareMarker(line) {
  return START_MARKER.test(line) || INLINE_MARKER.test(line);
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      yield* walk(join(dir, entry.name));
    } else if (SCAN_EXT.has(extname(entry.name))) {
      yield join(dir, entry.name);
    }
  }
}

const violations = [];
for (const dir of SCAN_DIRS) {
  const absDir = join(ROOT, dir);
  if (!existsSync(absDir)) continue;
  for (const file of walk(absDir)) {
    if (file.endsWith(SELF_BASENAME)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (isBareMarker(line)) {
        violations.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
}

const baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) : { maxViolations: 0 };

console.log(`Technical-debt markers: ${violations.length} bare (baseline allows ${baseline.maxViolations})`);

if (violations.length > baseline.maxViolations) {
  console.error('\n❌ New bare TODO/FIXME/HACK markers detected — link a Linear ticket: TODO(AAV-123)');
  // Show only the newest offenders relative to the baseline size.
  for (const v of violations.slice(0, violations.length - baseline.maxViolations)) {
    console.error(`   ${v}`);
  }
  console.error('\nFix the marker (add ticket ref) or pay down the debt, then re-run.');
  process.exit(1);
}

if (violations.length < baseline.maxViolations && process.env.TODO_BASELINE_AUTOSHRINK !== '0') {
  // Debt was paid down — ratchet the baseline back so it can never silently regrow.
  writeFileSync(BASELINE_FILE, `${JSON.stringify({ maxViolations: violations.length }, null, 2)}\n`);
  console.log(`📉 Ratcheted .todo-baseline.json down to ${violations.length}. Commit the updated baseline.`);
}

if (violations.length > 0) {
  console.log('Existing bare markers (pay down opportunistically):');
  for (const v of violations) console.log(`   ${v}`);
}
console.log('✅ Technical-debt marker policy satisfied.');
