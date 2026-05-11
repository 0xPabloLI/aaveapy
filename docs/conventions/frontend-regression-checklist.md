# Frontend Regression Checklist

Use this checklist for any refactor or UI behavior change touching:

- `src/components/dashboard/TopOpportunities.tsx`
- `src/components/dashboard/MobileReserveCard.tsx`
- `src/components/dashboard/MobileExpandedReserveShell.tsx`
- `src/components/dashboard/ReservesTable.tsx`
- `src/components/dashboard/ReservesTableDesktopHeader.tsx`
- `src/components/dashboard/DesktopReserveRow.tsx`
- `src/components/dashboard/PortfolioPanel.tsx`
- `src/components/dashboard/PortfolioTokenRow.tsx`

The goal is to catch the class of regressions where static checks pass but UI layout, runtime wiring, or displayed numbers drift.

## Required local checks

Run these in the current branch before commit when the touched scope includes any file above:

1. `npm run lint`
2. `npm run build`
3. Run a targeted regression test for the touched surface.
4. Run a browser regression pass against a valid local app instance.

Do not treat `lint` + `build` alone as sufficient evidence for display-layer refactors.

## Required targeted assertions

Add or update at least one test that would fail if the current change regresses.

Examples:

- `TopOpportunities`
  - Mobile branch must not fall back to desktop-only row layout.
  - APY total shown in a mini card must stay aligned with `native + incentive`.
- `MobileReserveCard`
  - Expanded and collapsed shells must preserve the same reserve identity.
  - Incentive/native sub-rows must remain consistent with the parent total.
  - Mobile header compaction must not silently change icon size, text size, or font weight; verify spacing changes separately from typography.
  - When no incentive is visible, the hero empty-state helper copy must remain present and follow the active rate mode wording (`APY` vs `APR`).
- `ReservesTable`
  - Sort controls must preserve current sorting semantics.
  - Sticky/expanded row behavior must preserve the DOM contract documented in `docs/design/frontend-interaction-guardrails.md`.
- `DesktopReserveRow` (and any row that fades color per side)
  - When `supplyDisabled / borrowDisabled / isPaused / isFrozen` is true, every cell that exposes the corresponding side (Size ring trigger, APY total, native APY, incentive button, etc.) must switch to the muted color class.
  - **Anti-pattern**: asserting `expect(html).toContain('text-cyan-500/50')` on whole-row HTML — multiple cells share that class, so a missing fade in one cell is hidden by another cell's fade. Always scope the assertion to the specific element (e.g. match the `<button aria-label="Borrow cap details for ...">` substring and assert the muted class on that match).

If a visual or numeric bug is found during manual verification, add a focused regression test before shipping the fix.

### Batch panel layout (PortfolioPanel + PortfolioTokenRow)

The batch panel uses a **unified single-column grid** for both desktop and mobile. Layout rules are normative and enforced by VisualGap source-level regression tests (`PortfolioTokenRow.visual-gap.test.ts`).

**Grid architecture:**

| Layer | Class / property | Purpose |
|-------|-----------------|---------|
| Parent grid | `grid gap-x-1 gap-y-1.5 [grid-template-columns:auto_minmax(11rem,1fr)]` | `auto` column matches widest token; `1fr` column fills remaining space |
| Token row | `grid grid-cols-subgrid col-span-2 gap-x-1` | Inherits parent column widths; token info in auto-col, inputs in 1fr-col |

**Mandatory invariants (do not regress):**

1. **No `grid-cols-2` or split-logic on parent** — single-column grid only. A previous half-grid split produced visual gap holes and was removed.
2. **Row uses `grid-cols-subgrid`** (both desktop and mobile) — not flex, not inline-flex. Subgrid ensures every row's token info column is identical in width.
3. **Gap `gap-x-1` (4px)** between token info and inputs — must stay at or below `gap-x-1`. Larger gaps (≥8px) create the visual hole symptom this guard prevents.
4. **Desktop supply/borrow side-by-side** (`flex items-center gap-2`), **mobile stacked** (`flex flex-col gap-1`) — do not flip these.
5. **Minus button inline on the left** (both desktop and mobile) — no absolute corner positioning.
6. **Token info width = `auto`** (matches widest token in list), not a hard-coded pixel value — the parent grid's `auto` column does this automatically.

**Regression test location:** `src/components/dashboard/PortfolioTokenRow.visual-gap.test.ts` (6 tests verifying subgrid, gap ≤ 4px, flex direction per viewport). Run with: `npm test -- PortfolioTokenRow.visual-gap`.

## Browser regression pass

Use a valid local server, not a broken cached dev session.

Preferred order:

1. `node scripts/generate-icon-manifests.mjs && npx vite --host 127.0.0.1 --port 8081`
2. If the existing dev server shows `504 Outdated Optimize Dep`, restart from a fresh instance instead of trusting the result.

Verify at minimum:

1. Mobile viewport around `390x844`
2. Tablet viewport around `834x1194`
3. Desktop viewport around `1440x1200`

Record:

- Screenshot(s)
- Console errors/warnings
- Whether the expected section headings and values are present

Treat framework warnings and missing preview-only analytics scripts separately from app regressions. Treat runtime page errors, blank pages, broken layout, and value mismatch as blockers.

## Numeric consistency checks

When the UI shows a combined total and visible breakdowns, verify the display remains internally consistent.

Examples:

- `TopOpportunities` APY cards: total must match the rendered `native + incentive` pair.
- `TopOpportunities` mini card height: the second-row container must have `min-h-[1.125rem]` to keep all internal cards (supply with/without incentive, leverage) uniform height.
- `MiniReserveApyRow` no-incentive branch: must render `Base APY/APR only` placeholder (not invisible empty elements) when `hasIncentive` is false.
- Incentive breakdowns: displayed campaign rows must match the aggregate lane total.
- Spread / leverage views: headline value must still map to the rendered source values after extraction or prop plumbing changes.

For these checks, prefer explicit assertions over visual eyeballing.

## Historical replay for risky refactors

When a refactor changes component extraction, prop plumbing, or render branching, replay the new regression checks against key historical commits to confirm the test would have caught the bug.

Recommended flow:

1. Create isolated worktrees instead of using `git checkout`.
2. Pick:
   - One known-good baseline commit before the refactor.
   - One suspect commit inside the refactor series.
3. If the old commit needs generated manifests, create them before the test or copy the generated manifest files in as temporary artifacts.
4. Run:
   - targeted regression test
   - `npm run lint`
   - `npm run build`
   - browser pass if the bug was visual/runtime-facing

This replay is especially useful for extraction-only commits that can preserve types while breaking runtime behavior.

## Shipping rule

Do not describe a display-layer refactor as "verified" unless the evidence includes:

1. Static checks (`lint`, `build`)
2. A targeted regression test
3. A browser pass on a valid local app instance

If any one of those is missing, describe the verification as partial.
