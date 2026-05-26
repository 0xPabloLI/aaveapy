import type { ReserveWithSpread, MerklForecastWireItem } from '@/types/aave';
import type {
  PortfolioPosition,
  PortfolioPositionResult,
  PortfolioSummary,
} from '@/types/portfolio';
import { buildRateSimulationResult } from '@/lib/rateSimulationCalculator';
import {
  buildPortfolioPositionResult,
  resolvePositionAmountUsd,
  aggregatePortfolioSummary,
} from '@/lib/portfolioCalculator';
import { hasRateCalcFields } from '@/lib/interestRateCalculator';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import { buildHubAggregationMap, getHubAssetKey } from '@/lib/hubAggregation';
import type { HubAggregate, HubAssetKey } from '@/lib/hubAggregation';
import { getReserveKey } from '@/lib/reserveKey';
import type { ReservePositions } from '@/lib/netLendingCrossReserve';

export interface SimulatePortfolioPositionsArgs {
  positions: PortfolioPosition[];
  reserves: ReserveWithSpread[];
  hubAggregationMap?: Map<HubAssetKey, HubAggregate>;
  isApy: boolean;
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
  forecastStates: Record<string, MerklForecastWireItem>;
}

export interface SimulatePortfolioPositionsResult {
  results: PortfolioPositionResult[];
  summary: PortfolioSummary;
}

interface PositionGroup {
  supplyPositions: PortfolioPosition[];
  borrowPositions: PortfolioPosition[];
  supplyUsd: number;
  borrowUsd: number;
}

export function simulatePortfolioPositions(
  args: SimulatePortfolioPositionsArgs,
): SimulatePortfolioPositionsResult {
  const {
    positions,
    reserves,
    hubAggregationMap: externalHubMap,
    isApy,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
    forecastStates,
  } = args;

  if (positions.length === 0) {
    return { results: [], summary: aggregatePortfolioSummary([]) };
  }

  const hubMap = externalHubMap ?? buildHubAggregationMap(reserves);
  const reserveMap = new Map(reserves.map((r) => [getReserveKey(r), r]));

  const groupMap = new Map<string, PositionGroup>();
  for (const pos of positions) {
    const key = getReserveKey({ reserveId: pos.reserveId });
    const reserve = reserveMap.get(key);
    const amountUsd = resolvePositionAmountUsd(pos, reserve);
    if (amountUsd <= 0 || !reserve) continue;

    const existing = groupMap.get(key) ?? {
      supplyPositions: [],
      borrowPositions: [],
      supplyUsd: 0,
      borrowUsd: 0,
    };

    if (pos.side === 'supply') {
      existing.supplyPositions.push(pos);
      existing.supplyUsd += amountUsd;
    } else {
      existing.borrowPositions.push(pos);
      existing.borrowUsd += amountUsd;
    }
    groupMap.set(key, existing);
  }

  const results: PortfolioPositionResult[] = [];

  const reservePositions = new Map<string, ReservePositions>();
  const reserveSymbolById = new Map<string, string>();
  for (const [key, group] of groupMap) {
    const reserve = reserveMap.get(key);
    if (!reserve) continue;
    if (group.supplyUsd > 0 || group.borrowUsd > 0) {
      reservePositions.set(reserve.reserveId, {
        supplyUsd: group.supplyUsd,
        borrowUsd: group.borrowUsd,
      });
    }
    if (reserve.tokenSymbol) {
      reserveSymbolById.set(reserve.reserveId, reserve.tokenSymbol);
    }
  }

  for (const [key, group] of groupMap) {
    const reserve = reserveMap.get(key);
    if (!reserve) continue;

    const reserveRateInput: RateCalcInput | null = hasRateCalcFields(reserve)
      ? { ...reserve }
      : null;

    if (reserveRateInput && reserve.hubId) {
      const hubKey = getHubAssetKey(reserve);
      const hubAgg = hubKey ? hubMap.get(hubKey) : undefined;
      if (hubAgg) {
        reserveRateInput.borrowed = hubAgg.hubBorrowed;
        reserveRateInput.hubBorrowed = hubAgg.hubBorrowed;
        reserveRateInput.hubSupplied = hubAgg.hubSupplied;
      }
    }

    if (reserveRateInput) {
      const simResult = buildRateSimulationResult({
        reserve,
        reserveRateInput,
        isApy,
        whitelistMerklCampaignIds,
        tydroPointToUsdRate,
        tokenPrice: reserve.tokenPrice,
        supplyInput: String(group.supplyUsd),
        borrowInput: String(group.borrowUsd),
        inputMode: 'usd',
        forecastStates,
        reservePositions,
        reserveSymbolById,
      });

      for (const pos of group.supplyPositions) {
        const amountUsd = resolvePositionAmountUsd(pos, reserve);
        const nativePercent =
          simResult.supply.afterNative ??
          simResult.supply.currentNative ??
          reserve.supplyApy ??
          0;
        const incentivePercent =
          simResult.supply.afterIncentive ??
          simResult.supply.currentIncentive ??
          0;
        results.push(
          buildPortfolioPositionResult(pos, amountUsd, nativePercent, incentivePercent),
        );
      }

      for (const pos of group.borrowPositions) {
        const amountUsd = resolvePositionAmountUsd(pos, reserve);
        const nativePercent =
          simResult.borrow.afterNative ??
          simResult.borrow.currentNative ??
          reserve.borrowApy ??
          0;
        const incentivePercent =
          simResult.borrow.afterIncentive ??
          simResult.borrow.currentIncentive ??
          0;
        results.push(
          buildPortfolioPositionResult(pos, amountUsd, nativePercent, incentivePercent),
        );
      }
    } else {
      for (const pos of group.supplyPositions) {
        const amountUsd = resolvePositionAmountUsd(pos, reserve);
        const nativePercent = reserve.supplyApy ?? 0;
        const incentiveArr = reserve.supplyIncentives ?? [];
        const incentivePercent = incentiveArr.reduce((s, v) => s + v, 0);
        results.push(
          buildPortfolioPositionResult(pos, amountUsd, nativePercent, incentivePercent),
        );
      }

      for (const pos of group.borrowPositions) {
        const amountUsd = resolvePositionAmountUsd(pos, reserve);
        const nativePercent = reserve.borrowApy ?? 0;
        const incentiveArr = reserve.borrowIncentives ?? [];
        const incentivePercent = incentiveArr.reduce((s, v) => s + v, 0);
        results.push(
          buildPortfolioPositionResult(pos, amountUsd, nativePercent, incentivePercent),
        );
      }
    }
  }

  return {
    results,
    summary: aggregatePortfolioSummary(results),
  };
}
