import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ReservesTableShowMore, ReservesTableFloatingScroll } from './ReservesTablePagination';
import { Table, TableBody } from '@/components/ui/table';
import { ReserveWithSpread, TokenPricesIndex, MerklForecastWireItem, CampaignAccessStatus } from '@/types/aave';
import {
  calculateTotalSupplyApr,
  calculateTotalSupplyApy,
  calculateTotalBorrowApr,
  calculateTotalBorrowApy,
} from '@/lib/rateCalculations';
import { formatPercent, formatSpread, formatUsd } from '@/lib/formatters';
import { getReserveIncentiveValues, resolveVisibleIncentiveBadgeValue } from '@/lib/incentiveAggregation';
import ScenarioControls, { type ScenarioControlsHandle } from './ScenarioControls';
import { sortReserves, type ReserveSortConfig, type ReserveSortValueGetters } from '@/lib/reservesSorter';
import { getChainIconSrc } from '@/lib/chainIcons';
import { buildAaveUrl } from '@/lib/aaveLinks';
import { openExternalUrl } from '@/lib/externalNavigation';
import { calculateDeficitShareRatio, getReserveDeficitUsdAmount } from '@/lib/deficit';
import ReservesTableTooltipOverlay from './ReservesTableTooltipOverlay';
import DesktopReserveRow from './DesktopReserveRow';
import ReservesTableDesktopHeader from './ReservesTableDesktopHeader';
import ReservesTableMobileGrid from './ReservesTableMobileGrid';
import ReservesTableMobileSortBar, {
  type MobileSortOption,
} from './ReservesTableMobileSortBar';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  useReservesTableSort,
  selectSortOption,
  toggleSortOrder,
  toggleSortOrderAscFirst,
  type SortMode,
  type SortableColumn,
} from '@/hooks/reserves-table/useReservesTableSort';
import { buildSortActions, type SortActions } from '@/hooks/reserves-table/buildSortActions';
import {
  useReservesPagination,
  DEFAULT_VISIBLE_COUNT,
} from '@/hooks/reserves-table/useReservesPagination';
import { useReserveExpansion } from '@/hooks/reserves-table/useReserveExpansion';
import { useScenarioPinScroll } from '@/hooks/reserves-table/useScenarioPinScroll';
import { useReservesTooltip } from '@/hooks/reserves-table/useReservesTooltip';
import { usePortfolioToggle, PortfolioSimulationContext } from '@/hooks/reserves-table/usePortfolioToggle';
import { useReservesLayoutRefs } from '@/hooks/reserves-table/useReservesLayoutRefs';
import { useSharedRateSimulations } from '@/hooks/useRateSimulation';
import { getReserveSimulationId, type ScenarioInputMode } from '@/lib/rateSimulationCalculator';
import { parseNumberInput } from '@/lib/numberFormat';
import type { ReservePositions } from '@/lib/netLendingCrossReserve';
import { useSideDataMeta } from '@/hooks/useSideDataMeta';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import { getAvailableToBorrowUsd, nativeToUsd, getSuppliableUsd, getBorrowableUsd, getScenarioSupplySizeUsd } from '@/lib/scenarioSize';
import { getProtocolVersion } from '@/lib/protocolVersion';
import ReservesTableDesktopSkeleton from './ReservesTableDesktopSkeleton';

import PortfolioModeToggle, { type SimulationMode } from './PortfolioModeToggle';
import type { PortfolioPosition } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';
import type { WalletLoadState } from '@/hooks/useUserPositions';
import PortfolioPanel from './PortfolioPanel';
import PortfolioPanelSkeleton from './PortfolioPanelSkeleton';

interface ReservesTableProps {
  reserves: ReserveWithSpread[];
  sortField: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null;
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null) => void;
  isApy: boolean;
  isLoading?: boolean;
  onSelectMarket?: (marketName: string) => void;
  onSelectHub?: (hubId: string) => void;
  tydroPointToUsdRate: number;
  whitelistMerklCampaignIds: ReadonlySet<string>;
  onToggleWhitelistMerklCampaign: (campaignId: string, enabled: boolean) => void;
  tokenPrices?: TokenPricesIndex;
  scrollToReserveId?: string | null;
  /** Portfolio simulation mode. */
  simulationMode?: SimulationMode;
  onSimulationModeChange?: (mode: SimulationMode) => void;
  portfolioPositions?: PortfolioPosition[];
  portfolioActions?: PortfolioSimulationActions;
  portfolioSnapshots?: import('@/types/portfolio').PortfolioSnapshot[];
  onWalletSync?: () => void;
  walletLoadState?: WalletLoadState;
  claimableRewards?: import('@/hooks/useUserClaimableRewardsSdk').ClaimableRewardData[];
  claimableRewardsLoading?: boolean;
  onRefresh?: () => Promise<void>;
  dataUpdatedAt?: number;
  topOppsRef?: React.RefObject<HTMLDivElement | null>;
  campaignAccessStatuses?: Record<string, CampaignAccessStatus>;
}

// Stable sentinel used as a gate dependency for `sortedData` when the active
// sort column does not read simulation values. Sharing one frozen reference
// across renders lets `useMemo` skip recomputing on simulation churn.
const EMPTY_SIMULATIONS_GATE: Readonly<Record<string, unknown>> = Object.freeze({});

const ReservesTable = ({
  reserves,
  sortField,
  sortOrder,
  onSort,
  isApy,
  isLoading,
  onSelectMarket,
  onSelectHub,
  tydroPointToUsdRate,
  whitelistMerklCampaignIds,
  onToggleWhitelistMerklCampaign,
  tokenPrices,
  scrollToReserveId,
  simulationMode = 'single',
  onSimulationModeChange,
  portfolioPositions,
  portfolioActions,
  portfolioSnapshots,
  onWalletSync,
  walletLoadState,
  claimableRewards,
  claimableRewardsLoading,
  onRefresh,
  dataUpdatedAt,
  topOppsRef,
  campaignAccessStatuses,
}: ReservesTableProps) => {
  const isMobile = useIsMobile();

  // Extract forecastStates from side-data (React Query cache — no extra fetch).
  const sideDataMetaQuery = useSideDataMeta(QUERY_STALE_TIMES.sideDataMeta);
  const forecastStates = useMemo<Record<string, MerklForecastWireItem>>(() => {
    const forecast = sideDataMetaQuery.data?.forecast;
    if (!forecast) return {};
    const states: Record<string, MerklForecastWireItem> = {};
    forecast.items.forEach((item) => { states[item.campaignId] = item; });
    return states;
  }, [sideDataMetaQuery.data?.forecast]);

  const scenarioControlsRef = useRef<ScenarioControlsHandle>(null);
  const {
    expandedReserveId,
    setExpandedReserveId,
    collapseExpanded: collapseExpandedOnSort,
    handleToggleExpand,
    suppressNextToggleReserveIdRef,
  } = useReserveExpansion({ isMobile });
  const [debouncedSharedSupplyInput, setDebouncedSharedSupplyInput] = useState('');
  const [debouncedSharedBorrowInput, setDebouncedSharedBorrowInput] = useState('');
  const [sharedInputMode, setSharedInputMode] = useState<ScenarioInputMode>('usd');
  const [meritMerklNetPosition, setMeritMerklNetPosition] = useState(true);
  const [mobileNetOpen, setMobileNetOpen] = useState(false);
  const handleMobileNetToggle = useCallback(() => setMobileNetOpen(prev => !prev), []);
  const handleScenarioChange = useCallback((supply: string, borrow: string, mode: ScenarioInputMode) => {
    setDebouncedSharedSupplyInput(supply);
    setDebouncedSharedBorrowInput(borrow);
    setSharedInputMode(mode);
  }, []);

  const handleCorrectSupplyInput = useCallback((correctedValue: string) => {
    scenarioControlsRef.current?.setSupplyInput(correctedValue);
  }, []);

  const handleCorrectBorrowInput = useCallback((correctedValue: string) => {
    scenarioControlsRef.current?.setBorrowInput(correctedValue);
  }, []);

  const sortState = useReservesTableSort({ collapseExpanded: collapseExpandedOnSort });
  const {
    activeSortColumn,
    setActiveSortColumn,
    tokenSortOrder,
    setTokenSortOrder,
    marketSortOrder,
    setMarketSortOrder,
    priceSortOrder,
    setPriceSortOrder,
    sizeSortMode,
    setSizeSortMode,
    sizeSortOrder,
    setSizeSortOrder,
    utilSortOrder,
    setUtilSortOrder,
    utilSortMode,
    setUtilSortMode,
    supplySortMode,
    setSupplySortMode,
    supplySortOrder,
    setSupplySortOrder,
    borrowSortMode,
    setBorrowSortMode,
    borrowSortOrder,
    setBorrowSortOrder,
    spreadSortOrder,
    setSpreadSortOrder,
    showUtilSortMenu,
    setShowUtilSortMenu,
    utilSortButtonRef,
    utilMenuPos,
    showSupplySortMenu,
    setShowSupplySortMenu,
    supplySortButtonRef,
    supplyMenuPos,
    showBorrowSortMenu,
    setShowBorrowSortMenu,
    borrowSortButtonRef,
    borrowMenuPos,
    showSizeSortMenu,
    showExtraSortMenu,
    setShowExtraSortMenu,
    handleSortToken,
    handleSortMarket,
    handleSortPrice,
    handleSortSize,
    handleSortUtil,
    closeAllMobileSortMenus,
    toggleMobileSortMenu,
  } = sortState;

  const sortActions = buildSortActions({
    activeSortColumn,
    sizeSortMode,
    sizeSortOrder,
    utilSortMode,
    utilSortOrder,
    setSizeSortMode,
    setSizeSortOrder,
    setUtilSortMode,
    setUtilSortOrder,
    setActiveSortColumn,
    collapseExpandedOnSort,
  });

  const {
    tooltipState,
    handleIncentiveClick,
    closeTooltip,
  } = useReservesTooltip();

  const reservePositions = useMemo((): Map<string, ReservePositions> | undefined => {
    const rawSupply = parseNumberInput(debouncedSharedSupplyInput);
    const rawBorrow = parseNumberInput(debouncedSharedBorrowInput);
    if (rawSupply === 0 && rawBorrow === 0) return undefined;
    const map = new Map<string, ReservePositions>();
    for (const r of reserves) {
      const tp = r.tokenPrice ?? 0;
      const supplyUsd = sharedInputMode === 'usd' ? rawSupply : rawSupply * tp;
      const borrowUsd = sharedInputMode === 'usd' ? rawBorrow : rawBorrow * tp;
      if (supplyUsd > 0 || borrowUsd > 0) {
        map.set(r.reserveId, { supplyUsd, borrowUsd });
      }
    }
    return map.size > 0 ? map : undefined;
  }, [reserves, debouncedSharedSupplyInput, debouncedSharedBorrowInput, sharedInputMode]);

  const reserveSymbolById = useMemo((): Map<string, string> | undefined => {
    if (!reservePositions) return undefined;
    const map = new Map<string, string>();
    for (const r of reserves) {
      if (r.tokenSymbol) map.set(r.reserveId, r.tokenSymbol);
    }
    return map.size > 0 ? map : undefined;
  }, [reserves, reservePositions]);

  const { simulationsById, hasAnyInput: hasScenarioInput } = useSharedRateSimulations({
    reserves,
    isApy,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
    tokenPrices,
    supplyInput: debouncedSharedSupplyInput,
    borrowInput: debouncedSharedBorrowInput,
    inputMode: sharedInputMode,
    meritMerklNetPosition,
    reservePositions,
    reserveSymbolById,
  });

  /** Scroll-on-expand only when list order can change with shared scenario (matches `pickScenarioValue` / size supply USD). */
  const expandScrollFollowsScenarioSort = useMemo(() => {
    if (!hasScenarioInput) return false;
    const col = activeSortColumn ?? 'supply';
    if (col === 'token' || col === 'market' || col === 'price') return false;
    if (col === 'size' && sizeSortMode !== 'supply') return false;
    return true;
  }, [hasScenarioInput, activeSortColumn, sizeSortMode]);

  // Helper: Get incentive values for a reserve (supply or borrow).
  // `forecastStates` is included here so the fallback path (used when
  // `simulationsById` is the stable empty object — i.e. no scenario input)
  // matches the previous behavior of `buildIncentiveCurrent`, which always
  // factored Merkl forecast adjustments into "current" incentive values.
  const getIncentiveValues = (reserve: ReserveWithSpread, type: 'supply' | 'borrow') =>
    getReserveIncentiveValues(reserve, type, tydroPointToUsdRate, { whitelistMerklCampaignIds, forecastStates });

  // Calculate totals for a reserve (frontend calculates incentive totals from details)
  const getTotalSupplyApy = (reserve: ReserveWithSpread): number | null => {
    return calculateTotalSupplyApy(reserve.supplyApy, getIncentiveValues(reserve, 'supply').apy);
  };

  const getTotalSupplyApr = (reserve: ReserveWithSpread): number | null => {
    return calculateTotalSupplyApr(reserve.supplyApy ?? null, getIncentiveValues(reserve, 'supply').apr);
  };

  const getTotalBorrowApy = (reserve: ReserveWithSpread): number | null => {
    return calculateTotalBorrowApy(reserve.borrowApy, getIncentiveValues(reserve, 'borrow').apy);
  };

  const getTotalBorrowApr = (reserve: ReserveWithSpread): number | null => {
    return calculateTotalBorrowApr(reserve.borrowApy ?? null, getIncentiveValues(reserve, 'borrow').apr);
  };

  // Calculate native values (already in percentage form, number type)
  const getNativeSupplyApy = (reserve: ReserveWithSpread): number | null => {
    return reserve.supplyApy ?? null;
  };

  const getNativeBorrowApy = (reserve: ReserveWithSpread): number | null => {
    return reserve.borrowApy ?? null;
  };

  // Calculate spread for a reserve
  const getSpread = (reserve: ReserveWithSpread): number | null => {
    const totalSupplyApy = isApy ? getTotalSupplyApy(reserve) : getTotalSupplyApr(reserve);
    const totalBorrowApy = isApy ? getTotalBorrowApy(reserve) : getTotalBorrowApr(reserve);
    if (totalSupplyApy === null || totalBorrowApy === null) return null;
    return totalSupplyApy - totalBorrowApy;
  };

  const getSimulation = (reserve: ReserveWithSpread) => simulationsById[getReserveSimulationId(reserve)];

  const pickScenarioValue = (current: number | null, after: number | null): number | null =>
    after ?? current;

  const getDisplaySupplyTotal = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) return isApy ? getTotalSupplyApy(reserve) : getTotalSupplyApr(reserve);
    return pickScenarioValue(simulation.supply.currentTotal, simulation.supply.afterTotal);
  };

  const getDisplayBorrowTotal = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) return isApy ? getTotalBorrowApy(reserve) : getTotalBorrowApr(reserve);
    return pickScenarioValue(simulation.borrow.currentTotal, simulation.borrow.afterTotal);
  };

  const getDisplaySupplyNative = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) {
      return getNativeSupplyApy(reserve);
    }
    return pickScenarioValue(simulation.supply.currentNative, simulation.supply.afterNative);
  };

  const getDisplayBorrowNative = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) {
      return getNativeBorrowApy(reserve);
    }
    return pickScenarioValue(simulation.borrow.currentNative, simulation.borrow.afterNative);
  };

  const getDisplaySupplyIncentive = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) {
      return isApy ? getIncentiveValues(reserve, 'supply').apy : getIncentiveValues(reserve, 'supply').apr;
    }
    return pickScenarioValue(simulation.supply.currentIncentive, simulation.supply.afterIncentive);
  };

  const hasSupplyIncentiveSource = (reserve: ReserveWithSpread): boolean => {
    const simulation = getSimulation(reserve);
    if (simulation) return simulation.supply.currentIncentive > 0;
    return getIncentiveValues(reserve, 'supply').apy > 0;
  };

  const getDisplayBorrowIncentive = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) {
      return isApy ? getIncentiveValues(reserve, 'borrow').apy : getIncentiveValues(reserve, 'borrow').apr;
    }
    return pickScenarioValue(simulation.borrow.currentIncentive, simulation.borrow.afterIncentive);
  };

  const hasBorrowIncentiveSource = (reserve: ReserveWithSpread): boolean => {
    const simulation = getSimulation(reserve);
    if (simulation) return simulation.borrow.currentIncentive > 0;
    return getIncentiveValues(reserve, 'borrow').apy > 0;
  };

  const getDisplaySpread = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) return getSpread(reserve);
    return pickScenarioValue(simulation.spread.current, simulation.spread.after);
  };

  const getDisplayUtilization = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) return reserve.utilizationPct ?? null;
    const baseUtilization = reserve.utilizationPct ?? simulation.utilization.current ?? null;
    return pickScenarioValue(baseUtilization, simulation.utilization.after);
  };

  const getDisplayReserveSizeUsd = (reserve: ReserveWithSpread): number | null => {
    const usd = nativeToUsd(reserve.supplied, reserve.decimals, reserve.tokenPrice);
    if (usd == null || !Number.isFinite(usd)) return usd ?? null;
    return getScenarioSupplySizeUsd({
      reserveSizeUsd: usd,
      supplyCapUsd: nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice),
      rawSupplyInput: debouncedSharedSupplyInput,
      inputMode: sharedInputMode,
      tokenPrice: getSimulation(reserve)?.tokenPrice ?? reserve.tokenPrice,
    });
  };

  const getTotalBorrowedUsd = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    return simulation?.marketMetrics.totalBorrowedUsd ?? null;
  };

  const getDisplayLiquidityUsd = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    return simulation?.marketMetrics.availableLiquidityUsd ?? null;
  };

  const getDisplaySupplyAvailabilityUsd = (reserve: ReserveWithSpread): number | null => {
    return getSuppliableUsd(reserve);
  };

  const getDisplayAvailableToBorrowUsd = (reserve: ReserveWithSpread): number | null => {
    return getBorrowableUsd(reserve);
  };

  const getDisplayDeficit = (reserve: ReserveWithSpread): number | null => {
    const tokenPrice = getSimulation(reserve)?.tokenPrice ?? reserve.tokenPrice;
    return getReserveDeficitUsdAmount(reserve, tokenPrice);
  };

  const getDisplayDeficitRatio = (reserve: ReserveWithSpread): number | null => {
    return calculateDeficitShareRatio({
      deficitUsd: getDisplayDeficit(reserve),
      totalSuppliedUsd: getDisplayReserveSizeUsd(reserve),
    });
  };

  // Token/market/price sort bodies never read `simulation` — they only compare
  // raw reserve fields. Gating the simulation dep behind the active sort column
  // prevents background simulation churn (e.g. price-query refreshes during an
  // open scenario) from triggering a needless full re-sort + table re-render
  // when the user is sorting alphabetically or by raw price.
  const sortNeedsSimulation = useMemo(() => {
    const col = activeSortColumn ?? 'supply';
    return col !== 'token' && col !== 'market' && col !== 'price';
  }, [activeSortColumn]);
  const sortedDataSimGate = sortNeedsSimulation ? simulationsById : EMPTY_SIMULATIONS_GATE;

  const sortConfig: ReserveSortConfig = useMemo(() => ({
    activeSortColumn,
    tokenSortOrder,
    marketSortOrder,
    priceSortOrder,
    sizeSortMode,
    sizeSortOrder,
    utilSortMode,
    utilSortOrder,
    supplySortMode,
    supplySortOrder,
    borrowSortMode,
    borrowSortOrder,
    spreadSortOrder,
  }), [activeSortColumn, tokenSortOrder, marketSortOrder, priceSortOrder, sizeSortMode, sizeSortOrder, utilSortMode, utilSortOrder, supplySortMode, supplySortOrder, borrowSortMode, borrowSortOrder, spreadSortOrder]);

  const valueGetters: ReserveSortValueGetters<ReserveWithSpread> = useMemo(() => ({
    getReserveId: (r) => r.reserveId,
    getTokenSymbol: (r) => r.tokenSymbol,
    getMarketName: (r) => r.marketName,
    getTokenPrice: (r) => r.tokenPrice,
    getReserveSizeUsd: getDisplayReserveSizeUsd,
    getTotalBorrowedUsd,
    getAvailableToBorrowUsd: getDisplayAvailableToBorrowUsd,
    getSupplyAvailabilityUsd: getDisplaySupplyAvailabilityUsd,
    getDeficitRatio: getDisplayDeficitRatio,
    getDeficitAmount: getDisplayDeficit,
    getSupplyCapUsd: (r) => {
      const price = getSimulation(r)?.tokenPrice ?? r.tokenPrice;
      return nativeToUsd(r.supplyCap, r.decimals, price);
    },
    getBorrowCapUsd: (r) => {
      const price = getSimulation(r)?.tokenPrice ?? r.tokenPrice;
      return nativeToUsd(r.borrowCap, r.decimals, price);
    },
    getAvailableLiquidityUsd: getDisplayLiquidityUsd,
    getUtilization: getDisplayUtilization,
    getOptimalUtilization: (r) => r.optimalUtilization,
    getDisplaySupplyTotal,
    getDisplaySupplyNative,
    getDisplaySupplyIncentive,
    hasSupplyIncentiveSource,
    getDisplayBorrowTotal,
    getDisplayBorrowNative,
    getDisplayBorrowIncentive,
    hasBorrowIncentiveSource,
    getDisplaySpread,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sortedDataSimGate, hasScenarioInput, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds, debouncedSharedSupplyInput, sharedInputMode]);

  const sortedData = useMemo(() => {
    return sortReserves(reserves, sortConfig, valueGetters);
  }, [reserves, sortConfig, valueGetters]);

  const {
    displayData,
    showAll,
    minVisibleCount,
    showAllRows,
    resetVisibleCount,
  } = useReservesPagination({ sortedData, scrollToReserveId, expandedReserveId });

  const { schedulePinScrollToReserve, handleMarketChipClick } = useScenarioPinScroll({
    reserves,
    sortedData,
    isMobile,
    expandedReserveId,
    setExpandedReserveId,
    minVisibleCount,
    defaultVisibleCount: DEFAULT_VISIBLE_COUNT,
    hasScenarioInput,
    expandScrollFollowsScenarioSort,
    scenarioKey: {
      supplyInput: debouncedSharedSupplyInput,
      borrowInput: debouncedSharedBorrowInput,
      inputMode: sharedInputMode,
      meritMerklNetPosition,
    },
  });

  // Keep expansion even when reserves change (e.g., market filter applied)
  // Previously this auto-collapsed when the expanded row was not in the filtered list
  // Now we preserve the expansion state so it re-appears when switching back markets

  const supplySortLabel = {
    total: 'Total',
    native: 'Native',
    incentive: 'Incentive',
  }[supplySortMode];

  const borrowSortLabel = {
    total: 'Total',
    native: 'Native',
    incentive: 'Incentive',
  }[borrowSortMode];

  const sizeSortAccentClass =
    sizeSortMode === 'supply'
      ? 'ds-text-emerald-700'
      : sizeSortMode === 'borrow' || sizeSortMode === 'borrowAvailability' || sizeSortMode === 'supplyAvailability'
        ? 'ds-text-brand-cyan'
        : 'text-foreground';
  const utilSortAccentClass =
    utilSortMode === 'liquidity'
      ? 'ds-text-purple-700'
      : 'text-foreground';
  const sizeSortActiveHeadingClass =
    sizeSortMode === 'supply'
      ? 'ds-text-emerald-600 font-bold scale-105'
      : sizeSortMode === 'borrow' || sizeSortMode === 'borrowAvailability' || sizeSortMode === 'supplyAvailability'
        ? 'ds-text-brand-cyan font-bold scale-105'
        : 'text-foreground font-bold scale-105';
  const mobileCardDefaultTab: 'supply' | 'borrow' =
    activeSortColumn === 'borrow' || activeSortColumn === 'spread' || (activeSortColumn === 'size' && (sizeSortMode === 'borrow' || sizeSortMode === 'borrowAvailability'))
      ? 'borrow'
      : 'supply';

  const mobileExtraSortChipLabel = 'Extra';

  const mobileExtraSortActive =
    activeSortColumn === 'spread' ||
    activeSortColumn === 'token' ||
    activeSortColumn === 'market' ||
    activeSortColumn === 'price';

  const sizeSortOptions: MobileSortOption[] = [
    {
      key: 'supply',
      label: 'Supplied',
      isSelected: sizeSortMode === 'supply' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-emerald-600',
      onSelect: () => {
        selectSortOption({
          isAlreadySelected: sizeSortMode === 'supply' && activeSortColumn === 'size',
          setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setSizeSortMode, targetMode: 'supply',
          setActiveSortColumn, targetColumn: 'size',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'supplyAvailability',
      label: 'Suppliable',
      isSelected: sizeSortMode === 'supplyAvailability' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-emerald-600',
      onSelect: () => {
        selectSortOption({
          isAlreadySelected: sizeSortMode === 'supplyAvailability' && activeSortColumn === 'size',
          setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setSizeSortMode, targetMode: 'supplyAvailability',
          setActiveSortColumn, targetColumn: 'size',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'borrow',
      label: 'Borrowed',
      isSelected: sizeSortMode === 'borrow' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-brand-cyan',
      onSelect: () => {
        selectSortOption({
          isAlreadySelected: sizeSortMode === 'borrow' && activeSortColumn === 'size',
          setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setSizeSortMode, targetMode: 'borrow',
          setActiveSortColumn, targetColumn: 'size',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'borrowAvailability',
      label: 'Borrowable',
      isSelected: sizeSortMode === 'borrowAvailability' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'ds-text-brand-cyan',
      onSelect: () => {
        selectSortOption({
          isAlreadySelected: sizeSortMode === 'borrowAvailability' && activeSortColumn === 'size',
          setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setSizeSortMode, targetMode: 'borrowAvailability',
          setActiveSortColumn, targetColumn: 'size',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'deficitAmount',
      label: 'Deficit',
      isSelected: sizeSortMode === 'deficitAmount' && activeSortColumn === 'size',
      order: sizeSortOrder,
      activeClassName: 'text-foreground',
      onSelect: () => {
        selectSortOption({
          isAlreadySelected: sizeSortMode === 'deficitAmount' && activeSortColumn === 'size',
          setSortOrder: setSizeSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setSizeSortMode, targetMode: 'deficitAmount',
          setActiveSortColumn, targetColumn: 'size',
        });
        closeAllMobileSortMenus();
      },
    },
  ];

  const supplySortOptions: MobileSortOption[] = (['total', 'native', 'incentive'] as SortMode[]).map((mode) => ({
    key: mode,
    label: mode.charAt(0).toUpperCase() + mode.slice(1),
    isSelected: supplySortMode === mode && activeSortColumn === 'supply',
    order: supplySortOrder,
    activeClassName: 'ds-text-emerald-600',
    onSelect: () => {
      selectSortOption({
        isAlreadySelected: supplySortMode === mode && activeSortColumn === 'supply',
        setSortOrder: setSupplySortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
        setSortMode: setSupplySortMode, targetMode: mode,
        setActiveSortColumn, targetColumn: 'supply',
      });
      closeAllMobileSortMenus();
    },
  }));

  const borrowSortOptions: MobileSortOption[] = (['total', 'native', 'incentive'] as SortMode[]).map((mode) => ({
    key: mode,
    label: mode.charAt(0).toUpperCase() + mode.slice(1),
    isSelected: borrowSortMode === mode && activeSortColumn === 'borrow',
    order: borrowSortOrder,
    activeClassName: 'ds-text-brand-cyan',
    onSelect: () => {
      selectSortOption({
        isAlreadySelected: borrowSortMode === mode && activeSortColumn === 'borrow',
        setSortOrder: setBorrowSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
        setSortMode: setBorrowSortMode, targetMode: mode,
        setActiveSortColumn, targetColumn: 'borrow',
      });
      closeAllMobileSortMenus();
    },
  }));

  const utilSortOptions: MobileSortOption[] = [
    {
      key: 'util',
      label: 'Utilization',
      isSelected: activeSortColumn === 'util' && utilSortMode === 'util',
      order: utilSortOrder,
      activeClassName: 'text-foreground',
      onSelect: () => {
        collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: utilSortMode === 'util' && activeSortColumn === 'util',
          setSortOrder: setUtilSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setUtilSortMode, targetMode: 'util',
          setActiveSortColumn, targetColumn: 'util',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'liquidity',
      label: 'Liquidity',
      isSelected: activeSortColumn === 'util' && utilSortMode === 'liquidity',
      order: utilSortOrder,
      activeClassName: 'ds-text-purple-600',
      onSelect: () => {
        collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: utilSortMode === 'liquidity' && activeSortColumn === 'util',
          setSortOrder: setUtilSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setSortMode: setUtilSortMode, targetMode: 'liquidity',
          setActiveSortColumn, targetColumn: 'util',
        });
        closeAllMobileSortMenus();
      },
    },
  ];

  const extraSortOptions: MobileSortOption[] = [
    {
      key: 'spread',
      label: 'Spread',
      isSelected: activeSortColumn === 'spread',
      order: spreadSortOrder,
      activeClassName: 'ds-text-purple-600',
      onSelect: () => {
        collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: activeSortColumn === 'spread',
          setSortOrder: setSpreadSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setActiveSortColumn, targetColumn: 'spread',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'token',
      label: 'Token',
      isSelected: activeSortColumn === 'token',
      order: tokenSortOrder,
      activeClassName: 'text-foreground',
      onSelect: () => {
        collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: activeSortColumn === 'token',
          setSortOrder: setTokenSortOrder, toggleOrderFn: toggleSortOrderAscFirst, defaultOrder: 'asc',
          setActiveSortColumn, targetColumn: 'token',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'market',
      label: 'Market',
      isSelected: activeSortColumn === 'market',
      order: marketSortOrder,
      activeClassName: 'text-foreground',
      onSelect: () => {
        collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: activeSortColumn === 'market',
          setSortOrder: setMarketSortOrder, toggleOrderFn: toggleSortOrderAscFirst, defaultOrder: 'asc',
          setActiveSortColumn, targetColumn: 'market',
        });
        closeAllMobileSortMenus();
      },
    },
    {
      key: 'price',
      label: 'Price',
      isSelected: activeSortColumn === 'price',
      order: priceSortOrder,
      activeClassName: 'text-foreground',
      onSelect: () => {
        collapseExpandedOnSort();
        selectSortOption({
          isAlreadySelected: activeSortColumn === 'price',
          setSortOrder: setPriceSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
          setActiveSortColumn, targetColumn: 'price',
        });
        closeAllMobileSortMenus();
      },
    },
  ];

  

  const handleRowClick = (reserve: ReserveWithSpread) => {
    const url = buildAaveUrl({
      marketName: reserve.marketName,
      tokenAddress: reserve.tokenAddress,
      aaveProReserveId: reserve.aaveProReserveId,
    });
    if (url) {
      openExternalUrl(url, isMobile);
    }
  };

  const isPortfolioMode = simulationMode === 'portfolio';

  const portfolioSimulationContext = useMemo<PortfolioSimulationContext>(() => ({
    isApy,
    whitelistMerklCampaignIds,
    tydroPointToUsdRate,
    forecastStates,
  }), [isApy, whitelistMerklCampaignIds, tydroPointToUsdRate, forecastStates]);

  const {
    portfolioReserveIds,
    handlePortfolioToggle,
    portfolioResults,
    portfolioSummary,
  } = usePortfolioToggle({
    isPortfolioMode,
    reserves,
    portfolioPositions,
    portfolioActions,
    simulationContext: portfolioSimulationContext,
  });

  const scenarioControls = (
    <div className={cn("space-y-2", isMobile && "rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-1.5 py-1.5")}>
      {isMobile ? (
        <div className="flex items-stretch gap-2">
          {!isPortfolioMode && (
            <div className="flex-1 min-w-0">
              <ScenarioControls
                ref={scenarioControlsRef}
                onDebouncedChange={handleScenarioChange}
                meritMerklNetPosition={meritMerklNetPosition}
                onMeritMerklNetPositionChange={setMeritMerklNetPosition}
                mobileNetOpen={mobileNetOpen}
                onMobileNetToggle={handleMobileNetToggle}
              />
            </div>
          )}
          {onSimulationModeChange && (
            <div className="ml-auto shrink-0 flex flex-col items-center">
              {/* Upper section: Batch toggle — vertically centered in the input row */}
              <div className="flex flex-1 items-center justify-center">
                <PortfolioModeToggle
                  mode={simulationMode}
                  onModeChange={onSimulationModeChange}
                  positionCount={portfolioPositions ? new Set(portfolioPositions.map(p => p.reserveId)).size : 0}
                />
              </div>
              {/* Lower section: expand icon — vertically centered in the Net checkbox area */}
              {!isPortfolioMode && (
                <div className="flex flex-1 items-center justify-center">
                  <button
                    type="button"
                    onClick={handleMobileNetToggle}
                    className={cn(
                      'shrink-0 inline-flex h-7 w-7 items-center justify-center text-muted-foreground/65 transition-colors',
                      mobileNetOpen ? 'text-foreground' : 'active:text-foreground/85',
                    )}
                    aria-label={mobileNetOpen ? 'Collapse advanced controls' : 'Expand advanced controls'}
                    aria-expanded={mobileNetOpen}
                  >
                    <SlidersHorizontal
                      className={cn('size-3.5 transition-transform duration-300', mobileNetOpen && 'rotate-180')}
                      aria-hidden
                    />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {!isPortfolioMode && (
            <div className="flex-1 min-w-0">
              <ScenarioControls
                ref={scenarioControlsRef}
                onDebouncedChange={handleScenarioChange}
                meritMerklNetPosition={meritMerklNetPosition}
                onMeritMerklNetPositionChange={setMeritMerklNetPosition}
              />
            </div>
          )}
          {onSimulationModeChange && (
            <div className="ml-auto shrink-0">
              <PortfolioModeToggle
                mode={simulationMode}
                onModeChange={onSimulationModeChange}
                positionCount={portfolioPositions ? new Set(portfolioPositions.map(p => p.reserveId)).size : 0}
              />
            </div>
          )}
        </div>
      )}
      {isPortfolioMode && (
        isLoading && reserves.length === 0 ? (
          <PortfolioPanelSkeleton />
        ) : portfolioPositions && portfolioActions ? (
          <PortfolioPanel
            positions={portfolioPositions}
            actions={portfolioActions}
            reserves={reserves}
            positionResults={portfolioResults}
            summary={portfolioSummary}
            snapshots={portfolioSnapshots}
            onWalletSync={onWalletSync}
            walletLoadState={walletLoadState}
            claimableRewards={claimableRewards}
            claimableRewardsLoading={claimableRewardsLoading}
          />
        ) : null
      )}
    </div>
  );

  const {
    mobileTableRef,
    desktopTableCardRef,
    desktopTableBottomAnchorRef,
    desktopStickyScenarioRef,
    desktopStickyTheadRef,
    tableInView,
  } = useReservesLayoutRefs({ isMobile });

  // Mobile card view — compact bottom padding (safe area + small breathing room)
  if (isMobile) {
    return (
      <div ref={mobileTableRef} className="space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <div
          data-reserves-sticky-scenario
          className={cn(
            '-mx-[var(--ds-space-3)] px-[var(--ds-space-3)] pt-1 pb-0',
            // In portfolio (batch) mode, the panel can grow taller than the viewport
            // (search + suggested chips + many position rows + summary). If we keep
            // it sticky, the content overflows the sticky box and becomes unscrollable
            // — only the cards below it scroll. Disable sticky in batch mode so the
            // entire panel scrolls naturally with the page.
            !isPortfolioMode && 'sticky top-[env(safe-area-inset-top,0px)] z-20',
          )}
        >
          {scenarioControls}
        </div>
        <ReservesTableMobileSortBar
          activeSortColumn={activeSortColumn}
          sizeSortAccentClass={sizeSortAccentClass}
          utilSortAccentClass={utilSortAccentClass}
          mobileExtraSortActive={mobileExtraSortActive}
          mobileExtraSortChipLabel={mobileExtraSortChipLabel}
          showSizeSortMenu={showSizeSortMenu}
          showUtilSortMenu={showUtilSortMenu}
          showSupplySortMenu={showSupplySortMenu}
          showBorrowSortMenu={showBorrowSortMenu}
          showExtraSortMenu={showExtraSortMenu}
          sizeSortOptions={sizeSortOptions}
          utilSortOptions={utilSortOptions}
          supplySortOptions={supplySortOptions}
          borrowSortOptions={borrowSortOptions}
          extraSortOptions={extraSortOptions}
          onToggleMenu={toggleMobileSortMenu}
          onCloseMenus={closeAllMobileSortMenus}
        />
        
        {/* 2x2 Grid layout for mobile */}
        <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
          <ReservesTableMobileGrid
            displayData={displayData}
            expandedReserveId={expandedReserveId}
            isLoading={isLoading}
            reservesCount={reserves.length}
            isApy={isApy}
            tydroPointToUsdRate={tydroPointToUsdRate}
            hasScenarioInput={hasScenarioInput}
            inputMode={sharedInputMode}
            supplyInput={debouncedSharedSupplyInput}
            borrowInput={debouncedSharedBorrowInput}
            mobileCardDefaultTab={mobileCardDefaultTab}
            simulationsById={simulationsById}
            onIncentiveClick={handleIncentiveClick}
            onToggleExpand={handleToggleExpand}
            onCorrectSupplyInput={handleCorrectSupplyInput}
            onCorrectBorrowInput={handleCorrectBorrowInput}
            isPortfolioMode={isPortfolioMode}
            portfolioReserveIds={portfolioReserveIds}
            onPortfolioToggle={handlePortfolioToggle}
            onSelectHub={onSelectHub}
          />
        </div>
        
        <ReservesTableShowMore
          totalCount={sortedData.length}
          displayCount={displayData.length}
          showAll={showAll}
          defaultVisibleCount={DEFAULT_VISIBLE_COUNT}
          variant="mobile"
          onShowAll={showAllRows}
          onShowLess={resetVisibleCount}
        />


        <ReservesTableTooltipOverlay tooltipState={tooltipState} onClose={closeTooltip} isApy={isApy} tydroPointToUsdRate={tydroPointToUsdRate} whitelistMerklCampaignIds={whitelistMerklCampaignIds} onToggleWhitelistMerklCampaign={onToggleWhitelistMerklCampaign} forecastStates={forecastStates} campaignAccessStatuses={campaignAccessStatuses} />

        <ReservesTableFloatingScroll
          tableInView={tableInView}
          variant="mobile"
          onScrollToTop={() => {
            const el = topOppsRef?.current;
            if (el) {
              const y = el.getBoundingClientRect().bottom + window.scrollY;
              window.scrollTo({ top: y, behavior: 'smooth' });
            } else {
              mobileTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          onScrollToBottom={() => mobileTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
          onRefresh={onRefresh}
          dataUpdatedAt={dataUpdatedAt}
        />
      </div>
    );
  }


  return (
    <div
      ref={desktopTableCardRef}
      className="relative min-w-0 w-full rounded-2xl bg-border/60 p-px shadow-sm"
    >
      {/*
        1px “gutter” border: native border on a rounded card is painted under full-bleed sticky
        children, so top corner arcs look broken. Outer p-px + inner smaller radius keeps a
        continuous ring without overflow:hidden (sticky stack stays viewport-relative).
        Aligns with DESIGN-SYSTEM-REFERENCE § 轮廓与圆角拼接 (prefer structural fix over masks).
      */}
      <div className="min-w-0 w-full overflow-visible rounded-[calc(1rem-1px)] bg-card">
      <div
        ref={desktopStickyScenarioRef}
        data-reserves-sticky-scenario
        className="sticky top-0 z-20 rounded-t-[calc(1rem-1px)] border-b border-border/60 bg-card p-[var(--ds-space-3)]"
      >
        {scenarioControls}
      </div>
      {/*
        Do not wrap the table in overflow-x-auto: that creates a scrollport so thead’s
        sticky `top` is relative to that box, not the viewport — scenario uses viewport top-0,
        producing a huge gap and tbody bleeding above the header. Horizontal overflow falls
        through to the page when the table is wider than the container.
      */}
      <Table className="w-full table-fixed min-w-0" wrapperClassName="overflow-visible">
          <colgroup>
            {/* 列顺序：Token → Market → Price → ...（DeFi/lending 协议表惯例：
             * Asset → Network/Market 紧贴，参考 Aave UI / Compound / Spark / Morpho）。
             * 优化列宽分布：确保 Utilization 刚好撑开，平衡其他列 */}
            {/* Token — +1% from Price，给 ↗ + symbol 多一点呼吸 */}
            <col style={{ width: '14%' }} />
            {/* Market — +1% from Price，让 chip 离 Price 数字不至于太空 */}
            <col style={{ width: '14.5%' }} />
            {/* Price — Price 内容固定为 $X.XX 短数字，10% 留给数字左侧的余量过大 */}
            <col style={{ width: '8%' }} />
            {/* Size */}
            <col style={{ width: '12%' }} />
            {/* Utilization */}
            <col style={{ width: '13%' }} />
            {/* Supply */}
            <col style={{ width: '12.5%' }} />
            {/* Spread */}
            <col style={{ width: '12%' }} />
            {/* Borrow */}
            <col style={{ width: '14%' }} />
          </colgroup>
          <ReservesTableDesktopHeader
            tableHeaderRef={desktopStickyTheadRef}
            tableHeaderClassName="overflow-visible [&_tr]:border-b-0 [&_th]:sticky [&_th]:z-30 [&_th]:border-b [&_th]:border-border/60 [&_th]:bg-card [&_th]:shadow-[0_1px_2px_0_rgb(0_0_0/0.04)] [&_th]:[top:var(--reserves-sticky-scenario-height,4.5rem)]"
            activeSortColumn={activeSortColumn}
            tokenSortOrder={tokenSortOrder}
            marketSortOrder={marketSortOrder}
            priceSortOrder={priceSortOrder}
            sizeSortMode={sizeSortMode}
            sizeSortOrder={sizeSortOrder}
            sizeSortActiveHeadingClass={sizeSortActiveHeadingClass}
            utilSortOrder={utilSortOrder}
            supplySortLabel={supplySortLabel}
            supplySortMode={supplySortMode}
            supplySortOrder={supplySortOrder}
            showSupplySortMenu={showSupplySortMenu}
            supplyMenuPos={supplyMenuPos}
            borrowSortLabel={borrowSortLabel}
            borrowSortMode={borrowSortMode}
            borrowSortOrder={borrowSortOrder}
            showBorrowSortMenu={showBorrowSortMenu}
            borrowMenuPos={borrowMenuPos}
            spreadSortOrder={spreadSortOrder}
            supplySortButtonRef={supplySortButtonRef}
            borrowSortButtonRef={borrowSortButtonRef}
            onSortToken={handleSortToken}
            onSortMarket={handleSortMarket}
            onSortPrice={handleSortPrice}
            onSortSizeDefault={handleSortSize}
            utilSortMode={utilSortMode}
            onSortUtil={handleSortUtil}
            onToggleSpreadSort={() => {
              if (activeSortColumn === 'spread') {
                setSpreadSortOrder(toggleSortOrder);
              } else {
                collapseExpandedOnSort();
                selectSortOption({
                  isAlreadySelected: false,
                  setSortOrder: setSpreadSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc',
                  setActiveSortColumn, targetColumn: 'spread',
                });
              }
            }}
            onToggleSupplyMenu={() => setShowSupplySortMenu(!showSupplySortMenu)}
            onCloseSupplyMenu={() => setShowSupplySortMenu(false)}
            onSelectSupplySortTotal={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: supplySortMode === 'total' && activeSortColumn === 'supply', setSortOrder: setSupplySortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSupplySortMode, targetMode: 'total', setActiveSortColumn, targetColumn: 'supply' });
              setShowSupplySortMenu(false);
            }}
            onSelectSupplySortNative={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: supplySortMode === 'native' && activeSortColumn === 'supply', setSortOrder: setSupplySortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSupplySortMode, targetMode: 'native', setActiveSortColumn, targetColumn: 'supply' });
              setShowSupplySortMenu(false);
            }}
            onSelectSupplySortIncentive={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: supplySortMode === 'incentive' && activeSortColumn === 'supply', setSortOrder: setSupplySortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setSupplySortMode, targetMode: 'incentive', setActiveSortColumn, targetColumn: 'supply' });
              setShowSupplySortMenu(false);
            }}
            onToggleBorrowMenu={() => setShowBorrowSortMenu(!showBorrowSortMenu)}
            onCloseBorrowMenu={() => setShowBorrowSortMenu(false)}
            onSelectBorrowSortTotal={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: borrowSortMode === 'total' && activeSortColumn === 'borrow', setSortOrder: setBorrowSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setBorrowSortMode, targetMode: 'total', setActiveSortColumn, targetColumn: 'borrow' });
              setShowBorrowSortMenu(false);
            }}
            onSelectBorrowSortNative={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: borrowSortMode === 'native' && activeSortColumn === 'borrow', setSortOrder: setBorrowSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setBorrowSortMode, targetMode: 'native', setActiveSortColumn, targetColumn: 'borrow' });
              setShowBorrowSortMenu(false);
            }}
            onSelectBorrowSortIncentive={() => {
              collapseExpandedOnSort();
              selectSortOption({ isAlreadySelected: borrowSortMode === 'incentive' && activeSortColumn === 'borrow', setSortOrder: setBorrowSortOrder, toggleOrderFn: toggleSortOrder, defaultOrder: 'desc', setSortMode: setBorrowSortMode, targetMode: 'incentive', setActiveSortColumn, targetColumn: 'borrow' });
              setShowBorrowSortMenu(false);
            }}
          />
          <TableBody>
            {(isLoading && reserves.length === 0) || (reserves.length > 0 && displayData.length === 0) ? (
              <ReservesTableDesktopSkeleton />
            ) : displayData.map((reserve) => {
              const reserveId = getReserveSimulationId(reserve);
              const simulation = simulationsById[reserveId];
              const displaySupplyIncentive = resolveVisibleIncentiveBadgeValue(
                getDisplaySupplyIncentive(reserve),
                reserve,
                'supply',
                isApy,
                tydroPointToUsdRate,
              );
              const displayBorrowIncentive = resolveVisibleIncentiveBadgeValue(
                getDisplayBorrowIncentive(reserve),
                reserve,
                'borrow',
                isApy,
                tydroPointToUsdRate,
              );
              return (
                <DesktopReserveRow
                  key={reserveId}
                  reserve={reserve}
                  reserveId={reserveId}
                  isExpanded={expandedReserveId === reserveId}
                  onToggleExpand={handleToggleExpand}
                  onSelectMarket={onSelectMarket}
                  onMarketChipClick={handleMarketChipClick}
                  onSelectHub={onSelectHub}
                  onIncentiveClick={handleIncentiveClick}
                  displaySupplyTotal={getDisplaySupplyTotal(reserve)}
                  displaySupplyNative={getDisplaySupplyNative(reserve)}
                  displaySupplyIncentive={displaySupplyIncentive}
                  displayBorrowTotal={getDisplayBorrowTotal(reserve)}
                  displayBorrowNative={getDisplayBorrowNative(reserve)}
                  displayBorrowIncentive={displayBorrowIncentive}
                  displayUtilization={getDisplayUtilization(reserve)}
                  spread={getDisplaySpread(reserve)}
                  simulation={simulation}
                  supplyInput={debouncedSharedSupplyInput}
                  borrowInput={debouncedSharedBorrowInput}
                  inputMode={sharedInputMode}
                  isApy={isApy}
                  isMobile={isMobile}
                  onCorrectSupplyInput={handleCorrectSupplyInput}
                  onCorrectBorrowInput={handleCorrectBorrowInput}
                  isPortfolioMode={isPortfolioMode}
                  isInPortfolio={portfolioReserveIds.has(reserveId)}
                  onPortfolioToggle={handlePortfolioToggle}
                  sortActions={sortActions}
                />
              );
            })
            }
          </TableBody>
        </Table>

      <ReservesTableShowMore
        totalCount={sortedData.length}
        displayCount={displayData.length}
        showAll={showAll}
        defaultVisibleCount={DEFAULT_VISIBLE_COUNT}
        variant="desktop"
        onShowAll={showAllRows}
        onShowLess={resetVisibleCount}
      />
      
      <div ref={desktopTableBottomAnchorRef} aria-hidden className="h-px w-full" />

      {/* Spacer: ensures enough scroll room to pin-scroll the last expanded row to the sticky band */}
      {expandedReserveId && (
        <div aria-hidden style={{ height: 'calc(100dvh - var(--reserves-expanded-main-row-top, 5.75rem))' }} />
      )}

      <ReservesTableTooltipOverlay tooltipState={tooltipState} onClose={closeTooltip} isApy={isApy} tydroPointToUsdRate={tydroPointToUsdRate} whitelistMerklCampaignIds={whitelistMerklCampaignIds} onToggleWhitelistMerklCampaign={onToggleWhitelistMerklCampaign} forecastStates={forecastStates} campaignAccessStatuses={campaignAccessStatuses} />

      <ReservesTableFloatingScroll
        tableInView={tableInView}
        variant="desktop"
        onScrollToTop={() => {
          const el = topOppsRef?.current;
          if (el) {
            const y = el.getBoundingClientRect().bottom + window.scrollY;
            window.scrollTo({ top: y, behavior: 'smooth' });
          } else {
            desktopTableCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
        onScrollToBottom={() => {
          const target = desktopTableBottomAnchorRef.current ?? desktopTableCardRef.current;
          target?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }}
        onRefresh={onRefresh}
        dataUpdatedAt={dataUpdatedAt}
      />
      </div>
    </div>
  );
};

export default ReservesTable;
