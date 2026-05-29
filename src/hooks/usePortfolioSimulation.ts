/**
 * usePortfolioSimulation — state management for multi-token portfolio simulation.
 *
 * Manages positions (add/remove/update), computes per-position results by
 * delegating to `buildRateSimulationResult`, and aggregates via `portfolioCalculator`.
 */

import { useCallback, useMemo, useState } from 'react';
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
  /** Update input mode for a position. */
  updateInputMode: (positionId: string, mode: PortfolioInputMode) => void;
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

  const updateInputMode = useCallback((positionId: string, mode: PortfolioInputMode) => {
    setPositions((prev) =>
      prev.map((p) => (p.positionId === positionId ? { ...p, inputMode: mode } : p))
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
    setPositions((prev) => mergePositions({ current: prev, incoming }));
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
    }),
    [addPosition, removePosition, updateAmount, updateInputMode, clearAll, saveSnapshot, deleteSnapshot, importPositions, restorePosition, toggleHidden]
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
