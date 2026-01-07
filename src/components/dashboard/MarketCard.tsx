import { ExternalLink, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { MarketWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { formatPercent, formatSpread, apyToApr } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';

interface MarketCardProps {
  market: MarketWithSpread;
  isApy: boolean;
}

const MarketCard = ({ market, isApy }: MarketCardProps) => {
  const getMarketDisplayName = () => {
    if (market.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[market.marketName]) {
      return `ETH ${ETHEREUM_MARKET_NAMES[market.marketName]}`;
    }
    return market.chainName;
  };

  const displaySupply = isApy 
    ? market.totalSupplyApy 
    : apyToApr(market.totalSupplyApy);
  
  const displayBorrow = market.totalBorrowApy !== null
    ? (isApy ? market.totalBorrowApy : apyToApr(market.totalBorrowApy))
    : null;

  const isLoopingOpportunity = market.apySpread !== null && market.apySpread < 0;
  const hasIncentives = market.totalIncentiveSupplyApy > 0 || market.totalIncentiveBorrowApy > 0;

  return (
    <div className={`glass-card rounded-xl p-4 hover:scale-[1.01] transition-all duration-300 group relative overflow-hidden ${
      isLoopingOpportunity ? 'ring-1 ring-warning/50' : ''
    }`}>
      {/* Looping opportunity indicator */}
      {isLoopingOpportunity && (
        <div className="absolute top-0 right-0 bg-warning text-warning-foreground px-2 py-0.5 text-xs font-bold rounded-bl-lg flex items-center gap-1">
          <Zap className="w-3 h-3" />
          LOOP
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-lg font-bold gradient-text">
            {market.tokenSymbol.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-lg">{market.tokenSymbol}</h3>
            <p className="text-xs text-muted-foreground">{market.tokenName}</p>
          </div>
        </div>
        <Badge 
          variant="outline" 
          className="bg-secondary/10 text-secondary border-secondary/30 text-xs"
        >
          {getMarketDisplayName()}
        </Badge>
      </div>

      {/* APY Section */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Supply APY */}
        <div className="bg-success/5 rounded-lg p-3 border border-success/20">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <TrendingUp className="w-3 h-3 text-success" />
            Supply {isApy ? 'APY' : 'APR'}
          </div>
          <p className="text-xl font-bold text-success">
            {formatPercent(displaySupply)}
          </p>
          {hasIncentives && market.totalIncentiveSupplyApy > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              +{formatPercent(market.totalIncentiveSupplyApy)} rewards
            </p>
          )}
        </div>

        {/* Borrow APY */}
        <div className="bg-secondary/5 rounded-lg p-3 border border-secondary/20">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <TrendingDown className="w-3 h-3 text-secondary" />
            Borrow {isApy ? 'APY' : 'APR'}
          </div>
          <p className="text-xl font-bold text-secondary">
            {displayBorrow !== null ? formatPercent(displayBorrow) : '-'}
          </p>
          {hasIncentives && market.totalIncentiveBorrowApy > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              -{formatPercent(market.totalIncentiveBorrowApy)} rewards
            </p>
          )}
        </div>
      </div>

      {/* Spread */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <span className="text-sm text-muted-foreground">Net Spread</span>
        <span className={`font-bold ${
          market.apySpread !== null && market.apySpread < 0 
            ? 'text-warning' 
            : 'text-success'
        }`}>
          {formatSpread(market.apySpread)}
        </span>
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
};

export default MarketCard;
