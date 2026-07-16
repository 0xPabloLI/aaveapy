#!/usr/bin/env node
/**
 * CI check + auto-write: Detect new mainnet chains in @aave-dao/aave-address-book
 * that are NOT registered in chainRegistry.ts.
 *
 * V3 modules have POOL; V4 modules have SPOKES/HUBS (no POOL).
 *
 * Usage:
 *   node scripts/check-chain-registry-upstream.mjs           # check-only (exit 1 if gaps)
 *   node scripts/check-chain-registry-upstream.mjs --write    # auto-generate entries + write files
 *
 * RPC URLs are sourced from aave/interface networksConfig.ts (same upstream used
 * by sync-chain-icon-map-upstream.mjs). Fallback: copy from existing entry
 * with same chainId. If neither available, entry gets publicRpcUrls: [] and
 * runtime chainDiscovery (wagmi/chains, chainid.network, chainlist.org) handles it.
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithTimeout, countChar } from './lib/fetch-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const registrySrcPath = path.join(repoRoot, 'src/lib/chainRegistry.ts');
const v4ClientSrcPath = path.join(repoRoot, 'src/lib/userData/aaveV4UserClient.ts');

const REMOTE_NETWORKS_CONFIG_URL =
  'https://raw.githubusercontent.com/aave/interface/main/src/ui-config/networksConfig.ts';

const isWriteMode = process.argv.includes('--write');

// ---------------------------------------------------------------------------
// Module filtering
// ---------------------------------------------------------------------------

const ENTRIES_REGEX = /abModule:\s+(AaveV\d[A-Za-z]+)/g;

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
// Fetch upstream networksConfig.ts and parse RPC URLs + wagmi chain names
// ---------------------------------------------------------------------------

function parseNetworksConfig(content) {
  const prodStart = content.indexOf('export const prodNetworkConfig');
  if (prodStart < 0) throw new Error('Failed to locate prodNetworkConfig');
  const body = content.slice(prodStart);
  const lines = body.split('\n');

  const result = new Map();
  let depth = 0, started = false, inBlock = false, blockDepth = 0, current = null;

  for (const line of lines) {
    const opens = countChar(line, '{');
    const closes = countChar(line, '}');

    if (!started && opens > 0) started = true;
    if (started) {
      depth += opens - closes;
      if (depth <= 0) break;
    }

    if (!inBlock) {
      const start = line.match(/^\s*\[(?:ChainId\.[a-zA-Z0-9_]+|[a-zA-Z0-9_]+\.id)\]:\s*\{/);
      if (!start) continue;
      inBlock = true;
      blockDepth = 1;
      current = { name: null, rpcUrls: [], wagmiChain: null };
      continue;
    }

    if (blockDepth === 1) {
      const nameMatch = line.match(/^\s*name:\s*'([^']+)'/);
      if (nameMatch) current.name = nameMatch[1];

      const wagmiMatch = line.match(/wagmiChain:\s*([a-zA-Z0-9_]+)/);
      if (wagmiMatch) current.wagmiChain = wagmiMatch[1];

      if (line.includes('publicJsonRPCUrl') || (current.rpcUrls.length > 0 && line.includes("'") && !line.includes(':'))) {
        const urls = line.match(/'([^']+)'/g);
        if (urls) for (const u of urls) current.rpcUrls.push(u.replace(/'/g, ''));
      }
    }

    blockDepth += opens - closes;
    if (blockDepth <= 0) {
      inBlock = false;
      blockDepth = 0;
      if (current?.wagmiChain) result.set(current.wagmiChain, current);
      current = null;
    }
  }

  return result;
}

async function fetchUpstreamNetworks() {
  try {
    const content = await fetchWithTimeout(REMOTE_NETWORKS_CONFIG_URL, 15000, 2);
    return parseNetworksConfig(content);
  } catch (err) {
    console.warn('⚠️  Could not fetch upstream networksConfig.ts:', err?.message ?? err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// wagmi chain name resolution
// ---------------------------------------------------------------------------

function findWagmiChainNameForChainId(registryContent, ab, chainId) {
  const entryPattern = /abModule:\s+(AaveV\d[A-Za-z]+),\s*wagmiChain:\s*(\w+)/g;
  let match;
  while ((match = entryPattern.exec(registryContent)) !== null) {
    const mod = ab[match[1]];
    if (mod && mod.CHAIN_ID === chainId) return match[2];
  }
  return null;
}

function findRpcUrlsFromRegistry(registryContent, ab, chainId) {
  const entryPattern = /abModule:\s+(AaveV\d[A-Za-z]+),\s*wagmiChain:\s*\w+,\s*publicRpcUrls:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = entryPattern.exec(registryContent)) !== null) {
    if (ab[m[1]] && ab[m[1]].CHAIN_ID === chainId) {
      const urls = m[2].match(/'([^']+)'/g);
      if (urls) return urls.map((u) => u.replace(/'/g, ''));
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

function generateRegistryEntry(moduleName, wagmiChainName, rpcUrls, version) {
  const rpcArray = rpcUrls.length > 0
    ? `[${rpcUrls.map((u) => `'${u}'`).join(', ')}]`
    : `[]`;
  return `  { abModule: ${moduleName}, wagmiChain: ${wagmiChainName}, publicRpcUrls: ${rpcArray}, version: '${version}' },`;
}

function generateV4SpokeEntry(moduleName) {
  return [
    `  [${moduleName}.CHAIN_ID]: Object.entries(${moduleName}.SPOKES)`,
    `    .filter(([name]) => !name.endsWith('_ORACLE') && name !== 'TREASURY_SPOKE')`,
    `    .map(([name, address]) => ({ name, address: address as \`0x\${string}\` })),`,
  ];
}

function generateV4HubEntry(moduleName) {
  return [
    `  [${moduleName}.CHAIN_ID]: Object.entries(${moduleName}.HUBS)`,
    `    .map(([name, address]) => ({ name, address: address as \`0x\${string}\` })),`,
  ];
}

// ---------------------------------------------------------------------------
// Line-based file editors
// ---------------------------------------------------------------------------

/**
 * Find the index of the first line matching `^\s*}` after a given start marker.
 * This robustly finds the closing brace of an object literal.
 */
function findClosingBraceAfter(lines, marker) {
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(marker)) { found = true; continue; }
    if (found && /^\s*\}/.test(lines[i])) return i;
  }
  return -1;
}

/**
 * Add a name to an import block: `import { ... } from 'pkg'`
 * Handles both single-line and multi-line imports.
 */
function addImportName(lines, pkg, name) {
  // Check if already imported
  const importRegex = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'${pkg.replace(/\//g, '\\/')}'`);
  const fullText = lines.join('\n');
  const importMatch = fullText.match(importRegex);
  if (importMatch && importMatch[1].includes(name)) return { lines, ok: true }; // already there

  // Find the import line(s)
  const importLineIdx = lines.findIndex((l) => l.includes(`from '${pkg}'`));
  if (importLineIdx < 0) return { lines, ok: false };

  // Single-line import: `import { A, B } from 'pkg'`
  if (lines[importLineIdx].includes('import {')) {
    const singleLineMatch = lines[importLineIdx].match(/import\s*\{([^}]*)\}\s*from/);
    if (singleLineMatch) {
      const existing = singleLineMatch[1].trim();
      // Convert to multi-line for consistency
      const names = existing.split(',').map((n) => n.trim()).filter(Boolean);
      names.push(name);
      const newImportBlock = [
        'import {',
        ...names.map((n) => `  ${n},`),
        `} from '${pkg}'`,
      ];
      lines.splice(importLineIdx, 1, ...newImportBlock);
      return { lines, ok: true };
    }
  }

  // Multi-line import: find the `}` line between `import {` and `from 'pkg'`
  let braceStart = importLineIdx;
  while (braceStart >= 0 && !lines[braceStart].includes('import {')) braceStart--;
  if (braceStart < 0) return { lines, ok: false };

  // Find `}` line between braceStart and importLineIdx
  for (let i = braceStart; i <= importLineIdx; i++) {
    if (lines[i].includes('}')) {
      lines.splice(i, 0, `  ${name},`);
      return { lines, ok: true };
    }
  }

  return { lines, ok: false };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const registryContent = readFileSync(registrySrcPath, 'utf8');
  const v4ClientContent = readFileSync(v4ClientSrcPath, 'utf8');

  // Extract registered module names
  const registeredModules = new Set();
  for (const match of registryContent.matchAll(ENTRIES_REGEX)) {
    registeredModules.add(match[1]);
  }

  // Discover all V3/V4 mainnet modules in the address book
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

  const unregistered = mainnetChains.filter((m) => !registeredModules.has(m));

  if (unregistered.length === 0) {
    console.log(`✅ All ${mainnetChains.length} mainnet chains are registered in chainRegistry.ts`);
    return;
  }

  console.error('⚠️  New mainnet Aave chain(s) detected in @aave-dao/aave-address-book:');
  for (const mod of unregistered) {
    const chainId = ab[mod]?.CHAIN_ID ?? 'unknown';
    const hasPool = typeof ab[mod]?.POOL === 'string';
    const version = mod.startsWith('AaveV4') ? 'V4' : 'V3';
    console.error(`  - ${mod} (chainId: ${chainId}, ${version}${hasPool ? ' pool' : ' hub/spoke'})`);
  }

  if (!isWriteMode) {
    console.error('');
    console.error('To auto-fix: node scripts/check-chain-registry-upstream.mjs --write');
    console.error('To fix manually: Add entries to ENTRIES in src/lib/chainRegistry.ts');
    process.exit(1);
  }

  // ---- --write mode ----

  console.log('\n📝 --write mode: auto-generating entries...\n');

  const upstreamNetworks = await fetchUpstreamNetworks();

  let regLines = registryContent.split('\n');
  let v4Lines = v4ClientContent.split('\n');
  let registryChanged = false;
  let v4ClientChanged = false;
  const newABImports = [];
  const newWagmiImports = new Set();

  for (const moduleName of unregistered) {
    const mod = ab[moduleName];
    const chainId = mod.CHAIN_ID;
    const isV4 = moduleName.startsWith('AaveV4');
    const version = isV4 ? 'v4' : 'v3';

    console.log(`  Processing ${moduleName} (chainId: ${chainId}, ${version})...`);

    // 1. Resolve wagmi chain name from existing entries with same chainId
    let wagmiChainName = findWagmiChainNameForChainId(registryContent, ab, chainId);

    if (!wagmiChainName) {
      console.error(`    ❌ Could not determine wagmi chain name for ${moduleName} (chainId: ${chainId})`);
      console.error(`       Please add manually.`);
      continue;
    }

    console.log(`    wagmiChain: ${wagmiChainName}`);

    // 2. Resolve RPC URLs: upstream → existing entry → empty
    let rpcUrls = [];

    if (upstreamNetworks) {
      const netConfig = upstreamNetworks.get(wagmiChainName);
      if (netConfig && netConfig.rpcUrls.length > 0) {
        rpcUrls = netConfig.rpcUrls;
        console.log(`    RPC URLs from networksConfig: ${rpcUrls.length} URLs`);
      }
    }

    if (rpcUrls.length === 0) {
      rpcUrls = findRpcUrlsFromRegistry(registryContent, ab, chainId);
      if (rpcUrls.length > 0) {
        console.log(`    RPC URLs from existing entry (same chainId): ${rpcUrls.length} URLs`);
      }
    }

    if (rpcUrls.length === 0) {
      console.log(`    RPC URLs: none found (using [] — runtime chainDiscovery handles)`);
    }

    // 3. Collect imports
    newABImports.push(moduleName);
    if (!registryContent.includes(`  ${wagmiChainName},`)) {
      newWagmiImports.add(wagmiChainName);
    }

    // 4. Insert ENTRIES line before `] as const`
    const entryLine = generateRegistryEntry(moduleName, wagmiChainName, rpcUrls, version);
    const entriesCloseIdx = regLines.findIndex((l) => l.includes('] as const'));
    if (entriesCloseIdx >= 0) {
      regLines.splice(entriesCloseIdx, 0, entryLine);
      registryChanged = true;
    }

    // 5. For V4: insert aaveV4UserClient.ts entries
    if (isV4) {
      // Add import
      const importResult = addImportName(v4Lines, '@aave-dao/aave-address-book', moduleName);
      if (importResult.ok) v4Lines = importResult.lines;

      // Insert SPOKE entry before closing } of V4_SPOKE_ADDRESSES
      const spokeCloseIdx = findClosingBraceAfter(v4Lines, 'V4_SPOKE_ADDRESSES');
      if (spokeCloseIdx >= 0) {
        const spokeEntry = generateV4SpokeEntry(moduleName);
        v4Lines.splice(spokeCloseIdx, 0, ...spokeEntry);
        v4ClientChanged = true;
      }

      // Insert HUB entry before closing } of V4_HUB_ADDRESSES
      const hubCloseIdx = findClosingBraceAfter(v4Lines, 'V4_HUB_ADDRESSES');
      if (hubCloseIdx >= 0) {
        const hubEntry = generateV4HubEntry(moduleName);
        v4Lines.splice(hubCloseIdx, 0, ...hubEntry);
        v4ClientChanged = true;
      }
    }

    console.log(`    ✅ Generated entry for ${moduleName}\n`);
  }

  // 6. Add imports to chainRegistry.ts
  if (registryChanged) {
    for (const imp of newABImports) {
      const r = addImportName(regLines, '@aave-dao/aave-address-book', imp);
      if (r.ok) regLines = r.lines;
    }
    for (const imp of newWagmiImports) {
      const r = addImportName(regLines, 'wagmi/chains', imp);
      if (r.ok) regLines = r.lines;
    }
  }

  // 7. Write files
  if (registryChanged) {
    writeFileSync(registrySrcPath, regLines.join('\n'), 'utf8');
    console.log(`✅ Updated ${path.relative(repoRoot, registrySrcPath)}`);
  }
  if (v4ClientChanged) {
    writeFileSync(v4ClientSrcPath, v4Lines.join('\n'), 'utf8');
    console.log(`✅ Updated ${path.relative(repoRoot, v4ClientSrcPath)}`);
  }

  if (!registryChanged && !v4ClientChanged) {
    console.log('\n⚠️  No changes were made. Check for errors above.');
    process.exit(1);
  }

  console.log('\n✅ Auto-registration complete. Review the changes and commit.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
