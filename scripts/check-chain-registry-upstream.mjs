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
import { discoverMainnetChainIds } from './lib/chain-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const registrySrcPath = path.join(repoRoot, 'src/lib/chainRegistry.ts');

// ---------------------------------------------------------------------------
// Parse CHAIN_RPC_URLS keys from chainRegistry.ts
// ---------------------------------------------------------------------------

const registryContent = readFileSync(registrySrcPath, 'utf8');

const rpcKeyRegex = /^\s*(\d+):\s*\[/gm;
const curatedChainIds = new Set();
let match;
while ((match = rpcKeyRegex.exec(registryContent)) !== null) {
  curatedChainIds.add(Number(match[1]));
}

// ---------------------------------------------------------------------------
// Discover all mainnet chains from address book (shared utility)
// ---------------------------------------------------------------------------

const allChainIds = await discoverMainnetChainIds();

// Check for chains without curated RPC URLs
const missingRpc = [...allChainIds].filter((id) => !curatedChainIds.has(id));

if (missingRpc.length > 0) {
  console.warn('⚠️  Chains without curated RPC URLs in CHAIN_RPC_URLS:');
  for (const chainId of missingRpc) {
    console.warn(`  - chainId ${chainId} — runtime chainDiscovery will handle`);
  }
  console.warn('');
  console.warn('These chains still work — runtime chainDiscovery provides RPC URLs.');
  console.warn('To add curated URLs: add an entry to CHAIN_RPC_URLS in src/lib/chainRegistry.ts');
} else {
  console.log(`✅ All ${allChainIds.size} mainnet chains have curated RPC URLs`);
}

console.log(`✅ ${allChainIds.size} unique Aave chains discovered — auto-registered`);
