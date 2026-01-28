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
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      // 移动端统一从下往上弹出，避免左右滑动带来的“拉伸”感
      side={isMobile ? "bottom" : side}
      className={cn(
        "z-50 overflow-hidden rounded-md border bg-popover px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] ds-text-14 text-popover-foreground shadow-md",
        isMobile ? mobileAnimationClasses : desktopAnimationClasses,
        className,
      )}
      {...props}
    />
  );
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
