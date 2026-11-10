import { useQuery } from '@tanstack/react-query';
import { MarketsResponse } from '@/types/aave';
import {
  getCachedMarkets,
  setCachedMarkets,
  getCachedMarketsEntry,
  sanitizeDeficitWithoutPrice,
  updateSchemaFingerprintFromApi,
} from '@/lib/cache';
import { API_BASE } from '@/lib/apiBase';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { MarketsResponseSchema } from '@/lib/apiSchemas';
import { enrichReservesFromId } from '@/lib/reserveIdParser';
import { fetchWithTracing } from '@/lib/requestContext';
import { logger } from '@/lib/logger';

// Fetch all market data — validated against MarketsResponseSchema (single source of truth)
export const fetchMarkets = async (): Promise<MarketsResponse> => {
  try {
    const response = await fetchWithTracing(`${API_BASE}/markets`);
    if (!response.ok) throw new Error('Failed to fetch markets');
    const raw = await response.json();
    const parsed = MarketsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      logger.error('Markets API schema validation failed', { error: parsed.error.message });
      throw new Error(`Invalid markets response: ${parsed.error.message}`);
    }
    const data = parsed.data as MarketsResponse;
    sanitizeDeficitWithoutPrice(data);
    enrichReservesFromId(data);

    setCachedMarkets(data);

    // Runtime drift detection: keep the lazy fingerprint equal to whatever the
    // API is serving, so getCacheEntry can drop entries written under a schema
    // this bundle no longer matches (backend deployed before frontend rebuilt).
    // Runs on EVERY response rather than only on a mismatch: a value left over
    // from an earlier drift would otherwise never be corrected, and the cache
    // would stay cold for as long as that stale value survived (AAV-1346).
    if (data.snapshot?.schemaFingerprint) {
      updateSchemaFingerprintFromApi(data.snapshot.schemaFingerprint);
    }

    return data;
  } catch (error) {
    // Try to get from cache on failure
    const cached = getCachedMarkets();
    if (cached) {
      logger.warn('Using cached markets data due to fetch error', {
        error: error instanceof Error ? error : String(error),
      });
      return cached;
    }
    // Re-throw if no cache available
    throw error;
  }
};

export const useAaveMarkets = () => {
  const cachedEntry = getCachedMarketsEntry();
  const marketsStaleTime = cachedEntry?.data?.snapshot?.staleTimeMs ?? QUERY_STALE_TIMES.coreSnapshotApi;
  return useQuery({
    queryKey: ['aave-markets'],
    queryFn: fetchMarkets,
    staleTime: marketsStaleTime,
    initialData: cachedEntry?.data,
    initialDataUpdatedAt: cachedEntry?.updatedAt,
  });
};
