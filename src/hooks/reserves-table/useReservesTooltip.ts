import { useCallback, useState } from 'react';
import type { ReserveWithSpread } from '@/types/aave';
import type { TooltipState } from '@/components/dashboard/ReservesTableTooltipOverlay';

/**
 * Encapsulates the per-row incentive tooltip state and click handler used by
 * `ReservesTable`. The handler stops event propagation, ignores no-op clicks
 * (when there is no incentive APY to show), captures the trigger's bounding
 * rect, and stores everything the overlay needs to position itself.
 *
 * Behavior preserved verbatim from the original inline implementation in
 * `src/components/dashboard/ReservesTable.tsx` — no rounding, no debouncing,
 * no extra side effects.
 */
export interface UseReservesTooltipResult {
  tooltipState: TooltipState | null;
  setTooltipState: (state: TooltipState | null) => void;
  handleIncentiveClick: (
    e: React.MouseEvent,
    reserve: ReserveWithSpread,
    type: 'supply' | 'borrow',
    apy: number | null,
  ) => void;
  closeTooltip: () => void;
}

export const useReservesTooltip = (): UseReservesTooltipResult => {
  const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);

  const handleIncentiveClick = useCallback(
    (
      e: React.MouseEvent,
      reserve: ReserveWithSpread,
      type: 'supply' | 'borrow',
      apy: number | null,
    ) => {
      e.stopPropagation();
      if (apy === null || isNaN(apy)) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const triggerCenterX = rect.left + rect.width / 2;
      setTooltipState({
        reserve,
        type,
        position: { x: rect.left, y: rect.bottom },
        triggerCenterX,
        triggerHeight: rect.height,
        triggerRect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        },
      });
    },
    [],
  );

  const closeTooltip = useCallback(() => setTooltipState(null), []);

  return { tooltipState, setTooltipState, handleIncentiveClick, closeTooltip };
};
