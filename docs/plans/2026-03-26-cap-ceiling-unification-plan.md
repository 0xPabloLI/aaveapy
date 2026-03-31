# Incentive Cap/Ceiling Naming Unification (Archived)

Historical implementation plan (dated 2026-03-26).

Status: Implemented. Detailed normative behavior now lives in canonical docs:

- `docs/rate-calculation-formulas.md` (cap taxonomy, naming layers, UI-facing semantics)
- `AGENTS.md` (repo-level naming and implementation constraints)

## What this plan decided (retained summary)

- Keep API contracts unchanged (for example `perUserRewardCapUsd`).
- Use `ceiling` vocabulary in domain helpers and formulas.
- Keep UI prop surface stable (`capNote` / `capWarning`) for compatibility.
- Centralize cap/ceiling message assembly through shared domain helpers.

## Historical scope

The original plan described a phased rollout:

1. Docs alignment
2. Domain helper unification
3. Test hardening
4. Optional cleanup

Those phases are complete in this repository. The original long-form plan content was intentionally removed to avoid duplication with canonical docs above.
