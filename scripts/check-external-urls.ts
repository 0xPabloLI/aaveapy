/**
 * Content Security Check: External URL Whitelist
 *
 * Scans all non-test source files for https:// URLs and validates that every
 * domain is on the approved whitelist. This prevents malicious code from
 * injecting phishing links (e.g., a fake explorer domain that steals wallet
 * signatures) even if a bot PR passes all other CI checks.
 *
 * Usage: npx tsx scripts/check-external-urls.ts
 * Exit 0 = all domains whitelisted; Exit 1 = unknown domains found.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SOURCE_DIRS = ['src/lib', 'src/hooks', 'src/config', 'src/pages', 'src/components'];
const EXCLUDE_PATTERNS = ['.test.', '.live.', '.spec.', '__mocks__', 'check-external-urls'];
const VALID_EXTENSIONS = new Set(['.ts', '.tsx']);

// Whitelisted domains — production-only.
// Test/placeholder domains (*.example, example.com) are excluded;
// test files are skipped entirely so they can use mock URLs freely.
const WHITELIST = new Set([
  // === AaveAPY own domains ===
  'aaveapy.com',
  'api.aaveapy.com',
  'staging-api.aaveapy.com',

  // === Aave protocol ===
  'app.aave.com',
  'pro.aave.com',
  'apps.aavechan.com',

  // === Block explorers ===
  'etherscan.io',
  'arbiscan.io',
  'optimistic.etherscan.io',
  'polygonscan.com',
  'basescan.org',
  'gnosisscan.io',
  'bscscan.com',
  'lineascan.build',
  'sonicscan.org',
  'celoscan.io',
  'mega.etherscan.io',
  'plasmascan.to',
  'snowscan.xyz',
  'scrollscan.com',
  'metisscan.info',
  'mantlescan.xyz',
  'explorer.inkonchain.com',
  'explorer.zksync.io',
  'zksync.blockscout.com',
  'soneium.blockscout.com',
  'www.oklink.com',

  // === RPC providers (public endpoints) — all chain-specific subdomains ===
  '1rpc.io',
  'drpc.org',
  'eth.drpc.org',
  'optimism.drpc.org',
  'bsc.drpc.org',
  'gnosis.drpc.org',
  'polygon.drpc.org',
  'sonic.drpc.org',
  'xlayer.drpc.org',
  'zksync.drpc.org',
  'soneium.drpc.org',
  'celo.drpc.org',
  'mantle.drpc.org',
  'base.drpc.org',
  'metis.drpc.org',
  'ink.drpc.org',
  'linea.drpc.org',
  'arbitrum.drpc.org',
  'avalanche.drpc.org',
  'scroll.drpc.org',
  'megaeth.drpc.org',
  'plasma.drpc.org',
  'monad.drpc.org',
  'publicnode.com',
  'ethereum-rpc.publicnode.com',
  'optimism-rpc.publicnode.com',
  'bsc.publicnode.com',
  'gnosis-rpc.publicnode.com',
  'polygon-bor-rpc.publicnode.com',
  'sonic-rpc.publicnode.com',
  'soneium-rpc.publicnode.com',
  'metis-rpc.publicnode.com',
  'linea-rpc.publicnode.com',
  'arbitrum-one-rpc.publicnode.com',
  'avalanche-c-chain-rpc.publicnode.com',
  'scroll-rpc.publicnode.com',
  'mantle.publicnode.com',
  'base.publicnode.com',
  'blastapi.io',
  'eth-mainnet.public.blastapi.io',
  'bsc-mainnet.public.blastapi.io',
  'base-mainnet.public.blastapi.io',
  'llamarpc.com',
  'base.llamarpc.com',
  'nodies.app',
  'polygon-pokt.nodies.app',
  'fastnode.io',
  'public-op-mainnet.fastnode.io',
  'quiknode.pro',
  'rpc-mainnet.matic.quiknode.pro',
  'onfinality.io',
  'gnosis.api.onfinality.io',
  'plasma.api.onfinality.io',
  'tenderly.co',
  'gateway.tenderly.co',
  'metis-andromeda.gateway.tenderly.co',
  'soneium.gateway.tenderly.co',
  'mantle.gateway.tenderly.co',
  'tatum.io',
  'celo-mainnet.gateway.tatum.io',
  'chainid.network',
  'chainlist.org',
  'forno.celo.org',
  'arb1.arbitrum.io',
  'api.avax.network',
  'rpc.gnosischain.com',
  'rpc.linea.build',
  'rpc.mantle.xyz',
  'rpc.monad.xyz',
  'rpc.plasma.to',
  'rpc.scroll.io',
  'rpc.soneium.org',
  'rpc.soniclabs.com',
  'rpc.xlayer.tech',
  'mainnet.era.zksync.io',
  'mainnet.megaeth.com',
  'static-rpc.megaeth.com',
  'andromeda.metis.io',
  'zksync-era.public-rpc.com',
  'xlayerrpc.okx.com',
  'rpc-gel.inkonchain.com',
  'rpc-qnd.inkonchain.com',

  // === Incentive/campaign platforms ===
  'app.merit.systems',
  'app.merkl.xyz',
  'merkl.angle.money',
  'app.tydro.com',
  'brevis.network',
  'incentra.brevis.network',

  // === Market data ===
  'api.coingecko.com',
  'coinmarketcap.com',

  // === Social ===
  't.me',
  'twitter.com',
  'x.com',

  // === Schema / metadata (not external links, but matched by regex) ===
  'github.com',
  'schema.org',
]);

const URL_REGEX = /https:\/\/([a-zA-Z0-9._-]+)/g;

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
      if (!WHITELIST.has(domain)) {
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
  console.error('\nIf these are legitimate new domains, add them to the WHITELIST in scripts/check-external-urls.ts');
  process.exit(1);
}
