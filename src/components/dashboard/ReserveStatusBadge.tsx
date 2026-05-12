import { useState } from 'react';
import { Ban, PauseCircle, Snowflake } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReserveWithSpread } from '@/types/aave';

interface StatusBadgeProps {
  reserve: ReserveWithSpread;
}

/**
 * Click-to-open status icons that surface paused / inactive / frozen context.
 * Renders nothing when the reserve is unrestricted.
 * Paused > Inactive > Frozen priority for the primary icon.
 */
export function ReserveStatusBadge({ reserve }: StatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const { isPaused, isActive, isFrozen } = reserve;

  const showBadge = isPaused || isActive === false || isFrozen;
  if (!showBadge) return null;

  const labels: string[] = [];
  if (isPaused) labels.push('Paused');
  if (isActive === false) labels.push('Inactive');
  if (isFrozen) labels.push('Frozen');

  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="inline-flex shrink-0 items-center gap-[3px]"
          aria-label={`Show ${labels.join(' & ')} status details`}
        >
          {isFrozen && <Snowflake className="w-2.5 h-2.5 text-sky-500" />}
          {isActive === false && <Ban className="w-2.5 h-2.5 ds-text-paused" />}
          {isPaused && <PauseCircle className="w-2.5 h-2.5 ds-text-paused" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <StatusContent reserve={reserve} />
      </TooltipContent>
    </Tooltip>
  );
}

/** Shared copy describing protocol status. Used by tooltip + mobile sheet. */
export function StatusContent({ reserve }: StatusBadgeProps) {
  const { isPaused, isActive, isFrozen } = reserve;
  if (!isPaused && isActive !== false && !isFrozen) return null;

  return (
    <div className="space-y-1 ds-text-12 sm:max-w-[15rem]">
      {isPaused && (
        <p className="text-muted-foreground leading-relaxed">
          <strong className="ds-text-paused">Paused:</strong> all reserve actions
          (deposit, borrow, repay, withdraw, liquidations) are halted.
        </p>
      )}
      {isActive === false && (
        <p className="text-muted-foreground leading-relaxed">
          <strong className="ds-text-paused">Inactive:</strong> the reserve is not
          active. Most protocol actions are unavailable.
        </p>
      )}
      {isFrozen && (
        <p className="text-muted-foreground leading-relaxed">
          <strong className="text-sky-500">Frozen:</strong> new deposits and borrows
          are disabled. Exit actions may remain available when the reserve is active
          and not paused.
        </p>
      )}
    </div>
  );
}

// Backward-compat re-exports so existing imports don't break immediately.
// Migrate callers to ReserveStatusBadge / StatusContent, then remove these.
export { ReserveStatusBadge as FrozenStatusBadge };
export { StatusContent as FrozenStatusContent };