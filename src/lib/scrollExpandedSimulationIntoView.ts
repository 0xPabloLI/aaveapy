const VIEW_MARGIN_PX = 16;
/** Breathing room below the stacked sticky strips (scenario + optional thead) before the body row. */
const GAP_BELOW_STICKY_STACK_PX = 8;

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

function escapeReserveId(reserveId: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(reserveId)
    : reserveId.replace(/"/g, '\\"');
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
  options: { mode: ExpandedSimulationScrollMode },
): void {
  if (typeof document === 'undefined') return;

  const escaped = escapeReserveId(reserveId);
  const behavior = getScrollBehavior();
  const pinnedTopY = getPinnedRowTopY();
  const vBottom = window.innerHeight - VIEW_MARGIN_PX;

  const mobileAnchor = document.querySelector(`[data-reserve-expanded-anchor="${escaped}"]`);

  if (mobileAnchor instanceof HTMLElement) {
    const r = mobileAnchor.getBoundingClientRect();
    const top = r.top;
    const bottom = r.bottom;
    if (options.mode === 'pin-main-row-top') {
      const delta = top - pinnedTopY;
      if (Math.abs(delta) > 1) {
        window.scrollBy({ top: delta, behavior });
      }
      return;
    }
    if (bottom > vBottom) {
      window.scrollBy({ top: bottom - vBottom, behavior });
      return;
    }
    if (top < pinnedTopY) {
      window.scrollBy({ top: top - pinnedTopY, behavior });
    }
    return;
  }

  const mainRow = document.querySelector(`tr[data-reserve-id="${escaped}"]`);
  if (!(mainRow instanceof HTMLElement)) return;

  if (options.mode === 'pin-main-row-top') {
    const mainRect = mainRow.getBoundingClientRect();
    const delta = mainRect.top - pinnedTopY;
    if (Math.abs(delta) > 1) {
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

  if (bottom > vBottom) {
    window.scrollBy({ top: bottom - vBottom, behavior });
    return;
  }
  if (top < pinnedTopY) {
    window.scrollBy({ top: top - pinnedTopY, behavior });
  }
}
