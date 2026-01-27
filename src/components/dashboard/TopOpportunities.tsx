import { useState, useEffect, useMemo, memo } from 'react';
import { TrendingUp, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PoolWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import {
  isStablecoinSymbol,
  isEthRelatedSymbol,
  isBtcRelatedSymbol,
  TokenCategoryGroups,
} from '@/lib/tokenCategories';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { getChainIconSrc } from '@/lib/chainIcons';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';

interface TopOpportunitiesProps {
  pools: PoolWithSpread[];
  isApy: boolean;
  categoryGroups: TokenCategoryGroups;
  onIncentiveClick?: (payload: {
    pool: PoolWithSpread;
    type: 'supply' | 'borrow';
    position: { x: number; y: number };
    triggerCenterX: number;
    accentBorderClass?: string;
    accentTextClass?: string;
    accentBgClass?: string;
  }) => void;
}

const DISPLAY_COUNT = 5;

const TopOpportunities = ({ pools, isApy, categoryGroups, onIncentiveClick }: TopOpportunitiesProps) => {
  const isMobile = useIsMobile();

  // Calculate totals for all pools (frontend calculates incentive totals from details)
  // Memoize to prevent recalculation when props haven't changed
  const poolsWithTotals = useMemo(() => pools.map(pool => {
    const getIncentiveValues = (type: 'supply' | 'borrow') => {
      const protocolIncentives = type === 'supply' ? pool.supplyIncentives : pool.borrowIncentives;
      const meritIncentives = type === 'supply' ? pool.meritSupplys : pool.meritBorrows;
      const merklOpportunities = type === 'supply' ? pool.merklSupplys : pool.merklBorrows;
      const brevisIncentives = type === 'supply' ? pool.brevisSupplys : pool.brevisBorrows;
      const brevisLegacyApr = type === 'supply' ? pool.brevisSupplyApr : pool.brevisBorrowApr;
      const brevisSource = brevisIncentives && brevisIncentives.length > 0 ? brevisIncentives : brevisLegacyApr ?? null;
      return {
        apr: calculateTotalIncentiveApr(meritIncentives, merklOpportunities, brevisSource, protocolIncentives),
        apy: calculateTotalIncentiveApy(meritIncentives, merklOpportunities, brevisSource, protocolIncentives),
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

  // Top 5 Stable APY - memoized to prevent recalculation
  const topStable = useMemo(() => [...poolsWithTotals]
    .filter(m => isStablecoinSymbol(m.tokenSymbol, categoryGroups))
    .filter(m => {
      const value = isApy ? m.totalSupplyApy : m.totalSupplyApr;
      return value !== null && !isNaN(value);
    })
    .sort((a, b) => {
      const aValue = isApy ? a.totalSupplyApy : a.totalSupplyApr;
      const bValue = isApy ? b.totalSupplyApy : b.totalSupplyApr;
      return bValue - aValue;
    })
    .slice(0, DISPLAY_COUNT), [poolsWithTotals, isApy, categoryGroups]);

  // Top 5 ETH APY - memoized to prevent recalculation
  const topEth = useMemo(() => [...poolsWithTotals]
    .filter(m => isEthRelatedSymbol(m.tokenSymbol, categoryGroups))
    .filter(m => {
      const value = isApy ? m.totalSupplyApy : m.totalSupplyApr;
      return value !== null && !isNaN(value);
    })
    .sort((a, b) => {
      const aValue = isApy ? a.totalSupplyApy : a.totalSupplyApr;
      const bValue = isApy ? b.totalSupplyApy : b.totalSupplyApr;
      return bValue - aValue;
    })
    .slice(0, DISPLAY_COUNT), [poolsWithTotals, isApy, categoryGroups]);

  // Top 5 BTC APY - memoized to prevent recalculation
  const topBtc = useMemo(() => [...poolsWithTotals]
    .filter(m => isBtcRelatedSymbol(m.tokenSymbol, categoryGroups))
    .filter(m => {
      const value = isApy ? m.totalSupplyApy : m.totalSupplyApr;
      return value !== null && !isNaN(value);
    })
    .sort((a, b) => {
      const aValue = isApy ? a.totalSupplyApy : a.totalSupplyApr;
      const bValue = isApy ? b.totalSupplyApy : b.totalSupplyApr;
      return bValue - aValue;
    })
    .slice(0, DISPLAY_COUNT), [poolsWithTotals, isApy, categoryGroups]);

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
      return ETHEREUM_MARKET_NAMES[pool.marketName];
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
    accentValue: number | null,
  ) => {
    e.stopPropagation();
    if (incentiveValue === null || isNaN(incentiveValue) || incentiveValue < 0.01) return;
    if (!onIncentiveClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;
    if (import.meta.env.DEV) {
      const target = e.currentTarget as HTMLElement;
      const style = window.getComputedStyle(target);
      const parent = target.parentElement;
      const parentStyle = parent ? window.getComputedStyle(parent) : null;
      console.debug('[TopOpportunities] Incentive rect', rect);
      console.debug('[TopOpportunities] Incentive transform', style.transform);
      console.debug('[TopOpportunities] Parent transform', parentStyle?.transform || 'none');
    }
    onIncentiveClick({
      pool,
      type,
      position: { x: rect.left, y: rect.bottom },
      triggerCenterX,
      accentBorderClass: getAccentBorderClass(accentValue),
      accentTextClass: getAccentTextClass(accentValue),
      accentBgClass: getAccentBgClass(accentValue),
    });
  };

  const getApyColorClass = (value: number | null) => {
    if (value === null) return 'text-muted-foreground';
    if (value >= 15) return 'ds-text-emerald-600';
    if (value >= 10) return 'ds-text-emerald-500';
    if (value >= 5) return 'ds-text-teal-500-70';
    if (value >= 2) return 'ds-text-teal-400-70';
    if (value >= 1) return 'ds-text-cyan-500-70';
    return 'text-muted-foreground/70';
  };

  const getApyAccentClasses = (value: number | null) => {
    if (value === null) {
      return {
        text: 'text-muted-foreground',
        chip: 'bg-muted text-muted-foreground/70 ring-border/70 hover:bg-muted/80',
      };
    }
    if (value >= 15) {
      return {
        text: 'ds-text-emerald-600-70',
        chip: 'ds-bg-emerald-500-10 ds-text-emerald-600-70 ds-ring-emerald-500-15 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.2)]',
      };
    }
    if (value >= 10) {
      return {
        text: 'ds-text-emerald-500-70',
        chip: 'ds-bg-emerald-500-10 ds-text-emerald-500-70 ds-ring-emerald-500-15 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.2)]',
      };
    }
    if (value >= 5) {
      return {
        text: 'ds-text-teal-500-70',
        chip: 'ds-bg-teal-500-10 ds-text-teal-500-70 ds-ring-teal-500-15 hover:bg-[rgb(var(--ds-teal-500-rgb)/0.2)]',
      };
    }
    if (value >= 2) {
      return {
        text: 'ds-text-teal-400-70',
        chip: 'ds-bg-teal-400-10 ds-text-teal-400-70 ds-ring-teal-400-15 hover:bg-[rgb(var(--ds-teal-400-rgb)/0.2)]',
      };
    }
    if (value >= 1) {
      return {
        text: 'ds-text-cyan-500-70',
        chip: 'ds-bg-cyan-500-10 ds-text-cyan-500-70 ds-ring-cyan-500-15 hover:bg-[rgb(var(--ds-cyan-500-rgb)/0.2)]',
      };
    }
    return {
      text: 'text-muted-foreground/70',
      chip: 'bg-muted/40 text-muted-foreground/70 ring-border/40 hover:bg-muted/60',
    };
  };

  const getAccentBorderClass = (value: number | null) => {
    if (value === null) return 'border-l-[3px] border-l-border/40';
    if (value >= 15) return 'border-l-[3px] border-l-[rgb(var(--ds-emerald-600-rgb)/0.35)]';
    if (value >= 10) return 'border-l-[3px] border-l-[rgb(var(--ds-emerald-500-rgb)/0.35)]';
    if (value >= 5) return 'border-l-[3px] border-l-[rgb(var(--ds-teal-500-rgb)/0.35)]';
    if (value >= 2) return 'border-l-[3px] border-l-[rgb(var(--ds-teal-400-rgb)/0.35)]';
    if (value >= 1) return 'border-l-[3px] border-l-[rgb(var(--ds-cyan-500-rgb)/0.35)]';
    return 'border-l-[3px] border-l-border/40';
  };

  const getAccentTextClass = (value: number | null) => {
    if (value === null) return 'text-muted-foreground';
    if (value >= 15) return 'ds-text-emerald-600';
    if (value >= 10) return 'ds-text-emerald-500';
    if (value >= 5) return 'ds-text-teal-500-70';
    if (value >= 2) return 'ds-text-teal-400-70';
    if (value >= 1) return 'ds-text-cyan-500-70';
    return 'text-muted-foreground/70';
  };

  const getAccentBgClass = (value: number | null) => {
    if (value === null) return 'bg-muted/40';
    if (value >= 15) return 'ds-bg-emerald-500-10';
    if (value >= 10) return 'ds-bg-emerald-500-10';
    if (value >= 5) return 'ds-bg-teal-500-10';
    if (value >= 2) return 'ds-bg-teal-400-10';
    if (value >= 1) return 'ds-bg-cyan-500-10';
    return 'bg-muted/40';
  };


  const getSpreadColorClass = (value: number | null, index: number = 0, total: number = 5) => {
    if (value === null) return 'text-muted-foreground';
    // Create gradient from high to low: darker purple for high values, lighter pink for low values
    // Index 0 = highest value (darkest), index 4 = lowest value (lightest)
    const intensity = 1 - (index / Math.max(total - 1, 1)); // 1.0 for first item, 0.0 for last item
    
    if (intensity >= 0.8) {
      // Highest values: deep purple
      return 'bg-gradient-to-r from-purple-700 via-purple-600 to-purple-600 text-transparent bg-clip-text';
    } else if (intensity >= 0.6) {
      // High values: purple
      return 'bg-gradient-to-r from-purple-600 via-purple-500 to-fuchsia-500 text-transparent bg-clip-text';
    } else if (intensity >= 0.4) {
      // Medium values: purple to fuchsia
      return 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-fuchsia-500 text-transparent bg-clip-text';
    } else if (intensity >= 0.2) {
      // Low values: fuchsia to pink
      return 'bg-gradient-to-r from-fuchsia-500 via-fuchsia-400 to-pink-500 text-transparent bg-clip-text';
    } else {
      // Lowest values: light pink
      return 'bg-gradient-to-r from-fuchsia-400 via-pink-400 to-pink-400 text-transparent bg-clip-text';
    }
  };

  const getSpreadAccentClass = (value: number | null, index: number = 0, total: number = 5) => {
    if (value === null) return 'text-muted-foreground';
    const intensity = 1 - (index / Math.max(total - 1, 1));
    if (intensity >= 0.8) return 'ds-text-purple-600-70';
    if (intensity >= 0.6) return 'ds-text-purple-500-70';
    if (intensity >= 0.4) return 'text-fuchsia-500/70';
    if (intensity >= 0.2) return 'text-fuchsia-400/70';
    return 'ds-text-pink-400-70';
  };
  // Mobile mini card component for 2-column grid layout
  const MiniPoolCard = ({
    pool,
    index,
    type,
    totalItems = 5
  }: {
    pool: typeof poolsWithTotals[0];
    index: number;
    type: 'supply' | 'leverage';
    totalItems?: number;
  }) => {
    const isLeverage = type === 'leverage';
    const mainValue = isLeverage
      ? (isApy ? pool.apySpread : pool.aprSpread)
      : (isApy ? pool.totalSupplyApy : pool.totalSupplyApr);
    const incentiveValue = isApy ? pool.supplyIncentiveApy : pool.supplyIncentiveApr;
    const hasIncentive = incentiveValue !== null && !isNaN(incentiveValue) && incentiveValue >= 0.01;
    const apyAccent = getApyAccentClasses(mainValue);
    const chainIconSrc = getChainIconSrc(pool.chainName);
    const { iconSymbol, logoURI } = fetchIconSymbolAndName({
      underlyingAsset: pool.tokenAddress,
      symbol: pool.tokenSymbol,
      name: pool.tokenName,
    });

    return (
      <motion.div
        custom={index}
        initial={false}
        animate="visible"
        variants={itemVariants}
        className="rounded-xl border ds-card-pad-sm cursor-pointer transition-colors bg-card border-border/60 active:bg-muted/60 h-[72px] flex flex-col justify-between"
        onClick={() => handleCardClick(pool)}
      >
        {/* Header: Token + Market + Arrow */}
        <div className="flex items-center gap-[var(--ds-space-2)]">
          <TokenIcon
            symbol={iconSymbol}
            size={24}
            loading="eager"
            className="shrink-0"
            logoURI={logoURI}
          />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground ds-text-12 truncate">{pool.tokenSymbol}</p>
            <div className="flex items-center gap-[var(--ds-space-1)] ds-text-9 text-muted-foreground">
              {chainIconSrc && (
                <img src={chainIconSrc} alt={pool.chainName} className="w-3 h-3" />
              )}
              <span className="truncate">{getMarketDisplayName(pool)}</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
        </div>

        {/* Main value + detail row */}
        <div className="flex items-baseline justify-between gap-[var(--ds-space-1)]">
          <span className={`font-bold ds-text-14 tabular-nums ${isLeverage ? getSpreadColorClass(mainValue, index, totalItems) : getApyColorClass(mainValue)}`}>
            {isLeverage ? formatSpread(mainValue) : formatPercent(mainValue)}
          </span>
          {/* Incentive badge for supply type */}
          {!isLeverage && hasIncentive && (
            <button
              type="button"
              onClick={(e) => handleIncentiveClick(e, pool, 'supply', incentiveValue, mainValue)}
              className={`inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-1)] py-[var(--ds-space-0-5)] rounded-full ring-1 transition-colors cursor-pointer tabular-nums ds-text-9 ${apyAccent.chip}`}
            >
              <span>+{formatPercent(incentiveValue)}</span>
              <IncentiveIcon width={7} height={7} />
            </button>
          )}
          {/* Leverage detail inline */}
          {isLeverage && (
            <span className={`${getSpreadAccentClass(mainValue, index, totalItems)} tabular-nums ds-text-9`}>
              {formatPercent(isApy ? pool.totalSupplyApy : pool.totalSupplyApr)} - {formatPercent(isApy ? pool.totalBorrowApy : pool.totalBorrowApr)}
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  // Reusable pool item component (for desktop)
  const PoolItem = ({ 
    pool, 
    index, 
    type,
    totalItems = 5
  }: { 
    pool: typeof poolsWithTotals[0]; 
    index: number;
    type: 'supply' | 'leverage';
    totalItems?: number;
  }) => {
    const isLeverage = type === 'leverage';
    const mainValue = isLeverage 
      ? (isApy ? pool.apySpread : pool.aprSpread)
      : (isApy ? pool.totalSupplyApy : pool.totalSupplyApr);
    const incentiveValue = isApy ? pool.supplyIncentiveApy : pool.supplyIncentiveApr;
    const hasIncentive = incentiveValue !== null && !isNaN(incentiveValue) && incentiveValue >= 0.01;
    const apyAccent = getApyAccentClasses(mainValue);
    const chainIconSrc = getChainIconSrc(pool.chainName);
    const { iconSymbol, logoURI } = fetchIconSymbolAndName({
      underlyingAsset: pool.tokenAddress,
      symbol: pool.tokenSymbol,
      name: pool.tokenName,
    });

    return (
      <motion.div 
        custom={index}
        initial={isMobile ? false : "hidden"}
        animate="visible"
        variants={itemVariants}
        className={`flex items-center rounded-lg border transition-all group cursor-pointer h-[56px] ${
          isLeverage 
            ? 'bg-background border-border hover:border-[rgb(var(--ds-purple-500-rgb)/0.5)]'
            : 'bg-gradient-to-r from-background to-success/5 border-border hover:border-success/50'
        } ${isMobile ? 'px-[var(--ds-space-2-5)] gap-[var(--ds-space-2)]' : 'px-[var(--ds-space-3)] gap-[var(--ds-space-2)]'}`}
        onClick={() => handleCardClick(pool)}
      >
        {/* Token Info - Mobile style layout: large icon left, text right */}
        <div className="grid grid-cols-[auto,1fr,auto] grid-rows-[auto,auto] content-center items-center gap-x-[var(--ds-space-2)] gap-y-[var(--ds-space-1)] flex-1 min-w-0 h-full">
          <TokenIcon
            symbol={iconSymbol}
            size={isMobile ? 28 : 32}
            loading="eager"
            className="shrink-0 row-span-2"
            logoURI={logoURI}
          />
          <p className={`font-semibold text-foreground truncate leading-none ${isMobile ? 'ds-text-14' : 'ds-text-14'}`}>
            {pool.tokenSymbol}
          </p>
          <div
            className={`${(isLeverage ? getSpreadColorClass(mainValue, index, totalItems) : getApyColorClass(mainValue))} font-bold tabular-nums text-right leading-none ${isMobile ? 'ds-text-16' : 'ds-text-18'} ${!isLeverage && !hasIncentive ? 'row-span-2 self-center' : ''}`}
          >
            {isLeverage ? formatSpread(mainValue) : formatPercent(mainValue)}
          </div>
          <div className="flex items-center gap-[var(--ds-space-1)] min-w-0 leading-none">
            {chainIconSrc && (
              <img src={chainIconSrc} alt={pool.chainName} className="shrink-0 w-3.5 h-3.5" />
            )}
            <p className="text-secondary truncate ds-text-11 leading-none">{getMarketDisplayName(pool)}</p>
          </div>
          {/* Detail breakdown - Only show for supply type */}
          {!isLeverage && hasIncentive && (
            <div className="flex items-center justify-end gap-[var(--ds-space-0-5)] ds-text-11 text-secondary whitespace-nowrap leading-none">
              <span className={`${apyAccent.text} tabular-nums`}>{formatPercent(pool.supplyApy ?? null)}</span>
              {hasIncentive && (
                <>
                  <span className="text-muted-foreground">+</span>
                  <button
                    type="button"
                    onClick={(e) => handleIncentiveClick(e, pool, 'supply', incentiveValue, mainValue)}
                    className={`inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full ring-1 transition-colors cursor-pointer tabular-nums ${apyAccent.chip}`}
                  >
                    <span>{formatPercent(incentiveValue)}</span>
                    <IncentiveIcon width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} />
                  </button>
                </>
              )}
            </div>
          )}
          {/* Leverage detail */}
          {isLeverage && (
            <div className={`${getSpreadAccentClass(mainValue, index, totalItems)} tabular-nums whitespace-nowrap text-right leading-none ds-text-11`}>
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
        <div className={`bg-card border border-border/60 shadow-sm rounded-xl ${isMobile ? 'ds-card-pad-sm' : 'ds-card-pad'} ${isMobile ? 'col-span-1' : ''} flex flex-col`}>
        <motion.div 
          className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-3)]"
          initial={isMobile ? false : "hidden"}
          animate="visible"
          variants={headerVariants}
        >
          <motion.div 
            className={`p-[var(--ds-space-2)] rounded-lg ${bgColorClass}`}
            variants={iconVariants}
            initial={isMobile ? false : "hidden"}
            animate={["visible", "pulse"]}
          >
            <Icon className={`w-4 h-4 md:w-5 md:h-5 ${iconColorClass}`} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold truncate ${isMobile ? 'ds-text-14' : 'ds-text-16'}`}>{title}</h3>
            <p className="text-muted-foreground truncate ds-text-11">{subtitle}</p>
          </div>
        </motion.div>

        <div className="flex-1 space-y-[var(--ds-space-1-5)]">
          <AnimatePresence mode="popLayout">
            {categoryPools.length > 0 ? (
              categoryPools.map((pool, i) => (
                isMobile ? (
                  <MiniPoolCard
                    key={`${categoryKey}-${pool.marketName}-${pool.tokenSymbol}`}
                    pool={pool}
                    index={i}
                    type={type}
                    totalItems={categoryPools.length}
                  />
                ) : (
                  <PoolItem 
                    key={`${categoryKey}-${pool.marketName}-${pool.tokenSymbol}`}
                    pool={pool} 
                    index={i} 
                    type={type}
                    totalItems={categoryPools.length}
                  />
                )
              ))
            ) : (
              <div className="text-center py-[var(--ds-space-6)] text-muted-foreground">
                <p className="ds-text-11">{emptyMessage}</p>
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
      iconColorClass: "ds-text-purple-500",
      bgColorClass: "ds-bg-purple-500-10",
      pools: topLooping,
      categoryKey: "leverage",
      type: "leverage" as const,
      emptyMessage: "No looping opportunities found"
    }
  ];

  // Desktop and tablet grid layout (2x2 on medium screens, 4 columns on large)
  if (!isMobile) {
    return (
      <div className="grid gap-[var(--ds-space-3)] md:gap-[var(--ds-space-4)] grid-cols-2 xl:grid-cols-4">
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
      </div>
    );
  }

  // Mobile carousel layout - 2 pages, each with 2 categories
  const mobilePages = [
    [categories[0], categories[1]], // Page 1: Stable + ETH
    [categories[2], categories[3]], // Page 2: BTC + Leverage
  ];

  return (
    <div className="relative">
      <Carousel
        setApi={setApi}
        opts={{
          align: "start",
          loop: false,
          dragFree: false,
          containScroll: "trimSnaps",
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-[var(--ds-space-2)]">
          {mobilePages.map((pageCats, pageIndex) => (
            <CarouselItem key={pageIndex} className="pl-[var(--ds-space-2)] basis-full">
              <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
                {pageCats.map((category) => (
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
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Navigation arrows - lighter style to differentiate from card arrows */}
        {canScrollPrev && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <button
              type="button"
              className="w-6 h-6 flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors pointer-events-auto"
              onClick={() => api?.scrollPrev()}
            >
              <ChevronLeft className="h-3 w-3" />
              <span className="sr-only">Previous slide</span>
            </button>
          </div>
        )}
        {canScrollNext && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <button
              type="button"
              className="w-6 h-6 flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors pointer-events-auto"
              onClick={() => api?.scrollNext()}
            >
              <ChevronRight className="h-3 w-3" />
              <span className="sr-only">Next slide</span>
            </button>
          </div>
        )}
      </Carousel>

      {/* Pagination indicators - 2 dots for 2 pages */}
      <div className="flex justify-center items-center gap-[var(--ds-space-2)] mt-[var(--ds-space-4)]">
        {mobilePages.map((_, index) => (
          <button
            key={index}
            className={`transition-all rounded-full ${
              current === index
                ? 'ds-dot-active bg-primary'
                : 'ds-dot bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
            onClick={() => api?.scrollTo(index)}
            aria-label={`Go to page ${index + 1}`}
          />
        ))}
      </div>
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

  if (prevProps.onIncentiveClick !== nextProps.onIncentiveClick) {
    return false;
  }

  if (prevProps.categoryGroups !== nextProps.categoryGroups) {
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
