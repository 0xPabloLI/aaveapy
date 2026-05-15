import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

interface UseReserveExpansionOptions {
  /**
   * Drives the mobile→desktop transition cleanup. When `isMobile` flips
   * from `true` to `false` while a row is expanded, the row collapses
   * (mobile cards use a 2x2 layout that doesn't translate to desktop
   * table rows).
   */
  isMobile: boolean;
}

export interface UseReserveExpansionResult {
  expandedReserveId: string | null;
  setExpandedReserveId: Dispatch<SetStateAction<string | null>>;
  /**
   * Collapse the currently expanded row, if any. Stable identity — wired
   * into the sort hook's `collapseExpanded` so any column-sort change
   * closes the open row first.
   */
  collapseExpanded: () => void;
  /**
   * Click-handler factory for "expand / collapse this row". Honours the
   * `suppressNextToggleReserveIdRef` latch so external callers can stage
   * a toggle that the next click on the same row will swallow.
   */
  handleToggleExpand: (reserveId: string) => void;
  /**
   * Mutable ref consumers can tag with a reserveId whose next
   * `handleToggleExpand` call should be ignored. The ref auto-clears
   * after the suppressed click and whenever expansion drops to `null`.
   */
  suppressNextToggleReserveIdRef: MutableRefObject<string | null>;
}

/**
 * Owns the "which row is currently expanded?" state plus the two
 * cleanup behaviours that belong to it: clearing the toggle-suppression
 * latch when nothing is expanded, and collapsing on mobile→desktop
 * viewport transitions.
 */
export function useReserveExpansion(
  { isMobile }: UseReserveExpansionOptions,
): UseReserveExpansionResult {
  const [expandedReserveId, setExpandedReserveId] = useState<string | null>(null);
  const suppressNextToggleReserveIdRef = useRef<string | null>(null);

  const collapseExpanded = useCallback(() => {
    setExpandedReserveId(null);
  }, []);

  const handleToggleExpand = useCallback((reserveId: string) => {
    if (suppressNextToggleReserveIdRef.current === reserveId) {
      suppressNextToggleReserveIdRef.current = null;
      return;
    }
    setExpandedReserveId((prev) => (prev === reserveId ? null : reserveId));
  }, []);

  // When expansion drops to null, the suppression latch is no longer
  // meaningful — clear it so a future toggle is not accidentally swallowed.
  useEffect(() => {
    if (!expandedReserveId) {
      suppressNextToggleReserveIdRef.current = null;
    }
  }, [expandedReserveId]);

  // Collapse expanded rows when switching from mobile to desktop. Mobile
  // cards use a different layout (2x2 grid) that doesn't translate to
  // desktop table rows.
  const prevIsMobileRef = useRef(isMobile);
  useEffect(() => {
    if (prevIsMobileRef.current && !isMobile && expandedReserveId) {
      setExpandedReserveId(null);
      suppressNextToggleReserveIdRef.current = null;
    }
    prevIsMobileRef.current = isMobile;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  return {
    expandedReserveId,
    setExpandedReserveId,
    collapseExpanded,
    handleToggleExpand,
    suppressNextToggleReserveIdRef,
  };
}
