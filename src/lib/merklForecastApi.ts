import { API_BASE } from '@/lib/apiBase';
import { SideDataMetaResponseSchema } from '@/lib/apiSchemas';
import type { MerklForecastStatesBatchResponse } from '@/types/aave';
import { MerklForecastApiError } from './merklForecastErrors';

const ALL_CAMPAIGNS_KEY = '__all__';
const DEFAULT_TTL_MS = 600_000;

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

  // Fetch forecast from merged side-data API
  const url = `${API_BASE}/meta/side-data`;
  const request = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new MerklForecastApiError(`Failed to fetch side-data meta (${response.status})`, response.status);
      }

      const raw = await response.json();
      const parsed = SideDataMetaResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new MerklForecastApiError('Invalid side-data response format', 500);
      }

      const forecast = parsed.data.forecast;
      if (!forecast) {
        return { items: [], errors: [], staleTimeMs: DEFAULT_TTL_MS };
      }

      const data: MerklForecastStatesBatchResponse = {
        items: forecast.items.map((item) => ({
          campaignId: item.campaignId,
          campaignType: item.campaignType,
          plannedDaily: item.plannedDaily,
          requiredDaily: item.requiredDaily,
          aprCap: item.aprCap ?? undefined,
          totalBudget: item.totalBudget,
          distributedSoFar: item.distributedSoFar,
          latestTvl: item.latestTvl,
          endTimestamp: item.endTimestamp,
        })),
        errors: forecast.errors,
        staleTimeMs: forecast.staleTimeMs,
      };

      const effectiveTtl = forecast.staleTimeMs ?? DEFAULT_TTL_MS;
      batchCache.set(ALL_CAMPAIGNS_KEY, { data, expiresAt: Date.now() + effectiveTtl });

      return deduped.length > 0 ? pickCampaignsFromBatch(data, deduped) : data;
    } finally {
      batchInFlight.delete(key);
    }
  })();

  batchInFlight.set(key, request);
  return request;
};
