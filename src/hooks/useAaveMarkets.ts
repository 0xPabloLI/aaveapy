import { useQuery } from '@tanstack/react-query';
import { MarketsResponse } from '@/types/aave';
import {
  getCachedMarkets,
  setCachedMarkets,
  getCachedMarketsEntry,
  sanitizeDeficitWithoutPrice,
  updateSchemaFingerprintFromApi,
} from '@/lib/cache';
import { SCHEMA_FP } from '@/shared/schema-fingerprint';
import { API_BASE } from '@/lib/apiBase';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { MarketsResponseSchema } from '@/lib/apiSchemas';

// Fetch all market data — validated against MarketsResponseSchema (single source of truth)
export const fetchMarkets = async (): Promise<MarketsResponse> => {
  try {
    const response = await fetch(`${API_BASE}/markets`);
    if (!response.ok) throw new Error('Failed to fetch markets');
    const raw = await response.json();
    const parsed = MarketsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error('Markets API schema validation failed:', parsed.error.message);
      throw new Error(`Invalid markets response: ${parsed.error.message}`);
    }
    const data = parsed.data as MarketsResponse;
    sanitizeDeficitWithoutPrice(data);

    // Runtime drift detection: if backend deployed a new schema before
    // frontend was rebuilt, update the lazy fingerprint so cached entries
    // from the old schema are invalidated on next access.
    if (data.snapshot?.schemaFingerprint && data.snapshot.schemaFingerprint !== SCHEMA_FP) {
      updateSchemaFingerprintFromApi(data.snapshot.schemaFingerprint);
    }

    setCachedMarkets(data);
    return data;
  } catch (error) {
    // Try to get from cache on failure
    const cached = getCachedMarkets();
    if (cached) {
      console.warn('Using cached markets data due to fetch error:', error);
      return cached;
    }
    // Re-throw if no cache available
    throw error;
  }
};

export const useAaveMarkets = () => {
  const cachedEntry = getCachedMarketsEntry();
  const marketsStaleTime =
    cachedEntry?.data?.snapshot?.staleTimeMs ?? QUERY_STALE_TIMES.coreSnapshotApi;
  return useQuery({
    queryKey: ['aave-markets'],
    queryFn: fetchMarkets,
    staleTime: marketsStaleTime,
    initialData: cachedEntry?.data,
    initialDataUpdatedAt: cachedEntry?.updatedAt,
  });
};
