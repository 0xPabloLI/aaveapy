# AAV-749 Regression Diagnosis — Portfolio Simulation Results Missing for Non-Current Chain Entries

## Bug 现象

当 chain filter 选了特定链（如 Ink）时，Portfolio 中属于其他链的 entry（如 Celo USDT）虽然仍然显示，但其 simulation result 为空 — PortfolioSummary 显示 Total Supply $0 / Total Borrow $0，该 entry 的 supply/borrow APY 等数据缺失。

## 根因

`usePortfolioToggle`（`src/hooks/reserves-table/usePortfolioToggle.ts`）接收的 `reserves` 参数来自 ReservesTable 的 `reserves` prop，即 `filteredReserves`（被 chain filter 过滤后的子集）。

当 chain filter 选 Ink 时，`filteredReserves` 只包含 Ink 链的 reserves。Celo USDT 的 reserve 不在其中 → `reserveMap.get(celoUsdtReserveId)` 返回 `undefined` → entry 在 simulation 计算中被跳过。

**关键代码路径**：

1. `src/components/dashboard/ReservesTable.tsx` L836-842:
```typescript
} = usePortfolioToggle({
  isPortfolioMode,
  reserves,          // ← filteredReserves，不是全量
  entries: portfolioEntries,
  ...
});
```

2. `src/hooks/reserves-table/usePortfolioToggle.ts` L132:
```typescript
const { results, summary } = simulatePortfolioFromEntries({
  entries: effectiveEntries,
  reserves,   // ← 传入的是 filtered reserves
  ...
});
```

3. `src/hooks/reserves-table/usePortfolioToggle.ts` L140:
```typescript
const reserveMap = new Map(reserves.map((r) => [getReserveKey(r), r]));
// ← filtered reserves → 非 Ink 链的 reserve 查不到
```

## 不是 commit 回归

AAV-749 原始修复（commit `8be56015`）只修了 PortfolioPanel 的 `disabledNotice` 兜底和 `reserves` prop 来源（改用 `allReserves`），**但 `usePortfolioToggle` 的 simulation 计算从未修过** — 从一开始就用的是 `filteredReserves`。

用户之前可能没遇到，是因为测试时可能：
- 用了 "All chains" 模式（filteredReserves = allReserves）
- Portfolio 中只添加了当前 chain filter 下的 token

## 修复方案

跟 PortfolioPanel 同样的模式：`usePortfolioToggle` 新增 `allReserves` 参数，simulation 和 reserveMap 使用全量 reserves。

### 修改文件清单

1. **`src/hooks/reserves-table/usePortfolioToggle.ts`**
   - 接口新增 `allReserves?: ReserveWithSpread[]`
   - L132: `simulatePortfolioFromEntries` 的 `reserves` 改为 `allReserves ?? reserves`
   - L140: `reserveMap` 改为 `new Map((allReserves ?? reserves).map(...))`
   - L168: `useMemo` deps 加 `allReserves`

2. **`src/components/dashboard/ReservesTable.tsx`**
   - L836-842: `usePortfolioToggle` 调用处新增 `allReserves` prop

### 对应测试

- `src/hooks/reserves-table/usePortfolioToggle.test.ts` — 需要新增测试：chain filter 过滤后，portfolio 中非当前链 entry 仍能计算出 simulation result
- 可能还需要检查 `simulatePortfolioFromEntries` 的测试

## 设计决策参考

grill-with-docs Q1 确认：**Portfolio 完全独立于 chain filter**。Chain filter = "数据视角"切换（我看哪条链的数据），Portfolio = "资产组合"管理（我持有什么，跨链的），两者应该正交。

## 当前代码中 AAV-749 修复状态

| 组件 | 用的 reserves | 状态 |
|------|-------------|------|
| PortfolioPanel (disabledNotice) | `allReserves` | ✅ 已修复 |
| PortfolioPanel (search pool) | `allReserves` (via reserves prop) | ✅ 已修复 |
| PortfolioPanel (popular tokens) | `allReserves` (via reserves prop) | ✅ 已修复 |
| **usePortfolioToggle (simulation)** | **`reserves` (filtered)** | ❌ 未修复 |
| **usePortfolioToggle (reserveMap fallback)** | **`reserves` (filtered)** | ❌ 未修复 |
| **simulatePortfolioFromEntries** | **`reserves` (from toggle, filtered)** | ❌ 未修复 |

## TDD Red→Green 清单

1. **RED**: 写测试 — usePortfolioToggle 在 `reserves` 为 filtered 子集、`allReserves` 为全量时，非当前链 entry 的 simulation result 不为空
2. **GREEN**: 实现 — 传入 `allReserves`，simulation/reserveMap 用 `allReserves ?? reserves`
3. 验证 gate: `npm run lint && npm test && npm run build && npx tsc --noEmit`
4. 浏览器验证：Ink chain filter 下，Celo USDT entry 有 simulation result
