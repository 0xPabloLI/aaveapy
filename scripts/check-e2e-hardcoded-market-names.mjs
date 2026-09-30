#!/usr/bin/env node
/**
 * Guard: e2e specs must not pin DOM selectors to a literal chain name.
 *
 * Backend data drifts (Arbitrum disappeared from /markets entirely on
 * 2026-09-30), and a selector literal carrying such a name fails as a locator
 * timeout — indistinguishable from flakiness at first glance. Picking the chip
 * from the rendered markets row instead is the idiom the suite already uses.
 *
 * Reports selector literals only; candidate lists that tolerate absence are
 * fine, as is prose. See docs/specs/e2e-hardcoded-market-name-guard.md.
 *
 * Usage: node scripts/check-e2e-hardcoded-market-names.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { extractChainVocabulary, findHardcodedChainNames } from './lib/e2e-market-name-literals.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const MAP_FILE = join(ROOT, 'src/lib/chainIconMap.ts');
const E2E_DIR = join(ROOT, 'e2e');

function specFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...specFiles(full));
    else if (entry.endsWith('.spec.ts')) found.push(full);
  }
  return found.sort();
}

const vocabulary = extractChainVocabulary(readFileSync(MAP_FILE, 'utf8'));
if (vocabulary.size === 0) {
  console.error(`❌ No chain slugs parsed from ${MAP_FILE} — the guard would pass vacuously.`);
  process.exit(1);
}

const files = specFiles(E2E_DIR);
const findings = files.flatMap((file) =>
  findHardcodedChainNames(readFileSync(file, 'utf8'), vocabulary).map((hit) => ({ ...hit, file })),
);

for (const hit of findings) {
  console.error(`❌ ${hit.file.replace(`${ROOT}/`, '')}:${hit.line} pins a selector to [${hit.names.join(', ')}]`);
  console.error(`   ${hit.snippet}`);
}

if (findings.length) {
  console.error('');
  console.error(`Fix: read the chip from the rendered DOM, e.g.`);
  console.error(`  page.locator('[data-testid="markets-row"] button') // pick by presence, not by name`);
  console.error(`See docs/specs/e2e-hardcoded-market-name-guard.md`);
  process.exit(1);
}

console.log(
  `✅ No hardcoded chain names in e2e selectors (${files.length} specs scanned, ${vocabulary.size} names in vocabulary).`,
);
