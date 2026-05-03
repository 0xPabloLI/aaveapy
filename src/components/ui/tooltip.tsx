import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, side, ...props }, ref) => {
  const isMobile = useIsMobile();

  const mobileAnimationClasses =
    "animate-in fade-in-0 slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-4";

  const desktopAnimationClasses =
    "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        // 移动端统一从下往上弹出，避免左右滑动带来的“拉伸”感
        side={isMobile ? "bottom" : side}
        className={cn(
          "z-50 max-w-[18rem] overflow-visible rounded-md border border-border/60 bg-card px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] ds-text-14 leading-tight text-foreground shadow-sm duration-200",
          isMobile ? mobileAnimationClasses : desktopAnimationClasses,
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

const TooltipArrow = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Arrow>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Arrow>
>(({ className, ...props }, ref) => (
  <TooltipPrimitive.Arrow
    ref={ref}
    className={cn("fill-card", className)}
    {...props}
  />
));
TooltipArrow.displayName = TooltipPrimitive.Arrow.displayName;

const TooltipCalloutArrow = ({ side = 'right' as const }: { side?: 'top' | 'bottom' | 'left' | 'right' }) => {
  const borderClass = 'border-border/60';
  const sizeClass = 'w-2.5 h-2.5';
  const arrowBase = `${sizeClass} bg-card pointer-events-none z-20 rotate-45`;

  switch (side) {
    case 'right':
      return (
        <>
          <div className={`absolute ${arrowBase} -left-[7px] top-1/2 -translate-y-1/2 border-b border-l ${borderClass}`} />
          <div className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-[2px] h-[11px] bg-card pointer-events-none z-10" />
        </>
      );
    case 'left':
      return (
        <>
          <div className={`absolute ${arrowBase} -right-[7px] top-1/2 -translate-y-1/2 border-t border-r ${borderClass}`} />
          <div className="absolute -right-[1px] top-1/2 -translate-y-1/2 w-[2px] h-[11px] bg-card pointer-events-none z-10" />
        </>
      );
    case 'bottom':
      return (
        <>
          <div className={`absolute ${arrowBase} -top-[7px] left-1/2 -translate-x-1/2 border-l border-t ${borderClass}`} />
          <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 h-[2px] w-[11px] bg-card pointer-events-none z-10" />
        </>
      );
    case 'top':
      return (
        <>
          <div className={`absolute ${arrowBase} -bottom-[7px] left-1/2 -translate-x-1/2 border-b border-r ${borderClass}`} />
          <div className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 h-[2px] w-[11px] bg-card pointer-events-none z-10" />
        </>
      );
  }
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipArrow, TooltipCalloutArrow, TooltipProvider };
