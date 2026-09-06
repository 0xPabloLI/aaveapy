/**
 * Content Security Check: External URL Whitelist
 *
 * Scans all non-test source files for https:// URLs and validates them.
 * This prevents malicious code from injecting phishing links (e.g., a fake
 * explorer domain or a scam social media account) even if a bot PR passes
 * all other CI checks.
 *
 * Two tiers of matching:
 *
 * 1. DOMAIN_WHITELIST — root domain matching
 *    Adding "drpc.org" covers ALL *.drpc.org subdomains.
 *    "etherscan.io.evil.com" does NOT match "etherscan.io" (not a suffix).
 *    Use for: block explorers, RPC providers, protocol apps.
 *
 * 2. SOCIAL_MEDIA_WHITELIST — full URL path matching
 *    Social media domains (twitter.com, t.me) allow anyone to create accounts.
 *    "twitter.com/Scammer" must NOT pass just because "twitter.com" is whitelisted.
 *    Instead, list the exact account path: "t.me/aaveapy", "twitter.com/AaveApy".
 *
 * Usage: npx tsx scripts/check-external-urls.ts
 * Exit 0 = all URLs whitelisted; Exit 1 = unknown URLs found.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SOURCE_DIRS = ['src/lib', 'src/hooks', 'src/config', 'src/pages', 'src/components'];
const EXCLUDE_PATTERNS = ['.test.', '.live.', '.spec.', '__mocks__', 'check-external-urls'];
const VALID_EXTENSIONS = new Set(['.ts', '.tsx']);

/**
 * Tier 1: Trusted root domains.
 *
 * Adding "drpc.org" covers ALL *.drpc.org subdomains.
 * "etherscan.io.evil.com" does NOT match "etherscan.io".
 *
 * DO NOT add domains where anyone can register subdomains
 * (e.g., github.io, vercel.app, herokuapp.com, pages.dev).
 * DO NOT add social media domains here — use SOCIAL_MEDIA_WHITELIST instead.
 */
const DOMAIN_WHITELIST = new Set([
  // === AaveAPY (own infrastructure) ===
  'aaveapy.com',          // covers api.aaveapy.com, staging-api.aaveapy.com

  // === Aave protocol ===
  'aave.com',             // covers app.aave.com, pro.aave.com
  'aavechan.com',         // covers apps.aavechan.com

  // === Block explorers ===
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

  // === RPC providers ===
  'drpc.org',
  'publicnode.com',
  'blastapi.io',
  'llamarpc.com',
  'nodies.app',
  'fastnode.io',
  'quiknode.pro',
  'onfinality.io',
  'tenderly.co',
  'tatum.io',
  '1rpc.io',
  'chainid.network',
  'chainlist.org',

  // === Chain-specific RPC endpoints ===
  'forno.celo.org',
  'arb1.arbitrum.io',
  'avax.network',
  'gnosischain.com',
  'linea.build',
  'mantle.xyz',
  'monad.xyz',
  'plasma.to',
  'scroll.io',
  'soneium.org',
  'soniclabs.com',
  'xlayer.tech',
  'megaeth.com',
  'metis.io',
  'public-rpc.com',
  'okx.com',

  // === Incentive/campaign platforms ===
  'merit.systems',
  'merkl.xyz',
  'angle.money',
  'tydro.com',
  'brevis.network',

  // === Market data ===
  'coingecko.com',
  'coinmarketcap.com',

  // === Schema / metadata (not user-facing links) ===
  'github.com',
  'schema.org',

  // === Analytics ===
  'googletagmanager.com',  // covers www.googletagmanager.com (GA4 gtag.js)
]);

/**
 * Tier 2: Social media — exact URL path whitelist.
 *
 * Social media platforms allow anyone to create accounts, so we can't just
 * whitelist the root domain. Instead, we whitelist the exact account path.
 *
 * Format: full URL path without protocol (e.g., "t.me/aaveapy").
 * Matches if the URL starts with one of these entries.
 */
const SOCIAL_MEDIA_WHITELIST = new Set([
  't.me/aaveapy',
  'twitter.com/AaveApy',
  'x.com/AaveApy',
  'twitter.com/silenlee',
  'x.com/inkfndhq',
]);

// Domains that require full-path checking (social media)
const SOCIAL_MEDIA_DOMAINS = new Set(['t.me', 'twitter.com', 'x.com']);

// Regex to extract full URLs (domain + path)
const URL_REGEX = /https:\/\/([a-zA-Z0-9._/-]+)/g;

/**
 * Check if a domain is whitelisted (Tier 1: root domain matching).
 */
function isDomainWhitelisted(domain: string): boolean {
  for (const entry of DOMAIN_WHITELIST) {
    if (domain === entry || domain.endsWith('.' + entry)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a full URL path is whitelisted.
 * For social media domains: must match an exact entry in SOCIAL_MEDIA_WHITELIST.
 * For other domains: just check the root domain.
 */
function isUrlWhitelisted(urlPath: string): { ok: boolean; reason: string } {
  // Extract domain (everything before first /)
  const slashIdx = urlPath.indexOf('/');
  const domain = slashIdx >= 0 ? urlPath.substring(0, slashIdx) : urlPath;
  const path = slashIdx >= 0 ? urlPath.substring(slashIdx + 1) : '';

  // Tier 2: Social media — check exact account path
  if (SOCIAL_MEDIA_DOMAINS.has(domain) || SOCIAL_MEDIA_DOMAINS.has(getRootDomain(domain))) {
    for (const entry of SOCIAL_MEDIA_WHITELIST) {
      if (urlPath === entry || urlPath.startsWith(entry)) {
        return { ok: true, reason: `social media: ${entry}` };
      }
    }
    return { ok: false, reason: `social media account not whitelisted: ${urlPath}` };
  }

  // Tier 1: Domain whitelist — root domain matching
  if (isDomainWhitelisted(domain)) {
    return { ok: true, reason: `domain: ${domain}` };
  }

  return { ok: false, reason: `unknown domain: ${domain}` };
}

/** Extract root domain (last 2 parts) for social media check */
function getRootDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return domain;
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

const unknownUrls = new Map<string, string[]>();

for (const dir of SOURCE_DIRS) {
  const files = walkDir(dir);
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    let match;
    while ((match = URL_REGEX.exec(content)) !== null) {
      const urlPath = match[1];
      const result = isUrlWhitelisted(urlPath);
      if (!result.ok) {
        if (!unknownUrls.has(urlPath)) {
          unknownUrls.set(urlPath, []);
        }
        const lines = content.substring(0, match.index).split('\n');
        const lineNum = lines.length;
        unknownUrls.get(urlPath)!.push(`${file}:${lineNum}`);
      }
    }
  }
}

if (unknownUrls.size === 0) {
  console.log('✅ All external URLs in source code are on the whitelist.');
  process.exit(0);
} else {
  console.error('❌ Unknown external URLs found in source code:\n');
  for (const [urlPath, locations] of unknownUrls) {
    console.error(`  https://${urlPath}`);
    for (const loc of locations.slice(0, 5)) {
      console.error(`    ${loc}`);
    }
    if (locations.length > 5) {
      console.error(`    ... and ${locations.length - 5} more`);
    }
  }
  console.error('\nTo fix:');
  console.error('  • For domains (explorer/RPC/etc.): add root domain to DOMAIN_WHITELIST');
  console.error('  • For social media: add exact account path to SOCIAL_MEDIA_WHITELIST');
  console.error('    (e.g., "t.me/aaveapy" — NOT just "t.me")');
  process.exit(1);
}
