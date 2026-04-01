#!/usr/bin/env node
/**
 * Downloads chain network SVGs from aave/interface public/ that prodNetworkConfig references.
 * Complements sync-chain-icon-map-upstream (which only updates chainIconMap.ts).
 *
 * Usage: node scripts/sync-chain-network-icons-upstream.mjs [--force]
 *   Default: fetch only when public/icons/networks/<base>.* is missing.
 *   --force: overwrite existing files.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithTimeout } from './lib/fetch-utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REMOTE_NETWORKS_CONFIG_URL =
  'https://raw.githubusercontent.com/aave/interface/main/src/ui-config/networksConfig.ts';
const UPSTREAM_PUBLIC_ROOT =
  'https://raw.githubusercontent.com/aave/interface/main/public';

/**
 * Slice the `prodNetworkConfig` object literal (balanced braces) from the full file.
 */
function extractProdNetworkConfigObjectText(networksConfigContent) {
  const marker = 'export const prodNetworkConfig';
  const idx = networksConfigContent.indexOf(marker);
  if (idx < 0) {
    throw new Error('Failed to locate prodNetworkConfig in networksConfig.ts');
  }
  const braceStart = networksConfigContent.indexOf('{', idx);
  if (braceStart < 0) {
    throw new Error('Failed to locate opening brace for prodNetworkConfig');
  }
  let depth = 0;
  for (let i = braceStart; i < networksConfigContent.length; i++) {
    const c = networksConfigContent[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        return networksConfigContent.slice(braceStart, i + 1);
      }
    }
  }
  throw new Error('Unbalanced braces while scanning prodNetworkConfig');
}

/**
 * All /icons/networks/... paths referenced by prod networks (includes megaeth.id, etc.).
 */
function collectUpstreamNetworkIconPaths(prodObjectText) {
  const paths = [];
  const re = /networkLogoPath:\s*'(\/icons\/networks\/[^']+)'/g;
  let m;
  while ((m = re.exec(prodObjectText)) !== null) {
    paths.push(m[1]);
  }
  return [...new Set(paths)];
}

function localPathFromUpstreamPublicPath(upstreamPath) {
  const rel = upstreamPath.replace(/^\/+/, '');
  return path.join(ROOT, 'public', rel);
}

async function downloadBinary(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const force = process.argv.includes('--force');

  const networksTs = await fetchWithTimeout(REMOTE_NETWORKS_CONFIG_URL);
  const prodObjectText = extractProdNetworkConfigObjectText(networksTs);
  const iconPaths = collectUpstreamNetworkIconPaths(prodObjectText);
  if (iconPaths.length === 0) {
    throw new Error('No networkLogoPath entries found under prodNetworkConfig.');
  }

  let downloaded = 0;
  let skipped = 0;
  const failures = [];

  for (const pubPath of iconPaths) {
    if (!pubPath.startsWith('/icons/networks/')) {
      failures.push({ pubPath, error: 'unexpected path prefix' });
      continue;
    }

    const url = `${UPSTREAM_PUBLIC_ROOT}${pubPath}`;
    const dest = localPathFromUpstreamPublicPath(pubPath);

    if (!force && fs.existsSync(dest)) {
      skipped += 1;
      continue;
    }

    try {
      const buf = await downloadBinary(url);
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.writeFile(dest, buf);
      downloaded += 1;
      console.log(`  wrote ${path.relative(ROOT, dest)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ pubPath, error: msg });
    }
  }

  console.log(
    `chain network icons: ${iconPaths.length} upstream path(s), ${downloaded} downloaded, ${skipped} skipped (exists)`
  );

  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`  FAIL ${f.pubPath}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
