/**
 * Content Security Check: External URL Whitelist
 *
 * Scans all non-test source files for https:// URLs and validates that every
 * domain is on the approved whitelist. This prevents malicious code from
 * injecting phishing links (e.g., a fake explorer domain that steals wallet
 * signatures) even if a bot PR passes all other CI checks.
 *
 * Matching logic:
 * - Root domain in whitelist → all subdomains pass (e.g., "drpc.org" covers
 *   "eth.drpc.org", "bsc.drpc.org", etc.)
 * - Phishing-safe: "etherscan.io.evil.com" does NOT match "etherscan.io"
 *   because the check is `domain === entry || domain.endsWith('.' + entry)`
 *
 * Usage: npx tsx scripts/check-external-urls.ts
 * Exit 0 = all domains whitelisted; Exit 1 = unknown domains found.
 *
 * When adding a new legitimate URL:
 * 1. Add the root domain to the WHITELIST below (same PR)
 * 2. CI passes → code owner reviews the whitelist change in the diff
 * 3. If the domain looks suspicious, reviewer rejects — this is Layer 2 defense
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SOURCE_DIRS = ['src/lib', 'src/hooks', 'src/config', 'src/pages', 'src/components'];
const EXCLUDE_PATTERNS = ['.test.', '.live.', '.spec.', '__mocks__', 'check-external-urls'];
const VALID_EXTENSIONS = new Set(['.ts', '.tsx']);

/**
 * Whitelisted root domains.
 *
 * For each URL found in source code, we check if the domain matches any entry:
 * - Exact match: domain === entry
 * - Subdomain match: domain.endsWith('.' + entry)
 *
 * This means adding "drpc.org" covers ALL *.drpc.org subdomains.
 * But "etherscan.io.evil.com" does NOT match "etherscan.io" (no suffix match).
 *
 * DO NOT add domains where anyone can register subdomains
 * (e.g., github.io, vercel.app, herokuapp.com, pages.dev).
 * For those, list the specific subdomain explicitly.
 */
const WHITELIST = new Set([
  // === AaveAPY (own infrastructure) ===
  'aaveapy.com',          // covers api.aaveapy.com, staging-api.aaveapy.com

  // === Aave protocol ===
  'aave.com',             // covers app.aave.com, pro.aave.com
  'aavechan.com',         // covers apps.aavechan.com

  // === Block explorers (different root domains per chain) ===
  'etherscan.io',         // covers optimistic.etherscan.io, mega.etherscan.io
  'arbiscan.io',
  'polygonscan.com',
  'basescan.org',
  'gnosisscan.io',
  'bscscan.com',
  'lineascan.build',
  'sonicscan.org',
  'celoscan.io',
  'plasmascan.to',
  'snowscan.xyz',
  'scrollscan.com',
  'metisscan.info',
  'mantlescan.xyz',
  'blockscout.com',       // covers zksync.blockscout.com, soneium.blockscout.com
  'oklink.com',           // covers www.oklink.com
  'inkonchain.com',       // covers explorer.inkonchain.com
  'zksync.io',            // covers explorer.zksync.io, mainnet.era.zksync.io

  // === RPC providers (trusted, control all subdomains) ===
  'drpc.org',             // covers eth.drpc.org, bsc.drpc.org, etc.
  'publicnode.com',       // covers ethereum-rpc.publicnode.com, bsc.publicnode.com, etc.
  'blastapi.io',          // covers eth-mainnet.public.blastapi.io, etc.
  'llamarpc.com',         // covers base.llamarpc.com
  'nodies.app',           // covers polygon-pokt.nodies.app
  'fastnode.io',          // covers public-op-mainnet.fastnode.io
  'quiknode.pro',         // covers rpc-mainnet.matic.quiknode.pro
  'onfinality.io',        // covers gnosis.api.onfinality.io, plasma.api.onfinality.io
  'tenderly.co',          // covers gateway.tenderly.co, *.gateway.tenderly.co
  'tatum.io',             // covers celo-mainnet.gateway.tatum.io
  '1rpc.io',
  'chainid.network',
  'chainlist.org',

  // === Chain-specific RPC endpoints (standalone domains) ===
  'forno.celo.org',
  'arb1.arbitrum.io',
  'avax.network',         // covers api.avax.network
  'gnosischain.com',      // covers rpc.gnosischain.com
  'linea.build',          // covers rpc.linea.build
  'mantle.xyz',           // covers rpc.mantle.xyz
  'monad.xyz',            // covers rpc.monad.xyz
  'plasma.to',            // covers rpc.plasma.to
  'scroll.io',            // covers rpc.scroll.io
  'soneium.org',          // covers rpc.soneium.org
  'soniclabs.com',        // covers rpc.soniclabs.com
  'xlayer.tech',          // covers rpc.xlayer.tech
  'megaeth.com',          // covers mainnet.megaeth.com, static-rpc.megaeth.com
  'metis.io',             // covers andromeda.metis.io
  'public-rpc.com',       // covers zksync-era.public-rpc.com
  'okx.com',              // covers xlayerrpc.okx.com

  // === Incentive/campaign platforms ===
  'merit.systems',        // covers app.merit.systems
  'merkl.xyz',            // covers app.merkl.xyz
  'angle.money',          // covers merkl.angle.money
  'tydro.com',            // covers app.tydro.com
  'brevis.network',       // covers incentra.brevis.network

  // === Market data ===
  'coingecko.com',        // covers api.coingecko.com
  'coinmarketcap.com',

  // === Social ===
  't.me',
  'twitter.com',
  'x.com',

  // === Schema / metadata (not user-facing links) ===
  'github.com',
  'schema.org',
]);

const URL_REGEX = /https:\/\/([a-zA-Z0-9._-]+)/g;

/**
 * Check if a domain is whitelisted.
 * Matches if domain equals an entry or is a subdomain of an entry.
 * e.g., "eth.drpc.org" matches "drpc.org" (subdomain).
 *       "etherscan.io.evil.com" does NOT match "etherscan.io" (not a suffix).
 */
function isWhitelisted(domain: string): boolean {
  for (const entry of WHITELIST) {
    if (domain === entry || domain.endsWith('.' + entry)) {
      return true;
    }
  }
  return false;
}

function walkDir(dir: string, results: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkDir(fullPath, results);
    } else if (VALID_EXTENSIONS.has(extname(fullPath))) {
      if (!EXCLUDE_PATTERNS.some(p => fullPath.includes(p)) && !fullPath.includes('check-external-urls')) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const unknownDomains = new Map<string, string[]>();

for (const dir of SOURCE_DIRS) {
  const files = walkDir(dir);
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    let match;
    while ((match = URL_REGEX.exec(content)) !== null) {
      const domain = match[1];
      if (!isWhitelisted(domain)) {
        if (!unknownDomains.has(domain)) {
          unknownDomains.set(domain, []);
        }
        const lines = content.substring(0, match.index).split('\n');
        const lineNum = lines.length;
        unknownDomains.get(domain)!.push(`${file}:${lineNum}`);
      }
    }
  }
}

if (unknownDomains.size === 0) {
  console.log('✅ All external URLs in source code are on the whitelist.');
  process.exit(0);
} else {
  console.error('❌ Unknown external domains found in source code:');
  for (const [domain, locations] of unknownDomains) {
    console.error(`\n  ${domain}`);
    for (const loc of locations.slice(0, 5)) {
      console.error(`    ${loc}`);
    }
    if (locations.length > 5) {
      console.error(`    ... and ${locations.length - 5} more`);
    }
  }
  console.error('\nIf these are legitimate new domains, add the ROOT domain to the WHITELIST in scripts/check-external-urls.ts');
  console.error('Adding a root domain (e.g., "drpc.org") automatically covers all subdomains (eth.drpc.org, bsc.drpc.org, etc.)')
  process.exit(1);
}
