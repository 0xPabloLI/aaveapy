#!/usr/bin/env node
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_STAGING_API_BASE } from './lib/default-api-bases.mjs';
import { safeUrlForLog } from './lib/fetch-utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_RESOLVER_PATH = path.join(ROOT, 'src/lib/tokenPriceResolver.ts');
const DEFAULT_API_BASE = DEFAULT_STAGING_API_BASE;
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

function normalizeApiBase(value) {
  if (typeof value !== 'string') return '';
  const t = value.trim();
  if (!t) return '';
  return t.replace(/\/+$/, '');
}

function getApiBase() {
  return (
    normalizeApiBase(process.env.LIVE_TEST_API_BASE_CI) ||
    normalizeApiBase(process.env.VITE_API_BASE_URL) ||
    DEFAULT_API_BASE
  );
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`Request failed: ${safeUrlForLog(url)} (${response.status})`);
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
  if (!blockMatch || blockMatch.index == null) {
    throw new Error('Failed to parse HARDCODED_PLATFORM_BY_CHAIN_ID in tokenPriceResolver.ts');
  }

  const objectStart = content.indexOf('{', blockMatch.index);
  const objectEnd = content.indexOf('};', objectStart);
  if (objectStart < 0 || objectEnd < 0) {
    throw new Error('Failed to locate HARDCODED_PLATFORM_BY_CHAIN_ID boundaries.');
  }

  const local = new Map();
  const pairs = blockMatch[1].matchAll(/(\d+)\s*:\s*'([^']+)'/g);
  for (const match of pairs) {
    local.set(Number(match[1]), match[2]);
  }

  return {
    start: objectStart + 1,
    end: objectEnd,
    local,
  };
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
  const parsed = parseLocalHardcodedMap(resolverContent);

  let marketChainIds;
  try {
    marketChainIds = await loadMarketChainIds();
  } catch (error) {
    if (!isCiMarkets403(error)) throw error;
    marketChainIds = Array.from(parsed.local.keys()).sort((a, b) => a - b);
    console.warn(
      'Warning: /markets returned 403 in CI. Falling back to local HARDCODED_PLATFORM_BY_CHAIN_ID chainIds.'
    );
  }

  if (marketChainIds.length === 0) {
    throw new Error('No chainId found from /markets payload.');
  }

  const next = new Map(parsed.local);
  let additions = 0;

  for (const chainId of marketChainIds) {
    if (next.has(chainId)) continue;
    const platformId = coingeckoMap.get(chainId);
    if (!platformId) continue;
    next.set(chainId, platformId);
    additions += 1;
  }

  if (additions === 0) {
    console.log('HARDCODED_PLATFORM_BY_CHAIN_ID already covers all market chainIds with CoinGecko platform ids.');
    return;
  }

  const orderedEntries = Array.from(next.entries()).sort((a, b) => a[0] - b[0]);
  const rebuilt = `\n${orderedEntries.map(([k, v]) => `  ${k}: '${v}',`).join('\n')}\n`;
  const nextContent = `${resolverContent.slice(0, parsed.start)}${rebuilt}${resolverContent.slice(parsed.end)}`;
  await writeFile(LOCAL_RESOLVER_PATH, nextContent, 'utf8');

  console.log(
    `Updated HARDCODED_PLATFORM_BY_CHAIN_ID with ${additions} entries (markets chainIds: ${marketChainIds.length}).`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
