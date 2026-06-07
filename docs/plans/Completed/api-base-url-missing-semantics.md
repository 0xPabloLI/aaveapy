# PRD: API base URL — unify "missing env value" semantics

**Status**: Proposed (pending user approval)
**Owners**: TBD
**Related**: API base URL configuration, `validateEnvPlugin`, `VITE_API_BASE_URL`
**ADR**: (this PRD includes the ADR; will land as `docs/adr/0011-api-base-url-missing-semantics.md` upon acceptance)

## Problem Statement

The frontend API base URL is currently read in three places with **three different definitions of "missing"**:

- `src/lib/apiBase.ts` runtime constant uses `||` (treats `null`, `undefined`, and `''` as missing)
- `src/lib/apiBase.ts` runtime warn uses `== null` (treats only `null` / `undefined` as missing)
- `vite.config.ts` build-time gate uses `== null` (same as runtime warn)

`src/lib/apiBase.test.ts:34-40` explicitly tests that `VITE_API_BASE_URL=''` does **not** fire the runtime warn — locking in an inconsistency that has no documented rationale, no ADR, and no inline comment.

The user-visible consequence: a `VITE_API_BASE_URL=''` in a production build (e.g., empty Vercel env var, empty `.env.production` line) currently **passes the build silently, the runtime falls back to staging without warning, and end users see staging data on a production-looking site**. There is no signal at any layer that anything is wrong.

Additionally:

- The "missing" detection logic is not extracted; the same conceptual check is expressed three different ways across two files.
- A module-level side effect (`validateApiBaseEnv(import.meta.env)` at the bottom of `apiBase.ts`) runs on every import of `API_BASE`, which complicates test isolation and obscures bootstrap order.
- The `.env.production` comment ("或留空使用默认值") tells contributors the empty-string fallback is supported — which the build will now reject.

## Solution

Introduce a single helper `isMissingApiBase(value)` that encodes the canonical "missing" semantics — `null`, `undefined`, empty string, and whitespace-only strings are all missing. Use it at all three check sites. Keep the existing staging fallback at runtime (it's a sensible dev convenience), but make the build-time gate reject any "missing" value so misconfiguration fails loudly at build time. Move the env-validation side effect from module-load to explicit bootstrap in the React entry point.

The behavior change is scoped to one edge case: a deliberate `VITE_API_BASE_URL=''` (intentionally blank string) will now cause a production build to fail instead of silently using staging. Anyone hitting this case was either misconfigured (and the build failure is the correct signal) or relying on an undocumented escape hatch (and that escape hatch has no business existing in a production build).

## User Stories

1. As a **frontend developer working locally** (`npm run dev`), I want the app to start without forcing me to set `VITE_API_BASE_URL`, so that onboarding stays smooth.
2. As a **frontend developer** running a production build locally (`npm run build`), I want the build to fail loudly and clearly if I forgot to set the API URL, so that I don't accidentally deploy a broken app.
3. As a **devops engineer configuring Vercel env**, I want immediate, actionable feedback if I accidentally set `VITE_API_BASE_URL` to an empty string, so that the misconfig is caught at build time, not at runtime when users see staging data on a prod-looking site.
4. As a **CI engineer**, I want `npm run build` in GitHub Actions to fail loudly on missing or empty `VITE_API_BASE_URL`, so that PRs that break env config cannot be merged.
5. As an **end user visiting the deployed site**, I want to be sure the site is querying the correct backend (production, not staging), so that the data I see is real and not a fallback masquerading as prod.
6. As a **test author**, I want a single `isMissingApiBase(value)` helper I can unit-test in isolation, so that the missing semantics is locked once and reused consistently.
7. As a **maintainer reading the code in 6 months**, I want the env-validation logic to live in one obvious, testable place, so that I can find and reason about it without reading three files.
8. As a **maintainer reading the code**, I want the empty-string check to be expressed identically at every site, so that I don't have to wonder why one site uses `||` and another uses `== null`.
9. As a **maintainer reading `.env.production`**, I want the file's comment to accurately describe the build's behavior, so that I am not misled into thinking an empty value is a valid input.
10. As an **operator debugging a misconfig in production** (e.g., a Sentry alert, a console log), I want a `console.warn` to fire at app boot when the env value is missing in production mode, so that there's a visible breadcrumb.
11. As a **reader of project history** (6 months from now), I want an ADR that records *why* empty-string is treated as missing, so that the decision doesn't get accidentally reverted by a future contributor who doesn't know the context.
12. As a **Node script author** (e.g., `scripts/lib/default-api-bases.mjs` consumers), I want this change to leave my scripts untouched, so that I don't have to update them just because the frontend tightened its env-validation.

## Implementation Decisions

### Deep module: `isMissingApiBase`

The single, testable concept that fixes the bug. Public interface:

```ts
export function isMissingApiBase(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}
```

- `null` and `undefined` → missing
- `''` and whitespace-only strings (`' '`, `'\t'`, etc.) → missing
- Any non-empty string (including `'0'`, `'false'`, `'/'`) → not missing

This is the canonical "missing" predicate. Both the runtime and the build-time gate must call it (or a literal copy of the same expression) — no other "is this set" check is permitted in the env-validation path.

### Module: `apiBase.ts` (refactored — no side effects)

- Export `API_BASE` (the constant).
- Export `isMissingApiBase` (the helper above).
- Export `validateApiBaseEnv` (the function, unchanged behavior, just internal check switched to `isMissingApiBase`).
- **Remove the module-level** `validateApiBaseEnv(import.meta.env)` call. Module is now pure (only depends on `import.meta.env` at evaluation time when computing `API_BASE`).
- `API_BASE` computation: if `isMissingApiBase(import.meta.env.VITE_API_BASE_URL)` is true, fall back to staging URL; otherwise use the env value.

### Module: `vite.config.ts` `validateEnvPlugin` (build-time gate, mirrored)

- Inline the same `isMissingApiBase`-equivalent expression (3 lines). Do **not** import from `src/lib/apiBase.ts` because Vite config runs in Node before the TS toolchain is fully wired, and cross-environment imports of a module that reads `import.meta.env` add risk for no benefit at 3 lines of logic.
- Throw a clear, actionable error message naming the variable and suggesting the production URL.
- Behavior change: `VITE_API_BASE_URL=''` now throws at build time (previously passed silently).

### Module: `main.tsx` (or other bootstrap entry) — explicit env validation

- Call `validateApiBaseEnv(import.meta.env)` once at the top of the React entry file, alongside the existing `preloadDefaultTokenIcon()` bootstrap.
- This is the single, explicit place where the side effect lives. Module imports of `API_BASE` no longer trigger it.

### Module: `apiBase.test.ts` (updated)

- **Replace** the test at lines 34–40 ("does not warn when VITE_API_BASE_URL is empty string in production") with a test that asserts the new behavior: empty string in production **does** warn (because the new contract treats it as missing).
- Add a focused unit-test group for `isMissingApiBase` covering: `null`, `undefined`, `''`, `' '`, `'\t'`, `'http://...'` (valid), `'0'` (valid edge).
- Keep the existing 4 tests for `validateApiBaseEnv` as-is.

### Documentation: `.env.production`

- Remove the phrase "或留空使用默认值" from the comment. The empty-string fallback no longer exists at build time.
- The new comment should reflect the truth: "must be set; build will fail otherwise."

### ADR: `docs/adr/0011-api-base-url-missing-semantics.md`

- Record the decision: empty / whitespace-only string is treated as "missing", not "explicit empty" / "escape hatch".
- Record the rejected alternative: treating `''` as an intentional escape hatch (and why it's rejected — undocumented, conflicts with the `.env.production` comment, three-way implementation inconsistency, no test that defends the design as intended).
- Status: proposed → accepted upon PRD sign-off.

## Testing Decisions

- **What to test**:
  - `isMissingApiBase` — pure function, exhaustive table-driven tests for all 7 input categories above.
  - `validateApiBaseEnv` — keep the existing 4 tests, replace the "empty string doesn't warn" test with "empty string warns" (because the new contract treats it as missing).
  - `API_BASE` fallback — one integration test asserting that when the env is missing, the constant equals the staging URL. This is a regression guard against accidentally removing the fallback.
- **What NOT to test**:
  - Implementation details of `vite.config.ts` (e.g., the exact plugin name). That code is exercised by running `vite build` and observing the throw — itself a manual / CI check, not a unit test.
  - Cross-environment behavior (browser vs Node) — the helper is pure, so the test suite is the same in both.
- **Test pattern (prior art)**:
  - `src/lib/apiBase.test.ts` already uses `vi.spyOn(console, 'warn').mockImplementation(() => {})` per test case. Reuse this pattern.
  - Co-located `*.test.ts` next to source is the project convention (see `src/lib/*.test.ts`). Stay consistent.
- **TDD approach** (per `tdd` skill):
  - Write `isMissingApiBase` test → implement → pass.
  - Update `validateApiBaseEnv` test for empty-string → update impl → pass.
  - Update `API_BASE` fallback test → adjust impl → pass.
  - Do **not** write all tests first. One vertical slice at a time.

## Out of Scope

The following are explicitly **not** part of this PRD (recorded so we don't accidentally scope-creep):

- **Centralizing the 4-way duplicated staging URL** (`apiBase.ts:1`, `apiSchemas.live.helpers.ts:2`, `scripts/lib/default-api-bases.mjs:6`, `.env.staging:1`). This is a separate DRY cleanup; a follow-up PRD is recommended. Touching it here would balloon the diff and require coordinating Node script imports.
- **Removing the runtime `console.warn` entirely**. The TDD analysis surfaced that the warn is mostly a redundant smoke detector (the build plugin already prevents the scenario it warns about). But removing it is a separate, debatable decision; the user has not asked for it.
- **Replacing `VITE_API_BASE_URL` with a `VITE_ENV` switch + URL table**. A bigger refactor that changes the public surface ops/CI depend on. Not justified for a bug fix.
- **Updating `docs/conventions/api-base-urls.md`** to reflect the new "missing" semantics. Small follow-up; can be done in a docs commit that lands alongside the ADR.
- **Touching Node scripts** (`scripts/lib/*.mjs`). They use a separate default-URL convention and don't import from `src/lib/apiBase.ts`. Out of scope.

## Further Notes

- **Commit cadence**: per `AGENTS.md`, one atomic task = one commit. The 5 file edits naturally split into 3 commits: (1) introduce `isMissingApiBase` helper + update tests (test-first, TDD cycle); (2) refactor `apiBase.ts` and `vite.config.ts` to use it; (3) move side effect to `main.tsx` + docs comment fix. Or fewer, depending on how the TDD cycles shake out.
- **CI gate**: every commit must pass `npm run lint && npm test && npm run build && npx tsc --noEmit` (the 4-gate rule from `AGENTS.md`). The `build` gate is the most relevant here — it exercises `validateEnvPlugin` against the real `.env.production`.
- **Browser verification**: per `AGENTS.md`, UI-touching changes need browser verification. This change does not touch UI; only a build-then-smoke check is required (e.g., `npm run build` succeeds, then a quick `npm run preview` + curl `/` to confirm the page loads).
- **Migration risk**: low. The only behavior change is the `VITE_API_BASE_URL=''` case in production build, which (a) is not present in any committed `.env*` file, (b) is not present in any known Vercel env config, and (c) was producing incorrect behavior (silent staging fallback) when it did occur. No user-facing feature changes; no API contract changes; no UI changes.
- **Linear publish**: this PRD should be published to Linear (team `Aaveapy`, key `AAV`) as a single issue with label `ready-for-agent` and the ADR as a comment / child reference. Awaiting user approval before publishing.
