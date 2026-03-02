#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const UPSTREAM_RESERVE_PATCHES_URL =
  'https://raw.githubusercontent.com/aave/interface/main/src/ui-config/reservePatches.ts';
const localReservePatchesPath = resolve(process.cwd(), 'src/ui-config/reservePatches.ts');

function extractAddressKeys(content) {
  const regex = /['"`](0x[a-fA-F0-9]{40})['"`]\s*:/g;
  const values = new Set();
  let match = null;
  while ((match = regex.exec(content)) !== null) {
    values.add(match[1].toLowerCase());
  }
  return values;
}

function toSortedArray(values) {
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

async function main() {
  const [localContent, upstreamResponse] = await Promise.all([
    readFile(localReservePatchesPath, 'utf8'),
    fetch(UPSTREAM_RESERVE_PATCHES_URL),
  ]);

  if (!upstreamResponse.ok) {
    throw new Error(`Failed to fetch upstream reservePatches.ts: HTTP ${upstreamResponse.status}`);
  }

  const upstreamContent = await upstreamResponse.text();
  const localKeys = extractAddressKeys(localContent);
  const upstreamKeys = extractAddressKeys(upstreamContent);

  const missingFromLocal = toSortedArray(
    new Set([...upstreamKeys].filter((key) => !localKeys.has(key)))
  );
  const localOnly = toSortedArray(
    new Set([...localKeys].filter((key) => !upstreamKeys.has(key)))
  );

  console.log(`local reserve keys: ${localKeys.size}`);
  console.log(`upstream reserve keys: ${upstreamKeys.size}`);
  console.log(`missing from local: ${missingFromLocal.length}`);
  console.log(`local-only keys: ${localOnly.length}`);

  if (missingFromLocal.length > 0) {
    console.error('\nMissing addresses (present in upstream, absent locally):');
    for (const key of missingFromLocal) {
      console.error(`- ${key}`);
    }
  }

  if (localOnly.length > 0) {
    console.warn('\nLocal-only addresses (keep if intentional local extension):');
    for (const key of localOnly) {
      console.warn(`- ${key}`);
    }
  }

  if (missingFromLocal.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});

