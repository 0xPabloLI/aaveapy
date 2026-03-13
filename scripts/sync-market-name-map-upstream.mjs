#!/usr/bin/env node
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithTimeout, countChar } from './lib/fetch-utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REMOTE_MARKETS_CONFIG_URL =
  'https://raw.githubusercontent.com/aave/interface/main/src/ui-config/marketsConfig.tsx';
const LOCAL_MAP_PATH = path.join(ROOT, 'src/lib/aaveLinks.ts');

function parseExpectedMapping(marketsConfigContent) {
  const lines = marketsConfigContent.split('\n');
  const expected = new Map();
  let activeMarket = null;
  let depth = 0;

  for (const line of lines) {
    if (activeMarket === null) {
      const start = line.match(/^\s*\[CustomMarket\.([A-Za-z0-9_]+)\]:\s*\{/);
      if (!start) continue;
      activeMarket = start[1];
      depth = 1;
      continue;
    }

    const lending = line.match(
      /LENDING_POOL_ADDRESS_PROVIDER:\s*(AaveV[23][A-Za-z0-9]+)\.POOL_ADDRESSES_PROVIDER/
    );
    if (lending && !expected.has(lending[1])) {
      expected.set(lending[1], activeMarket);
    }

    depth += countChar(line, '{');
    depth -= countChar(line, '}');
    if (depth <= 0) {
      activeMarket = null;
      depth = 0;
    }
  }

  return expected;
}

function parseLocalObjectContent(fileContent) {
  const match = fileContent.match(
    /const MARKET_NAME_MAP:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\};/
  );
  if (!match || match.index == null) {
    throw new Error('Failed to parse MARKET_NAME_MAP from src/lib/aaveLinks.ts');
  }

  const objectStart = fileContent.indexOf('{', match.index);
  const objectEnd = fileContent.indexOf('};', objectStart);
  if (objectStart < 0 || objectEnd < 0) {
    throw new Error('Failed to locate MARKET_NAME_MAP object boundaries.');
  }

  return {
    body: match[1],
    start: objectStart + 1,
    end: objectEnd,
  };
}

function parseLocalMap(body) {
  const local = new Map();
  const orderedKeys = [];
  const pairs = body.matchAll(/([A-Za-z0-9_]+)\s*:\s*'([^']+)'/g);
  for (const match of pairs) {
    const key = match[1];
    const value = match[2];
    if (!local.has(key)) orderedKeys.push(key);
    local.set(key, value);
  }
  return { local, orderedKeys };
}

function isIgnoredMarket(target) {
  return target.includes('sepolia');
}

async function main() {
  const [upstreamContent, localContent] = await Promise.all([
    fetchWithTimeout(REMOTE_MARKETS_CONFIG_URL),
    readFile(LOCAL_MAP_PATH, 'utf8'),
  ]);

  const expected = parseExpectedMapping(upstreamContent);
  if (expected.size === 0) {
    throw new Error('Upstream parsing yielded 0 market entries.');
  }

  const object = parseLocalObjectContent(localContent);
  const { local, orderedKeys } = parseLocalMap(object.body);
  if (local.size === 0) {
    throw new Error('Local parsing yielded 0 MARKET_NAME_MAP entries.');
  }

  let updates = 0;
  let additions = 0;

  for (const [sourceKey, targetMarket] of expected) {
    if (isIgnoredMarket(targetMarket)) continue;
    if (!local.has(sourceKey)) {
      local.set(sourceKey, targetMarket);
      orderedKeys.push(sourceKey);
      additions += 1;
      continue;
    }
    if (local.get(sourceKey) !== targetMarket) {
      local.set(sourceKey, targetMarket);
      updates += 1;
    }
  }

  if (additions === 0 && updates === 0) {
    console.log('MARKET_NAME_MAP is already aligned with upstream.');
    return;
  }

  const rebuiltBody = `\n${orderedKeys.map((key) => `  ${key}: '${local.get(key)}',`).join('\n')}\n`;
  const nextContent = `${localContent.slice(0, object.start)}${rebuiltBody}${localContent.slice(
    object.end
  )}`;
  await writeFile(LOCAL_MAP_PATH, nextContent, 'utf8');

  console.log(`Updated MARKET_NAME_MAP. Added ${additions}, updated ${updates}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
