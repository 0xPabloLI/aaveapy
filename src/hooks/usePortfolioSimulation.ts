/**
 * usePortfolioSimulation — state management for multi-token portfolio simulation.
 *
 * Manages entries (reserve-level, supply+borrow together), computes per-position
 * results by delegating to `buildRateSimulationResult`, and aggregates via
 * `portfolioCalculator`.
 *
 * Primary state: `entries: PortfolioReserveEntry[]` (new API).
 * Derived: `positions: PortfolioPosition[]` (legacy, one position per side).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  DeltaSign,
  PortfolioInputMode,
  PortfolioPosition,
  PortfolioPositionResult,
  PortfolioReserveEntry,
  PortfolioSide,
  PortfolioSnapshot,
  PortfolioSummary,
  ReservePatch,
} from '@/types/portfolio';
import {
  aggregatePortfolioSummary,
  resolvePositionAmountUsd as _resolvePositionAmountUsd,
  buildPortfolioPositionResult as _buildPortfolioPositionResult,
  convertPortfolioInputAmount,
  formatConvertedAmount,
} from '@/lib/portfolioCalculator';
import { computeDelta } from '@/lib/deltaCalculator';

let nextPositionId = 1;
const generatePositionId = (): string => `port-${nextPositionId++}`;

let nextSnapshotId = 1;
const generateSnapshotId = (): string => `snap-${nextSnapshotId++}`;

// ---------------------------------------------------------------------------
// Entry ↔ Position conversion helpers
// ---------------------------------------------------------------------------

const EMPTY_SIDE = { amount: '', inputMode: 'usd' as const, walletValue: null };

function entriesToPositions(entries: PortfolioReserveEntry[]): PortfolioPosition[] {
  return entries.flatMap((e) => {
    const sides: PortfolioPosition[] = [];
    const makePos = (side: PortfolioSide, s: PortfolioReserveEntry['supply']): PortfolioPosition => ({
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
  /** Toggle portfolio mode on/off. */
  setActive: (active: boolean) => void;
  /** Add a reserve entry (supply + borrow together). No-op if reserveId already exists. */
  addReserve: (params: {
    reserveId: string;
    marketName: string;
    chainName: string;
    tokenSymbol: string;
  }) => void;
  /** Remove an entire reserve entry by reserveId. */
  removeReserve: (reserveId: string) => void;
  /** Patch specific fields on a reserve entry. priceInUsd used for inputMode conversion. */
  updateReserve: (reserveId: string, patch: ReservePatch, priceInUsd?: number) => void;
  /** Hide a reserve entry (soft delete). */
  hideReserve: (reserveId: string) => void;
  /** Unhide a reserve entry. */
  unhideReserve: (reserveId: string) => void;
  /** Import wallet entries with delta-preserving merge. */
  importReserves: (incoming: PortfolioReserveEntry[]) => void;
  /** Restore one or both sides to wallet values. */
  restoreToWallet: (reserveId: string, side?: PortfolioSide) => void;
  /** Remove all entries. */
  clearAll: () => void;
  /** Save current state as a named snapshot. */
  saveSnapshot: (label: string, results?: PortfolioPositionResult[], summary?: PortfolioSummary) => void;
  /** Delete a saved snapshot. */
  deleteSnapshot: (snapshotId: string) => void;
  /** Undo the most recent removeReserve call. Returns true if anything was restored. */
  undoLastRemove: () => boolean;

  // --- Legacy position-level actions (deprecated, will be removed after UI migration) ---
  /** @deprecated Use addReserve instead. */
  addPosition: (params: {
    reserveId: string;
    marketName: string;
    chainName: string;
    tokenSymbol: string;
    side: PortfolioSide;
    amount?: string;
    inputMode?: PortfolioInputMode;
  }) => string;
  /** @deprecated Use removeReserve instead. */
  removePosition: (positionId: string) => void;
  /** @deprecated Use updateReserve instead. */
  updateAmount: (positionId: string, amount: string) => void;
  /** @deprecated */
  updateDeltaSign: (positionId: string, sign: DeltaSign) => void;
  /** @deprecated Use updateReserve instead. */
  updateInputMode: (positionId: string, mode: PortfolioInputMode, priceInUsd?: number) => void;
  /** @deprecated Use importReserves instead. */
  importPositions: (incoming: PortfolioPosition[]) => void;
  /** @deprecated Use unhideReserve instead. */
  restorePosition: (positionId: string) => void;
  /** @deprecated Use hideReserve/unhideReserve instead. */
  toggleHidden: (positionId: string) => void;
  /** @deprecated Use hideOrRemoveReserveAction instead. */
  hideOrRemoveReserveAction: (reserveId: string) => void;
  /** @deprecated Use unhideReserve instead. */
  unhideReserveAction: (reserveId: string) => void;
}

export interface UsePortfolioSimulationReturn {
  active: boolean;
  /** Reserve-level entries (primary API). */
  entries: PortfolioReserveEntry[];
  /** @deprecated Side-level positions (derived from entries). Use entries instead. */
  positions: PortfolioPosition[];
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

  const positions = useMemo(() => entriesToPositions(entries), [entries]);

  // --- Entry-level actions ---

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

  // --- Legacy position-level actions (operate on entries internally) ---

  const addPosition = useCallback(
    (params: {
      reserveId: string;
      marketName: string;
      chainName: string;
      tokenSymbol: string;
      side: PortfolioSide;
      amount?: string;
      inputMode?: PortfolioInputMode;
    }): string => {
      const positionId = `${params.reserveId}::${params.side}`;
      setEntries((prev) => {
        const existing = prev.find((e) => e.reserveId === params.reserveId);
        if (existing) {
          return prev.map((e) => {
            if (e.reserveId !== params.reserveId) return e;
            return {
              ...e,
              [params.side]: {
                ...e[params.side],
                amount: params.amount ?? e[params.side].amount,
                inputMode: params.inputMode ?? e[params.side].inputMode,
              },
            };
          });
        }
        return [
          ...prev,
          {
            reserveId: params.reserveId,
            marketName: params.marketName,
            chainName: params.chainName,
            tokenSymbol: params.tokenSymbol,
            supply: params.side === 'supply'
              ? { amount: params.amount ?? '', inputMode: params.inputMode ?? 'usd', walletValue: null }
              : { ...EMPTY_SIDE },
            borrow: params.side === 'borrow'
              ? { amount: params.amount ?? '', inputMode: params.inputMode ?? 'usd', walletValue: null }
              : { ...EMPTY_SIDE },
            hidden: false,
            isOrphan: false,
          },
        ];
      });
      return positionId;
    },
    [],
  );

  const removePosition = useCallback((positionId: string) => {
    const reserveId = positionId.split('::')[0];
    setEntries((prev) => prev.filter((e) => e.reserveId !== reserveId));
  }, []);

  const updateAmount = useCallback((positionId: string, amount: string) => {
    const [reserveId, sideStr] = positionId.split('::');
    const side = sideStr as PortfolioSide;
    setEntries((prev) =>
      prev.map((e) => {
        if (e.reserveId !== reserveId) return e;
        return { ...e, [side]: { ...e[side], amount } };
      }),
    );
  }, []);

  const updateDeltaSign = useCallback((positionId: string, sign: DeltaSign) => {
    const [reserveId, sideStr] = positionId.split('::');
    const side = sideStr as PortfolioSide;
    setEntries((prev) =>
      prev.map((e) => {
        if (e.reserveId !== reserveId) return e;
        return { ...e, [side]: { ...e[side], deltaSign: sign } };
      }),
    );
  }, []);

  const updateInputMode = useCallback(
    (positionId: string, mode: PortfolioInputMode, priceInUsd?: number) => {
      const [reserveId, sideStr] = positionId.split('::');
      const side = sideStr as PortfolioSide;
      setEntries((prev) =>
        prev.map((e) => {
          if (e.reserveId !== reserveId) return e;
          const s = e[side];
          const currentAmount = parseFloat(s.amount);
          let newAmount = s.amount;
          if (priceInUsd !== undefined && s.amount.trim() !== '' && Number.isFinite(currentAmount)) {
            const converted = convertPortfolioInputAmount(currentAmount, s.inputMode, mode, priceInUsd);
            newAmount = converted !== null ? formatConvertedAmount(converted) : '';
          }
          return { ...e, [side]: { ...s, inputMode: mode, amount: newAmount } };
        }),
      );
    },
    [],
  );

  const importPositions = useCallback((incoming: PortfolioPosition[]) => {
    const reserveMap = new Map<string, PortfolioReserveEntry>();
    for (const pos of incoming) {
      let entry = reserveMap.get(pos.reserveId);
      if (!entry) {
        entry = {
          reserveId: pos.reserveId,
          marketName: pos.marketName,
          chainName: pos.chainName,
          tokenSymbol: pos.tokenSymbol,
          supply: { ...EMPTY_SIDE },
          borrow: { ...EMPTY_SIDE },
          hidden: pos.hidden,
          isOrphan: pos.isOrphan,
        };
      }
      entry = {
        ...entry,
        [pos.side]: {
          amount: pos.amount,
          inputMode: pos.inputMode,
          walletValue: pos.walletValue,
          source: pos.source,
          deltaSign: pos.deltaSign,
        },
      };
      reserveMap.set(pos.reserveId, entry);
    }
    const incomingEntries = Array.from(reserveMap.values());
    setEntries((prev) => mergeEntriesWithDelta(prev, incomingEntries));
  }, []);

  const restorePosition = useCallback((positionId: string) => {
    const reserveId = positionId.split('::')[0];
    unhideReserve(reserveId);
  }, [unhideReserve]);

  const toggleHidden = useCallback((positionId: string) => {
    const reserveId = positionId.split('::')[0];
    setEntries((prev) =>
      prev.map((e) => (e.reserveId === reserveId ? { ...e, hidden: !e.hidden } : e)),
    );
  }, []);

  const hideOrRemoveReserveAction = useCallback((reserveId: string) => {
    setEntries((prev) => {
      const entry = prev.find((e) => e.reserveId === reserveId);
      if (!entry) return prev;
      const anyWallet = entry.supply.walletValue !== null || entry.borrow.walletValue !== null;
      if (anyWallet) {
        return prev.map((e) => {
          if (e.reserveId !== reserveId) return e;
          return {
            ...e,
            supply: {
              ...e.supply,
              amount: e.supply.walletValue !== null ? formatConvertedAmount(e.supply.walletValue) : '',
              inputMode: e.supply.walletValue !== null ? 'usd' as const : e.supply.inputMode,
              walletValue: e.supply.walletValue,
            },
            borrow: {
              ...e.borrow,
              amount: e.borrow.walletValue !== null ? formatConvertedAmount(e.borrow.walletValue) : '',
              inputMode: e.borrow.walletValue !== null ? 'usd' as const : e.borrow.inputMode,
              walletValue: e.borrow.walletValue,
            },
            hidden: true,
          };
        });
      }
      return prev.filter((e) => e.reserveId !== reserveId);
    });
  }, []);

  const unhideReserveAction = useCallback((reserveId: string) => {
    unhideReserve(reserveId);
  }, [unhideReserve]);

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
      clearAll,
      saveSnapshot,
      deleteSnapshot,
      undoLastRemove,
      addPosition,
      removePosition,
      updateAmount,
      updateDeltaSign,
      updateInputMode,
      importPositions,
      restorePosition,
      toggleHidden,
      hideOrRemoveReserveAction,
      unhideReserveAction,
    }),
    [
      addReserve, removeReserve, updateReserve, hideReserve, unhideReserve,
      importReserves, restoreToWallet, clearAll, saveSnapshot, deleteSnapshot,
      undoLastRemove, addPosition, removePosition, updateAmount, updateDeltaSign,
      updateInputMode, importPositions, restorePosition, toggleHidden,
      hideOrRemoveReserveAction, unhideReserveAction,
    ],
  );

  return {
    active,
    entries,
    positions,
    snapshots,
    actions,
  };
}

// ---------------------------------------------------------------------------
// Re-exports from portfolioCalculator (deprecated: import from @/lib/portfolioCalculator instead)
// ---------------------------------------------------------------------------

/** @deprecated Import from @/lib/portfolioCalculator instead */
export const resolvePositionAmountUsd = _resolvePositionAmountUsd;

/** @deprecated Import from @/lib/portfolioCalculator instead */
export const buildPortfolioPositionResult = _buildPortfolioPositionResult;
