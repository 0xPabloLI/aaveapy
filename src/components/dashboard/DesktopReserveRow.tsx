import { memo, Fragment } from 'react';
import { ExternalLink } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ReserveWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { formatPercent, formatSpread, formatReserveSizeUsd, formatUsd } from '@/lib/formatters';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import { getChainIconSrc } from '@/lib/chainIcons';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import SimulationSubRow from './SimulationSubRow';
import type { RateSimulationResult, ScenarioInputMode } from '@/hooks/useRateSimulation';
import { parseNumberInput } from '@/lib/numberFormat';

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
  spread: number | null;
  simulation: RateSimulationResult | undefined;
  supplyInput: string;
  borrowInput: string;
  inputMode: ScenarioInputMode;
  isApy: boolean;
  isMobile: boolean;
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
  spread,
  simulation,
  supplyInput,
  borrowInput,
  inputMode,
  isApy,
  isMobile,
}: DesktopReserveRowProps) => {
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

  const supplyInputRaw = parseNumberInput(supplyInput);
  const supplyInputUsd =
    inputMode === 'usd'
      ? supplyInputRaw
      : simulation?.tokenPrice && Number.isFinite(simulation.tokenPrice)
        ? supplyInputRaw * simulation.tokenPrice
        : 0;
  const displayReserveSizeUsd =
    reserve.reserveSizeUsd != null && Number.isFinite(reserve.reserveSizeUsd) && supplyInputUsd > 0
      ? reserve.reserveSizeUsd + supplyInputUsd
      : reserve.reserveSizeUsd;

  return (
    <Fragment>
      <TableRow
        data-reserve-id={reserveId}
        className={`transition-colors duration-150 cursor-pointer hover:bg-muted/60 active:bg-muted/80 ${
          isExpanded ? 'bg-muted/30' : ''
        }`}
        onClick={() => onToggleExpand(reserveId)}
      >
        {/* Token */}
        <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center">
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
        {/* Price */}
        <TableCell className="px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell tabular-nums text-muted-foreground ds-text-13">
          {formatUsd(reserve.tokenPrice)}
        </TableCell>
        {/* Market */}
        <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell">
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
        </TableCell>
        {/* Size/Cap */}
        <TableCell className="px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell tabular-nums text-foreground ds-text-13">
          <span>{formatReserveSizeUsd(displayReserveSizeUsd)}</span>
          {reserve.supplyCapUsd != null && Number.isFinite(reserve.supplyCapUsd) && (
            <span className="text-muted-foreground">/{formatReserveSizeUsd(reserve.supplyCapUsd)}</span>
          )}
        </TableCell>
        {/* Supply */}
        <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center">
          <div className="flex flex-col items-center justify-center gap-[var(--ds-space-0-5)] min-h-[2.75rem]">
            {reserve.supplyDisabled ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-bold text-muted-foreground tabular-nums ds-text-14 cursor-help">
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
                <span className={`tabular-nums ${reserve.supplyDisabled ? 'text-muted-foreground/70' : 'ds-text-emerald-500-70'}`}>
                  {formatPercent(displaySupplyNative)}
                </span>
                <span className="text-muted-foreground/70">+</span>
                <button
                  type="button"
                  onClick={(e) => onIncentiveClick(e, reserve, 'supply', displaySupplyIncentive)}
                  className={`inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full transition-all duration-150 cursor-pointer tabular-nums ${
                    reserve.supplyDisabled
                      ? 'bg-muted/30 text-muted-foreground/70 hover:bg-muted/50 ring-1 ring-border/30'
                      : 'ds-bg-emerald-500-10 ds-text-emerald-500-70 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.25)] hover:ring-2 hover:ring-[rgb(var(--ds-emerald-500-rgb)/0.3)] ring-1 ds-ring-emerald-500-15'
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
        <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell">
          <span
            className={`font-bold tabular-nums ds-text-14 ${
              spread !== null ? 'ds-text-purple-500' : 'text-muted-foreground/70'
            }`}
          >
            {formatSpread(spread)}
          </span>
        </TableCell>
        {/* Borrow */}
        <TableCell className="w-1/5 px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center">
          <div className="flex flex-col items-center justify-center gap-[var(--ds-space-0-5)] min-h-[2.75rem]">
            {reserve.borrowDisabled ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-bold text-muted-foreground tabular-nums ds-text-14 cursor-help">
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
                    <span className={`tabular-nums ${reserve.borrowDisabled ? 'text-muted-foreground/70' : 'ds-text-brand-cyan-70'}`}>
                      {formatPercent(displayBorrowNative)}
                    </span>
                    <span className="text-muted-foreground/70">-</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={(e) => onIncentiveClick(e, reserve, 'borrow', displayBorrowIncentive)}
                  className={`inline-flex items-center gap-[var(--ds-space-0-5)] px-[var(--ds-space-0-5)] py-[var(--ds-space-0)] rounded-full transition-all duration-150 cursor-pointer tabular-nums ${
                    reserve.borrowDisabled
                      ? 'bg-muted/30 text-muted-foreground/70 hover:bg-muted/50 ring-1 ring-border/30'
                      : 'ds-bg-brand-cyan-10 ds-text-brand-cyan-70 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.25)] hover:ring-2 hover:ring-[rgb(var(--ds-brand-cyan-rgb)/0.3)] ring-1 ds-ring-brand-cyan-15'
                  }`}
                >
                  <span>{formatPercent(displayBorrowIncentive)}</span>
                  <IncentiveIcon width={isMobile ? 8 : 10} height={isMobile ? 8 : 10} />
                </button>
              </div>
            )}
          </div>
        </TableCell>
        {/* Utilization */}
        <TableCell className="px-[var(--ds-space-3)] ds-row-pad whitespace-nowrap text-center hidden md:table-cell tabular-nums font-bold text-amber-600 ds-text-13">
          {formatPercent(reserve.utilizationPct ?? null)}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow
          className="border-b border-border/40 bg-muted/10"
          onClick={(event) => event.stopPropagation()}
        >
          <TableCell colSpan={8} className="px-[var(--ds-space-3)] py-[var(--ds-space-3)]">
            {simulation && (
              <SimulationSubRow
                reserve={reserve}
                simulation={simulation}
                isApy={isApy}
                supplyInput={supplyInput}
                borrowInput={borrowInput}
                inputMode={inputMode}
              />
            )}
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
});

DesktopReserveRow.displayName = 'DesktopReserveRow';

export default DesktopReserveRow;
