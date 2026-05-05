import { useState, type ReactNode } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ConfirmPopoverProps {
  /** Trigger element — typically the original delete button. Will receive click that opens the popover instead of running the action. */
  children: ReactNode;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Lightweight confirmation popover for destructive actions.
 * Wrap the trigger button with this. Clicking the trigger opens the
 * confirmation; user must press "Remove" to actually fire `onConfirm`.
 */
export function ConfirmPopover({
  children,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Remove',
  cancelLabel = 'Cancel',
  align = 'end',
  side = 'bottom',
}: ConfirmPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={6}
        className="w-auto max-w-[260px] p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="ds-text-12 font-semibold text-foreground">{title}</span>
            {description && (
              <span className="ds-text-11 text-muted-foreground leading-snug">{description}</span>
            )}
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={cn(
                'rounded-md px-2 py-1 ds-text-11 font-semibold text-muted-foreground',
                'hover:bg-muted/60 hover:text-foreground transition-colors',
              )}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
              className={cn(
                'rounded-md px-2 py-1 ds-text-11 font-semibold',
                'bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors',
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ConfirmPopover;
