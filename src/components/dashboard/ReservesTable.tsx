import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { ArrowUp, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReserveWithSpread, ETHEREUM_MARKET_NAMES, TokenPricesIndex } from '@/types/aave';
import { 
  formatPercent, 
  formatSpread, 
  formatSupplyUsd,
  formatUsd,
  calculateTotalSupplyApr,
  calculateTotalSupplyApy,
  calculateTotalBorrowApr,
  calculateTotalBorrowApy,
  calculateTotalIncentiveApr,
  calculateTotalIncentiveApy,
  apyToApr
} from '@/lib/formatters';
import ScenarioControls from './ScenarioControls';
import { compareIncentiveWithNative } from '@/lib/sorters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import IncentiveTooltip from './IncentiveTooltip';
import MobileReserveCard from './MobileReserveCard';
import DesktopReserveRow from './DesktopReserveRow';
import { useIsMobile } from '@/hooks/use-mobile';
import { getReserveSimulationId, useSharedRateSimulations } from '@/hooks/useRateSimulation';
import { parseNumberInput } from '@/lib/numberFormat';

interface ReservesTableProps {
  reserves: ReserveWithSpread[];
  sortField: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null;
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null) => void;
  isApy: boolean;
  isLoading?: boolean;
  onSelectMarket?: (marketName: string) => void;
  tydroPointToUsdRate: number;
  includeWhitelistOnlyMerkl: boolean;
  onToggleWhitelistOnlyMerkl: (next: boolean) => void;
  tokenPrices?: TokenPricesIndex;
  scrollToReserveId?: string | null;
}

type SortMode = 'total' | 'native' | 'incentive';

type SortableColumn = 'token' | 'price' | 'supplyLiquidity' | 'util' | 'supply' | 'borrow' | 'spread';

const DEFAULT_VISIBLE_COUNT = 20;

const ReservesTable = ({
  reserves,
  sortField,
  sortOrder,
  onSort,
  isApy,
  isLoading,
  onSelectMarket,
  tydroPointToUsdRate,
  includeWhitelistOnlyMerkl,
  onToggleWhitelistOnlyMerkl,
  tokenPrices,
  scrollToReserveId,
}: ReservesTableProps) => {
  const isMobile = useIsMobile();
  const [activeSortColumn, setActiveSortColumn] = useState<SortableColumn | null>('supply');
  const [tokenSortOrder, setTokenSortOrder] = useState<'asc' | 'desc'>('asc');
  const [priceSortOrder, setPriceSortOrder] = useState<'asc' | 'desc'>('desc');
  const [supplyLiquiditySortOrder, setSupplyLiquiditySortOrder] = useState<'asc' | 'desc'>('desc');
  const [utilSortOrder, setUtilSortOrder] = useState<'asc' | 'desc'>('desc');
  const [supplySortMode, setSupplySortMode] = useState<SortMode>('incentive');
  const [supplySortOrder, setSupplySortOrder] = useState<'asc' | 'desc'>('desc');
  const [borrowSortMode, setBorrowSortMode] = useState<SortMode>('total');
  const [borrowSortOrder, setBorrowSortOrder] = useState<'asc' | 'desc'>('desc');
  const [spreadSortOrder, setSpreadSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSupplySortMenu, setShowSupplySortMenu] = useState(false);
  const [showBorrowSortMenu, setShowBorrowSortMenu] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [expandedReserveId, setExpandedReserveId] = useState<string | null>(null);
  const [debouncedSharedSupplyInput, setDebouncedSharedSupplyInput] = useState('');
  const [debouncedSharedBorrowInput, setDebouncedSharedBorrowInput] = useState('');
  const [sharedInputMode, setSharedInputMode] = useState<import('@/hooks/useRateSimulation').ScenarioInputMode>('usd');
  const handleScenarioChange = useCallback((supply: string, borrow: string, mode: import('@/components/dashboard/ScenarioControls').ScenarioInputMode) => {
    setDebouncedSharedSupplyInput(supply);
    setDebouncedSharedBorrowInput(borrow);
    setSharedInputMode(mode);
  }, []);
  const handleToggleExpand = useCallback((reserveId: string) => {
    setExpandedReserveId((prev) => (prev === reserveId ? null : reserveId));
  }, []);
  const [tooltipState, setTooltipState] = useState<{
    reserve: ReserveWithSpread;
    type: 'supply' | 'borrow';
    position: { x: number; y: number };
    triggerCenterX: number;
    triggerHeight: number;
    triggerRect: { top: number; bottom: number; left: number; right: number; width: number; height: number };
  } | null>(null);

  const { simulationsById, hasAnyInput: hasSharedScenario } = useSharedRateSimulations({
    reserves,
    isApy,
    includeWhitelistOnlyMerkl,
    tydroPointToUsdRate,
    tokenPrices,
    supplyInput: debouncedSharedSupplyInput,
    borrowInput: debouncedSharedBorrowInput,
    inputMode: sharedInputMode,
  });

  const getMarketDisplayName = (reserve: ReserveWithSpread) => {
    if (reserve.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[reserve.marketName]) {
      return ETHEREUM_MARKET_NAMES[reserve.marketName];
    }
    return reserve.chainName;
  };

  // Helper: Get incentive values for a reserve (supply or borrow)
  const getIncentiveValues = (reserve: ReserveWithSpread, type: 'supply' | 'borrow') => {
    const protocolIncentives = type === 'supply' ? reserve.supplyIncentives : reserve.borrowIncentives;
    const meritIncentives = type === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
    const merklOpportunities = type === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
    const brevisIncentives = type === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows;
    return {
      apr: calculateTotalIncentiveApr(
        meritIncentives,
        merklOpportunities,
        brevisIncentives,
        protocolIncentives,
        tydroPointToUsdRate,
        { includeWhitelistOnlyMerkl }
      ),
      apy: calculateTotalIncentiveApy(
        meritIncentives,
        merklOpportunities,
        brevisIncentives,
        protocolIncentives,
        tydroPointToUsdRate,
        { includeWhitelistOnlyMerkl }
      ),
    };
  };

  // Calculate totals for a reserve (frontend calculates incentive totals from details)
  const getTotalSupplyApy = (reserve: ReserveWithSpread): number | null => {
    return calculateTotalSupplyApy(reserve.supplyApy, getIncentiveValues(reserve, 'supply').apy);
  };

  const getTotalSupplyApr = (reserve: ReserveWithSpread): number | null => {
    return calculateTotalSupplyApr(reserve.supplyApy, getIncentiveValues(reserve, 'supply').apr);
  };

  const getTotalBorrowApy = (reserve: ReserveWithSpread): number | null => {
    return calculateTotalBorrowApy(reserve.borrowApy, getIncentiveValues(reserve, 'borrow').apy);
  };

  const getTotalBorrowApr = (reserve: ReserveWithSpread): number | null => {
    return calculateTotalBorrowApr(reserve.borrowApy, getIncentiveValues(reserve, 'borrow').apr);
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
    hasSharedScenario ? after ?? current : current;

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
      const nativeSupplyApy = getNativeSupplyApy(reserve);
      return isApy ? nativeSupplyApy : nativeSupplyApy !== null ? apyToApr(nativeSupplyApy) : null;
    }
    return pickScenarioValue(simulation.supply.currentNative, simulation.supply.afterNative);
  };

  const getDisplayBorrowNative = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) {
      const nativeBorrowApy = getNativeBorrowApy(reserve);
      return isApy ? nativeBorrowApy : nativeBorrowApy !== null ? apyToApr(nativeBorrowApy) : null;
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

  const getDisplayBorrowIncentive = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) {
      return isApy ? getIncentiveValues(reserve, 'borrow').apy : getIncentiveValues(reserve, 'borrow').apr;
    }
    return pickScenarioValue(simulation.borrow.currentIncentive, simulation.borrow.afterIncentive);
  };

  const getDisplaySpread = (reserve: ReserveWithSpread): number | null => {
    const simulation = getSimulation(reserve);
    if (!simulation) return getSpread(reserve);
    return pickScenarioValue(simulation.spread.current, simulation.spread.after);
  };

  const getDisplaySupplyUsd = (reserve: ReserveWithSpread): number | null => {
    const supply = reserve.supplyUsd;
    if (supply == null || !Number.isFinite(supply)) return supply ?? null;
    const supplyRaw = parseNumberInput(debouncedSharedSupplyInput);
    const sim = getSimulation(reserve);
    const supplyUsd =
      sharedInputMode === 'usd'
        ? supplyRaw
        : sim?.tokenPrice != null && Number.isFinite(sim.tokenPrice)
          ? supplyRaw * sim.tokenPrice
          : 0;
    if (supplyUsd <= 0) return supply;
    return supply + supplyUsd;
  };

  // Sort data based on active column and its sort mode
  const sortedData = useMemo(() => {
    return [...reserves].sort((a, b) => {
      let comparison = 0;

      // Default to supply total desc when no column is selected
      const sortColumn = activeSortColumn ?? 'supply';

      if (sortColumn === 'token') {
        const order = tokenSortOrder === 'asc' ? 1 : -1;
        return order * (a.tokenSymbol.localeCompare(b.tokenSymbol, undefined, { sensitivity: 'base' }));
      }
      if (sortColumn === 'price') {
        const aP = a.tokenPrice ?? -Infinity;
        const bP = b.tokenPrice ?? -Infinity;
        comparison = aP - bP;
        return priceSortOrder === 'desc' ? -comparison : comparison;
      }
      if (sortColumn === 'supplyLiquidity') {
        const aT = getDisplaySupplyUsd(a) ?? -Infinity;
        const bT = getDisplaySupplyUsd(b) ?? -Infinity;
        comparison = aT - bT;
        return supplyLiquiditySortOrder === 'desc' ? -comparison : comparison;
      }
      if (sortColumn === 'util') {
        const aU = a.utilizationPct ?? -Infinity;
        const bU = b.utilizationPct ?? -Infinity;
        comparison = aU - bU;
        return utilSortOrder === 'desc' ? -comparison : comparison;
      }

      if (sortColumn === 'supply') {
        // Supply sorting
        if (supplySortMode === 'native') {
          const aNative = getDisplaySupplyNative(a);
          const bNative = getDisplaySupplyNative(b);
          if (aNative === null && bNative === null) return 0;
          if (aNative === null) return 1;
          if (bNative === null) return -1;
          comparison = bNative - aNative;
        } else if (supplySortMode === 'incentive') {
          const aIncentive = getDisplaySupplyIncentive(a);
          const bIncentive = getDisplaySupplyIncentive(b);
          const aNative = getDisplaySupplyNative(a);
          const bNative = getDisplaySupplyNative(b);
          return compareIncentiveWithNative(aIncentive, bIncentive, aNative, bNative, supplySortOrder);
        } else {
          // Total sorting - use totalSupplyApy (Native + Incentive)
          const aTotal = getDisplaySupplyTotal(a);
          const bTotal = getDisplaySupplyTotal(b);
          if (aTotal === null && bTotal === null) return 0;
          if (aTotal === null) return 1;
          if (bTotal === null) return -1;
          comparison = bTotal - aTotal;
        }
        return supplySortOrder === 'desc' ? comparison : -comparison;
      } else if (sortColumn === 'borrow') {
        // Borrow sorting
        if (borrowSortMode === 'native') {
          const aNative = getDisplayBorrowNative(a);
          const bNative = getDisplayBorrowNative(b);
          if (aNative === null && bNative === null) return 0;
          if (aNative === null) return 1;
          if (bNative === null) return -1;
          comparison = bNative - aNative;
        } else if (borrowSortMode === 'incentive') {
          const aIncentive = getDisplayBorrowIncentive(a);
          const bIncentive = getDisplayBorrowIncentive(b);
          const aNative = getDisplayBorrowNative(a);
          const bNative = getDisplayBorrowNative(b);
          return compareIncentiveWithNative(aIncentive, bIncentive, aNative, bNative, borrowSortOrder);
        } else {
          // Total sorting
          const aTotal = getDisplayBorrowTotal(a);
          const bTotal = getDisplayBorrowTotal(b);
          if (aTotal === null && bTotal === null) return 0;
          if (aTotal === null) return 1;
          if (bTotal === null) return -1;
          comparison = bTotal - aTotal;
        }
        return borrowSortOrder === 'desc' ? comparison : -comparison;
      } else {
        // Spread sorting (or default when activeSortColumn is null)
        const aSpread = getDisplaySpread(a);
        const bSpread = getDisplaySpread(b);
        if (aSpread === null && bSpread === null) return 0;
        if (aSpread === null) return 1;
        if (bSpread === null) return -1;
        comparison = bSpread - aSpread;
        return spreadSortOrder === 'desc' ? comparison : -comparison;
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserves, activeSortColumn, tokenSortOrder, priceSortOrder, supplyLiquiditySortOrder, utilSortOrder, supplySortMode, supplySortOrder, borrowSortMode, borrowSortOrder, spreadSortOrder, simulationsById, hasSharedScenario, isApy, tydroPointToUsdRate, includeWhitelistOnlyMerkl, debouncedSharedSupplyInput, sharedInputMode]);

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

  const toggleSupplySortOrder = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('supply');
    setSupplySortOrder(supplySortOrder === 'desc' ? 'asc' : 'desc');
  };

  const toggleBorrowSortOrder = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('borrow');
    setBorrowSortOrder(borrowSortOrder === 'desc' ? 'asc' : 'desc');
  };

  const toggleSpreadSortOrder = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('spread');
    setSpreadSortOrder(spreadSortOrder === 'desc' ? 'asc' : 'desc');
  };

  const collapseExpandedOnSort = useCallback(() => {
    setExpandedReserveId(null);
  }, []);

  const handleSortToken = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('token');
    setTokenSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
  };
  const handleSortPrice = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('price');
    setPriceSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
  };
  const handleSortSupplyLiquidity = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('supplyLiquidity');
    setSupplyLiquiditySortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
  };
  const handleSortUtil = () => {
    collapseExpandedOnSort();
    setActiveSortColumn('util');
    setUtilSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
  };

  const handleIncentiveClick = useCallback((
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null,
  ) => {
    e.stopPropagation();
    if (apy === null || isNaN(apy)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;
    setTooltipState({
      reserve,
      type,
      position: { x: rect.left, y: rect.bottom },
      triggerCenterX,
      triggerHeight: rect.height,
      triggerRect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      },
    });
  }, []);

  

  const handleRowClick = (reserve: ReserveWithSpread) => {
    const url = buildAaveReserveUrl({
      marketName: reserve.marketName,
      tokenAddress: reserve.tokenAddress,
    });
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Mobile card view with tooltip support
  const handleMobileIncentiveClick = (
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null
  ) => {
    if (apy === null || isNaN(apy)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;
    setTooltipState({
      reserve,
      type,
      position: { x: rect.left, y: rect.bottom },
      triggerCenterX,
      triggerHeight: rect.height,
      triggerRect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      },
    });
  };

  // Auto-expand when parent requests scroll to a specific reserve
  useEffect(() => {
    if (scrollToReserveId) {
      setShowAll(true);
    }
  }, [scrollToReserveId]);

  // Display data with pagination - must be before conditional returns
  // Ensure the expanded row is always visible even if it's beyond the default count
  const displayData = useMemo(() => {
    if (showAll) return sortedData;
    const sliced = sortedData.slice(0, DEFAULT_VISIBLE_COUNT);
    // If there's an expanded row that's beyond the slice, include it
    if (expandedReserveId) {
      const expandedIndex = sortedData.findIndex(
        (r) => getReserveSimulationId(r) === expandedReserveId
      );
      if (expandedIndex >= DEFAULT_VISIBLE_COUNT) {
        // Include all items up to and including the expanded row
        return sortedData.slice(0, expandedIndex + 1);
      }
    }
    return sliced;
  }, [sortedData, showAll, expandedReserveId]);

  const scenarioControls = <ScenarioControls onDebouncedChange={handleScenarioChange} />;

  // Mobile card view
  if (isMobile) {
    return (
      <div className="space-y-3">
        <div className="sticky top-0 z-20 -mx-[var(--ds-space-3)] px-[var(--ds-space-3)] py-[var(--ds-space-1)] bg-muted/40 backdrop-blur-sm rounded-b-lg border-b border-border/50">
          {scenarioControls}
        </div>
        {/* Header with sorting controls */}
        <div className="flex justify-between items-center px-[var(--ds-space-1)]">
          <h3 className="ds-text-14 font-bold text-foreground">{reserves.length} Reserves</h3>
          <div className="flex items-center gap-[var(--ds-space-2)]">
            {/* Supply sort dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSupplySortMenu(!showSupplySortMenu);
                  setShowBorrowSortMenu(false);
                }}
                className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                  activeSortColumn === 'supply'
                    ? 'bg-card/60 border-border/70 ds-text-emerald-700'
                    : 'bg-card border-border text-muted-foreground'
                }`}
              >
                <span>Supply</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSupplySortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSupplySortMenu(false)} />
                  <div className="absolute right-0 top-full mt-[var(--ds-space-1)] bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-20 min-w-[130px]">
                    {(['total', 'native', 'incentive'] as SortMode[]).map((mode) => {
                      const isAlreadySelected = supplySortMode === mode && activeSortColumn === 'supply';
                      const getColorClass = () => {
                        if (mode === 'total') return 'ds-text-emerald-600';
                        if (mode === 'native') return 'ds-text-emerald-600';
                        return 'ds-text-emerald-600';
                      };
                      return (
                      <button
                          type="button"
                          key={mode}
                          onClick={() => {
                            if (isAlreadySelected && supplySortOrder === 'desc') {
                              setSupplySortOrder('asc');
                            } else {
                              setSupplySortMode(mode);
                              setActiveSortColumn('supply');
                              setSupplySortOrder('desc');
                            }
                            setShowSupplySortMenu(false);
                          }}
                          className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-13 transition-colors flex items-center justify-between ${
                            isAlreadySelected
                              ? `${getColorClass()} font-bold bg-card/60`
                              : 'text-muted-foreground'
                          }`}
                        >
                          <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                          {isAlreadySelected && (
                            supplySortOrder === 'desc' ? (
                              <ArrowDown className={`w-3 h-3 ${getColorClass()}`} />
                            ) : (
                              <ArrowUp className={`w-3 h-3 ${getColorClass()}`} />
                            )
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            
            {/* Borrow sort dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowBorrowSortMenu(!showBorrowSortMenu);
                  setShowSupplySortMenu(false);
                }}
                className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                  activeSortColumn === 'borrow'
                    ? 'bg-card/60 border-border/70 ds-text-brand-cyan'
                    : 'bg-card border-border text-muted-foreground'
                }`}
              >
                <span>Borrow</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showBorrowSortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowBorrowSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-[var(--ds-space-1)] bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-20 min-w-[130px]">
                    {(['total', 'native', 'incentive'] as SortMode[]).map((mode) => {
                      const isAlreadySelected = borrowSortMode === mode && activeSortColumn === 'borrow';
                      const getColorClass = () => {
                        if (mode === 'total') return 'ds-text-brand-cyan';
                        if (mode === 'native') return 'ds-text-brand-cyan';
                        return 'ds-text-brand-cyan';
                      };
                      return (
                      <button
                          type="button"
                          key={mode}
                          onClick={() => {
                            if (isAlreadySelected && borrowSortOrder === 'desc') {
                              setBorrowSortOrder('asc');
                            } else {
                              setBorrowSortMode(mode);
                              setActiveSortColumn('borrow');
                              setBorrowSortOrder('desc');
                            }
                            setShowBorrowSortMenu(false);
                          }}
                          className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-13 transition-colors flex items-center justify-between ${
                            isAlreadySelected
                              ? `${getColorClass()} font-bold bg-card/60`
                              : 'text-muted-foreground'
                          }`}
                        >
                          <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                          {isAlreadySelected && (
                            borrowSortOrder === 'desc' ? (
                              <ArrowDown className={`w-3 h-3 ${getColorClass()}`} />
                            ) : (
                              <ArrowUp className={`w-3 h-3 ${getColorClass()}`} />
                            )
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Spread sort button */}
            <button
              type="button"
              onClick={() => {
                if (activeSortColumn === 'spread') {
                  toggleSpreadSortOrder();
                } else {
                  setActiveSortColumn('spread');
                  setSpreadSortOrder('desc');
                }
              }}
              className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                activeSortColumn === 'spread'
                  ? 'ds-bg-purple-50 ds-border-purple-200 ds-text-purple-700'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted/60'
              }`}
            >
              <span>Spread</span>
              {activeSortColumn === 'spread' ? (
                spreadSortOrder === 'desc' ? (
                  <ArrowDown className="w-3 h-3" />
                ) : (
                  <ArrowUp className="w-3 h-3" />
                )
              ) : (
                <ArrowDown className="w-3 h-3 opacity-50" />
              )}
            </button>
            
            {/* Sort order toggle */}
            <button
              type="button"
              onClick={() => {
                if (activeSortColumn === 'supply') {
                  toggleSupplySortOrder();
                } else if (activeSortColumn === 'borrow') {
                  toggleBorrowSortOrder();
                } else {
                  toggleSpreadSortOrder();
                }
              }}
              className="ds-icon-button border border-border bg-card hover:bg-muted/60 transition-colors"
            >
              {(activeSortColumn === 'supply' ? supplySortOrder : activeSortColumn === 'borrow' ? borrowSortOrder : spreadSortOrder) === 'desc' ? (
                <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
        
        {/* 2x2 Grid layout for mobile */}
        <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
          {isLoading && reserves.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border/60 ds-card-pad-sm">
                <div className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-3)]">
                  <Skeleton variant="gradient" className="w-8 h-8 rounded-full border-transparent shrink-0" />
                  <div className="space-y-1 flex-1 min-w-0">
                    <Skeleton variant="gradient" className="h-4 w-14 rounded-md" />
                    <Skeleton variant="subtle" className="h-3 w-20 rounded-md" />
                  </div>
                  <Skeleton variant="subtle" className="w-7 h-7 rounded-full border-border/60 shrink-0" />
                </div>
                <div className="grid grid-cols-3 gap-[var(--ds-space-2)]">
                  <div className="space-y-1">
                    <Skeleton variant="subtle" className="h-2 w-10 rounded-md" />
                    <Skeleton variant="gradient" className="h-5 w-14 rounded-md" />
                    <Skeleton variant="subtle" className="h-3 w-16 rounded-full border-transparent" />
                  </div>
                  <div className="space-y-1 items-center flex flex-col">
                    <Skeleton variant="subtle" className="h-2 w-10 rounded-md" />
                    <Skeleton variant="subtle" className="h-4 w-14 rounded-md" />
                  </div>
                  <div className="space-y-1 flex flex-col items-end">
                    <Skeleton variant="subtle" className="h-2 w-10 rounded-md" />
                    <Skeleton variant="gradient" className="h-5 w-14 rounded-md" />
                    <Skeleton variant="subtle" className="h-3 w-16 rounded-full border-transparent" />
                  </div>
                </div>
              </div>
            ))
          ) : (
            displayData.map((reserve) => {
              const reserveId = `${reserve.marketName}-${reserve.tokenAddress}`;
              return (
              <MobileReserveCard
                key={reserveId}
                reserve={reserve}
                isApy={isApy}
                onIncentiveClick={handleMobileIncentiveClick}
                isSimulationExpanded={expandedReserveId === reserveId}
                onToggleSimulation={() =>
                  setExpandedReserveId((prev) => (prev === reserveId ? null : reserveId))
                }
                simulation={simulationsById[reserveId]}
                supplyInput={debouncedSharedSupplyInput}
                borrowInput={debouncedSharedBorrowInput}
                hasSharedScenario={hasSharedScenario}
                inputMode={sharedInputMode}
              />
              );
            })
          )}
        </div>
        
        {/* Show More/Less button for mobile */}
        {sortedData.length > displayData.length && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="w-full mt-[var(--ds-space-4)] ds-button ds-text-14 md:ds-text-16 gap-[var(--ds-space-2)] border border-border bg-card hover:bg-muted/50 transition-colors text-foreground font-semibold"
          >
            <span>{`Show ${sortedData.length - displayData.length} More Reserves`}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
        {showAll && sortedData.length > DEFAULT_VISIBLE_COUNT && (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="w-full mt-[var(--ds-space-4)] ds-button ds-text-14 md:ds-text-16 gap-[var(--ds-space-2)] border border-border bg-card hover:bg-muted/50 transition-colors text-foreground font-semibold"
          >
            <span>Show Less</span>
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
        
        {tooltipState && (
          <IncentiveTooltip
            reserve={tooltipState.reserve}
            type={tooltipState.type}
            position={tooltipState.position}
            triggerCenterX={tooltipState.triggerCenterX}
            triggerHeight={tooltipState.triggerHeight}
            triggerRect={tooltipState.triggerRect}
            accentTextClass={tooltipState.type === 'supply' ? 'ds-text-emerald-600' : 'ds-text-brand-cyan'}
            accentBgClass={tooltipState.type === 'supply' ? 'ds-bg-emerald-500-10' : 'ds-bg-brand-cyan-10'}
            onClose={() => setTooltipState(null)}
            isApy={isApy}
            tydroPointToUsdRate={tydroPointToUsdRate}
            includeWhitelistOnlyMerkl={includeWhitelistOnlyMerkl}
            onToggleWhitelistOnlyMerkl={onToggleWhitelistOnlyMerkl}
            tokenPrices={tokenPrices}
          />
        )}
      </div>
    );
  }


  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border/60 relative">
      <div className="sticky top-0 z-20 border-b border-border/60 p-[var(--ds-space-3)] bg-muted/40 backdrop-blur-sm shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]">
        {scenarioControls}
      </div>
      <div className="overflow-x-auto">
        <Table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '11%' }} />
          </colgroup>
          <TableHeader>
            <TableRow className="border-border/50 bg-card/60">
              {/* Token */}
              <TableHead className="px-[var(--ds-space-3)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground">
                <button
                  type="button"
                  onClick={handleSortToken}
                  className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-colors ${
                    activeSortColumn === 'token' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                >
                  <span>Token</span>
                  {activeSortColumn === 'token' ? (
                    tokenSortOrder === 'asc' ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )
                  ) : (
                    <ArrowDown className="w-3 h-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              {/* Price */}
              <TableHead className="px-[var(--ds-space-3)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
                <button
                  type="button"
                  onClick={handleSortPrice}
                  className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-colors ${
                    activeSortColumn === 'price' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                >
                  <span>Price</span>
                  {activeSortColumn === 'price' ? (
                    priceSortOrder === 'desc' ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )
                  ) : (
                    <ArrowDown className="w-3 h-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              {/* Market */}
              <TableHead className="px-[var(--ds-space-3)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
                Market
              </TableHead>
              {/* Supply */}
              <TableHead className="px-[var(--ds-space-3)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
                <button
                  type="button"
                  onClick={handleSortSupplyLiquidity}
                  className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-colors ${
                    activeSortColumn === 'supplyLiquidity' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                >
                  <span>Supply</span>
                  {activeSortColumn === 'supplyLiquidity' ? (
                    supplyLiquiditySortOrder === 'desc' ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )
                  ) : (
                    <ArrowDown className="w-3 h-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              {/* Supply Column - center aligned */}
              <TableHead className="px-[var(--ds-space-3)] py-[var(--ds-space-3)] ds-text-14 md:ds-text-16 font-semibold text-muted-foreground text-center">
                <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
                  <div className="flex items-center gap-[var(--ds-space-1-5)]">
                    <span
                      className={activeSortColumn === 'supply' ? 'ds-text-emerald-600' : 'text-muted-foreground'}
                    >
                      Supply
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowSupplySortMenu(!showSupplySortMenu)}
                        className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                          showSupplySortMenu || activeSortColumn === 'supply'
                            ? 'bg-card/60 border-border/70 ds-text-emerald-700'
                            : 'bg-card/60 border-border/70 text-muted-foreground'
                        }`}
                        title="Select sort field"
                      >
                        <span className="font-semibold">{supplySortLabel}</span>
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                      {showSupplySortMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowSupplySortMenu(false)}
                          />
                          <div className="absolute right-0 top-full mt-[var(--ds-space-1)] bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-20 min-w-[140px]">
                            <button
                              type="button"
                              onClick={() => {
                                collapseExpandedOnSort();
                                const isAlreadySelected = supplySortMode === 'total' && activeSortColumn === 'supply';
                                if (isAlreadySelected && supplySortOrder === 'desc') {
                                  setSupplySortOrder('asc');
                                } else {
                                  setSupplySortMode('total');
                                  setActiveSortColumn('supply');
                                  setSupplySortOrder('desc');
                                }
                                setShowSupplySortMenu(false);
                              }}
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)] transition-colors flex items-center justify-between ${
                                supplySortMode === 'total' && activeSortColumn === 'supply'
                                  ? 'ds-text-emerald-600 font-bold bg-card/60'
                                  : 'text-foreground/80'
                              }`}
                            >
                              <span>Sort by Total</span>
                              {supplySortMode === 'total' && activeSortColumn === 'supply' ? (
                                supplySortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 ds-text-emerald-600" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 ds-text-emerald-600" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                collapseExpandedOnSort();
                                const isAlreadySelected = supplySortMode === 'native' && activeSortColumn === 'supply';
                                if (isAlreadySelected && supplySortOrder === 'desc') {
                                  setSupplySortOrder('asc');
                                } else {
                                  setSupplySortMode('native');
                                  setActiveSortColumn('supply');
                                  setSupplySortOrder('desc');
                                }
                                setShowSupplySortMenu(false);
                              }}
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)] transition-colors flex items-center justify-between ${
                                supplySortMode === 'native' && activeSortColumn === 'supply'
                                  ? 'ds-text-emerald-600 font-bold bg-card/60'
                                  : 'text-foreground/80'
                              }`}
                            >
                              <span>Sort by Native</span>
                              {supplySortMode === 'native' && activeSortColumn === 'supply' ? (
                                supplySortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 ds-text-emerald-600" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 ds-text-emerald-600" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                collapseExpandedOnSort();
                                const isAlreadySelected = supplySortMode === 'incentive' && activeSortColumn === 'supply';
                                if (isAlreadySelected && supplySortOrder === 'desc') {
                                  setSupplySortOrder('asc');
                                } else {
                                  setSupplySortMode('incentive');
                                  setActiveSortColumn('supply');
                                  setSupplySortOrder('desc');
                                }
                                setShowSupplySortMenu(false);
                              }}
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-emerald-50-rgb)/0.5)] transition-colors flex items-center justify-between ${
                                supplySortMode === 'incentive' && activeSortColumn === 'supply'
                                  ? 'ds-text-emerald-600 font-bold bg-card/60'
                                  : 'text-foreground/80'
                              }`}
                            >
                              <span>Sort by Incentive</span>
                              {supplySortMode === 'incentive' && activeSortColumn === 'supply' ? (
                                supplySortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 ds-text-emerald-600" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 ds-text-emerald-600" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </TableHead>
              {/* Spread Column - center aligned */}
              <TableHead className="px-[var(--ds-space-3)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
                <button
                  type="button"
                  onClick={() => {
                    if (activeSortColumn === 'spread') {
                      toggleSpreadSortOrder();
                    } else {
                      collapseExpandedOnSort();
                      setActiveSortColumn('spread');
                      setSpreadSortOrder('desc');
                    }
                  }}
                  className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-colors ${
                    activeSortColumn === 'spread' ? 'ds-text-purple-600' : 'text-muted-foreground'
                  }`}
                >
                  <span>Spread</span>
                  {activeSortColumn === 'spread' ? (
                    spreadSortOrder === 'desc' ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )
                  ) : (
                    <ArrowDown className="w-3 h-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              {/* Borrow Column - center aligned */}
              <TableHead className="px-[var(--ds-space-3)] py-[var(--ds-space-3)] ds-text-14 md:ds-text-16 font-semibold text-muted-foreground text-center">
                <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
                  <div className="flex items-center gap-[var(--ds-space-1-5)]">
                    <span
                      className={activeSortColumn === 'borrow' ? 'ds-text-brand-cyan' : 'text-muted-foreground'}
                    >
                      Borrow
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowBorrowSortMenu(!showBorrowSortMenu)}
                        className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                          showBorrowSortMenu || activeSortColumn === 'borrow'
                            ? 'bg-card/60 border-border/70 ds-text-brand-cyan'
                            : 'bg-card/60 border-border/70 text-muted-foreground'
                        }`}
                        title="Select sort field"
                      >
                        <span className="font-semibold">{borrowSortLabel}</span>
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                        {showBorrowSortMenu && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setShowBorrowSortMenu(false)}
                            />
                            <div className="absolute right-0 top-full mt-[var(--ds-space-1)] bg-card border border-border rounded-lg shadow-lg py-[var(--ds-space-1)] z-20 min-w-[140px]">
                              <button
                                type="button"
                                onClick={() => {
                                  collapseExpandedOnSort();
                                  const isAlreadySelected = borrowSortMode === 'total' && activeSortColumn === 'borrow';
                                  if (isAlreadySelected && borrowSortOrder === 'desc') {
                                    setBorrowSortOrder('asc');
                                  } else {
                                    setBorrowSortMode('total');
                                    setActiveSortColumn('borrow');
                                    setBorrowSortOrder('desc');
                                  }
                                  setShowBorrowSortMenu(false);
                                }}
                                className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)] transition-colors flex items-center justify-between ${
                                  borrowSortMode === 'total' && activeSortColumn === 'borrow'
                                    ? 'ds-text-brand-cyan font-bold bg-card/60'
                                    : 'text-foreground/80'
                                }`}
                              >
                                <span>Sort by Total</span>
                                {borrowSortMode === 'total' && activeSortColumn === 'borrow' ? (
                                  borrowSortOrder === 'desc' ? (
                                    <ArrowDown className="w-3 h-3 ds-text-brand-cyan" />
                                  ) : (
                                    <ArrowUp className="w-3 h-3 ds-text-brand-cyan" />
                                  )
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  collapseExpandedOnSort();
                                  const isAlreadySelected = borrowSortMode === 'native' && activeSortColumn === 'borrow';
                                  if (isAlreadySelected && borrowSortOrder === 'desc') {
                                    setBorrowSortOrder('asc');
                                  } else {
                                    setBorrowSortMode('native');
                                    setActiveSortColumn('borrow');
                                    setBorrowSortOrder('desc');
                                  }
                                  setShowBorrowSortMenu(false);
                                }}
                                className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)] transition-colors flex items-center justify-between ${
                                  borrowSortMode === 'native' && activeSortColumn === 'borrow'
                                    ? 'ds-text-brand-cyan font-bold bg-card/60'
                                    : 'text-foreground/80'
                                }`}
                              >
                                <span>Sort by Native</span>
                                {borrowSortMode === 'native' && activeSortColumn === 'borrow' ? (
                                  borrowSortOrder === 'desc' ? (
                                    <ArrowDown className="w-3 h-3 ds-text-brand-cyan" />
                                  ) : (
                                    <ArrowUp className="w-3 h-3 ds-text-brand-cyan" />
                                  )
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  collapseExpandedOnSort();
                                  const isAlreadySelected = borrowSortMode === 'incentive' && activeSortColumn === 'borrow';
                                  if (isAlreadySelected && borrowSortOrder === 'desc') {
                                    setBorrowSortOrder('asc');
                                  } else {
                                    setBorrowSortMode('incentive');
                                    setActiveSortColumn('borrow');
                                    setBorrowSortOrder('desc');
                                  }
                                  setShowBorrowSortMenu(false);
                                }}
                                className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.1)] transition-colors flex items-center justify-between ${
                                  borrowSortMode === 'incentive' && activeSortColumn === 'borrow'
                                    ? 'ds-text-brand-cyan font-bold bg-card/60'
                                    : 'text-foreground/80'
                                }`}
                              >
                                <span>Sort by Incentive</span>
                                {borrowSortMode === 'incentive' && activeSortColumn === 'borrow' ? (
                                  borrowSortOrder === 'desc' ? (
                                    <ArrowDown className="w-3 h-3 ds-text-brand-cyan" />
                                  ) : (
                                    <ArrowUp className="w-3 h-3 ds-text-brand-cyan" />
                                  )
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-muted-foreground/70" />
                                )}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                </div>
              </TableHead>
              {/* Utilization */}
              <TableHead className="px-[var(--ds-space-3)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
                <button
                  type="button"
                  onClick={handleSortUtil}
                  className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-colors ${
                    activeSortColumn === 'util' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                >
                  <span>Util.</span>
                  {activeSortColumn === 'util' ? (
                    utilSortOrder === 'desc' ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )
                  ) : (
                    <ArrowDown className="w-3 h-3 opacity-50" />
                  )}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && reserves.length === 0 ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/30">
                  <TableCell className="px-[var(--ds-space-3)] ds-row-pad text-center">
                    <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
                      <Skeleton variant="gradient" className="w-7 h-7 rounded-full border-transparent" />
                      <Skeleton variant="default" className="h-4 w-14 rounded-md" />
                    </div>
                  </TableCell>
                  <TableCell className="px-[var(--ds-space-3)] ds-row-pad text-center hidden md:table-cell">
                    <Skeleton variant="subtle" className="h-4 w-16 rounded-md mx-auto" />
                  </TableCell>
                  <TableCell className="px-[var(--ds-space-3)] ds-row-pad text-center hidden md:table-cell">
                    <Skeleton variant="subtle" className="h-6 w-20 rounded-full mx-auto" />
                  </TableCell>
                  <TableCell className="px-[var(--ds-space-3)] ds-row-pad text-center hidden md:table-cell">
                    <Skeleton variant="subtle" className="h-4 w-16 rounded-md mx-auto" />
                  </TableCell>
                  <TableCell className="px-[var(--ds-space-3)] ds-row-pad text-center">
                    <div className="flex flex-col items-center gap-[var(--ds-space-1)]">
                      <Skeleton variant="gradient" className={`h-5 rounded-md ${i % 2 === 0 ? 'w-16' : 'w-[4.5rem]'}`} />
                      <Skeleton variant="subtle" className={`h-3 rounded-full border-transparent ${i % 2 === 0 ? 'w-20' : 'w-[4.5rem]'}`} />
                    </div>
                  </TableCell>
                  <TableCell className="px-[var(--ds-space-3)] ds-row-pad text-center hidden md:table-cell">
                    <Skeleton variant="subtle" className={`h-5 rounded-md mx-auto ${i % 2 === 0 ? 'w-16' : 'w-14'}`} />
                  </TableCell>
                  <TableCell className="px-[var(--ds-space-3)] ds-row-pad text-center">
                    <div className="flex flex-col items-center gap-[var(--ds-space-1)]">
                      <Skeleton variant="gradient" className={`h-5 rounded-md ${i % 3 === 0 ? 'w-16' : 'w-[4.5rem]'}`} />
                      <Skeleton variant="subtle" className={`h-3 rounded-full border-transparent ${i % 3 === 0 ? 'w-20' : 'w-[4.5rem]'}`} />
                    </div>
                  </TableCell>
                  <TableCell className="px-[var(--ds-space-3)] ds-row-pad text-center hidden md:table-cell">
                    <Skeleton variant="subtle" className="h-4 w-12 rounded-md mx-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : displayData.map((reserve) => {
              const reserveId = getReserveSimulationId(reserve);
              const simulation = simulationsById[reserveId];
              const displaySupplyIncentive = (() => {
                const incentive = getDisplaySupplyIncentive(reserve);
                return incentive === 0 || isNaN(incentive) || incentive < 0.01 ? null : incentive;
              })();
              const displayBorrowIncentive = (() => {
                const incentive = getDisplayBorrowIncentive(reserve);
                return incentive === 0 || isNaN(incentive) || incentive < 0.01 ? null : incentive;
              })();
              return (
                <DesktopReserveRow
                  key={reserveId}
                  reserve={reserve}
                  reserveId={reserveId}
                  isExpanded={expandedReserveId === reserveId}
                  onToggleExpand={handleToggleExpand}
                  onSelectMarket={onSelectMarket}
                  onIncentiveClick={handleIncentiveClick}
                  displaySupplyTotal={getDisplaySupplyTotal(reserve)}
                  displaySupplyNative={getDisplaySupplyNative(reserve)}
                  displaySupplyIncentive={displaySupplyIncentive}
                  displayBorrowTotal={getDisplayBorrowTotal(reserve)}
                  displayBorrowNative={getDisplayBorrowNative(reserve)}
                  displayBorrowIncentive={displayBorrowIncentive}
                  spread={getDisplaySpread(reserve)}
                  simulation={simulation}
                  supplyInput={debouncedSharedSupplyInput}
                  borrowInput={debouncedSharedBorrowInput}
                  inputMode={sharedInputMode}
                  isApy={isApy}
                  isMobile={isMobile}
                />
              );
            })
            }
          </TableBody>
        </Table>
      </div>
      
      {/* Show More/Less button for desktop */}
      {sortedData.length > displayData.length && (
        <div className="p-[var(--ds-space-4)] border-t border-border">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full ds-button ds-text-14 md:ds-text-16 gap-[var(--ds-space-2)] border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-foreground font-semibold"
          >
            <span>{`Show ${sortedData.length - displayData.length} More Reserves`}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
      {showAll && sortedData.length > DEFAULT_VISIBLE_COUNT && (
        <div className="p-[var(--ds-space-4)] border-t border-border">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="w-full ds-button ds-text-14 md:ds-text-16 gap-[var(--ds-space-2)] border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-foreground font-semibold"
          >
            <span>Show Less</span>
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {tooltipState && (
        <IncentiveTooltip
          reserve={tooltipState.reserve}
          type={tooltipState.type}
          position={tooltipState.position}
          triggerCenterX={tooltipState.triggerCenterX}
          triggerHeight={tooltipState.triggerHeight}
          triggerRect={tooltipState.triggerRect}
          accentTextClass={tooltipState.type === 'supply' ? 'ds-text-emerald-600' : 'ds-text-brand-cyan'}
          accentBgClass={tooltipState.type === 'supply' ? 'ds-bg-emerald-500-10' : 'ds-bg-brand-cyan-10'}
          onClose={() => setTooltipState(null)}
          isApy={isApy}
          tydroPointToUsdRate={tydroPointToUsdRate}
          includeWhitelistOnlyMerkl={includeWhitelistOnlyMerkl}
          onToggleWhitelistOnlyMerkl={onToggleWhitelistOnlyMerkl}
          tokenPrices={tokenPrices}
        />
      )}
    </div>
  );
};

export default ReservesTable;
