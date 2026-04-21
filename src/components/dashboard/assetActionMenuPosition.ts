export interface PopoverRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ComputePopoverPositionInput {
  triggerRect: PopoverRect;
  popoverWidth: number;
  popoverHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Gap between trigger and popover, in px. */
  margin?: number;
  /** Minimum distance from the viewport edge, in px. */
  edgePadding?: number;
}

export interface PopoverPosition {
  top: number;
  left: number;
  placement: 'below' | 'above';
}

/**
 * Pure positioning logic for the desktop popover used by `AssetActionMenu`.
 * Anchored to the **center** of the trigger horizontally and placed below by
 * default; flips above only when there is not enough room below **and** there
 * is enough room above.
 *
 * Keeping this as a plain module (no React) so it can be unit-tested without a
 * DOM and so the consumer file remains component-only (lint: react-refresh).
 */
export function computePopoverPosition({
  triggerRect,
  popoverWidth,
  popoverHeight,
  viewportWidth,
  viewportHeight,
  margin = 6,
  edgePadding = 8,
}: ComputePopoverPositionInput): PopoverPosition {
  const triggerCenter = triggerRect.left + triggerRect.width / 2;
  let left = Math.round(triggerCenter - popoverWidth / 2);
  const maxLeft = viewportWidth - edgePadding - popoverWidth;
  if (left > maxLeft) left = maxLeft;
  if (left < edgePadding) left = edgePadding;

  const spaceBelow = viewportHeight - edgePadding - (triggerRect.bottom + margin);
  const spaceAbove = triggerRect.top - margin - edgePadding;
  const fitsBelow = spaceBelow >= popoverHeight;
  const fitsAbove = spaceAbove >= popoverHeight;

  let top: number;
  let placement: 'below' | 'above';
  if (fitsBelow || !fitsAbove) {
    placement = 'below';
    top = triggerRect.bottom + margin;
    const maxTop = viewportHeight - edgePadding - popoverHeight;
    if (top > maxTop) top = Math.max(edgePadding, maxTop);
  } else {
    placement = 'above';
    top = triggerRect.top - margin - popoverHeight;
    if (top < edgePadding) top = edgePadding;
  }

  return { top, left, placement };
}
