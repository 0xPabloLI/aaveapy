#!/usr/bin/env node
import { readFile } from 'fs/promises';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const REMOTE_MARKETS_CONFIG_URL =
  'https://raw.githubusercontent.com/aave/interface/main/src/ui-config/marketsConfig.tsx';
const LOCAL_MAP_PATH = path.join(ROOT, 'src/lib/aaveLinks.ts');

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function loadUpstreamMarketsConfig() {
  return await fetchWithTimeout(REMOTE_MARKETS_CONFIG_URL);
}

function countChar(input, char) {
  let count = 0;
  for (const ch of input) {
    if (ch === char) count += 1;
  }
  return count;
}

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

    const lending = line.match(/LENDING_POOL_ADDRESS_PROVIDER:\s*(AaveV[23][A-Za-z0-9]+)\.POOL_ADDRESSES_PROVIDER/);
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

function parseLocalMap(aaveLinksContent) {
  const objectMatch = aaveLinksContent.match(
    /const MARKET_NAME_MAP:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\};/
  );
  if (!objectMatch) {
    throw new Error('Failed to parse MARKET_NAME_MAP from src/lib/aaveLinks.ts');
  }

  const local = new Map();
  const pairs = objectMatch[1].matchAll(/([A-Za-z0-9_]+)\s*:\s*'([^']+)'/g);
  for (const match of pairs) {
    local.set(match[1], match[2]);
  }
  return local;
}

function isIgnoredMarket(target) {
  return target.includes('sepolia');
}

async function main() {
  const [upstreamContent, localContent] = await Promise.all([
    loadUpstreamMarketsConfig(),
    readFile(LOCAL_MAP_PATH, 'utf8'),
  ]);

  const expected = parseExpectedMapping(upstreamContent);
  const local = parseLocalMap(localContent);

  const missing = [];
  for (const [sourceKey, targetMarket] of expected) {
    if (isIgnoredMarket(targetMarket)) continue;
    const actualTarget = local.get(sourceKey);
    if (!actualTarget) {
      missing.push({ sourceKey, expected: targetMarket, actual: null });
      continue;
    }
    if (actualTarget !== targetMarket) {
      missing.push({ sourceKey, expected: targetMarket, actual: actualTarget });
    }
  }

  console.log(`Upstream market source keys parsed: ${expected.size}`);
  console.log(`Local MARKET_NAME_MAP keys: ${local.size}`);
  console.log(`Checked non-sepolia expected keys: ${[...expected.entries()].filter(([, v]) => !isIgnoredMarket(v)).length}`);

  if (missing.length > 0) {
    console.error('\nMARKET_NAME_MAP mismatch against upstream marketsConfig:');
    for (const item of missing) {
      console.error(
        `- ${item.sourceKey}: expected '${item.expected}', actual '${item.actual ?? '<missing>'}'`
      );
    }
    process.exit(1);
  }

  console.log('MARKET_NAME_MAP is aligned with upstream marketsConfig (non-sepolia markets).');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});

