import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-[var(--ds-space-3)] py-[var(--ds-space-2)] ds-text-16 ring-offset-background file:border-0 file:bg-transparent file:ds-text-14 file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ds-brand-magenta-rgb)/0.6)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:ds-text-14",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
