#!/usr/bin/env node
/**
 * Syncs missing token icons into public/icons/tokens/.
 * Candidate symbols are derived from resources this repo actually consumes:
 * - reservePatches.ts (upstream interface sync target)
 * - SYMBOL_MAP in reservePatches.ts
 * - runtime /markets token symbols resolved through the same mapping rules
 *
 * Download order (per symbol): aave/interface public/icons/tokens → CoinGecko → logoURI.
 *
 * Usage: node scripts/sync-token-icons.mjs [--check]
 *   Default: fetch and write missing icons.
 *   --check: do not write files; exit 1 when syncable icons are missing.
 *   --extra-only: deprecated and ignored (kept for backwards compatibility).
 *   SKIP_SYNC_TOKEN_ICONS=1: no-op.
 *
 * Env:
 *   INTERFACE_TOKEN_ICONS_BASE — override static token icon base (default: raw GitHub main branch).
 *   LIVE_TEST_API_BASE_CI / VITE_API_BASE_URL — /markets base resolution (same order as sync-coingecko-platform-map.mjs;
 *     see docs/conventions/api-base-urls.md). Default list ends with staging then production.
 *   SYNC_TOKEN_ICONS_MARKETS_API — comma-separated full /markets URLs; if set, those URLs are tried first, then staging.
 *   SYNC_TOKEN_ICONS_DEBUG_URLS=1 — log every /markets retry and append origin+path (still omits query); default logs only the last failed attempt per endpoint.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as addressBook from '@aave-dao/aave-address-book';
import {
  DEFAULT_PRODUCTION_API_BASE,
  DEFAULT_STAGING_API_BASE,
} from './lib/default-api-bases.mjs';
import { safeUrlForLog } from './lib/fetch-utils.mjs';
import {
  collectRequiredIconSymbols,
  collectIconSymbolLogoHints,
  getReservePatchesPath,
  toSortedArray,
} from './lib/token-icon-symbols.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TOKENS_DIR = path.join(ROOT, 'public', 'icons', 'tokens');
const RESERVE_PATCHES_PATH = getReservePatchesPath(ROOT);
const COINGECKO_SEARCH = 'https://api.coingecko.com/api/v3/search';
const INTERFACE_TOKEN_ICONS_BASE = String(
  process.env.INTERFACE_TOKEN_ICONS_BASE ||
    'https://raw.githubusercontent.com/aave/interface/main/public/icons/tokens'
).replace(/\/$/, '');
/** Prefer vector first (matches upstream layout). */
const INTERFACE_ICON_EXTENSIONS = ['svg', 'png', 'webp', 'jpg'];
const MARKETS_RETRY_COUNT = 2;
const MARKETS_RETRY_DELAY_MS = 3000;
const RATE_LIMIT_MS = 1500;

function normalizeApiBase(value) {
  if (typeof value !== 'string') return '';
  const t = value.trim();
  if (!t) return '';
  return t.replace(/\/+$/, '');
}

function marketsUrlFromBase(base) {
  const b = normalizeApiBase(base);
  return b ? `${b}/markets` : '';
}

/**
 * Same priority as getApiBase() in sync-coingecko-platform-map.mjs, plus production as last resort.
 */
function getDefaultMarketsUrls() {
  const urls = [];
  const seen = new Set();
  const push = (u) => {
    if (!u || seen.has(u)) return;
    seen.add(u);
    urls.push(u);
  };
  push(marketsUrlFromBase(process.env.LIVE_TEST_API_BASE_CI));
  push(marketsUrlFromBase(process.env.VITE_API_BASE_URL));
  push(`${DEFAULT_STAGING_API_BASE}/markets`);
  push(`${DEFAULT_PRODUCTION_API_BASE}/markets`);
  return urls;
}

function getMarketsUrlsToTry() {
  const explicit = process.env.SYNC_TOKEN_ICONS_MARKETS_API;
  if (explicit && explicit.trim()) {
    const fromEnv = [...new Set(explicit.split(',').map((s) => s.trim()).filter(Boolean))];
    const stagingMarkets = `${DEFAULT_STAGING_API_BASE}/markets`;
    if (!fromEnv.includes(stagingMarkets)) {
      fromEnv.push(stagingMarkets);
    }
    return fromEnv;
  }
  return getDefaultMarketsUrls();
}

/** Short label for logs — avoids printing full custom/Railway URLs in CI. */
function labelMarketsEndpoint(url, urlIndex) {
  const fromCi = marketsUrlFromBase(process.env.LIVE_TEST_API_BASE_CI);
  const fromVite = marketsUrlFromBase(process.env.VITE_API_BASE_URL);
  if (fromCi && url === fromCi) return 'LIVE_TEST_API_BASE_CI';
  if (fromVite && url === fromVite) return 'VITE_API_BASE_URL';
  if (url === `${DEFAULT_STAGING_API_BASE}/markets`) return 'staging (default fallback)';
  if (url === `${DEFAULT_PRODUCTION_API_BASE}/markets`) return 'production (default fallback)';
  if (process.env.SYNC_TOKEN_ICONS_MARKETS_API?.trim()) {
    return `SYNC_TOKEN_ICONS_MARKETS_API[${urlIndex}]`;
  }
  return `custom[${urlIndex}]`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function* interfaceTokenCandidateUrls(symbol) {
  const key = String(symbol || '').trim().toLowerCase();
  if (!key) return;
  for (const ext of INTERFACE_ICON_EXTENSIONS) {
    yield `${INTERFACE_TOKEN_ICONS_BASE}/${key}.${ext}`;
  }
}

/**
 * True if aave/interface hosts a static file for this icon key (HEAD, with GET fallback).
 */
async function hasInterfaceTokenIcon(symbol) {
  for (const url of interfaceTokenCandidateUrls(symbol)) {
    try {
      let res = await fetch(url, { method: 'HEAD' });
      if (res.ok) return true;
      if (res.status === 404) continue;
      res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // try next extension
    }
  }
  return false;
}

/**
 * Download first matching file from interface static tokens dir; returns output path or null.
 */
async function trySyncFromInterface(symbol, basePathWithoutExt) {
  for (const url of interfaceTokenCandidateUrls(symbol)) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const pathExt = inferExtensionFromUrl(url);
      const outExt = inferExtensionFromContentType(res.headers.get('content-type'), pathExt);
      const outPath = `${basePathWithoutExt}.${outExt}`;
      fs.writeFileSync(outPath, buf);
      return outPath;
    } catch {
      // try next extension
    }
  }
  return null;
}

function getExistingIconBaseSet() {
  const files = fs.existsSync(TOKENS_DIR) ? fs.readdirSync(TOKENS_DIR) : [];
  return new Set(files.map((f) => path.basename(f, path.extname(f)).toLowerCase()));
}

async function fetchMarketsFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.url = url;
    throw err;
  }
  const payload = await res.json();
  const rows = Array.isArray(payload?.reserves) ? payload.reserves
    : Array.isArray(payload?.data) ? payload.data
    : null;
  if (!rows) {
    const err = new Error('response missing reserves/data array');
    err.url = url;
    throw err;
  }
  return rows;
}

async function loadMarketsRows() {
  const urls = getMarketsUrlsToTry();

  for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
    const url = urls[urlIndex];
    const label = labelMarketsEndpoint(url, urlIndex);
    for (let attempt = 1; attempt <= MARKETS_RETRY_COUNT; attempt++) {
      try {
        const rows = await fetchMarketsFromUrl(url);
        if (attempt > 1 || urlIndex > 0) {
          console.log(`markets API OK: ${label} (${urlIndex + 1}/${urls.length}, attempt ${attempt})`);
        }
        return { rows, unavailable: false };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const debugUrls = process.env.SYNC_TOKEN_ICONS_DEBUG_URLS === '1';
        if (debugUrls || attempt === MARKETS_RETRY_COUNT) {
          const where = debugUrls ? ` ${safeUrlForLog(url)}` : '';
          console.warn(
            `markets API ${label}${where} (${urlIndex + 1}/${urls.length}) attempt ${attempt}/${MARKETS_RETRY_COUNT} failed: ${msg}`
          );
        }
        if (attempt < MARKETS_RETRY_COUNT) {
          await sleep(MARKETS_RETRY_DELAY_MS);
        }
      }
    }
  }

  throw new Error(`all markets API endpoints exhausted (tried ${urls.length} base(s))`);
}

async function getMissingSymbols() {
  const reservePatchesContent = fs.readFileSync(RESERVE_PATCHES_PATH, 'utf8');
  const { rows: marketsRows } = await loadMarketsRows();

  const requiredSymbols = collectRequiredIconSymbols({
    reservePatchesContent,
    marketsRows,
    tokenListSymbols: [],
    addressBookContext: addressBook,
  });
  const logoHints = collectIconSymbolLogoHints({
    reservePatchesContent,
    marketsRows,
    addressBookContext: addressBook,
    tokenLogoByAddress: new Map(),
  });

  const existing = getExistingIconBaseSet();
  const requiredArray = toSortedArray(requiredSymbols);
  const missing = requiredArray.filter((symbol) => !existing.has(symbol));
  const orphaned = [...existing].filter((s) => !requiredSymbols.has(s) && s !== 'default').sort();
  return { missing, orphaned, logoHints };
}

async function fetchCoingeckoImageUrl(symbol) {
  const res = await fetch(`${COINGECKO_SEARCH}?query=${encodeURIComponent(symbol)}`);
  if (!res.ok) return null;

  const data = await res.json();
  const coins = data?.coins;
  if (!Array.isArray(coins) || coins.length === 0) return null;

  const normalized = symbol.trim().toLowerCase().replace(/\s+/g, '');
  const exact = coins.find(
    (coin) => String(coin?.symbol || '').toLowerCase().replace(/\s+/g, '') === normalized
  );
  if (!exact) return null;

  return exact.large ?? exact.thumb ?? null;
}

function inferExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.svg')) return 'svg';
    if (pathname.endsWith('.webp')) return 'webp';
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'jpg';
    if (pathname.endsWith('.png')) return 'png';
  } catch {
    // ignore malformed URL and fall back to default
  }
  return 'png';
}

function inferExtensionFromContentType(contentType, fallback = 'png') {
  const normalized = String(contentType || '').toLowerCase();
  if (normalized.includes('image/svg+xml')) return 'svg';
  if (normalized.includes('image/webp')) return 'webp';
  if (normalized.includes('image/jpeg')) return 'jpg';
  if (normalized.includes('image/png')) return 'png';
  return fallback;
}

async function downloadToFile(url, basePathWithoutExt) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = inferExtensionFromContentType(
    res.headers.get('content-type'),
    inferExtensionFromUrl(url)
  );
  const outPath = `${basePathWithoutExt}.${ext}`;
  fs.writeFileSync(outPath, buf);
  return outPath;
}

async function classifyMissingSymbols(missingSymbols, logoHints) {
  const syncableFromInterface = [];
  const syncableFromCoingecko = [];
  const syncableFromLogo = [];
  const unsyncable = [];
  let coingeckoCallIndex = 0;

  for (const symbol of missingSymbols) {
    if (await hasInterfaceTokenIcon(symbol)) {
      syncableFromInterface.push(symbol);
      continue;
    }
    if (coingeckoCallIndex > 0) await sleep(RATE_LIMIT_MS);
    const imageUrl = await fetchCoingeckoImageUrl(symbol);
    coingeckoCallIndex += 1;
    if (imageUrl) {
      syncableFromCoingecko.push(symbol);
    } else if (logoHints.has(symbol)) {
      syncableFromLogo.push(symbol);
    } else {
      unsyncable.push(symbol);
    }
  }

  return { syncableFromInterface, syncableFromCoingecko, syncableFromLogo, unsyncable };
}

async function main() {
  if (process.env.SKIP_SYNC_TOKEN_ICONS === '1') {
    console.log('SKIP_SYNC_TOKEN_ICONS=1, skipping.');
    return;
  }

  const checkOnly = process.argv.includes('--check');
  const extraOnly = process.argv.includes('--extra-only');
  if (extraOnly) {
    console.warn('--extra-only is deprecated and ignored. Symbols are now derived from used interface resources.');
  }

  const { missing, orphaned, logoHints } = await getMissingSymbols();

  if (orphaned.length > 0) {
    console.warn(
      `Orphaned token icons (local but not in API): ${orphaned.join(', ')} (${orphaned.length})`
    );
  }

  if (missing.length === 0) {
    console.log('No missing token icons.');
    return;
  }

  if (checkOnly) {
    const {
      syncableFromInterface,
      syncableFromCoingecko,
      syncableFromLogo,
      unsyncable,
    } = await classifyMissingSymbols(missing, logoHints);

    if (unsyncable.length > 0) {
      console.warn(
        `Unsyncable token icons (no aave/interface file, no exact CoinGecko symbol match, and no logoURI): ${unsyncable.join(', ')}`
      );
    }

    const syncableStatic = [...syncableFromInterface, ...syncableFromCoingecko];
    if (syncableStatic.length > 0) {
      if (syncableFromInterface.length > 0) {
        console.error(
          `Missing ${syncableFromInterface.length} token icon(s) available on aave/interface: ${syncableFromInterface.join(', ')}`
        );
      }
      if (syncableFromCoingecko.length > 0) {
        console.error(
          `Missing ${syncableFromCoingecko.length} token icon(s) available via CoinGecko: ${syncableFromCoingecko.join(', ')}`
        );
      }
      process.exit(1);
    }

    if (syncableFromLogo.length > 0) {
      console.error(
        `Missing ${syncableFromLogo.length} logoURI-backed token icon(s): ${syncableFromLogo.join(', ')}`
      );
      process.exit(1);
    }

    console.log('No missing syncable token icons.');
    return;
  }

  console.log(
    `Fetching ${missing.length} missing icon(s) (aave/interface → CoinGecko → logoURI)...`
  );
  const unresolved = [];
  let coingeckoCallIndex = 0;

  for (const symbol of missing) {
    try {
      const ifacePath = await trySyncFromInterface(symbol, path.join(TOKENS_DIR, symbol));
      if (ifacePath) {
        console.log(`  saved ${symbol} (interface) -> ${path.relative(ROOT, ifacePath)}`);
        continue;
      }

      if (coingeckoCallIndex > 0) await sleep(RATE_LIMIT_MS);
      const imageUrl = await fetchCoingeckoImageUrl(symbol);
      coingeckoCallIndex += 1;
      const fallbackLogoUrl = logoHints.get(symbol);
      const sourceUrl = imageUrl || fallbackLogoUrl;
      if (!sourceUrl) {
        unresolved.push(symbol);
        console.warn(
          `  skip ${symbol}: no interface file, no exact CoinGecko symbol match, and no logoURI fallback`
        );
        continue;
      }

      const outPath = await downloadToFile(sourceUrl, path.join(TOKENS_DIR, symbol));
      const sourceLabel = imageUrl ? 'coingecko' : 'logoURI';
      console.log(`  saved ${symbol} (${sourceLabel}) -> ${path.relative(ROOT, outPath)}`);
    } catch (error) {
      unresolved.push(symbol);
      console.warn(`  error ${symbol}:`, error instanceof Error ? error.message : String(error));
    }
  }

  if (unresolved.length > 0) {
    console.warn(`Unresolved token icons: ${unresolved.join(', ')}`);
  }

  console.log('Done. Commit new files so users get icons from static assets.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
