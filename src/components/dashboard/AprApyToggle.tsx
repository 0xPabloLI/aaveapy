import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface AprApyToggleProps {
  isApy: boolean;
  setIsApy: (value: boolean) => void;
}

const TOOLTIP_WIDTH = 320;
const VIEWPORT_PADDING = 16;

function getTooltipWidth(): number {
  if (typeof window === 'undefined') return TOOLTIP_WIDTH;
  return Math.min(TOOLTIP_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2);
}

interface TooltipPosition {
  top: number;
  left?: number;
  right?: number;
}

function calculateTooltipPosition(
  triggerRect: DOMRect,
  alignLeft: boolean,
  width: number = TOOLTIP_WIDTH
): TooltipPosition {
  const top = triggerRect.bottom + 8;

  if (alignLeft) {
    const left = Math.max(VIEWPORT_PADDING, triggerRect.left);
    const rightEdge = left + width;
    if (rightEdge > window.innerWidth - VIEWPORT_PADDING) {
      return {
        top,
        left: Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING),
      };
    }
    return { top, left };
  } else {
    const right = Math.max(VIEWPORT_PADDING, window.innerWidth - triggerRect.right);
    const leftEdge = window.innerWidth - right - width;
    if (leftEdge < VIEWPORT_PADDING) {
      return {
        top,
        right: Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING),
      };
    }
    return { top, right };
  }
}

export function InfoIconButton({
  'aria-label': ariaLabel,
  isOpen,
  onToggle,
  onClose,
  variant = 'default',
  children,
}: {
  'aria-label': string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  /**
   * `neutral`: muted chrome for dense toolbars (e.g. scenario controls) so supply/borrow semantic colors stay table-only.
   * `purple`: aligns with INK-branded surfaces (logo + purple tooltips) instead of supply-emerald default.
   */
  variant?: 'default' | 'neutral' | 'purple';
  children: (triggerRect: DOMRect | null) => React.ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const isMobile = useIsMobile();

  const updateTriggerRect = () => {
    if (triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      updateTriggerRect();
    }
  }, [isOpen]);

  const handleClick = () => {
    if (isMobile) {
      updateTriggerRect();
      onToggle();
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      updateTriggerRect();
      onToggle();
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      onClose();
    }
  };

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={() => {
          if (!isMobile) {
            updateTriggerRect();
            onToggle();
          }
        }}
        onBlur={() => {
          if (!isMobile) {
            onClose();
          }
        }}
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          'cursor-pointer md:cursor-auto',
          variant === 'neutral'
            ? 'border border-border bg-card text-foreground shadow-sm hover:bg-accent/80 hover:border-border'
            : variant === 'purple'
              ? 'ds-bg-purple-500-10 ds-text-purple-600 shadow-sm hover:bg-[rgb(var(--ds-purple-500-rgb)/0.2)] hover:ds-text-purple-700'
              : 'ds-bg-emerald-500-10 ds-text-emerald-600 hover:ds-bg-emerald-500-20 hover:ds-text-emerald-700',
        )}
      >
        <Info className="h-2.5 w-2.5 shrink-0" aria-hidden />
      </button>
      {children(triggerRect)}
    </div>
  );
}

export function MobileTooltip({
  isOpen,
  onClose,
  title,
  children,
  variant = 'default',
  hideTitle = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'neutral' | 'purple';
  hideTitle?: boolean;
}) {
  if (!isOpen) return null;

  const headerClass =
    variant === 'neutral'
      ? 'bg-card px-4 py-2.5 rounded-t-xl flex items-center justify-between border-b border-border'
      : variant === 'purple'
        ? 'ds-bg-purple-500-10 px-4 py-2.5 rounded-t-xl flex items-center justify-between border-b ds-border-purple-200'
        : 'ds-bg-emerald-500-10 px-4 py-2.5 rounded-t-xl flex items-center justify-between border-b ds-border-emerald-200';
  const titleClass =
    variant === 'neutral'
      ? 'ds-text-14 font-semibold text-foreground'
      : variant === 'purple'
        ? 'ds-text-purple-700 ds-text-14 font-semibold'
        : 'ds-text-emerald-700 ds-text-14 font-semibold';

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-background/40 z-[9998] backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-[360px] bottom-4 z-[9999] bg-card border border-border rounded-xl shadow-xl
          animate-in slide-in-from-bottom-4 fade-in-0 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {hideTitle ? (
          <div className="relative px-4 py-3.5 rounded-xl space-y-3 bg-card">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            {children}
          </div>
        ) : (
          <>
            <div className={headerClass}>
              <h3 className={titleClass}>{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-3.5 rounded-b-xl space-y-3 bg-card">{children}</div>
          </>
        )}
      </div>
    </>,
    document.body
  );
}

export function DesktopTooltip({
  isOpen,
  alignLeft,
  triggerRect,
  onMouseEnter,
  onMouseLeave,
  title,
  children,
  variant = 'default',
  hideTitle = false,
}: {
  isOpen: boolean;
  alignLeft: boolean;
  triggerRect: DOMRect | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'neutral' | 'purple';
  hideTitle?: boolean;
}) {
  if (!isOpen || !triggerRect) return null;

  const tooltipWidth = getTooltipWidth();
  const position = calculateTooltipPosition(triggerRect, alignLeft, tooltipWidth);
  const headerClass =
    variant === 'neutral'
      ? 'bg-card px-4 py-2 rounded-t-xl border-b border-border'
      : variant === 'purple'
        ? 'ds-bg-purple-500-10 px-4 py-2 rounded-t-xl border-b ds-border-purple-200'
        : 'ds-bg-emerald-500-10 px-4 py-2 rounded-t-xl border-b ds-border-emerald-200';
  const titleClass =
    variant === 'neutral'
      ? 'ds-text-14 font-semibold text-foreground'
      : variant === 'purple'
        ? 'ds-text-purple-700 ds-text-14 font-semibold'
        : 'ds-text-emerald-700 ds-text-14 font-semibold';

  return createPortal(
    <div
      className="fixed z-[9999] bg-card border border-border rounded-xl shadow-lg
        animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        width: tooltipWidth,
        maxWidth: `calc(100vw - ${VIEWPORT_PADDING * 2}px)`,
        top: position.top,
        left: position.left,
        right: position.right,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="tooltip"
    >
      {hideTitle ? (
        <div className="px-4 py-3 rounded-xl space-y-2.5 bg-card">{children}</div>
      ) : (
        <>
          <div className={headerClass}>
            <h3 className={titleClass}>{title}</h3>
          </div>
          <div className="px-4 py-3 rounded-b-xl space-y-2.5 bg-card">{children}</div>
        </>
      )}
    </div>,
    document.body
  );
}

function TooltipBullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2 items-start">
      <span
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ds-bg-emerald-500-20 ring-1 ring-[rgb(var(--ds-emerald-500-rgb)/0.4)]"
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}

/** Matches expanded simulation table header; explains daily $ is isolated from APR/APY toggle. */
function EarnPerDaySimulationNote() {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5 space-y-2">
      <div>
        <p className="ds-text-11 font-semibold text-foreground">Earn /day (simulation)</p>
        <p className="ds-text-11 text-muted-foreground leading-snug mt-0.5">
          Same estimate whether you pick APR or APY above — this switch does not change it.
        </p>
      </div>
      <ul className="space-y-1.5 ds-text-11 text-muted-foreground">
        <TooltipBullet>
          <span>
            <strong className="font-medium text-foreground">Native:</strong> daily $ from Aave&apos;s per-second rate
            (same compounding path as pool APY).
          </span>
        </TooltipBullet>
        <TooltipBullet>
          <span>
            <strong className="font-medium text-foreground">Incentive:</strong> linear on incentive APR (APR ÷ 365).
          </span>
        </TooltipBullet>
      </ul>
    </div>
  );
}

function AprTooltipContent() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="bg-muted/50 rounded-lg border border-border px-3 py-2">
          <code className="ds-text-12 font-mono font-medium text-foreground block break-all sm:whitespace-normal">
            APR = Native APY + Incentive APR
          </code>
        </div>
        <ul className="space-y-1.5 ds-text-12 text-muted-foreground">
          <TooltipBullet>
            <span>
              <strong className="font-semibold ds-text-emerald-600">Native APY:</strong> auto-compounded by Aave
            </span>
          </TooltipBullet>
          <TooltipBullet>
            <span>
              <strong className="font-semibold ds-text-emerald-600">Incentive:</strong> shown as APR (claimable;
              no reinvest assumption)
            </span>
          </TooltipBullet>
        </ul>
      </div>

      <div className="rounded-lg border border-dashed border-border/70 bg-card/50 px-3 py-2 space-y-1.5">
        <p className="ds-text-11 font-semibold text-foreground">This toggle</p>
        <p className="ds-text-11 text-muted-foreground leading-snug">
          Only changes how <strong className="font-medium text-foreground">annual incentive %</strong> is labeled.
          Native headline stays APY.
        </p>
        <p className="ds-text-11 text-muted-foreground leading-snug pt-0.5 border-t border-border/60">
          Pick <strong className="font-medium text-foreground">APR</strong> if you usually don&apos;t reinvest claimed
          incentives into the same strategy.
        </p>
      </div>

      <EarnPerDaySimulationNote />
    </div>
  );
}

function ApyTooltipContent() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="bg-muted/50 rounded-lg border border-border px-3 py-2">
          <code className="ds-text-12 font-mono font-medium text-foreground block break-all sm:whitespace-normal">
            APY = Native APY + Incentive APY
          </code>
        </div>
        <ul className="space-y-1.5 ds-text-12 text-muted-foreground">
          <TooltipBullet>
            <span>
              <strong className="font-semibold ds-text-emerald-600">Native APY:</strong> auto-compounded by Aave
            </span>
          </TooltipBullet>
          <TooltipBullet>
            <span>
              <strong className="font-semibold ds-text-emerald-600">Incentive:</strong> APY assumes you reinvest
              incentives about once a month
            </span>
          </TooltipBullet>
        </ul>
        <div className="ds-bg-emerald-500-10 border ds-border-emerald-200 rounded-lg px-3 py-2">
          <code className="ds-text-11 font-mono font-medium ds-text-emerald-700 block break-all">
            Incentive APY = (1 + APR/12)¹² − 1
          </code>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border/70 bg-card/50 px-3 py-2 space-y-1.5">
        <p className="ds-text-11 font-semibold text-foreground">This toggle</p>
        <p className="ds-text-11 text-muted-foreground leading-snug">
          Only changes how <strong className="font-medium text-foreground">annual incentive %</strong> is labeled.
          Native headline stays APY.
        </p>
        <p className="ds-text-11 text-muted-foreground leading-snug pt-0.5 border-t border-border/60">
          Pick <strong className="font-medium text-foreground">APY</strong> if you assume monthly reinvestment of
          claimable incentives.
        </p>
      </div>

      <EarnPerDaySimulationNote />
    </div>
  );
}

export function AprApyToggle({ isApy, setIsApy }: AprApyToggleProps) {
  const [aprOpen, setAprOpen] = useState(false);
  const [apyOpen, setApyOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex items-center gap-[var(--ds-info-gap)]">
      <InfoIconButton
        aria-label="Information about APR"
        isOpen={aprOpen}
        onToggle={() => setAprOpen(!aprOpen)}
        onClose={() => setAprOpen(false)}
      >
        {(triggerRect) =>
          isMobile ? (
            <MobileTooltip
              isOpen={aprOpen}
              onClose={() => setAprOpen(false)}
              title="APR (Annual Percentage Rate)"
            >
              <AprTooltipContent />
            </MobileTooltip>
          ) : (
            <DesktopTooltip
              isOpen={aprOpen}
              alignLeft
              triggerRect={triggerRect}
              onMouseEnter={() => setAprOpen(true)}
              onMouseLeave={() => setAprOpen(false)}
              title="APR (Annual Percentage Rate)"
            >
              <AprTooltipContent />
            </DesktopTooltip>
          )
        }
      </InfoIconButton>

      {/* Segmented Control with color indication */}
      <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
        <button
          type="button"
          onClick={() => setIsApy(false)}
          className={`
            px-3 py-1 rounded-md ds-text-12 font-semibold transition-all duration-200
            ${!isApy 
              ? 'bg-card ds-text-emerald-600 shadow-sm border border-border/60' 
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }
          `}
          aria-pressed={!isApy}
        >
          APR
        </button>
        <button
          type="button"
          onClick={() => setIsApy(true)}
          className={`
            px-3 py-1 rounded-md ds-text-12 font-semibold transition-all duration-200
            ${isApy 
              ? 'bg-card ds-text-emerald-600 shadow-sm border border-border/60' 
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }
          `}
          aria-pressed={isApy}
        >
          APY
        </button>
      </div>

      <InfoIconButton
        aria-label="Information about APY"
        isOpen={apyOpen}
        onToggle={() => setApyOpen(!apyOpen)}
        onClose={() => setApyOpen(false)}
      >
        {(triggerRect) =>
          isMobile ? (
            <MobileTooltip
              isOpen={apyOpen}
              onClose={() => setApyOpen(false)}
              title="APY (Annual Percentage Yield)"
            >
              <ApyTooltipContent />
            </MobileTooltip>
          ) : (
            <DesktopTooltip
              isOpen={apyOpen}
              alignLeft={false}
              triggerRect={triggerRect}
              onMouseEnter={() => setApyOpen(true)}
              onMouseLeave={() => setApyOpen(false)}
              title="APY (Annual Percentage Yield)"
            >
              <ApyTooltipContent />
            </DesktopTooltip>
          )
        }
      </InfoIconButton>
    </div>
  );
}

export default AprApyToggle;
