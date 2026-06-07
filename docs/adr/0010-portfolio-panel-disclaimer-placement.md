# ADR-0010: Portfolio Panel Disclaimer Placement

## Status
Accepted

## Context
The application already displays a simulation disclaimer inside each expanded
reserve row (`SimulationSubRow`). Users who only look at the portfolio-level
summary card never see that disclaimer, yet the summary metrics are equally
derived from simulated data.

## Decision
Place the simulation disclaimer **inside `PortfolioSummaryCard`**, below the
4-cell metric grid and before the card's closing wrapper. This keeps the
disclaimer visually bound to the card that contains the simulated values without
adding extra rows or wrappers to the parent `PortfolioPanel` layout.

Key constraints:
- Copy mirrors `SimulationSubRow` exactly (desktop / mobile variants via
  `useIsMobile()`).
- Styled `ds-text-10 text-muted-foreground/70 italic` — smaller and lighter
  than the metric cells so it reads as supplementary.
- No top margin (`mt-0`) — the disclaimer sits flush against the card's bottom
  border to avoid inflating the card's visual height.
- No structural changes to `PortfolioPanel`'s own grid/flex layout.

## Consequences
- Users see the disclaimer at the portfolio level without expanding any reserve.
- The card grows by one line of 10 px text; negligible height impact.
- If the disclaimer copy changes in `SimulationSubRow`, it must be updated here
  as well (or extracted to a shared constant).
