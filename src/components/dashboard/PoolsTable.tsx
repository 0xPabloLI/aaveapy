import { useState } from 'react';
import { ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
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
  calculateTotalIncentiveApy
} from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import IncentiveTooltip from './IncentiveTooltip';

interface PoolsTableProps {
  pools: PoolWithSpread[];
  sortField: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null;
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null) => void;
  isApy: boolean;
}

type SortMode = 'total' | 'native' | 'incentive';

const PoolsTable = ({ pools, sortField, sortOrder, onSort, isApy }: PoolsTableProps) => {
  const [activeSortColumn, setActiveSortColumn] = useState<'supply' | 'borrow'>('supply');
  const [supplySortMode, setSupplySortMode] = useState<SortMode>('total');
  const [supplySortOrder, setSupplySortOrder] = useState<'asc' | 'desc'>('desc');
  const [borrowSortMode, setBorrowSortMode] = useState<SortMode>('total');
  const [borrowSortOrder, setBorrowSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSupplySortMenu, setShowSupplySortMenu] = useState(false);
  const [showBorrowSortMenu, setShowBorrowSortMenu] = useState(false);
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
    const protocolAprs = type === 'supply' ? pool.supplyIncentives : pool.borrowIncentives;
    const meritAprs = type === 'supply' ? pool.meritSupplyApr : pool.meritBorrowApr;
    const meritSelfAprs = type === 'supply' ? pool.meritSelfSupply : pool.meritSelfBorrow;
    const merklApr = type === 'supply' ? pool.merklSupplyApr : pool.merklBorrowApr;
    const brevisApr = type === 'supply' ? pool.brevisSupplyApr : pool.brevisBorrowApr;
    const requirementAprs = type === 'supply'
      ? pool.meritSupplyWithBorrowRequirement
      : pool.meritBorrowWithSupplyRequirement;
    return {
      apr: calculateTotalIncentiveApr(meritAprs, merklApr, brevisApr, protocolAprs, meritSelfAprs, requirementAprs),
      apy: calculateTotalIncentiveApy(meritAprs, merklApr, brevisApr, protocolAprs, meritSelfAprs, requirementAprs),
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

  // Calculate native values (already in percentage form)
  const getNativeSupplyApy = (pool: PoolWithSpread): number | null => {
    if (pool.supplyApy === null || pool.supplyApy === undefined) return null;
    const value = parseFloat(pool.supplyApy);
    return isNaN(value) ? null : value;
  };

  const getNativeBorrowApy = (pool: PoolWithSpread): number | null => {
    if (pool.borrowApy === null || pool.borrowApy === undefined) return null;
    const value = parseFloat(pool.borrowApy);
    return isNaN(value) ? null : value;
  };

  // Sort data based on active column and its sort mode
  const sortedData = [...pools].sort((a, b) => {
    let comparison = 0;

    if (activeSortColumn === 'supply') {
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
        // Total sorting - 使用 totalSupplyApy (Native + Incentive)
        const aTotal = isApy ? getTotalSupplyApy(a) : getTotalSupplyApr(a);
        const bTotal = isApy ? getTotalSupplyApy(b) : getTotalSupplyApr(b);
        if (aTotal === null && bTotal === null) return 0;
        if (aTotal === null) return 1;
        if (bTotal === null) return -1;
        comparison = bTotal - aTotal;
      }
      return supplySortOrder === 'desc' ? comparison : -comparison;
    } else {
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
        <div className={`${size} rounded-full bg-current opacity-40 flex items-center justify-center text-[8px] font-bold`}>
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center">
        <h3 className="text-base md:text-lg font-bold text-gray-900">{pools.length} Pools</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent bg-gray-50/50">
              <TableHead className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Token
              </TableHead>
              <TableHead className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Market
              </TableHead>
              <TableHead className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="flex items-center justify-end gap-3">
                  <div className="relative flex items-center gap-1.5">
                    <button
                      onClick={() => setShowSupplySortMenu(!showSupplySortMenu)}
                      className={`flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors ${
                        showSupplySortMenu ? 'bg-gray-100 border border-blue-500' : ''
                      }`}
                      title="Select sort field"
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                      <span className="text-gray-700">
                        Supply ({supplySortLabel})
                      </span>
                    </button>
                    {showSupplySortMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowSupplySortMenu(false)}
                        />
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[160px]">
                          <button
                            onClick={() => {
                              setSupplySortMode('total');
                              setActiveSortColumn('supply');
                              setShowSupplySortMenu(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-emerald-50/50 transition-colors ${
                              supplySortMode === 'total' && activeSortColumn === 'supply'
                                ? 'text-emerald-600 font-bold bg-emerald-50'
                                : 'text-gray-700'
                            }`}
                          >
                            Sort by Total
                          </button>
                          <button
                            onClick={() => {
                              setSupplySortMode('native');
                              setActiveSortColumn('supply');
                              setShowSupplySortMenu(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${
                              supplySortMode === 'native' && activeSortColumn === 'supply'
                                ? 'text-blue-600 font-bold bg-blue-50'
                                : 'text-gray-700'
                            }`}
                          >
                            Sort by Native
                          </button>
                          <button
                            onClick={() => {
                              setSupplySortMode('incentive');
                              setActiveSortColumn('supply');
                              setShowSupplySortMenu(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-amber-50/50 transition-colors ${
                              supplySortMode === 'incentive' && activeSortColumn === 'supply'
                                ? 'text-amber-600 font-bold bg-amber-50'
                                : 'text-gray-700'
                            }`}
                          >
                            Sort by Incentive
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={toggleSupplySortOrder}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Toggle sort direction"
                  >
                    {supplySortOrder === 'desc' ? (
                      <ArrowDown className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ArrowUp className="w-4 h-4 text-emerald-500" />
                    )}
                  </button>
                </div>
              </TableHead>
              <TableHead className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="flex items-center justify-end gap-3">
                  <div className="relative flex items-center gap-1.5">
                    <button
                      onClick={() => setShowBorrowSortMenu(!showBorrowSortMenu)}
                      className={`flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors ${
                        showBorrowSortMenu ? 'bg-gray-100 border border-blue-500' : ''
                      }`}
                      title="Select sort field"
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                      <span className="text-gray-700">
                        Borrow ({borrowSortLabel})
                      </span>
                    </button>
                    {showBorrowSortMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowBorrowSortMenu(false)}
                        />
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[160px]">
                          <button
                            onClick={() => {
                              setBorrowSortMode('total');
                              setActiveSortColumn('borrow');
                              setShowBorrowSortMenu(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                              borrowSortMode === 'total' && activeSortColumn === 'borrow'
                                ? 'text-gray-900 font-bold bg-gray-200'
                                : 'text-gray-700'
                            }`}
                          >
                            Sort by Total
                          </button>
                          <button
                            onClick={() => {
                              setBorrowSortMode('native');
                              setActiveSortColumn('borrow');
                              setShowBorrowSortMenu(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${
                              borrowSortMode === 'native' && activeSortColumn === 'borrow'
                                ? 'text-blue-600 font-bold bg-blue-50'
                                : 'text-gray-700'
                            }`}
                          >
                            Sort by Native
                          </button>
                          <button
                            onClick={() => {
                              setBorrowSortMode('incentive');
                              setActiveSortColumn('borrow');
                              setShowBorrowSortMenu(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-amber-50/50 transition-colors ${
                              borrowSortMode === 'incentive' && activeSortColumn === 'borrow'
                                ? 'text-amber-600 font-bold bg-amber-50'
                                : 'text-gray-700'
                            }`}
                          >
                            Sort by Incentive
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={toggleBorrowSortOrder}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Toggle sort direction"
                  >
                    {borrowSortOrder === 'desc' ? (
                      <ArrowDown className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ArrowUp className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
              </TableHead>
              <TableHead className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 hidden md:table-cell">
                <div className="flex items-center justify-end gap-1">
                  SPREAD
                  <ArrowDown className="w-3 h-3" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((pool, idx) => {
              const totalSupplyApy = getTotalSupplyApy(pool);
              const totalSupplyApr = getTotalSupplyApr(pool);
              const totalBorrowApy = getTotalBorrowApy(pool);
              const totalBorrowApr = getTotalBorrowApr(pool);
              const nativeSupplyApy = getNativeSupplyApy(pool);
              const nativeBorrowApy = getNativeBorrowApy(pool);
              
              const displaySupplyTotal = isApy ? totalSupplyApy : totalSupplyApr;
              const displaySupplyNative = nativeSupplyApy;
              // Helper to get display incentive value (returns null if invalid)
              const getDisplayIncentive = (type: 'supply' | 'borrow') => {
                const incentive = isApy ? getIncentiveValues(pool, type).apy : getIncentiveValues(pool, type).apr;
                return incentive === 0 || isNaN(incentive) || incentive < 0.01 ? null : incentive;
              };

              const displaySupplyIncentive = getDisplayIncentive('supply');
              const displayBorrowTotal = isApy ? totalBorrowApy : totalBorrowApr;
              const displayBorrowNative = nativeBorrowApy;
              const displayBorrowIncentive = getDisplayIncentive('borrow');

              const spread = isApy
                ? calculateSpreadApy(totalSupplyApy, totalBorrowApy)
                : calculateSpreadApr(totalSupplyApr, totalBorrowApr);

              return (
                <TableRow
                  key={idx}
                  className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(pool)}
                >
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                        {pool.tokenSymbol[0]}
                      </div>
                      <span className="font-semibold text-gray-900">
                        {pool.tokenSymbol}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <ChainIcon chain={pool.chainName} />
                      {getMarketDisplayName(pool)}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-emerald-500 text-base">
                        {formatPercent(displaySupplyTotal)}
                      </span>
                      {displaySupplyIncentive !== null && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-blue-600 font-semibold">
                            {formatPercent(displaySupplyNative)}
                          </span>
                          <span className="text-gray-400">+</span>
                          <button
                            onClick={(e) =>
                              handleIncentiveClick(e, pool, 'supply', displaySupplyIncentive)
                            }
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            <IncentiveIcon width={12} height={12} />
                            {formatPercent(displaySupplyIncentive)}
                          </button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-gray-900 text-base">
                        {displayBorrowTotal !== null ? formatPercent(displayBorrowTotal) : '-'}
                      </span>
                      {displayBorrowIncentive !== null && (
                        <div className="flex items-center gap-1.5 text-xs">
                          {displayBorrowNative !== null && (
                            <>
                              <span className="text-blue-600 font-semibold">
                                {formatPercent(displayBorrowNative)}
                              </span>
                              <span className="text-gray-400">-</span>
                            </>
                          )}
                          <button
                            onClick={(e) =>
                              handleIncentiveClick(e, pool, 'borrow', displayBorrowIncentive)
                            }
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            <IncentiveIcon width={12} height={12} />
                            {formatPercent(displayBorrowIncentive)}
                          </button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-right hidden md:table-cell">
                    <span
                      className={`font-bold ${
                        spread !== null && spread >= 0
                          ? 'text-amber-500'
                          : 'text-rose-500'
                      }`}
                    >
                      {formatSpread(spread)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
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
