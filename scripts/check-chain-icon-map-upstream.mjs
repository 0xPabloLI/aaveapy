#!/usr/bin/env node
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithTimeout, countChar } from './lib/fetch-utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REMOTE_NETWORKS_CONFIG_URL =
  'https://raw.githubusercontent.com/aave/interface/main/src/ui-config/networksConfig.ts';
const LOCAL_CHAIN_ICONS_PATH = path.join(ROOT, 'src/lib/chainIcons.ts');

async function loadUpstreamNetworksConfig() {
  return await fetchWithTimeout(REMOTE_NETWORKS_CONFIG_URL);
}

function parseLocalChainIconMap(chainIconsContent) {
  const objectMatch = chainIconsContent.match(
    /(?:export\s+)?const chainIconMap:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\};/
  );
  if (!objectMatch) {
    throw new Error('Failed to parse chainIconMap from src/lib/chainIcons.ts');
  }
  const map = new Map();
  const pairs = objectMatch[1].matchAll(/([a-z0-9_]+)\s*:\s*'([^']+)'/gi);
  for (const match of pairs) {
    map.set(match[1].toLowerCase(), match[2]);
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
  // outerDepth tracks the top-level prodNetworkConfig object braces so we stop
  // when it closes instead of scanning into subsequent exports (e.g. testnet configs).
  let outerDepth = 0;
  let outerStarted = false;
  let inBlock = false;
  let depth = 0;
  let current = null;

  for (const line of lines) {
    // Track the top-level object depth
    const opens = countChar(line, '{');
    const closes = countChar(line, '}');
    if (!outerStarted && opens > 0) {
      outerStarted = true;
    }
    if (outerStarted) {
      outerDepth += opens;
      outerDepth -= closes;
      // Stop once the prodNetworkConfig object is fully closed
      if (outerDepth <= 0) {
        // Process any final block closure on this line before breaking
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
      const start = line.match(/^\s*\[ChainId\.[a-zA-Z0-9_]+\]:\s*\{/);
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

async function main() {
  const [upstreamContent, localContent] = await Promise.all([
    loadUpstreamNetworksConfig(),
    readFile(LOCAL_CHAIN_ICONS_PATH, 'utf8'),
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

  // Build a set of icon base names the local map covers.
  // This avoids maintaining a manual alias table for upstream chain name variants.
  const localIconValues = new Set(localMap.values());
  const errors = [];

  for (const network of expectedNetworks) {
    const iconBase = iconBaseFromPath(network.networkLogoPath);
    if (!localIconValues.has(iconBase)) {
      errors.push({ name: network.name, iconBase });
    }
  }

  console.log(`Upstream prod networks parsed: ${expectedNetworks.length}`);
  console.log(`Local chainIconMap icon values: ${localIconValues.size}`);

  if (errors.length > 0) {
    console.error('\nchainIconMap missing upstream network icons:');
    for (const item of errors) {
      console.error(`- ${item.name}: needs icon '${item.iconBase}' in chainIconMap`);
    }
    process.exit(1);
  }

  console.log('chainIconMap covers all upstream prod network icons.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
