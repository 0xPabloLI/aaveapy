# ADR-0011: API base URL "missing" semantics

## Status

Accepted (proposed by AAV-118 refresh on 2026-06-07)

## Context

The frontend reads `VITE_API_BASE_URL` from Vite env in 3 places:
runtime fallback (`src/lib/apiBase.ts:1`), runtime warn
(`src/lib/apiBase.ts:6`), build-time throw (`vite.config.ts:38`).
Each used a different "missing" predicate (`||`, `== null`, `== null`).
The empty-string (`''`) case silently fell through to staging on
production builds, exposing staging data on prod-looking deployments.

## Decision

Define "missing" as: `null` OR `undefined` OR empty string OR
whitespace-only string. Encapsulate in a single helper
`isMissingApiBase(value: string | null | undefined): boolean`. All
three check sites use it (or its 3-line inline equivalent for the
build-time gate). Empty string is treated as missing, not as an
"explicit empty" escape hatch.

## Consequences

### Positive
- Build-time and runtime checks are semantically identical.
- The "deliberately blank = use staging" escape hatch is removed;
  misconfiguration fails loudly at build time.
- A single test surface (the helper) locks the semantics in CI.

### Negative
- Anyone who relied on the escape hatch (none known) loses it.
  No committed `.env*` file or documented CI config uses `''`.

## Alternatives Considered

### Treat `''` as an explicit escape hatch
Rejected. The escape hatch was undocumented, conflicted with the
`.env.production` comment ("或留空使用默认值"), produced
3-way inconsistent behavior across check sites, and had no test
defending it as designed (the test at `apiBase.test.ts:34-40` locks
the inconsistency, not the design).
