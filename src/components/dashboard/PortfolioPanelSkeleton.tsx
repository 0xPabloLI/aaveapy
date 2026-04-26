/**
 * PortfolioPanelSkeleton — lightweight placeholder shown while reserves
 * data is still loading. Mirrors the real PortfolioPanel chrome (header
 * with Batch title + action buttons, search input, empty state) so that
 * toggling Batch on does not produce a blank flash or layout jump.
 */
import { memo } from 'react';
import { Layers, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import { BATCH_THEME } from './batchTheme';

const PortfolioPanelSkeleton = memo(function PortfolioPanelSkeleton() {
  const isMobile = useIsMobile();
  return (
    <div className="space-y-3">
      <div
        className={cn(
          'rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm',
          isMobile ? 'px-2.5 py-2.5' : 'px-4 py-3',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Layers className={`size-4 ${BATCH_THEME.text}`} aria-hidden />
            <span className="ds-text-14 font-semibold text-foreground">Batch</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="rounded-md p-1.5 text-muted-foreground/60">
              <Search className="size-3.5" aria-hidden />
            </div>
          </div>
        </div>

        {/* Search input placeholder */}
        <Skeleton variant="subtle" className="h-8 w-full rounded-lg mb-2.5" />

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
          <Skeleton variant="subtle" className="h-3 w-28 rounded-md" />
          <Skeleton variant="subtle" className="h-3 w-40 rounded-md opacity-70" />
        </div>
      </div>
    </div>
  );
});

export default PortfolioPanelSkeleton;
