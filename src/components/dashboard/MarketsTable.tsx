import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Zap, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MarketWithSpread, SortField, SortOrder, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { formatPercent, formatSpread, apyToApr } from '@/lib/formatters';

interface MarketsTableProps {
  markets: MarketWithSpread[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  isApy: boolean;
}

const MarketsTable = ({ markets, sortField, sortOrder, onSort, isApy }: MarketsTableProps) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-muted-foreground" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-secondary" />
      : <ArrowDown className="w-3 h-3 text-secondary" />;
  };

  const getMarketDisplayName = (market: MarketWithSpread) => {
    if (market.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[market.marketName]) {
      return ETHEREUM_MARKET_NAMES[market.marketName];
    }
    return market.chainName;
  };

  const headerColumns = [
    { key: 'token', label: 'Token', sortable: false, hideOnMobile: false },
    { key: 'market', label: 'Market', sortable: false, hideOnMobile: true },
    { key: 'supply', label: `Supply`, sortable: true, field: 'totalSupplyApy' as SortField, icon: TrendingUp, iconColor: 'text-success', hideOnMobile: false },
    { key: 'borrow', label: `Borrow`, sortable: true, field: 'totalBorrowApy' as SortField, icon: TrendingDown, iconColor: 'text-secondary', hideOnMobile: false },
    { key: 'spread', label: 'Spread', sortable: true, field: 'apySpread' as SortField, icon: Zap, iconColor: 'text-warning', hideOnMobile: true },
    { key: 'expand', label: '', sortable: false, hideOnMobile: false, mobileOnly: true },
  ];

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              {headerColumns.map((col, index) => {
                if (col.mobileOnly) {
                  return (
                    <th key={col.key} className="w-8 md:hidden" />
                  );
                }
                return (
                  <motion.th
                    key={col.key}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.3, 
                      delay: index * 0.05,
                      ease: [0.25, 0.1, 0.25, 1]
                    }}
                    className={`h-10 px-2 text-left align-middle font-semibold text-muted-foreground text-xs ${
                      col.sortable ? 'cursor-pointer hover:text-foreground transition-colors' : ''
                    } ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                    onClick={col.sortable && col.field ? () => onSort(col.field!) : undefined}
                  >
                    {col.sortable && col.icon ? (
                      <div className="flex items-center gap-1">
                        <col.icon className={`w-3 h-3 ${col.iconColor}`} />
                        <span>{col.label}</span>
                        {getSortIcon(col.field!)}
                      </div>
                    ) : (
                      col.label
                    )}
                  </motion.th>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {markets.map((market, index) => {
              const rowKey = `${market.marketName}-${market.tokenSymbol}-${index}`;
              const isExpanded = expandedRows.has(rowKey);
              
              const displaySupply = isApy 
                ? market.totalSupplyApy 
                : apyToApr(market.totalSupplyApy);
              
              const displayBorrow = market.totalBorrowApy !== null
                ? (isApy ? market.totalBorrowApy : apyToApr(market.totalBorrowApy))
                : null;

              const isLoopingOpportunity = market.apySpread !== null && market.apySpread < 0;

              return (
                <motion.tr
                  key={rowKey}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ 
                    duration: 0.3, 
                    delay: Math.min(index * 0.02, 0.4),
                    ease: [0.25, 0.1, 0.25, 1]
                  }}
                  className={`border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer md:cursor-default ${
                    isLoopingOpportunity ? 'bg-warning/5' : ''
                  }`}
                  onClick={() => {
                    // Only toggle on mobile
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
                      className="bg-secondary/10 text-secondary border-secondary/30 text-xs"
                    >
                      {getMarketDisplayName(market)}
                    </Badge>
                  </TableCell>

                  {/* Supply APY */}
                  <TableCell className="py-2 px-2">
                    <span className="text-success font-semibold text-sm">
                      {formatPercent(displaySupply)}
                    </span>
                  </TableCell>

                  {/* Borrow APY */}
                  <TableCell className="py-2 px-2">
                    <span className="text-secondary font-semibold text-sm">
                      {displayBorrow !== null ? formatPercent(displayBorrow) : '-'}
                    </span>
                  </TableCell>

                  {/* Spread - hidden on mobile */}
                  <TableCell className="hidden md:table-cell py-2 px-2">
                    <div className="flex items-center gap-1">
                      {isLoopingOpportunity && (
                        <Zap className="w-3 h-3 text-warning animate-pulse" />
                      )}
                      <span className={`font-semibold text-sm ${
                        market.apySpread !== null && market.apySpread < 0 
                          ? 'text-warning' 
                          : 'text-muted-foreground'
                      }`}>
                        {formatSpread(market.apySpread)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Expand indicator - mobile only */}
                  <TableCell className="md:hidden py-2 px-1 w-8">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </motion.tr>
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
            const isLoopingOpportunity = displaySpread !== null && displaySpread < 0;

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
                      className="bg-secondary/10 text-secondary border-secondary/30 text-xs"
                    >
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
                      <span className="text-success">+{formatPercent(market.totalIncentiveSupplyApy)}</span>
                    </div>
                  )}
                  {market.totalIncentiveBorrowApy > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Borrow Rewards</span>
                      <span className="text-secondary">-{formatPercent(market.totalIncentiveBorrowApy)}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MarketsTable;