import { ArrowUp, ArrowDown, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useCallback } from 'react';

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

interface ReservesTableFloatingScrollProps {
  tableInView: boolean;
  variant: 'desktop' | 'mobile';
  onScrollToTop: () => void;
  onScrollToBottom: () => void;
  onRefresh?: () => Promise<void>;
}

export function ReservesTableFloatingScroll({
  tableInView,
  variant,
  onScrollToTop,
  onScrollToBottom,
  onRefresh,
}: ReservesTableFloatingScrollProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const wrapperClass =
    variant === 'desktop'
      ? 'fixed right-3 bottom-6 z-30 flex flex-col gap-2 md:right-6'
      : 'fixed right-3 bottom-6 z-30 flex flex-col gap-2';

  const btnClass =
    'flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/90 shadow-md backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors';

  return (
    <div className={wrapperClass}>
      <button type="button" aria-label="Scroll to table top" onClick={onScrollToTop} className={btnClass}>
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Refresh data"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`${btnClass} ${isRefreshing ? 'pointer-events-none opacity-60' : ''}`}
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
      <button type="button" aria-label="Scroll to table bottom" onClick={onScrollToBottom} className={btnClass}>
        <ArrowDown className="h-4 w-4" />
      </button>
    </div>
  );
}
