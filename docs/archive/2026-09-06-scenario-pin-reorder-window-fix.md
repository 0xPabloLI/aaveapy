# Scenario-pin reorder window fix — implementation record (2026-09-06)

## Symptom

`e2e/reserves-table-simulation-full-after-scenario-pin.spec.ts:118` failed on every
push (pre-push e2e gate) with "pin mechanism should settle after scenario-driven
reorder". The spec has a known flake history (`e53a1031`, `d07e6f66`,
`c5981de9`) — this root-causes and fixes it for real.

## Root cause (evidence-based)

`[scenarioPin]` dev traces captured in a failing run showed the controller never
scheduled the pin: `hasRequiredVisibleCount: false` with the expanded row still
visible. Chain:

1. Test expands the row at visible index 8 (live staging data).
2. A scenario step re-sorts (live rates) and moves the expanded row deeper than
   `DEFAULT_VISIBLE_COUNT(20) - 6` → the row unmounts (beyond pagination window).
3. Pin controller guard `hasRequiredVisibleCount` (needs `idx+6 ≤ window`) is
   false → pin never schedules → the spec's 30s poll can never satisfy
   "row in band or scrollBy fired".

The controller was correct per its guard; the guard was unsatisfiable because the
pagination window never grew for reorders under an **existing** expansion —
`useReservesPagination` only auto-grew on `expandedReserveId` change (AAV-1107
fix deliberately excluded data-driven changes).

## Fix

`useReservesPagination` grows the window to `expandedIndex + 6` when a **pure
reorder** (same reserve-id multiset — live refresh / scenario re-sort) moves the
expanded row deeper than the current window. Dataset membership changes (filters)
keep the AAV-1107 behavior: baseline reset, no grow. This restores the normative
contract in `docs/design/frontend-interaction-guardrails.md` § "Simulation pin
scroll" (scenario change + reorder + expanded + scenario-driven sort MUST pin).

## Scenario matrix → tests (`useReservesPagination.test.ts`)

| # | Scenario | Expected | Test |
|---|----------|----------|------|
| 1 | Pure reorder moves expanded row deeper (8→30, window 20) | grow to idx+6=36, row rendered | `grows the window when a pure reorder…` |
| 2 | Pure reorder keeps row inside window (8→12) | no window change | `does not churn the window…` |
| 3 | Id set changes, same length (filter path) | no grow (AAV-1107) | `does not grow the window when the id set changes…` |
| 4 | Significant dataset change (30→80, expanded id present at 25) | reset to null, no re-grow | existing `does NOT auto-grow…` (green) |
| 5 | Data refresh small change (50→52) | window preserved | existing (green) |
| 6 | Click-grow + persistence | unchanged | existing (green) |

## Verification

- Unit: `src/hooks/reserves-table/` 9 files, 154 tests green (3 new).
- Full gate: lint / `npm test` (3539) / `tsc --noEmit` / `build` — all green.
- E2E: the previously failing spec passes in 10s (was 30s-timeout × 2 retries).

## Trade-off note

Growing the window on a deep pure reorder renders more rows than before (up to
`idx+6`). This matches the pre-AAV-1107 semantics for reorders only; the 1107
filter case still resets pagination, so the stale-spacer bug stays fixed.
