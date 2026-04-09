# Mobile Reserve iOS Connector Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the iPhone-only seam / stray line that appears when a mobile reserve card expands, without changing content, data, or interaction behavior.

**Architecture:** Keep the current mobile 2-column grid and the existing reserve/simulation content, but replace the current expanded-state bridge construction with a single connector owner. Today the expanded row is stitched together from multiple overlapping borders (`MobileReserveCard` top half, full-width simulation panel, bridge rect, SVG patch), which is fragile on iOS WebKit. The fix is to move connector ownership into one dedicated mobile expanded-shell component so the seam is drawn once, not layered from multiple independent edges.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite, Vitest, Playwright

## Recommended approach

Use a dedicated `MobileExpandedReserveShell` for mobile expanded rows.

- Preserve the current 2-column mobile layout and current content hierarchy.
- Preserve the current UX: tap card toggle, same panel width, same simulation contents, same left/right card pairing.
- Remove the current `bridge` rect + SVG fill patch + overlapping panel/top-card borders from `ReservesTable`.
- Give the connector seam a single owner:
  - the active upper card still visually connects downward
  - the full-width simulation panel still appears beneath the row
  - the inner concave corner is drawn from one contour source on half-pixels
  - overlapping borders in the connector zone are locally disconnected so WebKit does not composite multiple 1px edges

## Non-goals

- No changes to reserve content, sorting, simulation math, incentive logic, or copy.
- No changes to desktop reserves behavior.
- No behavior change to which card expands or where the panel appears.

### Task 1: Add a dedicated expanded mobile shell component

**Files:**
- Create: `src/components/dashboard/MobileExpandedReserveShell.tsx`
- Create: `src/components/dashboard/MobileExpandedReserveShell.test.tsx`

**Step 1: Write the failing test**

Create a server-render test for a new `MobileExpandedReserveShell` that renders:

- a left or right active upper slot
- a full-width panel slot
- a single wrapper marker such as `data-mobile-expanded-shell`
- a single connector marker such as `data-mobile-expanded-connector`

Assert:

- the shell renders without throwing
- only one connector owner exists
- the test fixture HTML does not rely on the old bridge contract (`div[aria-hidden]` bridge rect + ad hoc SVG patch markers)

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/MobileExpandedReserveShell.test.tsx`

Expected: FAIL because the component does not exist yet.

**Step 3: Write minimal implementation**

Create `MobileExpandedReserveShell.tsx` with props similar to:

```tsx
type MobileExpandedReserveShellProps = {
  side: 'left' | 'right';
  upper: React.ReactNode;
  sibling?: React.ReactNode;
  panel: React.ReactNode;
};
```

Implementation requirements:

- the expanded shell owns the connector seam
- the connector uses one contour source
- all 1px strokes align on half-pixels
- no stacked bridge-rect plus SVG-fill patch

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/MobileExpandedReserveShell.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/dashboard/MobileExpandedReserveShell.tsx src/components/dashboard/MobileExpandedReserveShell.test.tsx
git commit -m "Fix mobile expanded reserve connector shell"
```

### Task 2: Replace the fragile bridge construction in mobile expanded rows

**Files:**
- Modify: `src/components/dashboard/ReservesTable.tsx`
- Modify: `src/components/dashboard/MobileReserveCard.tsx`

**Step 1: Write the failing integration assertion**

Add or extend a test near the new shell test so the expanded mobile row contract is explicit:

- `ReservesTable` mobile expanded state should not render the old absolute bridge rect
- `ReservesTable` mobile expanded state should not render the old stitched SVG patch pair
- expanded mobile state should render one `data-mobile-expanded-shell`

If wiring a full `ReservesTable` render is too heavy for one test, factor out the mobile pair-row renderer into a small pure helper/component and test that instead.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/MobileExpandedReserveShell.test.tsx`

Expected: FAIL while `ReservesTable` still uses the old bridge markup.

**Step 3: Write minimal implementation**

In `ReservesTable.tsx`:

- replace the current expanded-row bridge block
- remove:
  - the absolute bridge rect
  - the current SVG fill/stroke patch pair
  - the connector logic that depends on border overlap
- render `MobileExpandedReserveShell` instead

In `MobileReserveCard.tsx`:

- keep `upperOnly`, `full`, and `simulationOnly` content behavior
- simplify `connectedBelow` styling so the upper card only suppresses the local edge that is now owned by the shell
- avoid redundant border ownership between the upper card and the shell connector zone

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/MobileExpandedReserveShell.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/dashboard/ReservesTable.tsx src/components/dashboard/MobileReserveCard.tsx
git commit -m "Refactor mobile reserve expanded connector ownership"
```

### Task 3: Verify no content or layout regressions outside the seam fix

**Files:**
- Modify if needed: `e2e/` mobile reserve coverage only if current tests need explicit selector updates

**Step 1: Add or update a mobile smoke check**

Add one Playwright test at mobile viewport that:

- expands a mobile reserve card
- verifies the simulation panel is visible
- verifies the sibling card remains visible
- verifies only one expanded shell exists

Do not make this a pixel-perfect screenshot test; make it a structure/behavior test.

**Step 2: Run targeted tests**

Run:

```bash
npx vitest run src/components/dashboard/MobileExpandedReserveShell.test.tsx
npx playwright test --grep "mobile reserve"
npm run lint
```

Expected:

- Vitest passes
- mobile Playwright checks pass
- lint passes

**Step 3: Manual verification on real iPhone**

Verify on real-device iPhone Safari and iPhone Chrome:

- no faint seam in the connector zone
- no extra vertical line in the gutter beside the expanded card
- no clipping at the concave corner
- no change to simulation content, spacing, or tap targets

**Step 4: Commit**

```bash
git add e2e
git commit -m "Add mobile expanded reserve seam regression coverage"
```

### Task 4: Update the guardrail docs

**Files:**
- Modify: `docs/design/frontend-interaction-guardrails.md`

**Step 1: Document the new invariant**

Add a short mobile-reserve note:

- expanded mobile reserve rows must use a single connector owner
- do not reintroduce bridge-rect + patch-stitch construction
- iPhone Chrome and Safari both count as WebKit validation targets

**Step 2: Verify docs diff**

Run: `git diff -- docs/design/frontend-interaction-guardrails.md`

Expected: one small normative addition, no unrelated doc churn.

**Step 3: Commit**

```bash
git add docs/design/frontend-interaction-guardrails.md
git commit -m "Document mobile reserve connector guardrail"
```

## Why this is the recommended fix

- It keeps content and behavior stable.
- It removes the current multi-border stitch-up that iOS WebKit exposes.
- It matches the repo rule in `AGENTS.md`: fix geometry from a single contour source, not patch-on-top-of-patch.

## Fallback options

### Fallback A: Keep current structure and only retune offsets

- Lowest implementation effort
- Highest recurrence risk
- Not recommended because this bug already survived desktop/Android verification and only shows up on real iPhone WebKit

### Fallback B: Make the expanded mobile reserve become a full-width stacked card

- Most robust visually
- Bigger UX/layout change
- Not recommended unless we decide the paired 2-column expanded layout is no longer worth the connector complexity
