import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "gradient" | "subtle";
}

const variantClasses: Record<NonNullable<SkeletonProps["variant"]>, string> = {
  default:
    "bg-gradient-to-r from-muted/80 via-[rgb(var(--ds-brand-magenta-rgb)/0.11)] to-[rgb(var(--ds-brand-cyan-rgb)/0.14)] dark:from-muted/72 dark:via-[rgb(var(--ds-brand-magenta-rgb)/0.16)] dark:to-[rgb(var(--ds-brand-cyan-rgb)/0.2)] md:dark:via-[rgb(var(--ds-brand-magenta-rgb)/0.2)] md:dark:to-[rgb(var(--ds-brand-cyan-rgb)/0.24)]",
  gradient:
    "bg-gradient-to-r from-primary/15 via-[rgb(var(--ds-brand-magenta-rgb)/0.2)] to-[rgb(var(--ds-brand-cyan-rgb)/0.24)] dark:from-primary/24 dark:via-[rgb(var(--ds-brand-magenta-rgb)/0.28)] dark:to-[rgb(var(--ds-brand-cyan-rgb)/0.32)] md:dark:from-primary/28 md:dark:via-[rgb(var(--ds-brand-magenta-rgb)/0.34)] md:dark:to-[rgb(var(--ds-brand-cyan-rgb)/0.38)]",
  subtle:
    "bg-gradient-to-r from-muted/75 via-muted/55 to-[rgb(var(--ds-brand-cyan-rgb)/0.12)] dark:from-muted/62 dark:via-muted/46 dark:to-[rgb(var(--ds-brand-cyan-rgb)/0.16)] md:dark:to-[rgb(var(--ds-brand-cyan-rgb)/0.2)]",
};

function Skeleton({ className, variant = "default", ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/45 dark:border-border/75 bg-[length:280%_100%] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] motion-safe:animate-shimmer motion-safe:[animation-duration:2.4s] md:motion-safe:[animation-duration:2s] dark:motion-safe:[animation-duration:3.1s] md:dark:motion-safe:[animation-duration:2.3s] motion-reduce:animate-none",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
