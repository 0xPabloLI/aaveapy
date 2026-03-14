export const QUERY_STALE_TIMES = {
  // Global fallback for queries without per-query override.
  default: 5 * 60 * 1000,

  // Core backend snapshot family (markets, rate-inputs).
  // Align with backend realtimeFamily soft TTL (60s).
  coreSnapshotApi: 1 * 60 * 1000,

  // Side data meta (merged endpoint: categories, FDV, forecast).
  // Uses min(categories=6h, fdv=5m, forecast=10m) = 5 min as baseline; backend TTL overrides.
  sideDataMeta: 5 * 60 * 1000,

  // Individual side-data defaults (aligned with backend staleTimeMs).
  coingeckoFdv: 5 * 60 * 1000,
  tokenCategories: 6 * 60 * 60 * 1000,
  merklForecast: 10 * 60 * 1000,

  // Token images (long TTL).
  coingeckoTokenImage: 24 * 60 * 60 * 1000,
} as const;

export const QUERY_GC_TIMES = {
  coingeckoTokenImage: 7 * 24 * 60 * 60 * 1000,
} as const;
