import { ArrowUp, ArrowDown, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';

interface ReservesTableShowMoreProps {
  totalCount: number;
  displayCount: number;
  showAll: boolean;
  defaultVisibleCount: number;
  /** Whether desktop wrapper (with border-t) or mobile (no wrapper) */
  variant: 'desktop' | 'mobile';
  onShowAll: () => void;
  onShowLess: () => void;
}

export function ReservesTableShowMore({
  totalCount,
  displayCount,
  showAll,
  defaultVisibleCount,
  variant,
  onShowAll,
  onShowLess,
}: ReservesTableShowMoreProps) {
  const hasMore = totalCount > displayCount;
  const canShowLess = showAll && totalCount > defaultVisibleCount;

  if (!hasMore && !canShowLess) return null;

  const isDesktop = variant === 'desktop';
  const buttonBg = isDesktop ? 'bg-muted/30' : 'bg-card';
  const buttonBase = `w-full ds-button ds-text-14 md:ds-text-16 gap-[var(--ds-space-2)] border border-border ${buttonBg} hover:bg-muted/50 transition-colors text-foreground font-semibold`;
  const mobileMargin = isDesktop ? '' : ' mt-[var(--ds-space-4)]';

  const wrapDesktop = (children: React.ReactNode) =>
    isDesktop ? (
      <div className="p-[var(--ds-space-4)] border-t border-border">{children}</div>
    ) : (
      children
    );

  return (
    <>
      {hasMore &&
        wrapDesktop(
          <button type="button" onClick={onShowAll} className={`${buttonBase}${mobileMargin}`}>
            <span>{`Show ${totalCount - displayCount} More Reserves`}</span>
            <ChevronDown className="w-4 h-4" />
          </button>,
        )}
      {canShowLess &&
        wrapDesktop(
          <button type="button" onClick={onShowLess} className={`${buttonBase}${mobileMargin}`}>
            <span>Show Less</span>
            <ChevronUp className="w-4 h-4" />
          </button>,
        )}
    </>
  );
}

/** Max age in seconds before data is considered fully stale for the visual indicator. */
const FRESHNESS_MAX_AGE_S = 60;

function useDataAge(dataUpdatedAt?: number) {
  const [ageS, setAgeS] = useState(0);

  useEffect(() => {
    if (!dataUpdatedAt) return;
    const update = () => setAgeS(Math.floor((Date.now() - dataUpdatedAt) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [dataUpdatedAt]);

  return ageS;
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

interface ReservesTableFloatingScrollProps {
  tableInView: boolean;
  variant: 'desktop' | 'mobile';
  onScrollToTop: () => void;
  onScrollToBottom: () => void;
  onRefresh?: () => Promise<void>;
  dataUpdatedAt?: number;
}

export function ReservesTableFloatingScroll({
  tableInView,
  variant,
  onScrollToTop,
  onScrollToBottom,
  onRefresh,
  dataUpdatedAt,
}: ReservesTableFloatingScrollProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const ageS = useDataAge(dataUpdatedAt);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  if (!tableInView) return null;

  return (
    <div className={wrapperClass}>
      <button type="button" aria-label="Scroll to table top" onClick={onScrollToTop} className={btnClass}>
        <ArrowUp className="h-4 w-4" />
      </button>
      <div className="group relative">
        <button
          type="button"
          aria-label={`Refresh data (updated ${formatAge(ageS)})`}
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`${btnClass} ${isRefreshing ? 'pointer-events-none opacity-60' : ''}`}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
        {/* Hover tooltip showing age */}
        {dataUpdatedAt != null && (
          <div className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-card border border-border/60 px-2 py-1 text-xs text-muted-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {formatAge(ageS)}
          </div>
        )}
      </div>
      <button type="button" aria-label="Scroll to table bottom" onClick={onScrollToBottom} className={btnClass}>
        <ArrowDown className="h-4 w-4" />
      </button>
    </div>
  );
}
