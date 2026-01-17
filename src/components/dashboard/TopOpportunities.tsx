import { useState } from 'react';
import { TrendingUp, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

const DISPLAY_COUNT = 3;

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

  const isStablecoin = (symbol: string): boolean => {
    return STABLECOINS.some(s => symbol.toUpperCase().includes(s.toUpperCase()));
  };

  const isEthRelated = (symbol: string): boolean => {
    return ETH_RELATED.some(s => symbol.toUpperCase().includes(s.toUpperCase()));
  };

  const isBtcRelated = (symbol: string): boolean => {
    return BTC_RELATED.some(s => symbol.toUpperCase().includes(s.toUpperCase()));
  };

  // Top 3 Stable APY
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
    .slice(0, DISPLAY_COUNT);

  // Top 3 ETH APY
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
    .slice(0, DISPLAY_COUNT);

  // Top 3 BTC APY
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
    .slice(0, DISPLAY_COUNT);

  // Top 3 Looping opportunities
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
    .slice(0, DISPLAY_COUNT);

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
      transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const }
    }
  };

  const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: { type: 'spring' as const, stiffness: 260, damping: 20, delay: 0.1 }
    },
    pulse: {
      scale: [1, 1.1, 1],
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.2 + i * 0.08, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const }
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

  const getApyColorClass = (value: number | null) => {
    if (value === null) return 'text-muted-foreground';
    if (value >= 15) return 'text-emerald-600';
    if (value >= 10) return 'text-emerald-500';
    if (value >= 5) return 'text-teal-500';
    if (value >= 2) return 'text-teal-400';
    if (value >= 1) return 'text-cyan-500';
    return 'text-muted-foreground';
  };

  // Reusable pool item component
  const PoolItem = ({ 
    pool, 
    index, 
    type 
  }: { 
    pool: typeof poolsWithTotals[0]; 
    index: number;
    type: 'supply' | 'leverage';
  }) => {
    const isLeverage = type === 'leverage';
    const mainValue = isLeverage 
      ? (isApy ? pool.apySpread : pool.aprSpread)
      : (isApy ? pool.totalSupplyApy : pool.totalSupplyApr);
    const incentiveValue = isApy ? pool.supplyIncentiveApy : pool.supplyIncentiveApr;
    const hasIncentive = incentiveValue !== null && !isNaN(incentiveValue) && incentiveValue >= 0.01;
    const chainIconSrc = getChainIconSrc(pool.chainName);

    return (
      <motion.div 
        custom={index}
        initial="hidden"
        animate="visible"
        variants={itemVariants}
        className={`flex items-center rounded-lg border transition-all group cursor-pointer h-[56px] ${
          isLeverage 
            ? 'bg-gradient-to-r from-background to-warning/5 border-border hover:border-warning/50'
            : 'bg-gradient-to-r from-background to-success/5 border-border hover:border-success/50'
        } ${isMobile ? 'px-2.5 gap-2' : 'px-3 gap-2'}`}
        onClick={() => handleCardClick(pool)}
      >
        {/* Rank - Fixed width */}
        <div className={`shrink-0 flex items-center justify-center rounded-full bg-muted/50 ${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`}>
          <span className={`font-bold ${isLeverage ? 'text-warning' : 'text-secondary'} ${isMobile ? 'text-xs' : 'text-sm'}`}>
            {index + 1}
          </span>
        </div>
        
        {/* Token Info - Flex grow */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`font-semibold text-foreground truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
              {pool.tokenSymbol}
            </p>
            {chainIconSrc && (
              <img src={chainIconSrc} alt={pool.chainName} className={`shrink-0 ${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
            )}
          </div>
          {!isMobile && (
            <p className="text-xs text-secondary truncate">{getMarketDisplayName(pool)}</p>
          )}
        </div>
        
        {/* APY Values - Fixed width, right aligned */}
        <div className={`shrink-0 text-right ${isMobile ? 'w-16' : 'w-24'}`}>
          <div className={`${getApyColorClass(mainValue)} font-bold tabular-nums ${isMobile ? 'text-base' : 'text-lg'}`}>
            {isLeverage ? formatSpread(mainValue) : formatPercent(mainValue)}
          </div>
          {/* Detail breakdown - Only show for supply type */}
          {!isLeverage && (
            <div className={`flex items-center justify-end gap-0.5 ${isMobile ? 'text-[9px]' : 'text-[10px]'} text-secondary mt-0.5`}>
              <span className="tabular-nums text-blue-600">{formatPercent(pool.supplyApy ?? null)}</span>
              {hasIncentive && (
                <>
                  <span className="text-muted-foreground">+</span>
                  <button
                    onClick={(e) => handleIncentiveClick(e, pool, 'supply', incentiveValue)}
                    className="inline-flex items-center gap-0.5 px-0.5 py-0 rounded bg-amber-50 text-amber-600 font-semibold hover:bg-amber-100 transition-colors cursor-pointer tabular-nums"
                  >
                    <IncentiveIcon width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} />
                    <span>{formatPercent(incentiveValue)}</span>
                  </button>
                </>
              )}
            </div>
          )}
          {/* Leverage detail */}
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

  // Category card component (simplified - no expand/collapse)
  const CategoryCard = ({
    title,
    subtitle,
    icon: Icon,
    iconColorClass,
    bgColorClass,
    pools: categoryPools,
    categoryKey,
    type,
    emptyMessage
  }: {
    title: string;
    subtitle: string;
    icon: typeof TrendingUp;
    iconColorClass: string;
    bgColorClass: string;
    pools: typeof poolsWithTotals;
    categoryKey: string;
    type: 'supply' | 'leverage';
    emptyMessage: string;
  }) => {
    return (
      <div className={`glass-card rounded-xl ${isMobile ? 'p-3' : 'p-5'} ${isMobile ? 'col-span-1' : ''} flex flex-col`}>
        <motion.div 
          className="flex items-center gap-2 mb-3"
          initial="hidden"
          animate="visible"
          variants={headerVariants}
        >
          <motion.div 
            className={`p-2 rounded-lg ${bgColorClass}`}
            variants={iconVariants}
            initial="hidden"
            animate={["visible", "pulse"]}
          >
            <Icon className={`w-4 h-4 md:w-5 md:h-5 ${iconColorClass}`} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold truncate ${isMobile ? 'text-sm' : 'text-base'}`}>{title}</h3>
            <p className={`text-muted-foreground truncate ${isMobile ? 'text-[10px]' : 'text-xs'}`}>{subtitle}</p>
          </div>
        </motion.div>

        <div className="flex-1 space-y-2">
          <AnimatePresence mode="popLayout">
            {categoryPools.length > 0 ? (
              categoryPools.map((pool, i) => (
                <PoolItem 
                  key={`${categoryKey}-${pool.marketName}-${pool.tokenSymbol}`}
                  pool={pool} 
                  index={i} 
                  type={type}
                />
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-xs">{emptyMessage}</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div className={`grid gap-3 md:gap-4 ${
      isMobile 
        ? 'grid-cols-2'
        : 'grid-cols-2 lg:grid-cols-4'
    }`}>
      <CategoryCard
        title={`Top Stable ${isApy ? 'APY' : 'APR'}`}
        subtitle={`Native + Incentive ${isApy ? 'APY' : 'APR'}`}
        icon={TrendingUp}
        iconColorClass="text-success"
        bgColorClass="bg-success/10"
        pools={topStable}
        categoryKey="stable"
        type="supply"
        emptyMessage="No stablecoin opportunities found"
      />

      <CategoryCard
        title={`Top ETH ${isApy ? 'APY' : 'APR'}`}
        subtitle={`Native + Incentive ${isApy ? 'APY' : 'APR'}`}
        icon={TrendingUp}
        iconColorClass="text-success"
        bgColorClass="bg-success/10"
        pools={topEth}
        categoryKey="eth"
        type="supply"
        emptyMessage="No ETH-related opportunities found"
      />

      <CategoryCard
        title={`Top BTC ${isApy ? 'APY' : 'APR'}`}
        subtitle={`Native + Incentive ${isApy ? 'APY' : 'APR'}`}
        icon={TrendingUp}
        iconColorClass="text-success"
        bgColorClass="bg-success/10"
        pools={topBtc}
        categoryKey="btc"
        type="supply"
        emptyMessage="No BTC-related opportunities found"
      />

      <CategoryCard
        title="Leverage Opportunities"
        subtitle={`Supply - Borrow ${isApy ? 'APY' : 'APR'}`}
        icon={Zap}
        iconColorClass="text-warning"
        bgColorClass="bg-warning/10"
        pools={topLooping}
        categoryKey="leverage"
        type="leverage"
        emptyMessage="No looping opportunities found"
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
