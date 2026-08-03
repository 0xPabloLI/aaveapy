import type { ReserveWithSpread, MerklForecastWireItem } from '@/types/aave';
import type {
  PortfolioPositionResult,
  PortfolioReserveEntry,
  PortfolioSideData,
  PortfolioSummary,
  PortfolioSimulationMetric,
  PortfolioSide,
  PortfolioHealthFactor,
} from '@/types/portfolio';
import type { ScenarioInputMode, SimulationLane, SimulationCampaignDetail } from '@/lib/rateSimulationCalculator';
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
import { getReserveKey } from '@/lib/reserveKey';
import type { ReservePositions } from '@/lib/netLendingCrossReserve';
import { parseNumberInput } from '@/lib/numberFormat';

export interface PerReserveInput {
  supplyInput: string;
  borrowInput: string;
  inputMode: ScenarioInputMode;
  totalSupplyUsd?: number;
  totalBorrowUsd?: number;
  /** Wallet-only supply position (excludes manual delta). undefined when no wallet position exists. */
  walletSupplyUsd?: number;
  /** Wallet-only borrow position (excludes manual delta). undefined when no wallet position exists. */
  walletBorrowUsd?: number;
}

export interface PortfolioInputsResult {
  perReserveInputs: Map<string, PerReserveInput>;
  crossReservePositions: Map<string, ReservePositions> | undefined;
  walletCrossReservePositions: Map<string, ReservePositions> | undefined;
  reserveSymbolById: Map<string, string> | undefined;
}

interface SimulateCommonArgs {
  reserves: ReserveWithSpread[];
  isApy: boolean;
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
  forecastStates: Record<string, MerklForecastWireItem>;
}

export interface SimulatePortfolioEntriesArgs extends SimulateCommonArgs {
  entries: PortfolioReserveEntry[];
  /** ReserveId of the entry currently being modified. Used for LTV clamping priority. */
  lastModifiedReserveId?: string;
}

export interface SimulatePortfolioResult {
  results: PortfolioPositionResult[];
  summary: PortfolioSummary;
  /** Per-pool/spoke health factors (AAV-1251). Undefined when no positions. */
  healthFactors?: PortfolioHealthFactor[];
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
  walletSupplyUsd: number | undefined;
  walletBorrowUsd: number | undefined;
}

export function buildMetricsFromLane(
  lane: SimulationLane,
  side: 'supply' | 'borrow',
  amountUsd: number,
  isApy: boolean = false,
  walletUsd?: number,
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

  const currentPrincipalUsd = walletUsd ?? amountUsd;
  const currentUsdPerDay = computePositionUsdPerDay(
    side,
    currentPrincipalUsd,
    lane.currentNative ?? 0,
    lane.currentIncentive,
    isApy,
  );
  const afterUsdPerDay = lane.afterIncentive != null
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
    if (!reserve) continue;

    const s = slot.sideData;
    const hasWalletPosition = s.walletValue !== null && s.walletValue > 0;
    const rawAmount = parseNumberInput(s.amount);
    const hasUserInput = rawAmount > 0;

    // Skip only when there's truly no position (no user input AND no wallet value)
    if (!hasUserInput && !hasWalletPosition) continue;

    const effectiveAmountUsd = hasUserInput
      ? resolvePositionAmountUsd(s, reserve)
      : (s.walletValue ?? 0);
    const deltaUsd = hasUserInput ? (effectiveAmountUsd - (s.walletValue ?? 0)) : 0;

    const existing = groupMap.get(key) ?? {
      supplySlots: [],
      borrowSlots: [],
      supplyUsd: 0,
      borrowUsd: 0,
      supplyDeltaUsd: 0,
      borrowDeltaUsd: 0,
      walletSupplyUsd: undefined,
      walletBorrowUsd: undefined,
    };

    if (side === 'supply') {
      existing.supplySlots.push(slot);
      existing.supplyUsd += effectiveAmountUsd;
      existing.supplyDeltaUsd += deltaUsd;
      if (hasWalletPosition) {
        existing.walletSupplyUsd = (existing.walletSupplyUsd ?? 0) + s.walletValue!;
      }
    } else {
      existing.borrowSlots.push(slot);
      existing.borrowUsd += effectiveAmountUsd;
      existing.borrowDeltaUsd += deltaUsd;
      if (hasWalletPosition) {
        existing.walletBorrowUsd = (existing.walletBorrowUsd ?? 0) + s.walletValue!;
      }
    }
    groupMap.set(key, existing);
  }
}

/**
 * Compute LTV (maxBorrow) clamping per pool/spoke group.
 *
 * Groups borrow entries by (chainId, marketName) — the protocol isolation boundary.
 * Within each group, non-lastModified entries consume capacity first; the
 * lastModified entry receives whatever remaining capacity is left.
 *
 * Returns a Map<SideSlot, number> mapping each borrow slot to its LTV-clamped amount.
 */
function computeLtvClamping(
  groupMap: Map<string, EntryGroup>,
  reserveMap: Map<string, ReserveWithSpread>,
  lastModifiedReserveId: string | undefined,
): Map<SideSlot, number> {
  const ltvClampBySlot = new Map<SideSlot, number>();

  // Build pool groups keyed by (chainId, marketName)
  interface PoolBorrowEntry {
    slot: SideSlot;
    amountUsd: number;
    isLastModified: boolean;
  }
  const poolGroups = new Map<string, {
    totalBorrowCapacity: number;
    borrowEntries: PoolBorrowEntry[];
  }>();

  for (const [key, group] of groupMap) {
    const reserve = reserveMap.get(key);
    if (!reserve) continue;

    const poolKey = `${reserve.chainId}:${reserve.marketName}`;
    const ltv = reserve.ltv ?? 0;
    const collateralContribution = group.supplyUsd * ltv / 100;

    const poolGroup = poolGroups.get(poolKey) ?? {
      totalBorrowCapacity: 0,
      borrowEntries: [],
    };
    poolGroup.totalBorrowCapacity += collateralContribution;

    for (const slot of group.borrowSlots) {
      const resolvedUsd = resolvePositionAmountUsd(slot.sideData, reserve);
      const amountUsd = resolvedUsd > 0 ? resolvedUsd : (slot.sideData.walletValue ?? 0);
      poolGroup.borrowEntries.push({
        slot,
        amountUsd,
        isLastModified: slot.reserveId === lastModifiedReserveId,
      });
    }
    poolGroups.set(poolKey, poolGroup);
  }

  // For each pool group, allocate capacity: non-lastModified first, lastModified gets remaining
  for (const { totalBorrowCapacity, borrowEntries } of poolGroups.values()) {
    // Sort: non-lastModified first (stable), lastModified entries last
    const sorted = [...borrowEntries].sort((a, b) => {
      if (a.isLastModified && !b.isLastModified) return 1;
      if (!a.isLastModified && b.isLastModified) return -1;
      return 0;
    });

    let remaining = totalBorrowCapacity;
    for (const entry of sorted) {
      const clamped = Math.min(entry.amountUsd, Math.max(0, remaining));
      remaining -= clamped;
      ltvClampBySlot.set(entry.slot, clamped);
    }
  }

  return ltvClampBySlot;
}

function computeResultsFromGroups(
  groupMap: Map<string, EntryGroup>,
  reserveMap: Map<string, ReserveWithSpread>,
  isApy: boolean,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined,
  tydroPointToUsdRate: number,
  forecastStates: Record<string, MerklForecastWireItem>,
  ltvClampBySlot: Map<SideSlot, number>,
): PortfolioPositionResult[] {
  const results: PortfolioPositionResult[] = [];

  const crossReservePositions = new Map<string, ReservePositions>();
  const walletCrossReservePositions = new Map<string, ReservePositions>();
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
    if (group.walletSupplyUsd != null || group.walletBorrowUsd != null) {
      walletCrossReservePositions.set(reserve.reserveId, {
        supplyUsd: group.walletSupplyUsd ?? 0,
        borrowUsd: group.walletBorrowUsd ?? 0,
      });
    }
    // Sets symbol for all reserves in groupMap (including those with 0 USD on both sides,
    // which cannot happen in practice due to the skip guard in buildGroupMapFromSlots).
    // buildPerReserveInputsFromEntries only sets symbol for reserves in crossReservePositions,
    // which is equivalent because crossReservePositions filters on supplyUsd > 0 || borrowUsd > 0.
    if (reserve.tokenSymbol) {
      reserveSymbolById.set(reserve.reserveId, reserve.tokenSymbol);
    }
  }

  for (const [, r] of reserveMap) {
    if (r.tokenSymbol && !reserveSymbolById.has(r.reserveId)) {
      reserveSymbolById.set(r.reserveId, r.tokenSymbol);
    }
  }

  // AAV-1166: Portfolio Scenario is active when any portfolio entry has a non-zero delta.
  // All portfolio members (every group in groupMap) compute after* values.
  const portfolioScenarioActive = Array.from(groupMap.values()).some(
    (g) => g.supplyDeltaUsd !== 0 || g.borrowDeltaUsd !== 0,
  );

  for (const [key, group] of groupMap) {
    const reserve = reserveMap.get(key);
    if (!reserve) continue;

    const reserveRateInput: RateCalcInput | null = hasRateCalcFields(reserve)
      ? { ...reserve }
      : null;

    const hubBorrowed = reserve.hubBorrowed;
    const hubSupplied = reserve.hubSupplied;

    if (reserveRateInput && hubBorrowed) {
      reserveRateInput.borrowed = hubBorrowed;
      reserveRateInput.hubBorrowed = hubBorrowed;
    }
    if (reserveRateInput && hubSupplied) {
      reserveRateInput.hubSupplied = hubSupplied;
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
        walletSupplyUsd: group.walletSupplyUsd,
        walletBorrowUsd: group.walletBorrowUsd,
        forecastStates,
        crossReservePositions,
        walletCrossReservePositions: walletCrossReservePositions.size > 0 ? walletCrossReservePositions : undefined,
        reserveSymbolById,
        hubSupplied,
        hubBorrowed,
        portfolioScenarioActive,
      });

      const countSideForecastUnavailable = (lane: SimulationLane): number => {
        const rows: SimulationCampaignDetail[] = [
          ...(lane.sources.merkl.campaigns ?? []),
          ...(lane.sources.brevis.campaigns ?? []),
        ];
        return rows.filter((r) => r.forecastUnavailable).length;
      };

      const supplyForecastUnavailable = countSideForecastUnavailable(simResult.supply);
      const borrowForecastUnavailable = countSideForecastUnavailable(simResult.borrow);

      for (const slot of group.supplySlots) {
        const resolvedUsd = resolvePositionAmountUsd(slot.sideData, reserve);
        const amountUsd = resolvedUsd > 0 ? resolvedUsd : (slot.sideData.walletValue ?? 0);
        const walletUsd = slot.sideData.walletValue ?? 0;
        const availableRoomUsd = simResult.marketMetrics?.availableSupplyRoomUsd;
        const cappedUsd = availableRoomUsd != null && availableRoomUsd > 0 ? Math.min(amountUsd, availableRoomUsd) : amountUsd;
        const nativePercent = simResult.supply.afterNative
          ?? simResult.supply.currentNative ?? reserve.supplyApy ?? 0;
        const incentivePercent = simResult.supply.afterIncentive
          ?? simResult.supply.currentIncentive ?? 0;
        const metrics = buildMetricsFromLane(simResult.supply, 'supply', cappedUsd, isApy, walletUsd);
        results.push(
          buildPortfolioPositionResult(slot.reserveId, 'supply', amountUsd, nativePercent, incentivePercent, metrics, isApy, supplyForecastUnavailable, slot.sideData.walletValue, cappedUsd),
        );
      }

      for (const slot of group.borrowSlots) {
        const resolvedUsd = resolvePositionAmountUsd(slot.sideData, reserve);
        const amountUsd = resolvedUsd > 0 ? resolvedUsd : (slot.sideData.walletValue ?? 0);
        const walletUsd = slot.sideData.walletValue ?? 0;
        const availableRoomUsd = simResult.marketMetrics?.availableBorrowRoomUsd;
        const borrowCapCappedUsd = availableRoomUsd != null && availableRoomUsd > 0 ? Math.min(amountUsd, availableRoomUsd) : amountUsd;
        // LTV clamping: min(userInput, maxBorrowRemaining)
        const ltvCappedUsd = ltvClampBySlot.get(slot);
        const effectiveUsd = ltvCappedUsd != null
          ? Math.min(borrowCapCappedUsd, ltvCappedUsd)
          : borrowCapCappedUsd;
        // ltvClampedUsd on result: only when LTV actually reduced the amount
        const ltvClampedResult = ltvCappedUsd != null && ltvCappedUsd < amountUsd ? ltvCappedUsd : undefined;
        const nativePercent = simResult.borrow.afterNative
          ?? simResult.borrow.currentNative ?? reserve.borrowApy ?? 0;
        const incentivePercent = simResult.borrow.afterIncentive
          ?? simResult.borrow.currentIncentive ?? 0;
        const metrics = buildMetricsFromLane(simResult.borrow, 'borrow', effectiveUsd, isApy, walletUsd);
        results.push(
          buildPortfolioPositionResult(slot.reserveId, 'borrow', effectiveUsd, nativePercent, incentivePercent, metrics, isApy, borrowForecastUnavailable, slot.sideData.walletValue, effectiveUsd, ltvClampedResult),
        );
      }
    } else {
      for (const slot of group.supplySlots) {
        const resolvedUsd = resolvePositionAmountUsd(slot.sideData, reserve);
        const amountUsd = resolvedUsd > 0 ? resolvedUsd : (slot.sideData.walletValue ?? 0);
        const walletUsd = slot.sideData.walletValue;
        const nativePercent = reserve.supplyApy ?? 0;
        const incentiveArr = reserve.supplyIncentives ?? [];
        const incentivePercent = incentiveArr.reduce((s, v) => s + v, 0);
        results.push(
          buildPortfolioPositionResult(slot.reserveId, 'supply', amountUsd, nativePercent, incentivePercent, undefined, isApy, undefined, walletUsd),
        );
      }

      for (const slot of group.borrowSlots) {
        const resolvedUsd = resolvePositionAmountUsd(slot.sideData, reserve);
        const amountUsd = resolvedUsd > 0 ? resolvedUsd : (slot.sideData.walletValue ?? 0);
        const walletUsd = slot.sideData.walletValue;
        // LTV clamping applies even in fallback path
        const ltvCappedUsd = ltvClampBySlot.get(slot);
        const effectiveUsd = ltvCappedUsd != null ? Math.min(amountUsd, ltvCappedUsd) : amountUsd;
        const ltvClampedResult = ltvCappedUsd != null && ltvCappedUsd < amountUsd ? ltvCappedUsd : undefined;
        const nativePercent = reserve.borrowApy ?? 0;
        const incentiveArr = reserve.borrowIncentives ?? [];
        const incentivePercent = incentiveArr.reduce((s, v) => s + v, 0);
        results.push(
          buildPortfolioPositionResult(slot.reserveId, 'borrow', effectiveUsd, nativePercent, incentivePercent, undefined, isApy, undefined, walletUsd, effectiveUsd, ltvClampedResult),
        );
      }
    }
  }

  return results;
}

/**
 * Compute per-pool/spoke Health Factor from simulation results (AAV-1251).
 *
 * Groups results by (chainId, marketName) — the protocol isolation boundary.
 * Within each group:
 *   totalCollateralUsd = Σ(supplyUsd × liquidationThreshold / 100)
 *   totalDebtUsd = Σ(effective borrowUsd)  — post-clamp
 *   HF = totalCollateralUsd / totalDebtUsd  (null when totalDebtUsd = 0)
 */
function computeHealthFactors(
  results: PortfolioPositionResult[],
  reserves: ReserveWithSpread[],
): PortfolioHealthFactor[] {
  const reserveMap = new Map(reserves.map((r) => [getReserveKey(r), r]));

  const poolGroups = new Map<string, {
    totalCollateralUsd: number;
    totalDebtUsd: number;
  }>();

  for (const result of results) {
    const key = getReserveKey({ reserveId: result.reserveId });
    const reserve = reserveMap.get(key);
    if (!reserve) continue;

    const poolKey = `${reserve.chainId}:${reserve.marketName}`;
    const lt = reserve.liquidationThreshold ?? 0;

    const poolGroup = poolGroups.get(poolKey) ?? { totalCollateralUsd: 0, totalDebtUsd: 0 };

    if (result.side === 'supply') {
      poolGroup.totalCollateralUsd += result.amountUsd * lt / 100;
    } else {
      poolGroup.totalDebtUsd += result.amountUsd;
    }
    poolGroups.set(poolKey, poolGroup);
  }

  const healthFactors: PortfolioHealthFactor[] = [];
  for (const [poolKey, { totalCollateralUsd, totalDebtUsd }] of poolGroups) {
    const healthFactor = totalDebtUsd > 0 ? totalCollateralUsd / totalDebtUsd : null;
    healthFactors.push({ poolKey, healthFactor, totalCollateralUsd, totalDebtUsd });
  }
  return healthFactors;
}

export function simulatePortfolioFromEntries(
  args: SimulatePortfolioEntriesArgs,
): SimulatePortfolioResult {
  const {
    entries,
    reserves,
    isApy,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
    forecastStates,
  } = args;

  const visibleEntries = entries.filter((e) => !e.hidden && !e.isOrphan);
  if (visibleEntries.length === 0) {
    return { results: [], summary: aggregatePortfolioSummary([]), healthFactors: [] };
  }

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
    return { results: [], summary: aggregatePortfolioSummary([]), healthFactors: [] };
  }

  // AAV-1250: Compute LTV (maxBorrow) clamping per pool/spoke group.
  // Must happen after groupMap is built (needs supplyUsd/borrowUsd per reserve)
  // and before computeResultsFromGroups (which applies the clamped amounts).
  const ltvClampBySlot = computeLtvClamping(groupMap, reserveMap, args.lastModifiedReserveId);

  const results = computeResultsFromGroups(
    groupMap, reserveMap, isApy, whitelistMerklCampaignIds, tydroPointToUsdRate, forecastStates,
    ltvClampBySlot,
  );

  // AAV-1251: Compute per-pool/spoke Health Factor from post-clamp results.
  const healthFactors = computeHealthFactors(results, reserves);

  return {
    results,
    summary: aggregatePortfolioSummary(results),
    healthFactors,
  };
}

export function buildPerReserveInputsFromEntries(
  entries: PortfolioReserveEntry[],
  reserves: ReserveWithSpread[],
): PortfolioInputsResult {
  const reserveMap = new Map(reserves.map((r) => [getReserveKey(r), r]));
  const grouped = new Map<
    string,
    {
      supplyUsd: number;
      borrowUsd: number;
      supplyDeltaUsd: number;
      borrowDeltaUsd: number;
      walletSupplyUsd: number | undefined;
      walletBorrowUsd: number | undefined;
    }
  >();

  for (const entry of entries) {
    if (entry.hidden || entry.isOrphan) continue;
    const key = getReserveKey({ reserveId: entry.reserveId });
    const reserve = reserveMap.get(key);
    if (!reserve) continue;

    for (const side of ['supply', 'borrow'] as const) {
      const s = entry[side];

      // When amount is empty but walletValue exists, the user hasn't changed
      // anything — effectiveAmount = walletValue, delta = 0.
      // This ensures totalSupplyUsd/totalBorrowUsd are recorded even when
      // delta is zero, so incentive current values can be displayed.
      const hasWalletPosition = s.walletValue !== null && s.walletValue > 0;
      const rawAmount = parseNumberInput(s.amount);
      const hasUserInput = rawAmount > 0;

      if (!hasUserInput && !hasWalletPosition) continue;

      const effectiveAmountUsd = hasUserInput
        ? resolvePositionAmountUsd(s, reserve)
        : (s.walletValue ?? 0);
      const deltaUsd = hasUserInput ? (effectiveAmountUsd - (s.walletValue ?? 0)) : 0;

      const existing = grouped.get(entry.reserveId) ?? {
        supplyUsd: 0,
        borrowUsd: 0,
        supplyDeltaUsd: 0,
        borrowDeltaUsd: 0,
        walletSupplyUsd: undefined,
        walletBorrowUsd: undefined,
      };
      if (side === 'supply') {
        existing.supplyUsd += effectiveAmountUsd;
        existing.supplyDeltaUsd += deltaUsd;
        if (hasWalletPosition) {
          existing.walletSupplyUsd = (existing.walletSupplyUsd ?? 0) + s.walletValue!;
        }
      } else {
        existing.borrowUsd += effectiveAmountUsd;
        existing.borrowDeltaUsd += deltaUsd;
        if (hasWalletPosition) {
          existing.walletBorrowUsd = (existing.walletBorrowUsd ?? 0) + s.walletValue!;
        }
      }
      grouped.set(entry.reserveId, existing);
    }
  }

  const perReserveInputs = new Map<string, PerReserveInput>();
  const crossReservePositions = new Map<string, ReservePositions>();
  const walletCrossReservePositions = new Map<string, ReservePositions>();
  const reserveSymbolById = new Map<string, string>();

  for (const [reserveId, group] of grouped) {
    perReserveInputs.set(reserveId, {
      supplyInput: String(group.supplyDeltaUsd),
      borrowInput: String(group.borrowDeltaUsd),
      inputMode: 'usd',
      totalSupplyUsd: group.supplyUsd,
      totalBorrowUsd: group.borrowUsd,
      walletSupplyUsd: group.walletSupplyUsd,
      walletBorrowUsd: group.walletBorrowUsd,
    });
    if (group.supplyUsd > 0 || group.borrowUsd > 0) {
      crossReservePositions.set(reserveId, {
        supplyUsd: group.supplyUsd,
        borrowUsd: group.borrowUsd,
      });
    }
    if (group.walletSupplyUsd != null || group.walletBorrowUsd != null) {
      walletCrossReservePositions.set(reserveId, {
        supplyUsd: group.walletSupplyUsd ?? 0,
        borrowUsd: group.walletBorrowUsd ?? 0,
      });
    }
    if (group.supplyUsd > 0 || group.borrowUsd > 0) {
      const reserve = reserveMap.get(getReserveKey({ reserveId }));
      if (reserve?.tokenSymbol) {
        reserveSymbolById.set(reserveId, reserve.tokenSymbol);
      }
    }
  }

  for (const [, r] of reserveMap) {
    if (r.tokenSymbol && !reserveSymbolById.has(r.reserveId)) {
      reserveSymbolById.set(r.reserveId, r.tokenSymbol);
    }
  }

  return {
    perReserveInputs,
    crossReservePositions: crossReservePositions.size > 0 ? crossReservePositions : undefined,
    walletCrossReservePositions: walletCrossReservePositions.size > 0 ? walletCrossReservePositions : undefined,
    reserveSymbolById: reserveSymbolById.size > 0 ? reserveSymbolById : undefined,
  };
}
