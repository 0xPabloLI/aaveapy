#!/usr/bin/env node
/**
 * Syncs missing token icons from CoinGecko into public/icons/tokens/.
 * Run periodically (e.g. after adding new markets) so users get icons from
 * static assets instead of hitting CoinGecko. Commit the new .png files.
 *
 * Usage: node scripts/sync-token-icons.mjs [--extra-only] [--check]
 *   Default: sync all missing symbols from aave tokenlist + EXTRA_SYMBOLS.
 *   --extra-only: only sync EXTRA_SYMBOLS (e.g. syrupusdc) that are missing (faster).
 *   --check: do not write files; exit 1 when any symbol is missing.
 *   SKIP_SYNC_TOKEN_ICONS=1: no-op (e.g. skip in CI if you commit icons).
 *
 * Run manually or in CI when you want to backfill icons into public/; normal users
 * cannot persist icons when opening the site (browser cannot write to repo).
 * Requires: Node 18+ (for fetch), and @bgd-labs/aave-address-book installed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TOKENS_DIR = path.join(ROOT, 'public', 'icons', 'tokens');
const COINGECKO_SEARCH = 'https://api.coingecko.com/api/v3/search';
const RATE_LIMIT_MS = 1500; // free tier ~10–30/min; 1.5s between requests

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getTokenListSymbols() {
  const tokenlistPath = path.join(
    ROOT,
    'node_modules',
    '@bgd-labs',
    'aave-address-book',
    'tokenlist.json'
  );
  if (!fs.existsSync(tokenlistPath)) {
    console.warn('tokenlist.json not found, using extra symbols only');
    return new Set();
  }
  const data = JSON.parse(fs.readFileSync(tokenlistPath, 'utf8'));
  const tokens = data?.tokens;
  if (!Array.isArray(tokens)) return new Set();
  const symbols = new Set(tokens.map((t) => (t.symbol || '').toLowerCase()).filter(Boolean));
  return symbols;
}

/** Icon symbols used in reservePatches / UI that may not be in tokenlist */
const EXTRA_SYMBOLS = ['syrupusdc'];

/**
 * @param {boolean} extraOnly - If true, only EXTRA_SYMBOLS; if false, tokenlist + EXTRA_SYMBOLS.
 */
function getMissingSymbols(extraOnly = false) {
  const fromList = extraOnly ? new Set() : getTokenListSymbols();
  const all = new Set([...fromList, ...EXTRA_SYMBOLS]);
  const missing = [];
  const files = fs.existsSync(TOKENS_DIR) ? fs.readdirSync(TOKENS_DIR) : [];
  const existingBase = new Set(
    files.map((f) => path.basename(f, path.extname(f)).toLowerCase())
  );
  for (const symbol of all) {
    const key = symbol.toLowerCase().trim();
    if (!key) continue;
    if (existingBase.has(key)) continue;
    const hasSvg = fs.existsSync(path.join(TOKENS_DIR, `${key}.svg`));
    const hasPng = fs.existsSync(path.join(TOKENS_DIR, `${key}.png`));
    if (hasSvg || hasPng) continue;
    missing.push(key);
  }
  return missing;
}

async function fetchCoingeckoImageUrl(symbol) {
  const res = await fetch(
    `${COINGECKO_SEARCH}?query=${encodeURIComponent(symbol)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const coins = data?.coins;
  if (!Array.isArray(coins) || coins.length === 0) return null;
  const normalized = symbol.trim().toLowerCase().replace(/\s+/g, '');
  const match =
    coins.find(
      (c) => (c.symbol || '').toLowerCase().replace(/\s+/g, '') === normalized
    ) ?? coins[0];
  return match?.large ?? match?.thumb ?? null;
}

async function downloadToFile(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
}

async function main() {
  if (process.env.SKIP_SYNC_TOKEN_ICONS === '1') {
    console.log('SKIP_SYNC_TOKEN_ICONS=1, skipping.');
    return;
  }
  const extraOnly = process.argv.includes('--extra-only');
  const checkOnly = process.argv.includes('--check');
  const missing = getMissingSymbols(extraOnly);
  if (!extraOnly) {
    console.log('Syncing all missing symbols from tokenlist + extra.');
  }
  if (missing.length === 0) {
    console.log('No missing token icons.');
    return;
  }
  if (checkOnly) {
    console.error(`Missing ${missing.length} token icon(s): ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`Fetching ${missing.length} missing icon(s) from CoinGecko...`);
  for (let i = 0; i < missing.length; i++) {
    const symbol = missing[i];
    try {
      await sleep(i > 0 ? RATE_LIMIT_MS : 0);
      const url = await fetchCoingeckoImageUrl(symbol);
      if (!url) {
        console.warn(`  skip ${symbol}: not found on CoinGecko`);
        continue;
      }
      const outPath = path.join(TOKENS_DIR, `${symbol}.png`);
      await downloadToFile(url, outPath);
      console.log(`  saved ${symbol} -> public/icons/tokens/${symbol}.png`);
    } catch (e) {
      console.warn(`  error ${symbol}:`, e.message);
    }
  }
  console.log('Done. Commit new files so users get icons from static assets.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
