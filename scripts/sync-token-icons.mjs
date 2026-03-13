#!/usr/bin/env node
/**
 * Syncs missing token icons from CoinGecko into public/icons/tokens/.
 * Candidate symbols are derived from resources this repo actually consumes:
 * - reservePatches.ts (upstream interface sync target)
 * - SYMBOL_MAP in reservePatches.ts
 * - runtime /markets token symbols resolved through the same mapping rules
 *
 * Usage: node scripts/sync-token-icons.mjs [--check]
 *   Default: fetch and write missing icons.
 *   --check: do not write files; exit 1 when syncable icons are missing.
 *   --extra-only: deprecated and ignored (kept for backwards compatibility).
 *   SKIP_SYNC_TOKEN_ICONS=1: no-op.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as addressBook from '@bgd-labs/aave-address-book';
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
const TOKENLIST_PATH = path.join(
  ROOT,
  'node_modules',
  '@bgd-labs',
  'aave-address-book',
  'tokenlist.json'
);
const COINGECKO_SEARCH = 'https://api.coingecko.com/api/v3/search';
const MARKETS_API_URL = process.env.SYNC_TOKEN_ICONS_MARKETS_API || 'https://api.aaveapy.com/api/markets';
const RATE_LIMIT_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getExistingIconBaseSet() {
  const files = fs.existsSync(TOKENS_DIR) ? fs.readdirSync(TOKENS_DIR) : [];
  return new Set(files.map((f) => path.basename(f, path.extname(f)).toLowerCase()));
}

function loadTokenLogoByAddress() {
  if (!fs.existsSync(TOKENLIST_PATH)) {
    return new Map();
  }

  const payload = JSON.parse(fs.readFileSync(TOKENLIST_PATH, 'utf8'));
  const rows = Array.isArray(payload?.tokens) ? payload.tokens : [];
  const map = new Map();

  for (const row of rows) {
    const address = String(row?.address || '').trim().toLowerCase();
    const logoURI = String(row?.logoURI || '').trim();
    if (!address || !logoURI) continue;
    map.set(address, logoURI);
  }

  return map;
}

async function loadMarketsRows() {
  try {
    const res = await fetch(MARKETS_API_URL);
    if (!res.ok) {
      console.warn(`markets API returned HTTP ${res.status}, continuing with reservePatches-only symbols`);
      return [];
    }

    const payload = await res.json();
    return Array.isArray(payload?.data) ? payload.data : [];
  } catch (error) {
    console.warn(
      `failed to load markets API symbols from ${MARKETS_API_URL}, continuing with reservePatches-only symbols:`,
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

async function getMissingSymbols() {
  const reservePatchesContent = fs.readFileSync(RESERVE_PATCHES_PATH, 'utf8');
  const marketsRows = await loadMarketsRows();
  const tokenLogoByAddress = loadTokenLogoByAddress();

  const requiredSymbols = collectRequiredIconSymbols({
    reservePatchesContent,
    marketsRows,
    addressBookContext: addressBook,
  });
  const logoHints = collectIconSymbolLogoHints({
    reservePatchesContent,
    marketsRows,
    addressBookContext: addressBook,
    tokenLogoByAddress,
  });

  const existing = getExistingIconBaseSet();
  const missing = toSortedArray(requiredSymbols).filter((symbol) => !existing.has(symbol));
  return { missing, logoHints };
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
  const syncable = [];
  const unsyncable = [];
  const syncableFromLogo = [];

  for (let i = 0; i < missingSymbols.length; i++) {
    const symbol = missingSymbols[i];
    await sleep(i > 0 ? RATE_LIMIT_MS : 0);
    const imageUrl = await fetchCoingeckoImageUrl(symbol);
    if (imageUrl) {
      syncable.push(symbol);
    } else if (logoHints.has(symbol)) {
      syncableFromLogo.push(symbol);
    } else {
      unsyncable.push(symbol);
    }
  }

  return { syncable, syncableFromLogo, unsyncable };
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

  const { missing, logoHints } = await getMissingSymbols();
  if (missing.length === 0) {
    console.log('No missing token icons.');
    return;
  }

  if (checkOnly) {
    const { syncable, syncableFromLogo, unsyncable } = await classifyMissingSymbols(
      missing,
      logoHints
    );

    if (unsyncable.length > 0) {
      console.warn(
        `Unsyncable token icons (no exact CoinGecko symbol match): ${unsyncable.join(', ')}`
      );
    }

    if (syncable.length > 0) {
      console.error(`Missing ${syncable.length} syncable token icon(s): ${syncable.join(', ')}`);
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

  console.log(`Fetching ${missing.length} missing icon(s) from CoinGecko...`);
  const unresolved = [];

  for (let i = 0; i < missing.length; i++) {
    const symbol = missing[i];
    try {
      await sleep(i > 0 ? RATE_LIMIT_MS : 0);
      const imageUrl = await fetchCoingeckoImageUrl(symbol);
      const fallbackLogoUrl = logoHints.get(symbol);
      const sourceUrl = imageUrl || fallbackLogoUrl;
      if (!sourceUrl) {
        unresolved.push(symbol);
        console.warn(`  skip ${symbol}: no exact CoinGecko symbol match and no logoURI fallback`);
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
