import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Zap, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MarketWithSpread, SortField, SortOrder, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { formatPercent, formatSpread, apyToApr } from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import IncentiveTooltip from './IncentiveTooltip';

interface MarketsTableProps {
  markets: MarketWithSpread[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  isApy: boolean;
}

interface TooltipState {
  market: MarketWithSpread;
  type: 'supply' | 'borrow';
  position: { x: number; y: number };
}

const MarketsTable = ({ markets, sortField, sortOrder, onSort, isApy }: MarketsTableProps) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);
  const [showSortMenu, setShowSortMenu] = useState<'supply' | 'borrow' | null>(null);

  const toggleRow = (rowKey: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };

  const handleIncentiveClick = (
    e: React.MouseEvent, 
    market: MarketWithSpread, 
    type: 'supply' | 'borrow'
  ) => {
    e.stopPropagation();
    setTooltipState({
      market,
      type,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const getMarketDisplayName = (market: MarketWithSpread) => {
    if (market.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[market.marketName]) {
      return ETHEREUM_MARKET_NAMES[market.marketName];
    }
    return market.chainName;
  };

  const ChainIcon = ({ chain, className = "" }: { chain: string; className?: string }) => {
    const size = "w-3.5 h-3.5";
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

  const IncentiveIcon = ({ className = "" }: { className?: string }) => (
    <Star className={className} fill="currentColor" />
  );

  // Calculate native APY (total - incentive)
  const getNativeApy = (market: MarketWithSpread, type: 'supply' | 'borrow') => {
    if (type === 'supply') {
      return market.totalSupplyApy - market.totalIncentiveSupplyApy;
    }
    if (market.totalBorrowApy === null) return null;
    return market.totalBorrowApy - market.totalIncentiveBorrowApy;
  };

  // Render APY cell with three-color system
  const renderApyCell = (
    market: MarketWithSpread, 
    type: 'supply' | 'borrow',
    totalValue: number | null,
    incentiveValue: number
  ) => {
    if (totalValue === null) {
      return <span className="text-muted-foreground">-</span>;
    }

    const displayTotal = isApy ? totalValue : apyToApr(totalValue);
    const nativeApy = type === 'supply' 
      ? market.totalSupplyApy - market.totalIncentiveSupplyApy
      : (market.totalBorrowApy ?? 0) - market.totalIncentiveBorrowApy;
    const displayNative = isApy ? nativeApy : apyToApr(nativeApy);
    const displayIncentive = isApy ? incentiveValue : apyToApr(incentiveValue);

    const hasIncentive = incentiveValue > 0;
    const colorClass = type === 'supply' ? 'text-emerald-500' : 'text-blue-500';

    return (
      <div className="flex flex-col items-end gap-0.5">
        {/* Total APY - large, colored */}
        <span className={`font-bold ${colorClass} text-sm`}>
          {formatPercent(displayTotal)}
        </span>
        {/* Native + Incentive breakdown */}
        {hasIncentive && (
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-blue-500 font-medium">
              {formatPercent(displayNative)}
            </span>
            <span className="text-muted-foreground">+</span>
            <button
              onClick={(e) => handleIncentiveClick(e, market, type)}
              className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium hover:bg-amber-500/20 transition-colors cursor-pointer"
            >
              <IncentiveIcon className="w-2.5 h-2.5" />
              {formatPercent(displayIncentive)}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Sort header with dropdown
  const renderSortHeader = (
    field: SortField,
    label: string,
    icon: React.ReactNode,
    menuKey: 'supply' | 'borrow'
  ) => {
    const isActive = sortField === field;
    const colorClass = menuKey === 'supply' ? 'text-emerald-500' : 'text-blue-500';

    return (
      <div className="flex items-center justify-end gap-3">
        {/* Sort field dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(showSortMenu === menuKey ? null : menuKey)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-xs font-medium ${
              isActive ? `${colorClass} bg-accent` : 'hover:bg-accent text-muted-foreground hover:text-foreground'
            }`}
          >
            {icon}
            <ChevronDown className="w-3 h-3" />
            <span>{label} (Total)</span>
          </button>
          
          {showSortMenu === menuKey && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowSortMenu(null)}
              />
              <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                <button
                  onClick={() => { onSort(field); setShowSortMenu(null); }}
                  className="w-full px-3 py-1.5 text-left text-xs font-bold transition-colors text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20"
                >
                  Sort by Total
                </button>
                <button
                  onClick={() => { onSort(field); setShowSortMenu(null); }}
                  className="w-full px-3 py-1.5 text-left text-xs font-bold transition-colors text-blue-500 bg-blue-500/10 hover:bg-blue-500/20"
                >
                  Sort by Native
                </button>
                <button
                  onClick={() => { onSort(field); setShowSortMenu(null); }}
                  className="w-full px-3 py-1.5 text-left text-xs font-bold transition-colors text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                >
                  Sort by Incentive
                </button>
              </div>
            </>
          )}
        </div>
        
        {/* Sort direction arrow - separate */}
        <button
          onClick={() => onSort(field)}
          className={`p-1.5 rounded transition-colors ${
            isActive ? 'bg-accent' : 'hover:bg-accent'
          }`}
          title="Toggle sort direction"
        >
          {isActive ? (
            sortOrder === 'desc' ? (
              <ArrowDown className={`w-4 h-4 ${colorClass}`} />
            ) : (
              <ArrowUp className={`w-4 h-4 ${colorClass}`} />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              {/* Token */}
              <TableHead className="h-10 px-2 text-left align-middle font-semibold text-muted-foreground text-xs">
                Token
              </TableHead>
              
              {/* Market - hidden on mobile */}
              <TableHead className="hidden md:table-cell h-10 px-2 text-left align-middle font-semibold text-muted-foreground text-xs">
                Market
              </TableHead>
              
              {/* Spread - moved before Supply/Borrow, hidden on mobile */}
              <TableHead 
                className="hidden md:table-cell h-10 px-2 text-right align-middle font-semibold text-muted-foreground text-xs cursor-pointer hover:text-foreground transition-colors"
                onClick={() => onSort('apySpread')}
              >
                <div className="flex items-center justify-end gap-1">
                  <Zap className="w-3 h-3 text-warning" />
                  <span>Spread</span>
                  {sortField === 'apySpread' ? (
                    sortOrder === 'desc' ? (
                      <ArrowDown className="w-3 h-3 text-warning" />
                    ) : (
                      <ArrowUp className="w-3 h-3 text-warning" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3" />
                  )}
                </div>
              </TableHead>

              {/* Supply */}
              <TableHead className="h-10 px-2 text-right align-middle font-semibold text-muted-foreground text-xs">
                {renderSortHeader(
                  'totalSupplyApy',
                  'Supply',
                  <TrendingUp className="w-3 h-3" />,
                  'supply'
                )}
              </TableHead>

              {/* Borrow */}
              <TableHead className="h-10 px-2 text-right align-middle font-semibold text-muted-foreground text-xs">
                {renderSortHeader(
                  'totalBorrowApy',
                  'Borrow',
                  <TrendingDown className="w-3 h-3" />,
                  'borrow'
                )}
              </TableHead>

              {/* Expand indicator - mobile only */}
              <th className="w-8 md:hidden" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {markets.map((market, index) => {
              const rowKey = `${market.marketName}-${market.tokenSymbol}-${index}`;
              const isExpanded = expandedRows.has(rowKey);
              const isLoopingOpportunity = market.apySpread !== null && market.apySpread > 0;

              return (
                <TableRow
                  key={rowKey}
                  className="border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer md:cursor-default"
                  onClick={() => {
                    if (window.innerWidth < 768) {
                      toggleRow(rowKey);
                    }
                  }}
                >
                  {/* Token */}
                  <TableCell className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-xs font-bold gradient-text flex-shrink-0">
                        {market.tokenSymbol.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{market.tokenSymbol}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[100px]">
                          {market.tokenName}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Market - hidden on mobile */}
                  <TableCell className="hidden md:table-cell py-2 px-2">
                    <Badge 
                      variant="outline" 
                      className="bg-secondary/10 text-secondary border-secondary/30 text-xs inline-flex items-center gap-1"
                    >
                      <ChainIcon chain={market.chainName} />
                      {getMarketDisplayName(market)}
                    </Badge>
                  </TableCell>

                  {/* Spread - moved before Supply/Borrow, hidden on mobile */}
                  <TableCell className="hidden md:table-cell py-2 px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isLoopingOpportunity && (
                        <Zap className="w-3 h-3 text-warning animate-pulse" />
                      )}
                      <span className={`font-semibold text-sm ${
                        market.apySpread !== null && market.apySpread > 0 
                          ? 'text-warning' 
                          : 'text-muted-foreground'
                      }`}>
                        {formatSpread(market.apySpread)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Supply APY */}
                  <TableCell className="py-2 px-2 text-right">
                    {renderApyCell(
                      market, 
                      'supply', 
                      market.totalSupplyApy, 
                      market.totalIncentiveSupplyApy
                    )}
                  </TableCell>

                  {/* Borrow APY */}
                  <TableCell className="py-2 px-2 text-right">
                    {renderApyCell(
                      market, 
                      'borrow', 
                      market.totalBorrowApy, 
                      market.totalIncentiveBorrowApy
                    )}
                  </TableCell>

                  {/* Expand indicator - mobile only */}
                  <TableCell className="md:hidden py-2 px-1 w-8">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Expanded details for mobile */}
        <AnimatePresence>
          {markets.map((market, index) => {
            const rowKey = `${market.marketName}-${market.tokenSymbol}-${index}`;
            const isExpanded = expandedRows.has(rowKey);
            
            if (!isExpanded) return null;

            const displaySpread = market.apySpread;
            const isLoopingOpportunity = displaySpread !== null && displaySpread > 0;

            return (
              <motion.div
                key={`${rowKey}-expanded`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="md:hidden bg-accent/20 border-b border-border/30 overflow-hidden"
              >
                <div className="px-4 py-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Market</span>
                    <Badge 
                      variant="outline" 
                      className="bg-secondary/10 text-secondary border-secondary/30 text-xs inline-flex items-center gap-1"
                    >
                      <ChainIcon chain={market.chainName} />
                      {getMarketDisplayName(market)}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Spread</span>
                    <div className="flex items-center gap-1">
                      {isLoopingOpportunity && (
                        <Zap className="w-3 h-3 text-warning" />
                      )}
                      <span className={`font-semibold ${
                        isLoopingOpportunity ? 'text-warning' : 'text-muted-foreground'
                      }`}>
                        {formatSpread(displaySpread)}
                      </span>
                    </div>
                  </div>
                  {market.totalIncentiveSupplyApy > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Supply Rewards</span>
                      <span className="text-amber-500">+{formatPercent(market.totalIncentiveSupplyApy)}</span>
                    </div>
                  )}
                  {market.totalIncentiveBorrowApy > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Borrow Rewards</span>
                      <span className="text-amber-500">-{formatPercent(market.totalIncentiveBorrowApy)}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Incentive Tooltip */}
      {tooltipState && (
        <IncentiveTooltip
          market={tooltipState.market}
          type={tooltipState.type}
          position={tooltipState.position}
          onClose={() => setTooltipState(null)}
        />
      )}
    </div>
  );
};

export default MarketsTable;
