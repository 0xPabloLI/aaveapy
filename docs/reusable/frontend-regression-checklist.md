# Frontend Regression Checklist

Use this checklist for any refactor or UI behavior change touching display-layer components (tables, cards, dashboards, interactive panels).

The goal is to catch regressions where static checks pass but UI layout, runtime wiring, or displayed values drift.

## Required local checks

Run these before committing any display-layer refactor:

1. `npm run lint`
2. `npm run build`
3. Run targeted regression tests for the touched surface.
4. Run a browser regression pass against a valid local app instance.

Do not treat `lint` + `build` alone as sufficient evidence for display-layer refactors.

## Required targeted assertions

Add or update at least one test that would fail if the current change regresses.

Examples of what to assert:

- Mobile vs desktop branch rendering: mobile must not fall back to desktop-only layout.
- Computed totals: displayed total must equal sum of visible breakdowns.
- Expanded/collapsed state: component identity must be preserved across state transitions.
- Sort controls: sorting semantics must be preserved after extraction.
- Sticky/fixed positioning: DOM contract must match documented behavior.

If a visual or numeric bug is found during manual verification, add a focused regression test before shipping the fix.

## Browser regression pass

Use a valid local server, not a stale cached dev session.

- If the dev server shows stale dependency warnings, restart from a fresh instance.

Verify at minimum:

1. Mobile viewport (~390×844)
2. Tablet viewport (~834×1194)
3. Desktop viewport (~1440×1200)

Record:

- Screenshot(s)
- Console errors/warnings
- Whether expected section headings and values are present

Treat framework warnings and missing analytics scripts separately from app regressions. Treat runtime errors, blank pages, broken layout, and value mismatch as **blockers**.

## Numeric consistency checks

When the UI shows a combined total and visible breakdowns, verify they remain internally consistent.

Examples:

- Dashboard cards: total must match rendered sub-values.
- Incentive/reward breakdowns: campaign rows must match aggregate total.
- Computed views: headline value must map to source values after prop plumbing changes.

Prefer explicit assertions over visual eyeballing.

## Historical replay for risky refactors

When a refactor changes component extraction, prop plumbing, or render branching, replay regression checks against key historical commits.

Recommended flow:

1. Create isolated worktrees (avoid `git checkout` in the main worktree).
2. Pick one known-good baseline commit and one suspect commit.
3. Run targeted regression tests, lint, build, and browser pass.

This is especially useful for extraction-only commits that preserve types while breaking runtime behavior.

## Shipping rule

Do not describe a display-layer refactor as "verified" unless evidence includes:

1. Static checks (`lint`, `build`)
2. A targeted regression test
3. A browser pass on a valid local app instance

If any is missing, describe verification as partial.
