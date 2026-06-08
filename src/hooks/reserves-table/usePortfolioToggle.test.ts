// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePortfolioToggle } from './usePortfolioToggle';
import type { PortfolioSimulationContext } from './usePortfolioToggle';
import type { PortfolioPosition } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import type { ReserveWithSpread } from '@/types/aave';
import type { RateCalcInput } from '@/lib/interestRateCalculator';

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
    walletValue: null,
    hidden: false,
    isOrphan: false,
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
  importPositions: vi.fn(),
  restorePosition: vi.fn(),
  toggleHidden: vi.fn(),
  restoreToWallet: vi.fn(),
  removeReserve: vi.fn(),
  hideOrRemoveReserveAction: vi.fn(),
  unhideReserveAction: vi.fn(),
  undoLastRemove: vi.fn(),
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

      expect(actions.addPosition).toHaveBeenCalledTimes(2);
      expect(actions.addPosition).toHaveBeenNthCalledWith(1, {
        reserveId: 'r-1',
        marketName: 'Ethereum-Core',
        chainName: 'Ethereum',
        tokenSymbol: 'WETH',
        side: 'supply',
      });
      expect(actions.addPosition).toHaveBeenNthCalledWith(2, {
        reserveId: 'r-1',
        marketName: 'Ethereum-Core',
        chainName: 'Ethereum',
        tokenSymbol: 'WETH',
        side: 'borrow',
      });
      expect(actions.removePosition).not.toHaveBeenCalled();
    });

    it('adds only the missing side when opposite side already exists', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const positions = [
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

      expect(actions.addPosition).toHaveBeenCalledTimes(1);
      expect(actions.addPosition).toHaveBeenCalledWith({
        reserveId: 'r-1',
        marketName: 'Ethereum-Core',
        chainName: 'Ethereum',
        tokenSymbol: 'WETH',
        side: 'supply',
      });
    });

    it('calls hideOrRemoveReserveAction when the matching side exists', () => {
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

      expect(actions.hideOrRemoveReserveAction).toHaveBeenCalledWith('r-1');
      expect(actions.hideOrRemoveReserveAction).toHaveBeenCalledTimes(1);
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

    it('calls hideOrRemoveReserveAction for the reserve when any side is present', () => {
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

      expect(actions.hideOrRemoveReserveAction).toHaveBeenCalledWith('r-1');
      expect(actions.hideOrRemoveReserveAction).toHaveBeenCalledTimes(1);
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

  describe('simulationContext (Phase 2)', () => {
    const makeRateCalcReserve = (
      overrides: Partial<ReserveWithSpread> = {},
    ): ReserveWithSpread & RateCalcInput =>
      ({
        reserveId: 'r-1',
        marketName: 'Core',
        chainName: 'Ethereum',
        chainId: 1,
        tokenSymbol: 'USDC',
        tokenAddress: '0x0000000000000000000000000000000000000001',
        aTokenAddress: '0x0000000000000000000000000000000000000002',
        vTokenAddress: '0x0000000000000000000000000000000000000003',
        decimals: 6,
        tokenPrice: 1,
        supplied: '50000000000000',
        borrowed: '20000000000000',
        liquidity: '30000000000000',
        deficit: '0',
        supplyCap: '100000000000000',
        borrowCap: '80000000000000',
        suppliable: '50000000000000',
        borrowable: '60000000000000',
        protocolFee: 10,
        slopeBelowOptimal: 4,
        slopeAboveOptimal: 75,
        baseBorrowRate: 0,
        optimalUtilization: 80,
        supplyApy: 2.5,
        borrowApy: 4.8,
        utilizationPct: 40,
        supplyIncentives: [],
        borrowIncentives: [],
        meritSupplys: [],
        meritBorrows: [],
        merklSupplys: [],
        merklBorrows: [],
        brevisSupplys: [],
        brevisBorrows: [],
        ...overrides,
      }) as ReserveWithSpread & RateCalcInput;

    it('uses full simulation when simulationContext is provided', () => {
      const reserve = makeRateCalcReserve();
      const positions = [
        makePosition({
          positionId: 'p-sup',
          side: 'supply',
          amount: '10000',
        }),
        makePosition({
          positionId: 'p-bor',
          side: 'borrow',
          amount: '5000',
        }),
      ];
      const ctx: PortfolioSimulationContext = {
        isApy: true,
        whitelistMerklCampaignIds: new Set(),
        tydroPointToUsdRate: 0,
        forecastStates: {},
      };
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          portfolioPositions: positions,
          simulationContext: ctx,
        }),
      );
      expect(result.current.portfolioResults).toHaveLength(2);
      expect(result.current.portfolioSummary.totalSupplyUsd).toBeGreaterThan(0);
      expect(result.current.portfolioSummary.totalBorrowUsd).toBeGreaterThan(0);
    });

    it('falls back to simplified calculation without simulationContext', () => {
      const reserve = makeRateCalcReserve({ supplyApy: 3.0, supplyIncentives: [0.5] });
      const positions = [
        makePosition({ positionId: 'p-sup', side: 'supply', amount: '10000' }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          portfolioPositions: positions,
        }),
      );
      expect(result.current.portfolioResults).toHaveLength(1);
      expect(result.current.portfolioResults[0].nativePercent).toBe(3.0);
      expect(result.current.portfolioResults[0].incentivePercent).toBe(0.5);
    });

    it('with simulationContext but empty forecastStates, still produces results', () => {
      const reserve = makeRateCalcReserve();
      const positions = [
        makePosition({ positionId: 'p-sup', side: 'supply', amount: '10000' }),
      ];
      const ctx: PortfolioSimulationContext = {
        isApy: true,
        whitelistMerklCampaignIds: new Set(),
        tydroPointToUsdRate: 0,
        forecastStates: {},
      };
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          portfolioPositions: positions,
          simulationContext: ctx,
        }),
      );
      expect(result.current.portfolioResults).toHaveLength(1);
      expect(result.current.portfolioResults[0].nativePercent).toBeGreaterThan(0);
    });
  });
});
