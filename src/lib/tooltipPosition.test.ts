import { describe, expect, it } from 'vitest';

import { adjustTooltipAnchorForScroll } from './tooltipPosition';

describe('adjustTooltipAnchorForScroll', () => {
  it('keeps anchor unchanged when scroll has not moved', () => {
    const result = adjustTooltipAnchorForScroll({
      position: { x: 320, y: 180 },
      triggerCenterX: 360,
      openedAtScroll: { x: 0, y: 240 },
      currentScroll: { x: 0, y: 240 },
    });

    expect(result.position).toEqual({ x: 320, y: 180 });
    expect(result.triggerCenterX).toBe(360);
  });

  it('moves tooltip anchor with vertical and horizontal window scroll', () => {
    const result = adjustTooltipAnchorForScroll({
      position: { x: 400, y: 260 },
      triggerCenterX: 460,
      openedAtScroll: { x: 10, y: 100 },
      currentScroll: { x: 35, y: 180 },
    });

    expect(result.position).toEqual({ x: 375, y: 180 });
    expect(result.triggerCenterX).toBe(435);
  });
});
