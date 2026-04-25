import { memo, Fragment, useEffect, useState, useCallback } from 'react';
import { ExternalLink, Plus, Snowflake } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ReserveWithSpread } from '@/types/aave';
import { formatPercent, formatScenarioSize, formatSpread, formatUsd, getReserveMarketDisplayName } from '@/lib/formatters';
import { buildAaveMarketUrl, buildAaveUrl, buildAaveProHubUrl } from '@/lib/aaveLinks';
import { getProtocolVersion } from '@/lib/protocolVersion';
import { buildPoolExplorerUrl } from '@/lib/poolExplorerLinks';
import { externalLinkTabProps } from '@/lib/externalNavigation';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import { getChainIconSrc } from '@/lib/chainIcons';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import {
  calculateDeficitShareRatio,
  formatReserveDeficitTokenCompact,
  getDeficitSeverity,
  getReserveDeficitUsdAmount,
  hasReserveDeficit,
} from '@/lib/deficit';
import DeficitLiquidityRing from './DeficitLiquidityRing';
import SimulationSubRow from './SimulationSubRow';
import CapProgressRing from './CapProgressRing';
import BorrowCapProgressRing from './BorrowCapProgressRing';
import UtilizationIndicator from './UtilizationIndicator';
import DeficitShieldIcon from './DeficitShieldIcon';
import AssetActionMenu from './AssetActionMenu';
import type { RateSimulationResult, ScenarioInputMode } from '@/hooks/useRateSimulation';

import { getPoolLiquidityUsd, getScenarioSupplySizeUsd, getTotalBorrowedUsd, getValidTokenPrice } from '@/lib/scenarioSize';
import { cn } from '@/lib/utils';

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
  marketButton: 'inline-flex items-center justify-center gap-[var(--ds-space-1-5)] rounded-full border border-border/60 bg-muted/45 px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] text-foreground transition-all duration-150 hover:bg-muted/70 hover:border-border/80 active:scale-[0.98]',
  marketText: 'whitespace-nowrap ds-text-13 font-medium leading-tight',
  hubShell: 'group/hub-link relative inline-flex max-w-full items-center justify-center pl-3 pr-3',
  hubPill: 'inline-flex max-w-[8.5rem] items-center truncate whitespace-nowrap rounded-full px-2 py-0.5 ds-text-12 font-normal leading-none',
  hubPillV4: 'text-[rgb(var(--ds-brand-magenta-rgb))] bg-[rgb(var(--ds-brand-magenta-rgb))]/10 font-medium',
  hubPillDefault: 'text-muted-foreground/70 bg-muted/40',
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
  /** Callback to add/remove from portfolio. */
  onPortfolioToggle?: (reserveId: string, reserve: ReserveWithSpread, side?: 'supply' | 'borrow') => void;
}

const DesktopReserveRow = memo(({
  reserve,
  reserveId,
  isExpanded,
  onToggleExpand,
  onSelectMarket,
  onMarketChipClick,
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
}: DesktopReserveRowProps) => {
  const [hasSimulationMounted, setHasSimulationMounted] = useState(isExpanded);

  useEffect(() => {
    if (isExpanded) {
      setHasSimulationMounted(true);
    }
  }, [isExpanded]);

  const { iconSymbol, logoURI } = fetchIconSymbolAndName({
    underlyingAsset: reserve.tokenAddress,
    symbol: reserve.tokenSymbol,
    name: reserve.tokenName,
  });

  const aaveUrl = buildAaveUrl({ marketName: reserve.marketName, tokenAddress: reserve.tokenAddress, aaveProReserveId: reserve.aaveProReserveId }) || '#';
  const aaveMarketUrl = buildAaveMarketUrl(reserve.marketName);
  const poolExplorerUrl = buildPoolExplorerUrl(reserve.marketName);
  const aaveProHubUrl = buildAaveProHubUrl(reserve);
  const marketDisplayName = getReserveMarketDisplayName(reserve);
  const isV4Market = getProtocolVersion(reserve.marketName) === 'v4';

  const displayTokenPrice = getValidTokenPrice(simulation?.tokenPrice, reserve.tokenPrice);
  const displayReserveSizeUsd = getScenarioSupplySizeUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    supplyCapUsd: reserve.supplyCapUsd,
    rawSupplyInput: supplyInput,
    inputMode,
    tokenPrice: displayTokenPrice,
  });
  const baseTotalBorrowedUsd = getTotalBorrowedUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    utilizationPct: reserve.utilizationPct,
  });
  const totalBorrowedUsd = simulation?.marketMetrics.totalBorrowedUsdAfter ?? baseTotalBorrowedUsd;
  const basePoolLiquidity = getPoolLiquidityUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    totalBorrowedUsd: baseTotalBorrowedUsd,
  });
  const poolLiquidity = simulation?.marketMetrics.availableLiquidityUsdAfter ?? basePoolLiquidity;
  const hasDeficit = hasReserveDeficit(reserve);
  const deficitUsd = getReserveDeficitUsdAmount(reserve, displayTokenPrice);
  const deficitTokenCompact = formatReserveDeficitTokenCompact(reserve);
  const deficitInlineValue = inputMode === 'usd'
    ? (deficitUsd != null ? formatScenarioSize(deficitUsd, { inputMode: 'usd' }) : '-')
    : deficitTokenCompact;
  const deficitTokenLabel = deficitTokenCompact !== '-' ? deficitTokenCompact : undefined;
  const deficitUsdLabel = deficitUsd != null ? formatUsd(deficitUsd) : '— (token price unavailable)';
  const deficitShareRatio = calculateDeficitShareRatio({
    deficitUsd,
    totalSuppliedUsd: displayReserveSizeUsd,
  });
  const deficitSeverity = getDeficitSeverity(deficitShareRatio);
  const isNeutralDeficit = deficitSeverity === 'neutral';
  const deficitTextClass = deficitSeverity === 'critical'
    ? 'text-amber-600/90'
    : deficitSeverity === 'warning'
      ? 'text-amber-500/90'
      : 'text-muted-foreground/60';

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
  const hasSupplyCap =
    reserve.supplyCapUsd != null && Number.isFinite(reserve.supplyCapUsd) && reserve.supplyCapUsd > 0;
  const hasBorrowCap =
    reserve.borrowCapUsd != null && Number.isFinite(reserve.borrowCapUsd) && reserve.borrowCapUsd > 0;

  return (
    <Fragment>
      <TableRow
        data-reserve-id={reserveId}
        className={cn(
          'transition-colors duration-150 cursor-pointer hover:bg-muted/60 active:bg-muted/80',
          isExpanded && 'bg-muted/30',
          isExpanded &&
            '[&_td]:sticky [&_td]:z-[25] [&_td]:border-b [&_td]:border-border/60 [&_td]:bg-card [&_td]:shadow-[0_1px_2px_0_rgb(0_0_0/0.04)] [&_td]:[top:var(--reserves-expanded-main-row-top,5.75rem)]',
          reserve.isFrozenOrPaused && 'ds-bg-sky-500-8',
        )}
        onClick={() => onToggleExpand(reserveId)}
      >
        {/* Token */}
        <TableCell className="ds-reserves-cell-td-edge-l ds-row-pad text-left overflow-hidden">
          <div className="flex w-full min-w-0 items-center justify-start gap-[var(--ds-space-2)]">
          {isPortfolioMode && onPortfolioToggle && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPortfolioToggle(reserveId, reserve);
              }}
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all duration-150',
                isInPortfolio
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'border-border/60 text-muted-foreground/40 hover:border-primary/40 hover:text-primary/60',
              )}
              aria-label={isInPortfolio ? `Remove ${reserve.tokenSymbol} from portfolio` : `Add ${reserve.tokenSymbol} to portfolio`}
              title={isInPortfolio ? 'Remove from portfolio' : 'Add to portfolio'}
            >
              {isInPortfolio ? (
                <span className="ds-text-11 font-bold leading-none">✓</span>
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </button>
          )}
          <div className="group/token flex min-w-0 max-w-full items-center justify-start gap-[var(--ds-space-1-5)]">
            <TokenIcon symbol={iconSymbol} size={28} loading="eager" logoURI={logoURI} className="shrink-0" />
            <span className="font-semibold text-foreground ds-text-13 break-words min-w-0 [max-width:max-content]">
              {reserve.tokenSymbol}
            </span>
            {reserve.isFrozenOrPaused && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 ds-text-9 font-medium text-sky-500 bg-sky-500/10">
                    <Snowflake className="w-2.5 h-2.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Frozen or paused</TooltipContent>
              </Tooltip>
            )}
            <AssetActionMenu
              tokenSymbol={reserve.tokenSymbol}
              tokenAddress={reserve.tokenAddress}
              marketName={reserve.marketName}
              aaveProReserveId={reserve.aaveProReserveId}
              chainName={reserve.chainName}
              hubAddress={reserve.hubAddress}
              isMobile={isMobile}
              triggerSize={12}
              triggerClassName="shrink-0"
            />
          </div>
          </div>
        </TableCell>
        {/* Market — DeFi/lending 协议表惯例：Asset → Market 紧贴 */}
        <TableCell className="ds-reserves-cell-td ds-row-pad text-center hidden md:table-cell">
          <div className="flex items-center justify-center">
            <div className={marketCellClassNames.stack}>
              <div className={marketCellClassNames.marketShell}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMarketChipClick?.(reserveId);
                    onSelectMarket?.(reserve.marketName);
                  }}
                  className={marketCellClassNames.marketButton}
                  aria-label={`Filter by ${marketDisplayName} market`}
                  title={`Filter by ${marketDisplayName}`}
                >
                  <ChainIcon chain={reserve.chainName} />
                  <span className={marketCellClassNames.marketText}>{marketDisplayName}</span>
                </button>
                {aaveMarketUrl && (
                  <a
                    href={aaveMarketUrl}
                    {...externalLinkTabProps(isMobile)}
                    onClick={(event) => event.stopPropagation()}
                    className={cn(marketCellClassNames.externalLink, 'group-hover/market-link:pointer-events-auto group-hover/market-link:opacity-100')}
                    aria-label={`Open ${marketDisplayName} market on Aave`}
                    title="Open market on Aave"
                  >
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </a>
                )}
              </div>
              {reserve.hubName && (
                <div className={marketCellClassNames.hubShell}>
                  <span
                    className={cn(
                      marketCellClassNames.hubPill,
                      isV4Market ? marketCellClassNames.hubPillV4 : marketCellClassNames.hubPillDefault,
                    )}
                    aria-label={`${reserve.hubName} hub`}
                    title={`${reserve.hubName} hub`}
                  >
                    {reserve.hubName}
                  </span>
                  {aaveProHubUrl && (
                    <a
                      href={aaveProHubUrl}
                      {...externalLinkTabProps(isMobile)}
                      onClick={(event) => event.stopPropagation()}
                      className={cn(marketCellClassNames.externalLink, 'group-hover/hub-link:pointer-events-auto group-hover/hub-link:opacity-100')}
                      aria-label={`View ${reserve.hubName} hub on Aave Pro`}
                      title={`Open hub ${reserve.hubName} on Aave Pro`}
                    >
                      <ExternalLink className={cn(
                        "w-2.5 h-2.5",
                        isV4Market ? "text-foreground/60" : "text-muted-foreground/60"
                      )} />
                    </a>
                  )}
                </div>
              )}
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
                cap={reserve.supplyCapUsd}
                displayMode={inputMode}
                tokenPrice={displayTokenPrice}
                tokenSymbol={reserve.tokenSymbol}
                label={<span className="font-medium tabular-nums">{supplySizeLabel}</span>}
                triggerClassName="ds-text-emerald-500"
                triggerAriaLabel={`Supply cap details for ${reserve.tokenSymbol}`}
              />
            ) : (
              <div className="inline-flex items-center gap-[var(--ds-space-1-5)] ds-text-emerald-500">
                <span className="font-medium tabular-nums">{supplySizeLabel}</span>
                <span aria-hidden className="inline-block w-3 h-3 shrink-0" />
              </div>
            )}
            {/* Borrow Size - Cyan (match tooltip: font-medium + ds-text-brand-cyan) */}
            {hasBorrowCap ? (
              <BorrowCapProgressRing
                borrowed={totalBorrowedUsd}
                cap={reserve.borrowCapUsd}
                poolLiquidity={poolLiquidity}
                displayMode={inputMode}
                tokenPrice={displayTokenPrice}
                tokenSymbol={reserve.tokenSymbol}
                label={<span className="font-medium tabular-nums">{borrowSizeLabel}</span>}
                triggerClassName="ds-text-brand-cyan"
                triggerAriaLabel={`Borrow cap details for ${reserve.tokenSymbol}`}
              />
            ) : (
              <div className="inline-flex items-center gap-[var(--ds-space-1-5)] ds-text-brand-cyan">
                <span className="font-medium tabular-nums">{borrowSizeLabel}</span>
                <span aria-hidden className="inline-block w-3 h-3 shrink-0" />
              </div>
            )}
            {hasDeficit && (
              deficitUsd != null ? (
                <DeficitLiquidityRing
                  deficitUsd={deficitUsd}
                  totalSuppliedUsd={displayReserveSizeUsd}
                  tokenDeficitLabel={deficitTokenLabel}
                  displayMode={inputMode}
                  tokenPrice={displayTokenPrice}
                  tokenSymbol={reserve.tokenSymbol}
                  label={(
                    <span className={cn('inline-flex items-center gap-1 ds-text-11 tabular-nums', deficitTextClass)}>
                      <DeficitShieldIcon ratio={deficitShareRatio} className={cn(isNeutralDeficit && 'opacity-70')} />
                      <span>{deficitInlineValue}</span>
                    </span>
                  )}
                  triggerClassName={deficitTextClass}
                  triggerAriaLabel={`Deficit share of total supplied plus deficit for ${reserve.tokenSymbol}`}
                  poolExplorerUrl={poolExplorerUrl}
                />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(event) => event.stopPropagation()}
                      className={cn(
                        'inline-flex items-center gap-1 ds-text-11 tabular-nums transition-colors',
                        deficitTextClass,
                        isNeutralDeficit ? 'hover:text-muted-foreground/70' : 'hover:text-amber-600',
                      )}
                      aria-label={`Deficit details for ${reserve.tokenSymbol}`}
                    >
                      <DeficitShieldIcon ratio={deficitShareRatio} />
                      <span>{deficitInlineValue}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center" className="max-w-[18rem]">
                    <div className="space-y-1 ds-text-11">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">USD</span>
                        <span className="tabular-nums">{deficitUsdLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Token</span>
                        <span className="tabular-nums">{deficitInlineValue}</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            )}
          </div>
        </TableCell>
        {/* Utilization + Liquidity — right-aligned numeric column.
         * 数字 stack 贴右；UtilizationIndicator (bar) 在数字右侧作为视觉后缀。
         * Bar 永远存在，不需要 placeholder。*/}
        <TableCell className="ds-reserves-cell-td ds-row-pad whitespace-nowrap text-right hidden md:table-cell tabular-nums ds-text-13">
          <div className="inline-flex items-center justify-end gap-[var(--ds-space-1-5)] w-full">
            <div className="flex flex-col items-end gap-[var(--ds-space-0-5)]">
              <span className={displayUtilization != null && simulation?.utilization.optimal != null && displayUtilization > simulation.utilization.optimal ? 'text-amber-600' : 'text-foreground'}>
                {formatPercent(displayUtilization)}
              </span>
              <span className={`ds-text-11 tabular-nums font-medium ${
                poolLiquidity != null && poolLiquidity < 1000
                  ? 'text-amber-600'
                  : poolLiquidity != null && poolLiquidity < 10000
                    ? 'text-amber-500'
                    : 'ds-text-purple-500'
              }`}>
                {formatScenarioSize(poolLiquidity, { inputMode, tokenPrice: displayTokenPrice, tokenSymbol: reserve.tokenSymbol })}
              </span>
            </div>
            <UtilizationIndicator
              current={displayUtilization}
              optimal={simulation?.utilization.optimal ?? null}
            />
          </div>
        </TableCell>
        {/* Supply */}
        <TableCell className="ds-reserves-cell-td ds-row-pad whitespace-nowrap text-right">
          <div className="flex flex-col items-end justify-center gap-[var(--ds-space-0-5)] min-h-[2.75rem]">
            {reserve.supplyDisabled ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-bold text-secondary tabular-nums ds-text-14 cursor-auto">
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
            {displaySupplyIncentive !== null && (
              <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-11 justify-end min-h-[1.25rem]">
                <span className={`tabular-nums font-medium ${reserve.supplyDisabled ? 'text-secondary' : 'ds-text-emerald-500-70'}`}>
                  {formatPercent(displaySupplyNative)}
                </span>
                <span className="text-muted-foreground/70">+</span>
                <button
                  type="button"
                  onClick={(e) => onIncentiveClick(e, reserve, 'supply', displaySupplyIncentive)}
                  className={`inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full transition-all duration-150 cursor-pointer tabular-nums ring-1 ${
                    reserve.supplyDisabled
                      ? 'bg-secondary/10 text-secondary hover:bg-secondary/20 ring-secondary/20'
                      : 'ds-bg-emerald-500-10 ds-text-emerald-500-70 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.25)] hover:ring-2 hover:ring-[rgb(var(--ds-emerald-500-rgb)/0.3)] ds-ring-emerald-500-15'
                  }`}
                >
                  <span>{formatPercent(displaySupplyIncentive)}</span>
                  <IncentiveIcon width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} />
                </button>
              </div>
            )}
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
            {reserve.borrowDisabled ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-bold text-secondary tabular-nums ds-text-14 cursor-auto">
                    {displayBorrowTotal !== null ? formatPercent(displayBorrowTotal) : '-'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Borrow disabled</TooltipContent>
              </Tooltip>
            ) : (
              <span className="font-bold ds-text-brand-cyan tabular-nums ds-text-14">
                {displayBorrowTotal !== null ? formatPercent(displayBorrowTotal) : '-'}
              </span>
            )}
            {displayBorrowIncentive !== null && (
              <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-11 justify-end min-h-[1.25rem]">
                {displayBorrowNative !== null && (
                  <>
                    <span className={`tabular-nums font-medium ${reserve.borrowDisabled ? 'text-secondary' : 'ds-text-brand-cyan-70'}`}>
                      {formatPercent(displayBorrowNative)}
                    </span>
                    <span className="text-muted-foreground/70">-</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={(e) => onIncentiveClick(e, reserve, 'borrow', displayBorrowIncentive)}
                  className={`inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full transition-all duration-150 cursor-pointer tabular-nums ring-1 ${
                    reserve.borrowDisabled
                      ? 'bg-secondary/10 text-secondary hover:bg-secondary/20 ring-secondary/20'
                      : 'ds-bg-brand-cyan-10 ds-text-brand-cyan-70 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.25)] hover:ring-2 hover:ring-[rgb(var(--ds-brand-cyan-rgb)/0.3)] ds-ring-brand-cyan-15'
                  }`}
                >
                  <span>{formatPercent(displayBorrowIncentive)}</span>
                  <IncentiveIcon width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} />
                </button>
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow
          className="border-0 bg-transparent hover:bg-transparent data-[state=selected]:bg-transparent"
          onClick={(event) => event.stopPropagation()}
        >
          <TableCell colSpan={8} className="min-w-0 p-0">
            <div
              data-reserves-simulation-scrollport
              className="px-[var(--ds-space-3)] py-[var(--ds-space-3)]"
            >
              {hasSimulationMounted && simulation && (
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
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
});

DesktopReserveRow.displayName = 'DesktopReserveRow';

export default DesktopReserveRow;
