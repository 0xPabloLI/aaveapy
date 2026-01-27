import { ExternalLink } from 'lucide-react';
import { PoolWithSpread, ETHEREUM_MARKET_NAMES } from '@/types/aave';
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

interface MobilePoolCardProps {
  pool: PoolWithSpread;
  isApy: boolean;
  onIncentiveClick: (
    e: React.MouseEvent,
    pool: PoolWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null
  ) => void;
}

const MobilePoolCard = ({ pool, isApy, onIncentiveClick }: MobilePoolCardProps) => {
  // Helper: Get incentive values for a pool (supply or borrow)
  const getIncentiveValues = (type: 'supply' | 'borrow') => {
    const protocolIncentives = type === 'supply' ? pool.supplyIncentives : pool.borrowIncentives;
    const meritIncentives = type === 'supply' ? pool.meritSupplys : pool.meritBorrows;
    const merklOpportunities = type === 'supply' ? pool.merklSupplys : pool.merklBorrows;
    const brevisIncentives = type === 'supply' ? pool.brevisSupplys : pool.brevisBorrows;
    const brevisLegacyApr = type === 'supply' ? pool.brevisSupplyApr : pool.brevisBorrowApr;
    const brevisSource = brevisIncentives && brevisIncentives.length > 0 ? brevisIncentives : brevisLegacyApr ?? null;
    return {
      apr: calculateTotalIncentiveApr(meritIncentives, merklOpportunities, brevisSource, protocolIncentives),
      apy: calculateTotalIncentiveApy(meritIncentives, merklOpportunities, brevisSource, protocolIncentives),
    };
  };

  const getMarketDisplayName = () => {
    if (pool.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[pool.marketName]) {
      return ETHEREUM_MARKET_NAMES[pool.marketName];
    }
    return pool.chainName;
  };

  // Cache incentive values to avoid redundant calculations
  const supplyIncentiveValues = getIncentiveValues('supply');
  const borrowIncentiveValues = getIncentiveValues('borrow');
  
  const totalSupplyApy = calculateTotalSupplyApy(pool.supplyApy, supplyIncentiveValues.apy);
  const totalSupplyApr = calculateTotalSupplyApr(pool.supplyApy, supplyIncentiveValues.apr);
  const totalBorrowApy = calculateTotalBorrowApy(pool.borrowApy, borrowIncentiveValues.apy);
  const totalBorrowApr = calculateTotalBorrowApr(pool.borrowApy, borrowIncentiveValues.apr);
  
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

  const chainIconSrc = getChainIconSrc(pool.chainName);
  const { iconSymbol, logoURI } = fetchIconSymbolAndName({
    underlyingAsset: pool.tokenAddress,
    symbol: pool.tokenSymbol,
    name: pool.tokenName,
  });

  const handleCardClick = () => {
    const url = buildAaveReserveUrl({
      marketName: pool.marketName,
      tokenAddress: pool.tokenAddress,
    });
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const supplyValueClass = displaySupplyTotal === null ? 'text-muted-foreground/70' : 'ds-text-emerald-500';
  const borrowValueClass = displayBorrowTotal === null ? 'text-muted-foreground/70' : 'ds-text-brand-cyan';

  return (
    <div className="bg-card rounded-xl border border-border/60 ds-card-pad-sm shadow-sm transition-colors">
      {/* Header: Token + Market + Link button - Compact layout */}
      <div 
        className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-2)] cursor-pointer active:opacity-70 transition-opacity"
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
          <p className="font-bold text-foreground ds-text-14 truncate">{pool.tokenSymbol}</p>
          <div className="flex items-center gap-[var(--ds-space-1)] ds-text-11 text-muted-foreground">
            {chainIconSrc && (
              <img src={chainIconSrc} alt={pool.chainName} className="w-3.5 h-3.5" />
            )}
            <span className="truncate">{getMarketDisplayName()}</span>
          </div>
        </div>
        {/* Link button - matches TopOpportunities MiniPoolCard style */}
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
          <ExternalLink className="w-3.5 h-3.5" />
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
              <span className="ds-text-emerald-500-70">{formatPercent(isApy ? (pool.supplyApy ?? null) : (pool.supplyApy !== null && pool.supplyApy !== undefined ? apyToApr(pool.supplyApy) : null))}</span>
              <span className="text-muted-foreground/70">+</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIncentiveClick(e, pool, 'supply', displaySupplyIncentive);
                }}
                className="inline-flex items-center gap-[var(--ds-space-0-5)] ds-text-emerald-600 ds-bg-emerald-500-10 hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.2)] rounded-full px-[var(--ds-space-1)] shrink-0 ring-1 ds-ring-emerald-500-15 active:scale-95 transition-colors"
              >
                <span>{formatPercent(displaySupplyIncentive)}</span>
                <IncentiveIcon width={8} height={8} />
              </button>
            </div>
          )}
        </div>

        {/* Spread - middle, less prominent */}
        <div className="flex flex-col items-center justify-start gap-[var(--ds-space-0-5)] min-h-[2.5rem] text-center">
          <p className="ds-text-9 text-muted-foreground/70 uppercase font-medium">Spread</p>
          <p className={`ds-text-11 font-medium ${
            spread !== null ? 'ds-text-purple-500' : 'text-muted-foreground/70'
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
              <span className="ds-text-brand-cyan-70">{formatPercent(isApy ? (pool.borrowApy ?? null) : (pool.borrowApy !== null && pool.borrowApy !== undefined ? apyToApr(pool.borrowApy) : null))}</span>
              <span className="text-muted-foreground/70">-</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIncentiveClick(e, pool, 'borrow', displayBorrowIncentive);
                }}
                className="inline-flex items-center gap-[var(--ds-space-0-5)] ds-text-brand-cyan ds-bg-brand-cyan-10 hover:bg-[rgb(var(--ds-brand-cyan-rgb)/0.2)] rounded-full px-[var(--ds-space-1)] shrink-0 ring-1 ds-ring-brand-cyan-15 active:scale-95 transition-colors"
              >
                <span>{formatPercent(displayBorrowIncentive)}</span>
                <IncentiveIcon width={8} height={8} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobilePoolCard;
