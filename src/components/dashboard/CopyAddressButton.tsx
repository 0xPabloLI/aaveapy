import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyAddressButtonProps {
  /** Address to copy (typically reserve.tokenAddress). */
  address: string | null | undefined;
  /** Token symbol used in toast/aria label. */
  tokenSymbol?: string;
  /** Optional size in px (icon dimension). Defaults to 12. */
  iconSize?: number;
  /** Extra classes for the button wrapper. */
  className?: string;
  /** Visible label rendered before the icon (optional, for desktop summary bar). */
  label?: string;
}

/**
 * Compact ghost icon button that copies an underlying token address
 * to the clipboard and surfaces a sonner toast confirmation. Designed
 * to live inside reserve headers (mobile card + desktop simulation sub-row).
 */
export function CopyAddressButton({
  address,
  tokenSymbol,
  iconSize = 12,
  className,
  label,
}: CopyAddressButtonProps) {
  const [copied, setCopied] = useState(false);

  if (!address) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success('Address copied', {
        description: tokenSymbol
          ? `${tokenSymbol} · ${address.slice(0, 6)}…${address.slice(-4)}`
          : `${address.slice(0, 6)}…${address.slice(-4)}`,
      });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy address');
    }
  };

  const ariaLabel = tokenSymbol
    ? `Copy ${tokenSymbol} token address`
    : 'Copy token address';

  return (
    <button
      type="button"
      onClick={handleClick}
      title={ariaLabel}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground/70',
        'transition-colors hover:text-foreground hover:bg-muted/60 active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {label && <span className="ds-text-11 font-medium">{label}</span>}
      {copied ? (
        <Check
          className="text-emerald-500"
          style={{ width: iconSize, height: iconSize }}
        />
      ) : (
        <Copy style={{ width: iconSize, height: iconSize }} />
      )}
    </button>
  );
}

export default CopyAddressButton;
