import { ArrowUpDown, ArrowUp, ArrowDown, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
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
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-muted-foreground" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-secondary" />
      : <ArrowDown className="w-4 h-4 text-secondary" />;
  };

  const getMarketDisplayName = (market: MarketWithSpread) => {
    if (market.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[market.marketName]) {
      return ETHEREUM_MARKET_NAMES[market.marketName];
    }
    return market.chainName;
  };

  const headerColumns = [
    { key: 'token', label: 'Token', sortable: false },
    { key: 'market', label: 'Market', sortable: false },
    { key: 'supply', label: `Supply ${isApy ? 'APY' : 'APR'}`, sortable: true, field: 'totalSupplyApy' as SortField, icon: TrendingUp, iconColor: 'text-success' },
    { key: 'borrow', label: `Borrow ${isApy ? 'APY' : 'APR'}`, sortable: true, field: 'totalBorrowApy' as SortField, icon: TrendingDown, iconColor: 'text-secondary' },
    { key: 'spread', label: 'Spread', sortable: true, field: 'apySpread' as SortField, icon: Zap, iconColor: 'text-warning' },
    { key: 'rewards', label: 'Rewards', sortable: false, align: 'right' },
  ];

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              {headerColumns.map((col, index) => (
                <motion.th
                  key={col.key}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.3, 
                    delay: index * 0.05,
                    ease: [0.25, 0.1, 0.25, 1]
                  }}
                  className={`h-10 px-2 text-left align-middle font-semibold text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] ${
                    col.sortable ? 'cursor-pointer hover:text-foreground transition-colors' : ''
                  } ${col.align === 'right' ? 'text-right' : ''}`}
                  onClick={col.sortable && col.field ? () => onSort(col.field!) : undefined}
                >
                  {col.sortable && col.icon ? (
                    <div className="flex items-center gap-2">
                      <col.icon className={`w-4 h-4 ${col.iconColor}`} />
                      {col.label}
                      {getSortIcon(col.field!)}
                    </div>
                  ) : (
                    col.label
                  )}
                </motion.th>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {markets.map((market, index) => {
              const displaySupply = isApy 
                ? market.totalSupplyApy 
                : apyToApr(market.totalSupplyApy);
              
              const displayBorrow = market.totalBorrowApy !== null
                ? (isApy ? market.totalBorrowApy : apyToApr(market.totalBorrowApy))
                : null;

              const isLoopingOpportunity = market.apySpread !== null && market.apySpread < 0;

              return (
                <motion.tr
                  key={`${market.marketName}-${market.tokenSymbol}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ 
                    duration: 0.3, 
                    delay: Math.min(index * 0.03, 0.5),
                    ease: [0.25, 0.1, 0.25, 1]
                  }}
                  className={`border-b border-border/30 hover:bg-accent/30 transition-colors ${
                    isLoopingOpportunity ? 'bg-warning/5' : ''
                  }`}
                >
                  {/* Token */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-sm font-bold gradient-text">
                        {market.tokenSymbol.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{market.tokenSymbol}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {market.tokenName}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Market */}
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className="bg-secondary/10 text-secondary border-secondary/30"
                    >
                      {getMarketDisplayName(market)}
                    </Badge>
                  </TableCell>

                  {/* Supply APY */}
                  <TableCell>
                    <span className="text-success font-semibold text-lg">
                      {formatPercent(displaySupply)}
                    </span>
                  </TableCell>

                  {/* Borrow APY */}
                  <TableCell>
                    <span className="text-secondary font-semibold text-lg">
                      {displayBorrow !== null ? formatPercent(displayBorrow) : '-'}
                    </span>
                  </TableCell>

                  {/* Spread */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isLoopingOpportunity && (
                        <Zap className="w-4 h-4 text-warning animate-pulse" />
                      )}
                      <span className={`font-semibold ${
                        market.apySpread !== null && market.apySpread < 0 
                          ? 'text-warning' 
                          : 'text-success'
                      }`}>
                        {formatSpread(market.apySpread)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Rewards */}
                  <TableCell className="text-right">
                    <div className="text-xs text-muted-foreground">
                      {market.totalIncentiveSupplyApy > 0 && (
                        <span className="text-success">
                          +{formatPercent(market.totalIncentiveSupplyApy)}
                        </span>
                      )}
                      {market.totalIncentiveSupplyApy > 0 && market.totalIncentiveBorrowApy > 0 && ' / '}
                      {market.totalIncentiveBorrowApy > 0 && (
                        <span className="text-secondary">
                          -{formatPercent(market.totalIncentiveBorrowApy)}
                        </span>
                      )}
                      {market.totalIncentiveSupplyApy === 0 && market.totalIncentiveBorrowApy === 0 && '-'}
                    </div>
                </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default MarketsTable;
