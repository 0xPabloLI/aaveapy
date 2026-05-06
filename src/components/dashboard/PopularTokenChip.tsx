/**
 * PopularTokenChip — unified chip for "popular token" suggestions in PortfolioPanel.
 *
 * Single source of truth for: badge size, chain icon dimensions, V4 badge style,
 * font sizes and colors. Identical visual output across all breakpoints.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getMarketChipLabel, isV4Market } from '@/lib/marketLabels';

interface PopularTokenChipProps {
  reserveId: string;
  tokenSymbol: string;
  chainName: string;
  marketName: string;
  onAdd: (reserveId: string) => void;
}

const PopularTokenChip = memo(function PopularTokenChip({
  reserveId,
  tokenSymbol,
  chainName,
  marketName,
  onAdd,
}: PopularTokenChipProps) {
  const chainSrc = getChainIconSrc(chainName);
  const marketLabel = getMarketChipLabel(marketName, chainName);
  const v4 = isV4Market(marketName);

  return (
    <button
      type="button"
      onClick={() => onAdd(reserveId)}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border border-border/50 bg-card/70 px-2.5 leading-none',
        'ds-text-11 font-semibold text-foreground transition-colors duration-200 hover:bg-muted/60',
      )}
      aria-label={`Add ${tokenSymbol} on ${marketName} to batch`}
    >
      <TokenIcon symbol={tokenSymbol} size={14} />
      <span>{tokenSymbol}</span>
      <span aria-hidden className="h-3 w-px bg-border/60" />
      <span className="inline-flex items-center gap-1 text-[10px] font-normal text-muted-foreground/70">
        {chainSrc && (
          <img
            src={chainSrc}
            alt={chainName}
            className="size-3 shrink-0 opacity-70"
            width={12}
            height={12}
          />
        )}
        {v4 && (
          <span className="inline-flex items-center px-1 py-0 rounded-full text-[9px] font-medium leading-none text-[rgb(var(--ds-brand-magenta-rgb))] bg-[rgb(var(--ds-brand-magenta-rgb))]/10">
            V4
          </span>
        )}
        <span className="whitespace-nowrap">{marketLabel}</span>
      </span>
    </button>
  );
});

export default PopularTokenChip;

