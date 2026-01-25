import { Skeleton } from '@/components/ui/skeleton';

const LoadingState = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-secondary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 container mx-auto px-[var(--ds-space-3)] md:px-[var(--ds-space-4)] py-[var(--ds-space-4)] md:py-[var(--ds-space-8)] space-y-4 md:space-y-8">
        {/* Header Skeleton */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-[var(--ds-space-3)] md:gap-[var(--ds-space-4)]">
          <div className="flex items-center gap-[var(--ds-space-3)] md:gap-[var(--ds-space-4)]">
            <Skeleton className="w-12 h-12 md:w-16 md:h-16 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 md:h-8 w-32 md:w-48" />
              <Skeleton className="h-3 md:h-4 w-40 md:w-64" />
            </div>
          </div>
          <div className="hidden md:flex items-center gap-[var(--ds-space-2)]">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
        </header>

        {/* Top Opportunities Skeleton - 2x2 on mobile/tablet, 4 columns on xl */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-[var(--ds-space-3)] md:gap-[var(--ds-space-4)]">
          {[0, 1, 2, 3].map((cardIndex) => (
            <div key={cardIndex} className="glass-card rounded-xl ds-card-pad-sm md:ds-card-pad">
              <div className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-3)]">
                <Skeleton className="w-8 h-8 md:w-9 md:h-9 rounded-lg" />
                <div className="space-y-1 flex-1 min-w-0">
                  <Skeleton className="h-4 md:h-5 w-20 md:w-28" />
                  <Skeleton className="h-2.5 md:h-3 w-24 md:w-36" />
                </div>
              </div>
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between px-[var(--ds-space-2-5)] md:px-[var(--ds-space-3)] h-14 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-[var(--ds-space-2)]">
                      <Skeleton className="w-7 h-7 md:w-8 md:h-8 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 md:h-4 w-10 md:w-14" />
                        <div className="flex items-center gap-[var(--ds-space-1)]">
                          <Skeleton className="w-3 h-3 rounded-full" />
                          <Skeleton className="h-2.5 w-8 md:w-12" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-[var(--ds-space-1)]">
                      <Skeleton className="h-4 md:h-5 w-12 md:w-16" />
                      <Skeleton className="h-2.5 md:h-3 w-14 md:w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Filter Bar Skeleton */}
        <div className="space-y-3">
          {/* Row 1: Category Tabs */}
          <div className="flex flex-wrap items-center gap-[var(--ds-space-2)]">
            <Skeleton className="h-4 w-12" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-md" />
            ))}
            <div className="flex-1" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>

          {/* Row 2: Market Tags */}
          <div className="flex flex-wrap items-center gap-[var(--ds-space-2)]">
            <Skeleton className="h-4 w-16" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-md" />
            ))}
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
        </div>

        {/* Pools Cards Skeleton (Mobile) */}
        <div className="md:hidden space-y-3">
          <div className="flex justify-between items-center px-[var(--ds-space-1)]">
            <Skeleton className="h-5 w-20" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border/60 ds-card-pad-sm">
              <div className="flex items-center justify-between mb-[var(--ds-space-3)]">
                <div className="flex items-center gap-[var(--ds-space-3)]">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="w-5 h-5 rounded" />
              </div>
              <div className="grid grid-cols-3 gap-[var(--ds-space-3)]">
                <div className="space-y-1">
                  <Skeleton className="h-2 w-10" />
                  <Skeleton className="h-5 w-14" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-2 w-10" />
                  <Skeleton className="h-5 w-14" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-2 w-10" />
                  <Skeleton className="h-5 w-14" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pools Table Skeleton (Desktop) */}
        <div className="hidden md:block glass-card rounded-xl overflow-hidden">
          <div className="p-[var(--ds-space-4)] md:p-[var(--ds-space-6)] border-b border-border/50">
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="h-12 px-[var(--ds-space-6)] text-left">
                    <Skeleton className="h-4 w-12" />
                  </th>
                  <th className="h-12 px-[var(--ds-space-6)] text-left">
                    <Skeleton className="h-4 w-16" />
                  </th>
                  <th className="h-12 px-[var(--ds-space-6)] text-right">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </th>
                  <th className="h-12 px-[var(--ds-space-6)] text-right">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </th>
                  <th className="h-12 px-[var(--ds-space-6)] text-right">
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-[var(--ds-space-4)] px-[var(--ds-space-6)]">
                      <div className="flex items-center gap-[var(--ds-space-3)]">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-4 w-14" />
                      </div>
                    </td>
                    <td className="py-[var(--ds-space-4)] px-[var(--ds-space-6)]">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </td>
                    <td className="py-[var(--ds-space-4)] px-[var(--ds-space-6)]">
                      <div className="flex flex-col items-end gap-[var(--ds-space-1)]">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </td>
                    <td className="py-[var(--ds-space-4)] px-[var(--ds-space-6)]">
                      <div className="flex flex-col items-end gap-[var(--ds-space-1)]">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </td>
                    <td className="py-[var(--ds-space-4)] px-[var(--ds-space-6)]">
                      <Skeleton className="h-5 w-16 ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingState;
