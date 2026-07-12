# Spec: Wallet Position Explicit Passing (Eliminate Reverse Derivation)

## Status

Draft

## Context

### Problem

`buildRateSimulationResult` derives wallet positions by reverse calculation:

```typescript
const walletSupplyUsd = explicitWalletSupplyUsd ?? (totalSupplyUsd != null
    ? totalSupplyUsd - rawSupplyInputUsd : undefined);
const walletBorrowUsd = explicitWalletBorrowUsd ?? (totalBorrowUsd != null
    ? totalBorrowUsd - rawBorrowInputUsd : undefined);
```

This fallback is fragile:
- AAV-1120 was caused by using capped `borrowInputUsd` instead of `rawBorrowInputUsd` in this derivation
- The caller (`buildPerReserveInputsFromEntries`) already has `walletValue` explicitly but discards it, only passing `totalSupplyUsd` (wallet + delta) and `supplyInput` (delta)
- The calculator's `BuildRateSimulationResultParams` already has `walletSupplyUsd`/`walletBorrowUsd` parameters (added in AAV-771), but no production caller uses them

### Design Decision (Grill Session Conclusions)

1. **ADR-009 Alternative A does not conflict**: ADR-009 rejected "calculator internally looks up walletValue from context", not "caller explicitly passes walletValue parameter". Calculator remains a pure function.

2. **Remove fallback entirely**: `walletSupplyUsd`/`walletBorrowUsd` only from explicit parameters. No reverse derivation. This structurally prevents AAV-1120-class bugs.

3. **Manual entry (`walletValue = null`) → `undefined`**: When no wallet position exists, pass `undefined` (not `0`). Calculator's `hasWallet` check uses `!= null`, so `undefined` correctly triggers identity fallback (Golden Rule §3).

4. **Mixed wallet + manual entries on same reserveId**: Accumulate wallet values only from entries where `walletValue !== null`. Manual entries contribute to `totalSupplyUsd`/`totalBorrowUsd` but not to `walletSupplyUsd`/`walletBorrowUsd`.

5. **Live API tests must pass wallet values explicitly**: Tests that rely on fallback are testing the wrong path. Update them to pass `walletSupplyUsd`/`walletBorrowUsd` directly.

6. **AAV-1137 (cross-reserve wallet positions) is out of scope**: Pre-existing bug where `walletCrossReservePositions` uses total values for non-self reserves. Tracked separately.

## Changes

### 1. `PerReserveInput` interface (`portfolioSimulator.ts`)

Add two optional fields:

```typescript
export interface PerReserveInput {
  supplyInput: string;
  borrowInput: string;
  inputMode: ScenarioInputMode;
  totalSupplyUsd?: number;
  totalBorrowUsd?: number;
  walletSupplyUsd?: number;  // NEW: wallet-only supply position
  walletBorrowUsd?: number;  // NEW: wallet-only borrow position
}
```

### 2. `buildPerReserveInputsFromEntries` (`portfolioSimulator.ts`)

Extend grouped structure to track wallet values:

```typescript
const grouped = new Map<string, {
  supplyUsd: number;
  borrowUsd: number;
  supplyDeltaUsd: number;
  borrowDeltaUsd: number;
  walletSupplyUsd: number | undefined;  // NEW
  walletBorrowUsd: number | undefined;  // NEW
}>();
```

Accumulation logic: only accumulate `s.walletValue` when `s.walletValue !== null && s.walletValue > 0`. Initial value `undefined` (not `0`) to distinguish "no wallet" from "wallet is zero".

Output:

```typescript
perReserveInputs.set(reserveId, {
  supplyInput: String(group.supplyDeltaUsd),
  borrowInput: String(group.borrowDeltaUsd),
  inputMode: 'usd',
  totalSupplyUsd: group.supplyUsd,
  totalBorrowUsd: group.borrowUsd,
  walletSupplyUsd: group.walletSupplyUsd,   // NEW
  walletBorrowUsd: group.walletBorrowUsd,   // NEW
});
```

### 3. `useRateSimulation.ts` (call site 1)

Pass wallet values from `perReserveInputs`:

```typescript
buildRateSimulationResult({
  // ... existing params ...
  totalSupplyUsd: effectiveTotalSupplyUsd,
  totalBorrowUsd: effectiveTotalBorrowUsd,
  walletSupplyUsd: perReserve?.walletSupplyUsd,   // NEW
  walletBorrowUsd: perReserve?.walletBorrowUsd,   // NEW
});
```

### 4. `portfolioSimulator.ts` `simulatePortfolioFromEntries` (call site 2)

Pass wallet values from group:

```typescript
buildRateSimulationResult({
  // ... existing params ...
  totalSupplyUsd: group.supplyUsd,
  totalBorrowUsd: group.borrowUsd,
  walletSupplyUsd: group.walletSupplyUsd,   // NEW
  walletBorrowUsd: group.walletBorrowUsd,   // NEW
});
```

### 5. `rateSimulationCalculator.ts` (remove fallback)

```typescript
// BEFORE (with fallback):
const walletSupplyUsd = explicitWalletSupplyUsd ?? (totalSupplyUsd != null
    ? totalSupplyUsd - rawSupplyInputUsd : undefined);
const walletBorrowUsd = explicitWalletBorrowUsd ?? (totalBorrowUsd != null
    ? totalBorrowUsd - rawBorrowInputUsd : undefined);

// AFTER (direct use only):
const walletSupplyUsd = explicitWalletSupplyUsd;
const walletBorrowUsd = explicitWalletBorrowUsd;
```

### 6. Test updates

- `rateSimulationCalculator.test.ts`: ~25 tests that pass `totalSupplyUsd` without `walletSupplyUsd` need explicit wallet values added
- `rateSimulationCalculator.live.test.ts`: 5 test scenarios need `walletSupplyUsd`/`walletBorrowUsd` passed explicitly
- `portfolioSimulator.test.ts`: `toEqual` assertions need `walletSupplyUsd`/`walletBorrowUsd` fields added to expected objects

## Verification

- TDD: red → green → refactor per ticket
- Validation gate: `npm run lint && npm test && npm run build && npx tsc --noEmit`
- Live API tests: `npm run test:live:simulation:staging`
- Dev server + Playwright: verify Portfolio mode UI renders correctly with wallet positions

## Out of Scope

- AAV-1137: `walletCrossReservePositions` uses total for non-self reserves (separate issue)
- `crossReservePositions` map remains total-based (correct for after/simulation values)
- Single Mode path unaffected (no `perReserveInputs`, wallet values are `undefined` → identity)
