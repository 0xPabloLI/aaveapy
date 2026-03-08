import { useState, useMemo, useEffect, Fragment } from 'react';
import { ArrowUp, ArrowDown, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReserveWithSpread, ETHEREUM_MARKET_NAMES, TokenPricesIndex } from '@/types/aave';
import { 
  formatPercent, 
  formatSpread, 
  calculateTotalSupplyApr,
  calculateTotalSupplyApy,
  calculateTotalBorrowApr,
  calculateTotalBorrowApy,
  calculateSpreadApy,
  calculateSpreadApr,
  calculateTotalIncentiveApr,
  calculateTotalIncentiveApy,
  apyToApr
} from '@/lib/formatters';
import { formatNumberInput } from '@/lib/numberFormat';
import { compareIncentiveWithNative } from '@/lib/sorters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import IncentiveTooltip from './IncentiveTooltip';
import MobileReserveCard from './MobileReserveCard';
import SimulationSubRow from './SimulationSubRow';
import { useIsMobile } from '@/hooks/use-mobile';
import { getReserveSimulationId, useSharedRateSimulations } from '@/hooks/useRateSimulation';

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

const DEFAULT_VISIBLE_COUNT = 20;
const INPUT_DEBOUNCE_MS = 300;

const useDebouncedValue = (value: string, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};

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
  const [activeSortColumn, setActiveSortColumn] = useState<'supply' | 'borrow' | 'spread' | null>('supply');
  const [supplySortMode, setSupplySortMode] = useState<SortMode>('incentive');
  const [supplySortOrder, setSupplySortOrder] = useState<'asc' | 'desc'>('desc');
  const [borrowSortMode, setBorrowSortMode] = useState<SortMode>('total');
  const [borrowSortOrder, setBorrowSortOrder] = useState<'asc' | 'desc'>('desc');
  const [spreadSortOrder, setSpreadSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSupplySortMenu, setShowSupplySortMenu] = useState(false);
  const [showBorrowSortMenu, setShowBorrowSortMenu] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [expandedReserveId, setExpandedReserveId] = useState<string | null>(null);
  const [sharedSupplyInput, setSharedSupplyInput] = useState('');
  const [sharedBorrowInput, setSharedBorrowInput] = useState('');
  const [tooltipState, setTooltipState] = useState<{
    reserve: ReserveWithSpread;
    type: 'supply' | 'borrow';
    position: { x: number; y: number };
    triggerCenterX: number;
    triggerHeight: number;
    triggerRect: { top: number; bottom: number; left: number; right: number; width: number; height: number };
  } | null>(null);
  const debouncedSharedSupplyInput = useDebouncedValue(sharedSupplyInput, INPUT_DEBOUNCE_MS);
  const debouncedSharedBorrowInput = useDebouncedValue(sharedBorrowInput, INPUT_DEBOUNCE_MS);

  const { simulationsById, hasAnyInput: hasSharedScenario } = useSharedRateSimulations({
    reserves,
    isApy,
    includeWhitelistOnlyMerkl,
    tydroPointToUsdRate,
    tokenPrices,
    supplyInput: debouncedSharedSupplyInput,
    borrowInput: debouncedSharedBorrowInput,
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

  // Sort data based on active column and its sort mode
  const sortedData = [...reserves].sort((a, b) => {
    let comparison = 0;

    // Default to supply total desc when no column is selected
    const sortColumn = activeSortColumn ?? 'supply';

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
    setActiveSortColumn('supply');
    setSupplySortOrder(supplySortOrder === 'desc' ? 'asc' : 'desc');
  };

  const toggleBorrowSortOrder = () => {
    setActiveSortColumn('borrow');
    setBorrowSortOrder(borrowSortOrder === 'desc' ? 'asc' : 'desc');
  };

  const toggleSpreadSortOrder = () => {
    setActiveSortColumn('spread');
    setSpreadSortOrder(spreadSortOrder === 'desc' ? 'asc' : 'desc');
  };

  const handleIncentiveClick = (
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
  };

  const ChainIcon = ({ chain, className = '' }: { chain: string; className?: string }) => {
    const size = 'w-3.5 h-3.5';
    const src = getChainIconSrc(chain);

    if (!src) {
    return (
      <div className={`${size} rounded-full bg-current opacity-40 flex items-center justify-center ds-text-8 font-bold`}>
        {chain.charAt(0)}
      </div>
    );
    }

    return (
      <img
        src={src}
        alt={`${chain} logo`}
        className={`${size} ${className}`}
        loading="lazy"
      />
    );
  };

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
  const displayData = useMemo(() => 
    showAll ? sortedData : sortedData.slice(0, DEFAULT_VISIBLE_COUNT),
    [sortedData, showAll]
  );

  const scenarioControls = (
    <div className="rounded-xl border border-border/70 bg-card/80 p-[var(--ds-space-3)]">
      <div className={`grid gap-[var(--ds-space-2)] ${isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'}`}>
        <label className="block">
          <span className="ds-text-11 text-muted-foreground">Supply amount for all reserves</span>
          <input
            value={sharedSupplyInput}
            onChange={(event) => setSharedSupplyInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder="e.g. 100,000"
            className="mt-[var(--ds-space-1)] w-full rounded-md border border-border bg-background px-[var(--ds-space-2)] py-[var(--ds-space-1-5)] ds-text-13 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="block">
          <span className="ds-text-11 text-muted-foreground">Borrow amount for all reserves</span>
          <input
            value={sharedBorrowInput}
            onChange={(event) => setSharedBorrowInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder="e.g. 20,000"
            className="mt-[var(--ds-space-1)] w-full rounded-md border border-border bg-background px-[var(--ds-space-2)] py-[var(--ds-space-1-5)] ds-text-13 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <div className={`flex ${isMobile ? 'justify-start' : 'justify-end'} items-end`}>
          <button
            type="button"
            onClick={() => {
              setSharedSupplyInput('');
              setSharedBorrowInput('');
            }}
            disabled={!sharedSupplyInput && !sharedBorrowInput}
            className="inline-flex h-[38px] items-center justify-center rounded-md border border-border/70 bg-background px-[var(--ds-space-3)] ds-text-12 text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear scenario
          </button>
        </div>
      </div>
      <p className="mt-[var(--ds-space-2)] ds-text-11 text-muted-foreground">
        Shared scenario applies to every reserve row, sorting mode, and expanded breakdown.
      </p>
    </div>
  );

  // Mobile card view
  if (isMobile) {
    return (
      <div className="space-y-3">
        {scenarioControls}
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
            (showAll ? sortedData : sortedData.slice(0, DEFAULT_VISIBLE_COUNT)).map((reserve) => {
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
              />
              );
            })
          )}
        </div>
        
        {/* Show More/Less button for mobile */}
        {sortedData.length > DEFAULT_VISIBLE_COUNT && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="w-full mt-[var(--ds-space-4)] ds-button ds-text-14 md:ds-text-16 gap-[var(--ds-space-2)] border border-border bg-card hover:bg-muted/50 transition-colors text-foreground font-semibold"
          >
            <span>{showAll ? 'Show Less' : `Show ${sortedData.length - DEFAULT_VISIBLE_COUNT} More Reserves`}</span>
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
    <div className="bg-card rounded-2xl shadow-sm border border-border/60 overflow-hidden">
      <div className="border-b border-border/60 p-[var(--ds-space-3)]">
        {scenarioControls}
      </div>
      <div className="overflow-x-auto">
        <Table className="table-fixed w-full">
          <colgroup>
            <col className="w-1/5" />
            <col className="w-1/5" />
            <col className="w-1/5" />
            <col className="w-1/5" />
            <col className="w-1/5" />
          </colgroup>
          <TableHeader>
            <TableRow className="border-border/50 bg-card/60">
              {/* Token - flex grow */}
              <TableHead className="w-1/5 px-[var(--ds-space-3)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground">
                Token
              </TableHead>
              {/* Market */}
              <TableHead className="w-1/5 px-[var(--ds-space-3)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
                Market
              </TableHead>
              {/* Supply Column - center aligned */}
              <TableHead className="w-1/5 px-[var(--ds-space-3)] py-[var(--ds-space-3)] ds-text-14 md:ds-text-16 font-semibold text-muted-foreground text-center">
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
              <TableHead className="w-1/5 px-[var(--ds-space-3)] py-[var(--ds-space-3)] text-center ds-text-14 md:ds-text-16 font-semibold text-muted-foreground hidden md:table-cell">
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
              <TableHead className="w-1/5 px-[var(--ds-space-3)] py-[var(--ds-space-3)] ds-text-14 md:ds-text-16 font-semibold text-muted-foreground text-center">
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && reserves.length === 0 ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/30">
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad text-center">
                    <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
                      <Skeleton variant="gradient" className="w-7 h-7 rounded-full border-transparent" />
                      <Skeleton variant="default" className="h-4 w-14 rounded-md" />
                    </div>
                  </TableCell>
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad text-center hidden md:table-cell">
                    <Skeleton variant="subtle" className="h-6 w-20 rounded-full mx-auto" />
                  </TableCell>
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad text-center">
                    <div className="flex flex-col items-center gap-[var(--ds-space-1)]">
                      <Skeleton variant="gradient" className={`h-5 rounded-md ${i % 2 === 0 ? 'w-16' : 'w-[4.5rem]'}`} />
                      <Skeleton variant="subtle" className={`h-3 rounded-full border-transparent ${i % 2 === 0 ? 'w-20' : 'w-[4.5rem]'}`} />
                    </div>
                  </TableCell>
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad text-center">
                    <Skeleton variant="subtle" className={`h-5 rounded-md mx-auto ${i % 2 === 0 ? 'w-16' : 'w-14'}`} />
                  </TableCell>
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad text-center">
                    <div className="flex flex-col items-center gap-[var(--ds-space-1)]">
                      <Skeleton variant="gradient" className={`h-5 rounded-md ${i % 3 === 0 ? 'w-16' : 'w-[4.5rem]'}`} />
                      <Skeleton variant="subtle" className={`h-3 rounded-full border-transparent ${i % 3 === 0 ? 'w-20' : 'w-[4.5rem]'}`} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : displayData.map((reserve) => {
              const reserveId = getReserveSimulationId(reserve);
              const isExpanded = expandedReserveId === reserveId;
              const simulation = simulationsById[reserveId];
              const displaySupplyTotal = getDisplaySupplyTotal(reserve);
              const displaySupplyNative = getDisplaySupplyNative(reserve);
              const displayBorrowTotal = getDisplayBorrowTotal(reserve);
              const displayBorrowNative = getDisplayBorrowNative(reserve);
              const displaySupplyIncentive = (() => {
                const incentive = getDisplaySupplyIncentive(reserve);
                return incentive === 0 || isNaN(incentive) || incentive < 0.01 ? null : incentive;
              })();
              const displayBorrowIncentive = (() => {
                const incentive = getDisplayBorrowIncentive(reserve);
                return incentive === 0 || isNaN(incentive) || incentive < 0.01 ? null : incentive;
              })();

              const spread = getDisplaySpread(reserve);
              const { iconSymbol, logoURI } = fetchIconSymbolAndName({
                underlyingAsset: reserve.tokenAddress,
                symbol: reserve.tokenSymbol,
                name: reserve.tokenName,
              });

              return (
                <Fragment key={reserveId}>
              <TableRow
                  data-reserve-id={reserveId}
                  className={`transition-all duration-150 cursor-pointer hover:bg-muted/60 hover:shadow-sm active:bg-muted/80 ${
                    isExpanded ? 'bg-muted/30' : ''
                  }`}
                  onClick={() => setExpandedReserveId((prev) => (prev === reserveId ? null : reserveId))}
                >
                  {/* Token */}
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
                      <div className={`inline-flex shrink-0 items-center justify-center w-5 h-5 rounded-full transition-colors ${
                        isExpanded ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                      <TokenIcon symbol={iconSymbol} size={28} loading="eager" logoURI={logoURI} />
                      <span className="font-semibold text-foreground ds-text-14">
                        {reserve.tokenSymbol}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRowClick(reserve);
                        }}
                        className="inline-flex shrink-0 items-center justify-center w-7 h-7 rounded-full bg-muted/60 border border-border/60 text-muted-foreground transition-all hover:bg-muted hover:border-border/80 hover:text-foreground"
                        aria-label={`Open ${reserve.tokenSymbol} on Aave`}
                        title="Open on Aave"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TableCell>
                  {/* Market */}
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectMarket?.(reserve.marketName);
                      }}
                      className="inline-flex items-center justify-center gap-[var(--ds-space-1-5)] px-[var(--ds-space-2-5)] py-[var(--ds-space-1)] rounded-full ds-text-11 font-medium bg-muted/50 text-muted-foreground border border-border/60 hover:bg-muted hover:text-foreground hover:border-border/80 hover:ring-2 hover:ring-muted-foreground/20 active:scale-[0.98] transition-all duration-150"
                      aria-label={`Filter by ${getMarketDisplayName(reserve)} market`}
                    >
                      <ChainIcon chain={reserve.chainName} />
                      {getMarketDisplayName(reserve)}
                    </button>
                  </TableCell>
                  {/* Supply */}
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center">
                    <div className="flex flex-col items-center justify-center gap-[var(--ds-space-0-5)] min-h-[2.75rem]">
                      <span className={`font-bold ds-text-emerald-500 tabular-nums ${isMobile ? 'ds-text-16' : 'ds-text-18'}`}>
                        {formatPercent(displaySupplyTotal)}
                      </span>
                      {displaySupplyIncentive !== null && (
                        <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-11 justify-center min-h-[1.25rem]">
                          <span className="ds-text-emerald-500-70 tabular-nums">
                            {formatPercent(displaySupplyNative)}
                          </span>
                          <span className="text-muted-foreground/70">+</span>
                          {hasSharedScenario ? (
                            <span className="inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full ds-bg-emerald-500-10 ds-text-emerald-500-70 ring-1 ds-ring-emerald-500-15 tabular-nums">
                              <span>{formatPercent(displaySupplyIncentive)}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) =>
                                handleIncentiveClick(e, reserve, 'supply', displaySupplyIncentive)
                              }
                              className="inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full ds-bg-emerald-500-10 ds-text-emerald-500-70 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.25)] hover:ring-2 hover:ring-[rgb(var(--ds-emerald-500-rgb)/0.3)] ring-1 ds-ring-emerald-500-15 transition-all duration-150 cursor-pointer tabular-nums"
                            >
                              <span>{formatPercent(displaySupplyIncentive)}</span>
                              <IncentiveIcon width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {/* Spread */}
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell">
                    <span
                      className={`font-bold tabular-nums ${isMobile ? 'ds-text-16' : 'ds-text-18'} ${
                        spread !== null ? 'ds-text-purple-500' : 'text-muted-foreground/70'
                      }`}
                    >
                      {formatSpread(spread)}
                    </span>
                  </TableCell>
                  {/* Borrow */}
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center">
                    <div className="flex flex-col items-center justify-center gap-[var(--ds-space-0-5)] min-h-[2.75rem]">
                        <span className={`font-bold ds-text-brand-cyan tabular-nums ${isMobile ? 'ds-text-16' : 'ds-text-18'}`}>
                          {displayBorrowTotal !== null ? formatPercent(displayBorrowTotal) : '-'}
                        </span>
                        {displayBorrowIncentive !== null && (
                          <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-11 justify-center min-h-[1.25rem]">
                            {displayBorrowNative !== null && (
                              <>
                                <span className="ds-text-brand-cyan-70 tabular-nums">
                                  {formatPercent(displayBorrowNative)}
                                </span>
                                <span className="text-muted-foreground/70">-</span>
                              </>
                            )}
                            {hasSharedScenario ? (
                              <span className="inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full ds-bg-brand-cyan-10 ds-text-brand-cyan-70 ring-1 ds-ring-brand-cyan-15 tabular-nums">
                                <span>{formatPercent(displayBorrowIncentive)}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) =>
                                  handleIncentiveClick(e, reserve, 'borrow', displayBorrowIncentive)
                                }
                                className="inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full ds-bg-brand-cyan-10 ds-text-brand-cyan-70 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.25)] hover:ring-2 hover:ring-[rgb(var(--ds-brand-cyan-rgb)/0.3)] ring-1 ds-ring-brand-cyan-15 transition-all duration-150 cursor-pointer tabular-nums"
                              >
                                <span>{formatPercent(displayBorrowIncentive)}</span>
                                <IncentiveIcon width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} />
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow
                    className="border-b border-border/40 bg-muted/10"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <TableCell colSpan={5} className="px-[var(--ds-space-3)] pb-[var(--ds-space-3)] pt-0">
                      {simulation && (
                        <SimulationSubRow
                          reserve={reserve}
                          simulation={simulation}
                          isApy={isApy}
                          supplyInput={debouncedSharedSupplyInput}
                          borrowInput={debouncedSharedBorrowInput}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              );
            })
            }
          </TableBody>
        </Table>
      </div>
      
      {/* Show More/Less button for desktop */}
      {sortedData.length > DEFAULT_VISIBLE_COUNT && (
        <div className="p-[var(--ds-space-4)] border-t border-border">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="w-full ds-button ds-text-14 md:ds-text-16 gap-[var(--ds-space-2)] border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-foreground font-semibold"
          >
            <span>{showAll ? 'Show Less' : `Show ${sortedData.length - DEFAULT_VISIBLE_COUNT} More Reserves`}</span>
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
