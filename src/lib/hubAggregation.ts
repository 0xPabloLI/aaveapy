import type { ReserveWithSpread } from '@/types/aave';

export interface HubAggregate {
  hubBorrowed: string;
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
  const acc = new Map<HubAssetKey, { borrowed: bigint; supplied: bigint }>();

  for (const r of reserves) {
    if (!r.hubId) continue;
    const key = getHubAssetKey(r);
    if (!key) continue;

    const existing = acc.get(key) ?? { borrowed: 0n, supplied: 0n };
    existing.borrowed += BigInt(r.borrowed || '0');
    existing.supplied += BigInt(r.supplied || '0');
    acc.set(key, existing);
  }

  const result = new Map<HubAssetKey, HubAggregate>();
  for (const [key, agg] of acc) {
    result.set(key, {
      hubBorrowed: agg.borrowed.toString(),
      hubSupplied: agg.supplied.toString(),
    });
  }
  return result;
}

export function validateHubAggregateConsistency(
  reserves: readonly ReserveWithSpread[],
  hubMap: Map<HubAssetKey, HubAggregate>,
  tolerancePct: number = 5,
): Array<{ reserveId: string; apiUtil: number; calcUtil: number; deltaPct: number }> {
  const warnings: Array<{ reserveId: string; apiUtil: number; calcUtil: number; deltaPct: number }> = [];

  for (const r of reserves) {
    if (!r.hubId || r.utilizationPct == null) continue;
    const key = getHubAssetKey(r);
    if (!key) continue;
    const agg = hubMap.get(key);
    if (!agg) continue;

    const totalBorrowed = BigInt(agg.hubBorrowed);
    const totalSupplied = BigInt(agg.hubSupplied);
    const denominator = totalSupplied + totalBorrowed;
    if (denominator === 0n) continue;

    const calcUtil = Number((totalBorrowed * 100n) / denominator);
    const apiUtil = r.utilizationPct;
    const deltaPct = Math.abs(calcUtil - apiUtil);

    if (deltaPct > tolerancePct) {
      warnings.push({ reserveId: r.reserveId, apiUtil, calcUtil, deltaPct });
    }
  }

  return warnings;
}