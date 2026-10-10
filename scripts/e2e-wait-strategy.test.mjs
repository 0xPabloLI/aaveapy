#!/usr/bin/env node
/**
 * Guard: e2e code waits on a page-owned signal, never on network silence.
 *
 * `waitForLoadState('networkidle')` waits for a network-quiet window; the app
 * prefetches for *every* route at module load, so that window never opens while
 * the full pre-push suite hammers staging — the page under test then dies in
 * its first step on an unrelated request. Why, and what replaced it:
 * docs/specs/aav-1329-faq-anchor-wait-strategy.md.
 *
 * Scans every `.ts` file under `e2e/`, skipping comments (a prose mention is
 * not a violation). Inline escape hatch: `// e2e-wait-strategy: allow`.
 *
 * Row numbers refer to the Behavioral Scenarios matrix in that same spec.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const E2E_DIR = join(ROOT, 'e2e');
const BANNED = 'networkidle';
const ALLOW_MARKER = /e2e-wait-strategy:\s*allow/;

/**
 * Blank out comments while preserving line breaks (so line numbers survive).
 * String literals are kept verbatim: a violation lives *inside* a string, and
 * a `//` inside one (`'https://…'`) must not be mistaken for a comment start.
 */
export function stripComments(source) {
  let out = '';
  let i = 0;
  let state = 'code';

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === 'code') {
      if (ch === '/' && next === '/') {
        state = 'line';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        state = 'block';
        i += 2;
        continue;
      }
      out += ch;
      if (ch === "'") state = 'single';
      else if (ch === '"') state = 'double';
      else if (ch === '`') state = 'template';
      i += 1;
      continue;
    }

    if (state === 'line') {
      if (ch === '\n') {
        state = 'code';
        out += ch;
      }
      i += 1;
      continue;
    }

    if (state === 'block') {
      if (ch === '*' && next === '/') {
        state = 'code';
        i += 2;
        continue;
      }
      if (ch === '\n') out += ch;
      i += 1;
      continue;
    }

    // Inside a string literal — content matters, comments do not start here.
    if (ch === '\\') {
      out += ch + (next ?? '');
      i += 2;
      continue;
    }
    out += ch;
    const closes =
      (state === 'single' && ch === "'") || (state === 'double' && ch === '"') || (state === 'template' && ch === '`');
    if (closes) state = 'code';
    i += 1;
  }

  return out;
}

/**
 * Rows 1–9: every non-comment `networkidle` is a violation, reported one entry
 * per line (the fix is per line, so a second occurrence on the same line adds
 * no information). The allow marker is read from the *raw* line, so it also
 * overrides a violation that sits beside a comment.
 */
export function findNetworkIdleWaits(source) {
  const codeLines = stripComments(source).split('\n');
  const rawLines = source.split('\n');
  const hits = [];

  for (let idx = 0; idx < codeLines.length; idx += 1) {
    if (!codeLines[idx].includes(BANNED)) continue;
    const raw = rawLines[idx] ?? '';
    if (ALLOW_MARKER.test(raw)) continue;
    hits.push({ line: idx + 1, snippet: raw.trim() });
  }

  return hits;
}

function typescriptFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...typescriptFiles(full));
    else if (entry.endsWith('.ts')) found.push(full);
  }
  return found.sort();
}

describe('stripComments', () => {
  it('row 3: blanks a block comment but keeps code on the same line', () => {
    const source = "/* networkidle */ await page.waitForLoadState('networkidle');";
    const stripped = stripComments(source);
    assert.equal((stripped.match(/networkidle/g) ?? []).length, 1);
    assert.ok(stripped.includes("await page.waitForLoadState('networkidle')"));
    assert.equal(stripped.split('\n').length, source.split('\n').length);
  });

  it('row 9: a `//` inside a string literal does not start a comment', () => {
    const source = "await page.goto('https://example.com'); await page.waitForLoadState('networkidle');";
    assert.equal(findNetworkIdleWaits(source).length, 1);
  });
});

describe('findNetworkIdleWaits', () => {
  it('row 2: leaves a prose mention in a comment alone', () => {
    const source = '// `networkidle` never settles behind Vercel auth, so wait on content.';
    assert.deepEqual(findNetworkIdleWaits(source), []);
  });

  it('row 4: flags a wait-state string in code, with its line', () => {
    const source = ['await page.goto("/defi-yield-tracker");', "await page.waitForLoadState('networkidle');"].join(
      '\n',
    );
    const hits = findNetworkIdleWaits(source);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 2);
    assert.match(hits[0].snippet, /waitForLoadState\('networkidle'\)/);
  });

  it('row 5: leaves content-based waits alone', () => {
    const source = [
      "await page.waitForLoadState('domcontentloaded');",
      "await page.waitForLoadState('load');",
      'await page.waitForLoadState();',
    ].join('\n');
    assert.deepEqual(findNetworkIdleWaits(source), []);
  });

  it('row 6: flags a goto waitUntil option too', () => {
    const source = "await page.goto('/defi-yield-tracker', { waitUntil: 'networkidle' });";
    assert.equal(findNetworkIdleWaits(source).length, 1);
  });

  it('row 7: honours the inline allow marker', () => {
    const source = "await page.waitForLoadState('networkidle'); // e2e-wait-strategy: allow — legacy probe";
    assert.deepEqual(findNetworkIdleWaits(source), []);
  });

  it('row 8: a camelCase neighbour is not a hit (case-sensitive token)', () => {
    assert.deepEqual(findNetworkIdleWaits('expect(myNetworkidleFlag).toBe(false);'), []);
    assert.deepEqual(findNetworkIdleWaits('const MODE = NETWORKIDLE;'), []);
  });

  it('row 3: a block comment followed by a violation on the same line is still caught', () => {
    const source = "/* keep quiet */ await page.waitForLoadState('networkidle'); // trailing note";
    assert.equal(findNetworkIdleWaits(source).length, 1);
  });
});

describe('e2e wait strategy guard', () => {
  const files = typescriptFiles(E2E_DIR);

  it('row 10: the scan is non-vacuous (it actually reads the e2e suite)', () => {
    assert.ok(files.length >= 20, `only ${files.length} .ts files found under e2e/ — the guard would pass vacuously`);
  });

  it('row 1: no e2e file waits on network silence', () => {
    const findings = files.flatMap((file) =>
      findNetworkIdleWaits(readFileSync(file, 'utf8')).map((hit) => ({ ...hit, file })),
    );

    const report = findings.map((hit) => `  ${hit.file.replace(`${ROOT}/`, '')}:${hit.line} ${hit.snippet}`).join('\n');

    assert.equal(
      findings.length,
      0,
      `e2e must wait on a page-owned signal, not on network silence (${findings.length} hit(s)):\n${report}\n` +
        "Replace `waitForLoadState('networkidle')` with a wait on the page's own output, e.g. " +
        "`await expect(page.getByRole('heading', { level: 1, name: /…/ })).toBeVisible()`.\n" +
        'See docs/specs/aav-1329-faq-anchor-wait-strategy.md',
    );
  });
});
