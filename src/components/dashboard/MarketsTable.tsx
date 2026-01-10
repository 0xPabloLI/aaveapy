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

// Mobile card component for better mobile display
const MobileMarketCard = ({ market, isApy }: { market: MarketWithSpread; isApy: boolean }) => {
  const displaySupply = isApy 
    ? market.totalSupplyApy 
    : apyToApr(market.totalSupplyApy);
  
  const displayBorrow = market.totalBorrowApy !== null
    ? (isApy ? market.totalBorrowApy : apyToApr(market.totalBorrowApy))
    : null;

  const isLoopingOpportunity = market.apySpread !== null && market.apySpread > 0;

  const getMarketDisplayName = () => {
    if (market.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[market.marketName]) {
      return ETHEREUM_MARKET_NAMES[market.marketName];
    }
    return market.chainName;
  };

  return (
    <div className="glass-card rounded-lg p-3 space-y-2.5">
      {/* Header: Token info + Market badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-xs font-bold gradient-text flex-shrink-0">
            {market.tokenSymbol.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">{market.tokenSymbol}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[120px]">
              {market.tokenName}
            </p>
          </div>
        </div>
        <Badge 
          variant="outline" 
          className="bg-secondary/10 text-secondary border-secondary/30 text-[10px] px-1.5 py-0.5"
        >
          {getMarketDisplayName()}
        </Badge>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* Supply */}
        <div className="bg-background/50 rounded-md p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp className="w-2.5 h-2.5 text-success" />
            <span className="text-[10px] text-muted-foreground">Supply</span>
          </div>
          <span className="text-success font-bold text-sm">
            {formatPercent(displaySupply)}
          </span>
        </div>

        {/* Borrow */}
        <div className="bg-background/50 rounded-md p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingDown className="w-2.5 h-2.5 text-secondary" />
            <span className="text-[10px] text-muted-foreground">Borrow</span>
          </div>
          <span className="text-secondary font-bold text-sm">
            {displayBorrow !== null ? formatPercent(displayBorrow) : '-'}
          </span>
        </div>

        {/* Spread */}
        <div className="bg-background/50 rounded-md p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Zap className={`w-2.5 h-2.5 ${isLoopingOpportunity ? 'text-warning' : 'text-muted-foreground'}`} />
            <span className="text-[10px] text-muted-foreground">Spread</span>
          </div>
          <span className={`font-bold text-sm ${isLoopingOpportunity ? 'text-warning' : 'text-muted-foreground'}`}>
            {formatSpread(market.apySpread)}
          </span>
        </div>
      </div>

      {/* Rewards row (if any) */}
      {(market.totalIncentiveSupplyApy > 0 || market.totalIncentiveBorrowApy > 0) && (
        <div className="flex items-center gap-3 pt-1 border-t border-border/30">
          {market.totalIncentiveSupplyApy > 0 && (
            <span className="text-[10px] text-success">
              +{formatPercent(market.totalIncentiveSupplyApy)} rewards
            </span>
          )}
          {market.totalIncentiveBorrowApy > 0 && (
            <span className="text-[10px] text-secondary">
              -{formatPercent(market.totalIncentiveBorrowApy)} rebate
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const MarketsTable = ({ markets, sortField, sortOrder, onSort, isApy }: MarketsTableProps) => {
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
    { key: 'token', label: 'Token', sortable: false },
    { key: 'market', label: 'Market', sortable: false },
    { key: 'supply', label: 'Supply', sortable: true, field: 'totalSupplyApy' as SortField, icon: TrendingUp, iconColor: 'text-success' },
    { key: 'borrow', label: 'Borrow', sortable: true, field: 'totalBorrowApy' as SortField, icon: TrendingDown, iconColor: 'text-secondary' },
    { key: 'spread', label: 'Spread', sortable: true, field: 'apySpread' as SortField, icon: Zap, iconColor: 'text-warning' },
  ];

  return (
    <>
      {/* Mobile: Card layout */}
      <div className="md:hidden space-y-2">
        {markets.map((market, index) => (
          <MobileMarketCard 
            key={`${market.marketName}-${market.tokenSymbol}-${index}`}
            market={market} 
            isApy={isApy} 
          />
        ))}
      </div>

      {/* Desktop: Table layout */}
      <div className="hidden md:block glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                {headerColumns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={`h-10 px-3 text-left align-middle font-semibold text-muted-foreground text-xs ${
                      col.sortable ? 'cursor-pointer hover:text-foreground transition-colors' : ''
                    }`}
                    onClick={col.sortable && col.field ? () => onSort(col.field!) : undefined}
                  >
                    {col.sortable && col.icon ? (
                      <div className="flex items-center gap-1.5">
                        <col.icon className={`w-3.5 h-3.5 ${col.iconColor}`} />
                        <span>{col.label}</span>
                        {getSortIcon(col.field!)}
                      </div>
                    ) : (
                      col.label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {markets.map((market, index) => {
                const rowKey = `${market.marketName}-${market.tokenSymbol}-${index}`;
                
                const displaySupply = isApy 
                  ? market.totalSupplyApy 
                  : apyToApr(market.totalSupplyApy);
                
                const displayBorrow = market.totalBorrowApy !== null
                  ? (isApy ? market.totalBorrowApy : apyToApr(market.totalBorrowApy))
                  : null;

                const isLoopingOpportunity = market.apySpread !== null && market.apySpread > 0;

                return (
                  <TableRow
                    key={rowKey}
                    className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                  >
                    {/* Token */}
                    <TableCell className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-xs font-bold gradient-text flex-shrink-0">
                          {market.tokenSymbol.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{market.tokenSymbol}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {market.tokenName}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Market */}
                    <TableCell className="py-2.5 px-3">
                      <Badge 
                        variant="outline" 
                        className="bg-secondary/10 text-secondary border-secondary/30 text-xs"
                      >
                        {getMarketDisplayName(market)}
                      </Badge>
                    </TableCell>

                    {/* Supply APY */}
                    <TableCell className="py-2.5 px-3">
                      <div>
                        <span className="text-success font-semibold text-sm">
                          {formatPercent(displaySupply)}
                        </span>
                        {market.totalIncentiveSupplyApy > 0 && (
                          <span className="text-[10px] text-success/70 block">
                            +{formatPercent(market.totalIncentiveSupplyApy)} rewards
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Borrow APY */}
                    <TableCell className="py-2.5 px-3">
                      <div>
                        <span className="text-secondary font-semibold text-sm">
                          {displayBorrow !== null ? formatPercent(displayBorrow) : '-'}
                        </span>
                        {market.totalIncentiveBorrowApy > 0 && (
                          <span className="text-[10px] text-secondary/70 block">
                            -{formatPercent(market.totalIncentiveBorrowApy)} rebate
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Spread */}
                    <TableCell className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {isLoopingOpportunity && (
                          <Zap className="w-3.5 h-3.5 text-warning animate-pulse" />
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
};

export default MarketsTable;
