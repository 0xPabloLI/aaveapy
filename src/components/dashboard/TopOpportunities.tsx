import { TrendingUp, Zap, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { MarketWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { formatPercent, formatSpread } from '@/lib/formatters';

interface TopOpportunitiesProps {
  markets: MarketWithSpread[];
}

const TopOpportunities = ({ markets }: TopOpportunitiesProps) => {
  // Top 5 Supply APY
  const topSupply = [...markets]
    .sort((a, b) => b.totalSupplyApy - a.totalSupplyApy)
    .slice(0, 5);

  // Top 5 Looping opportunities (most negative spread)
  const topLooping = [...markets]
    .filter(m => m.apySpread !== null && m.apySpread < 0)
    .sort((a, b) => (a.apySpread || 0) - (b.apySpread || 0))
    .slice(0, 5);

  const getMarketDisplayName = (market: MarketWithSpread) => {
    if (market.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[market.marketName]) {
      return `ETH ${ETHEREUM_MARKET_NAMES[market.marketName]}`;
    }
    return market.chainName;
  };

  const headerVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1] as const
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.2 + i * 0.08,
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1] as const
      }
    })
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Top Supply APY */}
      <div className="glass-card rounded-xl p-5">
        <motion.div 
          className="flex items-center gap-2 mb-4"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <div className="p-2 rounded-lg bg-success/10">
            <TrendingUp className="w-5 h-5 text-success" />
          </div>
          <div>
            <h3 className="font-bold">Top Supply APY</h3>
            <p className="text-xs text-muted-foreground">Best lending opportunities</p>
          </div>
        </motion.div>
        <div className="space-y-3">
          {topSupply.map((market, i) => (
            <motion.div 
              key={`supply-${market.marketName}-${market.tokenSymbol}`}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={itemVariants}
              className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-background to-success/5 border border-border hover:border-success/50 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-secondary w-6">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-foreground">{market.tokenSymbol}</p>
                  <p className="text-xs text-secondary">{getMarketDisplayName(market)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-success font-bold text-lg">
                  {formatPercent(market.totalSupplyApy)}
                </span>
                <ArrowRight className="w-4 h-4 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Leverage Opportunities */}
      <div className="glass-card rounded-xl p-5">
        <motion.div 
          className="flex items-center gap-2 mb-4"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <div className="p-2 rounded-lg bg-warning/10">
            <Zap className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="font-bold">Leverage Opportunities</h3>
            <p className="text-xs text-muted-foreground">Supply APY &gt; Borrow APY</p>
          </div>
        </motion.div>
        {topLooping.length > 0 ? (
          <div className="space-y-3">
            {topLooping.map((market, i) => (
              <motion.div 
                key={`loop-${market.marketName}-${market.tokenSymbol}`}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={itemVariants}
                className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-background to-warning/5 border border-border hover:border-warning/50 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-warning w-6">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{market.tokenSymbol}</p>
                    <p className="text-xs text-secondary">{getMarketDisplayName(market)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-warning font-bold">
                    {formatSpread(market.apySpread)}
                  </span>
                  <span className="text-xs text-secondary">
                    {formatPercent(market.totalSupplyApy)} / {formatPercent(market.totalBorrowApy)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No looping opportunities found</p>
            <p className="text-xs mt-1">Supply APY &gt; Borrow APY for all tokens</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopOpportunities;
