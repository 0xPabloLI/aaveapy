# AAV-749 Regression Diagnosis — Portfolio Simulation Results Missing for Non-Current Chain Entries

## Bug 现象

当 chain filter 选了特定链（如 Ink）时，Portfolio 中属于其他链的 entry（如 Celo USDT）虽然仍然显示，但其 simulation result 为空 — PortfolioSummary 显示 Total Supply $0 / Total Borrow $0，该 entry 的 supply/borrow APY 等数据缺失。

## 根因

`usePortfolioToggle`（`src/hooks/reserves-table/usePortfolioToggle.ts`）接收的 `reserves` 参数来自 ReservesTable 的 `reserves` prop，即 `filteredReserves`（被 chain filter 过滤后的子集）。

当 chain filter 选 Ink 时，`filteredReserves` 只包含 Ink 链的 reserves。Celo USDT 的 reserve 不在其中 → `reserveMap.get(celoUsdtReserveId)` 返回 `undefined` → entry 在 simulation 计算中被跳过。

**关键代码路径**：

1. `src/components/dashboard/ReservesTable.tsx`:
```typescript
} = usePortfolioToggle({
  isPortfolioMode,
  reserves,          // ← filteredReserves，不是全量
  entries: portfolioEntries,
  ...
});
```

2. `src/hooks/reserves-table/usePortfolioToggle.ts`:
```typescript
const { results, summary } = simulatePortfolioFromEntries({
  entries: effectiveEntries,
  reserves,   // ← 传入的是 filtered reserves
  ...
});
```

3. `src/hooks/reserves-table/usePortfolioToggle.ts`:
```typescript
const reserveMap = new Map(reserves.map((r) => [getReserveKey(r), r]));
// ← filtered reserves → 非 Ink 链的 reserve 查不到
```

## 不是 commit 回归

AAV-749 原始修复（commit `8be56015`）只修了 PortfolioPanel 的 `disabledNotice` 兜底和 `reserves` prop 来源（改用 `allReserves`），**但 `usePortfolioToggle` 的 simulation 计算从未修过** — 从一开始就用的是 `filteredReserves`。

## 已实施的修复 (commit d9fb2733)

### 设计决策（grill-with-docs 确认）

1. **Portfolio 完全独立于 chain filter** — 两者正交，chain filter 是数据视角切换，Portfolio 是跨链资产组合管理
2. **`allReserves` required 而非 optional** — filtered reserves 依赖 all reserves 存在，TypeScript required 参数保证不可漏传，消除"忘记传就静默 fallback 到 filtered"的风险
3. **删除冗余参数** — 修复后 `reserves`（filtered）在 `usePortfolioToggle` 中零用途，直接让 `reserves` 参数承载全量语义

### 实际修改

1. **`src/components/dashboard/ReservesTable.tsx`**
   - `ReservesTableProps.allReserves`: `optional` → `required`
   - `usePortfolioToggle({ reserves: allReserves })` — 传全量而非 filtered

2. **`src/hooks/reserves-table/usePortfolioToggle.ts`** — **零修改**
   - hook 内部代码不变，`reserves` 参数名不变但调用方语义从 filtered 变为全量

3. **`src/hooks/reserves-table/usePortfolioToggle.test.ts`** — 新增 2 个 regression test:
   - `AAV-749: cross-chain entry missing results when reserves is filtered subset (bug scenario)` — 验证 filtered 场景下跨链 entry 无结果（bug 行为）
   - `AAV-749: cross-chain entry has results when reserves includes all chains (fixed scenario)` — 验证全量 reserves 下跨链 entry 有结果（修复后行为）

4. **`src/components/dashboard/ReservesTable.test.tsx`** — 3 处 `<ReservesTable>` 加 `allReserves` prop（required 后必须传）

## 修复后状态

| 组件 | 用的 reserves | 状态 |
|------|-------------|------|
| PortfolioPanel (disabledNotice) | `allReserves` | ✅ 已修复 |
| PortfolioPanel (search pool) | `allReserves` (via reserves prop) | ✅ 已修复 |
| PortfolioPanel (popular tokens) | `allReserves` (via reserves prop) | ✅ 已修复 |
| usePortfolioToggle (simulation) | `allReserves` (via ReservesTable) | ✅ 已修复 (d9fb2733) |
| usePortfolioToggle (reserveMap fallback) | `allReserves` (via ReservesTable) | ✅ 已修复 (d9fb2733) |
| simulatePortfolioFromEntries | `allReserves` (from toggle) | ✅ 已修复 (d9fb2733) |

## 验证 gate

- `npm run lint` ✅ (0 errors, 1 pre-existing warning)
- `npx tsc --noEmit` ✅
- `npm test` ✅ (31/31 usePortfolioToggle, 4/4 ReservesTable)
- `npm run build` ✅

## Linear Issues

- **AAV-817**: PRD (parent)
- **AAV-818**: TDD RED test
- **AAV-819**: TDD GREEN fix
- **AAV-820**: Browser verification (deferred — needs live chain environment)

## 经验教训

- **required > optional + fallback**: 当 optional 参数的 fallback 恰好是 bug 行为（filtered 而非全量），optional 反而掩盖了问题。TypeScript required 参数在编译时拦截，比运行时 fallback 更安全。
- **调用方语义比 hook 接口更重要**: `usePortfolioToggle` 的 `reserves` 参数名不变，但调用方从传 filtered 改为传全量，bug 就修了。hook 内部代码零修改。
