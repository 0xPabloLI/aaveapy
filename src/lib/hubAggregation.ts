import type { ReserveWithSpread } from '@/types/aave';

export interface HubAggregate {
  hubSupplied: string;
}

export type HubAssetKey = string;

export function getHubAssetKey(reserve: ReserveWithSpread): HubAssetKey | null {
  if (!reserve.hubId) return null;
  return `${reserve.hubId}:${reserve.tokenAddress}`;
}

export function buildHubAggregationMap(
  reserves: readonly ReserveWithSpread[]
): Map<HubAssetKey, HubAggregate> {
  const acc = new Map<HubAssetKey, { supplied: bigint }>();

  for (const r of reserves) {
    if (!r.hubId) continue;
    const key = getHubAssetKey(r);
    if (!key) continue;

    const existing = acc.get(key) ?? { supplied: 0n };
    existing.supplied += BigInt(r.supplied || '0');
    acc.set(key, existing);
  }

  const result = new Map<HubAssetKey, HubAggregate>();
  for (const [key, agg] of acc) {
    result.set(key, {
      hubSupplied: agg.supplied.toString(),
    });
  }
  return result;
}
