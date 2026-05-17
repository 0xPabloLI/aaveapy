import { useCallback, useMemo } from 'react';

import type { ReserveWithSpread } from '@/types/aave';
import type {
  PortfolioPosition,
  PortfolioPositionResult,
  PortfolioSummary,
} from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import {
  buildPortfolioPositionResult,
  resolvePositionAmountUsd,
} from '@/hooks/usePortfolioSimulation';
import { aggregatePortfolioSummary } from '@/lib/portfolioCalculator';
import { getReserveKey } from '@/lib/reserveKey';

export interface UsePortfolioToggleArgs {
  isPortfolioMode: boolean;
  reserves: ReserveWithSpread[];
  portfolioPositions?: PortfolioPosition[];
  portfolioActions?: PortfolioSimulationActions;
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

/**
 * Encapsulates the portfolio-side state derivations and toggle handler used
 * by `ReservesTable`:
 *
 * - `portfolioReserveIds`: a Set of reserveIds currently in the portfolio.
 * - `handlePortfolioToggle`: add/remove a reserve in/out of the portfolio.
 *   When `side` is provided, toggles only that side. When `side` is omitted,
 *   adds BOTH supply and borrow if absent, or removes ALL positions for that
 *   reserve if any side is present.
 * - `portfolioResults` / `portfolioSummary`: derived view-model rows and
 *   aggregate summary; empty when not in portfolio mode or no positions.
 *
 * Behavior preserved verbatim from the original inline implementation in
 * `src/components/dashboard/ReservesTable.tsx`.
 */
export const usePortfolioToggle = ({
  isPortfolioMode,
  reserves,
  portfolioPositions,
  portfolioActions,
}: UsePortfolioToggleArgs): UsePortfolioToggleResult => {
  // Set of reserveIds currently in the portfolio
  const portfolioReserveIds = useMemo(() => {
    if (!portfolioPositions) return new Set<string>();
    return new Set(portfolioPositions.map((p) => p.reserveId));
  }, [portfolioPositions]);

  // Callback: toggle a reserve in/out of portfolio (adds as specific side if provided, else defaults to supply+borrow)
  const handlePortfolioToggle = useCallback(
    (reserveId: string, reserve: ReserveWithSpread, side?: 'supply' | 'borrow') => {
      if (!portfolioActions) return;

      if (side) {
        const existing = portfolioPositions?.find(
          (p) => p.reserveId === reserveId && p.side === side,
        );
        if (existing) {
          portfolioActions.removePosition(existing.positionId);
        } else {
          portfolioActions.addPosition({
            reserveId,
            marketName: reserve.marketName,
            chainName: reserve.chainName,
            tokenSymbol: reserve.tokenSymbol,
            side,
          });
        }
      } else {
        if (portfolioReserveIds.has(reserveId)) {
          const toRemove = portfolioPositions?.filter((p) => p.reserveId === reserveId) ?? [];
          toRemove.forEach((p) => portfolioActions.removePosition(p.positionId));
        } else {
          portfolioActions.addPosition({
            reserveId,
            marketName: reserve.marketName,
            chainName: reserve.chainName,
            tokenSymbol: reserve.tokenSymbol,
            side: 'supply',
          });
          portfolioActions.addPosition({
            reserveId,
            marketName: reserve.marketName,
            chainName: reserve.chainName,
            tokenSymbol: reserve.tokenSymbol,
            side: 'borrow',
          });
        }
      }
    },
    [portfolioActions, portfolioPositions, portfolioReserveIds],
  );

  // Portfolio results computation (Phase 3)
  const { portfolioResults, portfolioSummary } = useMemo<{
    portfolioResults: PortfolioPositionResult[];
    portfolioSummary: PortfolioSummary;
  }>(() => {
    if (!isPortfolioMode || !portfolioPositions || portfolioPositions.length === 0) {
      return { portfolioResults: [], portfolioSummary: aggregatePortfolioSummary([]) };
    }
    const reserveMap = new Map(reserves.map((r) => [getReserveKey(r), r]));
    const results: PortfolioPositionResult[] = portfolioPositions
      .map((pos) => {
        const reserve = reserveMap.get(pos.reserveId);
        const amountUsd = resolvePositionAmountUsd(pos, reserve);
        if (amountUsd <= 0 || !reserve) return null;
        // Use current reserve APY as baseline (full sim integration in later phase)
        const nativePercent =
          pos.side === 'supply' ? (reserve.supplyApy ?? 0) : (reserve.borrowApy ?? 0);
        // Sum incentive arrays
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
  }, [isPortfolioMode, portfolioPositions, reserves]);

  return {
    portfolioReserveIds,
    handlePortfolioToggle,
    portfolioResults,
    portfolioSummary,
  };
};
