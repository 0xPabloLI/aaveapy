import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import { Check, Copy, ExternalLink, SquareArrowOutUpRight, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { buildAaveUrl, buildAaveV4AssetUrl } from '@/lib/aaveLinks';
import { buildTydroReserveUrl } from '@/lib/tydroLinks';
import { buildPoolExplorerUrl, buildTokenExplorerUrl, buildHubExplorerUrl, buildSpokeExplorerUrl } from '@/lib/poolExplorerLinks';
import { externalLinkTabProps } from '@/lib/externalNavigation';
import { getChainIconSrc } from '@/lib/chainIcons';
import { getProtocolVersion } from '@/lib/protocolVersion';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

/** Strip Aave market prefix to get the chain name (e.g. "AaveV3Arbitrum" → "Arbitrum"). */
function deriveChainFromMarketName(marketName: string): string {
  return marketName.replace(/^Aave(V\d+)?/i, '') || marketName;
}

export interface AssetActionMenuProps {
  /** Reserve token symbol (display + aria). */
  tokenSymbol: string;
  /** Underlying ERC-20 address (used for explorer + copy). */
  tokenAddress: string | null | undefined;
  /** Aave market name (e.g. AaveV3Ethereum) — used to build links. */
  marketName: string;
  /** V4 SDK ReserveId for pro.aave.com deep-links. */
  aaveProReserveId?: string;
  /** Chain name for explorer URL fallback (needed for V4 markets). */
  chainName?: string;
  /** V4 Hub contract address (for explorer links). */
  hubAddress?: string;
  /** V4 Spoke contract address (for explorer links). */
  spokeAddress?: string;
  /** When true, render bottom-sheet style; otherwise render desktop popover. */
  isMobile: boolean;
  /** Optional extra classes for the trigger button. */
  triggerClassName?: string;
  /** Trigger icon size in px. Defaults to 12. */
  triggerSize?: number;
}

interface MenuItem {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
  icon: 'external' | 'copy' | 'check';
}

/**
 * Compact "⋯" menu next to the token symbol. Aggregates the three asset actions
 * users typically reach for from the dashboard:
 *   - Open on Aave
 *   - View token on explorer
 *   - View pool on explorer
 *   - Copy address
 *
 * Desktop  → Radix Popover anchored to the trigger (same positioning as Market column).
 * Mobile   → bottom sheet (matches existing cap/deficit sheet pattern).
 */
export function AssetActionMenu({
  tokenSymbol,
  tokenAddress,
  marketName,
  aaveProReserveId,
  chainName: reserveChainName,
  hubAddress,
  spokeAddress,
  isMobile,
  triggerClassName,
  triggerSize = 12,
}: AssetActionMenuProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!tokenAddress) return null;

  const chainName = reserveChainName ?? deriveChainFromMarketName(marketName);
  const chainIconSrc = getChainIconSrc(chainName);

  const aaveUrl = buildAaveUrl({ marketName, tokenAddress, aaveProReserveId });
  const tydroUrl = buildTydroReserveUrl({ marketName, tokenAddress });
  const aaveV4AssetUrl = buildAaveV4AssetUrl({ tokenAddress, chainName });
  const isV4 = getProtocolVersion(marketName) === 'v4';
  const tokenExplorerUrl = buildTokenExplorerUrl(marketName, tokenAddress, { chainName: reserveChainName });
  const poolExplorerUrl = buildPoolExplorerUrl(marketName, { deepLink: false, chainName: reserveChainName });
  const hubExplorerUrl = buildHubExplorerUrl(hubAddress, { chainName: reserveChainName });
  const spokeExplorerUrl = buildSpokeExplorerUrl(spokeAddress, { chainName: reserveChainName });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tokenAddress);
      setCopied(true);
      toast.success('Address copied', {
        description: `${tokenSymbol} · ${tokenAddress.slice(0, 6)}…${tokenAddress.slice(-4)}`,
      });
      window.setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 900);
    } catch {
      toast.error('Failed to copy address');
    }
  };

  const items: MenuItem[] = [
    aaveUrl ? { key: 'aave', label: 'Open on Aave', href: aaveUrl, icon: 'external' as const } : null,
    tydroUrl ? { key: 'tydro', label: 'Open on Tydro', href: tydroUrl, icon: 'external' as const } : null,
    isV4 && aaveV4AssetUrl
      ? { key: 'aave-v4-asset', label: 'View asset page', href: aaveV4AssetUrl, icon: 'external' as const }
      : null,
    tokenExplorerUrl
      ? { key: 'token-explorer', label: 'View token on explorer', href: tokenExplorerUrl, icon: 'external' as const }
      : null,
    poolExplorerUrl
      ? { key: 'pool-explorer', label: 'View pool on explorer', href: poolExplorerUrl, icon: 'external' as const }
      : null,
    hubExplorerUrl
      ? { key: 'hub-explorer', label: 'View hub on explorer', href: hubExplorerUrl, icon: 'external' as const }
      : null,
    spokeExplorerUrl
      ? { key: 'spoke-explorer', label: 'View spoke on explorer', href: spokeExplorerUrl, icon: 'external' as const }
      : null,
    {
      key: 'copy',
      label: copied ? 'Copied!' : 'Copy address',
      onClick: handleCopy,
      icon: copied ? ('check' as const) : ('copy' as const),
    },
  ].filter(Boolean) as MenuItem[];

  const renderItem = (item: MenuItem) => {
    const Icon =
      item.icon === 'external' ? ExternalLink : item.icon === 'check' ? Check : Copy;
    const baseCls = cn(
      'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 ds-text-13 text-foreground/90',
      'transition-colors hover:bg-muted/70 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    );
    const truncatedAddress = `${tokenAddress.slice(0, 6)}…${tokenAddress.slice(-4)}`;
    const isExplorerItem = item.key === 'token-explorer' || item.key === 'pool-explorer' || item.key === 'hub-explorer' || item.key === 'spoke-explorer';
    const isAaveItem = item.key === 'aave' || item.key === 'aave-v4-asset';
    const protocolIconSrc = isAaveItem
      ? (isV4 ? '/icons/tokens/aave-pro.svg' : '/icons/tokens/aave.svg')
      : item.key === 'tydro'
        ? (isDark ? '/icons/partners/tydro-white.svg' : '/icons/partners/tydro-black.svg')
        : null;
    const trailing =
      item.key === 'copy' ? (
        <span className="ds-text-11 text-muted-foreground/70 tabular-nums">{truncatedAddress}</span>
      ) : protocolIconSrc ? (
        <img
          src={protocolIconSrc}
          alt={isAaveItem ? (isV4 ? 'Aave Pro' : 'Aave') : 'Tydro'}
          className={cn(
            'h-3.5 w-3.5 rounded-full',
            item.key !== 'tydro' && 'opacity-80',
          )}
          loading="lazy"
        />
      ) : isExplorerItem && chainIconSrc ? (
        <img
          src={chainIconSrc}
          alt={chainName}
          title={chainName}
          className="h-3.5 w-3.5 rounded-full opacity-80"
          loading="lazy"
        />
      ) : null;
    if (item.href) {
      return (
        <a
          key={item.key}
          href={item.href}
          {...externalLinkTabProps(isMobile)}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          className={baseCls}
        >
          <span className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span>{item.label}</span>
          </span>
          {trailing}
        </a>
      );
    }
    return (
      <button
        key={item.key}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          item.onClick?.();
        }}
        className={baseCls}
      >
        <span className="flex items-center gap-2">
          <Icon
            className={cn(
              'h-3.5 w-3.5',
              item.icon === 'check' ? 'text-emerald-500' : 'text-muted-foreground/70',
            )}
          />
          <span>{item.label}</span>
        </span>
        {trailing}
      </button>
    );
  };

  const ariaLabel = `Asset actions for ${tokenSymbol}`;

  if (isMobile) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen((v) => !v);
          }}
          title={ariaLabel}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="menu"
          className={cn(
            'inline-flex items-center justify-center rounded-md p-0.5 text-foreground/60',
            'transition-colors hover:text-foreground hover:bg-muted/60 active:scale-[0.97]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            open && 'text-foreground bg-muted/60',
            triggerClassName,
          )}
        >
          <SquareArrowOutUpRight
            style={{ width: triggerSize, height: triggerSize }}
            className="transition-transform duration-200"
          />
        </button>

        {typeof document !== 'undefined' &&
          createPortal(
            <AnimatePresence>
              {open && (
                <>
                  <motion.div
                    className="fixed inset-0 z-30 bg-background/40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setOpen(false)}
                    aria-hidden="true"
                  />
                  <motion.div
                    className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border border-border/60 bg-card ds-tooltip-shadow-up"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="asset-action-sheet-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end border-b border-border px-[var(--ds-space-2)] py-[var(--ds-space-2)]">
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="rounded-full p-[var(--ds-space-1-5)] transition-colors hover:bg-muted"
                        aria-label="Close"
                      >
                        <X className="h-5 w-5 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1 px-[var(--ds-space-2)] py-[var(--ds-space-2)] pb-[max(env(safe-area-inset-bottom),var(--ds-space-3))]">
                      {items.map(renderItem)}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            document.body,
          )}
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
          }}
          title={ariaLabel}
          aria-label={ariaLabel}
          aria-haspopup="menu"
          className={cn(
            'inline-flex items-center justify-center rounded-md p-0.5 text-foreground/60',
            'transition-colors hover:text-foreground hover:bg-muted/60 active:scale-[0.97]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            open && 'text-foreground bg-muted/60',
            triggerClassName,
          )}
        >
          <SquareArrowOutUpRight
            style={{ width: triggerSize, height: triggerSize }}
            className="transition-transform duration-200"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[220px] p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div role="menu" aria-label={ariaLabel} className="flex flex-col">
          {items.map(renderItem)}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default AssetActionMenu;
