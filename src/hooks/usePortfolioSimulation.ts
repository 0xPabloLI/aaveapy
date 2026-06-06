/**
 * usePortfolioSimulation — state management for multi-token portfolio simulation.
 *
 * Manages positions (add/remove/update), computes per-position results by
 * delegating to `buildRateSimulationResult`, and aggregates via `portfolioCalculator`.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  PortfolioInputMode,
  PortfolioPosition,
  PortfolioPositionResult,
  PortfolioSide,
  PortfolioSnapshot,
  PortfolioSummary,
} from '@/types/portfolio';
import {
  aggregatePortfolioSummary,
  resolvePositionAmountUsd as _resolvePositionAmountUsd,
  buildPortfolioPositionResult as _buildPortfolioPositionResult,
  convertPortfolioInputAmount,
  formatConvertedAmount,
} from '@/lib/portfolioCalculator';
import { mergePositions } from '@/lib/portfolioMerger';

let nextPositionId = 1;
const generatePositionId = (): string => `port-${nextPositionId++}`;

let nextSnapshotId = 1;
const generateSnapshotId = (): string => `snap-${nextSnapshotId++}`;

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface PortfolioSimulationActions {
  /** Toggle portfolio mode on/off. */
  setActive: (active: boolean) => void;
  /** Add a new position. Returns the created positionId. */
  addPosition: (params: {
    reserveId: string;
    marketName: string;
    chainName: string;
    tokenSymbol: string;
    side: PortfolioSide;
    amount?: string;
    inputMode?: PortfolioInputMode;
  }) => string;
  /** Remove a position by its positionId. */
  removePosition: (positionId: string) => void;
  /** Update amount for a position. */
  updateAmount: (positionId: string, amount: string) => void;
  /** Update input mode for a position; converts amount if priceInUsd is provided. */
  updateInputMode: (positionId: string, mode: PortfolioInputMode, priceInUsd?: number) => void;
  /** Remove all positions. */
  clearAll: () => void;
  /** Save current state as a named snapshot (with pre-computed results). */
  saveSnapshot: (label: string, results?: PortfolioPositionResult[], summary?: PortfolioSummary) => void;
  /** Delete a saved snapshot. */
  deleteSnapshot: (snapshotId: string) => void;
  /** Merge wallet positions into current positions (replace/add/keep semantics). */
  importPositions: (incoming: PortfolioPosition[]) => void;
  /** Restore a hidden position (unhide). */
  restorePosition: (positionId: string) => void;
  /** Toggle hidden flag on a position (soft delete). */
  toggleHidden: (positionId: string) => void;
  /** Restore amount/inputMode for a wallet-synced position back to its walletValue (USD). Also unhides. */
  restoreToWallet: (positionId: string) => void;
  /** Soft-delete (hide) or hard-remove every position that shares the given reserveId. */
  removeReserve: (reserveId: string) => void;
  /** Undo the most recent removeReserve call, restoring prior positions verbatim. Returns true if anything was restored. */
  undoLastRemove: () => boolean;
}

export interface UsePortfolioSimulationReturn {
  active: boolean;
  positions: PortfolioPosition[];
  snapshots: PortfolioSnapshot[];
  actions: PortfolioSimulationActions;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePortfolioSimulation(): UsePortfolioSimulationReturn {
  const [active, setActive] = useState(false);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  // Snapshot of positions captured immediately before the last removeReserve call,
  // used by undoLastRemove to restore the prior state verbatim.
  const lastRemoveSnapshotRef = useRef<PortfolioPosition[] | null>(null);

  // --- Actions ---

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
      const positionId = generatePositionId();
      const position: PortfolioPosition = {
        positionId,
        reserveId: params.reserveId,
        marketName: params.marketName,
        chainName: params.chainName,
        tokenSymbol: params.tokenSymbol,
        side: params.side,
        amount: params.amount ?? '',
        inputMode: params.inputMode ?? 'usd',
        walletValue: null,
        hidden: false,
        isOrphan: false,
      };
      setPositions((prev) => [...prev, position]);
      return positionId;
    },
    []
  );

  const removePosition = useCallback((positionId: string) => {
    setPositions((prev) => prev.filter((p) => p.positionId !== positionId));
  }, []);

  const updateAmount = useCallback((positionId: string, amount: string) => {
    setPositions((prev) =>
      prev.map((p) => (p.positionId === positionId ? { ...p, amount } : p))
    );
  }, []);

  const updateInputMode = useCallback((positionId: string, mode: PortfolioInputMode, priceInUsd?: number) => {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.positionId !== positionId) return p;
        const currentAmount = parseFloat(p.amount);
        let newAmount = p.amount;
        if (priceInUsd !== undefined && p.amount.trim() !== '' && Number.isFinite(currentAmount)) {
          const converted = convertPortfolioInputAmount(currentAmount, p.inputMode, mode, priceInUsd);
          newAmount = converted !== null ? formatConvertedAmount(converted) : '';
        }
        return { ...p, inputMode: mode, amount: newAmount };
      })
    );
  }, []);

  const clearAll = useCallback(() => {
    setPositions([]);
  }, []);

  const saveSnapshot = useCallback(
    (label: string, results?: PortfolioPositionResult[], summary?: PortfolioSummary) => {
      const snapshot: PortfolioSnapshot = {
        id: generateSnapshotId(),
        label,
        createdAt: Date.now(),
        positions: [...positions],
        summary: summary ?? aggregatePortfolioSummary([]),
        positionResults: results ?? [],
      };
      setSnapshots((prev) => [...prev, snapshot]);
    },
    [positions],
  );

  const deleteSnapshot = useCallback((snapshotId: string) => {
    setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
  }, []);

  const importPositions = useCallback((incoming: PortfolioPosition[]) => {
    // Auto-complete: for each reserve in incoming positions, ensure both
    // supply and borrow sides exist so users can manually adjust either side.
    const withMissingSides: PortfolioPosition[] = [];
    const seenReserves = new Map<string, Set<PortfolioSide>>();
    for (const pos of incoming) {
      const sides = seenReserves.get(pos.reserveId) ?? new Set<PortfolioSide>();
      sides.add(pos.side);
      seenReserves.set(pos.reserveId, sides);
      withMissingSides.push(pos);
    }
    for (const [reserveId, sides] of seenReserves) {
      const ref = incoming.find(p => p.reserveId === reserveId)!;
      if (!sides.has('supply')) {
        withMissingSides.push({
          positionId: generatePositionId(),
          reserveId,
          marketName: ref.marketName,
          chainName: ref.chainName,
          tokenSymbol: ref.tokenSymbol,
          side: 'supply',
          amount: '',
          inputMode: 'usd',
          walletValue: null,
          hidden: false,
          isOrphan: ref.isOrphan,
        });
      }
      if (!sides.has('borrow')) {
        withMissingSides.push({
          positionId: generatePositionId(),
          reserveId,
          marketName: ref.marketName,
          chainName: ref.chainName,
          tokenSymbol: ref.tokenSymbol,
          side: 'borrow',
          amount: '',
          inputMode: 'usd',
          walletValue: null,
          hidden: false,
          isOrphan: ref.isOrphan,
        });
      }
    }
    setPositions((prev) => mergePositions({ current: prev, incoming: withMissingSides }));
  }, []);

  const restorePosition = useCallback((positionId: string) => {
    setPositions((prev) =>
      prev.map((p) => (p.positionId === positionId ? { ...p, hidden: false } : p))
    );
  }, []);

  const toggleHidden = useCallback((positionId: string) => {
    setPositions((prev) =>
      prev.map((p) => (p.positionId === positionId ? { ...p, hidden: !p.hidden } : p))
    );
  }, []);

  const restoreToWallet = useCallback((positionId: string) => {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.positionId !== positionId) return p;
        if (p.walletValue === null) return p;
        return {
          ...p,
          amount: formatConvertedAmount(p.walletValue),
          inputMode: 'usd',
          hidden: false,
        };
      })
    );
  }, []);

  const removeReserve = useCallback((reserveId: string) => {
    setPositions((prev) => {
      const group = prev.filter((p) => p.reserveId === reserveId);
      const anyWallet = group.some((p) => p.walletValue !== null);
      if (anyWallet) {
        // Reset the group to its actual wallet state:
        // - Wallet-owned sides: restore amount/inputMode to wallet value, un-hide.
        // - Purely manual sides (walletValue === null) layered on top of a wallet
        //   reserve: drop them entirely so the row reflects only what the wallet holds.
        return prev.flatMap((p) => {
          if (p.reserveId !== reserveId) return [p];
          if (p.walletValue === null) return [];
          return [{
            ...p,
            amount: formatConvertedAmount(p.walletValue),
            inputMode: 'usd' as const,
            hidden: false,
          }];
        });
      }
      return prev.filter((p) => p.reserveId !== reserveId);
    });
  }, []);

  const actions = useMemo<PortfolioSimulationActions>(
    () => ({
      setActive,
      addPosition,
      removePosition,
      updateAmount,
      updateInputMode,
      clearAll,
      saveSnapshot,
      deleteSnapshot,
      importPositions,
      restorePosition,
      toggleHidden,
      restoreToWallet,
      removeReserve,
    }),
    [addPosition, removePosition, updateAmount, updateInputMode, clearAll, saveSnapshot, deleteSnapshot, importPositions, restorePosition, toggleHidden, restoreToWallet, removeReserve]
  );

  return {
    active,
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
