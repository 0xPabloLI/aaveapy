import { ArrowUpDown, ArrowUp, ArrowDown, Zap, TrendingUp, TrendingDown } from 'lucide-react';
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

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground font-semibold">Token</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Market</TableHead>
              <TableHead 
                className="text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors"
                onClick={() => onSort('totalSupplyApy')}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-success" />
                  Supply {isApy ? 'APY' : 'APR'}
                  {getSortIcon('totalSupplyApy')}
                </div>
              </TableHead>
              <TableHead 
                className="text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors"
                onClick={() => onSort('totalBorrowApy')}
              >
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-secondary" />
                  Borrow {isApy ? 'APY' : 'APR'}
                  {getSortIcon('totalBorrowApy')}
                </div>
              </TableHead>
              <TableHead 
                className="text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors"
                onClick={() => onSort('apySpread')}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-warning" />
                  Spread
                  {getSortIcon('apySpread')}
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground font-semibold text-right">Rewards</TableHead>
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
                <TableRow 
                  key={`${market.marketName}-${market.tokenSymbol}-${index}`}
                  className={`border-border/30 hover:bg-accent/30 transition-colors ${
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default MarketsTable;
