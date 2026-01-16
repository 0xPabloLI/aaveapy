import { useState } from 'react';
import { TrendingUp, Zap } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { getChainIconSrc } from '@/lib/chainIcons';

interface TopOpportunitiesProps {
  pools: PoolWithSpread[];
  isApy: boolean;
}

const TopOpportunities = ({ pools, isApy }: TopOpportunitiesProps) => {
  const isMobile = useIsMobile();
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

  // Dynamic color based on APY value for Top Opportunities
  const getApyColorClass = (value: number | null) => {
    if (value === null) return 'text-gray-400';
    if (value >= 15) return 'text-emerald-600';
    if (value >= 10) return 'text-emerald-500';
    if (value >= 5) return 'text-teal-500';
    if (value >= 2) return 'text-teal-400';
    if (value >= 1) return 'text-cyan-500';
    return 'text-gray-500';
  };

  // Shared item card component for consistent layout
  const OpportunityItem = ({ 
    pool, 
    index, 
    type 
  }: { 
    pool: typeof poolsWithTotals[0]; 
    index: number; 
    type: 'stable' | 'eth' | 'btc' | 'leverage';
  }) => {
    const isLeverage = type === 'leverage';
    const colorClass = isLeverage ? 'text-warning' : 'text-secondary';
    const bgClass = isLeverage ? 'to-warning/5' : 'to-success/5';
    const borderHoverClass = isLeverage ? 'hover:border-warning/50' : 'hover:border-success/50';
    
    const displayValue = isLeverage 
      ? (isApy ? pool.apySpread : pool.aprSpread)
      : (isApy ? pool.totalSupplyApy : pool.totalSupplyApr);
    
    const incentiveValue = isApy ? pool.supplyIncentiveApy : pool.supplyIncentiveApr;
    const hasIncentive = !isLeverage && incentiveValue !== null && !isNaN(incentiveValue) && incentiveValue >= 0.01;

    return (
      <motion.div 
        custom={index}
        initial="hidden"
        animate="visible"
        variants={itemVariants}
        className={`flex items-center p-3 rounded-lg bg-gradient-to-r from-background ${bgClass} border border-border ${borderHoverClass} transition-all group cursor-pointer h-[60px]`}
        onClick={() => handleCardClick(pool)}
      >
        {/* Left section: Index + Token info - fixed width */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`font-bold ${colorClass} shrink-0 w-4 text-center ${isMobile ? 'text-xs' : 'text-lg'}`}>
            {index + 1}
          </span>
          <div className={`min-w-0 ${isMobile ? 'flex-1' : 'w-20'}`}>
            <div className="flex items-center gap-1.5">
              <p className={`font-semibold text-foreground truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
                {pool.tokenSymbol}
              </p>
              {(() => {
                const chainIconSrc = getChainIconSrc(pool.chainName);
                return chainIconSrc ? (
                  <img src={chainIconSrc} alt={pool.chainName} className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} shrink-0`} />
                ) : null;
              })()}
            </div>
            {hasIncentive && (
              <div className="flex items-center gap-0.5 text-[10px] text-secondary mt-0.5">
                <span className="tabular-nums text-blue-600">{formatPercent(pool.supplyApy ?? null)}</span>
                <span>+</span>
                <button
                  onClick={(e) => handleIncentiveClick(e, pool, 'supply', incentiveValue)}
                  className="inline-flex items-center gap-0.5 px-0.5 rounded bg-amber-50 text-amber-600 font-semibold hover:bg-amber-100 transition-colors cursor-pointer tabular-nums"
                >
                  <IncentiveIcon width={9} height={9} />
                  <span>{formatPercent(incentiveValue)}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right section: APY value - fixed width */}
        <div className={`shrink-0 text-right ${isMobile ? 'w-16' : 'w-20'}`}>
          <span className={`${getApyColorClass(displayValue)} font-bold tabular-nums ${isMobile ? 'text-sm' : 'text-base'}`}>
            {isLeverage ? formatSpread(displayValue) : formatPercent(displayValue)}
          </span>
          {isLeverage && !isMobile && (
            <div className="text-[10px] text-secondary tabular-nums mt-0.5">
              {formatPercent(isApy ? pool.totalSupplyApy : pool.totalSupplyApr)} -{' '}
              {(() => {
                const borrowValue = isApy ? pool.totalBorrowApy : pool.totalBorrowApr;
                if (borrowValue === null) return '-';
                return borrowValue < 0 ? `(${formatPercent(borrowValue)})` : formatPercent(borrowValue);
              })()}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  // Shared card container component
  const OpportunityCard = ({ 
    title, 
    subtitle, 
    icon: Icon, 
    iconBgClass, 
    iconColorClass,
    pools: cardPools,
    type,
    emptyMessage
  }: { 
    title: string;
    subtitle: string;
    icon: typeof TrendingUp;
    iconBgClass: string;
    iconColorClass: string;
    pools: typeof poolsWithTotals;
    type: 'stable' | 'eth' | 'btc' | 'leverage';
    emptyMessage: string;
  }) => (
    <div className="glass-card rounded-xl p-4 md:p-5 flex flex-col">
      <motion.div 
        className="flex items-center gap-2 mb-3 md:mb-4"
        initial="hidden"
        animate="visible"
        variants={headerVariants}
      >
        <motion.div 
          className={`p-1.5 md:p-2 rounded-lg ${iconBgClass}`}
          variants={iconVariants}
          initial="hidden"
          animate={["visible", "pulse"]}
        >
          <Icon className={`w-4 h-4 md:w-5 md:h-5 ${iconColorClass}`} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold truncate ${isMobile ? 'text-sm' : 'text-base'}`}>{title}</h3>
          <p className="text-[10px] md:text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
      </motion.div>
      <div className="space-y-2 flex-1">
        {cardPools.length > 0 ? (
          cardPools.map((pool, i) => (
            <OpportunityItem
              key={`${type}-${pool.marketName}-${pool.tokenSymbol}`}
              pool={pool}
              index={i}
              type={type}
            />
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground flex-1 flex items-center justify-center">
            <p className="text-xs">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {/* Top Stable APY */}
      <OpportunityCard
        title={`Top Stable ${isApy ? 'APY' : 'APR'}`}
        subtitle={`Native + Incentive ${isApy ? 'APY' : 'APR'}`}
        icon={TrendingUp}
        iconBgClass="bg-success/10"
        iconColorClass="text-success"
        pools={topStable}
        type="stable"
        emptyMessage="No stablecoin opportunities found"
      />

      {/* Leverage Opportunities */}
      <OpportunityCard
        title="Leverage Opportunities"
        subtitle={`Supply - Borrow ${isApy ? 'APY' : 'APR'}`}
        icon={Zap}
        iconBgClass="bg-warning/10"
        iconColorClass="text-warning"
        pools={topLooping}
        type="leverage"
        emptyMessage="No looping opportunities found"
      />

      {/* Top ETH APY */}
      <OpportunityCard
        title={`Top ETH ${isApy ? 'APY' : 'APR'}`}
        subtitle={`Native + Incentive ${isApy ? 'APY' : 'APR'}`}
        icon={TrendingUp}
        iconBgClass="bg-success/10"
        iconColorClass="text-success"
        pools={topEth}
        type="eth"
        emptyMessage="No ETH-related opportunities found"
      />

      {/* Top BTC APY */}
      <OpportunityCard
        title={`Top BTC ${isApy ? 'APY' : 'APR'}`}
        subtitle={`Native + Incentive ${isApy ? 'APY' : 'APR'}`}
        icon={TrendingUp}
        iconBgClass="bg-success/10"
        iconColorClass="text-success"
        pools={topBtc}
        type="btc"
        emptyMessage="No BTC-related opportunities found"
      />
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
