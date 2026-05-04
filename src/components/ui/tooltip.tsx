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
        side={isMobile ? "bottom" : side}
        className={cn(
          // group/tt lets <TooltipCalloutArrow /> auto-detect the actual rendered side
          // via group-data-[side=...]/tt variants, so it follows Radix collision flips.
          "group/tt z-50 max-w-[18rem] overflow-visible rounded-md border border-border/60 bg-card px-[var(--ds-space-3)] py-[var(--ds-space-1-5)] ds-text-14 leading-tight text-foreground shadow-sm duration-200",
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

/**
 * Callout arrow that integrates seamlessly with the TooltipContent border.
 *
 * Implementation:
 * - Uses an SVG path with separate fill (closed triangle) + stroke (only the two
 *   outward edges, so the base of the triangle is "open" and there's no seam where
 *   the arrow joins the body).
 * - Renders all four directional arrows; only the one matching the actual rendered
 *   side becomes visible via `group-data-[side=...]/tt` variants. This means the
 *   arrow automatically follows Radix's collision-detection flip — if the tooltip
 *   flips from `right` to `left` because right-side viewport space is insufficient,
 *   the arrow flips along with it.
 * - The `side` prop is kept only for API back-compat and as a documentation hint.
 *   It is intentionally ignored at render time.
 */
const TooltipCalloutArrow = (_props: { side?: 'top' | 'bottom' | 'left' | 'right' }) => {
  const fill = 'hsl(var(--card))';
  const stroke = 'hsl(var(--border) / 0.6)';
  const commonStrokeProps = {
    stroke,
    strokeWidth: '1',
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };
  // Each arrow is positioned with a tiny overlap into the body (left/right/top/bottom: -8px on a 9-deep arrow)
  // so the body's 1px border at the arrow's base is hidden inside the body — eliminating any visible seam.

  return (
    <>
      {/* tooltip on right of trigger → arrow points left (sits on body's left edge) */}
      <svg
        className="hidden group-data-[side=right]/tt:block absolute left-[-8px] top-1/2 -translate-y-1/2 pointer-events-none z-20"
        width="9"
        height="16"
        viewBox="0 0 9 16"
        aria-hidden
      >
        <path d="M9 0 L0 8 L9 16 Z" fill={fill} />
        <path d="M9 0 L0 8 L9 16" {...commonStrokeProps} />
      </svg>

      {/* tooltip on left of trigger → arrow points right (sits on body's right edge) */}
      <svg
        className="hidden group-data-[side=left]/tt:block absolute right-[-8px] top-1/2 -translate-y-1/2 pointer-events-none z-20"
        width="9"
        height="16"
        viewBox="0 0 9 16"
        aria-hidden
      >
        <path d="M0 0 L9 8 L0 16 Z" fill={fill} />
        <path d="M0 0 L9 8 L0 16" {...commonStrokeProps} />
      </svg>

      {/* tooltip below trigger → arrow points up (sits on body's top edge) */}
      <svg
        className="hidden group-data-[side=bottom]/tt:block absolute top-[-8px] left-1/2 -translate-x-1/2 pointer-events-none z-20"
        width="16"
        height="9"
        viewBox="0 0 16 9"
        aria-hidden
      >
        <path d="M0 9 L8 0 L16 9 Z" fill={fill} />
        <path d="M0 9 L8 0 L16 9" {...commonStrokeProps} />
      </svg>

      {/* tooltip above trigger → arrow points down (sits on body's bottom edge) */}
      <svg
        className="hidden group-data-[side=top]/tt:block absolute bottom-[-8px] left-1/2 -translate-x-1/2 pointer-events-none z-20"
        width="16"
        height="9"
        viewBox="0 0 16 9"
        aria-hidden
      >
        <path d="M0 0 L8 9 L16 0 Z" fill={fill} />
        <path d="M0 0 L8 9 L16 0" {...commonStrokeProps} />
      </svg>
    </>
  );
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipArrow, TooltipCalloutArrow, TooltipProvider };
