import type { ReserveWithSpread, MerklForecastWireItem } from '@/types/aave';
import type {
  PortfolioPosition,
  PortfolioPositionResult,
  PortfolioSummary,
  PortfolioSimulationMetric,
} from '@/types/portfolio';
import type { ScenarioInputMode, SimulationLane } from '@/lib/rateSimulationCalculator';
import { buildRateSimulationResult } from '@/lib/rateSimulationCalculator';
import {
  buildPortfolioPositionResult,
  resolvePositionAmountUsd,
  aggregatePortfolioSummary,
  computePositionUsdPerDay,
  type BuildPositionResultMetrics,
} from '@/lib/portfolioCalculator';
import { hasRateCalcFields } from '@/lib/interestRateCalculator';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import { buildHubAggregationMap, getHubAssetKey } from '@/lib/hubAggregation';
import type { HubAggregate, HubAssetKey } from '@/lib/hubAggregation';
import { getReserveKey } from '@/lib/reserveKey';
import type { ReservePositions } from '@/lib/netLendingCrossReserve';
import { computeDelta } from '@/lib/deltaCalculator';

export interface PerReserveInput {
  supplyInput: string;
  borrowInput: string;
  inputMode: ScenarioInputMode;
  principalSupplyUsd?: number;
  principalBorrowUsd?: number;
}

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
  supplyDeltaUsd: number;
  borrowDeltaUsd: number;
}

const DAYS_PER_YEAR = 365;

function buildMetricsFromLane(
  lane: SimulationLane,
  side: 'supply' | 'borrow',
  amountUsd: number,
): BuildPositionResultMetrics {
  const nativeMetric: PortfolioSimulationMetric = {
    current: lane.currentNative,
    after: lane.afterNative,
    delta: lane.deltaNative,
  };
  const incentiveMetric: PortfolioSimulationMetric = {
    current: lane.currentIncentive,
    after: lane.afterIncentive,
    delta: lane.deltaIncentive,
  };
  const totalMetric: PortfolioSimulationMetric = {
    current: lane.currentTotal,
    after: lane.afterTotal,
    delta: lane.deltaTotal,
  };

  const currentUsdPerDay = computePositionUsdPerDay(
    side,
    amountUsd,
    lane.currentNative ?? 0,
    lane.currentIncentive,
  );
  const afterUsdPerDay = computePositionUsdPerDay(
    side,
    amountUsd,
    lane.afterNative ?? 0,
    lane.afterIncentive ?? 0,
  );
  const usdPerDayMetric: PortfolioSimulationMetric = {
    current: currentUsdPerDay,
    after: afterUsdPerDay,
    delta: afterUsdPerDay - currentUsdPerDay,
  };

  return { nativeMetric, incentiveMetric, totalMetric, usdPerDayMetric };
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

    const delta = computeDelta({
      amount: pos.amount,
      walletValue: pos.walletValue,
      inputMode: pos.inputMode,
      tokenPrice: reserve.tokenPrice,
    });

    const existing = groupMap.get(key) ?? {
      supplyPositions: [],
      borrowPositions: [],
      supplyUsd: 0,
      borrowUsd: 0,
      supplyDeltaUsd: 0,
      borrowDeltaUsd: 0,
    };

    if (pos.side === 'supply') {
      existing.supplyPositions.push(pos);
      existing.supplyUsd += delta.effectiveAmountUsd;
      existing.supplyDeltaUsd += delta.deltaUsd;
    } else {
      existing.borrowPositions.push(pos);
      existing.borrowUsd += delta.effectiveAmountUsd;
      existing.borrowDeltaUsd += delta.deltaUsd;
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

    const hubKey = reserve.hubId ? getHubAssetKey(reserve) : null;
    const hubAgg = hubKey ? hubMap.get(hubKey) : undefined;

    if (reserveRateInput && hubAgg) {
      reserveRateInput.borrowed = hubAgg.hubBorrowed;
      reserveRateInput.hubBorrowed = hubAgg.hubBorrowed;
      reserveRateInput.hubSupplied = hubAgg.hubSupplied;
    }

    if (reserveRateInput) {
      const simResult = buildRateSimulationResult({
        reserve,
        reserveRateInput,
        isApy,
        whitelistMerklCampaignIds,
        tydroPointToUsdRate,
        tokenPrice: reserve.tokenPrice,
        supplyInput: String(group.supplyDeltaUsd),
        borrowInput: String(group.borrowDeltaUsd),
        inputMode: 'usd',
        principalSupplyUsd: group.supplyUsd,
        principalBorrowUsd: group.borrowUsd,
        forecastStates,
        reservePositions,
        reserveSymbolById,
        hubSupplied: hubAgg?.hubSupplied,
        hubBorrowed: hubAgg?.hubBorrowed,
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
        const metrics = buildMetricsFromLane(simResult.supply, 'supply', amountUsd);
        results.push(
          buildPortfolioPositionResult(pos, amountUsd, nativePercent, incentivePercent, metrics),
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
        const metrics = buildMetricsFromLane(simResult.borrow, 'borrow', amountUsd);
        results.push(
          buildPortfolioPositionResult(pos, amountUsd, nativePercent, incentivePercent, metrics),
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

export function buildPerReserveInputs(
  positions: PortfolioPosition[],
  reserves: ReserveWithSpread[],
): Map<string, PerReserveInput> {
  const reserveMap = new Map(reserves.map((r) => [getReserveKey(r), r]));
  const grouped = new Map<
    string,
    { supplyUsd: number; borrowUsd: number; supplyDeltaUsd: number; borrowDeltaUsd: number }
  >();

  for (const pos of positions) {
    if (pos.hidden || pos.isOrphan) continue;
    const key = getReserveKey({ reserveId: pos.reserveId });
    const reserve = reserveMap.get(key);
    if (!reserve) continue;
    const amountUsd = resolvePositionAmountUsd(pos, reserve);
    if (amountUsd <= 0) continue;

    const delta = computeDelta({
      amount: pos.amount,
      walletValue: pos.walletValue,
      inputMode: pos.inputMode,
      tokenPrice: reserve.tokenPrice,
    });

    const existing = grouped.get(pos.reserveId) ?? {
      supplyUsd: 0,
      borrowUsd: 0,
      supplyDeltaUsd: 0,
      borrowDeltaUsd: 0,
    };
    if (pos.side === 'supply') {
      existing.supplyUsd += delta.effectiveAmountUsd;
      existing.supplyDeltaUsd += delta.deltaUsd;
    } else {
      existing.borrowUsd += delta.effectiveAmountUsd;
      existing.borrowDeltaUsd += delta.deltaUsd;
    }
    grouped.set(pos.reserveId, existing);
  }

  const result = new Map<string, PerReserveInput>();
  for (const [reserveId, group] of grouped) {
    result.set(reserveId, {
      supplyInput: String(group.supplyDeltaUsd),
      borrowInput: String(group.borrowDeltaUsd),
      inputMode: 'usd',
      principalSupplyUsd: group.supplyUsd,
      principalBorrowUsd: group.borrowUsd,
    });
  }
  return result;
}
