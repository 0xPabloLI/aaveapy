#!/usr/bin/env node
import fs from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithTimeout, countChar } from './lib/fetch-utils.mjs';
import { discoverMainnetChainIds } from './lib/chain-utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REMOTE_NETWORKS_CONFIG_URL =
  'https://raw.githubusercontent.com/aave/interface/main/src/ui-config/networksConfig.ts';
const LOCAL_CHAIN_ICONS_PATH = path.join(ROOT, 'src/lib/chainIconMap.ts');
const NETWORKS_ICONS_DIR = path.join(ROOT, 'public', 'icons', 'networks');
const PENDING_CHAIN_ICON_BASES_PATH = path.join(
  ROOT,
  'scripts',
  'data',
  'pending-chain-icon-bases.json'
);

async function loadUpstreamNetworksConfig() {
  return await fetchWithTimeout(REMOTE_NETWORKS_CONFIG_URL);
}

function parseLocalChainIconMap(chainIconsContent) {
  const objectMatch = chainIconsContent.match(
    /(?:export\s+)?const chainIconMap:\s*Record<number,\s*string>\s*=\s*\{([\s\S]*?)\};/
  );
  if (!objectMatch) {
    throw new Error('Failed to parse chainIconMap from src/lib/chainIconMap.ts');
  }
  const map = new Map();
  const pairs = objectMatch[1].matchAll(/(\d+)\s*:\s*'([^']+)'/g);
  for (const match of pairs) {
    map.set(Number(match[1]), match[2]);
  }
  return map;
}

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
          if (depth <= 0 && current?.name && current?.networkLogoPath) {
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
        name: null,
        networkLogoPath: null,
      };
      continue;
    }

    if (depth === 1) {
      const nameMatch = line.match(/^\s*name:\s*'([^']+)'/);
      if (nameMatch) current.name = nameMatch[1];

      const logoMatch = line.match(/^\s*networkLogoPath:\s*'([^']+)'/);
      if (logoMatch) current.networkLogoPath = logoMatch[1];
    }

    depth += opens;
    depth -= closes;
    if (depth <= 0) {
      inBlock = false;
      depth = 0;
      if (current?.name && current?.networkLogoPath) {
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

function listLocalNetworkIconBases() {
  const bases = new Set();
  if (!fs.existsSync(NETWORKS_ICONS_DIR)) {
    return bases;
  }
  for (const ent of fs.readdirSync(NETWORKS_ICONS_DIR, { withFileTypes: true })) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).slice(1).toLowerCase();
    if (!ext) continue;
    const base = path.basename(ent.name, path.extname(ent.name)).toLowerCase();
    bases.add(base);
  }
  return bases;
}

async function loadPendingIconBases() {
  const raw = await readFile(PENDING_CHAIN_ICON_BASES_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('pending-chain-icon-bases.json must be a JSON array of strings');
  }
  return new Set(data.map((x) => String(x).toLowerCase()));
}



async function main() {
  const [upstreamContent, localContent, pendingBases] = await Promise.all([
    loadUpstreamNetworksConfig(),
    readFile(LOCAL_CHAIN_ICONS_PATH, 'utf8'),
    loadPendingIconBases(),
  ]);

  const localMap = parseLocalChainIconMap(localContent);
  if (localMap.size === 0) {
    console.error('Local parsing yielded 0 chainIconMap entries — possible format change.');
    process.exit(1);
  }
  const expectedNetworks = parseExpectedProdNetworks(upstreamContent);
  if (expectedNetworks.length === 0) {
    console.error('Upstream parsing yielded 0 network entries — possible format change.');
    process.exit(1);
  }

  const localIconValues = new Set(localMap.values());
  const mappingErrors = [];
  const assetErrors = [];

  const onDiskBases = listLocalNetworkIconBases();

  for (const network of expectedNetworks) {
    const iconBase = iconBaseFromPath(network.networkLogoPath);
    if (!localIconValues.has(iconBase)) {
      mappingErrors.push({ name: network.name, iconBase, kind: 'mapping' });
      continue;
    }
    const key = iconBase.toLowerCase();
    if (!onDiskBases.has(key) && !pendingBases.has(key)) {
      assetErrors.push({ name: network.name, iconBase: key, kind: 'asset' });
    }
  }

  console.log(`Upstream prod networks parsed: ${expectedNetworks.length}`);
  console.log(`Local chainIconMap entries (by chainId): ${localMap.size}`);
  console.log(`Local chainIconMap icon values: ${localIconValues.size}`);
  console.log(`Local network icon files (bases): ${onDiskBases.size}`);
  console.log(`Pending icon bases (allowed without file): ${pendingBases.size}`);

  if (mappingErrors.length > 0) {
    console.error('\nchainIconMap missing upstream network icons:');
    for (const item of mappingErrors) {
      console.error(`- ${item.name}: needs icon '${item.iconBase}' in chainIconMap`);
    }
    process.exit(1);
  }

  if (assetErrors.length > 0) {
    console.error(
      '\nMissing on-disk network icon (add public/icons/networks/<base>.* or list base in scripts/data/pending-chain-icon-bases.json):'
    );
    for (const item of assetErrors) {
      console.error(`- ${item.name}: expected file for base '${item.iconBase}'`);
    }
    process.exit(1);
  }

  console.log('chainIconMap covers all upstream prod network icons.');
  console.log('On-disk network icons (or pending allowlist) cover all mapped bases.');

  // Cross-check: chainRegistry chainIds ↔ chainIconMap chainIds
  const registryIds = await discoverMainnetChainIds();
  const iconMapIds = new Set(localMap.keys());
  const inRegistryNotIcon = [...registryIds].filter(id => !iconMapIds.has(id));
  const inIconNotRegistry = [...iconMapIds].filter(id => !registryIds.has(id));
  if (inRegistryNotIcon.length > 0 || inIconNotRegistry.length > 0) {
    console.error('\nchainRegistry ↔ chainIconMap chainId mismatch:');
    for (const id of inRegistryNotIcon) {
      console.error(`  - chainId ${id}: in chainRegistry but NOT in chainIconMap`);
    }
    for (const id of inIconNotRegistry) {
      console.error(`  - chainId ${id}: in chainIconMap but NOT in chainRegistry`);
    }
    process.exit(1);
  }
  console.log(`chainRegistry ↔ chainIconMap: all ${registryIds.size} chainIds aligned.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
