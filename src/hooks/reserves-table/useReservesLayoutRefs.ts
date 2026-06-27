import { useEffect, useRef, useState } from 'react';

/**
 * Layout refs + viewport observers used by `ReservesTable` for its sticky /
 * scroll-aware UI.
 *
 * Owns:
 * - 5 DOM refs (mobile container, desktop card, desktop bottom anchor, desktop
 *   sticky scenario shell, desktop sticky thead).
 * - `tableInView` boolean, driven by an `IntersectionObserver` on the active
 *   table container (mobile vs desktop chosen via `isMobile`) with a 200px
 *   rootMargin so the floating scroll affordance reveals slightly before the
 *   table itself enters view.
 * - A `ResizeObserver` (desktop only) that publishes
 *   `--reserves-sticky-scenario-height` and
 *   `--reserves-expanded-main-row-top` CSS custom properties on the desktop
 *   card, so expanded sticky rows can offset themselves correctly. The custom
 *   props are removed on cleanup and when the thead height is unknown.
 *
 * Behavior preserved verbatim from the original inline implementation in
 * `src/components/dashboard/ReservesTable.tsx`.
 */
export interface UseReservesLayoutRefsArgs {
  isMobile: boolean;
  isPortfolioMode?: boolean;
}

export interface UseReservesLayoutRefsResult {
  mobileTableRef: React.RefObject<HTMLDivElement | null>;
  desktopTableCardRef: React.RefObject<HTMLDivElement | null>;
  desktopTableBottomAnchorRef: React.RefObject<HTMLDivElement | null>;
  desktopStickyScenarioRef: React.RefObject<HTMLDivElement | null>;
  desktopStickyTheadRef: React.RefObject<HTMLTableSectionElement | null>;
  tableInView: boolean;
}

export const useReservesLayoutRefs = ({
  isMobile,
  isPortfolioMode = false,
}: UseReservesLayoutRefsArgs): UseReservesLayoutRefsResult => {
  const mobileTableRef = useRef<HTMLDivElement>(null);
  const desktopTableCardRef = useRef<HTMLDivElement>(null);
  const desktopTableBottomAnchorRef = useRef<HTMLDivElement>(null);
  const desktopStickyScenarioRef = useRef<HTMLDivElement>(null);
  const desktopStickyTheadRef = useRef<HTMLTableSectionElement>(null);
  const [tableInView, setTableInView] = useState(false);

  useEffect(() => {
    const target = isMobile ? mobileTableRef.current : desktopTableCardRef.current;
    if (!target) return;
    const io = new IntersectionObserver(
      ([entry]) => setTableInView(entry.isIntersecting),
      { threshold: 0, rootMargin: '200px 0px 200px 0px' },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;
    const stickyEl = desktopStickyScenarioRef.current;
    const theadEl = desktopStickyTheadRef.current;
    const card = desktopTableCardRef.current;
    if (!stickyEl || !card) return undefined;
    const apply = () => {
      const measuredH = stickyEl.getBoundingClientRect().height;
      const scenarioH = isPortfolioMode ? 0 : measuredH;
      card.style.setProperty('--reserves-sticky-scenario-height', `${scenarioH}px`);
      const theadH =
        theadEl instanceof HTMLElement ? theadEl.getBoundingClientRect().height : 0;
      if (theadH > 0) {
        card.style.setProperty(
          '--reserves-expanded-main-row-top',
          `${scenarioH + theadH}px`,
        );
      } else {
        card.style.removeProperty('--reserves-expanded-main-row-top');
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(stickyEl);
    if (theadEl instanceof HTMLElement) {
      ro.observe(theadEl);
    }
    return () => {
      ro.disconnect();
      card.style.removeProperty('--reserves-sticky-scenario-height');
      card.style.removeProperty('--reserves-expanded-main-row-top');
    };
  }, [isMobile, isPortfolioMode]);

  return {
    mobileTableRef,
    desktopTableCardRef,
    desktopTableBottomAnchorRef,
    desktopStickyScenarioRef,
    desktopStickyTheadRef,
    tableInView,
  };
};
