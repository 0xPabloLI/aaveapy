# ADR-014: PortfolioReserveEntry per-reserve data model

## Status

Accepted

## Context

Supply-Borrow Inseparability is a domain constraint (CONTEXT.md): a reserve's supply and borrow always operate as a unit. The current data model uses `PortfolioPosition` (per-side), requiring runtime grouping (`groupedByReserve`) and API-level guard rails to prevent single-side operations. This has caused bugs (AAV-631, AAV-678) and leaves dead API surface (`addPosition`, `removePosition`, `toggleHidden`).

## Decision

Replace `PortfolioPosition` (per-side) with `PortfolioReserveEntry` (per-reserve) as the core data model. Supply and borrow become non-null properties of an entry, making single-side absence a compile-time impossibility.

### Type definitions

```ts
interface PortfolioReserveEntry {
  reserveId: string;
  marketName: string;
  chainName: string;
  tokenSymbol: string;
  supply: PortfolioSideData;  // always present
  borrow: PortfolioSideData;  // always present
  hidden: boolean;
  isOrphan: boolean;
}

interface PortfolioSideData {
  amount: string;
  inputMode: PortfolioInputMode;
  walletValue: number | null;
  source?: PositionSource;
}
```

- `supply` / `borrow` are **never null**. Even when a reserve cannot supply or borrow, the side data exists with `amount: ''` and `walletValue: null`. The UI renders a disabled input (greyed out + tooltip) based on `isSupplyDisabled(reserve)` / `isBorrowDisabled(reserve)` at render time — matching the existing ReservesTable behavior.
- `positionId` is eliminated. All operations use `(reserveId, side)` as the locator.
- `PortfolioPositionResult` remains per-side (supply/borrow have different math semantics) but uses `(reserveId, side)` as key instead of `positionId`.

### API surface

```ts
interface PortfolioSimulationActions {
  // Reserve lifecycle (structural)
  addReserve(reserveId: string, marketName: string, chainName: string, tokenSymbol: string): void;
  removeReserve(reserveId: string): void;
  hideReserve(reserveId: string): void;
  unhideReserve(reserveId: string): void;

  // Reserve value mutations (property-level)
  updateReserve(reserveId: string, patch: ReservePatch, priceInUsd?: number): void;

  // Wallet restore (side optional; omit = both sides)
  restoreToWallet(reserveId: string, side?: PortfolioSide): void;

  // Batch import
  importReserves(entries: PortfolioReserveEntry[]): void;

  // Global / snapshot (unchanged)
  clearAll(): void;
  setActive(active: boolean): void;
  saveSnapshot(label: string, results: PortfolioPositionResult[], summary: PortfolioSummary): void;
  deleteSnapshot(snapshotId: string): void;
  undoLastRemove(): boolean;
}

interface ReservePatch {
  supplyAmount?: string;
  supplyInputMode?: PortfolioInputMode;
  borrowAmount?: string;
  borrowInputMode?: PortfolioInputMode;
}
```

### Removed APIs

| Removed | Replacement |
|---------|------------|
| `addPosition({side, ...})` | `addReserve(reserveId, ...)` |
| `removePosition(positionId)` | `removeReserve(reserveId)` |
| `toggleHidden(positionId)` | `hideReserve(reserveId)` |
| `restorePosition(positionId)` | `unhideReserve(reserveId)` |
| `updateAmount(positionId, amount)` | `updateReserve(reserveId, {supplyAmount/borrowAmount})` |
| `updateInputMode(positionId, mode, price?)` | `updateReserve(reserveId, {supplyInputMode/borrowInputMode}, price?)` |
| `hideOrRemoveReserveAction(reserveId)` | `hideReserve(reserveId)` or `removeReserve(reserveId)` (callers decide) |

### Implementation path (gradual — each step independently committable)

1. **Type + Hook layer**: Define `PortfolioReserveEntry`/`PortfolioSideData` in `portfolio.ts`. Refactor `usePortfolioSimulation` to manage `PortfolioReserveEntry[]` internally, expose new API surface. Adapt `walletPositionToPortfolio` to output `PortfolioReserveEntry[]`. Delete dead code (`toggleHidden`, `removePosition`, `addPosition`).
2. **Downstream logic**: Adapt `portfolioCalculator`, `portfolioMerger`, `portfolioSoftDelete`, `portfolioWalletSync` to consume/produce `PortfolioReserveEntry`.
3. **UI layer**: `PortfolioPanel` removes `groupedByReserve` (data is already per-reserve). `PortfolioTokenRow` receives `PortfolioReserveEntry` prop. `PortfolioResultsTable`/`PortfolioCompareView`/`PortfolioSummaryCard`/`PortfolioPositionRow` adapt.
4. **Cleanup**: Delete `PortfolioPosition` type, remove `groupedByReserve` runtime merge, remove `getGroupSoftDeleteAction` (no longer needed — entry is already a group), update `architecture-guard.test.ts`, update all co-located tests.

## Consequences

### Positive
- **Compile-time inseparability**: TypeScript makes single-side absence impossible — stronger than runtime guards or architecture tests.
- **Simpler API surface**: 14 → 10 actions, no per-side structural operations.
- **No runtime grouping**: `groupedByReserve` in `PortfolioPanel` eliminated; data model is already grouped.
- **Domain alignment**: Maps directly to Aave's Reserve model (reserve is atomic, supply/borrow are attributes).

### Negative
- **Scope**: ~20 files, all portfolio/reserves-table hooks + components + tests.
- **Snapshot format break**: `PortfolioSnapshot.positions` changes from `PortfolioPosition[]` to `PortfolioReserveEntry[]`. Mitigated: snapshots are in-memory only (no localStorage), no migration needed.
- **Merge with upstream**: Any concurrent changes to portfolio types/hooks must coordinate.

## Related Issues

AAV-637, AAV-631, AAV-678
