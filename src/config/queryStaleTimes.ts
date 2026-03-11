export const QUERY_STALE_TIMES = {
  // Global fallback for queries without per-query override.
  default: 5 * 60 * 1000,

  // Core backend snapshot family (markets, rate-inputs, Merkl forecast-states).
  coreSnapshotApi: 2 * 60 * 1000,

  // Side data.
  coingeckoFdv: 10 * 60 * 1000,
  tokenCategories: 6 * 60 * 60 * 1000,
  coingeckoTokenImage: 24 * 60 * 60 * 1000,
} as const;

export const QUERY_GC_TIMES = {
  coingeckoTokenImage: 7 * 24 * 60 * 60 * 1000,
} as const;
