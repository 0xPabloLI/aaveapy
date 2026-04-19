import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, ExternalLink, SquareArrowOutUpRight, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { buildPoolExplorerUrl, buildTokenExplorerUrl } from '@/lib/poolExplorerLinks';
import { externalLinkTabProps } from '@/lib/externalNavigation';
import { getChainIconSrc } from '@/lib/chainIcons';
import { cn } from '@/lib/utils';

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
 * Desktop  → floating popover anchored under the trigger.
 * Mobile   → bottom sheet (matches existing cap/deficit sheet pattern).
 */
export function AssetActionMenu({
  tokenSymbol,
  tokenAddress,
  marketName,
  isMobile,
  triggerClassName,
  triggerSize = 12,
}: AssetActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  // Position desktop popover under trigger; flip if not enough room below.
  useEffect(() => {
    if (!open || isMobile || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const POPOVER_W = 220;
    const POPOVER_H_EST = 180;
    const margin = 6;
    let left = rect.right - POPOVER_W;
    if (left < 8) left = 8;
    if (left + POPOVER_W > window.innerWidth - 8) left = window.innerWidth - 8 - POPOVER_W;
    let top = rect.bottom + margin;
    if (top + POPOVER_H_EST > window.innerHeight - 8) {
      top = Math.max(8, rect.top - margin - POPOVER_H_EST);
    }
    setPopoverPos({ top, left });
  }, [open, isMobile]);

  // Close on outside click / Escape (desktop).
  useEffect(() => {
    if (!open || isMobile) return;
    const onDoc = (e: MouseEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, isMobile]);

  if (!tokenAddress) return null;

  const aaveUrl = buildAaveReserveUrl({ marketName, tokenAddress });
  const tokenExplorerUrl = buildTokenExplorerUrl(marketName, tokenAddress);
  const poolExplorerUrl = buildPoolExplorerUrl(marketName, { deepLink: false });
  const chainName = deriveChainFromMarketName(marketName);
  const chainIconSrc = getChainIconSrc(chainName);

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
    tokenExplorerUrl
      ? { key: 'token-explorer', label: 'View token on explorer', href: tokenExplorerUrl, icon: 'external' as const }
      : null,
    poolExplorerUrl
      ? { key: 'pool-explorer', label: 'View pool on explorer', href: poolExplorerUrl, icon: 'external' as const }
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
    const isExplorerItem = item.key === 'token-explorer' || item.key === 'pool-explorer';
    const trailing =
      item.key === 'copy' ? (
        <span className="ds-text-11 text-muted-foreground/70 tabular-nums">{truncatedAddress}</span>
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
          'inline-flex items-center justify-center rounded-md p-0.5 text-muted-foreground/70',
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

      {/* Desktop popover (portal) */}
      {!isMobile && open && popoverPos &&
        createPortal(
          <div
            ref={popoverRef}
            role="menu"
            aria-label={ariaLabel}
            style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left, width: 220 }}
            className="z-50 rounded-lg border border-border/60 bg-card p-1 shadow-md animate-in fade-in-0 zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 pt-2 pb-1 ds-text-11 font-medium uppercase tracking-wide text-muted-foreground/70">
              {tokenSymbol}
            </div>
            <div className="flex flex-col">{items.map(renderItem)}</div>
          </div>,
          document.body,
        )}

      {/* Mobile bottom sheet (portal) */}
      {isMobile &&
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
                  <div className="flex items-center justify-between border-b border-border px-[var(--ds-space-4)] py-[var(--ds-space-3)]">
                    <h3 id="asset-action-sheet-title" className="ds-tooltip-title text-foreground">
                      {tokenSymbol}
                    </h3>
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

export default AssetActionMenu;
