import { cn } from '@/lib/utils';

export interface ExplorerIconStackProps {
  /** Public URL for the chain icon. When undefined the chain icon is omitted. */
  chainIconSrc?: string;
  /** Accessible label + tooltip for the chain icon. */
  chainName: string;
  /** Public URL for the explorer icon. When undefined the explorer icon is omitted. */
  explorerIconSrc?: string;
  /** Accessible label + tooltip for the explorer icon. */
  explorerName: string;
  /** Optional extra classes applied to the outer container. */
  className?: string;
}

/**
 * Stacked badge that overlays the chain icon and explorer icon when both
 * are available, with the explorer icon offset to the bottom-right. The
 * component renders nothing when both sources are missing so it can be
 * dropped into trailing-icon slots without leaving empty space.
 */
export function ExplorerIconStack({
  chainIconSrc,
  chainName,
  explorerIconSrc,
  explorerName,
  className,
}: ExplorerIconStackProps) {
  if (!chainIconSrc && !explorerIconSrc) return null;

  if (!explorerIconSrc) {
    return (
      <img
        src={chainIconSrc}
        alt={chainName}
        title={chainName}
        className={cn('h-3.5 w-3.5 rounded-full opacity-80', className)}
        loading="lazy"
      />
    );
  }

  if (!chainIconSrc) {
    return (
      <img
        src={explorerIconSrc}
        alt={explorerName}
        title={explorerName}
        className={cn('h-3.5 w-3.5 rounded-full opacity-80', className)}
        loading="lazy"
      />
    );
  }

  return (
    // 22px-wide container, intentionally shorter than the two 14px icons
    // combined: the explorer icon visually overflows the bottom-right by
    // `top-1.5` to produce the stacked-badge look (Slack/Discord style).
    // Do NOT add `overflow: hidden` to a future parent without revisiting.
    <span
      className={cn('relative inline-flex h-3.5 w-[22px] items-center', className)}
      title={`${chainName} · ${explorerName}`}
    >
      <img
        src={chainIconSrc}
        alt={chainName}
        className="absolute left-0 top-0 h-3.5 w-3.5 rounded-full ring-1 ring-background opacity-80"
        loading="lazy"
      />
      <img
        src={explorerIconSrc}
        alt={explorerName}
        className="absolute right-0 top-1.5 h-3.5 w-3.5 rounded-full ring-1 ring-background opacity-80"
        loading="lazy"
      />
    </span>
  );
}

export default ExplorerIconStack;
