#!/usr/bin/env node
/**
 * CI check: warn when Aave chains discovered from @aave-dao/aave-address-book
 * lack curated RPC URLs in chainRegistry.ts CHAIN_RPC_URLS.
 *
 * Chain registration is now automatic (import * as ab in chainRegistry.ts).
 * This script only checks for missing curated RPC URLs — a quality signal,
 * not a gate. Chains without curated URLs still work via runtime chainDiscovery.
 *
 * Usage: node scripts/check-chain-registry-upstream.mjs
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const registrySrcPath = path.join(repoRoot, 'src/lib/chainRegistry.ts');

// ---------------------------------------------------------------------------
// Module filtering
// ---------------------------------------------------------------------------

const TESTNET_KEYWORDS = ['Sepolia', 'Fuji', 'Testnet'];
const BASE_MODULES = ['AaveV3', 'AaveV4'];
const SKIPPED_CHAINS = ['AaveV3Fantom', 'AaveV3Harmony'];
const ETHEREUM_SUB_POOLS = ['AaveV3EthereumEtherFi', 'AaveV3EthereumHorizon', 'AaveV3EthereumLido'];

function shouldIncludeModule(name) {
  if (BASE_MODULES.includes(name)) return false;
  if (TESTNET_KEYWORDS.some((kw) => name.includes(kw))) return false;
  if (SKIPPED_CHAINS.includes(name)) return false;
  if (ETHEREUM_SUB_POOLS.includes(name)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Parse CHAIN_RPC_URLS keys from chainRegistry.ts
// ---------------------------------------------------------------------------

const registryContent = readFileSync(registrySrcPath, 'utf8');

// Extract chainId keys from the CHAIN_RPC_URLS map
const rpcKeyRegex = /^\s*(\d+):\s*\[/gm;
const curatedChainIds = new Set();
let match;
while ((match = rpcKeyRegex.exec(registryContent)) !== null) {
  curatedChainIds.add(Number(match[1]));
}

// ---------------------------------------------------------------------------
// Discover all mainnet chains from address book
// ---------------------------------------------------------------------------

const ab = await import('@aave-dao/aave-address-book');

const allModules = Object.keys(ab).filter(
  (key) => (key.startsWith('AaveV3') || key.startsWith('AaveV4')) && shouldIncludeModule(key),
);

const mainnetChains = [];
for (const key of allModules) {
  const mod = ab[key];
  if (!mod || typeof mod.CHAIN_ID !== 'number') continue;
  if (typeof mod.POOL === 'string' && mod.POOL.startsWith('0x')) { mainnetChains.push(key); continue; }
  if (mod.SPOKES && typeof mod.SPOKES === 'object') { mainnetChains.push(key); continue; }
}

// Unique chainIds
const allChainIds = [...new Set(mainnetChains.map((m) => ab[m].CHAIN_ID))];

// Check for chains without curated RPC URLs
const missingRpc = allChainIds.filter((id) => !curatedChainIds.has(id));

if (missingRpc.length > 0) {
  console.warn('⚠️  Chains without curated RPC URLs in CHAIN_RPC_URLS:');
  for (const chainId of missingRpc) {
    const modules = mainnetChains.filter((m) => ab[m].CHAIN_ID === chainId);
    console.warn(`  - chainId ${chainId} (${modules.join(', ')}) — runtime chainDiscovery will handle`);
  }
  console.warn('');
  console.warn('These chains still work — runtime chainDiscovery provides RPC URLs.');
  console.warn('To add curated URLs: add an entry to CHAIN_RPC_URLS in src/lib/chainRegistry.ts');
  // Don't fail — this is informational only
} else {
  console.log(`✅ All ${allChainIds.length} mainnet chains have curated RPC URLs`);
}

console.log(`✅ ${mainnetChains.length} Aave modules discovered (${allChainIds.length} unique chains) — auto-registered`);
