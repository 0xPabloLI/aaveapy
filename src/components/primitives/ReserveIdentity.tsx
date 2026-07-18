import { memo } from 'react';
import { cn } from '@/lib/utils';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getMarketChipLabel, isV4Market, getHubChipClass } from '@/lib/marketLabels';

export interface ReserveIdentityProps {
  tokenSymbol: string;
  chainId: number;
  chainName: string;
  marketName: string;
  hubName?: string;
  variant?: 'compact' | 'stacked';
  className?: string;
  disabled?: boolean;
  tokenIconSize?: number;
}

const ReserveIdentity = memo(function ReserveIdentity({
  tokenSymbol,
  chainId,
  chainName,
  marketName,
  hubName,
  variant = 'compact',
  className,
  disabled = false,
  tokenIconSize = 14,
}: ReserveIdentityProps) {
  const chainSrc = getChainIconSrc(chainId);
  const marketLabel = getMarketChipLabel(marketName, chainName);
  const hubChipClass = getHubChipClass(isV4Market(marketName));

  if (variant === 'stacked') {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <TokenIcon symbol={tokenSymbol} size={tokenIconSize} />
        <div className="flex flex-col min-w-0 leading-tight">
          <span className={cn(
            'ds-text-11 font-semibold truncate',
            disabled ? 'text-muted-foreground line-through' : 'text-foreground',
          )}>
            {tokenSymbol}
          </span>
          <span className="ds-text-9 text-muted-foreground inline-flex items-center gap-0.5 min-w-0">
            {chainSrc && <img src={chainSrc} alt={chainName} className="size-2 shrink-0 opacity-70" />}
            <span className="truncate">{marketLabel}</span>
            {hubName != null && (
              <>
                <span aria-hidden className="h-2 w-px bg-border/60 shrink-0" />
                <span className={cn('shrink-0 max-w-full', hubChipClass)} title={`Hub: ${hubName}`}>
                  <span className="truncate">{hubName}</span>
                </span>
              </>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 shrink-0', className)}>
      <TokenIcon symbol={tokenSymbol} size={tokenIconSize} />
      <span className="ds-text-12 font-semibold text-foreground leading-none">{tokenSymbol}</span>
      <span aria-hidden className="h-3 w-px bg-border/60 shrink-0" />
      <span className="inline-flex min-w-0 items-center gap-1 ds-text-10 leading-none text-muted-foreground">
        {chainSrc && <img src={chainSrc} alt={chainName} className="size-2.5 shrink-0 opacity-70" />}
        <span className="truncate">{marketLabel}</span>
      </span>
      {hubName != null && (
        <>
          <span aria-hidden className="h-3 w-px bg-border/60 shrink-0" />
          <span
            className={cn('min-w-0 max-w-[40%] shrink', hubChipClass)}
            title={`Hub: ${hubName}`}
          >
            <span className="truncate">{hubName}</span>
          </span>
        </>
      )}
    </span>
  );
});

export default ReserveIdentity;
