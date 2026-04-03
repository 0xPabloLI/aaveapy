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

function EarnPerDayFootnote() {
  return (
    <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 ds-text-11 text-muted-foreground leading-snug">
      <span className="font-medium text-foreground">Earn /day</span> — same in APR and APY mode. Native uses
      Aave&apos;s per-second rate; incentive uses APR ÷ 365.
    </div>
  );
}

function TooltipModeRow({ mode, hint }: { mode: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="inline-flex min-w-[2.25rem] justify-center rounded border border-border bg-muted/50 px-2 py-0.5 ds-text-11 font-semibold tabular-nums text-foreground">
        {mode}
      </span>
      <span className="ds-text-11 text-muted-foreground leading-snug">{hint}</span>
    </div>
  );
}

/** Shared formula chrome for help tooltips (AprApyToggle, InkAprCalculator, etc.). */
export function FormulaBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <code className="ds-text-12 font-mono font-medium text-foreground block break-all leading-snug">{children}</code>
    </div>
  );
}

function AprTooltipContent() {
  return (
    <div className="space-y-3">
      <TooltipModeRow mode="APR" hint="Linear incentive annual %" />
      <FormulaBlock>APR = Native APY + Incentive APR</FormulaBlock>
      <p className="ds-text-12 text-muted-foreground leading-relaxed">
        Only incentive annual % follows this switch; native stays APY. Incentive here is linear APR (no reinvest
        assumption).
      </p>
      <EarnPerDayFootnote />
    </div>
  );
}

function ApyTooltipContent() {
  return (
    <div className="space-y-3">
      <TooltipModeRow mode="APY" hint="Compounded incentive annual %" />
      <FormulaBlock>APY = Native APY + Incentive APY</FormulaBlock>
      <p className="ds-text-12 text-muted-foreground leading-relaxed">
        Only incentive annual % follows this switch; native stays APY. Incentive APY assumes ~monthly reinvest.
      </p>
      <FormulaBlock>(1 + APR/12)¹² − 1</FormulaBlock>
      <EarnPerDayFootnote />
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
              title="APR · linear incentives"
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
              title="APR · linear incentives"
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
              title="APY · compounded incentives"
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
              title="APY · compounded incentives"
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
