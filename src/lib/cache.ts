import { MarketsResponse } from '@/types/aave';

const CACHE_KEYS = {
  MARKETS: 'aave-markets-cache',
  TYDRO_RATE: 'tydro-point-usd-rate',
  COINGECKO_FDV: 'coingecko-fdv-cache',
  TOKEN_CATEGORIES: 'token-categories-cache',
  RATE_INPUTS_SNAPSHOT: 'rate-inputs-snapshot-cache',
  MERKL_FORECAST_STATES: 'merkl-forecast-states-cache',
  SIDE_DATA_META: 'side-data-meta-cache',
  COINGECKO_TOKEN_IMAGE_PREFIX: 'coingecko-token-image:',
} as const;

const LEGACY_CACHE_KEYS = ['aave-markets-list-cache'] as const;

// Bump cache version when schema changes.
const CACHE_VERSION = '1.1.0';

interface CacheEntry<T> {
  data: T;
  timestamp: string;
  version: string;
}

export interface CachedPayload<T> {
  data: T;
  updatedAt: number;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function toCachedPayload<T>(entry: CacheEntry<T>): CachedPayload<T> {
  const parsed = Date.parse(entry.timestamp);
  return {
    data: entry.data,
    updatedAt: Number.isFinite(parsed) ? parsed : Date.now(),
  };
}

// Helper to get cache entry
function getCacheEntry<T>(key: string): CachedPayload<T> | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);

    // Check version compatibility
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }

    return toCachedPayload(entry);
  } catch (error) {
    console.warn(`Failed to read cache for ${key}:`, error);
    return null;
  }
}

// Helper to set cache entry
function setCacheEntry<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date().toISOString(),
      version: CACHE_VERSION,
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.warn(`Failed to write cache for ${key}:`, error);
  }
}

function normalizeSymbolKey(symbol: string): string {
  return symbol.trim().toLowerCase();
}

export function clearLegacyCacheEntries(storage: StorageLike = localStorage): void {
  for (const key of LEGACY_CACHE_KEYS) {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove legacy cache key ${key}:`, error);
    }
  }
}

// Markets cache
export function getCachedMarketsEntry(): CachedPayload<MarketsResponse> | null {
  return getCacheEntry<MarketsResponse>(CACHE_KEYS.MARKETS);
}

export function getCachedMarkets(): MarketsResponse | null {
  const entry = getCachedMarketsEntry();
  return entry?.data ?? null;
}

export function setCachedMarkets(data: MarketsResponse): void {
  setCacheEntry(CACHE_KEYS.MARKETS, data);
}

// CoinGecko FDV cache
export function getCachedCoingeckoFdvEntry<T>(): CachedPayload<T> | null {
  return getCacheEntry<T>(CACHE_KEYS.COINGECKO_FDV);
}

export function setCachedCoingeckoFdv<T>(data: T): void {
  setCacheEntry(CACHE_KEYS.COINGECKO_FDV, data);
}

// Token categories cache
export function getCachedTokenCategoriesEntry<T>(): CachedPayload<T> | null {
  return getCacheEntry<T>(CACHE_KEYS.TOKEN_CATEGORIES);
}

export function setCachedTokenCategories<T>(data: T): void {
  setCacheEntry(CACHE_KEYS.TOKEN_CATEGORIES, data);
}

// Side-data meta cache
export function getCachedSideDataMetaEntry<T>(): CachedPayload<T> | null {
  return getCacheEntry<T>(CACHE_KEYS.SIDE_DATA_META);
}

export function setCachedSideDataMeta<T>(data: T): void {
  setCacheEntry(CACHE_KEYS.SIDE_DATA_META, data);
}

// Rate-inputs snapshot cache
export function getCachedRateInputsSnapshotEntry<T>(): CachedPayload<T> | null {
  return getCacheEntry<T>(CACHE_KEYS.RATE_INPUTS_SNAPSHOT);
}

export function setCachedRateInputsSnapshot<T>(data: T): void {
  setCacheEntry(CACHE_KEYS.RATE_INPUTS_SNAPSHOT, data);
}

// Merkl forecast states cache
export function getCachedMerklForecastStatesEntry<T>(): CachedPayload<T> | null {
  return getCacheEntry<T>(CACHE_KEYS.MERKL_FORECAST_STATES);
}

export function setCachedMerklForecastStates<T>(data: T): void {
  setCacheEntry(CACHE_KEYS.MERKL_FORECAST_STATES, data);
}

// Token image cache (per symbol)
export function getCachedCoingeckoTokenImageEntry(symbol: string): CachedPayload<string | null> | null {
  const normalized = normalizeSymbolKey(symbol);
  if (!normalized) return null;
  return getCacheEntry<string | null>(`${CACHE_KEYS.COINGECKO_TOKEN_IMAGE_PREFIX}${normalized}`);
}

export function setCachedCoingeckoTokenImage(symbol: string, imageUrl: string | null): void {
  const normalized = normalizeSymbolKey(symbol);
  if (!normalized) return;
  setCacheEntry(`${CACHE_KEYS.COINGECKO_TOKEN_IMAGE_PREFIX}${normalized}`, imageUrl);
}

// CoinGecko FDV cache
export function getCachedCoingeckoFdvEntry<T>(): CachedPayload<T> | null {
  return getCacheEntry<T>(CACHE_KEYS.COINGECKO_FDV);
}

export function setCachedCoingeckoFdv<T>(data: T): void {
  setCacheEntry(CACHE_KEYS.COINGECKO_FDV, data);
}

// Token categories cache
export function getCachedTokenCategoriesEntry<T>(): CachedPayload<T> | null {
  return getCacheEntry<T>(CACHE_KEYS.TOKEN_CATEGORIES);
}

export function setCachedTokenCategories<T>(data: T): void {
  setCacheEntry(CACHE_KEYS.TOKEN_CATEGORIES, data);
}

// Rate-inputs snapshot cache
export function getCachedRateInputsSnapshotEntry<T>(): CachedPayload<T> | null {
  return getCacheEntry<T>(CACHE_KEYS.RATE_INPUTS_SNAPSHOT);
}

export function setCachedRateInputsSnapshot<T>(data: T): void {
  setCacheEntry(CACHE_KEYS.RATE_INPUTS_SNAPSHOT, data);
}

// Token image cache (per symbol)
export function getCachedCoingeckoTokenImageEntry(symbol: string): CachedPayload<string | null> | null {
  const normalized = normalizeSymbolKey(symbol);
  if (!normalized) return null;
  return getCacheEntry<string | null>(`${CACHE_KEYS.COINGECKO_TOKEN_IMAGE_PREFIX}${normalized}`);
}

export function setCachedCoingeckoTokenImage(symbol: string, imageUrl: string | null): void {
  const normalized = normalizeSymbolKey(symbol);
  if (!normalized) return;
  setCacheEntry(`${CACHE_KEYS.COINGECKO_TOKEN_IMAGE_PREFIX}${normalized}`, imageUrl);
}

// Tydro point to USD rate cache (user preference)
export function getCachedTydroRate(): number | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.TYDRO_RATE);
    if (!cached) return null;
    const rate = parseFloat(cached);
    if (Number.isNaN(rate) || rate < 0) return null;
    return rate;
  } catch (error) {
    console.warn('Failed to read Tydro rate from cache:', error);
    return null;
  }
}

export function setCachedTydroRate(rate: number): void {
  try {
    if (Number.isNaN(rate) || rate < 0) return;
    localStorage.setItem(CACHE_KEYS.TYDRO_RATE, String(rate));
  } catch (error) {
    console.warn('Failed to write Tydro rate to cache:', error);
  }
}
