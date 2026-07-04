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
import { canUnhide, applyRestrictedHidden } from '@/lib/portfolioRestricted';

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

  return applyRestrictedHidden(Array.from(result.values()));
}

function forceSyncEntries(
  current: PortfolioReserveEntry[],
  incoming: PortfolioReserveEntry[],
): PortfolioReserveEntry[] {
  const incomingMap = new Map(incoming.map((e) => [e.reserveId, e]));
  const result: PortfolioReserveEntry[] = [];

  for (const cur of current) {
    const inc = incomingMap.get(cur.reserveId);
    if (inc) {
      const forceSide = (
        existing: PortfolioReserveEntry['supply'],
        incomingSide: PortfolioReserveEntry['supply'],
      ): PortfolioReserveEntry['supply'] => {
        if (incomingSide.walletValue === null) return existing;
        return {
          ...existing,
          walletValue: incomingSide.walletValue,
          source: incomingSide.source ?? existing.source,
          deltaSign: incomingSide.deltaSign ?? existing.deltaSign,
          deltaRawUsd: existing.deltaRawUsd,
        };
      };
      result.push({
        ...cur,
        supply: forceSide(cur.supply, inc.supply),
        borrow: forceSide(cur.borrow, inc.borrow),
        hidden: false,
        isOrphan: inc.isOrphan,
      });
      incomingMap.delete(cur.reserveId);
    } else {
      result.push(cur);
    }
  }

  for (const [, entry] of incomingMap) {
    result.push({ ...entry });
  }

  return applyRestrictedHidden(result);
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
    deltaRawUsd: deltaUsd,
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
    chainId: number;
    tokenSymbol: string;
    restrictedStatus?: 'frozen' | 'paused' | 'inactive' | null;
  }) => void;
  updateReserve: (reserveId: string, patch: ReservePatch, priceInUsd?: number) => void;
  /** Soft-delete: sets `hidden: true`. Use for entries with wallet positions. */
  hideReserve: (reserveId: string) => void;
  unhideReserve: (reserveId: string) => void;
  /** Hard-delete: removes entry from array. @remarks Only call for entries without wallet positions. */
  removeReserve: (reserveId: string) => void;
  importReserves: (incoming: PortfolioReserveEntry[]) => void;
  forceSyncReserves: (incoming: PortfolioReserveEntry[]) => void;
  restoreToWallet: (reserveId: string, side?: PortfolioSide) => void;
  removeWalletEntries: () => number;
  clearAll: () => void;
  saveSnapshot: (label: string, results?: PortfolioPositionResult[], summary?: PortfolioSummary) => void;
  deleteSnapshot: (snapshotId: string) => void;
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
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const addReserve = useCallback(
    (params: {
      reserveId: string;
      marketName: string;
      chainName: string;
      chainId: number;
      tokenSymbol: string;
      restrictedStatus?: 'frozen' | 'paused' | 'inactive' | null;
    }) => {
      const status = params.restrictedStatus ?? null;
      setEntries((prev) => {
        const existing = prev.find((e) => e.reserveId === params.reserveId);
        if (existing) {
          if (existing.hidden && canUnhide(existing)) {
            return prev.map((e) =>
              e.reserveId === params.reserveId ? { ...e, hidden: false } : e,
            );
          }
          return prev;
        }
        return [
          ...prev,
          {
            reserveId: params.reserveId,
            marketName: params.marketName,
            chainName: params.chainName,
            chainId: params.chainId,
            tokenSymbol: params.tokenSymbol,
            supply: { ...EMPTY_SIDE },
            borrow: { ...EMPTY_SIDE },
            hidden: status !== null,
            isOrphan: false,
            restrictedStatus: status,
          },
        ];
      });
    },
    [],
  );

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
          if (patch.supplyDeltaRawUsd !== undefined) supply = { ...supply, deltaRawUsd: patch.supplyDeltaRawUsd === null ? undefined : patch.supplyDeltaRawUsd };
          if (patch.borrowDeltaRawUsd !== undefined) borrow = { ...borrow, deltaRawUsd: patch.borrowDeltaRawUsd === null ? undefined : patch.borrowDeltaRawUsd };

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
      prev.map((e) => {
        if (e.reserveId !== reserveId) return e;
        if (!canUnhide(e)) return e;
        return { ...e, hidden: false };
      }),
    );
  }, []);

  const removeReserve = useCallback((reserveId: string) => {
    setEntries((prev) => prev.filter((e) => e.reserveId !== reserveId));
  }, []);

  const importReserves = useCallback((incoming: PortfolioReserveEntry[]) => {
    setEntries((prev) => mergeEntriesWithDelta(prev, incoming));
  }, []);

  const forceSyncReserves = useCallback((incoming: PortfolioReserveEntry[]) => {
    setEntries((prev) => forceSyncEntries(prev, incoming));
  }, []);

  const restoreToWallet = useCallback((reserveId: string, side?: PortfolioSide) => {
    setEntries((prev) => {
      const updated = prev.map((e) => {
        if (e.reserveId !== reserveId) return e;
        const restoreSide = (
          s: PortfolioReserveEntry['supply'],
        ): PortfolioReserveEntry['supply'] => {
          if (s.walletValue === null) return s;
          return { ...s, amount: formatConvertedAmount(s.walletValue), inputMode: 'usd', deltaRawUsd: undefined };
        };
        return {
          ...e,
          hidden: false,
          supply: side === undefined || side === 'supply' ? restoreSide(e.supply) : e.supply,
          borrow: side === undefined || side === 'borrow' ? restoreSide(e.borrow) : e.borrow,
        };
      });
      return applyRestrictedHidden(updated);
    });
  }, []);

  const removeWalletEntries = useCallback((): number => {
    const walletCount = entriesRef.current.filter(
      (e) => e.supply.walletValue !== null || e.borrow.walletValue !== null,
    ).length;
    if (walletCount === 0) return 0;
    setEntries((prev) =>
      prev.filter(
        (e) => e.supply.walletValue === null && e.borrow.walletValue === null,
      ),
    );
    return walletCount;
  }, []);

  const clearAll = useCallback(() => {
    setEntries((prev) =>
      prev.map((e) => {
        const hasWallet = e.supply.walletValue !== null || e.borrow.walletValue !== null;
        if (hasWallet) return { ...e, hidden: true };
        return e;
      }).filter((e) => e.hidden || e.supply.walletValue !== null || e.borrow.walletValue !== null),
    );
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

  const actions = useMemo<PortfolioSimulationActions>(
    () => ({
      setActive,
      addReserve,
      updateReserve,
      hideReserve,
      unhideReserve,
      removeReserve,
      importReserves,
      forceSyncReserves,
      restoreToWallet,
      removeWalletEntries,
      clearAll,
      saveSnapshot,
      deleteSnapshot,
    }),
    [
      addReserve, updateReserve, hideReserve, unhideReserve, removeReserve,
      importReserves, forceSyncReserves, restoreToWallet, removeWalletEntries, clearAll, saveSnapshot, deleteSnapshot,
    ],
  );

  return {
    active,
    entries,
    snapshots,
    actions,
  };
}
