export interface ScrollPoint {
  x: number;
  y: number;
}

export interface TooltipAnchor {
  position: { x: number; y: number };
  triggerCenterX: number;
}

interface AdjustTooltipAnchorForScrollInput {
  position: { x: number; y: number };
  triggerCenterX: number;
  openedAtScroll: ScrollPoint;
  currentScroll: ScrollPoint;
}

export const getWindowScroll = (): ScrollPoint => ({
  x: typeof window === 'undefined' ? 0 : window.scrollX,
  y: typeof window === 'undefined' ? 0 : window.scrollY,
});

export const adjustTooltipAnchorForScroll = ({
  position,
  triggerCenterX,
  openedAtScroll,
  currentScroll,
}: AdjustTooltipAnchorForScrollInput): TooltipAnchor => {
  const scrollDeltaX = currentScroll.x - openedAtScroll.x;
  const scrollDeltaY = currentScroll.y - openedAtScroll.y;

  return {
    position: {
      x: position.x - scrollDeltaX,
      y: position.y - scrollDeltaY,
    },
    triggerCenterX: triggerCenterX - scrollDeltaX,
  };
};
