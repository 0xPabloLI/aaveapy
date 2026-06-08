/**
 * usePortfolioSimulation — state management for multi-token portfolio simulation.
 *
 * Manages entries (reserve-level, supply+borrow together), computes per-position
 * results by delegating to `buildRateSimulationResult`, and aggregates via
 * `portfolioCalculator`.
 *
 * Primary state: `entries: PortfolioReserveEntry[]`.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  DeltaSign,
  PortfolioInputMode,
  PortfolioPositionResult,
  PortfolioReserveEntry,
  PortfolioSide,
  PortfolioSnapshot,
  PortfolioSummary,
  ReservePatch,
} from '@/types/portfolio';
import {
  aggregatePortfolioSummary,
  convertPortfolioInputAmount,
  formatConvertedAmount,
} from '@/lib/portfolioCalculator';
import { computeDelta } from '@/lib/deltaCalculator';

let nextSnapshotId = 1;
const generateSnapshotId = (): string => `snap-${nextSnapshotId++}`;

const EMPTY_SIDE = { amount: '', inputMode: 'usd' as const, walletValue: null };

function mergeEntriesWithDelta(
  current: PortfolioReserveEntry[],
  incoming: PortfolioReserveEntry[],
): PortfolioReserveEntry[] {
  const currentMap = new Map(current.map((e) => [e.reserveId, e]));
  const result = new Map<string, PortfolioReserveEntry>();

  for (const inc of incoming) {
    const existing = currentMap.get(inc.reserveId);
    if (existing) {
      result.set(inc.reserveId, {
        ...existing,
        supply: mergeSideWithDelta(existing.supply, inc.supply),
        borrow: mergeSideWithDelta(existing.borrow, inc.borrow),
        hidden: false,
        isOrphan: inc.isOrphan,
      });
    } else {
      result.set(inc.reserveId, { ...inc });
    }
    currentMap.delete(inc.reserveId);
  }

  for (const [, entry] of currentMap) {
    const anyWallet = entry.supply.walletValue !== null || entry.borrow.walletValue !== null;
    if (!anyWallet) {
      result.set(entry.reserveId, entry);
    }
  }

  return Array.from(result.values());
}

function mergeSideWithDelta(
  existing: PortfolioReserveEntry['supply'],
  incoming: PortfolioReserveEntry['supply'],
): PortfolioReserveEntry['supply'] {
  if (existing.walletValue === null || incoming.walletValue === null) {
    return { ...incoming };
  }
  const { deltaUsd } = computeDelta({
    amount: existing.amount,
    walletValue: existing.walletValue,
    inputMode: existing.inputMode,
  });
  if (deltaUsd === 0) {
    return { ...incoming };
  }
  const newEffective = Math.max(incoming.walletValue + deltaUsd, 0);
  return {
    ...incoming,
    amount: formatConvertedAmount(newEffective),
    inputMode: 'usd',
  };
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface PortfolioSimulationActions {
  setActive: (active: boolean) => void;
  addReserve: (params: {
    reserveId: string;
    marketName: string;
    chainName: string;
    tokenSymbol: string;
  }) => void;
  removeReserve: (reserveId: string) => void;
  updateReserve: (reserveId: string, patch: ReservePatch, priceInUsd?: number) => void;
  hideReserve: (reserveId: string) => void;
  unhideReserve: (reserveId: string) => void;
  importReserves: (incoming: PortfolioReserveEntry[]) => void;
  restoreToWallet: (reserveId: string, side?: PortfolioSide) => void;
  removeHiddenEntries: () => number;
  clearAll: () => void;
  saveSnapshot: (label: string, results?: PortfolioPositionResult[], summary?: PortfolioSummary) => void;
  deleteSnapshot: (snapshotId: string) => void;
  undoLastRemove: () => boolean;
}

export interface UsePortfolioSimulationReturn {
  active: boolean;
  entries: PortfolioReserveEntry[];
  snapshots: PortfolioSnapshot[];
  actions: PortfolioSimulationActions;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePortfolioSimulation(): UsePortfolioSimulationReturn {
  const [active, setActive] = useState(false);
  const [entries, setEntries] = useState<PortfolioReserveEntry[]>([]);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const lastRemoveSnapshotRef = useRef<PortfolioReserveEntry[] | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const addReserve = useCallback(
    (params: { reserveId: string; marketName: string; chainName: string; tokenSymbol: string }) => {
      setEntries((prev) => {
        if (prev.some((e) => e.reserveId === params.reserveId)) return prev;
        return [
          ...prev,
          {
            reserveId: params.reserveId,
            marketName: params.marketName,
            chainName: params.chainName,
            tokenSymbol: params.tokenSymbol,
            supply: { ...EMPTY_SIDE },
            borrow: { ...EMPTY_SIDE },
            hidden: false,
            isOrphan: false,
          },
        ];
      });
    },
    [],
  );

  const removeReserve = useCallback((reserveId: string) => {
    setEntries((prev) => {
      lastRemoveSnapshotRef.current = prev;
      return prev.filter((e) => e.reserveId !== reserveId);
    });
  }, []);

  const updateReserve = useCallback(
    (reserveId: string, patch: ReservePatch, priceInUsd?: number) => {
      setEntries((prev) =>
        prev.map((e) => {
          if (e.reserveId !== reserveId) return e;
          let supply = { ...e.supply };
          let borrow = { ...e.borrow };

          if (patch.supplyAmount !== undefined) supply = { ...supply, amount: patch.supplyAmount };
          if (patch.supplyInputMode !== undefined) {
            const currentAmount = parseFloat(supply.amount);
            let newAmount = supply.amount;
            if (
              priceInUsd !== undefined &&
              supply.amount.trim() !== '' &&
              Number.isFinite(currentAmount)
            ) {
              const converted = convertPortfolioInputAmount(
                currentAmount,
                supply.inputMode,
                patch.supplyInputMode,
                priceInUsd,
              );
              newAmount = converted !== null ? formatConvertedAmount(converted) : '';
            }
            supply = { ...supply, inputMode: patch.supplyInputMode, amount: newAmount };
          }
          if (patch.borrowAmount !== undefined) borrow = { ...borrow, amount: patch.borrowAmount };
          if (patch.borrowInputMode !== undefined) {
            const currentAmount = parseFloat(borrow.amount);
            let newAmount = borrow.amount;
            if (
              priceInUsd !== undefined &&
              borrow.amount.trim() !== '' &&
              Number.isFinite(currentAmount)
            ) {
              const converted = convertPortfolioInputAmount(
                currentAmount,
                borrow.inputMode,
                patch.borrowInputMode,
                priceInUsd,
              );
              newAmount = converted !== null ? formatConvertedAmount(converted) : '';
            }
            borrow = { ...borrow, inputMode: patch.borrowInputMode, amount: newAmount };
          }
          if (patch.supplyDeltaSign !== undefined) supply = { ...supply, deltaSign: patch.supplyDeltaSign };
          if (patch.borrowDeltaSign !== undefined) borrow = { ...borrow, deltaSign: patch.borrowDeltaSign };

          return { ...e, supply, borrow };
        }),
      );
    },
    [],
  );

  const hideReserve = useCallback((reserveId: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.reserveId === reserveId ? { ...e, hidden: true } : e)),
    );
  }, []);

  const unhideReserve = useCallback((reserveId: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.reserveId === reserveId ? { ...e, hidden: false } : e)),
    );
  }, []);

  const importReserves = useCallback((incoming: PortfolioReserveEntry[]) => {
    setEntries((prev) => mergeEntriesWithDelta(prev, incoming));
  }, []);

  const restoreToWallet = useCallback((reserveId: string, side?: PortfolioSide) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.reserveId !== reserveId) return e;
        const restoreSide = (
          s: PortfolioReserveEntry['supply'],
        ): PortfolioReserveEntry['supply'] => {
          if (s.walletValue === null) return s;
          return { ...s, amount: formatConvertedAmount(s.walletValue), inputMode: 'usd' };
        };
        return {
          ...e,
          hidden: false,
          supply: side === undefined || side === 'supply' ? restoreSide(e.supply) : e.supply,
          borrow: side === undefined || side === 'borrow' ? restoreSide(e.borrow) : e.borrow,
        };
      }),
    );
  }, []);

  const removeHiddenEntries = useCallback((): number => {
    const currentEntries = entriesRef.current;
    const hiddenCount = currentEntries.filter((e) => e.hidden).length;
    if (hiddenCount === 0) return 0;
    setEntries((prev) => prev.filter((e) => !e.hidden));
    return hiddenCount;
  }, []);

  const clearAll = useCallback(() => {
    setEntries([]);
  }, []);

  const saveSnapshot = useCallback(
    (label: string, results?: PortfolioPositionResult[], summary?: PortfolioSummary) => {
      const snapshot: PortfolioSnapshot = {
        id: generateSnapshotId(),
        label,
        createdAt: Date.now(),
        entries: [...entries],
        summary: summary ?? aggregatePortfolioSummary([]),
        positionResults: results ?? [],
      };
      setSnapshots((prev) => [...prev, snapshot]);
    },
    [entries],
  );

  const deleteSnapshot = useCallback((snapshotId: string) => {
    setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
  }, []);

  const undoLastRemove = useCallback((): boolean => {
    const snapshot = lastRemoveSnapshotRef.current;
    if (!snapshot) return false;
    lastRemoveSnapshotRef.current = null;
    setEntries(snapshot);
    return true;
  }, []);

  const actions = useMemo<PortfolioSimulationActions>(
    () => ({
      setActive,
      addReserve,
      removeReserve,
      updateReserve,
      hideReserve,
      unhideReserve,
      importReserves,
      restoreToWallet,
      removeHiddenEntries,
      clearAll,
      saveSnapshot,
      deleteSnapshot,
      undoLastRemove,
    }),
    [
      addReserve, removeReserve, updateReserve, hideReserve, unhideReserve,
      importReserves, restoreToWallet, removeHiddenEntries, clearAll, saveSnapshot, deleteSnapshot,
      undoLastRemove,
    ],
  );

  return {
    active,
    entries,
    snapshots,
    actions,
  };
}
