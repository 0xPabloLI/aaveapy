/**
 * Map from explorer base URL (e.g. `etherscan.io`) to a brand icon base
 * (e.g. `etherscan`). The icon base resolves to
 * `/icons/explorers/{base}.{ext}` via the generated manifest.
 *
 * The map only references base names; the actual file presence check happens
 * at runtime in `getExplorerIconSrc` against the generated manifest.
 */
export const explorerIconMap: Record<string, string> = {
  'etherscan.io': 'etherscan',
  'arbiscan.io': 'etherscan',
  'optimistic.etherscan.io': 'etherscan',
  'polygonscan.com': 'etherscan',
  'basescan.org': 'etherscan',
  'gnosisscan.io': 'etherscan',
  'bscscan.com': 'etherscan',
  'lineascan.build': 'etherscan',
  'sonicscan.org': 'etherscan',
  'celoscan.io': 'etherscan',
  'mega.etherscan.io': 'etherscan',
  'plasmascan.to': 'etherscan',
  'mantlescan.xyz': 'etherscan',
  'snowscan.xyz': 'etherscan',
  'metisscan.info': 'routescan',
  'scrollscan.com': 'blockscout',
  'zksync.blockscout.com': 'blockscout',
  'soneium.blockscout.com': 'blockscout',
  'explorer.inkonchain.com': 'blockscout',
  'oklink.com': 'oklink',
};

/**
 * Normalize an explorer base URL to the key shape used by `explorerIconMap`:
 * strip protocol and trailing slash, lower-case, drop any `www.` prefix.
 *
 * Examples:
 *   "https://etherscan.io"        -> "etherscan.io"
 *   "https://www.oklink.com/foo"   -> "oklink.com"
 */
export function normalizeExplorerBase(base: string): string {
  let normalized = base.trim().toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.replace(/\/.*$/, '');
  return normalized;
}
