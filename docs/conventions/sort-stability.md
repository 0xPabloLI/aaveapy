# Sort Stability Convention

## Problem

JavaScript's `Array.prototype.sort` is **not guaranteed stable** in all engines. While V8 (Chrome/Node) has used TimSort since v7.0 and is stable for most cases, the spec does not require it. More critically, when a comparator returns `0` for two distinct items, their relative order is **undefined** — they may swap positions on every re-sort, which is the bug observed in AAV-203.

## Rule

**Every sort comparator must produce a total order** (also called a "strict weak ordering with no ties"). Concretely:

- When the primary key comparison returns `0`, **always** fall through to a deterministic tiebreaker.
- The tiebreaker must uniquely identify each item. In ReservesTable, `reserveId` is the canonical tiebreaker because it is the required identity field from the `/markets` API.

## Current implementation (ReservesTable)

| Column | Comparison chain |
|--------|-----------------|
| token | `tokenSymbol` → `marketName` → `reserveId` |
| market | `marketName` → `tokenSymbol` → `reserveId` |
| price | `tokenPrice` → `reserveId` |
| size | metric value → `reserveId` |
| util | metric value → `reserveId` |
| supply (native/total) | APY value → `reserveId` |
| supply (incentive) | `compareIncentiveWithNative` result → `reserveId` |
| borrow (native/total) | APY value → `reserveId` |
| borrow (incentive) | `compareIncentiveWithNative` result → `reserveId` |
| spread | spread value → `reserveId` |

## Checklist for new sort columns or comparators

1. Does the comparator ever return `0` for two different items?
   - If yes, add a `reserveId.localeCompare(b.reserveId)` fallback (string columns) or `a.reserveId.localeCompare(b.reserveId)` (numeric columns when primary comparison is `0`).
2. For `null`/`undefined` handling: when both values are `null`, **do not** `return 0` — return the `reserveId` tiebreaker instead.
3. For compound comparators (e.g. `compareIncentiveWithNative`): capture the result, and if `result === 0`, fall through to `reserveId`.

## Anti-patterns

- `return 0` when `a !== b` — this is the root cause of AAV-203. Even if items appear identical by the sort key, they are distinct rows and must not compare as equal.
- Relying on array input order as implicit stability — `Array.sort` does not preserve original order for equal elements in all engines.
- Using non-unique keys as tiebreaker (e.g. `marketName`) — must be truly unique per item.

## Historical note (AAV-203)

Token sort only compared `tokenSymbol`. Multiple reserves sharing the same symbol (same token, different markets) compared as `0`, so their order was non-deterministic across refreshes. All numeric columns had the same latent bug — fixed by adding `reserveId` tiebreaker everywhere.

## References

- `src/components/dashboard/ReservesTable.tsx` — `sortedData` useMemo
- `src/lib/sorters.ts` — `compareIncentiveWithNative`
- `docs/conventions/frontend-regression-checklist.md` — ReservesTable section
