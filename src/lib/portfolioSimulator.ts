import type { ReserveWithSpread, MerklForecastWireItem } from '@/types/aave';
import type {
  PortfolioPositionResult,
  PortfolioReserveEntry,
  PortfolioSideData,
  PortfolioSummary,
  PortfolioSimulationMetric,
  PortfolioSide,
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
  totalSupplyUsd?: number;
  totalBorrowUsd?: number;
}

interface SimulateCommonArgs {
  reserves: ReserveWithSpread[];
  hubAggregationMap?: Map<HubAssetKey, HubAggregate>;
  isApy: boolean;
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
  forecastStates: Record<string, MerklForecastWireItem>;
}

export interface SimulatePortfolioEntriesArgs extends SimulateCommonArgs {
  entries: PortfolioReserveEntry[];
}

export interface SimulatePortfolioResult {
  results: PortfolioPositionResult[];
  summary: PortfolioSummary;
}

interface SideSlot {
  sideData: PortfolioSideData;
  reserveId: string;
}

interface EntryGroup {
  supplySlots: SideSlot[];
  borrowSlots: SideSlot[];
  supplyUsd: number;
  borrowUsd: number;
  supplyDeltaUsd: number;
  borrowDeltaUsd: number;
}

const DAYS_PER_YEAR = 365;

export function buildMetricsFromLane(
  lane: SimulationLane,
  side: 'supply' | 'borrow',
  amountUsd: number,
  isApy: boolean = false,
): BuildPositionResultMetrics {
  const nativeMetric: PortfolioSimulationMetric = {
    current: lane.currentNative,
    after: lane.afterNative,
    delta: lane.deltaNative,
  };
  const incentiveMetric: PortfolioSimulationMetric = {
    current: lane.currentIncentive,
    after: lane.hasInput ? lane.afterIncentive : null,
    delta: lane.hasInput ? lane.deltaIncentive : null,
  };
  const totalMetric: PortfolioSimulationMetric = {
    current: lane.currentTotal,
    after: lane.hasInput ? lane.afterTotal : null,
    delta: lane.hasInput ? lane.deltaTotal : null,
  };

  const currentUsdPerDay = computePositionUsdPerDay(
    side,
    amountUsd,
    lane.currentNative ?? 0,
    lane.currentIncentive,
    isApy,
  );
  const afterUsdPerDay = lane.hasInput
    ? computePositionUsdPerDay(
        side,
        amountUsd,
        lane.afterNative ?? 0,
        lane.afterIncentive ?? 0,
        isApy,
      )
    : null;
  const usdPerDayMetric: PortfolioSimulationMetric = {
    current: currentUsdPerDay,
    after: afterUsdPerDay,
    delta: afterUsdPerDay !== null ? afterUsdPerDay - currentUsdPerDay : null,
  };

  return { nativeMetric, incentiveMetric, totalMetric, usdPerDayMetric };
}

function buildGroupMapFromSlots(
  slots: Iterable<SideSlot>,
  side: PortfolioSide,
  reserveMap: Map<string, ReserveWithSpread>,
  groupMap: Map<string, EntryGroup>,
): void {
  for (const slot of slots) {
    const key = getReserveKey({ reserveId: slot.reserveId });
    const reserve = reserveMap.get(key);
    const amountUsd = resolvePositionAmountUsd(slot.sideData, reserve);
    if (amountUsd <= 0 || !reserve) continue;

    const delta = computeDelta({
      amount: slot.sideData.amount,
      walletValue: slot.sideData.walletValue,
      inputMode: slot.sideData.inputMode,
      tokenPrice: reserve.tokenPrice,
    });

    const existing = groupMap.get(key) ?? {
      supplySlots: [],
      borrowSlots: [],
      supplyUsd: 0,
      borrowUsd: 0,
      supplyDeltaUsd: 0,
      borrowDeltaUsd: 0,
    };

    if (side === 'supply') {
      existing.supplySlots.push(slot);
      existing.supplyUsd += delta.effectiveAmountUsd;
      existing.supplyDeltaUsd += delta.deltaUsd;
    } else {
      existing.borrowSlots.push(slot);
      existing.borrowUsd += delta.effectiveAmountUsd;
      existing.borrowDeltaUsd += delta.deltaUsd;
    }
    groupMap.set(key, existing);
  }
}

function computeResultsFromGroups(
  groupMap: Map<string, EntryGroup>,
  reserveMap: Map<string, ReserveWithSpread>,
  hubMap: Map<HubAssetKey, HubAggregate>,
  isApy: boolean,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined,
  tydroPointToUsdRate: number,
  forecastStates: Record<string, MerklForecastWireItem>,
): PortfolioPositionResult[] {
  const results: PortfolioPositionResult[] = [];

  const crossReservePositions = new Map<string, ReservePositions>();
  const reserveSymbolById = new Map<string, string>();
  for (const [key, group] of groupMap) {
    const reserve = reserveMap.get(key);
    if (!reserve) continue;
    if (group.supplyUsd > 0 || group.borrowUsd > 0) {
      crossReservePositions.set(reserve.reserveId, {
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
        totalSupplyUsd: group.supplyUsd,
        totalBorrowUsd: group.borrowUsd,
        forecastStates,
        crossReservePositions,
        reserveSymbolById,
        hubSupplied: hubAgg?.hubSupplied,
        hubBorrowed: hubAgg?.hubBorrowed,
      });

      for (const slot of group.supplySlots) {
        const amountUsd = resolvePositionAmountUsd(slot.sideData, reserve);
        const nativePercent = simResult.supply.hasInput
          ? (simResult.supply.afterNative ?? simResult.supply.currentNative ?? reserve.supplyApy ?? 0)
          : (simResult.supply.currentNative ?? reserve.supplyApy ?? 0);
        const incentivePercent = simResult.supply.hasInput
          ? (simResult.supply.afterIncentive ?? simResult.supply.currentIncentive ?? 0)
          : (simResult.supply.currentIncentive ?? 0);
        const metrics = buildMetricsFromLane(simResult.supply, 'supply', amountUsd, isApy);
        results.push(
          buildPortfolioPositionResult(slot.reserveId, 'supply', amountUsd, nativePercent, incentivePercent, metrics, isApy),
        );
      }

      for (const slot of group.borrowSlots) {
        const amountUsd = resolvePositionAmountUsd(slot.sideData, reserve);
        const nativePercent = simResult.borrow.hasInput
          ? (simResult.borrow.afterNative ?? simResult.borrow.currentNative ?? reserve.borrowApy ?? 0)
          : (simResult.borrow.currentNative ?? reserve.borrowApy ?? 0);
        const incentivePercent = simResult.borrow.hasInput
          ? (simResult.borrow.afterIncentive ?? simResult.borrow.currentIncentive ?? 0)
          : (simResult.borrow.currentIncentive ?? 0);
        const metrics = buildMetricsFromLane(simResult.borrow, 'borrow', amountUsd, isApy);
        results.push(
          buildPortfolioPositionResult(slot.reserveId, 'borrow', amountUsd, nativePercent, incentivePercent, metrics, isApy),
        );
      }
    } else {
      for (const slot of group.supplySlots) {
        const amountUsd = resolvePositionAmountUsd(slot.sideData, reserve);
        const nativePercent = reserve.supplyApy ?? 0;
        const incentiveArr = reserve.supplyIncentives ?? [];
        const incentivePercent = incentiveArr.reduce((s, v) => s + v, 0);
        results.push(
          buildPortfolioPositionResult(slot.reserveId, 'supply', amountUsd, nativePercent, incentivePercent, undefined, isApy),
        );
      }

      for (const slot of group.borrowSlots) {
        const amountUsd = resolvePositionAmountUsd(slot.sideData, reserve);
        const nativePercent = reserve.borrowApy ?? 0;
        const incentiveArr = reserve.borrowIncentives ?? [];
        const incentivePercent = incentiveArr.reduce((s, v) => s + v, 0);
        results.push(
          buildPortfolioPositionResult(slot.reserveId, 'borrow', amountUsd, nativePercent, incentivePercent, undefined, isApy),
        );
      }
    }
  }

  return results;
}

export function simulatePortfolioFromEntries(
  args: SimulatePortfolioEntriesArgs,
): SimulatePortfolioResult {
  const {
    entries,
    reserves,
    hubAggregationMap: externalHubMap,
    isApy,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
    forecastStates,
  } = args;

  const visibleEntries = entries.filter((e) => !e.hidden && !e.isOrphan);
  if (visibleEntries.length === 0) {
    return { results: [], summary: aggregatePortfolioSummary([]) };
  }

  const hubMap = externalHubMap ?? buildHubAggregationMap(reserves);
  const reserveMap = new Map(reserves.map((r) => [getReserveKey(r), r]));

  const groupMap = new Map<string, EntryGroup>();

  const supplySlots: SideSlot[] = [];
  const borrowSlots: SideSlot[] = [];
  for (const e of visibleEntries) {
    if (e.supply.amount !== '' || e.supply.walletValue !== null) {
      supplySlots.push({ sideData: e.supply, reserveId: e.reserveId });
    }
    if (e.borrow.amount !== '' || e.borrow.walletValue !== null) {
      borrowSlots.push({ sideData: e.borrow, reserveId: e.reserveId });
    }
  }

  buildGroupMapFromSlots(supplySlots, 'supply', reserveMap, groupMap);
  buildGroupMapFromSlots(borrowSlots, 'borrow', reserveMap, groupMap);

  if (groupMap.size === 0) {
    return { results: [], summary: aggregatePortfolioSummary([]) };
  }

  const results = computeResultsFromGroups(
    groupMap, reserveMap, hubMap, isApy, whitelistMerklCampaignIds, tydroPointToUsdRate, forecastStates,
  );

  return {
    results,
    summary: aggregatePortfolioSummary(results),
  };
}

export function buildPerReserveInputsFromEntries(
  entries: PortfolioReserveEntry[],
  reserves: ReserveWithSpread[],
): Map<string, PerReserveInput> {
  const reserveMap = new Map(reserves.map((r) => [getReserveKey(r), r]));
  const grouped = new Map<
    string,
    { supplyUsd: number; borrowUsd: number; supplyDeltaUsd: number; borrowDeltaUsd: number }
  >();

  for (const entry of entries) {
    if (entry.hidden || entry.isOrphan) continue;
    const key = getReserveKey({ reserveId: entry.reserveId });
    const reserve = reserveMap.get(key);
    if (!reserve) continue;

    for (const side of ['supply', 'borrow'] as const) {
      const s = entry[side];
      const amountUsd = resolvePositionAmountUsd(s, reserve);
      if (amountUsd <= 0) continue;

      const delta = computeDelta({
        amount: s.amount,
        walletValue: s.walletValue,
        inputMode: s.inputMode,
        tokenPrice: reserve.tokenPrice,
      });

      const existing = grouped.get(entry.reserveId) ?? {
        supplyUsd: 0,
        borrowUsd: 0,
        supplyDeltaUsd: 0,
        borrowDeltaUsd: 0,
      };
      if (side === 'supply') {
        existing.supplyUsd += delta.effectiveAmountUsd;
        existing.supplyDeltaUsd += delta.deltaUsd;
      } else {
        existing.borrowUsd += delta.effectiveAmountUsd;
        existing.borrowDeltaUsd += delta.deltaUsd;
      }
      grouped.set(entry.reserveId, existing);
    }
  }

  const result = new Map<string, PerReserveInput>();
  for (const [reserveId, group] of grouped) {
    result.set(reserveId, {
      supplyInput: String(group.supplyDeltaUsd),
      borrowInput: String(group.borrowDeltaUsd),
      inputMode: 'usd',
      totalSupplyUsd: group.supplyUsd,
      totalBorrowUsd: group.borrowUsd,
    });
  }
  return result;
}
