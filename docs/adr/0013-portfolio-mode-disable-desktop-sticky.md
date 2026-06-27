# ADR-0013: Disable Desktop Sticky Scenario Bar in Portfolio Mode

## Status

Accepted

## Context

The reserves table uses a sticky scenario bar (`sticky top-0 z-20`) on desktop that stays fixed at the viewport top while the user scrolls. Below it, `<thead>` is also sticky (`top: var(--reserves-sticky-scenario-height)`), and expanded rows are sticky (`top: var(--reserves-expanded-main-row-top)`) — forming a three-layer sticky stack.

On **mobile**, Portfolio mode already disables sticky on the scenario bar (since ADR-0005 era). The code comment explains:

> In portfolio mode, the panel can grow taller than the viewport (search + suggested chips + many position rows + summary). If we keep it sticky, the content overflows the sticky box and becomes unscrollable — only the cards below it scroll. Disable sticky in portfolio mode so the entire panel scrolls naturally with the page.

On **desktop**, the scenario bar remains sticky in Portfolio mode. This creates the same problem: the PortfolioPanel (search + suggested chips + many position rows + summary) can exceed viewport height, and when sticky, the overflow content is unreachable — only the reserve cards below scroll.

## Decision

**Disable sticky on the desktop scenario bar in Portfolio mode**, matching the mobile behavior. The scenario bar (containing PortfolioPanel) scrolls naturally with the page.

**Preserve sticky on `<thead>` and expanded rows**, adjusting their `top` offsets:

- `--reserves-sticky-scenario-height` is set to `0px` in Portfolio mode (via `useReservesLayoutRefs` ResizeObserver)
- `<thead>` naturally becomes `top: 0` — column headers still pin at viewport top
- Expanded rows use `top: var(--reserves-expanded-main-row-top)` which equals `0 + theadHeight` — still sticky just below column headers

Implementation:

1. `ReservesTable.tsx` desktop scenario wrapper: add `!isPortfolioMode &&` guard to `sticky top-0 z-20` (same pattern as mobile)
2. `useReservesLayoutRefs.ts`: accept `isPortfolioMode` param; when true, set `--reserves-sticky-scenario-height` to `0px` instead of measured height
3. Pin-scroll (`useScenarioPinScroll` + `scrollExpandedSimulationIntoView`): no changes needed — `getDesktopPinnedRowTopY()` reads CSS variables which are now 0 for scenario, so the math adapts automatically

No special handling on mode switch (Single ↔ Portfolio): the browser reflows naturally, and pin-scroll's scenario key change may trigger a natural re-pin.

## Consequences

### Positive

- Desktop and mobile have consistent Portfolio sticky behavior
- PortfolioPanel content is fully scrollable when it exceeds viewport height
- Table headers remain sticky — column names always visible
- Expanded rows remain sticky — simulation detail stays visible while scrolling
- Pin-scroll adapts automatically via CSS variable chain

### Negative

- In Portfolio mode, users must scroll back to access PortfolioPanel controls (search, add position, summary)
- Scenario bar is no longer "always accessible" — trade-off matches mobile behavior and is acceptable since Portfolio operations are less frequent than scrolling the table

## Alternatives Considered

### Keep desktop sticky, add inner scroll to PortfolioPanel

Rejected. Adding `overflow-y: auto` with `max-height` to the sticky PortfolioPanel would allow scrolling within the sticky bar, but this creates a nested scroll context that conflicts with page scroll (mouse wheel ambiguity on trackpads), and the sticky bar would consume significant viewport height even when collapsed — reducing space for the reserves table.

### Make only PortfolioPanel non-sticky, keep ScenarioControls sticky

Rejected. In Portfolio mode, ScenarioControls (shared supply/borrow inputs) are hidden (`!isPortfolioMode &&`). The entire sticky bar is the PortfolioPanel. This alternative is effectively the same as the chosen approach.

## Related Issues

AAV-632
