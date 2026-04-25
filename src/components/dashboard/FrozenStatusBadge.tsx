import { useState } from 'react';
import { Snowflake } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FrozenStatusBadgeProps {
  isFrozen?: boolean;
  isPaused?: boolean;
}

/**
 * Click-to-open status pill that surfaces frozen / paused context.
 * Renders nothing when neither flag is set.
 */
export function FrozenStatusBadge({ isFrozen, isPaused }: FrozenStatusBadgeProps) {
  const [open, setOpen] = useState(false);
  if (!isFrozen && !isPaused) return null;

  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 ds-text-9 font-medium text-sky-500 bg-sky-500/10"
          aria-label="Show frozen or paused status details"
        >
          <Snowflake className="w-2.5 h-2.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <FrozenStatusContent isFrozen={isFrozen} isPaused={isPaused} />
      </TooltipContent>
    </Tooltip>
  );
}

/** Shared copy describing frozen/paused state. Used by tooltip + mobile sheet. */
export function FrozenStatusContent({ isFrozen, isPaused }: FrozenStatusBadgeProps) {
  return (
    <div className="space-y-1.5 ds-text-12 max-w-[15rem]">
      {isFrozen && (
        <p className="text-muted-foreground">
          <strong className="text-sky-500">Frozen:</strong> deposits and borrows are
          temporarily disabled, but existing positions can still be repaid, withdrawn,
          and liquidated.
        </p>
      )}
      {isPaused && (
        <p className="text-muted-foreground">
          <strong className="text-sky-500">Paused:</strong> all reserve actions
          (deposit, borrow, repay, withdraw, liquidations) are halted.
        </p>
      )}
    </div>
  );
}
