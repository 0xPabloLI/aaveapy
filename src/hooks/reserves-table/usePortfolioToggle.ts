import { useCallback, useMemo } from 'react';

import type { ReserveWithSpread, MerklForecastWireItem } from '@/types/aave';
import type {
  PortfolioReserveEntry,
  PortfolioPosition,
  PortfolioPositionResult,
  PortfolioSummary,
} from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import {
  buildPortfolioPositionResult,
  resolvePositionAmountUsd,
  aggregatePortfolioSummary,
} from '@/lib/portfolioCalculator';
import { getReserveKey } from '@/lib/reserveKey';
import { simulatePortfolioPositions } from '@/lib/portfolioSimulator';

export interface PortfolioSimulationContext {
  isApy: boolean;
  whitelistMerklCampaignIds: ReadonlySet<string>;
  tydroPointToUsdRate: number;
  forecastStates: Record<string, MerklForecastWireItem>;
}

export interface UsePortfolioToggleArgs {
  isPortfolioMode: boolean;
  reserves: ReserveWithSpread[];
  entries?: PortfolioReserveEntry[];
  /** @deprecated Use entries instead. */
  portfolioPositions?: PortfolioPosition[];
  portfolioActions?: PortfolioSimulationActions;
  simulationContext?: PortfolioSimulationContext;
}

export interface UsePortfolioToggleResult {
  portfolioReserveIds: Set<string>;
  handlePortfolioToggle: (
    reserveId: string,
    reserve: ReserveWithSpread,
    side?: 'supply' | 'borrow',
  ) => void;
  portfolioResults: PortfolioPositionResult[];
  portfolioSummary: PortfolioSummary;
}

function entriesToPositionsForToggle(entries: PortfolioReserveEntry[]): PortfolioPosition[] {
  return entries.flatMap((e) => {
    const makePos = (side: 'supply' | 'borrow', s: PortfolioReserveEntry['supply']): PortfolioPosition => ({
      positionId: `${e.reserveId}::${side}`,
      reserveId: e.reserveId,
      marketName: e.marketName,
      chainName: e.chainName,
      tokenSymbol: e.tokenSymbol,
      side,
      amount: s.amount,
      inputMode: s.inputMode,
      walletValue: s.walletValue,
      hidden: e.hidden,
      isOrphan: e.isOrphan,
      source: s.source,
      deltaSign: s.deltaSign ?? 1,
    });
    const sides: PortfolioPosition[] = [];
    if (e.hidden && e.supply.walletValue === null && e.borrow.walletValue !== null) {
      sides.push(makePos('borrow', e.borrow));
    } else if (e.hidden && e.borrow.walletValue === null && e.supply.walletValue !== null) {
      sides.push(makePos('supply', e.supply));
    } else {
      sides.push(makePos('supply', e.supply));
      sides.push(makePos('borrow', e.borrow));
    }
    return sides;
  });
}

export const usePortfolioToggle = ({
  isPortfolioMode,
  reserves,
  entries,
  portfolioPositions,
  portfolioActions,
  simulationContext,
}: UsePortfolioToggleArgs): UsePortfolioToggleResult => {
  const effectiveEntries = useMemo(() => entries ?? [], [entries]);
  const portfolioReserveIds = useMemo(() => {
    return new Set(effectiveEntries.map((e) => e.reserveId));
  }, [effectiveEntries]);

  const handlePortfolioToggle = useCallback(
    (reserveId: string, reserve: ReserveWithSpread, side?: 'supply' | 'borrow') => {
      if (!portfolioActions) return;

      if (side) {
        const entry = effectiveEntries.find((e) => e.reserveId === reserveId);
        const sideData = entry?.[side];
        if (entry && sideData) {
          portfolioActions.hideOrRemoveReserveAction(reserveId);
        } else {
          const oppositeSide = side === 'supply' ? 'borrow' : 'supply';
          const hasOpposite = entry?.[oppositeSide]?.walletValue !== null || (entry?.[oppositeSide]?.amount ?? '') !== '';
          portfolioActions.addReserve({
            reserveId: reserve.reserveId,
            marketName: reserve.marketName,
            chainName: reserve.chainName,
            tokenSymbol: reserve.tokenSymbol,
          });
          if (!hasOpposite && !entry) {
            // addReserve already adds both sides as empty; no extra action needed
          }
        }
      } else {
        if (portfolioReserveIds.has(reserveId)) {
          portfolioActions.hideOrRemoveReserveAction(reserveId);
        } else {
          portfolioActions.addReserve({
            reserveId: reserve.reserveId,
            marketName: reserve.marketName,
            chainName: reserve.chainName,
            tokenSymbol: reserve.tokenSymbol,
          });
        }
      }
    },
    [portfolioActions, effectiveEntries, portfolioReserveIds],
  );

  const positionsForCalc = useMemo(() => {
    if (effectiveEntries.length > 0) return entriesToPositionsForToggle(effectiveEntries);
    return portfolioPositions ?? [];
  }, [effectiveEntries, portfolioPositions]);

  const { portfolioResults, portfolioSummary } = useMemo<{
    portfolioResults: PortfolioPositionResult[];
    portfolioSummary: PortfolioSummary;
  }>(() => {
    if (!isPortfolioMode || positionsForCalc.length === 0) {
      return { portfolioResults: [], portfolioSummary: aggregatePortfolioSummary([]) };
    }
    if (simulationContext) {
      const { results, summary } = simulatePortfolioPositions({
        positions: positionsForCalc,
        reserves,
        isApy: simulationContext.isApy,
        whitelistMerklCampaignIds: simulationContext.whitelistMerklCampaignIds,
        tydroPointToUsdRate: simulationContext.tydroPointToUsdRate,
        forecastStates: simulationContext.forecastStates,
      });
      return { portfolioResults: results, portfolioSummary: summary };
    }
    const reserveMap = new Map(reserves.map((r) => [getReserveKey(r), r]));
    const results: PortfolioPositionResult[] = positionsForCalc
      .map((pos) => {
        const reserve = reserveMap.get(getReserveKey({ reserveId: pos.reserveId }));
        const amountUsd = resolvePositionAmountUsd(pos, reserve);
        if (amountUsd <= 0 || !reserve) return null;
        const nativePercent =
          pos.side === 'supply' ? (reserve.supplyApy ?? 0) : (reserve.borrowApy ?? 0);
        const incentiveArr =
          pos.side === 'supply'
            ? (reserve.supplyIncentives ?? [])
            : (reserve.borrowIncentives ?? []);
        const incentivePercent = incentiveArr.reduce((s, v) => s + v, 0);
        return buildPortfolioPositionResult(pos, amountUsd, nativePercent, incentivePercent);
      })
      .filter((r): r is PortfolioPositionResult => r !== null);
    return {
      portfolioResults: results,
      portfolioSummary: aggregatePortfolioSummary(results),
    };
  }, [isPortfolioMode, positionsForCalc, reserves, simulationContext]);

  return {
    portfolioReserveIds,
    handlePortfolioToggle,
    portfolioResults,
    portfolioSummary,
  };
};
