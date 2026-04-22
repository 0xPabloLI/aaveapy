import { useState, useEffect, useMemo, useRef, memo, forwardRef, useCallback, type ReactNode } from 'react';
import { TrendingUp, Zap, ChevronLeft, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReserveWithSpread, MerklForecastWireItem } from '@/types/aave';
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
  getReserveIncentiveValues,
  getReserveMarketDisplayName,
} from '@/lib/formatters';
import { buildAaveUrl } from '@/lib/aaveLinks';
import { openExternalUrl } from '@/lib/externalNavigation';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import { useIsMobile } from '@/hooks/use-mobile';
import { getChainIconSrc } from '@/lib/chainIcons';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { shouldSkipTopOpportunitiesRender } from '@/lib/topOpportunitiesMemo';
import IncentiveTooltip from '@/components/dashboard/IncentiveTooltip';
import AssetActionMenu from '@/components/dashboard/AssetActionMenu';
import { useSideDataMeta } from '@/hooks/useSideDataMeta';
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes';
import {
  getApyColorClass,
  getApyAccentClasses,
  getAccentBorderClass,
  getAccentTextClass,
  getAccentBgClass,
  getSpreadColorClass,
  getSpreadAccentClass,
} from './topOpportunitiesColors';

interface TopOpportunitiesProps {
  reserves: ReserveWithSpread[];
  isApy: boolean;
  isRateDragging?: boolean;
  whitelistMerklCampaignIds: ReadonlySet<string>;
  onToggleWhitelistMerklCampaign: (campaignId: string, enabled: boolean) => void;
  categoryGroups: TokenCategoryGroups;
  onCardClick?: (reserve: ReserveWithSpread) => void;
  tydroPointToUsdRate: number;
}

type TopOpportunitiesTooltipState = {
  reserve: ReserveWithTotals;
  type: 'supply' | 'borrow';
  position: { x: number; y: number };
  triggerCenterX: number;
  triggerHeight: number;
  triggerRect: { top: number; bottom: number; left: number; right: number; width: number; height: number };
  accentBorderClass?: string;
  accentTextClass?: string;
  accentBgClass?: string;
};

const DISPLAY_COUNT = 5;

const XL_BREAKPOINT = 1024;

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
      className={`flex items-center gap-[var(--ds-space-2)] ${isMobile ? 'mb-[var(--ds-space-2)]' : 'mb-[var(--ds-space-3)]'}`}
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
        <h3 className={`font-bold truncate ${isMobile ? 'ds-text-13' : 'ds-text-14'}`}>
          {shortTitle ? (
            <>
              <span className="min-[400px]:hidden">{shortTitle}</span>
              <span className="hidden min-[400px]:inline">{title}</span>
            </>
          ) : title}
        </h3>
        <p className="text-foreground/60 truncate ds-text-11">{subtitle}</p>
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
  miniRightContent?: ReactNode;
  marketName?: string;
  tokenAddress?: string | null;
  aaveProReserveId?: string;
  hubAddress?: string;
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
  miniRightContent,
  marketName,
  tokenAddress,
  aaveProReserveId,
  hubAddress,
}: ReserveIdentityProps) => {
  if (mini) {
    return (
      <div className="flex items-center gap-[var(--ds-space-1)]">
        <TokenIcon
          symbol={iconSymbol}
          size={24}
          loading="eager"
          className="shrink-0"
          logoURI={logoURI}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 w-full items-start gap-[var(--ds-space-0-5)]">
            <span className="min-w-0 flex-1 truncate whitespace-nowrap font-bold text-foreground ds-text-11 leading-tight">{tokenSymbol}</span>
            {marketName && tokenAddress ? (
              <AssetActionMenu
                tokenSymbol={tokenSymbol}
                tokenAddress={tokenAddress}
                marketName={marketName}
                aaveProReserveId={aaveProReserveId}
                chainName={chainName}
                hubAddress={hubAddress}
                isMobile={isMobile}
                triggerSize={11}
              />
            ) : null}
          </div>
          <div className="flex items-center gap-[var(--ds-space-1)] ds-text-9 text-muted-foreground">
            {chainIconSrc && (
              <img src={chainIconSrc} alt={chainName} className="w-3 h-3" />
            )}
            <span className="truncate">{marketDisplayName}</span>
          </div>
        </div>
        {miniRightContent ? <div className="shrink-0 tabular-nums text-right">{miniRightContent}</div> : null}
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
        <div className="flex items-start min-w-0 w-full gap-[var(--ds-space-1)]">
          <span className="min-w-0 flex-1 truncate whitespace-nowrap font-semibold text-foreground leading-tight ds-text-13">
          {tokenSymbol}
        </span>
        {marketName && tokenAddress ? (
          <AssetActionMenu
            tokenSymbol={tokenSymbol}
            tokenAddress={tokenAddress}
            marketName={marketName}
            aaveProReserveId={aaveProReserveId}
            hubAddress={hubAddress}
            isMobile={isMobile}
          />
        ) : null}
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

type ReserveWithTotals = ReserveWithSpread & {
  supplyIncentiveApr: number;
  supplyIncentiveApy: number;
  borrowIncentiveApr: number;
  borrowIncentiveApy: number;
  totalSupplyApy: number | null;
  totalBorrowApy: number | null;
  apySpread: number | null;
  totalSupplyApr: number | null;
  totalBorrowApr: number | null;
  aprSpread: number | null;
};

interface MiniReserveApyRowProps {
  isLeverage: boolean;
  hasIncentive: boolean;
  apyAccentText: string;
  apyAccentChip: string;
  nativeValue: number | null;
  incentiveValue: number | null;
  mainValue: number | null;
  index: number;
  totalItems: number;
  isApy: boolean;
  reserve: ReserveWithTotals;
  onIncentiveClick: (
    e: React.MouseEvent,
    reserve: ReserveWithTotals,
    type: 'supply' | 'borrow',
    incentiveValue: number | null,
    accentValue: number | null
  ) => void;
  getSpreadAccentClass: (value: number | null, index?: number, total?: number) => string;
}

const MiniReserveApyRow = ({
  isLeverage,
  hasIncentive,
  apyAccentText,
  apyAccentChip,
  nativeValue,
  incentiveValue,
  mainValue,
  index,
  totalItems,
  isApy,
  reserve,
  onIncentiveClick,
  getSpreadAccentClass,
}: MiniReserveApyRowProps) => {
  if (isLeverage) {
    return (
      <span className={`${getSpreadAccentClass(mainValue, index, totalItems)} tabular-nums ds-text-9`}>
        {formatPercent(isApy ? reserve.totalSupplyApy : reserve.totalSupplyApr)} - {formatPercent(isApy ? reserve.totalBorrowApy : reserve.totalBorrowApr)}
      </span>
    );
  }

  return (
    <>
      <span className={`ds-text-11 tabular-nums ${apyAccentText} ${hasIncentive ? '' : 'invisible'}`}>
        {formatPercent(nativeValue ?? null)}
      </span>
      {hasIncentive && <span className="text-muted-foreground ds-text-11">+</span>}
      <button
        type="button"
        onClick={hasIncentive ? (e) => onIncentiveClick(e, reserve, 'supply', incentiveValue, mainValue) : undefined}
        disabled={!hasIncentive}
        aria-hidden={!hasIncentive}
        tabIndex={hasIncentive ? 0 : -1}
        className={`inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-1)] py-px rounded-full ring-1 transition-colors tabular-nums ds-text-11 ${apyAccentChip} ${hasIncentive ? 'cursor-pointer' : 'invisible pointer-events-none'}`}
      >
        <span>{formatPercent(incentiveValue ?? 0)}</span>
        <IncentiveIcon width={8} height={8} />
      </button>
    </>
  );
};

interface MiniReserveCardProps {
  reserve: ReserveWithTotals;
  index: number;
  type: 'supply' | 'leverage';
  totalItems?: number;
  disableMotion?: boolean;
  isApy: boolean;
  isMobile: boolean;
  onCardClick: (reserve: ReserveWithSpread) => void;
  onIncentiveClick: (
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    incentiveValue: number | null,
    accentValue: number | null
  ) => void;
  getApyAccentClasses: (value: number | null) => { text: string; chip: string };
  getApyColorClass: (value: number | null) => string;
  getSpreadColorClass: (value: number | null, index?: number, total?: number) => string;
  getSpreadAccentClass: (value: number | null, index?: number, total?: number) => string;
  itemVariants: import('framer-motion').Variants;
}

const MiniReserveCard = ({
  reserve,
  index,
  type,
  totalItems = 5,
  disableMotion = false,
  isApy,
  isMobile,
  onCardClick,
  onIncentiveClick,
  getApyAccentClasses,
  getApyColorClass,
  getSpreadColorClass,
  getSpreadAccentClass,
  itemVariants,
}: MiniReserveCardProps) => {
  const isLeverage = type === 'leverage';
  const mainValue = isLeverage
    ? (isApy ? reserve.apySpread : reserve.aprSpread)
    : (isApy ? reserve.totalSupplyApy : reserve.totalSupplyApr);
  const nativeValue = reserve.supplyApy ?? null;
  const incentiveValue = isApy ? reserve.supplyIncentiveApy : reserve.supplyIncentiveApr;
  const hasIncentive = incentiveValue !== null && !isNaN(incentiveValue) && incentiveValue >= 0.01;
  const apyAccent = getApyAccentClasses(mainValue);
  const mainValueNode = (
    <span className={`font-bold ds-text-14 tabular-nums ${isLeverage ? getSpreadColorClass(mainValue, index, totalItems) : getApyColorClass(mainValue)}`}>
      {isLeverage ? formatSpread(mainValue) : formatPercent(mainValue)}
    </span>
  );
  const chainIconSrc = getChainIconSrc(reserve.chainName);
  const { iconSymbol, logoURI } = fetchIconSymbolAndName({
    underlyingAsset: reserve.tokenAddress,
    symbol: reserve.tokenSymbol,
    name: reserve.tokenName,
  });
  const marketDisplayName = getReserveMarketDisplayName(reserve);
  const Wrapper = disableMotion ? 'div' : motion.div;

  return (
    <Wrapper
      {...(disableMotion
        ? {}
        : {
            custom: index,
            initial: false,
            animate: 'visible',
            variants: itemVariants,
          })}
      className="rounded-xl border ds-card-pad-sm cursor-pointer bg-card border-border/60 active:bg-muted/60 min-h-[60px] flex flex-col justify-center gap-[var(--ds-space-0-5)]"
      onClick={() => onCardClick(reserve)}
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
        miniRightContent={mainValueNode}
        marketName={reserve.marketName}
        tokenAddress={reserve.tokenAddress}
        aaveProReserveId={reserve.aaveProReserveId}
        hubAddress={reserve.hubAddress}
      />

      <div className="flex items-baseline justify-end gap-[var(--ds-space-1)]">
        <MiniReserveApyRow
          isLeverage={isLeverage}
          hasIncentive={hasIncentive}
          apyAccentText={apyAccent.text}
          apyAccentChip={apyAccent.chip}
          nativeValue={nativeValue}
          incentiveValue={incentiveValue}
          mainValue={mainValue}
          index={index}
          totalItems={totalItems}
          isApy={isApy}
          reserve={reserve}
          onIncentiveClick={onIncentiveClick}
          getSpreadAccentClass={getSpreadAccentClass}
        />
      </div>
    </Wrapper>
  );
};

interface ReserveItemProps {
  reserve: ReserveWithTotals;
  index: number;
  type: 'supply' | 'leverage';
  totalItems?: number;
  disableMotion?: boolean;
  isApy: boolean;
  isMobile: boolean;
  isRateDragging: boolean;
  onCardClick: (reserve: ReserveWithSpread) => void;
  onIncentiveClick: (
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    incentiveValue: number | null,
    accentValue: number | null
  ) => void;
  getApyAccentClasses: (value: number | null) => { text: string; chip: string };
  getApyColorClass: (value: number | null) => string;
  getSpreadColorClass: (value: number | null, index?: number, total?: number) => string;
  getSpreadAccentClass: (value: number | null, index?: number, total?: number) => string;
  itemVariants: import('framer-motion').Variants;
}

const ReserveItem = forwardRef<HTMLDivElement, ReserveItemProps>(function ReserveItem({
  reserve,
  index,
  type,
  totalItems = 5,
  disableMotion = false,
  isApy,
  isMobile,
  isRateDragging,
  onCardClick,
  onIncentiveClick,
  getApyAccentClasses,
  getApyColorClass,
  getSpreadColorClass,
  getSpreadAccentClass,
  itemVariants,
}, ref) {
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

  return (
    <motion.div
      ref={ref}
      {...(shouldAnimateItem
        ? { custom: index, initial: false, animate: 'visible', variants: itemVariants }
        : { initial: false, animate: false as const })}
      className={`flex items-center rounded-lg border transition-all group cursor-pointer h-[56px] ${
        isLeverage
          ? 'bg-background border-border hover:border-[rgb(var(--ds-purple-500-rgb)/0.5)]'
          : 'bg-gradient-to-r from-background to-success/5 border-border hover:border-success/50'
      } ${isMobile ? 'px-[var(--ds-space-2-5)] gap-[var(--ds-space-2)]' : 'px-[var(--ds-space-3)] gap-[var(--ds-space-2)]'}`}
      onClick={() => onCardClick(reserve)}
    >
      <div className={`grid grid-cols-[auto,1fr,auto] grid-rows-[auto,auto] content-center items-center gap-x-[var(--ds-space-2)] ${isMobile ? 'gap-y-[var(--ds-space-0-5)]' : 'gap-y-[var(--ds-space-1)]'} flex-1 min-w-0 h-full`}>
        <TokenIcon
          symbol={iconSymbol}
          size={isMobile ? 28 : 32}
          loading="eager"
          className="shrink-0 row-span-2"
          logoURI={logoURI}
        />
        <div className="flex items-center min-w-0 gap-[var(--ds-space-1)]">
          <span className="min-w-0 flex-1 truncate whitespace-nowrap font-semibold text-foreground leading-none ds-text-14">
            {reserve.tokenSymbol}
          </span>
          {reserve.marketName && reserve.tokenAddress ? (
            <AssetActionMenu
              tokenSymbol={reserve.tokenSymbol}
              tokenAddress={reserve.tokenAddress}
              marketName={reserve.marketName}
              aaveProReserveId={reserve.aaveProReserveId}
              chainName={reserve.chainName}
              hubAddress={reserve.hubAddress}
              isMobile={isMobile}
            />
          ) : null}
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
          <p className="text-secondary truncate ds-text-11 leading-none">{getReserveMarketDisplayName(reserve)}</p>
        </div>
        {!isLeverage && hasIncentive && (
          <div className="flex items-center justify-end gap-[var(--ds-space-0-5)] ds-text-11 text-secondary whitespace-nowrap leading-none">
            <span className={`${apyAccent.text} tabular-nums`}>{formatPercent(reserve.supplyApy ?? null)}</span>
            <>
              <span className="text-muted-foreground">+</span>
              <button
                type="button"
                onClick={(e) => onIncentiveClick(e, reserve, 'supply', incentiveValue, mainValue)}
                className={`inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full ring-1 transition-colors cursor-pointer tabular-nums ${apyAccent.chip}`}
              >
                <span>{formatPercent(incentiveValue)}</span>
                <IncentiveIcon width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} />
              </button>
            </>
          </div>
        )}
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
});

interface CategoryCardProps {
  title: string;
  shortTitle?: string;
  subtitle: string;
  icon: typeof TrendingUp;
  iconColorClass: string;
  bgColorClass: string;
  reserves: ReserveWithTotals[];
  categoryKey: string;
  type: 'supply' | 'leverage';
  emptyMessage: string;
  isMobile: boolean;
  isApy: boolean;
  isApyChanged: boolean;
  isRateDragging: boolean;
  headerVariants: import('framer-motion').Variants;
  iconVariants: import('framer-motion').Variants;
  itemVariants: import('framer-motion').Variants;
  onCardClick: (reserve: ReserveWithSpread) => void;
  onIncentiveClick: (
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    incentiveValue: number | null,
    accentValue: number | null
  ) => void;
}

const CategoryCard = ({
  title,
  shortTitle,
  subtitle,
  icon: Icon,
  iconColorClass,
  bgColorClass,
  reserves: categoryReserves,
  categoryKey,
  type,
  emptyMessage,
  isMobile,
  isApy,
  isApyChanged,
  isRateDragging,
  headerVariants,
  iconVariants,
  itemVariants,
  onCardClick,
  onIncentiveClick,
}: CategoryCardProps) => {
  const shouldAnimateHeader = false;
  const shouldAnimateList = !isMobile && !isApyChanged;

  return (
    <div className={`bg-card border border-border/60 rounded-xl ${isMobile ? 'ds-card-pad-sm' : 'ds-card-pad'} ${isMobile ? 'col-span-1' : ''} flex flex-col`}>
      <CategoryCardHeader
        title={title}
        shortTitle={shortTitle}
        subtitle={subtitle}
        icon={Icon}
        iconColorClass={iconColorClass}
        bgColorClass={bgColorClass}
        isMobile={isMobile}
        shouldAnimateHeader={shouldAnimateHeader}
        headerVariants={headerVariants}
        iconVariants={iconVariants}
      />

      <div className={`flex-1 ${isMobile ? 'space-y-[var(--ds-space-1)]' : 'space-y-[var(--ds-space-1-5)]'}`}>
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
                    isApy={isApy}
                    isMobile={isMobile}
                    onCardClick={onCardClick}
                    onIncentiveClick={onIncentiveClick}
                    getApyAccentClasses={getApyAccentClasses}
                    getApyColorClass={getApyColorClass}
                    getSpreadColorClass={getSpreadColorClass}
                    getSpreadAccentClass={getSpreadAccentClass}
                    itemVariants={itemVariants}
                  />
                ) : (
                  <ReserveItem
                    key={`${categoryKey}-${reserve.marketName}-${reserve.tokenSymbol}`}
                    reserve={reserve}
                    index={i}
                    type={type}
                    totalItems={categoryReserves.length}
                    disableMotion={isRateDragging}
                    isApy={isApy}
                    isMobile={isMobile}
                    isRateDragging={isRateDragging}
                    onCardClick={onCardClick}
                    onIncentiveClick={onIncentiveClick}
                    getApyAccentClasses={getApyAccentClasses}
                    getApyColorClass={getApyColorClass}
                    getSpreadColorClass={getSpreadColorClass}
                    getSpreadAccentClass={getSpreadAccentClass}
                    itemVariants={itemVariants}
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
                  isApy={isApy}
                  isMobile={isMobile}
                  onCardClick={onCardClick}
                  onIncentiveClick={onIncentiveClick}
                  getApyAccentClasses={getApyAccentClasses}
                  getApyColorClass={getApyColorClass}
                  getSpreadColorClass={getSpreadColorClass}
                  getSpreadAccentClass={getSpreadAccentClass}
                  itemVariants={itemVariants}
                />
              ) : (
                <ReserveItem
                  key={`${categoryKey}-${reserve.marketName}-${reserve.tokenSymbol}`}
                  reserve={reserve}
                  index={i}
                  type={type}
                  totalItems={categoryReserves.length}
                  disableMotion
                  isApy={isApy}
                  isMobile={isMobile}
                  isRateDragging={isRateDragging}
                  onCardClick={onCardClick}
                  onIncentiveClick={onIncentiveClick}
                  getApyAccentClasses={getApyAccentClasses}
                  getApyColorClass={getApyColorClass}
                  getSpreadColorClass={getSpreadColorClass}
                  getSpreadAccentClass={getSpreadAccentClass}
                  itemVariants={itemVariants}
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

const TopOpportunities = ({
  reserves,
  isApy,
  isRateDragging = false,
  whitelistMerklCampaignIds,
  onToggleWhitelistMerklCampaign,
  categoryGroups,
  onCardClick,
  tydroPointToUsdRate,
}: TopOpportunitiesProps) => {
  const isMobile = useIsMobile();

  const sideDataMetaQuery = useSideDataMeta(QUERY_STALE_TIMES.sideDataMeta);
  const forecastStates = useMemo<Record<string, MerklForecastWireItem>>(() => {
    const forecast = sideDataMetaQuery.data?.forecast;
    if (!forecast) return {};
    const states: Record<string, MerklForecastWireItem> = {};
    forecast.items.forEach((item) => { states[item.campaignId] = item; });
    return states;
  }, [sideDataMetaQuery.data?.forecast]);

  const [isXl, setIsXl] = useState(false);
  const [tooltipState, setTooltipState] = useState<TopOpportunitiesTooltipState | null>(null);
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
  const reservesWithTotals = useMemo<ReserveWithTotals[]>(() => reserves.map(reserve => {
    const supplyIncentive = getReserveIncentiveValues(reserve, 'supply', tydroPointToUsdRate, {
      whitelistMerklCampaignIds,
    });
    const borrowIncentive = getReserveIncentiveValues(reserve, 'borrow', tydroPointToUsdRate, {
      whitelistMerklCampaignIds,
    });

    const totalSupplyApy = calculateTotalSupplyApy(reserve.supplyApy, supplyIncentive.apy);
    const totalBorrowApy = calculateTotalBorrowApy(reserve.borrowApy, borrowIncentive.apy);
    const totalSupplyApr = calculateTotalSupplyApr(reserve.supplyApy ?? null, supplyIncentive.apr);
    const totalBorrowApr = calculateTotalBorrowApr(reserve.borrowApy ?? null, borrowIncentive.apr);

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
  }), [whitelistMerklCampaignIds, reserves, tydroPointToUsdRate]);

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

  const handleCardClick = (reserve: ReserveWithSpread) => {
    if (onCardClick) {
      onCardClick(reserve);
      return;
    }
    if (isMobile) return;
    const url = buildAaveUrl(reserve);
    if (url) {
      openExternalUrl(url, false);
    }
  };

  const handleIncentiveClick = useCallback((
    e: React.MouseEvent,
    reserve: ReserveWithTotals,
    type: 'supply' | 'borrow',
    incentiveValue: number | null,
    accentValue: number | null,
  ) => {
    e.stopPropagation();
    if (incentiveValue === null || isNaN(incentiveValue) || incentiveValue < 0.01) return;
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
    setTooltipState({
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
  }, []);

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
      shortTitle: `Stable ${isApy ? 'APY' : 'APR'}`,
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
      shortTitle: `ETH ${isApy ? 'APY' : 'APR'}`,
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
      shortTitle: `BTC ${isApy ? 'APY' : 'APR'}`,
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
      shortTitle: "Leverage",
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
      <>
        <div className="grid gap-[var(--ds-space-3)] md:gap-[var(--ds-space-4)] grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <CategoryCard
              key={category.categoryKey}
              title={category.title}
              shortTitle={category.shortTitle}
              subtitle={category.subtitle}
              icon={category.icon}
              iconColorClass={category.iconColorClass}
              bgColorClass={category.bgColorClass}
              reserves={category.reserves}
              categoryKey={category.categoryKey}
              type={category.type}
              emptyMessage={category.emptyMessage}
              isMobile={isMobile}
              isApy={isApy}
              isApyChanged={isApyChanged}
              isRateDragging={isRateDragging}
              headerVariants={headerVariants}
              iconVariants={iconVariants}
              itemVariants={itemVariants}
              onCardClick={handleCardClick}
              onIncentiveClick={handleIncentiveClick}
            />
          ))}
        </div>
        {tooltipState && (
          <IncentiveTooltip
            reserve={tooltipState.reserve}
            type={tooltipState.type}
            position={tooltipState.position}
            triggerCenterX={tooltipState.triggerCenterX}
            triggerHeight={tooltipState.triggerHeight}
            triggerRect={tooltipState.triggerRect}
            accentBorderClass={tooltipState.accentBorderClass}
            accentTextClass={tooltipState.accentTextClass}
            accentBgClass={tooltipState.accentBgClass}
            onClose={() => setTooltipState(null)}
            isApy={isApy}
            tydroPointToUsdRate={tydroPointToUsdRate}
            whitelistMerklCampaignIds={whitelistMerklCampaignIds}
            onToggleWhitelistMerklCampaign={onToggleWhitelistMerklCampaign}
            forecastStates={forecastStates}
            usePortal
          />
        )}
      </>
    );
  }

  // Mobile carousel layout - 2 pages, each with 2 categories
  const mobilePages = [
    [categories[0], categories[1]], // Page 1: Stable + ETH
    [categories[2], categories[3]], // Page 2: BTC + Leverage
  ];

  return (
    <>
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
        <CarouselContent className="-ml-[var(--ds-space-2)] will-change-transform">
          {mobilePages.map((pageCats, pageIndex) => (
            <CarouselItem key={pageIndex} className="pl-[var(--ds-space-2)] basis-full">
              <div className="grid grid-cols-2 gap-[var(--ds-space-2)]">
                {pageCats.map((category) => (
                  <CategoryCard
                    key={category.categoryKey}
                    title={category.title}
                    shortTitle={category.shortTitle}
                    subtitle={category.subtitle}
                    icon={category.icon}
                    iconColorClass={category.iconColorClass}
                    bgColorClass={category.bgColorClass}
                    reserves={category.reserves}
                    categoryKey={category.categoryKey}
                    type={category.type}
                    emptyMessage={category.emptyMessage}
                    isMobile={isMobile}
                    isApy={isApy}
                    isApyChanged={isApyChanged}
                    isRateDragging={isRateDragging}
                    headerVariants={headerVariants}
                    iconVariants={iconVariants}
                    itemVariants={itemVariants}
                    onCardClick={handleCardClick}
                    onIncentiveClick={handleIncentiveClick}
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
      {tooltipState && (
        <IncentiveTooltip
          reserve={tooltipState.reserve}
          type={tooltipState.type}
          position={tooltipState.position}
          triggerCenterX={tooltipState.triggerCenterX}
          triggerHeight={tooltipState.triggerHeight}
          triggerRect={tooltipState.triggerRect}
          accentBorderClass={tooltipState.accentBorderClass}
          accentTextClass={tooltipState.accentTextClass}
          accentBgClass={tooltipState.accentBgClass}
          onClose={() => setTooltipState(null)}
          isApy={isApy}
          tydroPointToUsdRate={tydroPointToUsdRate}
          whitelistMerklCampaignIds={whitelistMerklCampaignIds}
          onToggleWhitelistMerklCampaign={onToggleWhitelistMerklCampaign}
          forecastStates={forecastStates}
          usePortal
        />
      )}
    </>
  );
};

// Memoize component to prevent re-renders when parent state changes (e.g., filter buttons)
// Only re-render when reserves data actually changed or isApy changed
export default memo(TopOpportunities, shouldSkipTopOpportunitiesRender);
