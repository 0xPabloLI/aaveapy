# PRD: Portfolio 模式下 Merkl 跨 Reserve Offset Note 文案修复

## 需求背景

Portfolio Simulation 模式下，ReservesTable 行内的 Merkl incentive 跨 reserve offset note 文案不会显示。根因是 `ReservesTable.tsx:245-264` 构建 `crossReservePositions` 时，在 Portfolio 模式下从 `debouncedSharedSupplyInput`/`debouncedSharedBorrowInput`（Portfolio 下为空字符串）构建，导致 `parseNumberInput('') = 0`，`crossReservePositions` 恒为 `undefined`。

这同时导致两个问题：
1. **Note 文案缺失**：`merklCrossReserveNote` 返回 `null`，用户看不到跨 reserve offset 说明（如 "minus USDC borrows on Aave"）
2. **Merkl APR 数值偏高**：`merklGroupMultiplier` 中 `crossReserveRatio` 退化为 1，不做跨 reserve offset 缩放

注意：`portfolioSimulator.ts:169` 内部独立构建了正确的 `crossReservePositions`，PortfolioPanel 的汇总数据是正确的。此 Bug 只影响 ReservesTable 行内展示。

## 目标与价值

**目标：**
- Portfolio 模式下 `crossReservePositions` 从 `perReserveInputs`（total position = wallet + delta）正确构建
- Merkl 跨 reserve offset note 文案在 Portfolio 模式下正确显示
- Merkl APR 的 `merklGroupMultiplier` 在 Portfolio 模式下正确应用跨 reserve 缩放
- `reserveSymbolById` 同步正确构建，支持 note 中显示 offset reserve 的 token symbol

**价值：**
- Portfolio 模式用户能看到完整的跨 reserve offset 信息，做出更准确的投资判断
- Merkl APR 数值与 PortfolioPanel 一致，消除两处展示的数据偏差
- 统一 single simulation 和 portfolio simulation 两条路径的 crossReservePositions 构建逻辑

## 名词解释

- **crossReservePositions**：`Map<reserveId, { supplyUsd, borrowUsd }>`，记录各 reserve 的总仓位（wallet + delta），用于 Merkl 跨 reserve net eligibility 计算
- **merklCrossReserveNote**：生成 "X of Y net eligible (supply minus USDC borrows)" 文案的函数
- **merklGroupMultiplier**：Merkl APR 的 eligibility 缩放因子，`crossReserveRatio` 为 1 时无缩放
- **perReserveInputs**：`Map<reserveId, PerReserveInput>`，Portfolio 模式下各 reserve 的输入数据，含 `totalSupplyUsd`/`totalBorrowUsd`（wallet + delta）

## 适用范围

- 适用：Portfolio Simulation 模式下的 ReservesTable 行内展示
- 适用：所有有 `netPositionConstraint` 的 Merkl campaign
- 不适用：Single/Shared Scenario 模式（已有正确逻辑）
- 不适用：PortfolioPanel 汇总（已有正确逻辑）

## 非目标

- 不修改 `portfolioSimulator.ts` 内部的 `crossReservePositions` 构建逻辑
- 不修改 `buildPerReserveInputsFromEntries` 的签名或返回结构
- 不涉及 Brevis/Merit 的 position cap 逻辑

## 功能需求

- FR-1: `ReservesTable.tsx` 中 `crossReservePositions` 的 useMemo 在 Portfolio 模式下必须从 `perReserveInputs` 的 `totalSupplyUsd`/`totalBorrowUsd` 构建，而非从 `debouncedSharedSupplyInput`/`debouncedSharedBorrowInput` 构建
- FR-2: `reserveSymbolById` 的 useMemo 必须同步更新依赖，在 Portfolio 模式下从 `perReserveInputs` 关联的 reserves 中获取 `tokenSymbol`
- FR-3: 代码顺序需调整——`perReserveInputs` 的计算必须先于 `crossReservePositions`（当前 `perReserveInputs` 在第 275 行，`crossReservePositions` 在第 245 行）
- FR-4: Shared Scenario 模式下的 `crossReservePositions` 构建逻辑保持不变（从 shared inputs 构建，且 `isPortfolioMode = false` 时返回 `undefined`）
- FR-5: `merklGroupMultiplier` 在 Portfolio 模式下必须使用正确的 `crossReserveRatio`（不再退化为 1）
- FR-6: 新增/更新单元测试覆盖 Portfolio 模式下 `crossReservePositions` 的构建

## 关键流程/交互说明

**Portfolio 模式 crossReservePositions 构建流程（修复后）：**
1. `portfolioEntries` → `buildPerReserveInputsFromEntries()` → `perReserveInputs`
2. `perReserveInputs` 遍历，取 `totalSupplyUsd ?? 0` / `totalBorrowUsd ?? 0` 构建 `crossReservePositions`
3. `crossReservePositions` 传入 `useSharedRateSimulations`
4. `buildRateSimulationResult` 内 `merklCrossReserveNote` 能正确计算跨 reserve offset
5. `merklGroupMultiplier` 能正确应用 `crossReserveRatio`

**代码顺序调整：**
- 原顺序：`crossReservePositions`(245) → `reserveSymbolById`(256) → `perReserveInputs`(275)
- 新顺序：`perReserveInputs` → `crossReservePositions` → `reserveSymbolById`

## 风险与依赖

**风险：**
- useMemo 依赖变更可能导致不必要的 re-render，需确认 `perReserveInputs` 的引用稳定性
- 代码顺序调整涉及多个 useMemo 的依赖链，需确保不引入循环依赖

**依赖：**
- `perReserveInputs` 的 `totalSupplyUsd`/`totalBorrowUsd` 字段已正确填充（由 `buildPerReserveInputsFromEntries` 保证）
- `ReservePositions` 类型（`{ supplyUsd: number; borrowUsd: number }`）不变

## 验收标准

- [ ] Portfolio 模式下 `crossReservePositions` 不为 `undefined`（当 entries 有仓位时）
- [ ] Portfolio 模式下 Merkl 跨 reserve offset note 文案正确显示（如 "X of Y net eligible (supply minus USDC borrows)"）
- [ ] Portfolio 模式下 `merklGroupMultiplier` 的 `crossReserveRatio` 不退化为 1（当有跨 reserve offset 时）
- [ ] Shared Scenario 模式下行为不变
- [ ] ReservesTable 行内 Merkl APR 与 PortfolioPanel 汇总的 Merkl APR 一致
- [ ] 单元测试覆盖 Portfolio 模式下 `crossReservePositions` 构建
- [ ] `npm run lint && npm test && npm run build && npx tsc --noEmit` 全部通过

## 待确认问题

- `perReserveInputs` 的 `totalSupplyUsd`/`totalBorrowUsd` 为 `undefined` 时应视为 0 还是跳过该 reserve？（当前推导：视为 0，与 `portfolioSimulator.ts:169` 一致）
- 是否需要将 `buildPerReserveInputsFromEntries` 扩展为同时返回 `crossReservePositions` 和 `reserveSymbolById`？（方案 B：减少 ReservesTable 中的重复计算，但增加函数签名复杂度）
