const VIEW_MARGIN_PX = 16;
/** Breathing room below the stacked sticky strips (scenario + optional thead) before the body row. */
const GAP_BELOW_STICKY_STACK_PX = 8;
/** Ignore micro scroll corrections that only create visible jitter. */
const MIN_SCROLL_DELTA_PX = 10;

export type ExpandedSimulationScrollMode = 'pin-main-row-top' | 'minimal-if-clipped';

/** Y in viewport where the reserve row top should sit: below scenario strip and sticky thead when present. */
function getPinnedRowTopY(): number {
  const scenario = document.querySelector('[data-reserves-sticky-scenario]');
  const thead = document.querySelector('[data-reserves-sticky-thead]');
  let maxBottom = 0;
  if (scenario instanceof HTMLElement) {
    const b = scenario.getBoundingClientRect().bottom;
    if (Number.isFinite(b)) maxBottom = Math.max(maxBottom, b);
  }
  if (thead instanceof HTMLElement) {
    const b = thead.getBoundingClientRect().bottom;
    if (Number.isFinite(b)) maxBottom = Math.max(maxBottom, b);
  }
  if (maxBottom > 0) return maxBottom + GAP_BELOW_STICKY_STACK_PX;
  return VIEW_MARGIN_PX;
}

function getScrollBehavior(): ScrollBehavior {
  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return prefersReduced ? 'auto' : 'smooth';
}

/**
 * Mirrors the CSS.escape reference polyfill when the browser API is missing (e.g. some test runners).
 * Needed so attribute selector values cannot break querySelector parsing (backslashes, quotes, NUL, etc.).
 */
function cssEscapeFallback(value: string): string {
  const string = String(value);
  const length = string.length;
  let result = '';
  const firstCodeUnit = string.charCodeAt(0);
  for (let index = 0; index < length; index += 1) {
    const codeUnit = string.charCodeAt(index);
    if (codeUnit === 0) {
      result += '\uFFFD';
      continue;
    }
    if ((codeUnit >= 1 && codeUnit <= 0x001f) || codeUnit === 0x007f) {
      result += `\\${codeUnit.toString(16)} `;
      continue;
    }
    if (index === 0 && codeUnit >= 0x30 && codeUnit <= 0x39) {
      result += `\\${codeUnit.toString(16)} `;
      continue;
    }
    if (index === 1 && codeUnit >= 0x30 && codeUnit <= 0x39 && firstCodeUnit === 0x002d) {
      result += `\\${codeUnit.toString(16)} `;
      continue;
    }
    if (
      codeUnit >= 0x0080 ||
      codeUnit === 0x002d ||
      codeUnit === 0x005f ||
      (codeUnit >= 0x30 && codeUnit <= 0x39) ||
      (codeUnit >= 0x41 && codeUnit <= 0x5a) ||
      (codeUnit >= 0x61 && codeUnit <= 0x7a)
    ) {
      result += string.charAt(index);
      continue;
    }
    result += `\\${string.charAt(index)}`;
  }
  return result;
}

function escapeReserveId(reserveId: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(reserveId);
  }
  return cssEscapeFallback(reserveId);
}

/**
 * Imperative scroll helper for reserve simulation pinning. Call sites are **only** the
 * `ReservesTable` effect that runs after debounced scenario changes (see
 * `docs/design/frontend-interaction-guardrails.md` — “Simulation pin scroll”).
 * - **Desktop (`pin-main-row-top`)**: align `tr[data-reserve-id]` top to `getPinnedRowTopY()` (sticky stack + gap).
 * - **Mobile (`minimal-if-clipped`)**: only scroll if the expanded anchor block is clipped.
 */
export function scrollExpandedSimulationIntoView(
  reserveId: string,
  options: { mode: ExpandedSimulationScrollMode; instant?: boolean },
): void {
  if (typeof document === 'undefined') return;

  const escaped = escapeReserveId(reserveId);
  const behavior = options.instant ? 'auto' as ScrollBehavior : getScrollBehavior();
  const pinnedTopY = getPinnedRowTopY();
  const vBottom = window.innerHeight - VIEW_MARGIN_PX;

  const mobileAnchor = document.querySelector(`[data-reserve-expanded-anchor="${escaped}"]`);

  if (mobileAnchor instanceof HTMLElement) {
    const r = mobileAnchor.getBoundingClientRect();
    const top = r.top;
    const bottom = r.bottom;
    if (options.mode === 'pin-main-row-top') {
      const delta = top - pinnedTopY;
      if (Math.abs(delta) >= MIN_SCROLL_DELTA_PX) {
        window.scrollBy({ top: delta, behavior });
      }
      return;
    }
    const clipBottomDelta = bottom - vBottom;
    if (clipBottomDelta >= MIN_SCROLL_DELTA_PX) {
      window.scrollBy({ top: clipBottomDelta, behavior });
      return;
    }
    const clipTopDelta = top - pinnedTopY;
    if (clipTopDelta <= -MIN_SCROLL_DELTA_PX) {
      window.scrollBy({ top: clipTopDelta, behavior });
    }
    return;
  }

  const mainRow = document.querySelector(`tr[data-reserve-id="${escaped}"]`);
  if (!(mainRow instanceof HTMLElement)) return;

  if (options.mode === 'pin-main-row-top') {
    const mainRect = mainRow.getBoundingClientRect();
    // Always pin main row top to sticky band. The spacer below the table ensures
    // enough scroll room for the simulation bottom to be in viewport.
    const delta = mainRect.top - pinnedTopY;
    if (Math.abs(delta) >= MIN_SCROLL_DELTA_PX) {
      window.scrollBy({ top: delta, behavior });
    }
    return;
  }

  const mainRect = mainRow.getBoundingClientRect();
  const top = mainRect.top;
  let bottom = mainRect.bottom;
  const subRow = mainRow.nextElementSibling;
  if (subRow instanceof HTMLElement) {
    const subRect = subRow.getBoundingClientRect();
    bottom = Math.max(bottom, subRect.bottom);
  }

  const clipBottomDelta = bottom - vBottom;
  if (clipBottomDelta >= MIN_SCROLL_DELTA_PX) {
    window.scrollBy({ top: clipBottomDelta, behavior });
    return;
  }
  const clipTopDelta = top - pinnedTopY;
  if (clipTopDelta <= -MIN_SCROLL_DELTA_PX) {
    window.scrollBy({ top: clipTopDelta, behavior });
  }
}
