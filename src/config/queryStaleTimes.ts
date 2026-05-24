export const QUERY_STALE_TIMES = {
  // Global fallback for queries without per-query override.
  default: 5 * 60 * 1000,

  // Core backend snapshot family (markets).
  // Align with backend realtimeFamily soft TTL (60s).
  coreSnapshotApi: 1 * 60 * 1000,

  // Side data meta (merged endpoint: categories, FDV, forecast).
  // Uses min(categories=6h, fdv=5m, forecast=10m) = 5 min as baseline; backend TTL overrides.
  sideDataMeta: 5 * 60 * 1000,

  // Individual side-data defaults (aligned with backend staleTimeMs).
  coingeckoFdv: 5 * 60 * 1000,
  tokenCategories: 6 * 60 * 60 * 1000,
  merklForecast: 10 * 60 * 1000,
  campaignAccess: 30 * 60 * 1000,

  // Token images (long TTL).
  coingeckoTokenImage: 24 * 60 * 60 * 1000,
} as const;

export const QUERY_GC_TIMES = {
  // Side data meta: moderate retention to avoid refetch on navigation.
  sideDataMeta: 15 * 60 * 1000,
  // Token images: localStorage provides initialData on remount, no need for long in-memory retention.
  coingeckoTokenImage: 30 * 60 * 1000,
} as const;
