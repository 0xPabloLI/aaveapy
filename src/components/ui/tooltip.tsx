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
 * Shared arrow SVG paths (filled triangle + stroke on the two outward edges).
 * Reused by both the Radix-based `TooltipCalloutArrow` and the manually-positioned
 * `IncentiveTooltip` desktop popover. The `direction` prop determines which way
 * the point faces (the base of the triangle is opposite). When rendered inside a
 * Radix `TooltipContent`, it uses `group-data` to auto-flip; elsewhere the caller
 * controls orientation through rotation/scaling.
 */
export function CalloutArrowSvg({
  fill = 'hsl(var(--card))',
  stroke = 'hsl(var(--border) / 0.6)',
  width = 16,
  height = 9,
}: {
  fill?: string;
  stroke?: string;
  width?: number;
  height?: number;
}) {
  const points = `0 ${height} L${width / 2} 0 L${width} ${height}`;
  return (
    <>
      <path d={points} fill={fill} />
      <path d={points} stroke={stroke} strokeWidth="1" strokeLinejoin="round" fill="none" />
    </>
  );
}

/**
 * Callout arrow that integrates seamlessly with the TooltipContent border.
 *
 * Implementation:
 * - Renders four directional arrows, each using `CalloutArrowSvg` appropriately
 *   rotated. Only the one matching the actual rendered side becomes visible via
 *   `group-data-[side=...]/tt` variants, so the arrow automatically follows
 *   Radix's collision-detection flip.
 * - The `side` prop is kept only for API back-compat and as a documentation hint.
 *   It is intentionally ignored at render time.
 */
const TooltipCalloutArrow = (_props: { side?: 'top' | 'bottom' | 'left' | 'right' }) => {
  const fill = 'hsl(var(--card))';
  const stroke = 'hsl(var(--border) / 0.6)';

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
        <path d="M9 0 L0 8 L9 16" stroke={stroke} strokeWidth="1" strokeLinejoin="round" fill="none" />
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
        <path d="M0 0 L9 8 L0 16" stroke={stroke} strokeWidth="1" strokeLinejoin="round" fill="none" />
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
        <path d="M0 9 L8 0 L16 9" stroke={stroke} strokeWidth="1" strokeLinejoin="round" fill="none" />
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
        <path d="M0 0 L8 9 L16 0" stroke={stroke} strokeWidth="1" strokeLinejoin="round" fill="none" />
      </svg>
    </>
  );
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipArrow, TooltipCalloutArrow, TooltipProvider };
