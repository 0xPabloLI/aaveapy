import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { ReserveWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { formatPercent, formatSpread } from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';
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
}

const MobileReserveCard = ({
  reserve,
  isApy,
  onIncentiveClick,
  isSimulationExpanded,
  onToggleSimulation,
  simulation,
  supplyInput,
  borrowInput,
  hasSharedScenario,
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

  const handleCardClick = () => {
    const url = buildAaveReserveUrl({
      marketName: reserve.marketName,
      tokenAddress: reserve.tokenAddress,
    });
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const supplyValueClass = displaySupplyTotal === null ? 'text-muted-foreground/70' : 'ds-text-emerald-500';
  const borrowValueClass = displayBorrowTotal === null ? 'text-muted-foreground/70' : 'ds-text-brand-cyan';

  return (
    <div
      data-reserve-id={`${reserve.marketName}-${reserve.tokenAddress}`}
      className="bg-card rounded-xl border border-border/60 ds-card-pad-sm shadow-sm transition-colors"
    >
      <div
        className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-3)] cursor-pointer active:opacity-70 transition-opacity min-h-[44px]"
        onClick={onToggleSimulation}
      >
        <TokenIcon
          symbol={iconSymbol}
          size={32}
          loading="eager"
          className="shrink-0"
          logoURI={logoURI}
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground ds-text-14 truncate">{reserve.tokenSymbol}</p>
          <div className="flex items-center gap-[var(--ds-space-1)] ds-text-11 text-muted-foreground">
            {chainIconSrc && (
              <img src={chainIconSrc} alt={reserve.chainName} className="w-3.5 h-3.5" />
            )}
            <span className="truncate">{getMarketDisplayName()}</span>
          </div>
        </div>
        <div className="shrink-0 w-10 h-10 -m-1.5 rounded-full flex items-center justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            className="w-7 h-7 rounded-full bg-muted/60 border border-border flex items-center justify-center text-muted-foreground transition-all hover:bg-muted hover:border-border/80 hover:text-foreground"
            aria-label={`Open ${reserve.tokenSymbol} on Aave`}
            title="Open on Aave"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-[var(--ds-space-2)]">
        <div className="flex flex-col items-start justify-start gap-[var(--ds-space-0-5)] min-h-[2.5rem]">
          <p className="ds-text-9 text-muted-foreground uppercase font-medium">Supply</p>
          <p className={`ds-text-14 font-bold ${supplyValueClass}`}>
            {formatPercent(displaySupplyTotal)}
          </p>
          {visibleSupplyIncentive !== null && (
            <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-9 flex-nowrap">
              <span className="ds-text-emerald-500-70">{formatPercent(displaySupplyNative)}</span>
              <span className="text-muted-foreground/70">+</span>
              <div className="relative -m-1.5 p-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onIncentiveClick(e, reserve, 'supply', visibleSupplyIncentive);
                    }}
                    className="inline-flex items-center ds-text-emerald-600 ds-bg-emerald-500-10 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.25)] rounded-full px-[var(--ds-space-1)] shrink-0 ring-1 ds-ring-emerald-500-15 active:scale-95 transition-all hover:ring-2 hover:ring-[rgb(var(--ds-emerald-500-rgb)/0.35)]"
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
          <p className={`ds-text-14 font-bold ${borrowValueClass}`}>
            {formatPercent(displayBorrowTotal)}
          </p>
          {visibleBorrowIncentive !== null && (
            <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-9 flex-nowrap justify-end">
              <span className="ds-text-brand-cyan-70">{formatPercent(displayBorrowNative)}</span>
              <span className="text-muted-foreground/70">-</span>
              {hasSharedScenario ? (
                <span className="inline-flex items-center ds-text-brand-cyan ds-bg-brand-cyan-10 rounded-full px-[var(--ds-space-1)] shrink-0 ring-1 ds-ring-brand-cyan-15">
                  <span>{formatPercent(visibleBorrowIncentive)}</span>
                </span>
              ) : (
                <div className="relative -m-1.5 p-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onIncentiveClick(e, reserve, 'borrow', visibleBorrowIncentive);
                    }}
                    className="inline-flex items-center ds-text-brand-cyan ds-bg-brand-cyan-10 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.25)] rounded-full px-[var(--ds-space-1)] shrink-0 ring-1 ds-ring-brand-cyan-15 active:scale-95 transition-all hover:ring-2 hover:ring-[rgb(var(--ds-brand-cyan-rgb)/0.35)]"
                  >
                    <span>{formatPercent(visibleBorrowIncentive)}</span>
                  </button>
                </div>
              )}
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
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileReserveCard;
