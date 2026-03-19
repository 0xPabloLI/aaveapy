import { memo, useEffect, useState } from 'react';
import { ExternalLink, ChevronDown, X } from 'lucide-react';
import { ReserveWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { formatPercent, formatSpread } from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import SimulationSubRow from './SimulationSubRow';
import CapProgressRing from './CapProgressRing';
import BorrowCapProgressRing from './BorrowCapProgressRing';
import { formatReserveSizeUsd } from '@/lib/formatters';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';

/** Same content as CapProgressRing tooltip; used in mobile bottom sheet. */
function SupplyCapSheetContent({ currentSize, cap }: { currentSize: number; cap: number }) {
  const percentage = Math.min((currentSize / cap) * 100, 100);
  const colorClass =
    percentage >= 95 ? 'text-amber-600' : percentage >= 80 ? 'text-amber-500' : 'ds-text-emerald-600';
  return (
    <div className="space-y-1 ds-text-12">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Total supplied</span>
        <span className="font-medium tabular-nums ds-text-emerald-600">{formatReserveSizeUsd(currentSize)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Supply cap</span>
        <span className="font-medium tabular-nums ds-text-emerald-600">{formatReserveSizeUsd(cap)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Available to supply</span>
        <span className="font-medium tabular-nums ds-text-emerald-600">{formatReserveSizeUsd(Math.max(0, cap - currentSize))}</span>
      </div>
      <div className="flex justify-between gap-3 pt-1 border-t border-border/50">
        <span className="text-muted-foreground">% of cap</span>
        <span className={`font-bold tabular-nums ${colorClass}`}>{percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
}

/** Same content as BorrowCapProgressRing tooltip; used in mobile bottom sheet. */
function BorrowCapSheetContent({
  borrowed,
  cap,
  poolLiquidity,
}: {
  borrowed: number;
  cap: number;
  poolLiquidity: number;
}) {
  const percentage = Math.min((borrowed / cap) * 100, 100);
  const availableToBorrow = Math.min(Math.max(0, cap - borrowed), poolLiquidity);
  const colorClass =
    percentage >= 95 ? 'text-amber-600' : percentage >= 80 ? 'text-amber-500' : 'ds-text-brand-cyan';
  return (
    <div className="space-y-1 ds-text-12">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Total borrowed</span>
        <span className="font-medium tabular-nums ds-text-brand-cyan">{formatReserveSizeUsd(borrowed)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Borrow cap</span>
        <span className="font-medium tabular-nums ds-text-brand-cyan">{formatReserveSizeUsd(cap)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Available to borrow</span>
        <span className="font-medium tabular-nums ds-text-brand-cyan">{formatReserveSizeUsd(availableToBorrow)}</span>
      </div>
      <div className="flex justify-between gap-3 pt-1 border-t border-border/50">
        <span className="text-muted-foreground">% of cap</span>
        <span className={`font-bold tabular-nums ${colorClass}`}>{percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
}

interface MobileReserveCardProps {
  reserve: ReserveWithSpread;
  isApy: boolean;
  onIncentiveClick: (
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null
  ) => void;
  isSimulationExpanded: boolean;
  onToggleSimulation: () => void;
  simulation: RateSimulationResult;
  supplyInput: string;
  borrowInput: string;
  hasSharedScenario: boolean;
  inputMode?: 'usd' | 'token';
  onCorrectSupplyInput?: (correctedValue: string) => void;
  onCorrectBorrowInput?: (correctedValue: string) => void;
  /** When 'upperOnly' only the card upper part is shown; when 'simulationOnly' only the simulation block. */
  variant?: 'full' | 'upperOnly' | 'simulationOnly';
  /** When true, card gets rounded-b-none + border-b-0 to connect to panel below. */
  connectedBelow?: boolean;
}

const MobileReserveCard = memo(({
  reserve,
  isApy,
  onIncentiveClick,
  isSimulationExpanded,
  onToggleSimulation,
  simulation,
  supplyInput,
  borrowInput,
  hasSharedScenario,
  inputMode = 'usd',
  onCorrectSupplyInput,
  onCorrectBorrowInput,
  variant = 'full',
  connectedBelow = false,
}: MobileReserveCardProps) => {
  const [capSheet, setCapSheet] = useState<'supply' | 'borrow' | null>(null);
  const [hasSimulationMounted, setHasSimulationMounted] = useState(isSimulationExpanded);

  useEffect(() => {
    if (isSimulationExpanded) {
      setHasSimulationMounted(true);
    }
  }, [isSimulationExpanded]);

  const getMarketDisplayName = () => {
    if (reserve.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[reserve.marketName]) {
      return ETHEREUM_MARKET_NAMES[reserve.marketName];
    }
    return reserve.chainName;
  };

  const displaySupplyTotal = hasSharedScenario
    ? simulation.supply.afterTotal ?? simulation.supply.currentTotal
    : simulation.supply.currentTotal;
  const displayBorrowTotal = hasSharedScenario
    ? simulation.borrow.afterTotal ?? simulation.borrow.currentTotal
    : simulation.borrow.currentTotal;
  const displaySupplyNative = hasSharedScenario
    ? simulation.supply.afterNative ?? simulation.supply.currentNative
    : simulation.supply.currentNative;
  const displayBorrowNative = hasSharedScenario
    ? simulation.borrow.afterNative ?? simulation.borrow.currentNative
    : simulation.borrow.currentNative;
  const displaySupplyIncentive = hasSharedScenario
    ? simulation.supply.afterIncentive ?? simulation.supply.currentIncentive
    : simulation.supply.currentIncentive;
  const displayBorrowIncentive = hasSharedScenario
    ? simulation.borrow.afterIncentive ?? simulation.borrow.currentIncentive
    : simulation.borrow.currentIncentive;
  const displaySpread = hasSharedScenario
    ? simulation.spread.after ?? simulation.spread.current
    : simulation.spread.current;

  const visibleSupplyIncentive =
    displaySupplyIncentive === null || Number.isNaN(displaySupplyIncentive) || displaySupplyIncentive < 0.01
      ? null
      : displaySupplyIncentive;
  const visibleBorrowIncentive =
    displayBorrowIncentive === null || Number.isNaN(displayBorrowIncentive) || displayBorrowIncentive < 0.01
      ? null
      : displayBorrowIncentive;

  const chainIconSrc = getChainIconSrc(reserve.chainName);
  const { iconSymbol, logoURI } = fetchIconSymbolAndName({
    underlyingAsset: reserve.tokenAddress,
    symbol: reserve.tokenSymbol,
    name: reserve.tokenName,
  });

  const totalBorrowedUsd =
    reserve.reserveSizeUsd != null &&
    reserve.utilizationPct != null &&
    Number.isFinite(reserve.reserveSizeUsd) &&
    Number.isFinite(reserve.utilizationPct)
      ? reserve.reserveSizeUsd * (reserve.utilizationPct / 100)
      : null;
  const poolLiquidity =
    reserve.reserveSizeUsd != null && totalBorrowedUsd != null
      ? reserve.reserveSizeUsd - totalBorrowedUsd
      : null;




  const supplyValueClass = displaySupplyTotal === null || reserve.supplyDisabled 
    ? 'text-secondary' 
    : 'ds-text-emerald-500';
  const borrowValueClass = displayBorrowTotal === null || reserve.borrowDisabled 
    ? 'text-secondary' 
    : 'ds-text-brand-cyan';

  if (variant === 'simulationOnly') {
    return (
      <div className="mt-[var(--ds-space-2)]">
        <SimulationSubRow
          reserve={reserve}
          simulation={simulation}
          isApy={isApy}
          supplyInput={supplyInput}
          borrowInput={borrowInput}
          inputMode={inputMode}
          compact
          onCorrectSupplyInput={onCorrectSupplyInput}
          onCorrectBorrowInput={onCorrectBorrowInput}
        />
      </div>
    );
  }

  const showUpperOnly = variant === 'upperOnly';
  const shrinkUpperWhenExpanded = variant === 'full' && isSimulationExpanded;

  return (
    <div data-reserve-id={`${reserve.marketName}-${reserve.tokenAddress}`} className={isSimulationExpanded && !showUpperOnly ? 'shadow-sm rounded-xl' : ''}>
      {/* Card upper part */}
      <div
        className={`bg-card border border-border/60 ds-card-pad-sm transition-all duration-300 ${
          connectedBelow || (isSimulationExpanded && !showUpperOnly) ? 'rounded-t-xl rounded-b-none border-b-0' : 'rounded-xl shadow-sm'
        }`}
      >
        <div className={shrinkUpperWhenExpanded ? 'w-1/2 min-w-0' : ''}>
        <div
          className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-3)] min-h-[44px]"
        >
          <a
            href={buildAaveReserveUrl({ marketName: reserve.marketName, tokenAddress: reserve.tokenAddress }) || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-[var(--ds-space-2)] min-w-0 flex-1 active:opacity-70 transition-opacity"
            aria-label={`Open ${reserve.tokenSymbol} on Aave`}
          >
            <TokenIcon
              symbol={iconSymbol}
              size={32}
              loading="eager"
              className="shrink-0"
              logoURI={logoURI}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-[var(--ds-space-1)]">
                <p className="font-bold text-foreground ds-text-14 truncate">{reserve.tokenSymbol}</p>
                <ExternalLink className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              </div>
              <div className="flex items-center gap-[var(--ds-space-1)] ds-text-11 text-muted-foreground">
                {chainIconSrc && (
                  <img src={chainIconSrc} alt={reserve.chainName} className="w-3.5 h-3.5" />
                )}
                <span className="truncate">{getMarketDisplayName()}</span>
              </div>
            </div>
          </a>
        </div>

        {/* Size section */}
        <div
          className="flex items-center justify-center gap-[var(--ds-space-4)] mb-[var(--ds-space-3)] py-[var(--ds-space-2)] px-[var(--ds-space-2)] bg-muted/30 rounded-lg"
          aria-label="Pool size: total supplied and total borrowed"
        >
          <div className="flex flex-col items-center gap-[var(--ds-space-0-5)]">
            <span className="ds-text-9 text-muted-foreground uppercase font-medium tracking-wide">Supply</span>
            {reserve.supplyCapUsd != null && Number.isFinite(reserve.supplyCapUsd) && reserve.supplyCapUsd > 0 ? (
              <button
                type="button"
                className="flex items-center gap-[var(--ds-space-1-5)] ds-text-emerald-600 ds-text-11 rounded-md py-1 px-0.5 -mx-0.5 transition-colors hover:bg-muted/70 active:opacity-80 cursor-pointer"
                aria-label="Show supply cap details"
                onClick={() => setCapSheet('supply')}
              >
                <span className="font-medium tabular-nums">{formatReserveSizeUsd(reserve.reserveSizeUsd)}</span>
                <CapProgressRing size={reserve.reserveSizeUsd} cap={reserve.supplyCapUsd} ringSize={10} strokeWidth={1.2} disableTooltip />
              </button>
            ) : (
              <div className="flex items-center gap-[var(--ds-space-1-5)] ds-text-emerald-600 ds-text-11">
                <span className="font-medium tabular-nums">{formatReserveSizeUsd(reserve.reserveSizeUsd)}</span>
              </div>
            )}
          </div>
          <span className="text-muted-foreground/40 ds-text-10 self-center pt-[var(--ds-space-3)]" aria-hidden="true">/</span>
          <div className="flex flex-col items-center gap-[var(--ds-space-0-5)]">
            <span className="ds-text-9 text-muted-foreground uppercase font-medium tracking-wide">Borrow</span>
            {reserve.borrowCapUsd != null && Number.isFinite(reserve.borrowCapUsd) && reserve.borrowCapUsd > 0 ? (
              <button
                type="button"
                className="flex items-center gap-[var(--ds-space-1-5)] ds-text-brand-cyan ds-text-11 rounded-md py-1 px-0.5 -mx-0.5 transition-colors hover:bg-muted/70 active:opacity-80 cursor-pointer"
                aria-label="Show borrow cap details"
                onClick={() => setCapSheet('borrow')}
              >
                <span className="font-medium tabular-nums">{formatReserveSizeUsd(totalBorrowedUsd)}</span>
                <BorrowCapProgressRing
                  borrowed={totalBorrowedUsd}
                  cap={reserve.borrowCapUsd}
                  poolLiquidity={poolLiquidity}
                  ringSize={10}
                  strokeWidth={1.2}
                  disableTooltip
                />
              </button>
            ) : (
              <div className="flex items-center gap-[var(--ds-space-1-5)] ds-text-brand-cyan ds-text-11">
                <span className="font-medium tabular-nums">{formatReserveSizeUsd(totalBorrowedUsd)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile bottom sheet */}
        {capSheet !== null && (
          <>
            <div
              className="fixed inset-0 z-30 bg-background/20"
              onClick={() => setCapSheet(null)}
              aria-hidden="true"
            />
            <div
              className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border border-border/60 bg-card ds-tooltip-shadow-up max-h-[80vh] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby={capSheet === 'supply' ? 'cap-sheet-supply-title' : 'cap-sheet-borrow-title'}
            >
              <div className="sticky top-0 bg-card border-b border-border px-[var(--ds-space-4)] py-[var(--ds-space-3)] flex items-center justify-between z-10">
                <h3 id={capSheet === 'supply' ? 'cap-sheet-supply-title' : 'cap-sheet-borrow-title'} className="ds-tooltip-title text-foreground">
                  {capSheet === 'supply' ? 'Supply' : 'Borrow'} cap details
                </h3>
                <button
                  type="button"
                  onClick={() => setCapSheet(null)}
                  className="p-[var(--ds-space-1-5)] rounded-full hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div className="px-[var(--ds-space-4)] pt-[var(--ds-space-3)] pb-[var(--ds-space-3)]">
                {capSheet === 'supply' && (
                  <SupplyCapSheetContent
                    currentSize={reserve.reserveSizeUsd ?? 0}
                    cap={reserve.supplyCapUsd!}
                  />
                )}
                {capSheet === 'borrow' && (
                  <BorrowCapSheetContent
                    borrowed={totalBorrowedUsd ?? 0}
                    cap={reserve.borrowCapUsd!}
                    poolLiquidity={poolLiquidity ?? 0}
                  />
                )}
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-3 gap-[var(--ds-space-2)]">
          <div className="flex flex-col items-start justify-start gap-[var(--ds-space-0-5)] min-h-[2.5rem]">
            <p className="ds-text-9 text-muted-foreground uppercase font-medium">Supply</p>
            {reserve.supplyDisabled ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className={`ds-text-14 font-bold ${supplyValueClass} cursor-auto`}>
                    {formatPercent(displaySupplyTotal)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>Supply unavailable</TooltipContent>
              </Tooltip>
            ) : (
              <p className={`ds-text-14 font-bold ${supplyValueClass}`}>
                {formatPercent(displaySupplyTotal)}
              </p>
            )}
            {visibleSupplyIncentive !== null && (
              <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-9 flex-nowrap">
                <span className={reserve.supplyDisabled ? 'text-secondary' : 'ds-text-emerald-500-70'}>
                  {formatPercent(displaySupplyNative)}
                </span>
                <span className="text-muted-foreground/70">+</span>
                <div className="relative -m-1.5 p-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onIncentiveClick(e, reserve, 'supply', visibleSupplyIncentive);
                      }}
                      className={`inline-flex items-center rounded-full px-[var(--ds-space-1)] shrink-0 ring-1 active:scale-95 transition-all hover:ring-2 ${
                        reserve.supplyDisabled
                          ? 'text-secondary bg-secondary/10 ring-secondary/20 hover:bg-secondary/20 hover:ring-secondary/30'
                          : 'ds-text-emerald-600 ds-bg-emerald-500-10 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.25)] ds-ring-emerald-500-15 hover:ring-[rgb(var(--ds-emerald-500-rgb)/0.35)]'
                      }`}
                    >
                      <span>{formatPercent(visibleSupplyIncentive)}</span>
                    </button>
                  </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-start gap-[var(--ds-space-0-5)] min-h-[2.5rem] text-center">
            <p className="ds-text-9 text-muted-foreground/70 uppercase font-medium">Spread</p>
            <p className={`ds-text-11 font-medium ${displaySpread !== null ? 'text-purple-500' : 'text-muted-foreground/70'}`}>
              {formatSpread(displaySpread)}
            </p>
          </div>

          <div className="flex flex-col items-end justify-start gap-[var(--ds-space-0-5)] min-h-[2.5rem] text-right">
            <p className="ds-text-9 text-muted-foreground uppercase font-medium">Borrow</p>
            {reserve.borrowDisabled ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className={`ds-text-14 font-bold ${borrowValueClass} cursor-auto`}>
                    {formatPercent(displayBorrowTotal)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>Borrow disabled</TooltipContent>
              </Tooltip>
            ) : (
              <p className={`ds-text-14 font-bold ${borrowValueClass}`}>
                {formatPercent(displayBorrowTotal)}
              </p>
            )}
            {visibleBorrowIncentive !== null && (
              <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-9 flex-nowrap justify-end">
                <span className={reserve.borrowDisabled ? 'text-secondary' : 'ds-text-brand-cyan-70'}>
                  {formatPercent(displayBorrowNative)}
                </span>
                <span className="text-muted-foreground/70">-</span>
                <div className="relative -m-1.5 p-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onIncentiveClick(e, reserve, 'borrow', visibleBorrowIncentive);
                      }}
                      className={`inline-flex items-center rounded-full px-[var(--ds-space-1)] shrink-0 ring-1 active:scale-95 transition-all hover:ring-2 ${
                        reserve.borrowDisabled
                          ? 'text-secondary bg-secondary/10 ring-secondary/20 hover:bg-secondary/20 hover:ring-secondary/30'
                          : 'ds-text-brand-cyan ds-bg-brand-cyan-10 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.25)] ds-ring-brand-cyan-15 hover:ring-[rgb(var(--ds-brand-cyan-rgb)/0.35)]'
                      }`}
                    >
                      <span>{formatPercent(visibleBorrowIncentive)}</span>
                    </button>
                  </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-[var(--ds-space-3)] pt-[var(--ds-space-2)]">
          <button
            type="button"
            onClick={onToggleSimulation}
            className={`relative inline-flex w-full items-center justify-center rounded-lg bg-background px-[var(--ds-space-2)] py-[var(--ds-space-1-5)] ds-text-12 text-muted-foreground transition-all duration-300 hover:bg-muted/40 ${
              isSimulationExpanded ? 'border-2 border-foreground/40' : 'border border-border/70'
            }`}
          >
            <span>Simulation</span>
            <span className="absolute right-[var(--ds-space-2)]">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isSimulationExpanded ? 'rotate-180' : ''}`} />
            </span>
          </button>
        </div>
        </div>
      </div>

      {/* Simulation panel — visually connected below the card */}
      {!showUpperOnly && (
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: isSimulationExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            {hasSimulationMounted && (
              <div className="-mt-px bg-card border border-border/60 border-t-0 rounded-b-xl rounded-t-none ds-card-pad-sm pt-0">
                <SimulationSubRow
                  reserve={reserve}
                  simulation={simulation}
                  isApy={isApy}
                  supplyInput={supplyInput}
                  borrowInput={borrowInput}
                  inputMode={inputMode}
                  compact
                  embeddedFromTop
                  onCorrectSupplyInput={onCorrectSupplyInput}
                  onCorrectBorrowInput={onCorrectBorrowInput}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
MobileReserveCard.displayName = 'MobileReserveCard';

export default MobileReserveCard;
