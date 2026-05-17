// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePortfolioToggle } from './usePortfolioToggle';
import type { PortfolioPosition } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import type { ReserveWithSpread } from '@/types/aave';

const makeReserve = (overrides: Partial<ReserveWithSpread> = {}): ReserveWithSpread =>
  ({
    reserveId: 'r-1',
    marketName: 'Ethereum-Core',
    chainName: 'Ethereum',
    tokenSymbol: 'WETH',
    supplyApy: 0.05,
    borrowApy: 0.07,
    supplyIncentives: [],
    borrowIncentives: [],
    ...overrides,
  }) as ReserveWithSpread;

const makePosition = (overrides: Partial<PortfolioPosition> = {}): PortfolioPosition =>
  ({
    positionId: 'p-1',
    reserveId: 'r-1',
    marketName: 'Ethereum-Core',
    chainName: 'Ethereum',
    tokenSymbol: 'WETH',
    side: 'supply',
    amount: '100',
    inputMode: 'usd',
    ...overrides,
  }) as PortfolioPosition;

const makeActions = (): PortfolioSimulationActions => ({
  setActive: vi.fn(),
  addPosition: vi.fn(() => 'new-id'),
  removePosition: vi.fn(),
  updateAmount: vi.fn(),
  updateInputMode: vi.fn(),
  clearAll: vi.fn(),
  saveSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
});

describe('usePortfolioToggle', () => {
  describe('portfolioReserveIds', () => {
    it('is empty when there are no positions', () => {
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: false, reserves: [], portfolioPositions: undefined }),
      );
      expect(result.current.portfolioReserveIds.size).toBe(0);
    });

    it('collects unique reserveIds across supply+borrow', () => {
      const positions = [
        makePosition({ positionId: 'p-1', reserveId: 'r-1', side: 'supply' }),
        makePosition({ positionId: 'p-2', reserveId: 'r-1', side: 'borrow' }),
        makePosition({ positionId: 'p-3', reserveId: 'r-2', side: 'supply' }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [], portfolioPositions: positions }),
      );
      expect(Array.from(result.current.portfolioReserveIds).sort()).toEqual(['r-1', 'r-2']);
    });
  });

  describe('handlePortfolioToggle with explicit side', () => {
    it('adds when side does not exist', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          portfolioPositions: [],
          portfolioActions: actions,
        }),
      );

      act(() => result.current.handlePortfolioToggle('r-1', reserve, 'supply'));

      expect(actions.addPosition).toHaveBeenCalledWith({
        reserveId: 'r-1',
        marketName: 'Ethereum-Core',
        chainName: 'Ethereum',
        tokenSymbol: 'WETH',
        side: 'supply',
      });
      expect(actions.removePosition).not.toHaveBeenCalled();
    });

    it('removes only the matching side when it exists', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const positions = [
        makePosition({ positionId: 'p-sup', reserveId: 'r-1', side: 'supply' }),
        makePosition({ positionId: 'p-bor', reserveId: 'r-1', side: 'borrow' }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          portfolioPositions: positions,
          portfolioActions: actions,
        }),
      );

      act(() => result.current.handlePortfolioToggle('r-1', reserve, 'supply'));

      expect(actions.removePosition).toHaveBeenCalledWith('p-sup');
      expect(actions.removePosition).toHaveBeenCalledTimes(1);
      expect(actions.addPosition).not.toHaveBeenCalled();
    });
  });

  describe('handlePortfolioToggle without side', () => {
    it('adds BOTH supply and borrow when reserve is absent', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          portfolioPositions: [],
          portfolioActions: actions,
        }),
      );

      act(() => result.current.handlePortfolioToggle('r-1', reserve));

      expect(actions.addPosition).toHaveBeenCalledTimes(2);
      expect(actions.addPosition).toHaveBeenNthCalledWith(1, expect.objectContaining({ side: 'supply' }));
      expect(actions.addPosition).toHaveBeenNthCalledWith(2, expect.objectContaining({ side: 'borrow' }));
    });

    it('removes ALL positions for the reserve when any side is present', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const positions = [
        makePosition({ positionId: 'p-sup', reserveId: 'r-1', side: 'supply' }),
        makePosition({ positionId: 'p-bor', reserveId: 'r-1', side: 'borrow' }),
        makePosition({ positionId: 'p-other', reserveId: 'r-2', side: 'supply' }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          portfolioPositions: positions,
          portfolioActions: actions,
        }),
      );

      act(() => result.current.handlePortfolioToggle('r-1', reserve));

      expect(actions.removePosition).toHaveBeenCalledTimes(2);
      expect(actions.removePosition).toHaveBeenCalledWith('p-sup');
      expect(actions.removePosition).toHaveBeenCalledWith('p-bor');
      expect(actions.addPosition).not.toHaveBeenCalled();
    });

    it('is a no-op when actions are not provided', () => {
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [makeReserve()],
          portfolioPositions: [],
          portfolioActions: undefined,
        }),
      );

      expect(() => {
        act(() => result.current.handlePortfolioToggle('r-1', makeReserve()));
      }).not.toThrow();
    });
  });

  describe('portfolio results derivation', () => {
    it('returns empty results when not in portfolio mode', () => {
      const positions = [makePosition()];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: false,
          reserves: [makeReserve()],
          portfolioPositions: positions,
        }),
      );
      expect(result.current.portfolioResults).toEqual([]);
      expect(result.current.portfolioSummary.totalSupplyUsd).toBe(0);
      expect(result.current.portfolioSummary.totalBorrowUsd).toBe(0);
    });

    it('returns empty results when there are no positions', () => {
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [makeReserve()],
          portfolioPositions: [],
        }),
      );
      expect(result.current.portfolioResults).toEqual([]);
      expect(result.current.portfolioSummary.totalSupplyUsd).toBe(0);
    });

    it('builds results for positions whose reserve is found and amount > 0', () => {
      const reserve = makeReserve({
        supplyApy: 0.04,
        supplyIncentives: [0.01, 0.005],
      });
      const positions = [makePosition({ amount: '1000', side: 'supply' })];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          portfolioPositions: positions,
        }),
      );

      expect(result.current.portfolioResults).toHaveLength(1);
      expect(result.current.portfolioSummary.totalSupplyUsd).toBeGreaterThan(0);
    });

    it('skips positions whose reserve is not in the reserves array', () => {
      const positions = [makePosition({ reserveId: 'missing' })];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [makeReserve({ reserveId: 'other' })],
          portfolioPositions: positions,
        }),
      );
      expect(result.current.portfolioResults).toEqual([]);
    });
  });
});
