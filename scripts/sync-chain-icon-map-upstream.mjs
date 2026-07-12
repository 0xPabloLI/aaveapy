#!/usr/bin/env node
/**
 * Checks chainIconMap.ts against upstream aave/interface networksConfig.ts
 * and @aave-dao/aave-address-book to detect missing chain icon entries.
 *
 * The chainIconMap is now indexed by chainId (number) and maintained manually.
 * This script reports when a chain exists in address-book but lacks an icon mapping.
 *
 * Usage: node scripts/sync-chain-icon-map-upstream.mjs [--write]
 *   Default: dry-run, report gaps only (exit 1 if gaps found).
 *   --write:  append placeholder entries for missing chains (for initial setup).
 */
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithTimeout, countChar } from './lib/fetch-utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REMOTE_NETWORKS_CONFIG_URL =
  'https://raw.githubusercontent.com/aave/interface/main/src/ui-config/networksConfig.ts';
const LOCAL_CHAIN_ICONS_PATH = path.join(ROOT, 'src/lib/chainIconMap.ts');

function parseExpectedProdNetworks(networksConfigContent) {
  const prodStart = networksConfigContent.indexOf('export const prodNetworkConfig');
  if (prodStart < 0) {
    throw new Error('Failed to locate prodNetworkConfig in networksConfig.ts');
  }
  const content = networksConfigContent.slice(prodStart);
  const lines = content.split('\n');

  const expected = [];
  let outerDepth = 0;
  let outerStarted = false;
  let inBlock = false;
  let depth = 0;
  let current = null;

  for (const line of lines) {
    const opens = countChar(line, '{');
    const closes = countChar(line, '}');
    if (!outerStarted && opens > 0) {
      outerStarted = true;
    }
    if (outerStarted) {
      outerDepth += opens;
      outerDepth -= closes;
      if (outerDepth <= 0) {
        if (inBlock) {
          depth += opens;
          depth -= closes;
          if (depth <= 0 && current?.name && current?.networkLogoPath && current?.wagmiChain) {
            expected.push(current);
          }
        }
        break;
      }
    }

    if (!inBlock) {
      const start = line.match(/^\s*\[(ChainId\.[a-zA-Z0-9_]+|[a-zA-Z0-9_]+\.id)\]:\s*\{/);
      if (!start) continue;
      inBlock = true;
      depth = 1;
      current = {
        key: start[1],
        name: null,
        networkLogoPath: null,
        wagmiChain: null,
      };
      continue;
    }

    if (depth === 1) {
      const nameMatch = line.match(/^\s*name:\s*'([^']+)'/);
      if (nameMatch) current.name = nameMatch[1];

      const logoMatch = line.match(/^\s*networkLogoPath:\s*'([^']+)'/);
      if (logoMatch) current.networkLogoPath = logoMatch[1];

      const wagmiMatch = line.match(/wagmiChain:\s*([a-zA-Z0-9_]+)/);
      if (wagmiMatch) current.wagmiChain = wagmiMatch[1];
    }

    depth += opens;
    depth -= closes;
    if (depth <= 0) {
      inBlock = false;
      depth = 0;
      if (current?.name && current?.networkLogoPath && current?.wagmiChain) {
        expected.push(current);
      }
      current = null;
    }
  }

  return expected;
}

function iconBaseFromPath(iconPath) {
  return path.basename(iconPath).replace(/\.[^.]+$/, '');
}

function parseChainIconMapEntries(fileContent) {
  const match = fileContent.match(
    /export const chainIconMap:\s*Record<number,\s*string>\s*=\s*\{([\s\S]*?)\};/
  );
  if (!match || match.index == null) {
    throw new Error('Failed to parse chainIconMap in src/lib/chainIconMap.ts');
  }

  const entries = new Map();
  const entryMatches = match[1].matchAll(/(\d+)\s*:\s*'([^']+)'/g);
  for (const m of entryMatches) {
    entries.set(Number(m[1]), m[2]);
  }

  return entries;
}

async function resolveChainIds(wagmiChainNames) {
  const chainIds = new Map();
  try {
    const chains = await import('wagmi/chains');
    for (const name of wagmiChainNames) {
      const chain = chains[name];
      if (chain?.id) {
        chainIds.set(name, chain.id);
      }
    }
  } catch {
    console.warn('Could not import wagmi/chains for chain ID resolution');
  }
  return chainIds;
}

async function main() {
  const shouldWrite = process.argv.includes('--write');

  const [upstreamContent, localContent] = await Promise.all([
    fetchWithTimeout(REMOTE_NETWORKS_CONFIG_URL),
    readFile(LOCAL_CHAIN_ICONS_PATH, 'utf8'),
  ]);

  const upstreamNetworks = parseExpectedProdNetworks(upstreamContent);
  if (upstreamNetworks.length === 0) {
    throw new Error('Upstream parsing yielded 0 network entries.');
  }

  const localEntries = parseChainIconMapEntries(localContent);

  const wagmiChainNames = [...new Set(upstreamNetworks.map(n => n.wagmiChain))];
  const chainIdMap = await resolveChainIds(wagmiChainNames);

  const gaps = [];
  for (const network of upstreamNetworks) {
    const chainId = chainIdMap.get(network.wagmiChain);
    if (!chainId) {
      console.warn(`  Could not resolve chainId for wagmiChain=${network.wagmiChain} (name=${network.name})`);
      continue;
    }
    if (!localEntries.has(chainId)) {
      const iconBase = iconBaseFromPath(network.networkLogoPath);
      gaps.push({ chainId, name: network.name, iconBase, wagmiChain: network.wagmiChain });
    }
  }

  if (gaps.length === 0) {
    console.log(`chainIconMap covers all ${upstreamNetworks.length} upstream networks.`);
    return;
  }

  console.log(`Found ${gaps.length} missing chain icon mapping(s):`);
  for (const g of gaps) {
    console.log(`  chainId=${g.chainId} (${g.name}) → iconBase='${g.iconBase}'`);
  }

  if (shouldWrite) {
    const newEntries = gaps.map(g => `  ${g.chainId}: '${g.iconBase}',`);
    const insertPoint = localContent.lastIndexOf('};');
    const nextContent = `${localContent.slice(0, insertPoint)}${newEntries.join('\n')}\n${localContent.slice(insertPoint)}`;
    await writeFile(LOCAL_CHAIN_ICONS_PATH, nextContent, 'utf8');
    console.log(`Added ${gaps.length} entries to chainIconMap.`);
  } else {
    console.log('Run with --write to append missing entries.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
