import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Measures how many items with `[data-overflow-index]` fit on the first row
 * of a flex-wrap container, reserving space for a "+N" overflow button.
 *
 * @param containerRef  ref to the flex-wrap container
 * @param totalCount    total number of items
 * @param expanded      whether the container is fully expanded (skip measuring)
 * @returns { visibleCount, isMeasuring }
 */
export function useOverflowCount(
  containerRef: React.RefObject<HTMLDivElement | null>,
  totalCount: number,
  expanded: boolean,
) {
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const pills = container.querySelectorAll<HTMLElement>('[data-overflow-index]');
    if (pills.length === 0) return;

    const firstRowTop = pills[0].getBoundingClientRect().top;

    let fitCount = 0;
    for (let i = 0; i < pills.length; i++) {
      if (pills[i].getBoundingClientRect().top > firstRowTop + 4) break;
      fitCount = i + 1;
    }

    if (fitCount < totalCount) {
      setVisibleCount(Math.max(1, fitCount - 1)); // reserve space for "+N" button
    } else {
      setVisibleCount(totalCount);
    }
  }, [totalCount, containerRef]);

  // Reset to measuring when totalCount changes or collapse
  useLayoutEffect(() => {
    if (expanded || totalCount === 0) return;
    setVisibleCount(null);
  }, [totalCount, expanded]);

  // Measure after rendering all items
  useEffect(() => {
    if (visibleCount !== null || expanded) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(measure);
    });
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [visibleCount, expanded, measure]);

  // Re-measure on container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container || expanded) return;
    let timeout: NodeJS.Timeout | null = null;
    const ro = new ResizeObserver(() => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setVisibleCount(null), 100);
    });
    ro.observe(container);
    return () => { ro.disconnect(); if (timeout) clearTimeout(timeout); };
  }, [expanded, containerRef]);

  const isMeasuring = visibleCount === null && !expanded;
  const effectiveCount = visibleCount ?? totalCount;

  return { visibleCount: effectiveCount, isMeasuring };
}
