import { Skeleton } from '@/components/ui/skeleton';

const LoadingState = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-secondary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 py-6 md:py-8 space-y-4 md:space-y-6">
        {/* Header Skeleton */}
        <header className="glass-card rounded-2xl p-3 md:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 md:w-12 md:h-12 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 md:h-6 w-32 md:w-40" />
                <Skeleton className="h-3 w-24 hidden sm:block" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-16 md:w-20 rounded-lg" />
              <Skeleton className="h-7 w-16 md:w-20 rounded-lg" />
            </div>
          </div>
        </header>

        {/* Top Opportunities Skeleton */}
        <div className="grid md:grid-cols-2 gap-4">
          {[0, 1].map((cardIndex) => (
            <div key={cardIndex} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/30"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-6 h-6 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-14" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-14" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Filter Bar Skeleton */}
        <div className="glass-card rounded-xl p-3 md:p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-[150px] md:w-[200px] rounded-md" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-6 w-14 rounded-md" />
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-6 w-16 rounded-md" />
            ))}
          </div>
        </div>

        {/* Results Count Skeleton */}
        <Skeleton className="h-4 w-28" />

        {/* Mobile: Card Skeletons */}
        <div className="md:hidden space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div 
              key={i} 
              className="glass-card rounded-lg p-3 space-y-2.5"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="bg-background/50 rounded-md p-2">
                    <Skeleton className="h-2.5 w-10 mx-auto mb-1" />
                    <Skeleton className="h-5 w-12 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: Table Skeleton */}
        <div className="hidden md:block glass-card rounded-xl overflow-hidden">
          <div className="p-1">
            {/* Table Header */}
            <div className="flex items-center gap-4 px-3 py-2.5 border-b border-border/50">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14 ml-12" />
              <Skeleton className="h-4 w-14 ml-auto" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-14" />
            </div>
            {/* Table Rows */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div 
                key={i} 
                className="flex items-center gap-4 px-3 py-2.5 border-b border-border/30"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full ml-4" />
                <Skeleton className="h-5 w-12 ml-auto" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-14" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingState;
