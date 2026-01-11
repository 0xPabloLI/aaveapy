import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const LoadingState = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="fixed top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-secondary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* Header Skeleton */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
        </header>

        {/* Top Opportunities Skeleton */}
        <div className="grid md:grid-cols-2 gap-6">
          {[0, 1].map((cardIndex) => (
            <div key={cardIndex} className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-6 h-6 rounded" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Filter Bar Skeleton */}
        <div className="space-y-4">
          {/* Row 1: Search + APY Toggle */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 flex-1 max-w-xs rounded-lg" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-4 w-8 rounded" />
              <Skeleton className="h-5 w-10 rounded-full" />
              <Skeleton className="h-4 w-8 rounded" />
            </div>
        </div>

          {/* Row 2: Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-4 w-12" />
          {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-md" />
          ))}
        </div>

          {/* Row 3: Market Tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-4 w-16" />
          {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-md" />
            ))}
          </div>
        </div>

        {/* Markets Table Skeleton */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="h-10 px-2">
                    <Skeleton className="h-4 w-12" />
                  </TableHead>
                  <TableHead className="h-10 px-2 hidden md:table-cell">
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                  <TableHead className="h-10 px-2">
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                  <TableHead className="h-10 px-2">
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                  <TableHead className="h-10 px-2 hidden md:table-cell">
                    <Skeleton className="h-4 w-12" />
                  </TableHead>
                  <TableHead className="h-10 px-1 w-8 md:hidden" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TableRow 
              key={i} 
                    className="border-b border-border/30"
              style={{ animationDelay: `${i * 50}ms` }}
            >
                    <TableCell className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-7 h-7 rounded-full" />
                  <div className="space-y-1">
                          <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-2 px-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell className="py-2 px-2">
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell className="py-2 px-2">
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell py-2 px-2">
                <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell className="md:hidden py-2 px-1 w-8">
                      <Skeleton className="w-4 h-4 rounded" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingState;
