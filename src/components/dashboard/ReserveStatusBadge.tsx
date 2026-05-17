import { useState } from 'react';
import { PauseCircle, Snowflake } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReserveWithSpread } from '@/types/aave';

interface StatusBadgeProps {
  reserve: ReserveWithSpread;
}

export function ReserveStatusBadge({ reserve }: StatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const { isPaused, isFrozen } = reserve;

  const showBadge = isPaused || isFrozen;
  if (!showBadge) return null;

  const labels: string[] = [];
  if (isPaused) labels.push('Paused');
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
          {isPaused && <PauseCircle className="w-2.5 h-2.5 ds-text-paused" />}
          {isFrozen && <Snowflake className="w-2.5 h-2.5 text-sky-500" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <StatusContent reserve={reserve} />
      </TooltipContent>
    </Tooltip>
  );
}

export function StatusContent({ reserve }: StatusBadgeProps) {
  const { isPaused, isFrozen } = reserve;
  if (!isPaused && !isFrozen) return null;

  return (
    <div className="space-y-1 ds-text-12 sm:max-w-[15rem]">
      {isPaused && (
        <p className="text-muted-foreground leading-relaxed">
          <strong className="ds-text-paused">Paused:</strong> all reserve actions
          (deposit, borrow, repay, withdraw, liquidations) are halted.
        </p>
      )}
      {isFrozen && (
        <p className="text-muted-foreground leading-relaxed">
          <strong className="text-sky-500">Frozen:</strong> deposits and borrows are
          temporarily disabled, but existing positions can still be repaid, withdrawn,
          and liquidated.
        </p>
      )}
    </div>
  );
}

export { ReserveStatusBadge as FrozenStatusBadge };
export { StatusContent as FrozenStatusContent };