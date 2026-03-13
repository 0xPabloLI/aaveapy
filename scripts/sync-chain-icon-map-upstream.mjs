#!/usr/bin/env node
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

function normalizeKey(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseChainIconObject(fileContent) {
  const match = fileContent.match(
    /export const chainIconMap:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\};/
  );
  if (!match || match.index == null) {
    throw new Error('Failed to parse chainIconMap in src/lib/chainIconMap.ts');
  }

  const objectStart = fileContent.indexOf('{', match.index);
  const objectEnd = fileContent.indexOf('};', objectStart);
  if (objectStart < 0 || objectEnd < 0) {
    throw new Error('Failed to locate chainIconMap object boundaries.');
  }

  const entries = [];
  const entryMatches = match[1].matchAll(/([a-z0-9_]+)\s*:\s*'([^']+)'/gi);
  for (const m of entryMatches) {
    entries.push([m[1].toLowerCase(), m[2]]);
  }

  return {
    start: objectStart + 1,
    end: objectEnd,
    entries,
  };
}

async function main() {
  const [upstreamContent, localContent] = await Promise.all([
    fetchWithTimeout(REMOTE_NETWORKS_CONFIG_URL),
    readFile(LOCAL_CHAIN_ICONS_PATH, 'utf8'),
  ]);

  const expectedNetworks = parseExpectedProdNetworks(upstreamContent);
  if (expectedNetworks.length === 0) {
    throw new Error('Upstream parsing yielded 0 network entries.');
  }

  const chainObject = parseChainIconObject(localContent);
  const chainMap = new Map(chainObject.entries);
  const iconValues = new Set(chainObject.entries.map(([, value]) => value));

  let additions = 0;
  for (const network of expectedNetworks) {
    const iconBase = iconBaseFromPath(network.networkLogoPath);
    if (iconValues.has(iconBase)) continue;

    let candidateKey = normalizeKey(network.name);
    if (!candidateKey || chainMap.has(candidateKey)) {
      candidateKey = normalizeKey(`${iconBase}icon`);
    }
    if (!candidateKey || chainMap.has(candidateKey)) {
      let suffix = 2;
      while (chainMap.has(`${iconBase}icon${suffix}`)) suffix += 1;
      candidateKey = `${iconBase}icon${suffix}`;
    }

    chainMap.set(candidateKey, iconBase);
    iconValues.add(iconBase);
    additions += 1;
  }

  if (additions === 0) {
    console.log('chainIconMap already covers all upstream icon values.');
    return;
  }

  const ordered = Array.from(chainMap.entries());
  const rebuiltBody = `\n${ordered.map(([k, v]) => `  ${k}: '${v}',`).join('\n')}\n`;
  const nextContent = `${localContent.slice(0, chainObject.start)}${rebuiltBody}${localContent.slice(
    chainObject.end
  )}`;
  await writeFile(LOCAL_CHAIN_ICONS_PATH, nextContent, 'utf8');
  console.log(`Updated chainIconMap with ${additions} missing upstream icon aliases.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
