import { MarketsResponse, MarketStats, MarketListItem } from '@/types/aave';

const CACHE_KEYS = {
  MARKETS: 'aave-markets-cache',
  MARKET_STATS: 'aave-market-stats-cache',
  MARKETS_LIST: 'aave-markets-list-cache',
  TYDRO_RATE: 'tydro-point-usd-rate',
} as const;

const CACHE_VERSION = '1.0.0';

interface CacheEntry<T> {
  data: T;
  timestamp: string;
  version: string;
}

// Helper to get cache entry
function getCacheEntry<T>(key: string): CacheEntry<T> | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const entry: CacheEntry<T> = JSON.parse(cached);
    
    // Check version compatibility
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }
    
    return entry;
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

// Markets cache
export function getCachedMarkets(): MarketsResponse | null {
  const entry = getCacheEntry<MarketsResponse>(CACHE_KEYS.MARKETS);
  return entry?.data || null;
}

export function setCachedMarkets(data: MarketsResponse): void {
  setCacheEntry(CACHE_KEYS.MARKETS, data);
}

// Market stats cache
export function getCachedMarketStats(): MarketStats | null {
  const entry = getCacheEntry<MarketStats>(CACHE_KEYS.MARKET_STATS);
  return entry?.data || null;
}

export function setCachedMarketStats(data: MarketStats): void {
  setCacheEntry(CACHE_KEYS.MARKET_STATS, data);
}

// Markets list cache
export function getCachedMarketsList(): MarketListItem[] | null {
  const entry = getCacheEntry<MarketListItem[]>(CACHE_KEYS.MARKETS_LIST);
  return entry?.data || null;
}

export function setCachedMarketsList(data: MarketListItem[]): void {
  setCacheEntry(CACHE_KEYS.MARKETS_LIST, data);
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
