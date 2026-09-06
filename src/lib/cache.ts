import { MarketsResponse } from '@/types/aave';
import { SCHEMA_FP } from '@/shared/schema-fingerprint';

const CACHE_KEYS = {
  MARKETS: 'aave-markets-cache',
  TYDRO_RATE: 'tydro-point-usd-rate',
  COINGECKO_FDV: 'coingecko-fdv-cache',
  TOKEN_CATEGORIES: 'token-categories-cache',
  MERKL_FORECAST_STATES: 'merkl-forecast-states-cache',
  SIDE_DATA_META: 'side-data-meta-cache',
  COINGECKO_TOKEN_IMAGE_PREFIX: 'coingecko-token-image:',
} as const;

const LEGACY_CACHE_KEYS = ['aave-markets-list-cache'] as const;

// Bump this when you need to force cache invalidation for reasons
// that don't change the API shape (value format change, data fix, etc).
// When the API shape changes, SCHEMA_FP handles it automatically.
const CACHE_VERSION = '2';

// Effective fingerprint = schema fingerprint + manual version.
// Either one changing invalidates all cached entries.
const effectiveFp = `${SCHEMA_FP}:${CACHE_VERSION}`;

// Separate key for the effective fingerprint received from the latest
// API response. Acts as a lazy-updated reference for runtime drift
// detection (e.g. backend deployed but frontend not yet rebuilt).
const SCHEMA_FP_KEY = 'aave-schema-fingerprint';

interface CacheEntry<T> {
  data: T;
  timestamp: string;
  /** Effective fingerprint (SCHEMA_FP:CACHE_VERSION) at write time. */
  fp: string;
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

    const raw = JSON.parse(cached);
    if (!raw || typeof raw !== 'object') return null;

    // Backward compat: entries with 'version' (pre-fingerprint) → keep as-is
    if ('version' in raw && !('fp' in raw)) {
      return toCachedPayload({ data: raw.data, timestamp: raw.timestamp, fp: 'legacy' });
    }

    // Primary check: baked-in effective fingerprint (immediate on deploy)
    if (raw.fp && raw.fp !== effectiveFp) {
      localStorage.removeItem(key);
      return null;
    }

    // Secondary check: stored fingerprint (lazy, updated from API responses)
    const storedFp = localStorage.getItem(SCHEMA_FP_KEY);
    if (storedFp && raw.fp && raw.fp !== storedFp) {
      localStorage.removeItem(key);
      return null;
    }

    return toCachedPayload(raw as CacheEntry<T>);
  } catch (error) {
    console.warn(`Failed to read cache for ${key}:`, error); // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
    return null;
  }
}

// Helper to set cache entry
function setCacheEntry<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date().toISOString(),
      fp: effectiveFp,
    };
    localStorage.setItem(key, JSON.stringify(entry));
    // Keep the lazy fingerprint key in sync for the secondary check
    localStorage.setItem(SCHEMA_FP_KEY, effectiveFp);
  } catch (error) {
    console.warn(`Failed to write cache for ${key}:`, error); // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
  }
}

function normalizeSymbolKey(symbol: string): string {
  return symbol.trim().toLowerCase();
}

// Runtime drift detection: when the API reports a different schema
// fingerprint than what's baked into this bundle, update the lazy
// reference so getCacheEntry's secondary check invalidates stale
// entries on next access. This handles "backend deployed new schema
// but frontend hasn't rebuilt yet".
export function updateSchemaFingerprintFromApi(apiFp: string, storage: StorageLike = localStorage): void {
  const newFp = `${apiFp}:${CACHE_VERSION}`;
  storage.setItem(SCHEMA_FP_KEY, newFp);
}

export function clearLegacyCacheEntries(storage: StorageLike = localStorage): void {
  for (const key of LEGACY_CACHE_KEYS) {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove legacy cache key ${key}:`, error); // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
    }
  }
}

// Markets cache
type DeficitFields = { deficit?: string | null; tokenPrice?: number | null };
export const isDeficitWithoutPrice = (r: DeficitFields): boolean =>
  !!r.deficit && r.deficit !== '0' && r.deficit !== '' &&
  (r.tokenPrice == null || !Number.isFinite(r.tokenPrice) || r.tokenPrice <= 0);

export function sanitizeDeficitWithoutPrice(data: MarketsResponse): void {
  const reserves = data?.reserves;
  if (!Array.isArray(reserves)) return;
  for (const r of reserves) {
    if (isDeficitWithoutPrice(r)) {
      r.deficit = '';
    }
  }
}

export function getCachedMarketsEntry(): CachedPayload<MarketsResponse> | null {
  const entry = getCacheEntry<MarketsResponse>(CACHE_KEYS.MARKETS);
  if (!entry) return null;
  sanitizeDeficitWithoutPrice(entry.data);
  return entry;
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

// Merkl forecast states cache
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
