#!/usr/bin/env node
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_RESOLVER_PATH = path.join(ROOT, 'src/lib/tokenPriceResolver.ts');
const DEFAULT_API_BASE = 'https://api.aaveapy.com/api';
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

function getApiBase() {
  return process.env.VITE_API_BASE_URL || DEFAULT_API_BASE;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`Request failed: ${url} (${response.status})`);
    error.status = response.status;
    error.url = url;
    throw error;
  }
  return await response.json();
}

async function loadMarketChainIds() {
  const payload = await fetchJson(`${getApiBase()}/markets`);
  const reserves = Array.isArray(payload?.reserves) ? payload.reserves : [];
  const chainIds = new Set();
  for (const item of reserves) {
    if (typeof item?.chainId === 'number' && Number.isFinite(item.chainId) && item.chainId > 0) {
      chainIds.add(item.chainId);
    }
  }
  return Array.from(chainIds).sort((a, b) => a - b);
}

async function loadCoingeckoPlatformMap() {
  const payload = await fetchJson(`${COINGECKO_API_BASE}/asset_platforms`);
  const map = new Map();
  if (!Array.isArray(payload)) return map;
  for (const item of payload) {
    const chainId = item?.chain_identifier;
    const platformId = item?.id;
    if (
      typeof chainId === 'number' &&
      Number.isFinite(chainId) &&
      chainId > 0 &&
      typeof platformId === 'string' &&
      platformId
    ) {
      map.set(chainId, platformId);
    }
  }
  return map;
}

function parseLocalHardcodedMap(content) {
  const blockMatch = content.match(
    /const HARDCODED_PLATFORM_BY_CHAIN_ID:\s*Record<number,\s*string>\s*=\s*\{([\s\S]*?)\};/
  );
  if (!blockMatch) {
    throw new Error('Failed to parse HARDCODED_PLATFORM_BY_CHAIN_ID in tokenPriceResolver.ts');
  }

  const local = new Map();
  const pairs = blockMatch[1].matchAll(/(\d+)\s*:\s*'([^']+)'/g);
  for (const match of pairs) {
    local.set(Number(match[1]), match[2]);
  }
  return local;
}

function isCiMarkets403(error) {
  return (
    process.env.CI === 'true' &&
    error &&
    typeof error === 'object' &&
    Number(error.status) === 403 &&
    typeof error.url === 'string' &&
    error.url.endsWith('/markets')
  );
}

async function main() {
  const resolverContent = await readFile(LOCAL_RESOLVER_PATH, 'utf8');
  const coingeckoMap = await loadCoingeckoPlatformMap();
  const local = parseLocalHardcodedMap(resolverContent);

  let marketChainIds;
  try {
    marketChainIds = await loadMarketChainIds();
  } catch (error) {
    if (!isCiMarkets403(error)) throw error;
    marketChainIds = Array.from(local.keys()).sort((a, b) => a - b);
    console.warn(
      'Warning: /markets returned 403 in CI. Falling back to local HARDCODED_PLATFORM_BY_CHAIN_ID chainIds.'
    );
  }

  if (marketChainIds.length === 0) {
    console.error('No chainId found from /markets payload.');
    process.exit(1);
  }

  if (local.size === 0) {
    console.error('Local HARDCODED_PLATFORM_BY_CHAIN_ID is empty.');
    process.exit(1);
  }

  const missing = [];
  const mismatch = [];
  const unmappedByCoingecko = [];

  for (const chainId of marketChainIds) {
    const expectedPlatform = coingeckoMap.get(chainId);
    const localPlatform = local.get(chainId);
    if (!expectedPlatform) {
      unmappedByCoingecko.push(chainId);
      continue;
    }
    if (!localPlatform) {
      missing.push({ chainId, expectedPlatform });
      continue;
    }
    if (localPlatform !== expectedPlatform) {
      mismatch.push({ chainId, expectedPlatform, localPlatform });
    }
  }

  console.log(`Market chainIds checked: ${marketChainIds.length}`);
  console.log(`Local hardcoded platform entries: ${local.size}`);
  if (unmappedByCoingecko.length > 0) {
    console.log(`Market chainIds without CoinGecko mapping (informational): ${unmappedByCoingecko.join(', ')}`);
  }

  if (missing.length > 0 || mismatch.length > 0) {
    if (missing.length > 0) {
      console.error('\nMissing hardcoded platform entries (syncable):');
      for (const item of missing) {
        console.error(`- chainId ${item.chainId}: expected '${item.expectedPlatform}', actual '<missing>'`);
      }
    }
    if (mismatch.length > 0) {
      console.error('\nMismatched hardcoded platform entries:');
      for (const item of mismatch) {
        console.error(
          `- chainId ${item.chainId}: expected '${item.expectedPlatform}', actual '${item.localPlatform}'`
        );
      }
    }
    process.exit(1);
  }

  console.log('HARDCODED_PLATFORM_BY_CHAIN_ID is aligned with CoinGecko for current market chainIds.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
