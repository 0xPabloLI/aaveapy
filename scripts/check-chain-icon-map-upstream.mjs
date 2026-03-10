#!/usr/bin/env node
import { readFile } from 'fs/promises';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const REMOTE_NETWORKS_CONFIG_URL =
  'https://raw.githubusercontent.com/aave/interface/main/src/ui-config/networksConfig.ts';
const LOCAL_CHAIN_ICONS_PATH = path.join(ROOT, 'src/lib/chainIcons.ts');

const NORMALIZATION_ALIASES = {
  op: ['optimism'],
  polygonpos: ['polygon'],
  bnbchain: ['binance', 'bnbchain'],
};

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function loadUpstreamNetworksConfig() {
  return await fetchWithTimeout(REMOTE_NETWORKS_CONFIG_URL);
}

function countChar(input, char) {
  let count = 0;
  for (const ch of input) {
    if (ch === char) count += 1;
  }
  return count;
}

function normalizeChainName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
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
        displayName: null,
        networkLogoPath: null,
      };
      continue;
    }

    if (depth === 1) {
      const nameMatch = line.match(/^\s*name:\s*'([^']+)'/);
      if (nameMatch) current.name = nameMatch[1];

      const displayNameMatch = line.match(/^\s*displayName:\s*'([^']+)'/);
      if (displayNameMatch) current.displayName = displayNameMatch[1];

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
  const expectedNetworks = parseExpectedProdNetworks(upstreamContent);
  if (expectedNetworks.length === 0) {
    console.error('Upstream parsing yielded 0 network entries — possible format change.');
    process.exit(1);
  }
  const errors = [];

  for (const network of expectedNetworks) {
    const canonical = normalizeChainName(network.displayName || network.name);
    const aliasKeys = NORMALIZATION_ALIASES[canonical] || [];
    const candidates = [canonical, ...aliasKeys];
    const iconBase = iconBaseFromPath(network.networkLogoPath);
    const matched = candidates.some((candidate) => localMap.get(candidate) === iconBase);

    if (!matched) {
      errors.push({
        name: network.name,
        displayName: network.displayName,
        canonical,
        iconBase,
        candidates,
      });
    }
  }

  console.log(`Upstream prod networks parsed: ${expectedNetworks.length}`);
  console.log(`Local chainIconMap keys: ${localMap.size}`);

  if (errors.length > 0) {
    console.error('\nchainIconMap mismatch against upstream networksConfig:');
    for (const item of errors) {
      console.error(
        `- ${item.name} (${item.displayName ?? 'no-displayName'}) expects icon '${item.iconBase}' via keys [${item.candidates.join(', ')}]`
      );
    }
    process.exit(1);
  }

  console.log('chainIconMap is aligned with upstream prod networks config.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
