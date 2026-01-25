import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PoolWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
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
import { getChainIconSrc } from '@/lib/chainIcons';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import IncentiveTooltip from './IncentiveTooltip';
import MobilePoolCard from './MobilePoolCard';
import { useIsMobile } from '@/hooks/use-mobile';

interface PoolsTableProps {
  pools: PoolWithSpread[];
  sortField: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null;
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null) => void;
  isApy: boolean;
  onSelectMarket?: (marketName: string) => void;
}

type SortMode = 'total' | 'native' | 'incentive';

const DEFAULT_VISIBLE_COUNT = 20;

const PoolsTable = ({ pools, sortField, sortOrder, onSort, isApy, onSelectMarket }: PoolsTableProps) => {
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
  const [tooltipState, setTooltipState] = useState<{
    pool: PoolWithSpread;
    type: 'supply' | 'borrow';
    position: { x: number; y: number };
    triggerCenterX: number;
  } | null>(null);

  const getMarketDisplayName = (pool: PoolWithSpread) => {
    if (pool.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[pool.marketName]) {
      return ETHEREUM_MARKET_NAMES[pool.marketName];
    }
    return pool.chainName;
  };

  // Helper: Get incentive values for a pool (supply or borrow)
  const getIncentiveValues = (pool: PoolWithSpread, type: 'supply' | 'borrow') => {
    const protocolIncentives = type === 'supply' ? pool.supplyIncentives : pool.borrowIncentives;
    const meritIncentives = type === 'supply' ? pool.meritSupplys : pool.meritBorrows;
    const merklOpportunities = type === 'supply' ? pool.merklSupplys : pool.merklBorrows;
    const brevisIncentives = type === 'supply' ? pool.brevisSupplys : pool.brevisBorrows;
    const brevisLegacyApr = type === 'supply' ? pool.brevisSupplyApr : pool.brevisBorrowApr;
    const brevisSource = brevisIncentives && brevisIncentives.length > 0 ? brevisIncentives : brevisLegacyApr ?? null;
    return {
      apr: calculateTotalIncentiveApr(meritIncentives, merklOpportunities, brevisSource, protocolIncentives),
      apy: calculateTotalIncentiveApy(meritIncentives, merklOpportunities, brevisSource, protocolIncentives),
    };
  };

  // Calculate totals for a pool (frontend calculates incentive totals from details)
  const getTotalSupplyApy = (pool: PoolWithSpread): number | null => {
    return calculateTotalSupplyApy(pool.supplyApy, getIncentiveValues(pool, 'supply').apy);
  };

  const getTotalSupplyApr = (pool: PoolWithSpread): number | null => {
    return calculateTotalSupplyApr(pool.supplyApy, getIncentiveValues(pool, 'supply').apr);
  };

  const getTotalBorrowApy = (pool: PoolWithSpread): number | null => {
    return calculateTotalBorrowApy(pool.borrowApy, getIncentiveValues(pool, 'borrow').apy);
  };

  const getTotalBorrowApr = (pool: PoolWithSpread): number | null => {
    return calculateTotalBorrowApr(pool.borrowApy, getIncentiveValues(pool, 'borrow').apr);
  };

  // Calculate native values (already in percentage form, number type)
  const getNativeSupplyApy = (pool: PoolWithSpread): number | null => {
    return pool.supplyApy ?? null;
  };

  const getNativeBorrowApy = (pool: PoolWithSpread): number | null => {
    return pool.borrowApy ?? null;
  };

  // Calculate spread for a pool
  const getSpread = (pool: PoolWithSpread): number | null => {
    const totalSupplyApy = isApy ? getTotalSupplyApy(pool) : getTotalSupplyApr(pool);
    const totalBorrowApy = isApy ? getTotalBorrowApy(pool) : getTotalBorrowApr(pool);
    if (totalSupplyApy === null || totalBorrowApy === null) return null;
    return totalSupplyApy - totalBorrowApy;
  };

  // Sort data based on active column and its sort mode
  const sortedData = [...pools].sort((a, b) => {
    let comparison = 0;

    // Default to supply total desc when no column is selected
    const sortColumn = activeSortColumn ?? 'supply';

    if (sortColumn === 'supply') {
      // Supply sorting
      if (supplySortMode === 'native') {
        const aNative = getNativeSupplyApy(a);
        const bNative = getNativeSupplyApy(b);
        if (aNative === null && bNative === null) return 0;
        if (aNative === null) return 1;
        if (bNative === null) return -1;
        comparison = bNative - aNative;
      } else if (supplySortMode === 'incentive') {
        const aIncentive = isApy ? getIncentiveValues(a, 'supply').apy : getIncentiveValues(a, 'supply').apr;
        const bIncentive = isApy ? getIncentiveValues(b, 'supply').apy : getIncentiveValues(b, 'supply').apr;
        // Handle NaN values
        if (isNaN(aIncentive) && isNaN(bIncentive)) return 0;
        if (isNaN(aIncentive)) return 1;
        if (isNaN(bIncentive)) return -1;
        comparison = bIncentive - aIncentive;
      } else {
        // Total sorting - use totalSupplyApy (Native + Incentive)
        const aTotal = isApy ? getTotalSupplyApy(a) : getTotalSupplyApr(a);
        const bTotal = isApy ? getTotalSupplyApy(b) : getTotalSupplyApr(b);
        if (aTotal === null && bTotal === null) return 0;
        if (aTotal === null) return 1;
        if (bTotal === null) return -1;
        comparison = bTotal - aTotal;
      }
      return supplySortOrder === 'desc' ? comparison : -comparison;
    } else if (sortColumn === 'borrow') {
      // Borrow sorting
      if (borrowSortMode === 'native') {
        const aNative = getNativeBorrowApy(a);
        const bNative = getNativeBorrowApy(b);
        if (aNative === null && bNative === null) return 0;
        if (aNative === null) return 1;
        if (bNative === null) return -1;
        comparison = bNative - aNative;
      } else if (borrowSortMode === 'incentive') {
        const aIncentive = isApy ? getIncentiveValues(a, 'borrow').apy : getIncentiveValues(a, 'borrow').apr;
        const bIncentive = isApy ? getIncentiveValues(b, 'borrow').apy : getIncentiveValues(b, 'borrow').apr;
        // Handle NaN values
        if (isNaN(aIncentive) && isNaN(bIncentive)) return 0;
        if (isNaN(aIncentive)) return 1;
        if (isNaN(bIncentive)) return -1;
        comparison = bIncentive - aIncentive;
      } else {
        // Total sorting
        const aTotal = isApy ? getTotalBorrowApy(a) : getTotalBorrowApr(a);
        const bTotal = isApy ? getTotalBorrowApy(b) : getTotalBorrowApr(b);
        if (aTotal === null && bTotal === null) return 0;
        if (aTotal === null) return 1;
        if (bTotal === null) return -1;
        comparison = bTotal - aTotal;
      }
      return borrowSortOrder === 'desc' ? comparison : -comparison;
    } else {
      // Spread sorting (or default when activeSortColumn is null)
      const aSpread = getSpread(a);
      const bSpread = getSpread(b);
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
    pool: PoolWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null,
  ) => {
    e.stopPropagation();
    if (apy === null || isNaN(apy)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;
    setTooltipState({
      pool,
      type,
      position: { x: rect.left, y: rect.bottom },
      triggerCenterX,
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

  const handleRowClick = (pool: PoolWithSpread) => {
    const url = buildAaveReserveUrl({
      marketName: pool.marketName,
      tokenAddress: pool.tokenAddress,
    });
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Mobile card view with tooltip support
  const handleMobileIncentiveClick = (
    e: React.MouseEvent,
    pool: PoolWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null
  ) => {
    if (apy === null || isNaN(apy)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;
    setTooltipState({
      pool,
      type,
      position: { x: rect.left, y: rect.bottom },
      triggerCenterX,
    });
  };

  // Display data with pagination - must be before conditional returns
  const displayData = useMemo(() => 
    showAll ? sortedData : sortedData.slice(0, DEFAULT_VISIBLE_COUNT),
    [sortedData, showAll]
  );

  // Mobile card view
  if (isMobile) {
    return (
      <div className="space-y-3">
        {/* Header with sorting controls */}
        <div className="flex justify-between items-center px-[var(--ds-space-1)]">
          <h3 className="ds-text-14 font-bold text-gray-900">{pools.length} Reserves</h3>
          <div className="flex items-center gap-[var(--ds-space-2)]">
            {/* Supply sort dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSupplySortMenu(!showSupplySortMenu);
                  setShowBorrowSortMenu(false);
                }}
                className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                  activeSortColumn === 'supply'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>Supply</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSupplySortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSupplySortMenu(false)} />
                  <div className="absolute right-0 top-full mt-[var(--ds-space-1)] bg-white border border-gray-200 rounded-lg shadow-lg py-[var(--ds-space-1)] z-20 min-w-[130px]">
                    {(['total', 'native', 'incentive'] as SortMode[]).map((mode) => {
                      const isAlreadySelected = supplySortMode === mode && activeSortColumn === 'supply';
                      const getColorClass = () => {
                        if (mode === 'total') return 'text-emerald-600';
                        if (mode === 'native') return 'text-emerald-600';
                        return 'text-emerald-600';
                      };
                      return (
                        <button
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
                          className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 transition-colors flex items-center justify-between ${
                            isAlreadySelected
                              ? `${getColorClass()} font-bold bg-emerald-50`
                              : 'text-gray-600 hover:bg-gray-50'
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
                onClick={() => {
                  setShowBorrowSortMenu(!showBorrowSortMenu);
                  setShowSupplySortMenu(false);
                }}
                className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                  activeSortColumn === 'borrow'
                    ? 'bg-[#1aa3c7]/10 border-[#1aa3c7]/20 text-[#1aa3c7]'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>Borrow</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showBorrowSortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowBorrowSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-[var(--ds-space-1)] bg-white border border-gray-200 rounded-lg shadow-lg py-[var(--ds-space-1)] z-20 min-w-[130px]">
                    {(['total', 'native', 'incentive'] as SortMode[]).map((mode) => {
                      const isAlreadySelected = borrowSortMode === mode && activeSortColumn === 'borrow';
                      const getColorClass = () => {
                        if (mode === 'total') return 'text-[#1aa3c7]';
                        if (mode === 'native') return 'text-[#1aa3c7]';
                        return 'text-[#1aa3c7]';
                      };
                      return (
                        <button
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
                          className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 transition-colors flex items-center justify-between ${
                            isAlreadySelected
                              ? `${getColorClass()} font-bold bg-[#1aa3c7]/10`
                              : 'text-gray-600 hover:bg-gray-50'
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
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
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
              onClick={() => {
                if (activeSortColumn === 'supply') {
                  toggleSupplySortOrder();
                } else if (activeSortColumn === 'borrow') {
                  toggleBorrowSortOrder();
                } else {
                  toggleSpreadSortOrder();
                }
              }}
              className="ds-icon-button border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              {(activeSortColumn === 'supply' ? supplySortOrder : activeSortColumn === 'borrow' ? borrowSortOrder : spreadSortOrder) === 'desc' ? (
                <ArrowDown className="w-3.5 h-3.5 text-gray-600" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5 text-gray-600" />
              )}
            </button>
          </div>
        </div>
        
        {/* 2x2 Grid layout for mobile */}
        <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
          {(showAll ? sortedData : sortedData.slice(0, DEFAULT_VISIBLE_COUNT)).map((pool) => (
            <MobilePoolCard
              key={`${pool.marketName}-${pool.tokenAddress}`}
              pool={pool}
              isApy={isApy}
              onIncentiveClick={handleMobileIncentiveClick}
            />
          ))}
        </div>
        
        {/* Show More/Less button for mobile */}
        {sortedData.length > DEFAULT_VISIBLE_COUNT && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full mt-[var(--ds-space-4)] ds-button gap-[var(--ds-space-2)] border border-border bg-card hover:bg-muted/50 transition-colors text-foreground font-medium"
          >
            <span>{showAll ? 'Show Less' : `Show ${sortedData.length - DEFAULT_VISIBLE_COUNT} More Reserves`}</span>
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
        
        {tooltipState && (
          <IncentiveTooltip
            pool={tooltipState.pool}
            type={tooltipState.type}
            position={tooltipState.position}
            triggerCenterX={tooltipState.triggerCenterX}
            onClose={() => setTooltipState(null)}
            isApy={isApy}
          />
        )}
      </div>
    );
  }


  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
            <TableRow className="border-border/50 hover:bg-transparent bg-gray-50/50">
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
                      className={activeSortColumn === 'supply' ? 'text-emerald-600' : 'text-muted-foreground'}
                    >
                      Supply
                    </span>
                    <div className="relative">
                      <button
                        onClick={() => setShowSupplySortMenu(!showSupplySortMenu)}
                        className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                          showSupplySortMenu || activeSortColumn === 'supply'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
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
                          <div className="absolute right-0 top-full mt-[var(--ds-space-1)] bg-white border border-gray-200 rounded-lg shadow-lg py-[var(--ds-space-1)] z-20 min-w-[140px]">
                            <button
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
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-emerald-50/50 transition-colors flex items-center justify-between ${
                                supplySortMode === 'total' && activeSortColumn === 'supply'
                                  ? 'text-emerald-600 font-bold bg-emerald-50'
                                  : 'text-gray-700'
                              }`}
                            >
                              <span>Sort by Total</span>
                              {supplySortMode === 'total' && activeSortColumn === 'supply' ? (
                                supplySortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 text-emerald-600" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-gray-400" />
                              )}
                            </button>
                            <button
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
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-emerald-50/50 transition-colors flex items-center justify-between ${
                                supplySortMode === 'native' && activeSortColumn === 'supply'
                                  ? 'text-emerald-600 font-bold bg-emerald-50'
                                  : 'text-gray-700'
                              }`}
                            >
                              <span>Sort by Native</span>
                              {supplySortMode === 'native' && activeSortColumn === 'supply' ? (
                                supplySortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 text-emerald-600" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-gray-400" />
                              )}
                            </button>
                            <button
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
                              className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-emerald-50/50 transition-colors flex items-center justify-between ${
                                supplySortMode === 'incentive' && activeSortColumn === 'supply'
                                  ? 'text-emerald-600 font-bold bg-emerald-50'
                                  : 'text-gray-700'
                              }`}
                            >
                              <span>Sort by Incentive</span>
                              {supplySortMode === 'incentive' && activeSortColumn === 'supply' ? (
                                supplySortOrder === 'desc' ? (
                                  <ArrowDown className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <ArrowUp className="w-3 h-3 text-emerald-600" />
                                )
                              ) : (
                                <ArrowDown className="w-3 h-3 text-gray-400" />
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
                  onClick={() => {
                    if (activeSortColumn === 'spread') {
                      toggleSpreadSortOrder();
                    } else {
                      setActiveSortColumn('spread');
                      setSpreadSortOrder('desc');
                    }
                  }}
                  className={`ds-chip-heading md:ds-text-16 gap-[var(--ds-space-1)] transition-colors ${
                    activeSortColumn === 'spread' ? 'text-purple-600' : 'text-muted-foreground hover:text-foreground'
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
                      className={activeSortColumn === 'borrow' ? 'text-[#1aa3c7]' : 'text-muted-foreground'}
                    >
                      Borrow
                    </span>
                    <div className="relative">
                      <button
                        onClick={() => setShowBorrowSortMenu(!showBorrowSortMenu)}
                        className={`ds-chip gap-[var(--ds-space-1)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-lg border transition-colors ${
                          showBorrowSortMenu || activeSortColumn === 'borrow'
                            ? 'bg-[#1aa3c7]/10 border-[#1aa3c7]/20 text-[#1aa3c7]'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
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
                            <div className="absolute right-0 top-full mt-[var(--ds-space-1)] bg-white border border-gray-200 rounded-lg shadow-lg py-[var(--ds-space-1)] z-20 min-w-[140px]">
                              <button
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
                                className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[#1aa3c7]/10 transition-colors flex items-center justify-between ${
                                  borrowSortMode === 'total' && activeSortColumn === 'borrow'
                                    ? 'text-[#1aa3c7] font-bold bg-[#1aa3c7]/10'
                                    : 'text-gray-700'
                                }`}
                              >
                                <span>Sort by Total</span>
                                {borrowSortMode === 'total' && activeSortColumn === 'borrow' ? (
                                  borrowSortOrder === 'desc' ? (
                                    <ArrowDown className="w-3 h-3 text-[#1aa3c7]" />
                                  ) : (
                                    <ArrowUp className="w-3 h-3 text-[#1aa3c7]" />
                                  )
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-gray-400" />
                                )}
                              </button>
                              <button
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
                                className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[#1aa3c7]/10 transition-colors flex items-center justify-between ${
                                  borrowSortMode === 'native' && activeSortColumn === 'borrow'
                                    ? 'text-[#1aa3c7] font-bold bg-[#1aa3c7]/10'
                                    : 'text-gray-700'
                                }`}
                              >
                                <span>Sort by Native</span>
                                {borrowSortMode === 'native' && activeSortColumn === 'borrow' ? (
                                  borrowSortOrder === 'desc' ? (
                                    <ArrowDown className="w-3 h-3 text-[#1aa3c7]" />
                                  ) : (
                                    <ArrowUp className="w-3 h-3 text-[#1aa3c7]" />
                                  )
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-gray-400" />
                                )}
                              </button>
                              <button
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
                                className={`w-full px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-left ds-text-12 hover:bg-[#1aa3c7]/10 transition-colors flex items-center justify-between ${
                                  borrowSortMode === 'incentive' && activeSortColumn === 'borrow'
                                    ? 'text-[#1aa3c7] font-bold bg-[#1aa3c7]/10'
                                    : 'text-gray-700'
                                }`}
                              >
                                <span>Sort by Incentive</span>
                                {borrowSortMode === 'incentive' && activeSortColumn === 'borrow' ? (
                                  borrowSortOrder === 'desc' ? (
                                    <ArrowDown className="w-3 h-3 text-[#1aa3c7]" />
                                  ) : (
                                    <ArrowUp className="w-3 h-3 text-[#1aa3c7]" />
                                  )
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-gray-400" />
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
            {displayData.map((pool) => {
              const supplyIncentiveValues = getIncentiveValues(pool, 'supply');
              const borrowIncentiveValues = getIncentiveValues(pool, 'borrow');
              
              const totalSupplyApy = calculateTotalSupplyApy(pool.supplyApy, supplyIncentiveValues.apy);
              const totalSupplyApr = calculateTotalSupplyApr(pool.supplyApy, supplyIncentiveValues.apr);
              const totalBorrowApy = calculateTotalBorrowApy(pool.borrowApy, borrowIncentiveValues.apy);
              const totalBorrowApr = calculateTotalBorrowApr(pool.borrowApy, borrowIncentiveValues.apr);
              const nativeSupplyApy = getNativeSupplyApy(pool);
              const nativeBorrowApy = getNativeBorrowApy(pool);
              
              const displaySupplyTotal = isApy ? totalSupplyApy : totalSupplyApr;
              const displaySupplyNative = isApy ? nativeSupplyApy : (nativeSupplyApy !== null ? apyToApr(nativeSupplyApy) : null);
              const displayBorrowTotal = isApy ? totalBorrowApy : totalBorrowApr;
              const displayBorrowNative = isApy ? nativeBorrowApy : (nativeBorrowApy !== null ? apyToApr(nativeBorrowApy) : null);
              
              const displaySupplyIncentive = (() => {
                const incentive = isApy ? supplyIncentiveValues.apy : supplyIncentiveValues.apr;
                return incentive === 0 || isNaN(incentive) || incentive < 0.01 ? null : incentive;
              })();
              const displayBorrowIncentive = (() => {
                const incentive = isApy ? borrowIncentiveValues.apy : borrowIncentiveValues.apr;
                return incentive === 0 || isNaN(incentive) || incentive < 0.01 ? null : incentive;
              })();

              const spread = isApy
                ? calculateSpreadApy(totalSupplyApy, totalBorrowApy)
                : calculateSpreadApr(totalSupplyApr, totalBorrowApr);
              const { iconSymbol, logoURI } = fetchIconSymbolAndName({
                underlyingAsset: pool.tokenAddress,
                symbol: pool.tokenSymbol,
                name: pool.tokenName,
              });

              return (
                <TableRow
                  key={`${pool.marketName}-${pool.tokenAddress}`}
                  className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(pool)}
                >
                  {/* Token */}
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
                      <TokenIcon symbol={iconSymbol} size={28} loading="eager" logoURI={logoURI} />
                      <span className="font-semibold text-gray-900 ds-text-14">
                        {pool.tokenSymbol}
                      </span>
                    </div>
                  </TableCell>
                  {/* Market */}
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectMarket?.(pool.marketName);
                      }}
                      className="inline-flex items-center justify-center gap-[var(--ds-space-1-5)] px-[var(--ds-space-2-5)] py-[var(--ds-space-0-5)] rounded-full ds-text-11 font-medium bg-gray-100 text-gray-800 hover:bg-gray-200/70 transition-colors"
                      aria-label={`Filter by ${getMarketDisplayName(pool)} market`}
                    >
                      <ChainIcon chain={pool.chainName} />
                      {getMarketDisplayName(pool)}
                    </button>
                  </TableCell>
                  {/* Supply */}
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center">
                    <div className="flex flex-col items-center justify-center gap-[var(--ds-space-0-5)] min-h-[3.25rem]">
                      <span className={`font-bold text-emerald-500 tabular-nums ${isMobile ? 'ds-text-16' : 'ds-text-18'}`}>
                        {formatPercent(displaySupplyTotal)}
                      </span>
                      {displaySupplyIncentive !== null && (
                        <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-11 justify-center min-h-[1.25rem]">
                          <span className="text-emerald-500/70 tabular-nums">
                            {formatPercent(displaySupplyNative)}
                          </span>
                          <span className="text-gray-400">+</span>
                          <button
                            onClick={(e) =>
                              handleIncentiveClick(e, pool, 'supply', displaySupplyIncentive)
                            }
                            className="inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full bg-emerald-500/10 text-emerald-500/70 hover:bg-emerald-500/20 ring-1 ring-emerald-500/15 transition-colors cursor-pointer tabular-nums"
                          >
                            <span>{formatPercent(displaySupplyIncentive)}</span>
                            <IncentiveIcon width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} />
                          </button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {/* Spread */}
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell">
                    <span
                      className={`font-bold tabular-nums ${isMobile ? 'ds-text-16' : 'ds-text-18'} ${
                        spread !== null ? 'text-purple-500' : 'text-gray-400'
                      }`}
                    >
                      {formatSpread(spread)}
                    </span>
                  </TableCell>
                  {/* Borrow */}
                  <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center">
                    <div className="flex flex-col items-center justify-center gap-[var(--ds-space-0-5)] min-h-[3.25rem]">
                        <span className={`font-bold text-[#1aa3c7] tabular-nums ${isMobile ? 'ds-text-16' : 'ds-text-18'}`}>
                          {displayBorrowTotal !== null ? formatPercent(displayBorrowTotal) : '-'}
                        </span>
                        {displayBorrowIncentive !== null && (
                          <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-11 justify-center min-h-[1.25rem]">
                            {displayBorrowNative !== null && (
                              <>
                                <span className="text-[#1aa3c7]/70 tabular-nums">
                                  {formatPercent(displayBorrowNative)}
                                </span>
                                <span className="text-gray-400">-</span>
                              </>
                            )}
                            <button
                              onClick={(e) =>
                                handleIncentiveClick(e, pool, 'borrow', displayBorrowIncentive)
                              }
                              className="inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full bg-[#1aa3c7]/10 text-[#1aa3c7]/70 hover:bg-[#1aa3c7]/20 ring-1 ring-[#1aa3c7]/15 transition-colors cursor-pointer tabular-nums"
                            >
                              <span>{formatPercent(displayBorrowIncentive)}</span>
                              <IncentiveIcon width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} />
                            </button>
                          </div>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      
      {/* Show More/Less button for desktop */}
      {sortedData.length > DEFAULT_VISIBLE_COUNT && (
        <div className="p-[var(--ds-space-4)] border-t border-gray-200">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full ds-button gap-[var(--ds-space-2)] border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-foreground font-medium"
          >
            <span>{showAll ? 'Show Less' : `Show ${sortedData.length - DEFAULT_VISIBLE_COUNT} More Reserves`}</span>
            {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      )}
      
      {tooltipState && (
        <IncentiveTooltip
          pool={tooltipState.pool}
          type={tooltipState.type}
          position={tooltipState.position}
          triggerCenterX={tooltipState.triggerCenterX}
          onClose={() => setTooltipState(null)}
          isApy={isApy}
        />
      )}
    </div>
  );
};

export default PoolsTable;
