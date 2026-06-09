import { memo, Fragment, useEffect, useState, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import { ExternalLink, Plus, ArrowDown, ArrowUp } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipCalloutArrow } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { FrozenStatusBadge } from './ReserveStatusBadge';
import { ReserveWithSpread } from '@/types/aave';
import { formatPercent, formatScenarioSize, formatSpread, formatUsd } from '@/lib/formatters';
import { getReserveMarketDisplayName } from '@/lib/marketLabels';
import { buildAaveMarketUrl, buildAaveUrl, buildAaveV4HubUrl, buildAaveV4MarketUrl } from '@/lib/aaveLinks';
import { buildTydroMarketUrl } from '@/lib/tydroLinks';
import { getProtocolVersion } from '@/lib/protocolVersion';
import { buildPoolExplorerUrl } from '@/lib/poolExplorerLinks';
import { externalLinkTabProps } from '@/lib/externalNavigation';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import { getChainIconSrc } from '@/lib/chainIcons';
import { isSupplyDisabled, isBorrowDisabled, isRestrictedReserve, getPrimaryReserveStatus } from '@/lib/reserveStatus';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import {
  computeDeficitDisplay,
  type DeficitDisplay,
} from '@/lib/deficit';
import DeficitLiquidityRing from './DeficitLiquidityRing';
import SimulationSubRow from './SimulationSubRow';
import CapProgressRing from './CapProgressRing';
import BorrowCapProgressRing from './BorrowCapProgressRing';
import UtilizationIndicator, { UtilizationContent } from './UtilizationIndicator';
import DeficitShieldIcon from './DeficitShieldIcon';
import AssetActionMenu from './AssetActionMenu';
import { PORTFOLIO_RESERVE_ADD_BUTTON_CLASSES } from './portfolioTheme';
import type { RateSimulationResult, ScenarioInputMode } from '@/lib/rateSimulationCalculator';

import { nativeToUsd, getScenarioSupplySizeUsd } from '@/lib/scenarioSize';
import { cn } from '@/lib/utils';
import type { SortActions } from '@/hooks/reserves-table/buildSortActions';

/* ─── Memoised chain icon ─── */
const ChainIcon = memo(({ chain, className = '' }: { chain: string; className?: string }) => {
  const size = 'w-3.5 h-3.5';
  const src = getChainIconSrc(chain);
  if (!src) {
    return (
      <div className={`${size} rounded-full bg-current opacity-40 flex items-center justify-center ds-text-8 font-semibold`}>
        {chain.charAt(0)}
      </div>
    );
  }
  return <img src={src} alt={`${chain} logo`} className={`${size} ${className}`} loading="lazy" />;
});
ChainIcon.displayName = 'ChainIcon';

const marketCellClassNames = {
  stack: 'flex max-w-none flex-col items-center justify-center gap-1.5',
  marketShell: 'group/market-link relative inline-flex max-w-full items-center justify-center pl-4 pr-4',
  chipBase: 'rounded-md border border-border/40 bg-card/50 ds-text-11 font-medium text-muted-foreground',
  marketButton: 'inline-flex items-center justify-center gap-[var(--ds-space-1-5)] px-[var(--ds-space-2)] py-[var(--ds-space-1)] transition-colors duration-150 hover:text-foreground hover:bg-card/80 active:scale-[0.98]',
  marketText: 'whitespace-nowrap leading-tight',
  hubShell: 'group/hub-link relative inline-flex max-w-full items-center justify-center pl-3 pr-3',
  hubPill: 'inline-flex max-w-[8.5rem] items-center truncate whitespace-nowrap px-2 py-0.5 leading-none',
  hubPillV4: 'text-[rgb(var(--ds-brand-magenta-rgb))] bg-[rgb(var(--ds-brand-magenta-rgb))]/10',
  hubPillDefault: 'text-muted-foreground/70',
  externalLink: 'pointer-events-none absolute right-0 top-1/2 inline-flex -translate-y-1/2 items-center justify-center opacity-0 transition-opacity duration-100',
};

/* ─── Props ─── */
interface DesktopReserveRowProps {
  reserve: ReserveWithSpread;
  reserveId: string;
  isExpanded: boolean;
  onToggleExpand: (reserveId: string) => void;
  onSelectMarket?: (marketName: string) => void;
  onMarketChipClick?: (reserveId: string) => void;
  onSelectHub?: (hubId: string) => void;
  onHubChipClick?: (reserveId: string) => void;
  onIncentiveClick: (e: React.MouseEvent, reserve: ReserveWithSpread, type: 'supply' | 'borrow', apy: number | null) => void;
  displaySupplyTotal: number | null;
  displaySupplyNative: number | null;
  displaySupplyIncentive: number | null;
  displayBorrowTotal: number | null;
  displayBorrowNative: number | null;
  displayBorrowIncentive: number | null;
  displayUtilization: number | null;
  spread: number | null;
  simulation: RateSimulationResult | undefined;
  supplyInput: string;
  borrowInput: string;
  inputMode: ScenarioInputMode;
  isApy: boolean;
  isMobile: boolean;
  onCorrectSupplyInput?: (correctedValue: string) => void;
  onCorrectBorrowInput?: (correctedValue: string) => void;
  /** Portfolio mode: show checkbox for adding to portfolio. */
  isPortfolioMode?: boolean;
  /** Whether this reserve is already in the portfolio. */
  isInPortfolio?: boolean;
  onPortfolioToggle?: (reserveId: string, reserve: ReserveWithSpread, side?: 'supply' | 'borrow') => void;
  sortActions: SortActions;
}

type SortArrowButtonProps = {
  onClick: () => void;
  isActive: boolean;
  sortOrder?: 'asc' | 'desc';
  ariaLabel: string;
};

function SortArrowButton({ onClick, isActive, sortOrder, ariaLabel, className }: SortArrowButtonProps & { className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={ariaLabel}
      className={`ml-1 inline-flex items-center transition-colors ${
        isActive ? (className ?? 'text-foreground') : 'text-muted-foreground/60 hover:text-foreground'
      }`}
    >
      {isActive ? (
        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3 opacity-50" />
      )}
    </button>
  );
}

const DesktopReserveRow = memo(({
  reserve,
  reserveId,
  isExpanded,
  onToggleExpand,
  onSelectMarket,
  onMarketChipClick,
  onSelectHub,
  onHubChipClick,
  onIncentiveClick,
  displaySupplyTotal,
  displaySupplyNative,
  displaySupplyIncentive,
  displayBorrowTotal,
  displayBorrowNative,
  displayBorrowIncentive,
  displayUtilization,
  spread,
  simulation,
  supplyInput,
  borrowInput,
  inputMode,
  isApy,
  isMobile,
  onCorrectSupplyInput,
  onCorrectBorrowInput,
  isPortfolioMode,
  isInPortfolio,
  onPortfolioToggle,
  sortActions,
}: DesktopReserveRowProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [hasSimulationMounted, setHasSimulationMounted] = useState(isExpanded);

  useEffect(() => {
    if (isExpanded) {
      setHasSimulationMounted(true);
    }
  }, [isExpanded]);

  const tokenTextRef = useRef<HTMLSpanElement>(null);
  const [isTokenWrapped, setIsTokenWrapped] = useState(false);

  useEffect(() => {
    const el = tokenTextRef.current;
    if (!el) return;
    const detect = () => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 18;
      setIsTokenWrapped(el.scrollHeight > lineHeight * 1.2);
    };
    detect();
    const ro = new ResizeObserver(detect);
    ro.observe(el);
    return () => ro.disconnect();
  }, [reserve.tokenSymbol]);

  const { iconSymbol, logoURI } = fetchIconSymbolAndName({
    underlyingAsset: reserve.tokenAddress,
    symbol: reserve.tokenSymbol,
    name: reserve.tokenName,
  });

  const aaveUrl = buildAaveUrl({ marketName: reserve.marketName, tokenAddress: reserve.tokenAddress, aaveProReserveId: reserve.aaveProReserveId }) || '#';
  const aaveMarketUrl = buildAaveMarketUrl(reserve.marketName);
  const tydroMarketUrl = buildTydroMarketUrl(reserve.marketName);
  const poolExplorerUrl = buildPoolExplorerUrl(reserve.marketName);
  const aaveV4HubUrl = buildAaveV4HubUrl(reserve);
  const aaveV4MarketUrl = buildAaveV4MarketUrl(reserve);
  const marketDisplayName = getReserveMarketDisplayName(reserve);
  const protocolVersion = getProtocolVersion(reserve.marketName);
  const isV4Market = protocolVersion === 'v4';

  const supplyBlocked = isSupplyDisabled(reserve);
  const borrowBlocked = isBorrowDisabled(reserve);

  // Token price from reserve directly (must be positive finite number)
  const displayTokenPrice =
    reserve.tokenPrice != null && Number.isFinite(reserve.tokenPrice) && reserve.tokenPrice > 0
      ? reserve.tokenPrice
      : null;
  const reserveSizeUsd = nativeToUsd(reserve.supplied, reserve.decimals, reserve.tokenPrice);
  const displayReserveSizeUsd =
    reserveSizeUsd != null && Number.isFinite(reserveSizeUsd)
      ? supplyBlocked
        ? reserveSizeUsd
        : getScenarioSupplySizeUsd({
            reserveSizeUsd,
            supplyCapUsd: nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice),
            rawSupplyInput: supplyInput,
            inputMode,
            tokenPrice: displayTokenPrice,
          })
      : reserveSizeUsd ?? null;
  const baseTotalBorrowedUsd = simulation?.marketMetrics.totalBorrowedUsd ?? null;
  const totalBorrowedUsd = simulation?.marketMetrics.totalBorrowedUsdAfter ?? baseTotalBorrowedUsd;
  const baseAvailableLiquidityUsd = simulation?.marketMetrics.availableLiquidityUsd ?? null;
  const availableLiquidityUsd = simulation?.marketMetrics.availableLiquidityUsdAfter ?? baseAvailableLiquidityUsd;
  const deficitDisplay: DeficitDisplay = computeDeficitDisplay(reserve, displayTokenPrice, displayReserveSizeUsd, inputMode);
  const deficitUsdLabel = deficitDisplay.deficitUsd != null ? formatUsd(deficitDisplay.deficitUsd) : '— (token price unavailable)';

  const optimalPct =
    reserve.optimalUtilization != null && Number(reserve.optimalUtilization) > 0
      ? Number(reserve.optimalUtilization)
      : null;
  const supplySizeLabel = formatScenarioSize(displayReserveSizeUsd, {
    inputMode,
    tokenPrice: displayTokenPrice,
    tokenSymbol: reserve.tokenSymbol,
  });
  const borrowSizeLabel = formatScenarioSize(totalBorrowedUsd, {
    inputMode,
    tokenPrice: displayTokenPrice,
    tokenSymbol: reserve.tokenSymbol,
  });
  const computedSupplyCapUsd = nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice);
  const computedBorrowCapUsd = nativeToUsd(reserve.borrowCap, reserve.decimals, reserve.tokenPrice);
  const hasSupplyCap =
    computedSupplyCapUsd != null && Number.isFinite(computedSupplyCapUsd) && computedSupplyCapUsd > 0;
  const hasBorrowCap =
    computedBorrowCapUsd != null && Number.isFinite(computedBorrowCapUsd) && computedBorrowCapUsd > 0;

  const supplySizeSortArrow = (
    <SortArrowButton onClick={sortActions.supply.onSort} isActive={sortActions.supply.isActive} sortOrder={sortActions.supply.sortOrder} ariaLabel="Sort by supply size" className="ds-text-emerald-500" />
  );

  const borrowSizeSortArrow = (
    <SortArrowButton onClick={sortActions.borrow.onSort} isActive={sortActions.borrow.isActive} sortOrder={sortActions.borrow.sortOrder} ariaLabel="Sort by borrow size" className="ds-text-brand-cyan" />
  );

  return (
    <Fragment>
      <TableRow
        data-reserve-id={reserveId}
        className={cn(
          'cursor-pointer transition-all duration-200 hover:bg-muted/60 active:scale-[0.998] active:bg-muted/80',
          isExpanded && 'bg-muted/30',
          isExpanded &&
            '[&_td]:sticky [&_td]:z-[25] [&_td]:border-b [&_td]:border-border/60 [&_td]:shadow-[0_1px_2px_0_rgb(0_0_0/0.04)] [&_td]:[top:var(--reserves-expanded-main-row-top,5.75rem)]',
          isExpanded && '[&_td]:bg-card',
          isExpanded && reserve.isPaused && '[&_td]:ds-bg-paused',
          isExpanded && reserve.isActive === false && !reserve.isPaused && '[&_td]:ds-bg-paused',
          isExpanded && reserve.isFrozen && !reserve.isPaused && reserve.isActive !== false && '[&_td]:ds-bg-sky-500-8',
          (reserve.isPaused || reserve.isFrozen) && 'bg-card',
          reserve.isPaused && 'ds-bg-paused',
          reserve.isActive === false && 'ds-bg-paused',
          (!reserve.isPaused && reserve.isFrozen) && 'ds-bg-sky-500-8',
        )}
        onClick={() => onToggleExpand(reserveId)}
      >
        {/* Token */}
        <TableCell className="ds-reserves-cell-td-edge-l ds-row-pad text-left overflow-hidden">
          <div className="flex w-full min-w-0 items-center justify-start gap-[var(--ds-space-2)]">
          {isPortfolioMode && onPortfolioToggle && (() => {
            const isRestricted = isRestrictedReserve(reserve);
            const restrictedLabel = isRestricted
              ? getPrimaryReserveStatus(reserve) === 'paused'
                ? 'Paused'
                : getPrimaryReserveStatus(reserve) === 'frozen'
                  ? 'Frozen'
                  : 'Inactive'
              : null;
            const btn = (
              <button
                type="button"
                disabled={isRestricted}
                onClick={(e) => {
                  e.stopPropagation();
                  onPortfolioToggle(reserveId, reserve);
                }}
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all duration-150',
                  isRestricted
                    ? PORTFOLIO_RESERVE_ADD_BUTTON_CLASSES.disabled
                    : isInPortfolio
                      ? PORTFOLIO_RESERVE_ADD_BUTTON_CLASSES.selected
                      : PORTFOLIO_RESERVE_ADD_BUTTON_CLASSES.unselected,
                )}
                aria-label={isInPortfolio ? `Remove ${reserve.tokenSymbol} from portfolio` : `Add ${reserve.tokenSymbol} to portfolio`}
              >
                {isInPortfolio ? (
                  <span className="ds-text-11 font-bold leading-none">✓</span>
                ) : (
                  <Plus className="h-3 w-3" />
                )}
              </button>
            );
            if (isRestricted && restrictedLabel) {
              return (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side="right" align="center" className="max-w-[12rem]">
                    <TooltipCalloutArrow />
                    <p className="ds-text-11">{restrictedLabel}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }
            return btn;
          })()}
          <div className={`group/token flex min-w-0 max-w-full justify-start gap-[var(--ds-space-1-5)] ${isTokenWrapped ? 'items-start' : 'items-center'}`}>
            <TokenIcon symbol={iconSymbol} size={28} loading="eager" logoURI={logoURI} className={`shrink-0 ${isTokenWrapped ? 'mt-0.5' : ''}`} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-[var(--ds-space-1-5)] gap-y-0">
              <FrozenStatusBadge reserve={reserve} />
              <span ref={tokenTextRef} className="font-semibold text-foreground ds-text-13 break-words min-w-0 [max-width:max-content]">
                {reserve.tokenSymbol}
              </span>
              <span className="inline-flex shrink-0 items-baseline gap-[var(--ds-space-1-5)]">
                <AssetActionMenu
                  tokenSymbol={reserve.tokenSymbol}
                  tokenAddress={reserve.tokenAddress}
                  marketName={reserve.marketName}
                  aaveProReserveId={reserve.aaveProReserveId}
                  chainName={reserve.chainName}
                  hubAddress={reserve.hubAddress}
                  spokeAddress={reserve.spokeAddress}
                  isMobile={isMobile}
                  triggerSize={12}
                  triggerClassName="shrink-0 self-center"
                />
              </span>
            </div>
          </div>
          </div>
        </TableCell>
        {/* Market — DeFi/lending 协议表惯例：Asset → Market 紧贴 */}
        <TableCell className="ds-reserves-cell-td ds-row-pad text-center hidden md:table-cell">
          <div className="flex items-center justify-center">
            <div className={marketCellClassNames.stack}>
              {reserve.hubName && reserve.hubId && (
                <div className={marketCellClassNames.hubShell}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onHubChipClick?.(reserveId);
                      onSelectHub?.(reserve.hubId!);
                    }}
                    className={cn(
                      marketCellClassNames.chipBase,
                      marketCellClassNames.hubPill,
                      isV4Market ? marketCellClassNames.hubPillV4 : marketCellClassNames.hubPillDefault,
                      'cursor-pointer transition-all duration-150 hover:opacity-80 active:scale-[0.98]',
                    )}
                    aria-label={`Filter by ${reserve.hubName} hub`}
                    title={`Filter by ${reserve.hubName}`}
                  >
                    {reserve.hubName}
                  </button>
                  {aaveV4HubUrl && (
                    <a
                      href={aaveV4HubUrl}
                      {...externalLinkTabProps(isMobile)}
                      onClick={(event) => event.stopPropagation()}
                      className={cn(marketCellClassNames.externalLink, 'group-hover/hub-link:pointer-events-auto group-hover/hub-link:opacity-100')}
                      aria-label={`View ${reserve.hubName} hub on Aave V4`}
                      title={`Open hub ${reserve.hubName} on Aave V4`}
                    >
                      <ExternalLink className={cn(
                        "w-2.5 h-2.5",
                        isV4Market ? "text-foreground" : "text-muted-foreground"
                      )} />
                    </a>
                  )}
                </div>
              )}
              <div className={marketCellClassNames.marketShell}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMarketChipClick?.(reserveId);
                    onSelectMarket?.(reserve.marketName);
                  }}
                  className={cn(marketCellClassNames.chipBase, marketCellClassNames.marketButton)}
                  aria-label={`Filter by ${marketDisplayName} market`}
                  title={`Filter by ${marketDisplayName}`}
                >
                  <ChainIcon chain={reserve.chainName} />
                  <span className={marketCellClassNames.marketText}>{marketDisplayName}</span>
                </button>
                {tydroMarketUrl ? (
                  // Ink market: click-to-expand menu with Aave + Tydro options
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                        className={cn(
                          marketCellClassNames.externalLink,
                          'group-hover/market-link:pointer-events-auto group-hover/market-link:opacity-100 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100',
                        )}
                        aria-label={`Open ${marketDisplayName} market`}
                        title="Open market"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={6}
                      className="w-auto min-w-[10rem] p-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex flex-col">
                        {(aaveV4MarketUrl ?? aaveMarketUrl) && (
                          <a
                            href={aaveV4MarketUrl ?? aaveMarketUrl!}
                            {...externalLinkTabProps(isMobile)}
                            onClick={(event) => event.stopPropagation()}
                            className="flex items-center justify-between gap-3 rounded-md px-3 py-2 ds-text-13 text-foreground/90 transition-colors hover:bg-muted/70"
                          >
                            <span className="flex items-center gap-2">
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/70" />
                              <span>Open on Aave</span>
                            </span>
                            <img src="/icons/tokens/aave.svg" alt="Aave" className="h-3.5 w-3.5 rounded-full opacity-80" loading="lazy" />
                          </a>
                        )}
                        <a
                          href={tydroMarketUrl}
                          {...externalLinkTabProps(isMobile)}
                          onClick={(event) => event.stopPropagation()}
                          className="flex items-center justify-between gap-3 rounded-md px-3 py-2 ds-text-13 text-foreground/90 transition-colors hover:bg-muted/70"
                        >
                          <span className="flex items-center gap-2">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/70" />
                            <span>Open on Tydro</span>
                          </span>
                          <img src={isDark ? '/icons/partners/tydro-white.svg' : '/icons/partners/tydro-black.svg'} alt="Tydro" className="h-3.5 w-3.5 rounded-full" loading="lazy" />
                        </a>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : aaveV4MarketUrl ? (
                  <a
                    href={aaveV4MarketUrl}
                    {...externalLinkTabProps(isMobile)}
                    onClick={(event) => event.stopPropagation()}
                    className={cn(
                      marketCellClassNames.externalLink,
                      'group-hover/market-link:pointer-events-auto group-hover/market-link:opacity-100',
                    )}
                    aria-label={`Open ${marketDisplayName} market on Aave V4`}
                    title="Open market on Aave V4"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  aaveMarketUrl && (
                    <a
                      href={aaveMarketUrl}
                      {...externalLinkTabProps(isMobile)}
                      onClick={(event) => event.stopPropagation()}
                      className={cn(
                        marketCellClassNames.externalLink,
                        'group-hover/market-link:pointer-events-auto group-hover/market-link:opacity-100',
                      )}
                      aria-label={`Open ${marketDisplayName} market on Aave`}
                      title="Open market on Aave"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )
                )}
              </div>
            </div>
          </div>
        </TableCell>
        {/* Price */}
        <TableCell className="ds-reserves-cell-td ds-row-pad whitespace-nowrap text-right hidden md:table-cell tabular-nums text-muted-foreground ds-text-13">
          {formatUsd(reserve.tokenPrice)}
        </TableCell>
        {/* Size (Supply + Borrow) — right-aligned numeric column.
         * 无 cap 的行用 12×12 透明 RingPlaceholder 占位，保证 supply/borrow 数字
         * 在垂直方向跨行严格右对齐，不出现"有环 ↔ 无环"行之间的水平错位。*/}
        <TableCell className="ds-reserves-cell-td ds-row-pad whitespace-nowrap text-right hidden md:table-cell tabular-nums ds-text-13">
          <div className="flex flex-col items-end justify-center gap-[var(--ds-space-0-5)]">
            {/* Supply Size - Green (match Supply APY primary: ds-text-emerald-500) */}
            {hasSupplyCap ? (
              <CapProgressRing
                size={displayReserveSizeUsd}
                cap={computedSupplyCapUsd}
                displayMode={inputMode}
                tokenPrice={displayTokenPrice}
                tokenSymbol={reserve.tokenSymbol}
                label={<span className="font-medium tabular-nums">{supplySizeLabel}</span>}
                triggerClassName={supplyBlocked ? 'text-emerald-500/50' : 'ds-text-emerald-500'}
                triggerAriaLabel={`Supply cap details for ${reserve.tokenSymbol}`}
                onSort={sortActions.supplyCapPct.onSort}
                onSortSize={sortActions.supply.onSort}
                onSortSupplySize={sortActions.supply.onSort}
                isSortSupplySizeActive={sortActions.supply.isActive}
                supplySizeSortOrder={sortActions.supply.sortOrder}
                onSortSuppliable={sortActions.supplyAvailability.onSort}
                isSortSuppliableActive={sortActions.supplyAvailability.isActive}
                suppliableSortOrder={sortActions.supplyAvailability.sortOrder}
                onSortSupplyCapValue={sortActions.supplyCapValue.onSort}
                isSortSupplyCapValueActive={sortActions.supplyCapValue.isActive}
                supplyCapValueSortOrder={sortActions.supplyCapValue.sortOrder}
                isSortActive={sortActions.supplyCapPct.isActive}
                sortOrder={sortActions.supplyCapPct.sortOrder}
              />
            ) : (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className={`inline-flex items-center gap-[var(--ds-space-1-5)] rounded-md py-0.5 pl-1 pr-0.5 -my-0.5 cursor-pointer ${supplyBlocked ? 'text-emerald-500/50' : 'ds-text-emerald-500'}`}>
                    <span className="font-medium tabular-nums">{supplySizeLabel}</span>
                    <span aria-hidden className="inline-block w-3 h-3 shrink-0" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" align="center" className="max-w-[18rem]">
                  <TooltipCalloutArrow />
                  <div className="space-y-1 ds-text-11">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Total supplied</span>
                      <span className="font-medium tabular-nums ds-text-emerald-500">
                        {supplySizeLabel}
                        {supplySizeSortArrow}
                      </span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Borrow Size - Cyan (match tooltip: font-medium + ds-text-brand-cyan) */}
            {hasBorrowCap ? (
              <BorrowCapProgressRing
                borrowed={totalBorrowedUsd}
                cap={computedBorrowCapUsd}
                availableLiquidityUsd={availableLiquidityUsd}
                disabled={borrowBlocked}
                displayMode={inputMode}
                tokenPrice={displayTokenPrice}
                tokenSymbol={reserve.tokenSymbol}
                label={<span className="font-medium tabular-nums">{borrowSizeLabel}</span>}
                triggerClassName={borrowBlocked ? 'text-cyan-500/50' : 'ds-text-brand-cyan'}
                triggerAriaLabel={`Borrow cap details for ${reserve.tokenSymbol}`}
                onSort={sortActions.borrowCapPct.onSort}
                onSortSize={sortActions.borrow.onSort}
                onSortBorrowSize={sortActions.borrow.onSort}
                isSortBorrowSizeActive={sortActions.borrow.isActive}
                borrowSizeSortOrder={sortActions.borrow.sortOrder}
                onSortBorrowable={sortActions.borrowAvailability.onSort}
                isSortBorrowableActive={sortActions.borrowAvailability.isActive}
                borrowableSortOrder={sortActions.borrowAvailability.sortOrder}
                onSortBorrowCapValue={sortActions.borrowCapValue.onSort}
                isSortBorrowCapValueActive={sortActions.borrowCapValue.isActive}
                borrowCapValueSortOrder={sortActions.borrowCapValue.sortOrder}
                onSortAvailableLiquidity={sortActions.availableLiquidity.onSort}
                isSortAvailableLiquidityActive={sortActions.availableLiquidity.isActive}
                availableLiquiditySortOrder={sortActions.availableLiquidity.sortOrder}
                isSortActive={sortActions.borrowCapPct.isActive}
                sortOrder={sortActions.borrowCapPct.sortOrder}
              />
            ) : (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className={`inline-flex items-center gap-[var(--ds-space-1-5)] rounded-md py-0.5 pl-1 pr-0.5 -my-0.5 cursor-pointer ${borrowBlocked ? 'text-cyan-500/50' : 'ds-text-brand-cyan'}`}>
                    <span className="font-medium tabular-nums">{borrowSizeLabel}</span>
                    <span aria-hidden className="inline-block w-3 h-3 shrink-0" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" align="center" className="max-w-[18rem]">
                  <TooltipCalloutArrow />
                  <div className="space-y-1 ds-text-11">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Total borrowed</span>
                      <span className="font-medium tabular-nums ds-text-brand-cyan">
                        {borrowSizeLabel}
                        {borrowSizeSortArrow}
                      </span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            {deficitDisplay.hasDeficit && (
              deficitDisplay.deficitUsd != null ? (
                <DeficitLiquidityRing
                  deficitUsd={deficitDisplay.deficitUsd}
                  totalSuppliedUsd={displayReserveSizeUsd}
                  tokenDeficitLabel={deficitDisplay.deficitTokenLabel}
                  displayMode={inputMode}
                  tokenPrice={displayTokenPrice}
                  tokenSymbol={reserve.tokenSymbol}
                  label={(
                    <span className={cn('inline-flex items-center gap-1 ds-text-11 tabular-nums', deficitDisplay.deficitTextClass)}>
                      <DeficitShieldIcon ratio={deficitDisplay.deficitShareRatio} className={cn(deficitDisplay.isNeutralDeficit && 'opacity-70')} />
                      <span>{deficitDisplay.deficitInlineValue}</span>
                    </span>
                  )}
                  triggerClassName={deficitDisplay.deficitTextClass}
                  triggerAriaLabel={`Deficit share of total supplied plus deficit for ${reserve.tokenSymbol}`}
                  poolExplorerUrl={poolExplorerUrl}
                  onSort={sortActions.deficitRatio.onSort}
                  onSortSize={sortActions.deficitAmount.onSort}
                  onSortDeficitAmount={sortActions.deficitAmount.onSort}
                  isSortDeficitAmountActive={sortActions.deficitAmount.isActive}
                  deficitAmountSortOrder={sortActions.deficitAmount.sortOrder}
                  onSortSupplySize={sortActions.supply.onSort}
                  isSortSupplySizeActive={sortActions.supply.isActive}
                  supplySizeSortOrder={sortActions.supply.sortOrder}
                  isSortActive={sortActions.deficitRatio.isActive}
                  sortOrder={sortActions.deficitRatio.sortOrder}
                />
              ) : (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(event) => event.stopPropagation()}
                      className={cn(
                        'inline-flex items-center gap-1 ds-text-11 tabular-nums transition-colors',
                        'rounded-md py-0.5 pl-1 pr-0.5 -my-0.5 hover:bg-muted/50',
                        deficitDisplay.deficitTextClass,
                        deficitDisplay.isNeutralDeficit ? 'hover:text-muted-foreground/70' : 'hover:text-amber-600',
                      )}
                      aria-label={`Deficit details for ${reserve.tokenSymbol}`}
                    >
                      <DeficitShieldIcon ratio={deficitDisplay.deficitShareRatio} />
                      <span>{deficitDisplay.deficitInlineValue}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center" className="max-w-[18rem]">
                    <TooltipCalloutArrow />
                    <div className="space-y-1 ds-text-11">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">USD</span>
                        <span className="tabular-nums">{deficitUsdLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Token</span>
                        <span className="tabular-nums">{deficitDisplay.deficitInlineValue}</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            )}
          </div>
        </TableCell>
        {/* Utilization + Liquidity — right-aligned numeric column.
         * Liquidity amount as primary value (top), utilization rate as secondary (bottom).
         * UtilizationIndicator (bar) 在数字右侧作为视觉后缀。*/}
        <TableCell className="ds-reserves-cell-td ds-row-pad whitespace-nowrap text-right hidden md:table-cell tabular-nums ds-text-13">
          <div className="inline-flex items-center justify-end gap-[var(--ds-space-1-5)] w-full">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center justify-end gap-[var(--ds-space-1-5)] cursor-default">
                  <div className="flex flex-col items-end gap-[var(--ds-space-0-5)]">
                    <span className={`ds-text-13 font-bold tabular-nums ${
                      (availableLiquidityUsd != null && availableLiquidityUsd < 10000)
                        ? 'text-amber-600'
                        : 'ds-text-purple-600'
                    }`}>
                      {formatScenarioSize(availableLiquidityUsd, { inputMode, tokenPrice: displayTokenPrice, tokenSymbol: reserve.tokenSymbol })}
                    </span>
                    <span className={`ds-text-11 tabular-nums ${
                      displayUtilization != null && optimalPct != null && displayUtilization > optimalPct
                        ? 'text-amber-600'
                        : 'text-foreground'
                    }`}>
                      {formatPercent(displayUtilization)}
                    </span>
                  </div>
                  <UtilizationIndicator
                    current={displayUtilization}
                    optimal={optimalPct}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="w-[min(var(--ds-ring-tooltip-max-w),calc(100vw-2rem))] max-w-[var(--ds-ring-tooltip-max-w)] overflow-hidden p-3">
                <TooltipCalloutArrow />
                <UtilizationContent
                  current={displayUtilization ?? 0}
                  optimal={optimalPct ?? 0}
                  onSortUtilization={sortActions.util.onSort}
                  isSortUtilizationActive={sortActions.util.isActive}
                  utilizationSortOrder={sortActions.util.sortOrder}
                  onSortOptimal={sortActions.optimal.onSort}
                  isSortOptimalActive={sortActions.optimal.isActive}
                  optimalSortOrder={sortActions.optimal.sortOrder}
                  formulaLabel="U"
                />
              </TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
        {/* Supply */}
        <TableCell className="ds-reserves-cell-td ds-row-pad whitespace-nowrap text-right">
          <div className="flex flex-col items-end justify-center gap-[var(--ds-space-0-5)] min-h-[2.75rem]">
            {supplyBlocked ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-bold text-emerald-500/50 tabular-nums ds-text-14 cursor-auto">
                    {formatPercent(displaySupplyTotal)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Supply unavailable</TooltipContent>
              </Tooltip>
            ) : (
              <span className="font-bold ds-text-emerald-500 tabular-nums ds-text-14">
                {formatPercent(displaySupplyTotal)}
              </span>
            )}
            {displaySupplyIncentive !== null ? (
              <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-11 justify-end min-h-[1.25rem]">
                <span className={`tabular-nums font-medium ${supplyBlocked ? 'text-emerald-500/40' : 'ds-text-emerald-500-70'}`}>
                  {formatPercent(displaySupplyNative)}
                </span>
                <span className="text-muted-foreground/70">+</span>
                <button
                  type="button"
                  onClick={(e) => onIncentiveClick(e, reserve, 'supply', displaySupplyIncentive)}
                  className={`inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full transition-all duration-150 cursor-pointer tabular-nums ring-1 ${
                    supplyBlocked
                      ? 'bg-emerald-500/10 text-emerald-500/50 hover:bg-emerald-500/20 ring-emerald-500/20'
                      : 'ds-bg-emerald-500-10 ds-text-emerald-500-70 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.25)] hover:ring-2 hover:ring-[rgb(var(--ds-emerald-500-rgb)/0.3)] ds-ring-emerald-500-15'
                  }`}
                >
                  <span>{formatPercent(displaySupplyIncentive)}</span>
                  <IncentiveIcon width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} />
                </button>
              </div>
            ) : !supplyBlocked ? (
              <span className="ds-text-10 text-muted-foreground/50">Base {isApy ? 'APY' : 'APR'} only</span>
            ) : null}
          </div>
        </TableCell>
        {/* Spread */}
        <TableCell className="ds-reserves-cell-td ds-row-pad whitespace-nowrap text-right hidden md:table-cell">
          <span
            className={`font-bold tabular-nums ds-text-14 ${
              spread !== null ? 'ds-text-purple-500' : 'text-muted-foreground/70'
            }`}
          >
            {formatSpread(spread)}
          </span>
        </TableCell>
        {/* Borrow */}
        <TableCell className="ds-reserves-cell-td-edge-r ds-row-pad whitespace-nowrap text-right">
          <div className="flex flex-col items-end justify-center gap-[var(--ds-space-0-5)] min-h-[2.75rem]">
            {borrowBlocked ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-bold text-cyan-500/50 tabular-nums ds-text-14 cursor-auto">
                    {displayBorrowTotal !== null ? formatPercent(displayBorrowTotal) : '-'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Borrow unavailable</TooltipContent>
              </Tooltip>
            ) : (
              <span className="font-bold ds-text-brand-cyan tabular-nums ds-text-14">
                {displayBorrowTotal !== null ? formatPercent(displayBorrowTotal) : '-'}
              </span>
            )}
            {displayBorrowIncentive !== null ? (
              <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-11 justify-end min-h-[1.25rem]">
                {displayBorrowNative !== null && (
                  <>
                    <span className={`tabular-nums font-medium ${borrowBlocked ? 'text-cyan-500/40' : 'ds-text-brand-cyan-70'}`}>
                      {formatPercent(displayBorrowNative)}
                    </span>
                    <span className="text-muted-foreground/70">-</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={(e) => onIncentiveClick(e, reserve, 'borrow', displayBorrowIncentive)}
                  className={`inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full transition-all duration-150 cursor-pointer tabular-nums ring-1 ${
                    borrowBlocked
                      ? 'bg-cyan-500/10 text-cyan-500/50 hover:bg-cyan-500/20 ring-cyan-500/20'
                      : 'ds-bg-brand-cyan-10 ds-text-brand-cyan-70 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.25)] hover:ring-2 hover:ring-[rgb(var(--ds-brand-cyan-rgb)/0.3)] ds-ring-brand-cyan-15'
                  }`}
                >
                  <span>{formatPercent(displayBorrowIncentive)}</span>
                  <IncentiveIcon width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} />
                </button>
              </div>
            ) : !borrowBlocked ? (
              <span className="ds-text-10 text-muted-foreground/50">Base {isApy ? 'APR' : 'APY'} only</span>
            ) : null}
          </div>
        </TableCell>
      </TableRow>
      {/* Expanded simulation panel with smooth animation */}
      <TableRow
        className="border-0 bg-transparent hover:bg-transparent data-[state=selected]:bg-transparent"
        onClick={(event) => event.stopPropagation()}
      >
        <TableCell colSpan={8} className="min-w-0 p-0">
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-in-out"
            style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              {hasSimulationMounted && simulation && (
                <div
                  data-reserves-simulation-scrollport
                  className="px-[var(--ds-space-3)] py-[var(--ds-space-3)]"
                >
                  <SimulationSubRow
                    reserve={reserve}
                    simulation={simulation}
                    isApy={isApy}
                    supplyInput={supplyInput}
                    borrowInput={borrowInput}
                    inputMode={inputMode}
                    onCorrectSupplyInput={onCorrectSupplyInput}
                    onCorrectBorrowInput={onCorrectBorrowInput}
                  />
                </div>
              )}
            </div>
          </div>
        </TableCell>
      </TableRow>
    </Fragment>
  );
});

DesktopReserveRow.displayName = 'DesktopReserveRow';

export default DesktopReserveRow;
