import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'gradient';
}

function Skeleton({ className, variant = 'default', ...props }: SkeletonProps) {
  return (
    <div 
      className={cn(
        "rounded-md animate-shimmer bg-[length:400%_100%]",
        variant === 'gradient' 
          ? "bg-gradient-to-r from-primary/10 via-secondary/15 to-primary/10"
          : "bg-gradient-to-r from-muted/80 via-muted/40 to-muted/80",
        className
      )} 
      {...props} 
    />
  );
}

export { Skeleton };
