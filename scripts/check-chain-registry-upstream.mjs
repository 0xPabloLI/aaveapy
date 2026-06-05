#!/usr/bin/env node
/**
 * CI check: Detect new mainnet pools in @aave-dao/aave-address-book that are
 * NOT registered in chainRegistry.ts.
 *
 * When Aave deploys to a new chain, this check fails so developers know to add
 * the chain to the registry (one place: chainRegistry.ts ENTRIES array).
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

// Regex to extract module names from ENTRIES array
const ENTRIES_REGEX = /abModule:\s+(AaveV\d[A-Za-z]+)/g;

// Known testnet/whitelabel modules to exclude
const TESTNET_KEYWORDS = ['Sepolia', 'Fuji', 'Testnet'];

// Base/abstract modules that are not pool deployments
const BASE_MODULES = ['AaveV3', 'AaveV4'];

// Chains we intentionally skip (deprecated, no mainnet activity)
const SKIPPED_CHAINS = ['AaveV3Fantom', 'AaveV3Harmony'];

// Ethereum sub-pools (EtherFi, Horizon, Lido) share chainId=1 and are
// not separate chain entries — they are covered by AaveV3Ethereum.
const ETHEREUM_SUB_POOLS = ['AaveV3EthereumEtherFi', 'AaveV3EthereumHorizon', 'AaveV3EthereumLido'];

function shouldIncludeModule(name) {
  if (BASE_MODULES.includes(name)) return false;
  if (TESTNET_KEYWORDS.some((kw) => name.includes(kw))) return false;
  if (SKIPPED_CHAINS.includes(name)) return false;
  if (ETHEREUM_SUB_POOLS.includes(name)) return false;
  return true;
}

// Extract module names currently registered
const registryContent = readFileSync(registrySrcPath, 'utf8');
const registeredModules = new Set();
for (const match of registryContent.matchAll(ENTRIES_REGEX)) {
  registeredModules.add(match[1]);
}

// Discover all V3/V4 mainnet modules in the address book
const ab = await import('@aave-dao/aave-address-book');
const allModules = Object.keys(ab).filter(
  (key) =>
    (key.startsWith('AaveV3') || key.startsWith('AaveV4')) &&
    shouldIncludeModule(key)
);

// Filter to only those with valid CHAIN_ID and POOL (actual pool deployments)
const mainnetPools = [];
for (const key of allModules) {
  const mod = ab[key];
  if (mod && typeof mod.CHAIN_ID === 'number' && typeof mod.POOL === 'string' && mod.POOL.startsWith('0x')) {
    mainnetPools.push(key);
  }
}

// Check for unregistered mainnet modules
const unregistered = mainnetPools.filter((m) => !registeredModules.has(m));

if (unregistered.length > 0) {
  console.error('⚠️  New mainnet Aave chain(s) detected in @aave-dao/aave-address-book:');
  console.error('');
  console.error('The following chains have pool deployments but are NOT in chainRegistry.ts:');
  for (const mod of unregistered) {
    const chainId = ab[mod]?.CHAIN_ID ?? 'unknown';
    console.error(`  - ${mod} (chainId: ${chainId})`);
  }
  console.error('');
  console.error('To fix: Add entries to the ENTRIES array in src/lib/chainRegistry.ts');
  process.exit(1);
}

console.log(`✅ All ${mainnetPools.length} mainnet chains are registered in chainRegistry.ts`);
