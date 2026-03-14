import { memo } from 'react';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { ReserveWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { formatPercent, formatSpread } from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import SimulationSubRow from './SimulationSubRow';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';

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
}: MobileReserveCardProps) => {
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




  const supplyValueClass = displaySupplyTotal === null || reserve.supplyDisabled 
    ? 'text-secondary' 
    : 'ds-text-emerald-500';
  const borrowValueClass = displayBorrowTotal === null || reserve.borrowDisabled 
    ? 'text-secondary' 
    : 'ds-text-brand-cyan';

  return (
    <div
      data-reserve-id={`${reserve.marketName}-${reserve.tokenAddress}`}
      className="bg-card rounded-xl border border-border/60 ds-card-pad-sm shadow-sm transition-colors"
    >
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSimulation();
          }}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground/60"
          aria-label="Toggle scenario breakdown"
        >
          {isSimulationExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

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

      <div className="mt-[var(--ds-space-3)] border-t border-border/60 pt-[var(--ds-space-2)]">
        <button
          type="button"
          onClick={onToggleSimulation}
          className="inline-flex w-full items-center justify-between rounded-lg border border-border/70 bg-background px-[var(--ds-space-2)] py-[var(--ds-space-1-5)] ds-text-12 text-muted-foreground transition-colors hover:bg-muted/40"
        >
          <span>Scenario breakdown</span>
          {isSimulationExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {isSimulationExpanded && (
          <div className="mt-[var(--ds-space-2)]">
            <SimulationSubRow
              reserve={reserve}
              simulation={simulation}
              isApy={isApy}
              supplyInput={supplyInput}
              borrowInput={borrowInput}
              inputMode={inputMode}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
});
MobileReserveCard.displayName = 'MobileReserveCard';

export default MobileReserveCard;
