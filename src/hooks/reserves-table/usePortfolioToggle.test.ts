// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { usePortfolioToggle } from './usePortfolioToggle';
import type { PortfolioSimulationContext } from './usePortfolioToggle';
import type { PortfolioReserveEntry } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import type { ReserveWithSpread } from '@/types/aave';
import type { RateCalcInput } from '@/lib/interestRateCalculator';

const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

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

const makeEntry = (overrides: Partial<PortfolioReserveEntry> = {}): PortfolioReserveEntry =>
  ({
    reserveId: 'r-1',
    marketName: 'Ethereum-Core',
    chainName: 'Ethereum',
    tokenSymbol: 'WETH',
    supply: { amount: '100', inputMode: 'usd', walletValue: null },
    borrow: { amount: '', inputMode: 'usd', walletValue: null },
    hidden: false,
    isOrphan: false,
    restrictedStatus: null,
    ...overrides,
  }) as PortfolioReserveEntry;

const makeActions = (): PortfolioSimulationActions => ({
  setActive: vi.fn(),
  addReserve: vi.fn(),
  updateReserve: vi.fn(),
  hideReserve: vi.fn(),
  unhideReserve: vi.fn(),
  importReserves: vi.fn(),
  forceSyncReserves: vi.fn(),
  restoreToWallet: vi.fn(),
  removeReserve: vi.fn(),
  removeWalletEntries: vi.fn(() => 0),
  clearAll: vi.fn(),
  saveSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
});

describe('usePortfolioToggle', () => {
  describe('portfolioReserveIds', () => {
    it('is empty when there are no entries', () => {
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: false, reserves: [], entries: [] }),
      );
      expect(result.current.portfolioReserveIds.size).toBe(0);
    });

    it('collects unique reserveIds from entries', () => {
      const entries = [
        makeEntry({ reserveId: 'r-1' }),
        makeEntry({ reserveId: 'r-2' }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [], entries }),
      );
      expect(Array.from(result.current.portfolioReserveIds).sort()).toEqual(['r-1', 'r-2']);
    });

    it('hiddenReserveIds contains only hidden entries', () => {
      const entries = [
        makeEntry({ reserveId: 'r-1', hidden: false }),
        makeEntry({ reserveId: 'r-2', hidden: true }),
        makeEntry({ reserveId: 'r-3', hidden: true }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [], entries }),
      );
      expect(Array.from(result.current.hiddenReserveIds).sort()).toEqual(['r-2', 'r-3']);
      expect(Array.from(result.current.portfolioReserveIds).sort()).toEqual(['r-1', 'r-2', 'r-3']);
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
          entries: [],
          portfolioActions: actions,
        }),
      );

      act(() => result.current.handlePortfolioToggle('r-1', reserve, 'supply'));

      expect(actions.addReserve).toHaveBeenCalledTimes(1);
      expect(actions.addReserve).toHaveBeenCalledWith({
        reserveId: 'r-1',
        marketName: 'Ethereum-Core',
        chainName: 'Ethereum',
        tokenSymbol: 'WETH',
        restrictedStatus: null,
      });
    });

    it('calls removeReserve when the entry is manual (no wallet data)', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const entries = [
        makeEntry({ reserveId: 'r-1', supply: { amount: '100', inputMode: 'usd', walletValue: null }, borrow: { amount: '', inputMode: 'usd', walletValue: null } }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          entries,
          portfolioActions: actions,
        }),
      );

      act(() => result.current.handlePortfolioToggle('r-1', reserve, 'supply'));

      expect(actions.removeReserve).toHaveBeenCalledWith('r-1');
    });

    it('calls hideReserve when the matching side is wallet-owned', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const entries = [
        makeEntry({ reserveId: 'r-1', supply: { amount: '100', inputMode: 'usd', walletValue: 100 }, borrow: { amount: '50', inputMode: 'usd', walletValue: 50 } }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          entries,
          portfolioActions: actions,
        }),
      );

      act(() => result.current.handlePortfolioToggle('r-1', reserve, 'supply'));

      expect(actions.hideReserve).toHaveBeenCalledWith('r-1');
      expect(actions.hideReserve).toHaveBeenCalledTimes(1);
      expect(actions.addReserve).not.toHaveBeenCalled();
    });
  });

  describe('handlePortfolioToggle without side', () => {
    it('adds reserve when absent', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          entries: [],
          portfolioActions: actions,
        }),
      );

      act(() => result.current.handlePortfolioToggle('r-1', reserve));

      expect(actions.addReserve).toHaveBeenCalledTimes(1);
      expect(actions.addReserve).toHaveBeenCalledWith({
        reserveId: 'r-1',
        marketName: 'Ethereum-Core',
        chainName: 'Ethereum',
        tokenSymbol: 'WETH',
        restrictedStatus: null,
      });
    });

    it('calls hideReserve for wallet-owned entry when entry is present', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const entries = [
        makeEntry({ reserveId: 'r-1', supply: { amount: '100', inputMode: 'usd', walletValue: 100 } }),
        makeEntry({ reserveId: 'r-2' }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          entries,
          portfolioActions: actions,
        }),
      );

      act(() => result.current.handlePortfolioToggle('r-1', reserve));

      expect(actions.hideReserve).toHaveBeenCalledWith('r-1');
      expect(actions.hideReserve).toHaveBeenCalledTimes(1);
      expect(actions.addReserve).not.toHaveBeenCalled();
    });

    it('passes hubName and hubId when adding a V4 reserve', () => {
      const actions = makeActions();
      const reserve = makeReserve({
        reserveId: 'r-v4',
        marketName: 'AaveV4Ethereum',
        hubName: 'Core',
        hubId: 'hub-core',
      });
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          entries: [],
          portfolioActions: actions,
        }),
      );

      act(() => result.current.handlePortfolioToggle('r-v4', reserve));

      expect(actions.addReserve).toHaveBeenCalledWith({
        reserveId: 'r-v4',
        marketName: 'AaveV4Ethereum',
        chainName: 'Ethereum',
        tokenSymbol: 'WETH',
        restrictedStatus: null,
        hubName: 'Core',
        hubId: 'hub-core',
      });
    });

    it('omits hubName and hubId when adding a V3 reserve', () => {
      const actions = makeActions();
      const reserve = makeReserve({ reserveId: 'r-1' });
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          entries: [],
          portfolioActions: actions,
        }),
      );

      act(() => result.current.handlePortfolioToggle('r-1', reserve));

      expect(actions.addReserve).toHaveBeenCalledWith({
        reserveId: 'r-1',
        marketName: 'Ethereum-Core',
        chainName: 'Ethereum',
        tokenSymbol: 'WETH',
        restrictedStatus: null,
      });
    });

    it('is a no-op when actions are not provided', () => {
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [makeReserve()],
          entries: [],
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
      const entries = [makeEntry()];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: false,
          reserves: [makeReserve()],
          entries,
        }),
      );
      expect(result.current.portfolioResults).toEqual([]);
      expect(result.current.portfolioSummary.totalSupplyUsd).toBe(0);
      expect(result.current.portfolioSummary.totalBorrowUsd).toBe(0);
    });

    it('returns empty results when there are no entries', () => {
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [makeReserve()],
          entries: [],
        }),
      );
      expect(result.current.portfolioResults).toEqual([]);
      expect(result.current.portfolioSummary.totalSupplyUsd).toBe(0);
    });

    it('builds results for entries whose reserve is found and amount > 0', () => {
      const reserve = makeReserve({
        supplyApy: 0.04,
        supplyIncentives: [0.01, 0.005],
      });
      const entries = [makeEntry({ supply: { amount: '1000', inputMode: 'usd', walletValue: null } })];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          entries,
        }),
      );

      expect(result.current.portfolioResults).toHaveLength(1);
      expect(result.current.portfolioSummary.totalSupplyUsd).toBeGreaterThan(0);
    });

    it('skips entries whose reserve is not in the reserves array', () => {
      const entries = [makeEntry({ reserveId: 'missing' })];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [makeReserve({ reserveId: 'other' })],
          entries,
        }),
      );
      expect(result.current.portfolioResults).toEqual([]);
    });

    it('AAV-749: cross-chain entry missing results when reserves is filtered subset (bug scenario)', () => {
      const inkReserve = makeReserve({
        reserveId: 'ink-usdc',
        chainName: 'Ink',
        supplyApy: 0.03,
        borrowApy: 0.05,
      });
      const celoReserve = makeReserve({
        reserveId: 'celo-usdt',
        chainName: 'Celo',
        supplyApy: 0.04,
        borrowApy: 0.06,
      });
      const filteredReserves = [inkReserve];
      const entries = [
        makeEntry({
          reserveId: 'celo-usdt',
          supply: { amount: '5000', inputMode: 'usd', walletValue: null },
        }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: filteredReserves,
          entries,
        }),
      );
      expect(result.current.portfolioResults).toEqual([]);
      expect(result.current.portfolioSummary.totalSupplyUsd).toBe(0);
    });

    it('AAV-749: cross-chain entry has results when reserves includes all chains (fixed scenario)', () => {
      const inkReserve = makeReserve({
        reserveId: 'ink-usdc',
        chainName: 'Ink',
        supplyApy: 0.03,
        borrowApy: 0.05,
      });
      const celoReserve = makeReserve({
        reserveId: 'celo-usdt',
        chainName: 'Celo',
        supplyApy: 0.04,
        borrowApy: 0.06,
      });
      const allReserves = [inkReserve, celoReserve];
      const entries = [
        makeEntry({
          reserveId: 'celo-usdt',
          supply: { amount: '5000', inputMode: 'usd', walletValue: null },
        }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: allReserves,
          entries,
        }),
      );
      expect(result.current.portfolioResults).toHaveLength(1);
      expect(result.current.portfolioResults[0].nativePercent).toBe(0.04);
      expect(result.current.portfolioSummary.totalSupplyUsd).toBeGreaterThan(0);
    });
  });

  describe('restricted reserve removal guard', () => {
    it('blocks hideReserve for restricted (paused) reserve without side', () => {
      const actions = makeActions();
      const reserve = makeReserve({ isPaused: true });
      const entries = [
        makeEntry({ reserveId: 'r-1', restrictedStatus: 'paused', supply: { amount: '100', inputMode: 'usd', walletValue: 100 } }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries, portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve));
      expect(actions.hideReserve).not.toHaveBeenCalled();
    });

    it('blocks hideReserve for restricted (frozen) reserve without side', () => {
      const actions = makeActions();
      const reserve = makeReserve({ isFrozen: true });
      const entries = [
        makeEntry({ reserveId: 'r-1', restrictedStatus: 'frozen', supply: { amount: '100', inputMode: 'usd', walletValue: null } }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries, portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve));
      expect(actions.hideReserve).not.toHaveBeenCalled();
    });

    it('blocks removal for restricted reserve with explicit side', () => {
      const actions = makeActions();
      const reserve = makeReserve({ isActive: false });
      const entries = [
        makeEntry({ reserveId: 'r-1', restrictedStatus: 'inactive', supply: { amount: '100', inputMode: 'usd', walletValue: 100 } }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries, portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve, 'supply'));
      expect(actions.hideReserve).not.toHaveBeenCalled();
    });

    it('allows removal of non-restricted reserve', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const entries = [
        makeEntry({ reserveId: 'r-1', supply: { amount: '100', inputMode: 'usd', walletValue: 100 } }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries, portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve));
      expect(actions.hideReserve).toHaveBeenCalledWith('r-1');
    });
  });

  describe('hidden entries', () => {
    it('calls unhideReserve for hidden entry without side', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const entries = [
        makeEntry({ reserveId: 'r-1', hidden: true, supply: { amount: '100', inputMode: 'usd', walletValue: 100 } }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries, portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve));
      expect(actions.unhideReserve).toHaveBeenCalledWith('r-1');
      expect(actions.hideReserve).not.toHaveBeenCalled();
    });

    it('calls unhideReserve for hidden entry with explicit side', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const entries = [
        makeEntry({ reserveId: 'r-1', hidden: true, supply: { amount: '100', inputMode: 'usd', walletValue: 100 } }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries, portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve, 'supply'));
      expect(actions.unhideReserve).toHaveBeenCalledWith('r-1');
      expect(actions.hideReserve).not.toHaveBeenCalled();
    });

    it('still calls hideReserve for non-hidden wallet entry', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const entries = [
        makeEntry({ reserveId: 'r-1', hidden: false, supply: { amount: '100', inputMode: 'usd', walletValue: 100 } }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries, portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve));
      expect(actions.hideReserve).toHaveBeenCalledWith('r-1');
      expect(actions.unhideReserve).not.toHaveBeenCalled();
    });
  });

  describe('toast behavior', () => {
    beforeEach(() => {
      mockToast.mockReset();
    });

    it('addReserve is called without toast (no side)', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries: [], portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve));
      expect(actions.addReserve).toHaveBeenCalledTimes(1);
    });

    it('addReserve is called without toast (explicit side)', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries: [], portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve, 'supply'));
      expect(actions.addReserve).toHaveBeenCalledTimes(1);
    });

    it('does NOT emit toast for hideReserve (wallet entry)', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const entries = [makeEntry({ supply: { amount: '100', inputMode: 'usd', walletValue: 100 } })];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries, portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve));
      expect(actions.hideReserve).toHaveBeenCalledWith('r-1');
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('does NOT emit toast for removeReserve (manual entry, no wallet data)', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const entries = [makeEntry({ supply: { amount: '100', inputMode: 'usd', walletValue: null } })];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries, portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve));
      expect(actions.removeReserve).toHaveBeenCalledWith('r-1');
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('does NOT emit toast for unhideReserve (hidden entry)', () => {
      const actions = makeActions();
      const reserve = makeReserve();
      const entries = [makeEntry({ hidden: true, supply: { amount: '100', inputMode: 'usd', walletValue: 100 } })];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries, portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve));
      expect(actions.unhideReserve).toHaveBeenCalledWith('r-1');
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('does NOT emit toast for restricted reserve', () => {
      const actions = makeActions();
      const reserve = makeReserve({ isPaused: true });
      const entries = [makeEntry({ restrictedStatus: 'paused', supply: { amount: '100', inputMode: 'usd', walletValue: null } })];
      const { result } = renderHook(() =>
        usePortfolioToggle({ isPortfolioMode: true, reserves: [reserve], entries, portfolioActions: actions }),
      );
      act(() => result.current.handlePortfolioToggle('r-1', reserve));
      expect(mockToast).not.toHaveBeenCalled();
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
        ltv: 80,
        liquidationThreshold: 80,
        ...overrides,
      }) as ReserveWithSpread & RateCalcInput;

    it('uses full simulation when simulationContext is provided', () => {
      const reserve = makeRateCalcReserve();
      const entries = [
        makeEntry({
          supply: { amount: '10000', inputMode: 'usd', walletValue: null },
          borrow: { amount: '5000', inputMode: 'usd', walletValue: null },
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
          entries,
          simulationContext: ctx,
        }),
      );
      expect(result.current.portfolioResults).toHaveLength(2);
      expect(result.current.portfolioSummary.totalSupplyUsd).toBeGreaterThan(0);
      expect(result.current.portfolioSummary.totalBorrowUsd).toBeGreaterThan(0);
      // Regression: portfolioHealthFactors must be defined (not undefined) when
      // simulationContext is provided.  Previously a key mismatch in useMemo
      // destructuring caused it to always be undefined.
      expect(result.current.portfolioHealthFactors).toBeDefined();
      expect(result.current.portfolioHealthFactors).toHaveLength(1);
      expect(result.current.portfolioHealthFactors![0].healthFactor).not.toBeNull();
      expect(result.current.portfolioHealthFactors![0].healthFactor!).toBeGreaterThan(0);
    });

    it('falls back to simplified calculation without simulationContext', () => {
      const reserve = makeRateCalcReserve({ supplyApy: 3.0, supplyIncentives: [0.5] });
      const entries = [
        makeEntry({ supply: { amount: '10000', inputMode: 'usd', walletValue: null } }),
      ];
      const { result } = renderHook(() =>
        usePortfolioToggle({
          isPortfolioMode: true,
          reserves: [reserve],
          entries,
        }),
      );
      expect(result.current.portfolioResults).toHaveLength(1);
      expect(result.current.portfolioResults[0].nativePercent).toBe(3.0);
      expect(result.current.portfolioResults[0].incentivePercent).toBe(0.5);
    });

    it('with simulationContext but empty forecastStates, still produces results', () => {
      const reserve = makeRateCalcReserve();
      const entries = [
        makeEntry({ supply: { amount: '10000', inputMode: 'usd', walletValue: null } }),
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
          entries,
          simulationContext: ctx,
        }),
      );
      expect(result.current.portfolioResults).toHaveLength(1);
      expect(result.current.portfolioResults[0].nativePercent).toBeGreaterThan(0);
    });
  });
});
