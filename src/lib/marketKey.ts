/**
 * Composite key for uniquely identifying a market across chains.
 *
 * V4 market names are NOT unique across chains (e.g., `AaveV4Main` exists on
 * both Ethereum and Avalanche). This helper creates a unique key by prefixing
 * with chainId.
 *
 * Used as the storage format for `selectedMarkets` in FilterBar / Index.tsx.
 */
export function marketKey(chainId: number, marketName: string): string {
  return `${chainId}:${marketName}`;
}
