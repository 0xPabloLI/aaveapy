# ADR 0022: Disabled-First Sorting in Reserves Table

## Status

Accepted

## Context

Reserves Table 支持按 Supply、Borrow、Spread 列排序。某些 reserve 的 supply 或 borrow 功能被禁用（`isSupplyDisabled`/`isBorrowDisabled` 返回 true），包括：

- Protocol restriction（`isPaused`/`isFrozen`/`!isActive`）
- Per-side disabled 标志（`supplyDisabled`/`borrowDisabled`）

用户希望排序时，disabled 的 reserve 排在正常 reserve 后面，无论其数值高低。这样用户可以优先看到可用的 reserve。

## Decision

实现 disabled-first 排序逻辑：

### Supply/Borrow 排序

按 Supply 排序时，`isSupplyDisabled` 为 true 的 reserve 排在后面。
按 Borrow 排序时，`isBorrowDisabled` 为 true 的 reserve 排在后面。

### Spread 排序

按 Spread 排序时，只要 `isSupplyDisabled` 或 `isBorrowDisabled` 任一边为 true，该 reserve 就排在后面。

### 实现细节

1. **接口扩展**：`ReserveSortValueGetters` 新增 `isSupplyDisabled` 和 `isBorrowDisabled` 方法
2. **排序逻辑**：
   - `compareSupplyOrBorrow` 新增 `isDisabled` 参数，disabled 优先排后
   - `compareBySpread` 检查 supply 或 borrow 任一边 disabled，排后
   - 两边都 disabled 时，按正常值排序
3. **调用方**：`ReservesTable.tsx` 在 valueGetters 中传入 `isSupplyDisabled`/`isBorrowDisabled`

### 代码示例

```typescript
export function compareSupplyOrBorrow<R>(
  a: R,
  b: R,
  sortMode: SortMode,
  order: SortOrder,
  getNative: (r: R) => number | null,
  getIncentive: (r: R) => number | null,
  getTotal: (r: R) => number | null,
  hasIncentiveSource: (r: R) => boolean,
  isDisabled: (r: R) => boolean,  // 新增参数
  vg: ReserveSortValueGetters<R>,
): number {
  const aDisabled = isDisabled(a);
  const bDisabled = isDisabled(b);
  if (aDisabled !== bDisabled) {
    return aDisabled ? 1 : -1;  // disabled 排后
  }
  // ... 原有排序逻辑
}

function compareBySpread<R>(
  a: R,
  b: R,
  order: SortOrder,
  vg: ReserveSortValueGetters<R>,
): number {
  const aSupplyDisabled = vg.isSupplyDisabled(a);
  const bSupplyDisabled = vg.isSupplyDisabled(b);
  const aBorrowDisabled = vg.isBorrowDisabled(a);
  const bBorrowDisabled = vg.isBorrowDisabled(b);
  const aDisabled = aSupplyDisabled || aBorrowDisabled;  // 任一边 disabled
  const bDisabled = bSupplyDisabled || bBorrowDisabled;
  if (aDisabled !== bDisabled) {
    return aDisabled ? 1 : -1;  // disabled 排后
  }
  // ... 原有排序逻辑
}
```

## Consequences

### Positive

- 用户优先看到可用的 reserve，提升可用性
- disabled 的 reserve 仍然参与排序，但在后面按值排序
- 测试覆盖完整（11 个新测试用例）

### Negative

- 排序逻辑稍微复杂，需要理解 disabled 优先级
- 需要维护 `isSupplyDisabled`/`isBorrowDisabled` 在 valueGetters 中

## Testing

新增 11 个测试用例覆盖：

- Supply 排序：disabled 排后面（desc/asc）
- Borrow 排序：disabled 排后面（desc/asc）
- Spread 排序：任一边 disabled 排后面
- 两边都 disabled：按值正常排序
- 混合场景：supply disabled 不影响 borrow 排序，反之亦然

## Related Files

- `src/lib/reservesSorter.ts` - 核心排序逻辑
- `src/lib/reservesSorter.test.ts` - 测试用例
- `src/components/dashboard/ReservesTable.tsx` - 调用方，传入 valueGetters
- `src/lib/reserveStatus.ts` - 定义 `isSupplyDisabled`/`isBorrowDisabled`
