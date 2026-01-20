import { useState, useEffect, useMemo, memo } from 'react';
import { TrendingUp, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';

interface TopOpportunitiesProps {
  pools: PoolWithSpread[];
  isApy: boolean;
}

const DISPLAY_COUNT = 5;

const TopOpportunities = ({ pools, isApy }: TopOpportunitiesProps) => {
  const isMobile = useIsMobile();
  const [tooltipState, setTooltipState] = useState<{
    pool: PoolWithSpread;
    type: 'supply' | 'borrow';
    position: { x: number; y: number };
    triggerCenterX: number;
  } | null>(null);

  // Calculate totals for all pools (frontend calculates incentive totals from details)
  // Memoize to prevent recalculation when props haven't changed
  const poolsWithTotals = useMemo(() => pools.map(pool => {
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
  }), [pools]);

  const isStablecoin = (symbol: string): boolean => {
    return STABLECOINS.some(s => symbol.toUpperCase().includes(s.toUpperCase()));
  };

  const isEthRelated = (symbol: string): boolean => {
    return ETH_RELATED.some(s => symbol.toUpperCase().includes(s.toUpperCase()));
  };

  const isBtcRelated = (symbol: string): boolean => {
    return BTC_RELATED.some(s => symbol.toUpperCase().includes(s.toUpperCase()));
  };

  // Top 5 Stable APY - memoized to prevent recalculation
  const topStable = useMemo(() => [...poolsWithTotals]
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
    .slice(0, DISPLAY_COUNT), [poolsWithTotals, isApy]);

  // Top 5 ETH APY - memoized to prevent recalculation
  const topEth = useMemo(() => [...poolsWithTotals]
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
    .slice(0, DISPLAY_COUNT), [poolsWithTotals, isApy]);

  // Top 5 BTC APY - memoized to prevent recalculation
  const topBtc = useMemo(() => [...poolsWithTotals]
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
    .slice(0, DISPLAY_COUNT), [poolsWithTotals, isApy]);

  // Top 5 Looping opportunities - memoized to prevent recalculation
  const topLooping = useMemo(() => [...poolsWithTotals]
    .filter(m => {
      const spread = isApy ? m.apySpread : m.aprSpread;
      return spread !== null && spread > 0;
    })
    .sort((a, b) => {
      const aSpread = isApy ? a.apySpread : a.aprSpread;
      const bSpread = isApy ? b.apySpread : b.aprSpread;
      return (bSpread || 0) - (aSpread || 0);
    })
    .slice(0, DISPLAY_COUNT), [poolsWithTotals, isApy]);

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
    const { iconSymbol } = fetchIconSymbolAndName({
      underlyingAsset: pool.tokenAddress,
      symbol: pool.tokenSymbol,
      name: pool.tokenName,
    });

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
        {/* Token Info - Flex grow with stacked icon layout */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Token icon with chain badge overlay */}
          <div className="relative shrink-0">
            <TokenIcon
              symbol={iconSymbol}
              size={isMobile ? 32 : 36}
              loading="eager"
            />
            {chainIconSrc && (
              <img 
                src={chainIconSrc} 
                alt={pool.chainName} 
                className={`absolute -bottom-0.5 -right-0.5 rounded-full bg-background ring-1 ring-background ${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`}
              />
            )}
          </div>
          {/* Token name and market */}
          <div className="min-w-0 flex-1">
            <p className={`font-semibold text-foreground truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
              {pool.tokenSymbol}
            </p>
            <div className="flex items-center gap-1">
              <p className={`text-secondary truncate ${isMobile ? 'text-[10px]' : 'text-xs'}`}>{getMarketDisplayName(pool)}</p>
            </div>
          </div>
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
          {isLeverage && (
            <div className={`text-secondary tabular-nums mt-0.5 ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}>
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

  // Mobile carousel state
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!api) {
      return;
    }

    setCurrent(api.selectedScrollSnap());
    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    });
  }, [api]);

  const categories = [
    {
      title: `Top Stable ${isApy ? 'APY' : 'APR'}`,
      subtitle: `Native + Incentive ${isApy ? 'APY' : 'APR'}`,
      icon: TrendingUp,
      iconColorClass: "text-success",
      bgColorClass: "bg-success/10",
      pools: topStable,
      categoryKey: "stable",
      type: "supply" as const,
      emptyMessage: "No stablecoin opportunities found"
    },
    {
      title: `Top ETH ${isApy ? 'APY' : 'APR'}`,
      subtitle: `Native + Incentive ${isApy ? 'APY' : 'APR'}`,
      icon: TrendingUp,
      iconColorClass: "text-success",
      bgColorClass: "bg-success/10",
      pools: topEth,
      categoryKey: "eth",
      type: "supply" as const,
      emptyMessage: "No ETH-related opportunities found"
    },
    {
      title: `Top BTC ${isApy ? 'APY' : 'APR'}`,
      subtitle: `Native + Incentive ${isApy ? 'APY' : 'APR'}`,
      icon: TrendingUp,
      iconColorClass: "text-success",
      bgColorClass: "bg-success/10",
      pools: topBtc,
      categoryKey: "btc",
      type: "supply" as const,
      emptyMessage: "No BTC-related opportunities found"
    },
    {
      title: "Leverage Opportunities",
      subtitle: `Supply - Borrow ${isApy ? 'APY' : 'APR'}`,
      icon: Zap,
      iconColorClass: "text-warning",
      bgColorClass: "bg-warning/10",
      pools: topLooping,
      categoryKey: "leverage",
      type: "leverage" as const,
      emptyMessage: "No looping opportunities found"
    }
  ];

  // Desktop grid layout
  if (!isMobile) {
    return (
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => (
          <CategoryCard
            key={category.categoryKey}
            title={category.title}
            subtitle={category.subtitle}
            icon={category.icon}
            iconColorClass={category.iconColorClass}
            bgColorClass={category.bgColorClass}
            pools={category.pools}
            categoryKey={category.categoryKey}
            type={category.type}
            emptyMessage={category.emptyMessage}
          />
        ))}

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
  }

  // Mobile carousel layout
  return (
    <div className="relative">
      <Carousel
        setApi={setApi}
        opts={{
          align: "center",
          loop: false,
          dragFree: false,
          containScroll: "trimSnaps",
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {categories.map((category, index) => (
            <CarouselItem key={category.categoryKey} className="pl-2 md:pl-4 basis-[85%] sm:basis-[85%]">
              <div className="relative h-full">
                <CategoryCard
                  title={category.title}
                  subtitle={category.subtitle}
                  icon={category.icon}
                  iconColorClass={category.iconColorClass}
                  bgColorClass={category.bgColorClass}
                  pools={category.pools}
                  categoryKey={category.categoryKey}
                  type={category.type}
                  emptyMessage={category.emptyMessage}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Navigation arrows - positioned on card edges */}
        {canScrollPrev && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full bg-background/90 backdrop-blur-sm border shadow-lg pointer-events-auto hover:bg-accent"
              onClick={() => api?.scrollPrev()}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="sr-only">Previous slide</span>
            </Button>
          </div>
        )}
        {canScrollNext && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full bg-background/90 backdrop-blur-sm border shadow-lg pointer-events-auto hover:bg-accent"
              onClick={() => api?.scrollNext()}
            >
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="sr-only">Next slide</span>
            </Button>
          </div>
        )}
      </Carousel>

      {/* Pagination indicators */}
      <div className="flex justify-center items-center gap-2 mt-4">
        {categories.map((_, index) => (
          <button
            key={index}
            className={`transition-all rounded-full ${
              current === index
                ? 'w-2.5 h-2.5 bg-primary'
                : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
            onClick={() => api?.scrollTo(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
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

// Memoize component to prevent re-renders when parent state changes (e.g., filter buttons)
// Only re-render when pools data actually changed or isApy changed
export default memo(TopOpportunities, (prevProps, nextProps) => {
  // If isApy changed, always re-render
  if (prevProps.isApy !== nextProps.isApy) {
    return false;
  }
  
  // If pools array reference is the same, no re-render needed
  if (prevProps.pools === nextProps.pools) {
    return true;
  }
  
  // If pools arrays have different lengths, data changed
  if (prevProps.pools.length !== nextProps.pools.length) {
    return false;
  }
  
  // If both arrays are empty, no change
  if (prevProps.pools.length === 0) {
    return true;
  }
  
  // Deep comparison: compare all items' tokenAddress values
  // This ensures we detect changes in the middle of the array or reordering
  for (let i = 0; i < prevProps.pools.length; i++) {
    const prevPool = prevProps.pools[i];
    const nextPool = nextProps.pools[i];
    
    // Compare tokenAddress (unique identifier) and marketName (for disambiguation)
    if (prevPool?.tokenAddress !== nextPool?.tokenAddress || 
        prevPool?.marketName !== nextPool?.marketName) {
      return false; // Data changed, allow re-render
    }
  }
  
  // All items match, skip re-render
  return true;
});
