import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { TrendingUp, Zap, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReserveWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
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
  calculateTotalIncentiveApy,
  apyToApr
} from '@/lib/formatters';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChainIconSrc } from '@/lib/chainIcons';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { shouldSkipTopOpportunitiesRender } from '@/lib/topOpportunitiesMemo';

interface TopOpportunitiesProps {
  reserves: ReserveWithSpread[];
  isApy: boolean;
  isRateDragging?: boolean;
  includeWhitelistOnlyMerkl: boolean;
  categoryGroups: TokenCategoryGroups;
  onIncentiveClick?: (payload: {
    reserve: ReserveWithSpread;
    type: 'supply' | 'borrow';
    position: { x: number; y: number };
    triggerCenterX: number;
    triggerHeight: number;
    triggerRect: { top: number; bottom: number; left: number; right: number; width: number; height: number };
    accentBorderClass?: string;
    accentTextClass?: string;
    accentBgClass?: string;
  }) => void;
  onCardClick?: (reserve: Pick<ReserveWithSpread, 'marketName' | 'tokenAddress'>) => void;
  tydroPointToUsdRate: number;
}

const DISPLAY_COUNT = 5;

const XL_BREAKPOINT = 1280;

interface CategoryCardHeaderProps {
  title: string;
  shortTitle?: string;
  subtitle: string;
  icon: React.ElementType;
  iconColorClass: string;
  bgColorClass: string;
  isMobile: boolean;
  shouldAnimateHeader: boolean;
  headerVariants: Record<string, unknown>;
  iconVariants: Record<string, unknown>;
}

const CategoryCardHeader = memo(({
  title,
  shortTitle,
  subtitle,
  icon: Icon,
  iconColorClass,
  bgColorClass,
  isMobile,
  shouldAnimateHeader,
  headerVariants,
  iconVariants,
}: CategoryCardHeaderProps) => {
  const HeaderWrapper: React.ElementType = shouldAnimateHeader ? motion.div : 'div';
  const IconWrapper: React.ElementType = shouldAnimateHeader ? motion.div : 'div';

  return (
    <HeaderWrapper
      className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-3)]"
      {...(shouldAnimateHeader
        ? { initial: 'hidden', animate: 'visible', variants: headerVariants }
        : {})}
    >
      <IconWrapper
        className={`p-[var(--ds-space-2)] rounded-lg ${bgColorClass}`}
        {...(shouldAnimateHeader
          ? { variants: iconVariants, initial: 'hidden', animate: ['visible', 'pulse'] as const }
          : {})}
      >
        <Icon className={`w-4 h-4 md:w-5 md:h-5 ${iconColorClass}`} />
      </IconWrapper>
      <div className="flex-1 min-w-0">
        <h3 className={`font-bold truncate ${isMobile ? 'ds-text-14' : 'ds-text-16'}`}>{title}</h3>
        <p className="text-muted-foreground truncate ds-text-11">{subtitle}</p>
      </div>
    </HeaderWrapper>
  );
});

interface ReserveIdentityProps {
  iconSymbol: string;
  logoURI?: string | null;
  tokenSymbol: string;
  chainName: string;
  chainIconSrc?: string;
  marketDisplayName: string;
  isMobile: boolean;
  mini?: boolean;
  aaveUrl?: string;
}

const ReserveIdentity = memo(({
  iconSymbol,
  logoURI,
  tokenSymbol,
  chainName,
  chainIconSrc,
  marketDisplayName,
  isMobile,
  mini = false,
  aaveUrl,
}: ReserveIdentityProps) => {
  if (mini) {
    return (
      <div className="flex items-center gap-[var(--ds-space-2)]">
        <TokenIcon
          symbol={iconSymbol}
          size={24}
          loading="eager"
          className="shrink-0"
          logoURI={logoURI}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center">
            <a
              href={aaveUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="group/token inline-flex items-center gap-[var(--ds-space-2)] hover:opacity-80 transition-opacity duration-150"
              aria-label={`Open ${tokenSymbol} on Aave`}
              title="Open on Aave"
            >
              <span className="font-bold text-foreground ds-text-12 truncate">{tokenSymbol}</span>
              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 -ml-1 group-hover/token:opacity-70 transition-opacity duration-150 shrink-0" />
            </a>
          </div>
          <div className="flex items-center gap-[var(--ds-space-1)] ds-text-9 text-muted-foreground">
            {chainIconSrc && (
              <img src={chainIconSrc} alt={chainName} className="w-3 h-3" />
            )}
            <span className="truncate">{marketDisplayName}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
      </div>
    );
  }

  return (
    <>
      <TokenIcon
        symbol={iconSymbol}
        size={isMobile ? 28 : 32}
        loading="eager"
        className="shrink-0 row-span-2"
        logoURI={logoURI}
      />
      <div className="flex items-center min-w-0">
        <a
          href={aaveUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="group/token inline-flex items-center gap-[var(--ds-space-2)] hover:opacity-80 transition-opacity duration-150"
          aria-label={`Open ${tokenSymbol} on Aave`}
          title="Open on Aave"
        >
          <span className="font-semibold text-foreground truncate leading-none ds-text-14">
            {tokenSymbol}
          </span>
          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 -ml-1 group-hover/token:opacity-70 transition-opacity duration-150 shrink-0" />
        </a>
      </div>
      <div className="flex items-center gap-[var(--ds-space-1)] min-w-0 leading-none">
        {chainIconSrc && (
          <img src={chainIconSrc} alt={chainName} className="shrink-0 w-3.5 h-3.5" />
        )}
        <p className="text-secondary truncate ds-text-11 leading-none">{marketDisplayName}</p>
      </div>
    </>
  );
});

const TopOpportunities = ({
  reserves,
  isApy,
  isRateDragging = false,
  includeWhitelistOnlyMerkl,
  categoryGroups,
  onIncentiveClick,
  onCardClick,
  tydroPointToUsdRate,
}: TopOpportunitiesProps) => {
  const isMobile = useIsMobile();
  const [isXl, setIsXl] = useState(false);
  const prevIsApyRef = useRef(isApy);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${XL_BREAKPOINT}px)`);
    const onChange = () => setIsXl(mql.matches);
    mql.addEventListener('change', onChange);
    setIsXl(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  const isApyChanged = prevIsApyRef.current !== isApy;

  useEffect(() => {
    prevIsApyRef.current = isApy;
  }, [isApy]);

  // Calculate totals for all reserves (frontend calculates incentive totals from details)
  // Memoize to prevent recalculation when props haven't changed
  const reservesWithTotals = useMemo(() => reserves.map(reserve => {
    const getIncentiveValues = (type: 'supply' | 'borrow') => {
      const protocolIncentives = type === 'supply' ? reserve.supplyIncentives : reserve.borrowIncentives;
      const meritIncentives = type === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
      const merklOpportunities = type === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
      const brevisIncentives = type === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows;
      return {
        apr: calculateTotalIncentiveApr(
          meritIncentives,
          merklOpportunities,
          brevisIncentives,
          protocolIncentives,
          tydroPointToUsdRate,
          { includeWhitelistOnlyMerkl }
        ),
        apy: calculateTotalIncentiveApy(
          meritIncentives,
          merklOpportunities,
          brevisIncentives,
          protocolIncentives,
          tydroPointToUsdRate,
          { includeWhitelistOnlyMerkl }
        ),
      };
    };

    const supplyIncentive = getIncentiveValues('supply');
    const borrowIncentive = getIncentiveValues('borrow');

    const totalSupplyApy = calculateTotalSupplyApy(reserve.supplyApy, supplyIncentive.apy);
    const totalBorrowApy = calculateTotalBorrowApy(reserve.borrowApy, borrowIncentive.apy);
    const supplyNativeApr = reserve.supplyApy !== undefined && reserve.supplyApy !== null
      ? apyToApr(reserve.supplyApy)
      : null;
    const borrowNativeApr = reserve.borrowApy !== undefined && reserve.borrowApy !== null
      ? apyToApr(reserve.borrowApy)
      : null;
    const totalSupplyApr = calculateTotalSupplyApr(supplyNativeApr, supplyIncentive.apr);
    const totalBorrowApr = calculateTotalBorrowApr(borrowNativeApr, borrowIncentive.apr);

    return {
      ...reserve,
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
  }), [includeWhitelistOnlyMerkl, reserves, tydroPointToUsdRate]);

  // Top 5 Stable APY - memoized to prevent recalculation
  const topStable = useMemo(() => [...reservesWithTotals]
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
    .slice(0, DISPLAY_COUNT), [reservesWithTotals, isApy, categoryGroups]);

  // Top 5 ETH APY - memoized to prevent recalculation
  const topEth = useMemo(() => [...reservesWithTotals]
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
    .slice(0, DISPLAY_COUNT), [reservesWithTotals, isApy, categoryGroups]);

  // Top 5 BTC APY - memoized to prevent recalculation
  const topBtc = useMemo(() => [...reservesWithTotals]
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
    .slice(0, DISPLAY_COUNT), [reservesWithTotals, isApy, categoryGroups]);

  // Top 5 Looping opportunities - memoized to prevent recalculation
  const topLooping = useMemo(() => [...reservesWithTotals]
    .filter(m => {
      const spread = isApy ? m.apySpread : m.aprSpread;
      return spread !== null && spread > 0;
    })
    .sort((a, b) => {
      const aSpread = isApy ? a.apySpread : a.aprSpread;
      const bSpread = isApy ? b.apySpread : b.aprSpread;
      return (bSpread || 0) - (aSpread || 0);
    })
    .slice(0, DISPLAY_COUNT), [reservesWithTotals, isApy]);

  const getMarketDisplayName = (reserve: ReserveWithSpread) => {
    if (reserve.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[reserve.marketName]) {
      return ETHEREUM_MARKET_NAMES[reserve.marketName];
    }
    return reserve.chainName;
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

  const handleCardClick = (reserve: Pick<ReserveWithSpread, 'marketName' | 'tokenAddress'>) => {
    if (onCardClick) {
      onCardClick(reserve);
      return;
    }
    const url = buildAaveReserveUrl(reserve);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleIncentiveClick = (
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
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
      reserve,
      type,
      position: { x: rect.left, y: rect.bottom },
      triggerCenterX,
      triggerHeight: rect.height,
      triggerRect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      },
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
    if (value === null) return 'border-l-[4px] border-l-border/60';
    if (value >= 15) return 'border-l-[4px] border-l-[rgb(var(--ds-emerald-600-rgb)/0.7)]';
    if (value >= 10) return 'border-l-[4px] border-l-[rgb(var(--ds-emerald-500-rgb)/0.7)]';
    if (value >= 5) return 'border-l-[4px] border-l-[rgb(var(--ds-teal-500-rgb)/0.7)]';
    if (value >= 2) return 'border-l-[4px] border-l-[rgb(var(--ds-teal-400-rgb)/0.7)]';
    if (value >= 1) return 'border-l-[4px] border-l-[rgb(var(--ds-cyan-500-rgb)/0.7)]';
    return 'border-l-[4px] border-l-border/60';
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
  // Mobile mini card component for 2-column grid layout（恢复旧版样式）
  const MiniReserveCard = ({
    reserve,
    index,
    type,
    totalItems = 5,
    disableMotion = false,
  }: {
    reserve: typeof reservesWithTotals[0];
    index: number;
    type: 'supply' | 'leverage';
    totalItems?: number;
    disableMotion?: boolean;
  }) => {
    const isLeverage = type === 'leverage';
    const mainValue = isLeverage
      ? (isApy ? reserve.apySpread : reserve.aprSpread)
      : (isApy ? reserve.totalSupplyApy : reserve.totalSupplyApr);
    const incentiveValue = isApy ? reserve.supplyIncentiveApy : reserve.supplyIncentiveApr;
    const hasIncentive = incentiveValue !== null && !isNaN(incentiveValue) && incentiveValue >= 0.01;
    const apyAccent = getApyAccentClasses(mainValue);
    const chainIconSrc = getChainIconSrc(reserve.chainName);
    const { iconSymbol, logoURI } = fetchIconSymbolAndName({
      underlyingAsset: reserve.tokenAddress,
      symbol: reserve.tokenSymbol,
      name: reserve.tokenName,
    });
    const marketDisplayName = getMarketDisplayName(reserve);
    const aaveUrl = buildAaveReserveUrl(reserve);
    return (
      <motion.div
        {...(disableMotion
          ? { initial: false, animate: false as const }
          : {
          custom: index,
          initial: false,
          animate: 'visible',
          variants: itemVariants,
        })}
        className="rounded-xl border ds-card-pad-sm cursor-pointer transition-colors bg-card border-border/60 active:bg-muted/60 h-[68px] flex flex-col justify-between"
        onClick={() => handleCardClick(reserve)}
      >
        <ReserveIdentity
          mini
          iconSymbol={iconSymbol}
          logoURI={logoURI}
          tokenSymbol={reserve.tokenSymbol}
          chainName={reserve.chainName}
          chainIconSrc={chainIconSrc}
          marketDisplayName={marketDisplayName}
          isMobile={isMobile}
          aaveUrl={aaveUrl}
        />

        {/* Main value + detail row */}
        <div className="flex items-baseline justify-between gap-[var(--ds-space-1)] mt-[var(--ds-space-0-5)]">
          <span className={`font-bold ds-text-14 tabular-nums ${isLeverage ? getSpreadColorClass(mainValue, index, totalItems) : getApyColorClass(mainValue)}`}>
            {isLeverage ? formatSpread(mainValue) : formatPercent(mainValue)}
          </span>
          {/* Incentive badge for supply type */}
          {!isLeverage && hasIncentive && (
            <button
              type="button"
              onClick={(e) => handleIncentiveClick(e, reserve, 'supply', incentiveValue, mainValue)}
              className={`inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-1)] py-[var(--ds-space-0-5)] rounded-full ring-1 transition-colors cursor-pointer tabular-nums ds-text-9 ${apyAccent.chip}`}
            >
              <span>+{formatPercent(incentiveValue)}</span>
              <IncentiveIcon width={7} height={7} />
            </button>
          )}
          {/* Leverage detail inline */}
          {isLeverage && (
            <span className={`${getSpreadAccentClass(mainValue, index, totalItems)} tabular-nums ds-text-9`}>
              {formatPercent(isApy ? reserve.totalSupplyApy : reserve.totalSupplyApr)} - {formatPercent(isApy ? reserve.totalBorrowApy : reserve.totalBorrowApr)}
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  // Reusable reserve item component (for desktop)
  const ReserveItem = ({
    reserve, 
    index, 
    type,
    totalItems = 5,
    disableMotion = false
  }: { 
    reserve: typeof reservesWithTotals[0]; 
    index: number;
    type: 'supply' | 'leverage';
    totalItems?: number;
    disableMotion?: boolean;
  }) => {
    const isLeverage = type === 'leverage';
    const mainValue = isLeverage 
      ? (isApy ? reserve.apySpread : reserve.aprSpread)
      : (isApy ? reserve.totalSupplyApy : reserve.totalSupplyApr);
    const incentiveValue = isApy ? reserve.supplyIncentiveApy : reserve.supplyIncentiveApr;
    const hasIncentive = incentiveValue !== null && !isNaN(incentiveValue) && incentiveValue >= 0.01;
    const apyAccent = getApyAccentClasses(mainValue);
    const chainIconSrc = getChainIconSrc(reserve.chainName);
    const { iconSymbol, logoURI } = fetchIconSymbolAndName({
      underlyingAsset: reserve.tokenAddress,
      symbol: reserve.tokenSymbol,
      name: reserve.tokenName,
    });
    const shouldAnimateItem = !disableMotion && !isMobile && !isRateDragging;
    const aaveUrl = buildAaveReserveUrl(reserve);

    return (
      <motion.div
        {...(shouldAnimateItem
          ? { custom: index, initial: false, animate: 'visible', variants: itemVariants }
          : { initial: false, animate: false as const })}
        className={`flex items-center rounded-lg border transition-all group cursor-pointer h-[56px] ${
          isLeverage 
            ? 'bg-background border-border hover:border-[rgb(var(--ds-purple-500-rgb)/0.5)]'
            : 'bg-gradient-to-r from-background to-success/5 border-border hover:border-success/50'
        } ${isMobile ? 'px-[var(--ds-space-2-5)] gap-[var(--ds-space-2)]' : 'px-[var(--ds-space-3)] gap-[var(--ds-space-2)]'}`}
        onClick={() => handleCardClick(reserve)}
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
          <div className="flex items-center min-w-0">
            <a
              href={aaveUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="group/token inline-flex items-center gap-[var(--ds-space-2)] hover:opacity-80 transition-opacity duration-150"
              aria-label={`Open ${reserve.tokenSymbol} on Aave`}
              title="Open on Aave"
            >
              <span className="font-semibold text-foreground truncate leading-none ds-text-14">
                {reserve.tokenSymbol}
              </span>
              <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 -ml-1 group-hover/token:opacity-70 transition-opacity duration-150 shrink-0" />
            </a>
          </div>
          <div
            className={`${(isLeverage ? getSpreadColorClass(mainValue, index, totalItems) : getApyColorClass(mainValue))} font-bold tabular-nums text-right leading-none ${isMobile ? 'ds-text-16' : 'ds-text-18'} ${!isLeverage && !hasIncentive ? 'row-span-2 self-center' : ''}`}
          >
            {isLeverage ? formatSpread(mainValue) : formatPercent(mainValue)}
          </div>
          <div className="flex items-center gap-[var(--ds-space-1)] min-w-0 leading-none">
            {chainIconSrc && (
              <img src={chainIconSrc} alt={reserve.chainName} className="shrink-0 w-3.5 h-3.5" />
            )}
            <p className="text-secondary truncate ds-text-11 leading-none">{getMarketDisplayName(reserve)}</p>
          </div>
          {/* Detail breakdown - Only show for supply type */}
          {!isLeverage && hasIncentive && (
            <div className="flex items-center justify-end gap-[var(--ds-space-0-5)] ds-text-11 text-secondary whitespace-nowrap leading-none">
              <span className={`${apyAccent.text} tabular-nums`}>{formatPercent(reserve.supplyApy ?? null)}</span>
              {hasIncentive && (
                <>
                  <span className="text-muted-foreground">+</span>
                  <button
                    type="button"
                    onClick={(e) => handleIncentiveClick(e, reserve, 'supply', incentiveValue, mainValue)}
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
              {formatPercent(isApy ? reserve.totalSupplyApy : reserve.totalSupplyApr)} -{' '}
              {(() => {
                const borrowValue = isApy ? reserve.totalBorrowApy : reserve.totalBorrowApr;
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
    reserves: categoryReserves,
    categoryKey,
    type,
    emptyMessage
  }: {
    title: string;
    subtitle: string;
    icon: typeof TrendingUp;
    iconColorClass: string;
    bgColorClass: string;
    reserves: typeof reservesWithTotals;
    categoryKey: string;
    type: 'supply' | 'leverage';
    emptyMessage: string;
  }) => {
    const shouldAnimateHeader = false;
    const shouldAnimateList = !isMobile && !isApyChanged;
    return (
        <div className={`bg-card border border-border/60 shadow-sm rounded-xl ${isMobile ? 'ds-card-pad-sm' : 'ds-card-pad'} ${isMobile ? 'col-span-1' : ''} flex flex-col`}>
        <CategoryCardHeader
          title={title}
          subtitle={subtitle}
          icon={Icon}
          iconColorClass={iconColorClass}
          bgColorClass={bgColorClass}
          isMobile={isMobile}
          shouldAnimateHeader={shouldAnimateHeader}
          headerVariants={headerVariants}
          iconVariants={iconVariants}
        />

        <div className="flex-1 space-y-[var(--ds-space-1-5)]">
          {categoryReserves.length > 0 ? (
            shouldAnimateList ? (
              <AnimatePresence mode="popLayout">
                {categoryReserves.map((reserve, i) => (
                  isMobile ? (
                    <MiniReserveCard
                      key={`${categoryKey}-${reserve.marketName}-${reserve.tokenSymbol}`}
                      reserve={reserve}
                      index={i}
                      type={type}
                      totalItems={categoryReserves.length}
                      disableMotion={isRateDragging || !shouldAnimateList}
                    />
                  ) : (
                    <ReserveItem
                      key={`${categoryKey}-${reserve.marketName}-${reserve.tokenSymbol}`}
                      reserve={reserve} 
                      index={i} 
                      type={type}
                      totalItems={categoryReserves.length}
                      disableMotion={isRateDragging}
                    />
                  )
                ))}
              </AnimatePresence>
            ) : (
              categoryReserves.map((reserve, i) => (
                isMobile ? (
                  <MiniReserveCard
                    key={`${categoryKey}-${reserve.marketName}-${reserve.tokenSymbol}`}
                    reserve={reserve}
                    index={i}
                    type={type}
                    totalItems={categoryReserves.length}
                    disableMotion
                  />
                ) : (
                  <ReserveItem
                    key={`${categoryKey}-${reserve.marketName}-${reserve.tokenSymbol}`}
                    reserve={reserve}
                    index={i}
                    type={type}
                    totalItems={categoryReserves.length}
                    disableMotion
                  />
                )
              ))
            )
          ) : (
            <div className="text-center py-[var(--ds-space-6)] text-muted-foreground">
              <p className="ds-text-11">{emptyMessage}</p>
            </div>
          )}
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
      reserves: topStable,
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
      reserves: topEth,
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
      reserves: topBtc,
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
      reserves: topLooping,
      categoryKey: "leverage",
      type: "leverage" as const,
      emptyMessage: "No looping opportunities found"
    }
  ];

  // Desktop only (xl+): grid layout. Mobile + tablet: carousel (swipe) below.
  if (isXl) {
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
            reserves={category.reserves}
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
    <div className="relative overflow-x-hidden">
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
        {/* Edge light-bands + double chevrons to hint horizontal scroll */}
        {canScrollPrev && (
          <div className="pointer-events-none absolute -left-[2rem] top-0 h-full w-[2.5rem] z-10">
            <div className="absolute top-[var(--ds-space-2)] bottom-[var(--ds-space-2)] left-0 w-full bg-gradient-to-r from-[rgb(var(--ds-brand-magenta-rgb)/0.62)] via-[rgb(var(--ds-brand-cyan-rgb)/0.38)] to-transparent dark:from-[rgb(var(--ds-brand-magenta-rgb)/0.72)] dark:via-[rgb(var(--ds-brand-cyan-rgb)/0.52)]" />
            <button
              type="button"
              className="pointer-events-auto absolute left-[2rem] top-1/2 -translate-y-1/2 p-1 rounded-full text-foreground/50 dark:text-foreground/70 hover:text-foreground/90 hover:bg-[rgb(var(--ds-brand-magenta-rgb)/0.12)] dark:hover:bg-[rgb(var(--ds-brand-magenta-rgb)/0.20)] transition-colors"
              onClick={() => api?.scrollPrev()}
              aria-label="Previous slide"
            >
              <ChevronsLeft className="h-3 w-3" />
            </button>
          </div>
        )}
        {canScrollNext && (
          <div className="pointer-events-none absolute -right-[2rem] top-0 h-full w-[2.5rem] z-10">
            <div className="absolute top-[var(--ds-space-2)] bottom-[var(--ds-space-2)] right-0 w-full bg-gradient-to-l from-[rgb(var(--ds-brand-magenta-rgb)/0.62)] via-[rgb(var(--ds-brand-cyan-rgb)/0.38)] to-transparent dark:from-[rgb(var(--ds-brand-magenta-rgb)/0.72)] dark:via-[rgb(var(--ds-brand-cyan-rgb)/0.52)]" />
            <button
              type="button"
              className="pointer-events-auto absolute right-[2rem] top-1/2 -translate-y-1/2 p-1 rounded-full text-foreground/50 dark:text-foreground/70 hover:text-foreground/90 hover:bg-[rgb(var(--ds-brand-magenta-rgb)/0.12)] dark:hover:bg-[rgb(var(--ds-brand-magenta-rgb)/0.20)] transition-colors"
              onClick={() => api?.scrollNext()}
              aria-label="Next slide"
            >
              <ChevronsRight className="h-3 w-3" />
            </button>
          </div>
        )}
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
                    reserves={category.reserves}
                    categoryKey={category.categoryKey}
                    type={category.type}
                    emptyMessage={category.emptyMessage}
                  />
                ))}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Navigation arrows integrated into edge bands */}
      </Carousel>

      {/* Pagination indicators - 2 dots for 2 pages */}
      <div className="flex justify-center items-center gap-[var(--ds-space-2)] mt-[var(--ds-space-4)] [--ds-dot:0.375rem] [--ds-dot-active:0.5rem]">
        {mobilePages.map((_, index) => (
          <button
            type="button"
            key={index}
            className={`transition-all rounded-full ${
              current === index
                ? 'ds-dot-active bg-[rgb(var(--ds-brand-magenta-rgb))] shadow-[0_0_0_3px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_3px_rgba(0,0,0,0.4)]'
                : 'ds-dot bg-[rgb(var(--ds-brand-magenta-rgb)/0.25)] hover:bg-[rgb(var(--ds-brand-magenta-rgb)/0.45)]'
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
// Only re-render when reserves data actually changed or isApy changed
export default memo(TopOpportunities, shouldSkipTopOpportunitiesRender);
