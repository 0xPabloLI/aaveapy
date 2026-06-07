# ADR-0010: Portfolio Panel Disclaimer Placement (AAV-561)

## Status

Accepted

## Context

The per-Reserve SimulationSubRow already shows a disclaimer when a user enters a scenario:

- desktop: `Simulation is for reference only. Final result depends on on-chain execution.`
- mobile: `Simulation only; final result is on-chain.`

(See `src/components/dashboard/SimulationSubRow.tsx` ~L1350.)

In **Portfolio mode** (Batch / combined position view), a user may look at the PortfolioPanel `SummaryCard` + `ResultsTable` without ever opening a single Reserve's `SimulationSubRow`. The numbers they see (Net Effective APY, Total Net Daily Earn, per-position Total) are simulated values too, but the disclaimer never reaches these users.

AAV-561 asks for a disclaimer in the Portfolio panel for this case.

Constraint (from product review): **0 new rows** in the panel layout; must read OK at 360px mobile.

## Decision

Place a single line of italic ds-text-10 text directly below `PortfolioSummaryCard` (no `mt` margin — disclaimer sits flush against the card's bottom border, visually attached to it), rendered in `text-muted-foreground/70 italic`. Copy is identical to the per-Reserve disclaimer (desktop/mobile split). Always visible whenever the summary card is rendered (no `hasInput` gate — the whole point is to be seen by users who *don't* type into a scenario input).

Placement: **Variant C** of the prototype (`/prototype/portfolio-disclaimer?variant=C`), selected after comparing 3 candidates:

| Candidate | Location | Verdict |
|-----------|----------|---------|
| A | Inside `Net Effective APY` cell, below the APY number | Rejected — feels like a footnote on one metric; users with no APY awareness (e.g. only looking at USD/day) miss it |
| B | Dedicated band above ResultsTable thead | Rejected — adds visual mass between card and table; invites "I can dismiss this" reading |
| C | Full-width italic line flush against SummaryCard bottom | **Chosen** — visually attached to the card so it reads as a "card footnote", cannot be missed when looking at the card, no extra structural element |

Prototype artifacts: `src/components/prototype/PortfolioDisclaimerProto.tsx`, `src/pages/PortfolioDisclaimerProto.tsx`, route registered in `src/App.tsx`. To be deleted in the production fold-in commit (per `docs/conventions/throwaway-prototypes.md`).

### i18n / locale

Strings are inlined to mirror SimulationSubRow's pattern for now. If/when a `simulationDisclaimer` i18n key is introduced centrally, both call sites should be migrated together. Tracked as a follow-up.

## Consequences

### Positive
- Users who never expand a Reserve row now see the disclaimer on the highest-traffic position in the panel (the summary card)
- Zero new visual rows / structural elements
- Mobile 360px: `ds-text-10 italic` wraps inside the panel padding; mobile short copy fits one line
- Copy is byte-identical to the per-Reserve disclaimer — single mental model for the user

### Negative
- Disclaimer is not associated with any specific number (unlike the per-Reserve case where it sits under the simulation table); users may read it as a generic footer
- Visual proximity to SummaryCard border may read as "this belongs to the card" rather than "applies to the whole panel" — acceptable trade-off given 0-new-row constraint

## Alternatives Considered

### B: Add a banner above the entire panel
Rejected. Violates the 0-new-row constraint and adds a dismissible / not-dismissible question that doesn't apply to a one-line note.

### C′: Render inside SummaryCard as a 5th cell
Rejected. SummaryCard is a 4-cell grid (2×2 mobile, 1×4 desktop) of equal-weight metrics. Adding a 5th asymmetric cell would break the grid visual contract established by `PortfolioSummaryCard` consumers.

## Related Issues

- AAV-561 — Portfolio 模式下也要加一个 Simulation only for reference 的提示
- AAV-468 — Parent Portfolio epic
