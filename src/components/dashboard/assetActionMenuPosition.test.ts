import { describe, expect, it } from 'vitest';
import { computePopoverPosition, type PopoverRect } from './assetActionMenuPosition';

/**
 * All tests target the pure `computePopoverPosition` function. The previous
 * implementation right-aligned the popover to the trigger and used a fixed
 * 180px height estimate which caused two regressions:
 *   1. Narrow triggers (~12px icon) produced a popover shifted ~220px to the
 *      left of the click — often clamped to the viewport edge.
 *   2. When flipping above, the popover was placed using the **estimated**
 *      height; if the actual height was smaller a visible gap appeared
 *      between the popover and the trigger.
 *
 * These tests lock in the centered anchor + measured-height behaviour.
 */

const POPOVER_W = 220;
const POPOVER_H = 140;
const VIEWPORT_W = 1440;
const VIEWPORT_H = 900;

function triggerAt(left: number, top: number, size = 12): PopoverRect {
  return {
    left,
    top,
    right: left + size,
    bottom: top + size,
    width: size,
    height: size,
  };
}

describe('computePopoverPosition', () => {
  it('centers horizontally on the trigger when there is room', () => {
    const trigger = triggerAt(600, 300);
    const { left, placement } = computePopoverPosition({
      triggerRect: trigger,
      popoverWidth: POPOVER_W,
      popoverHeight: POPOVER_H,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });
    const triggerCenter = trigger.left + trigger.width / 2;
    const popoverCenter = left + POPOVER_W / 2;
    expect(Math.abs(popoverCenter - triggerCenter)).toBeLessThanOrEqual(1);
    expect(placement).toBe('below');
  });

  it('clamps left to edgePadding when trigger is near the viewport left edge', () => {
    // Previous logic would anchor right-edge of popover to right-edge of
    // trigger, producing an unexpected far-left position for a narrow icon.
    const trigger = triggerAt(20, 300);
    const { left } = computePopoverPosition({
      triggerRect: trigger,
      popoverWidth: POPOVER_W,
      popoverHeight: POPOVER_H,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });
    expect(left).toBe(8);
  });

  it('clamps left when trigger is near the viewport right edge', () => {
    const trigger = triggerAt(VIEWPORT_W - 30, 300);
    const { left } = computePopoverPosition({
      triggerRect: trigger,
      popoverWidth: POPOVER_W,
      popoverHeight: POPOVER_H,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });
    expect(left).toBe(VIEWPORT_W - 8 - POPOVER_W);
  });

  it('places the popover below the trigger when there is room', () => {
    const trigger = triggerAt(600, 200);
    const { top, placement } = computePopoverPosition({
      triggerRect: trigger,
      popoverWidth: POPOVER_W,
      popoverHeight: POPOVER_H,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });
    expect(placement).toBe('below');
    expect(top).toBe(trigger.bottom + 6);
  });

  it('flips above when there is not enough room below', () => {
    const trigger = triggerAt(600, VIEWPORT_H - 40);
    const { top, placement } = computePopoverPosition({
      triggerRect: trigger,
      popoverWidth: POPOVER_W,
      popoverHeight: POPOVER_H,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });
    expect(placement).toBe('above');
    // When flipped, the popover's bottom edge sits exactly `margin` px above
    // the trigger's top edge — no gap.
    const popoverBottom = top + POPOVER_H;
    expect(trigger.top - popoverBottom).toBe(6);
  });

  it('uses the measured popover height on the flipped-above pass (no gap)', () => {
    const trigger = triggerAt(600, VIEWPORT_H - 40);

    // First pass: estimated (larger) height.
    const first = computePopoverPosition({
      triggerRect: trigger,
      popoverWidth: POPOVER_W,
      popoverHeight: 180,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });

    // Second pass: real (smaller) measured height.
    const measured = 128;
    const second = computePopoverPosition({
      triggerRect: trigger,
      popoverWidth: POPOVER_W,
      popoverHeight: measured,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });

    // The corrected pass moves the popover down (top increases) so its bottom
    // edge hugs the trigger — eliminating the ~52px gap the old code had.
    expect(second.placement).toBe('above');
    expect(second.top).toBeGreaterThan(first.top);
    expect(second.top + measured).toBe(trigger.top - 6);
  });

  it('stays below (clamped) when neither above nor below have room', () => {
    const trigger = triggerAt(600, 10);
    const tallPopover = VIEWPORT_H; // bigger than the viewport on purpose
    const { top, placement } = computePopoverPosition({
      triggerRect: trigger,
      popoverWidth: POPOVER_W,
      popoverHeight: tallPopover,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });
    expect(placement).toBe('below');
    expect(top).toBe(8);
  });

  it('never produces a negative left value', () => {
    const trigger = triggerAt(0, 300, 1);
    const { left } = computePopoverPosition({
      triggerRect: trigger,
      popoverWidth: POPOVER_W,
      popoverHeight: POPOVER_H,
      viewportWidth: 100, // extreme narrow viewport
      viewportHeight: VIEWPORT_H,
    });
    expect(left).toBeGreaterThanOrEqual(8);
  });

  it('centers correctly for a wide trigger (no off-by-one from rounding)', () => {
    const trigger = triggerAt(500, 300, 41);
    const { left } = computePopoverPosition({
      triggerRect: trigger,
      popoverWidth: POPOVER_W,
      popoverHeight: POPOVER_H,
      viewportWidth: VIEWPORT_W,
      viewportHeight: VIEWPORT_H,
    });
    const triggerCenter = trigger.left + trigger.width / 2;
    const popoverCenter = left + POPOVER_W / 2;
    expect(Math.abs(popoverCenter - triggerCenter)).toBeLessThanOrEqual(1);
  });
});
