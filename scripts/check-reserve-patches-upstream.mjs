#!/usr/bin/env node
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithTimeout } from './lib/fetch-utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPSTREAM_RESERVE_PATCHES_URL =
  'https://raw.githubusercontent.com/aave/interface/main/src/ui-config/reservePatches.ts';
const LOCAL_RESERVE_PATCHES_PATH = path.join(ROOT, 'src/ui-config/reservePatches.ts');

function extractAddressKeys(content) {
  const regex = /['"`](0x[a-fA-F0-9]{40})['"`]\s*:/g;
  const values = new Set();
  let match = null;
  while ((match = regex.exec(content)) !== null) {
    values.add(match[1].toLowerCase());
  }
  return values;
}

/**
 * Extract expression-based keys like [AaveV3Arbitrum.ASSETS.USDC.UNDERLYING.toLowerCase()]:
 * These are compared as normalised string representations since their runtime values
 * cannot be resolved statically.
 */
function extractExpressionKeys(content) {
  const regex = /\[([A-Za-z0-9_.]+\.toLowerCase\(\))\]\s*:/g;
  const values = new Set();
  let match = null;
  while ((match = regex.exec(content)) !== null) {
    values.add(match[1].replace(/\s+/g, ''));
  }
  return values;
}

function toSortedArray(values) {
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

async function main() {
  const [localContent, upstreamContent] = await Promise.all([
    readFile(LOCAL_RESERVE_PATCHES_PATH, 'utf8'),
    fetchWithTimeout(UPSTREAM_RESERVE_PATCHES_URL),
  ]);
  const localKeys = extractAddressKeys(localContent);
  const upstreamKeys = extractAddressKeys(upstreamContent);
  const localExprKeys = extractExpressionKeys(localContent);
  const upstreamExprKeys = extractExpressionKeys(upstreamContent);

  const missingFromLocal = toSortedArray(
    new Set([...upstreamKeys].filter((key) => !localKeys.has(key)))
  );
  const localOnly = toSortedArray(
    new Set([...localKeys].filter((key) => !upstreamKeys.has(key)))
  );
  const missingExprFromLocal = toSortedArray(
    new Set([...upstreamExprKeys].filter((key) => !localExprKeys.has(key)))
  );
  const localOnlyExpr = toSortedArray(
    new Set([...localExprKeys].filter((key) => !upstreamExprKeys.has(key)))
  );

  if (localKeys.size === 0 && localExprKeys.size === 0) {
    console.error('Local parsing yielded 0 reserve keys — possible format change.');
    process.exit(1);
  }
  if (upstreamKeys.size === 0 && upstreamExprKeys.size === 0) {
    console.error('Upstream parsing yielded 0 reserve keys — possible format change.');
    process.exit(1);
  }

  console.log(`local reserve address keys: ${localKeys.size}`);
  console.log(`upstream reserve address keys: ${upstreamKeys.size}`);
  console.log(`local reserve expression keys: ${localExprKeys.size}`);
  console.log(`upstream reserve expression keys: ${upstreamExprKeys.size}`);
  console.log(`missing address keys from local: ${missingFromLocal.length}`);
  console.log(`missing expression keys from local: ${missingExprFromLocal.length}`);
  console.log(`local-only address keys: ${localOnly.length}`);
  console.log(`local-only expression keys: ${localOnlyExpr.length}`);

  let hasDrift = false;

  if (missingFromLocal.length > 0) {
    hasDrift = true;
    console.error('\nMissing addresses (present in upstream, absent locally):');
    for (const key of missingFromLocal) {
      console.error(`- ${key}`);
    }
  }

  if (missingExprFromLocal.length > 0) {
    hasDrift = true;
    console.error('\nMissing expression keys (present in upstream, absent locally):');
    for (const key of missingExprFromLocal) {
      console.error(`- [${key}]`);
    }
  }

  if (localOnly.length > 0) {
    console.warn('\nLocal-only addresses (keep if intentional local extension):');
    for (const key of localOnly) {
      console.warn(`- ${key}`);
    }
  }

  if (localOnlyExpr.length > 0) {
    console.warn('\nLocal-only expression keys (keep if intentional local extension):');
    for (const key of localOnlyExpr) {
      console.warn(`- [${key}]`);
    }
  }

  if (hasDrift) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});

