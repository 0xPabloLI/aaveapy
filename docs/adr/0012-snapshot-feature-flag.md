# ADR-0012: Snapshot Feature Flag

## Status

Accepted (proposed by AAV-636 / AAV-644 on 2026-06-08)

## Context

The Portfolio Snapshot feature (save/compare portfolio snapshots) is live
but has many pending UX optimizations. The product decision is to
temporarily remove all user-facing entry points while preserving the
code for future re-enablement alongside the "one-click optimal
deployment" feature.

Three approaches were considered:

1. **Delete code outright** — simplest, but re-implementation cost is
   high and the feature was non-trivial to build (compare view, delta
   calculations, prefetch optimization).

2. **Dead-code directory** — move files to `_disabled/`, breaking all
   imports. Restoring requires re-wiring every import path and
   increases merge-conflict surface.

3. **Feature flag** — a `features.snapshot` constant gates all UI
   rendering; hook layer and types stay untouched. Restoring = flip one
   boolean.

## Decision

Use a feature flag (`src/config/features.ts`, `features.snapshot = false`).

- UI layer: Save button, Saved Snapshots list, Compare button, and
  PortfolioCompareView rendering are all gated by the flag.
- Prefetch layer: `portfolioPrefetch.ts` skips the Compare view chunk
  when the flag is off, avoiding unnecessary network requests.
- Hook layer / types / tests: unchanged. Logic stays correct; existing
  tests continue to pass, ensuring the code path remains valid.

## Consequences

### Positive

- One-line restore (`snapshot: true`) with zero code changes needed.
- Hook logic and types are exercised by existing tests, preventing
  bit-rot.
- Feature flag pattern is reusable for future temporary disabling.
- No broken imports, no merge-conflict surface.

### Negative

- Dead UI code ships in the bundle (lazy-loaded PortfolioCompareView
  is never imported at runtime, so its chunk is not fetched; the flag
  check is negligible byte overhead).
- Future developers must check the flag before adding new snapshot
  features.

## Alternatives Considered

### Delete code outright
Rejected. The compare view, delta calculations, and prefetch
optimization represent significant implementation effort. Re-building
from scratch would be wasteful.

### Dead-code directory (`_disabled/`)
Rejected. Breaking all import paths creates a large diff on both
disable and re-enable. Merge conflicts with ongoing development are
likely. The feature flag achieves the same user-visible effect with
minimal diff and zero import breakage.
