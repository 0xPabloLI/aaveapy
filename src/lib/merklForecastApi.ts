import { API_BASE } from '@/lib/apiBase';
import type { MerklForecastStatesBatchResponse } from '@/types/aave';
import { MerklForecastApiError } from './merklForecastErrors';

const ALL_CAMPAIGNS_KEY = '__all__';

const batchCache = new Map<string, { data: MerklForecastStatesBatchResponse; expiresAt: number }>();
const batchInFlight = new Map<string, Promise<MerklForecastStatesBatchResponse>>();

function normalizeCampaignIds(campaignIds?: string[]): string[] {
  return Array.from(new Set((campaignIds ?? []).map((id) => id.trim()).filter(Boolean)));
}

function buildBatchKey(campaignIds: string[]): string {
  if (campaignIds.length === 0) return ALL_CAMPAIGNS_KEY;
  return [...campaignIds].sort().join(',');
}

function pickCampaignsFromBatch(
  batch: MerklForecastStatesBatchResponse,
  campaignIds: string[]
): MerklForecastStatesBatchResponse {
  if (campaignIds.length === 0) return batch;
  const idSet = new Set(campaignIds);
  return {
    items: batch.items.filter((item) => idSet.has(item.campaignId)),
    errors: batch.errors.filter((item) => idSet.has(item.campaignId)),
  };
}

export function __resetMerklForecastApiCacheForTests(): void {
  batchCache.clear();
  batchInFlight.clear();
}

export const fetchMerklForecastStates = async (
  campaignIds?: string[]
): Promise<MerklForecastStatesBatchResponse> => {
  const deduped = normalizeCampaignIds(campaignIds);
  const key = buildBatchKey(deduped);
  const now = Date.now();
  const cachedBatch = batchCache.get(key);
  if (cachedBatch && cachedBatch.expiresAt > now) {
    return cachedBatch.data;
  }

  // Reuse fresh full-batch cache for subset requests to avoid network churn.
  if (key !== ALL_CAMPAIGNS_KEY) {
    const fullBatch = batchCache.get(ALL_CAMPAIGNS_KEY);
    if (fullBatch && fullBatch.expiresAt > now) {
      return pickCampaignsFromBatch(fullBatch.data, deduped);
    }
  }

  const existing = batchInFlight.get(key);
  if (existing) {
    return existing;
  }

  // If full-batch request is already in-flight, piggyback subset requests on it.
  if (key !== ALL_CAMPAIGNS_KEY) {
    const fullInFlight = batchInFlight.get(ALL_CAMPAIGNS_KEY);
    if (fullInFlight) {
      return fullInFlight.then((batch) => pickCampaignsFromBatch(batch, deduped));
    }
  }

  const url =
    deduped.length > 0
      ? `${API_BASE}/campaigns/forecast-states?ids=${encodeURIComponent(deduped.join(','))}`
      : `${API_BASE}/campaigns/forecast-states`;
  const request = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new MerklForecastApiError(`Failed to fetch Merkl forecast states (${response.status})`, response.status);
      }

      const data = (await response.json()) as MerklForecastStatesBatchResponse;
      const ttlMs = typeof data.staleTimeMs === 'number' && data.staleTimeMs > 0 ? data.staleTimeMs : undefined;
      const effectiveTtl = ttlMs ?? 60_000;
      batchCache.set(key, { data, expiresAt: Date.now() + effectiveTtl });

      return data;
    } finally {
      batchInFlight.delete(key);
    }
  })();

  batchInFlight.set(key, request);
  return request;
};
