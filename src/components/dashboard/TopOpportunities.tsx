import { useState } from 'react';
import { TrendingUp, Zap, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { PoolWithSpread, ETHEREUM_MARKET_NAMES, STABLECOINS, ETH_RELATED, BTC_RELATED } from '@/types/aave';
import { 
  formatPercent, 
  formatSpread, 
  calculateTotalSupplyApy, 
  calculateTotalBorrowApy,
  calculateSpreadApy,
  calculateTotalSupplyApr,
  calculateTotalBorrowApr,
  calculateSpreadApr,
  calculateTotalIncentiveApr,
  calculateTotalIncentiveApy
} from '@/lib/formatters';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import IncentiveTooltip from './IncentiveTooltip';

interface TopOpportunitiesProps {
  pools: PoolWithSpread[];
  isApy: boolean;
}

const TopOpportunities = ({ pools, isApy }: TopOpportunitiesProps) => {
  const [tooltipState, setTooltipState] = useState<{
    pool: PoolWithSpread;
    type: 'supply' | 'borrow';
    position: { x: number; y: number };
    triggerCenterX: number;
  } | null>(null);

  // Calculate totals for all pools (frontend calculates incentive totals from details)
  const poolsWithTotals = pools.map(pool => {
    // Helper: Calculate incentive values for supply/borrow
    const getIncentiveValues = (type: 'supply' | 'borrow') => {
      const protocolIncentives = type === 'supply' ? pool.supplyIncentives : pool.borrowIncentives;
      const meritIncentives = type === 'supply' ? pool.meritSupplys : pool.meritBorrows;
      const merklOpportunities = type === 'supply' ? pool.merklSupplys : pool.merklBorrows;
      const brevisApr = type === 'supply' ? pool.brevisSupplyApr : pool.brevisBorrowApr;
      return {
        apr: calculateTotalIncentiveApr(meritIncentives, merklOpportunities, brevisApr, protocolIncentives),
        apy: calculateTotalIncentiveApy(meritIncentives, merklOpportunities, brevisApr, protocolIncentives),
      };
    };

    const supplyIncentive = getIncentiveValues('supply');
    const borrowIncentive = getIncentiveValues('borrow');

    const totalSupplyApy = calculateTotalSupplyApy(pool.supplyApy, supplyIncentive.apy);
    const totalBorrowApy = calculateTotalBorrowApy(pool.borrowApy, borrowIncentive.apy);
    const totalSupplyApr = calculateTotalSupplyApr(pool.supplyApy, supplyIncentive.apr);
    const totalBorrowApr = calculateTotalBorrowApr(pool.borrowApy, borrowIncentive.apr);

    return {
      ...pool,
      supplyIncentiveApr: supplyIncentive.apr,
      supplyIncentiveApy: supplyIncentive.apy,
      borrowIncentiveApr: borrowIncentive.apr,
      borrowIncentiveApy: borrowIncentive.apy,
      totalSupplyApy,
      totalBorrowApy,
      apySpread: calculateSpreadApy(totalSupplyApy, totalBorrowApy),
      totalSupplyApr,
      totalBorrowApr,
      aprSpread: calculateSpreadApr(totalSupplyApr, totalBorrowApr),
    };
  });

  // Helper function to check if token is stablecoin
  const isStablecoin = (symbol: string): boolean => {
    return STABLECOINS.some(s => symbol.toUpperCase().includes(s.toUpperCase()));
  };

  // Helper function to check if token is ETH-related
  const isEthRelated = (symbol: string): boolean => {
    return ETH_RELATED.some(s => symbol.toUpperCase().includes(s.toUpperCase()));
  };

  // Helper function to check if token is BTC-related
  const isBtcRelated = (symbol: string): boolean => {
    return BTC_RELATED.some(s => symbol.toUpperCase().includes(s.toUpperCase()));
  };

  // Top 5 Stable APY (sorted by totalSupplyApy)
  const topStable = [...poolsWithTotals]
    .filter(m => isStablecoin(m.tokenSymbol))
    .filter(m => {
      const value = isApy ? m.totalSupplyApy : m.totalSupplyApr;
      return value !== null && !isNaN(value);
    })
    .sort((a, b) => {
      const aValue = isApy ? a.totalSupplyApy : a.totalSupplyApr;
      const bValue = isApy ? b.totalSupplyApy : b.totalSupplyApr;
      return bValue - aValue;
    })
    .slice(0, 5);

  // Top 5 ETH APY (sorted by totalSupplyApy)
  const topEth = [...poolsWithTotals]
    .filter(m => isEthRelated(m.tokenSymbol))
    .filter(m => {
      const value = isApy ? m.totalSupplyApy : m.totalSupplyApr;
      return value !== null && !isNaN(value);
    })
    .sort((a, b) => {
      const aValue = isApy ? a.totalSupplyApy : a.totalSupplyApr;
      const bValue = isApy ? b.totalSupplyApy : b.totalSupplyApr;
      return bValue - aValue;
    })
    .slice(0, 5);

  // Top 5 BTC APY (sorted by totalSupplyApy)
  const topBtc = [...poolsWithTotals]
    .filter(m => isBtcRelated(m.tokenSymbol))
    .filter(m => {
      const value = isApy ? m.totalSupplyApy : m.totalSupplyApr;
      return value !== null && !isNaN(value);
    })
    .sort((a, b) => {
      const aValue = isApy ? a.totalSupplyApy : a.totalSupplyApr;
      const bValue = isApy ? b.totalSupplyApy : b.totalSupplyApr;
      return bValue - aValue;
    })
    .slice(0, 5);

  // Top 5 Looping opportunities (highest positive spread)
  const topLooping = [...poolsWithTotals]
    .filter(m => {
      const spread = isApy ? m.apySpread : m.aprSpread;
      return spread !== null && spread > 0;
    })
    .sort((a, b) => {
      const aSpread = isApy ? a.apySpread : a.aprSpread;
      const bSpread = isApy ? b.apySpread : b.aprSpread;
      return (bSpread || 0) - (aSpread || 0);
    })
    .slice(0, 5);

  const getMarketDisplayName = (pool: PoolWithSpread) => {
    if (pool.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[pool.marketName]) {
      return `ETH ${ETHEREUM_MARKET_NAMES[pool.marketName]}`;
    }
    return pool.chainName;
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

  const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 260,
        damping: 20,
        delay: 0.1
      }
    },
    pulse: {
      scale: [1, 1.1, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut' as const
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

  const handleCardClick = (pool: Pick<PoolWithSpread, 'marketName' | 'tokenAddress'>) => {
    const url = buildAaveReserveUrl(pool);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleIncentiveClick = (
    e: React.MouseEvent,
    pool: PoolWithSpread,
    type: 'supply' | 'borrow',
    incentiveValue: number | null,
  ) => {
    e.stopPropagation();
    if (incentiveValue === null || isNaN(incentiveValue) || incentiveValue < 0.01) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;
    setTooltipState({
      pool,
      type,
      position: { x: rect.left, y: rect.bottom },
      triggerCenterX,
    });
  };

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Top Stable APY */}
      <div className="glass-card rounded-xl p-5">
        <motion.div 
          className="flex items-center gap-2 mb-4"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <motion.div 
            className="p-2 rounded-lg bg-success/10"
            variants={iconVariants}
            initial="hidden"
            animate={["visible", "pulse"]}
          >
            <TrendingUp className="w-5 h-5 text-success" />
          </motion.div>
          <div className="flex-1">
            <h3 className="font-bold">Top Stable {isApy ? 'APY' : 'APR'}</h3>
            <p className="text-xs text-muted-foreground">Native {isApy ? 'APY' : 'APR'} + Incentive {isApy ? 'APY' : 'APR'}</p>
          </div>
        </motion.div>
        <div className="space-y-3">
          {topStable.length > 0 ? (
            topStable.map((pool, i) => (
              <motion.div 
                key={`stable-${pool.marketName}-${pool.tokenSymbol}`}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={itemVariants}
                className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-background to-success/5 border border-border hover:border-success/50 transition-all group cursor-pointer"
                onClick={() => handleCardClick(pool)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-lg font-bold text-secondary w-5 shrink-0 text-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0 w-16">
                    <p className="font-semibold text-foreground truncate">{pool.tokenSymbol}</p>
                    <p className="text-xs text-secondary truncate">{getMarketDisplayName(pool)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0 w-24">
                  <span className="text-success font-bold text-base tabular-nums text-right w-full">
                    {formatPercent(isApy ? pool.totalSupplyApy : pool.totalSupplyApr)}
                  </span>
                  {(() => {
                    const incentiveValue = isApy ? pool.supplyIncentiveApy : pool.supplyIncentiveApr;
                    const hasIncentive = incentiveValue !== null && !isNaN(incentiveValue) && incentiveValue >= 0.01;
                    if (!hasIncentive) {
                      return (
                        <span className="text-[10px] text-secondary tabular-nums">
                          {formatPercent(pool.supplyApy ?? null)}
                        </span>
                      );
                    }
                    return (
                      <span className="text-[10px] text-secondary flex items-center gap-0.5 justify-end w-full">
                        <span className="tabular-nums">{formatPercent(pool.supplyApy ?? null)}</span>
                        <span>+</span>
                        <button
                          onClick={(e) => handleIncentiveClick(e, pool, 'supply', incentiveValue)}
                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-50 text-amber-600 font-semibold hover:bg-amber-100 transition-colors cursor-pointer tabular-nums"
                        >
                          <IncentiveIcon width={10} height={10} />
                          {formatPercent(incentiveValue)}
                        </button>
                      </span>
                    );
                  })()}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-xs">No stablecoin opportunities found</p>
            </div>
          )}
        </div>
      </div>

      {/* Top ETH APY */}
      <div className="glass-card rounded-xl p-5">
        <motion.div 
          className="flex items-center gap-2 mb-4"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <motion.div 
            className="p-2 rounded-lg bg-success/10"
            variants={iconVariants}
            initial="hidden"
            animate={["visible", "pulse"]}
          >
            <TrendingUp className="w-5 h-5 text-success" />
          </motion.div>
          <div className="flex-1">
            <h3 className="font-bold">Top ETH {isApy ? 'APY' : 'APR'}</h3>
            <p className="text-xs text-muted-foreground">Native {isApy ? 'APY' : 'APR'} + Incentive {isApy ? 'APY' : 'APR'}</p>
          </div>
        </motion.div>
        <div className="space-y-3">
          {topEth.length > 0 ? (
            topEth.map((pool, i) => (
              <motion.div 
                key={`eth-${pool.marketName}-${pool.tokenSymbol}`}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={itemVariants}
                className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-background to-success/5 border border-border hover:border-success/50 transition-all group cursor-pointer"
                onClick={() => handleCardClick(pool)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-lg font-bold text-secondary w-5 shrink-0 text-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0 w-16">
                    <p className="font-semibold text-foreground truncate">{pool.tokenSymbol}</p>
                    <p className="text-xs text-secondary truncate">{getMarketDisplayName(pool)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0 w-24">
                  <span className="text-success font-bold text-base tabular-nums text-right w-full">
                    {formatPercent(isApy ? pool.totalSupplyApy : pool.totalSupplyApr)}
                  </span>
                  {(() => {
                    const incentiveValue = isApy ? pool.supplyIncentiveApy : pool.supplyIncentiveApr;
                    const hasIncentive = incentiveValue !== null && !isNaN(incentiveValue) && incentiveValue >= 0.01;
                    if (!hasIncentive) {
                      return (
                        <span className="text-[10px] text-secondary tabular-nums">
                          {formatPercent(pool.supplyApy ?? null)}
                        </span>
                      );
                    }
                    return (
                      <span className="text-[10px] text-secondary flex items-center gap-0.5 justify-end w-full">
                        <span className="tabular-nums">{formatPercent(pool.supplyApy ?? null)}</span>
                        <span>+</span>
                        <button
                          onClick={(e) => handleIncentiveClick(e, pool, 'supply', incentiveValue)}
                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-50 text-amber-600 font-semibold hover:bg-amber-100 transition-colors cursor-pointer tabular-nums"
                        >
                          <IncentiveIcon width={10} height={10} />
                          {formatPercent(incentiveValue)}
                        </button>
                      </span>
                    );
                  })()}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-xs">No ETH-related opportunities found</p>
            </div>
          )}
        </div>
      </div>

      {/* Top BTC APY */}
      <div className="glass-card rounded-xl p-5">
        <motion.div 
          className="flex items-center gap-2 mb-4"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <motion.div 
            className="p-2 rounded-lg bg-success/10"
            variants={iconVariants}
            initial="hidden"
            animate={["visible", "pulse"]}
          >
            <TrendingUp className="w-5 h-5 text-success" />
          </motion.div>
          <div className="flex-1">
            <h3 className="font-bold">Top BTC {isApy ? 'APY' : 'APR'}</h3>
            <p className="text-xs text-muted-foreground">Native {isApy ? 'APY' : 'APR'} + Incentive {isApy ? 'APY' : 'APR'}</p>
          </div>
        </motion.div>
        <div className="space-y-3">
          {topBtc.length > 0 ? (
            topBtc.map((pool, i) => (
              <motion.div 
                key={`btc-${pool.marketName}-${pool.tokenSymbol}`}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={itemVariants}
                className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-background to-success/5 border border-border hover:border-success/50 transition-all group cursor-pointer"
                onClick={() => handleCardClick(pool)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-lg font-bold text-secondary w-5 shrink-0 text-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0 w-16">
                    <p className="font-semibold text-foreground truncate">{pool.tokenSymbol}</p>
                    <p className="text-xs text-secondary truncate">{getMarketDisplayName(pool)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0 w-24">
                  <span className="text-success font-bold text-base tabular-nums text-right w-full">
                    {formatPercent(isApy ? pool.totalSupplyApy : pool.totalSupplyApr)}
                  </span>
                  {(() => {
                    const incentiveValue = isApy ? pool.supplyIncentiveApy : pool.supplyIncentiveApr;
                    const hasIncentive = incentiveValue !== null && !isNaN(incentiveValue) && incentiveValue >= 0.01;
                    if (!hasIncentive) {
                      return (
                        <span className="text-[10px] text-secondary tabular-nums">
                          {formatPercent(pool.supplyApy ?? null)}
                        </span>
                      );
                    }
                    return (
                      <span className="text-[10px] text-secondary flex items-center gap-0.5 justify-end w-full">
                        <span className="tabular-nums">{formatPercent(pool.supplyApy ?? null)}</span>
                        <span>+</span>
                        <button
                          onClick={(e) => handleIncentiveClick(e, pool, 'supply', incentiveValue)}
                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-50 text-amber-600 font-semibold hover:bg-amber-100 transition-colors cursor-pointer tabular-nums"
                        >
                          <IncentiveIcon width={10} height={10} />
                          {formatPercent(incentiveValue)}
                        </button>
                      </span>
                    );
                  })()}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-xs">No BTC-related opportunities found</p>
            </div>
          )}
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
          <motion.div 
            className="p-2 rounded-lg bg-warning/10"
            variants={iconVariants}
            initial="hidden"
            animate={["visible", "pulse"]}
          >
            <Zap className="w-5 h-5 text-warning" />
          </motion.div>
          <div>
            <h3 className="font-bold">Leverage Opportunities</h3>
            <p className="text-xs text-muted-foreground">
              Supply {isApy ? 'APY' : 'APR'} - Borrow {isApy ? 'APY' : 'APR'}
            </p>
          </div>
        </motion.div>
        {topLooping.length > 0 ? (
          <div className="space-y-3">
            {topLooping.map((pool, i) => (
              <motion.div 
                key={`loop-${pool.marketName}-${pool.tokenSymbol}`}
                custom={i}
              initial="hidden"
              animate="visible"
              variants={itemVariants}
              className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-background to-warning/5 border border-border hover:border-warning/50 transition-all group cursor-pointer"
              onClick={() => handleCardClick(pool)}
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-lg font-bold text-warning w-5 shrink-0 text-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0 w-16">
                    <p className="font-semibold text-foreground truncate">{pool.tokenSymbol}</p>
                    <p className="text-xs text-secondary truncate">{getMarketDisplayName(pool)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0 w-28">
                  <span className="text-warning font-bold text-base tabular-nums text-right w-full">
                    {formatSpread(isApy ? pool.apySpread : pool.aprSpread)}
                  </span>
                  <span className="text-[10px] text-secondary tabular-nums text-right w-full">
                    {formatPercent(isApy ? pool.totalSupplyApy : pool.totalSupplyApr)} -{' '}
                    {(() => {
                      const borrowValue = isApy ? pool.totalBorrowApy : pool.totalBorrowApr;
                      if (borrowValue === null) return '-';
                      return borrowValue < 0
                        ? `(${formatPercent(borrowValue)})`
                        : formatPercent(borrowValue);
                    })()}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No looping opportunities found</p>
            <p className="text-xs mt-1">Supply APY &lt;= Borrow APY for all tokens</p>
          </div>
        )}
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

export default TopOpportunities;
