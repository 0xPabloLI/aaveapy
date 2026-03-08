# Global Reserve Simulation Inputs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move reserve simulation amounts from per-row inputs to a single table-level shared scenario that updates every displayed reserve consistently.

**Architecture:** Extract the simulation math in `useRateSimulation` into a pure builder so both table cells and expanded breakdown panels consume the same computed result. Add one shared resource layer for rate inputs, forecast states, and token prices, then wire desktop and mobile UIs to a common global `supply` and `borrow` scenario.

**Tech Stack:** React, TypeScript, TanStack Query, Vitest, Tailwind

### Task 1: Pure simulation builder

**Files:**
- Modify: `src/hooks/useRateSimulation.ts`
- Test: `src/hooks/useRateSimulation.test.ts`

**Step 1: Write the failing test**

Add tests for an exported pure builder that:
- recalculates `supply`, `spread`, `borrow`, and `utilization` from one combined `supplyInput` + `borrowInput`
- returns the same "after" values used by row summaries and expanded breakdowns

**Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useRateSimulation.test.ts`

**Step 3: Write minimal implementation**

Extract the current memo-heavy math into a reusable exported builder and keep the hook as a thin resource wrapper.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/hooks/useRateSimulation.test.ts`

### Task 2: Shared simulation resources

**Files:**
- Modify: `src/hooks/useRateSimulation.ts`
- Modify: `src/hooks/useReserveRateInputs.ts`

**Step 1: Write the failing test**

Add coverage for mapping snapshot entries to reserves and for merged forecast state usage when multiple reserves are visible.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useRateSimulation.test.ts`

**Step 3: Write minimal implementation**

Expose a batch resource hook or pure helpers that let the table fetch:
- one rate-input snapshot
- one merged forecast-state batch
- one token-price map keyed by reserve id

**Step 4: Run test to verify it passes**

Run: `npm test -- src/hooks/useRateSimulation.test.ts`

### Task 3: Table-level shared inputs

**Files:**
- Modify: `src/components/dashboard/ReservesTable.tsx`

**Step 1: Write the failing test**

If practical, add a component test; otherwise rely on the pure helper tests and implement with minimal UI churn.

**Step 2: Write minimal implementation**

Add a shared scenario toolbar with `Supply amount` and `Borrow amount` inputs. Use the shared simulation results for sort values and displayed row values.

**Step 3: Run verification**

Run: `npm test -- src/hooks/useRateSimulation.test.ts src/lib/interestRateCalculator.test.ts`

### Task 4: Expanded detail panels

**Files:**
- Modify: `src/components/dashboard/SimulationSubRow.tsx`
- Modify: `src/components/dashboard/MobileReserveCard.tsx`

**Step 1: Write the failing test**

Reuse pure helper tests to guarantee the expanded panel receives the same simulation result as the main row.

**Step 2: Write minimal implementation**

Remove local inputs from `SimulationSubRow`, keep it as a breakdown/detail renderer, and show the active shared scenario amounts in the header. Update mobile to use the same shared scenario.

**Step 3: Run verification**

Run: `npm test -- src/hooks/useRateSimulation.test.ts src/lib/interestRateCalculator.test.ts`

### Task 5: Final verification

**Files:**
- Modify as needed: `docs/frontend-interaction-guardrails.md`

**Step 1: Run the focused test suite**

Run: `npm test -- src/lib/interestRateCalculator.test.ts src/hooks/useRateSimulation.test.ts`

**Step 2: Run lint**

Run: `npm run lint`

**Step 3: Run build**

Run: `npm run build`
