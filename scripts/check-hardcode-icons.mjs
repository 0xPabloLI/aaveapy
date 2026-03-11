#!/usr/bin/env node
import { readFile, readdir, access } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESERVE_PATCHES_PATH = path.join(ROOT, 'src', 'ui-config', 'reservePatches.ts');
const TOKEN_ICONS_DIR = path.join(ROOT, 'public', 'icons', 'tokens');
const ALLOWED_EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg'];
const KNOWN_MISSING_ICON_SYMBOLS = new Set([
  'bpt_bal_weth',
  'bpt_wbtc_weth',
  'uni_aave_weth',
  'uni_bat_weth',
  'uni_btc_usdc',
  'uni_crv_weth',
  'uni_dai_usdc',
  'uni_dai_weth',
  'uni_link_weth',
  'uni_mkr_weth',
  'uni_ren_weth',
  'uni_snx_weth',
  'uni_uni_weth',
  'uni_usdc_weth',
  'uni_wbtc_weth',
  'uni_yfi_weth',
  'wxlp',
]);

function extractIconSymbols(content) {
  const symbols = new Set();
  const regex = /iconSymbol:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const value = String(match[1] || '').trim();
    if (value) symbols.add(value.toLowerCase());
  }
  return Array.from(symbols).sort();
}

async function buildIconBaseNameSet(directory) {
  await access(directory);
  const files = await readdir(directory);
  const bases = new Set();
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) continue;
    const base = path.basename(file, ext).toLowerCase();
    bases.add(base);
  }
  return bases;
}

async function main() {
  const reservePatchesContent = await readFile(RESERVE_PATCHES_PATH, 'utf8');
  const iconSymbols = extractIconSymbols(reservePatchesContent);
  const iconBaseNameSet = await buildIconBaseNameSet(TOKEN_ICONS_DIR);

  const missing = iconSymbols.filter(
    (symbol) => !iconBaseNameSet.has(symbol) && !KNOWN_MISSING_ICON_SYMBOLS.has(symbol)
  );
  console.log(`Found ${iconSymbols.length} iconSymbol entries in reservePatches.`);
  console.log(`Found ${iconBaseNameSet.size} local token icon base names.`);
  console.log(`Known missing allowlist size: ${KNOWN_MISSING_ICON_SYMBOLS.size}.`);

  if (missing.length > 0) {
    console.error('\nMissing token icon files for iconSymbol:');
    for (const symbol of missing) {
      console.error(`- ${symbol}`);
    }
    process.exit(1);
  }

  console.log('No missing iconSymbol token icons.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
