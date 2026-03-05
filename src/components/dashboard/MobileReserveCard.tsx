import { ExternalLink } from 'lucide-react';
import { ReserveWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { 
  formatPercent, 
  formatSpread, 
  calculateTotalSupplyApr,
  calculateTotalSupplyApy,
  calculateTotalBorrowApr,
  calculateTotalBorrowApy,
  calculateSpreadApy,
  calculateSpreadApr,
  calculateTotalIncentiveApr,
  calculateTotalIncentiveApy,
  apyToApr
} from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { IncentiveIcon } from '@/components/IncentiveIcon';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { fetchIconSymbolAndName } from '@/ui-config/reservePatches';

interface MobileReserveCardProps {
  reserve: ReserveWithSpread;
  isApy: boolean;
  includeWhitelistOnlyMerkl: boolean;
  onIncentiveClick: (
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null
  ) => void;
  tydroPointToUsdRate: number;
}

const MobileReserveCard = ({
  reserve,
  isApy,
  includeWhitelistOnlyMerkl,
  onIncentiveClick,
  tydroPointToUsdRate,
}: MobileReserveCardProps) => {
  // Helper: Get incentive values for a reserve (supply or borrow)
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

  const getMarketDisplayName = () => {
    if (reserve.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[reserve.marketName]) {
      return ETHEREUM_MARKET_NAMES[reserve.marketName];
    }
    return reserve.chainName;
  };

  // Cache incentive values to avoid redundant calculations
  const supplyIncentiveValues = getIncentiveValues('supply');
  const borrowIncentiveValues = getIncentiveValues('borrow');
  
  const totalSupplyApy = calculateTotalSupplyApy(reserve.supplyApy, supplyIncentiveValues.apy);
  const totalSupplyApr = calculateTotalSupplyApr(reserve.supplyApy, supplyIncentiveValues.apr);
  const totalBorrowApy = calculateTotalBorrowApy(reserve.borrowApy, borrowIncentiveValues.apy);
  const totalBorrowApr = calculateTotalBorrowApr(reserve.borrowApy, borrowIncentiveValues.apr);
  
  const displaySupplyTotal = isApy ? totalSupplyApy : totalSupplyApr;
  const displayBorrowTotal = isApy ? totalBorrowApy : totalBorrowApr;
  
  // Get display incentive values using cached results
  const displaySupplyIncentive = (() => {
    const incentive = isApy ? supplyIncentiveValues.apy : supplyIncentiveValues.apr;
    return incentive === 0 || isNaN(incentive) || incentive < 0.01 ? null : incentive;
  })();
  const displayBorrowIncentive = (() => {
    const incentive = isApy ? borrowIncentiveValues.apy : borrowIncentiveValues.apr;
    return incentive === 0 || isNaN(incentive) || incentive < 0.01 ? null : incentive;
  })();

  const spread = isApy
    ? calculateSpreadApy(totalSupplyApy, totalBorrowApy)
    : calculateSpreadApr(totalSupplyApr, totalBorrowApr);

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
      {/* Header: Token + Market + Link button - Compact layout with min touch target */}
      <div 
        className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-3)] cursor-pointer active:opacity-70 transition-opacity min-h-[44px]"
        onClick={handleCardClick}
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
        {/* Link button - neutral style with expanded touch target */}
        <div className="shrink-0 w-10 h-10 -m-1.5 rounded-full flex items-center justify-center">
          <div className="w-7 h-7 rounded-full bg-muted/60 border border-border flex items-center justify-center text-muted-foreground transition-all hover:bg-muted hover:border-border/80 hover:text-foreground">
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* APY Values - 3 column layout: Supply | Spread | Borrow */}
      <div className="grid grid-cols-3 gap-[var(--ds-space-2)]">
        {/* Supply */}
        <div className="flex flex-col items-start justify-start gap-[var(--ds-space-0-5)] min-h-[2.5rem]">
          <p className="ds-text-9 text-muted-foreground uppercase font-medium">Supply</p>
          <p className={`ds-text-14 font-bold ${supplyValueClass}`}>
            {formatPercent(displaySupplyTotal)}
          </p>
          {displaySupplyIncentive !== null && (
            <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-9 flex-nowrap">
              <span className="ds-text-emerald-500-70">{formatPercent(isApy ? (reserve.supplyApy ?? null) : (reserve.supplyApy !== null && reserve.supplyApy !== undefined ? apyToApr(reserve.supplyApy) : null))}</span>
              <span className="text-muted-foreground/70">+</span>
              {/* Expanded touch target wrapper without visual change */}
              <div className="relative -m-1.5 p-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onIncentiveClick(e, reserve, 'supply', displaySupplyIncentive);
                  }}
                  className="inline-flex items-center ds-text-emerald-600 ds-bg-emerald-500-10 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.25)] rounded-full px-[var(--ds-space-1)] shrink-0 ring-1 ds-ring-emerald-500-15 active:scale-95 transition-all hover:ring-2 hover:ring-[rgb(var(--ds-emerald-500-rgb)/0.35)]"
                >
                  <span>{formatPercent(displaySupplyIncentive)}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Spread - middle, less prominent */}
        <div className="flex flex-col items-center justify-start gap-[var(--ds-space-0-5)] min-h-[2.5rem] text-center">
          <p className="ds-text-9 text-muted-foreground/70 uppercase font-medium">Spread</p>
          <p className={`ds-text-11 font-medium ${
            spread !== null ? 'text-purple-500' : 'text-muted-foreground/70'
          }`}>
            {formatSpread(spread)}
          </p>
        </div>

        {/* Borrow */}
        <div className="flex flex-col items-end justify-start gap-[var(--ds-space-0-5)] min-h-[2.5rem] text-right">
          <p className="ds-text-9 text-muted-foreground uppercase font-medium">Borrow</p>
          <p className={`ds-text-14 font-bold ${borrowValueClass}`}>
            {formatPercent(displayBorrowTotal)}
          </p>
          {displayBorrowIncentive !== null && (
            <div className="flex items-center gap-[var(--ds-space-0-5)] ds-text-9 flex-nowrap justify-end">
              <span className="ds-text-brand-cyan-70">{formatPercent(isApy ? (reserve.borrowApy ?? null) : (reserve.borrowApy !== null && reserve.borrowApy !== undefined ? apyToApr(reserve.borrowApy) : null))}</span>
              <span className="text-muted-foreground/70">-</span>
              {/* Expanded touch target wrapper without visual change */}
              <div className="relative -m-1.5 p-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onIncentiveClick(e, reserve, 'borrow', displayBorrowIncentive);
                  }}
                  className="inline-flex items-center ds-text-brand-cyan ds-bg-brand-cyan-10 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.25)] rounded-full px-[var(--ds-space-1)] shrink-0 ring-1 ds-ring-brand-cyan-15 active:scale-95 transition-all hover:ring-2 hover:ring-[rgb(var(--ds-brand-cyan-rgb)/0.35)]"
                >
                  <span>{formatPercent(displayBorrowIncentive)}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileReserveCard;
