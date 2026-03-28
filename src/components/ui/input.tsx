import * as React from "react";

import { cn } from "@/lib/utils";
import { cnDsInputSurface } from "@/lib/dsInputSurface";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, ...props }, ref) => {
    const hasValue =
      value !== undefined && value !== null && String(value).trim().length > 0;
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full px-[var(--ds-space-3)] py-[var(--ds-space-2)] ds-text-16 ring-offset-background file:border-0 file:bg-transparent file:ds-text-14 file:font-medium file:text-foreground disabled:cursor-not-allowed disabled:opacity-50 md:ds-text-14",
          cnDsInputSurface(hasValue, "neutral"),
          className,
        )}
        ref={ref}
        value={value}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
