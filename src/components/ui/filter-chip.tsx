import { cn } from "@/lib/utils";

export interface FilterChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

export const FilterChip = ({
  selected,
  className,
  children,
  ...props
}: FilterChipProps) => {
  return (
    <button
      type="button"
      className={cn(
        "ds-chip ds-text-11 px-2 md:px-2.5 rounded-md font-medium transition-colors",
        selected
          ? "bg-card text-foreground shadow-sm border border-[rgb(var(--ds-brand-magenta-rgb))]"
          : "bg-card/50 text-muted-foreground border border-border/40 hover:text-foreground hover:bg-card/80",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
