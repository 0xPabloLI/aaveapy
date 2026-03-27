import { memo, Fragment, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ReserveWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { formatPercent, formatScenarioSize, formatSpread, formatUsd } from '@/lib/formatters';
import { buildAaveMarketUrl, buildAaveReserveUrl } from '@/lib/aaveLinks';
import { externalLinkTabProps } from '@/lib/externalNavigation';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import { getChainIconSrc } from '@/lib/chainIcons';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import SimulationSubRow from './SimulationSubRow';
import CapProgressRing from './CapProgressRing';
import BorrowCapProgressRing from './BorrowCapProgressRing';
import UtilizationIndicator from './UtilizationIndicator';
import type { RateSimulationResult, ScenarioInputMode } from '@/hooks/useRateSimulation';
import { getPoolLiquidityUsd, getScenarioSupplySizeUsd, getTotalBorrowedUsd, getValidTokenPrice } from '@/lib/scenarioSize';

/* ─── Memoised chain icon ─── */
const ChainIcon = memo(({ chain, className = '' }: { chain: string; className?: string }) => {
  const size = 'w-3.5 h-3.5';
  const src = getChainIconSrc(chain);
  if (!src) {
    return (
      <div className={`${size} rounded-full bg-current opacity-40 flex items-center justify-center ds-text-8 font-bold`}>
        {chain.charAt(0)}
      </div>
    );
  }
  return <img src={src} alt={`${chain} logo`} className={`${size} ${className}`} loading="lazy" />;
});
ChainIcon.displayName = 'ChainIcon';

/* ─── Props ─── */
interface DesktopReserveRowProps {
  reserve: ReserveWithSpread;
  reserveId: string;
  isExpanded: boolean;
  onToggleExpand: (reserveId: string) => void;
  onSelectMarket?: (marketName: string) => void;
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
}

const DesktopReserveRow = memo(({
  reserve,
  reserveId,
  isExpanded,
  onToggleExpand,
  onSelectMarket,
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
}: DesktopReserveRowProps) => {
  const [hasSimulationMounted, setHasSimulationMounted] = useState(isExpanded);

  useEffect(() => {
    if (isExpanded) {
      setHasSimulationMounted(true);
    }
  }, [isExpanded]);

  const getMarketDisplayName = () => {
    if (reserve.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[reserve.marketName]) {
      return ETHEREUM_MARKET_NAMES[reserve.marketName];
    }
    return reserve.chainName;
  };

  const { iconSymbol, logoURI } = fetchIconSymbolAndName({
    underlyingAsset: reserve.tokenAddress,
    symbol: reserve.tokenSymbol,
    name: reserve.tokenName,
  });

  const aaveUrl = buildAaveReserveUrl({ marketName: reserve.marketName, tokenAddress: reserve.tokenAddress }) || '#';
  const aaveMarketUrl = buildAaveMarketUrl(reserve.marketName);

  const displayTokenPrice = getValidTokenPrice(simulation?.tokenPrice, reserve.tokenPrice);
  const displayReserveSizeUsd = getScenarioSupplySizeUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    supplyCapUsd: reserve.supplyCapUsd,
    rawSupplyInput: supplyInput,
    inputMode,
    tokenPrice: displayTokenPrice,
  });
  const totalBorrowedUsd = getTotalBorrowedUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    utilizationPct: reserve.utilizationPct,
  });
  const poolLiquidity = getPoolLiquidityUsd({
    reserveSizeUsd: reserve.reserveSizeUsd,
    totalBorrowedUsd,
  });

  return (
    <Fragment>
      <TableRow
        data-reserve-id={reserveId}
        className={`transition-colors duration-150 cursor-pointer hover:bg-muted/60 active:bg-muted/80 ${
          isExpanded ? 'bg-muted/30' : ''
        }`}
        onClick={() => onToggleExpand(reserveId)}
      >
        {/* Token — 右侧留白更小 */}
        <TableCell className="pl-[var(--ds-space-3)] pr-[var(--ds-space-1)] ds-row-pad whitespace-nowrap text-center">
          <a
            href={aaveUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="group/token inline-flex items-center justify-center gap-[var(--ds-space-2)] hover:opacity-80 transition-opacity duration-150"
            aria-label={`Open ${reserve.tokenSymbol} on Aave`}
            title="Open on Aave"
          >
            <TokenIcon symbol={iconSymbol} size={28} loading="eager" logoURI={logoURI} />
            <span className="font-semibold text-foreground ds-text-13">
              {reserve.tokenSymbol}
            </span>
            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 -ml-1 group-hover/token:opacity-70 transition-opacity duration-150" />
          </a>
        </TableCell>
        {/* Price — 左右留白更小 */}
        <TableCell className="px-[var(--ds-space-1)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell tabular-nums text-muted-foreground ds-text-13">
          {formatUsd(reserve.tokenPrice)}
        </TableCell>
        {/* Market — 左侧留白更小，右侧与其余列统一 */}
        <TableCell className="pl-[var(--ds-space-1)] pr-[var(--ds-space-2)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell">
          <div className="group/market inline-flex items-center justify-center gap-[var(--ds-space-1)]">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectMarket?.(reserve.marketName);
              }}
              className="inline-flex items-center justify-center gap-[var(--ds-space-1-5)] px-[var(--ds-space-2-5)] py-[var(--ds-space-1)] rounded-full ds-text-13 font-medium bg-muted/50 text-muted-foreground border border-border/60 hover:bg-muted hover:text-foreground hover:border-border/80 active:scale-[0.98] transition-all duration-150"
              aria-label={`Filter by ${getMarketDisplayName()} market`}
              title={`Filter by ${getMarketDisplayName()}`}
            >
              <ChainIcon chain={reserve.chainName} />
              {getMarketDisplayName()}
            </button>
            {aaveMarketUrl ? (
              <a
                href={aaveMarketUrl}
                {...externalLinkTabProps(isMobile)}
                onClick={(event) => event.stopPropagation()}
                className="inline-flex shrink-0 items-center justify-center hover:opacity-80 transition-opacity duration-100"
                aria-label={`Open ${getMarketDisplayName()} market on Aave`}
                title="Open market on Aave"
              >
                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 -ml-0.5 group-hover/market:opacity-70 transition-opacity duration-75" />
              </a>
            ) : null}
          </div>
        </TableCell>
        {/* Size (Supply + Borrow) */}
        <TableCell className="px-[var(--ds-space-2)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell tabular-nums ds-text-13">
          <div className="flex flex-col items-center justify-center gap-[var(--ds-space-0-5)]">
            {/* Supply Size - Green (match Supply APY primary: ds-text-emerald-500) */}
            <div className="inline-flex items-center justify-center gap-[var(--ds-space-1-5)] ds-text-emerald-500">
              <span className="font-medium tabular-nums">
                {formatScenarioSize(displayReserveSizeUsd, { inputMode, tokenPrice: displayTokenPrice, tokenSymbol: reserve.tokenSymbol })}
              </span>
              <CapProgressRing
                size={displayReserveSizeUsd}
                cap={reserve.supplyCapUsd}
                displayMode={inputMode}
                tokenPrice={displayTokenPrice}
                tokenSymbol={reserve.tokenSymbol}
              />
            </div>
            {/* Borrow Size - Cyan (match tooltip: font-medium + ds-text-brand-cyan) */}
            <div className="inline-flex items-center justify-center gap-[var(--ds-space-1-5)] ds-text-brand-cyan">
              <span className="font-medium tabular-nums">
                {formatScenarioSize(totalBorrowedUsd, { inputMode, tokenPrice: displayTokenPrice, tokenSymbol: reserve.tokenSymbol })}
              </span>
              <BorrowCapProgressRing
                borrowed={totalBorrowedUsd}
                cap={reserve.borrowCapUsd}
                poolLiquidity={poolLiquidity}
                displayMode={inputMode}
                tokenPrice={displayTokenPrice}
                tokenSymbol={reserve.tokenSymbol}
              />
            </div>
          </div>
        </TableCell>
        {/* Utilization */}
        <TableCell className="px-[var(--ds-space-2)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell tabular-nums ds-text-13">
          <div className="inline-flex items-center justify-center gap-[var(--ds-space-1-5)]">
            <span className={displayUtilization != null && simulation?.utilization.optimal != null && displayUtilization > simulation.utilization.optimal ? 'text-amber-600' : 'text-foreground'}>
              {formatPercent(displayUtilization)}
            </span>
            <UtilizationIndicator
              current={displayUtilization}
              optimal={simulation?.utilization.optimal ?? null}
            />
          </div>
        </TableCell>
        {/* Supply */}
        <TableCell className="px-[var(--ds-space-2)] ds-row-pad whitespace-nowrap text-center">
          <div className="flex flex-col items-center justify-center gap-[var(--ds-space-0-5)] min-h-[2.75rem]">
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
              <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-11 justify-center min-h-[1.25rem]">
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
        <TableCell className="px-[var(--ds-space-2)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell">
          <span
            className={`font-bold tabular-nums ds-text-14 ${
              spread !== null ? 'ds-text-purple-500' : 'text-muted-foreground/70'
            }`}
          >
            {formatSpread(spread)}
          </span>
        </TableCell>
        {/* Borrow — 左侧与各列统一，右侧保留外边距 */}
        <TableCell className="pl-[var(--ds-space-2)] pr-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center">
          <div className="flex flex-col items-center justify-center gap-[var(--ds-space-0-5)] min-h-[2.75rem]">
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
              <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-11 justify-center min-h-[1.25rem]">
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
      <TableRow
        className="border-0"
        onClick={(event) => event.stopPropagation()}
        style={{ visibility: isExpanded ? 'visible' : 'collapse' }}
      >
        <TableCell colSpan={8} className="min-w-0 p-0">
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-in-out"
            style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="px-[var(--ds-space-3)] py-[var(--ds-space-3)] bg-transparent">
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
            </div>
          </div>
        </TableCell>
      </TableRow>
    </Fragment>
  );
});

DesktopReserveRow.displayName = 'DesktopReserveRow';

export default DesktopReserveRow;
