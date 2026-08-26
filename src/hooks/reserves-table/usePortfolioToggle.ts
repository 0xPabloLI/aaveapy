import { useCallback, useMemo } from 'react';

import type { ReserveWithSpread, MerklForecastWireItem } from '@/types/aave';
import type {
  PortfolioReserveEntry,
  PortfolioPositionResult,
  PortfolioSummary,
  PortfolioHealthFactor,
} from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import type { OnchainHfMap } from '@/lib/userData/onchainHealthFactor';
import {
  buildPortfolioPositionResult,
  resolvePositionAmountUsd,
  aggregatePortfolioSummary,
} from '@/lib/portfolioCalculator';
import { getReserveKey } from '@/lib/reserveKey';
import { simulatePortfolioFromEntries } from '@/lib/portfolioSimulator';
import { isRestrictedReserve, getPrimaryReserveStatus } from '@/lib/reserveStatus';

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
  portfolioActions?: PortfolioSimulationActions;
  simulationContext?: PortfolioSimulationContext;
  lastModifiedReserveId?: string;
  /** On-chain HF baseline per pool (AAV-1253 P7). undefined = no wallet. */
  onchainHfMap?: OnchainHfMap;
}

export interface UsePortfolioToggleResult {
  portfolioReserveIds: Set<string>;
  hiddenReserveIds: Set<string>;
  handlePortfolioToggle: (
    reserveId: string,
    reserve: ReserveWithSpread,
    side?: 'supply' | 'borrow',
  ) => void;
  portfolioResults: PortfolioPositionResult[];
  portfolioSummary: PortfolioSummary;
  portfolioHealthFactors?: PortfolioHealthFactor[];
}

export const usePortfolioToggle = ({
  isPortfolioMode,
  reserves,
  entries,
  portfolioActions,
  simulationContext,
  lastModifiedReserveId,
  onchainHfMap,
}: UsePortfolioToggleArgs): UsePortfolioToggleResult => {
  const effectiveEntries = useMemo(() => entries ?? [], [entries]);
  const portfolioReserveIds = useMemo(() => {
    return new Set(effectiveEntries.map((e) => e.reserveId));
  }, [effectiveEntries]);

  const hiddenReserveIds = useMemo(() => {
    return new Set(effectiveEntries.filter((e) => e.hidden).map((e) => e.reserveId));
  }, [effectiveEntries]);

  const handlePortfolioToggle = useCallback(
    (reserveId: string, reserve: ReserveWithSpread, side?: 'supply' | 'borrow') => {
      if (!portfolioActions) return;

      if (side) {
        const entry = effectiveEntries.find((e) => e.reserveId === reserveId);
        const sideData = entry?.[side];
        if (entry && sideData) {
          if (entry.hidden) {
            portfolioActions.unhideReserve(reserveId);
            return;
          }
          if (isRestrictedReserve(reserve)) return;
          const hasWallet = entry.supply.walletValue !== null || entry.borrow.walletValue !== null;
          if (hasWallet) {
            portfolioActions.hideReserve(reserveId);
          } else {
            portfolioActions.removeReserve(reserveId);
          }
        } else {
          if (isRestrictedReserve(reserve)) return;
          portfolioActions.addReserve({
            reserveId: reserve.reserveId,
            marketName: reserve.marketName,
            chainName: reserve.chainName,
            chainId: reserve.chainId,
            tokenSymbol: reserve.tokenSymbol,
            restrictedStatus: getPrimaryReserveStatus(reserve),
            hubName: reserve.hubName,
            hubId: reserve.hubId,
          });
        }
      } else {
        if (portfolioReserveIds.has(reserveId)) {
          const entry = effectiveEntries.find((e) => e.reserveId === reserveId);
          if (entry) {
            if (entry.hidden) {
              portfolioActions.unhideReserve(reserveId);
              return;
            }
            if (isRestrictedReserve(reserve)) return;
            const hasWallet = entry.supply.walletValue !== null || entry.borrow.walletValue !== null;
            if (hasWallet) {
              portfolioActions.hideReserve(reserveId);
            } else {
              portfolioActions.removeReserve(reserveId);
            }
          }
        } else {
          if (isRestrictedReserve(reserve)) return;
          portfolioActions.addReserve({
            reserveId: reserve.reserveId,
            marketName: reserve.marketName,
            chainName: reserve.chainName,
            chainId: reserve.chainId,
            tokenSymbol: reserve.tokenSymbol,
            restrictedStatus: getPrimaryReserveStatus(reserve),
            hubName: reserve.hubName,
            hubId: reserve.hubId,
          });
        }
      }
    },
    [portfolioActions, effectiveEntries, portfolioReserveIds],
  );

  const { portfolioResults, portfolioSummary, portfolioHealthFactors } = useMemo<{
    portfolioResults: PortfolioPositionResult[];
    portfolioSummary: PortfolioSummary;
    portfolioHealthFactors?: PortfolioHealthFactor[];
  }>(() => {
    if (!isPortfolioMode || effectiveEntries.length === 0) {
      return { portfolioResults: [], portfolioSummary: aggregatePortfolioSummary([]) };
    }
    if (simulationContext) {
      const { results, summary, healthFactors } = simulatePortfolioFromEntries({
        entries: effectiveEntries,
        reserves,
        isApy: simulationContext.isApy,
        whitelistMerklCampaignIds: simulationContext.whitelistMerklCampaignIds,
        tydroPointToUsdRate: simulationContext.tydroPointToUsdRate,
        forecastStates: simulationContext.forecastStates,
        lastModifiedReserveId,
        onchainHfMap,
      });
      return { portfolioResults: results, portfolioSummary: summary, portfolioHealthFactors: healthFactors };
    }
    const reserveMap = new Map(reserves.map((r) => [getReserveKey(r), r]));
    const results: PortfolioPositionResult[] = effectiveEntries
      .filter((e) => !e.hidden && !e.isOrphan)
      .flatMap((e) => {
        const reserve = reserveMap.get(getReserveKey({ reserveId: e.reserveId }));
        if (!reserve) return [];
        const out: PortfolioPositionResult[] = [];
        for (const side of ['supply', 'borrow'] as const) {
          const s = e[side];
          const amountUsd = resolvePositionAmountUsd(s, reserve);
          if (amountUsd <= 0) continue;
          const nativePercent =
            side === 'supply' ? (reserve.supplyApy ?? 0) : (reserve.borrowApy ?? 0);
          const incentiveArr =
            side === 'supply'
              ? (reserve.supplyIncentives ?? [])
              : (reserve.borrowIncentives ?? []);
          const incentivePercent = incentiveArr.reduce((acc, v) => acc + v, 0);
          out.push(
            buildPortfolioPositionResult(e.reserveId, side, amountUsd, nativePercent, incentivePercent),
          );
        }
        return out;
      });
    return {
      portfolioResults: results,
      portfolioSummary: aggregatePortfolioSummary(results),
    };
  }, [isPortfolioMode, effectiveEntries, reserves, simulationContext, lastModifiedReserveId, onchainHfMap]);

  return {
    portfolioReserveIds,
    hiddenReserveIds,
    handlePortfolioToggle,
    portfolioResults,
    portfolioSummary,
    portfolioHealthFactors,
  };
};
