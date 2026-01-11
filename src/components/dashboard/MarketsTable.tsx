import { useState } from 'react';
import { ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MarketWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { formatPercent, formatSpread, apyToApr } from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { IncentiveIcon } from '@/components/IncentiveIcon';

interface MarketsTableProps {
  markets: MarketWithSpread[];
  sortField: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null;
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null) => void;
  isApy: boolean;
}

type SortMode = 'total' | 'native' | 'incentive';

const MarketsTable = ({ markets, sortField, sortOrder, onSort, isApy }: MarketsTableProps) => {
  const [activeSortColumn, setActiveSortColumn] = useState<'supply' | 'borrow'>('supply');
  const [supplySortMode, setSupplySortMode] = useState<SortMode>('total');
  const [supplySortOrder, setSupplySortOrder] = useState<'asc' | 'desc'>('desc');
  const [borrowSortMode, setBorrowSortMode] = useState<SortMode>('total');
  const [borrowSortOrder, setBorrowSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSupplySortMenu, setShowSupplySortMenu] = useState(false);
  const [showBorrowSortMenu, setShowBorrowSortMenu] = useState(false);
  const [incentiveTooltip, setIncentiveTooltip] = useState<{
    show: boolean;
    x: number;
    y: number;
    token: string;
    market: string;
    apy: number;
  } | null>(null);

  const getMarketDisplayName = (market: MarketWithSpread) => {
    if (market.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[market.marketName]) {
      return ETHEREUM_MARKET_NAMES[market.marketName];
    }
    return market.chainName;
  };

  // Calculate native APY (total - incentive)
  const getNativeSupplyApy = (market: MarketWithSpread): number => {
    return market.totalSupplyApy - market.totalIncentiveSupplyApy;
  };

  const getNativeBorrowApy = (market: MarketWithSpread): number | null => {
    if (market.totalBorrowApy === null) return null;
    return market.totalBorrowApy - market.totalIncentiveBorrowApy;
  };

  // Sort data based on active column and its sort mode
  const sortedData = [...markets].sort((a, b) => {
    let comparison = 0;

    if (activeSortColumn === 'supply') {
      // Supply sorting
      if (supplySortMode === 'native') {
        const aNative = getNativeSupplyApy(a);
        const bNative = getNativeSupplyApy(b);
        comparison = bNative - aNative;
      } else if (supplySortMode === 'incentive') {
        comparison = b.totalIncentiveSupplyApy - a.totalIncentiveSupplyApy;
      } else {
        comparison = b.totalSupplyApy - a.totalSupplyApy;
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
        if (a.totalIncentiveBorrowApy === null && b.totalIncentiveBorrowApy === null) return 0;
        if (a.totalIncentiveBorrowApy === null) return 1;
        if (b.totalIncentiveBorrowApy === null) return -1;
        comparison = b.totalIncentiveBorrowApy - a.totalIncentiveBorrowApy;
      } else {
        if (a.totalBorrowApy === null && b.totalBorrowApy === null) return 0;
        if (a.totalBorrowApy === null) return 1;
        if (b.totalBorrowApy === null) return -1;
        comparison = b.totalBorrowApy - a.totalBorrowApy;
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
    token: string,
    market: string,
    apy: number,
  ) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setIncentiveTooltip({
      show: true,
      x: rect.left,
      y: rect.bottom + 8,
      token,
      market,
      apy,
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">{markets.length} markets</h3>
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
            {sortedData.map((row, idx) => {
              const nativeSupplyApy = getNativeSupplyApy(row);
              const nativeBorrowApy = getNativeBorrowApy(row);
              
              const displaySupplyTotal = isApy
                ? row.totalSupplyApy
                : apyToApr(row.totalSupplyApy);
              const displaySupplyNative = isApy
                ? nativeSupplyApy
                : apyToApr(nativeSupplyApy);
              const displaySupplyIncentive = isApy
                ? row.totalIncentiveSupplyApy
                : apyToApr(row.totalIncentiveSupplyApy);

              const displayBorrowTotal = row.totalBorrowApy !== null
                ? (isApy ? row.totalBorrowApy : apyToApr(row.totalBorrowApy))
                : null;
              const displayBorrowNative = nativeBorrowApy !== null
                ? (isApy ? nativeBorrowApy : apyToApr(nativeBorrowApy))
                : null;
              const displayBorrowIncentive = row.totalIncentiveBorrowApy !== null
                ? (isApy ? row.totalIncentiveBorrowApy : apyToApr(row.totalIncentiveBorrowApy))
                : null;

              return (
                <TableRow
                  key={idx}
                  className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                >
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                        {row.tokenSymbol[0]}
                      </div>
                      <span className="font-semibold text-gray-900">
                        {row.tokenSymbol}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {getMarketDisplayName(row)}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-emerald-500 text-base">
                        {formatPercent(displaySupplyTotal)}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-blue-600 font-semibold">
                          {formatPercent(displaySupplyNative)}
                        </span>
                        <span className="text-gray-400">+</span>
                        <button
                          onClick={(e) =>
                            handleIncentiveClick(
                              e,
                              row.tokenSymbol,
                              getMarketDisplayName(row),
                              row.totalIncentiveSupplyApy,
                            )
                          }
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                        >
                          <IncentiveIcon width={12} height={12} />
                          {formatPercent(displaySupplyIncentive)}
                        </button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-gray-900 text-base">
                        {displayBorrowTotal !== null ? formatPercent(displayBorrowTotal) : '-'}
                      </span>
                      {displayBorrowTotal !== null && displayBorrowNative !== null && displayBorrowIncentive !== null && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-blue-600 font-semibold">
                            {formatPercent(displayBorrowNative)}
                          </span>
                          <span className="text-gray-400">+</span>
                          <button
                            onClick={(e) =>
                              handleIncentiveClick(
                                e,
                                row.tokenSymbol,
                                getMarketDisplayName(row),
                                row.totalIncentiveBorrowApy,
                              )
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
                        row.apySpread !== null && row.apySpread >= 0
                          ? 'text-amber-500'
                          : 'text-rose-500'
                      }`}
                    >
                      {formatSpread(row.apySpread)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {incentiveTooltip?.show && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIncentiveTooltip(null)}
          />
          <div
            className="fixed z-40 bg-white border border-gray-200 rounded-lg shadow-xl p-4 max-w-xs"
            style={{
              left: `${incentiveTooltip.x}px`,
              top: `${incentiveTooltip.y}px`,
            }}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <IncentiveIcon width={20} height={20} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 text-sm mb-1">
                  Incentive APY
                </h4>
                <p className="text-xs text-gray-600 mb-2">
                  {incentiveTooltip.token} on {incentiveTooltip.market}
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Rate:</span>
                    <span className="font-bold text-amber-600">
                      {formatPercent(incentiveTooltip.apy)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Source:</span>
                    <span className="font-medium text-gray-700">
                      Protocol Rewards
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Duration:</span>
                    <span className="font-medium text-gray-700">30 days</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                  Incentive APY is temporary and subject to change based on
                  protocol emissions.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MarketsTable;
