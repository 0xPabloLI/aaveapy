import { Skeleton } from '@/components/ui/skeleton';

const LoadingState = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-secondary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 container mx-auto px-3 md:px-4 py-4 md:py-8 space-y-4 md:space-y-8">
        {/* Header Skeleton */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <Skeleton className="w-12 h-12 md:w-16 md:h-16 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 md:h-8 w-32 md:w-48" />
              <Skeleton className="h-3 md:h-4 w-40 md:w-64" />
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
        </header>

        {/* Top Opportunities Skeleton - 4 cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[0, 1, 2, 3].map((cardIndex) => (
            <div key={cardIndex} className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-5 h-5 rounded" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-14" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-3 w-20" />
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
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-4 w-12" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-md" />
            ))}
            <div className="flex-1" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>

          {/* Row 2: Market Tags */}
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-4 w-16" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-md" />
            ))}
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
        </div>

        {/* Pools Cards Skeleton (Mobile) */}
        <div className="md:hidden space-y-3">
          <div className="flex justify-between items-center px-1">
            <Skeleton className="h-5 w-20" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="w-5 h-5 rounded" />
              </div>
              <div className="grid grid-cols-3 gap-3">
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
          <div className="p-4 md:p-6 border-b border-border/50">
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="h-12 px-6 text-left">
                    <Skeleton className="h-4 w-12" />
                  </th>
                  <th className="h-12 px-6 text-left">
                    <Skeleton className="h-4 w-16" />
                  </th>
                  <th className="h-12 px-6 text-right">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </th>
                  <th className="h-12 px-6 text-right">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </th>
                  <th className="h-12 px-6 text-right">
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-4 w-14" />
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col items-end gap-1">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col items-end gap-1">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </td>
                    <td className="py-4 px-6">
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
