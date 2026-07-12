# AAV-761 Handoff: Supply Incentive → 0 When Borrow Has Input

## Original Issue

**Bug**: 当 Borrow 侧有输入时，在有 position cap 的 reserve（如 Celo USDT）上 Supply incentive 显示为 0.00%。

**场景**:
1. 用户有钱包仓位（wallet position），例如 Celo USDT 上 supply $1,042
2. 该 reserve 有 Merit Deposit Ceiling（position cap），例如 cap=$1,000
3. 用户在 Borrow 侧输入任意金额（如 $1）
4. 预期：Supply incentive 应显示稀释后的值（wallet > cap，只有 1000/1042 拿 incentive）
5. **实际**：Supply incentive 变为 0.00%

## 已排查的关键路径

### 1. UI 层：`pickScenarioValue` (ReservesTable.tsx)
```typescript
const pickScenarioValue = (current: number | null, after: number | null): number | null =>
    after ?? current;
```
如果 `afterIncentive = 0`（而非 null），`0 ?? current` = `0`，会覆盖 current。

### 2. 计算层：`supplyAfterIncentive` 的 per-side 守卫 (rateSimulationCalculator.ts L1459-1466)
```typescript
const supplyAfterIncentive = hasSupplyInput
    ? (supplyAfterIncentiveRaw !== null ? Math.min(supplyAfterIncentiveRaw, supplyCurrentIncentive) : null)
    : null;
```
当 `hasSupplyInput=false` 时 `afterIncentive=null`，这个守卫已经存在。但原始 bug 仍然出现，说明可能是 `afterIncentive` 在其他路径被错误覆写，或 UI 层有其他覆盖逻辑。

### 3. Campaign detail row 层 (L708-710, L756-758, L840-842, L943-945)
三个来源（Merit/Merkl/Brevis）的 campaign detail row 在 `hasAnyInput=true` 且 `hasSupplyInput=false` 时设 `after=null`。

### 4. Wallet position 推导 (L1260-1265)
```typescript
const walletSupplyUsd = explicitWalletSupplyUsd ?? (totalSupplyUsd != null
    ? totalSupplyUsd - supplyInputUsd
    : undefined);
```
无 `hasSupplyInput` 守卫，Deposit Ceiling 稀释始终计算。

## 本 Session 的改动（未 commit）

### 核心代码改动
- **`src/lib/rateSimulationCalculator.ts`**: 
  - 移除 `resolveBrevisForecastApr` 依赖，内联 Brevis forecast 逻辑到 `sumForecastBrevisValues` 和 `buildBrevisCampaignDetails`
  - `sumBrevisIncentiveApr` 不再接收 `forecastStates` 参数
  - **`deltaIncentive` 三态分路**: `hasInput=true` → `after - current`；`hasInput=false`+wallet → `current - headline`；其余 null
  - `computeBrevisPositionCapDetails` 参数重命名 `aprForCapCalc` → `nominalApr`

- **`src/lib/rateSimulationCalculator.test.ts`**:
  - 更新 deltaIncentive 测试断言：`toBe(0)` → `toBeLessThan(0)`
  - 移除 `resolveBrevisForecastApr` 相关测试（该函数已不存在）

### 文档改动
- **`AGENTS.md`**: 新增 lessons learned（deltaIncentive 三态分路、walletSupplyUsd 推导、AAV-761 回归修复等）
- **`CONTEXT.md`**: 伴随更新

### 其他改动
- `package-lock.json`, `public/openapi.json`, `src/App.tsx` — 伴随变更

### 未跟踪的调试文件
- `scripts/debug-*.py`, `scripts/verify-delta-display.mjs`, `src/pages/DebugDelta.tsx`, `output/`

## 验证要求（下次修复时必须执行）

### ⚠️ 必须在前端 UI 用 Playwright 验证

单元测试通过 ≠ 真实环境修复。下次修复必须：

1. **启动 dev server**: `npm run dev`
2. **用 Playwright 打开前端页面**: 使用 `webapp-testing` 或 `playwright` skill
3. **切换到 Celo 链**，找到 USD₮ (USDT) reserve
4. **进入 Portfolio 模式**，填入钱包地址 `0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314`
5. **确认 Supply 侧有 wallet position**（约 $1,042）
6. **在 Borrow 侧输入任意数字**（如 $1）
7. **截图并确认** Supply Incentive 列显示的值：
   - 不应为 0.00%
   - 应显示稀释后的值（因为 wallet > position cap）
   - 检查 `simulation.supply.afterIncentive` 和 `simulation.supply.currentIncentive` 的实际值

### 调试技巧
- 在浏览器 console 中检查 `simulation.supply` 对象：
  - `afterIncentive` 应为 `null`（hasInput=false → per-side guard）
  - `currentIncentive` 应为稀释后的值
  - `deltaIncentive` 应为负值（稀释缺口）
- `pickScenarioValue(current, after)` 中 `after=null` 时应回退到 `current`

## AAV-771 说明

AAV-771 是排查过程中发现的独立问题（wallet-only incentive delta 不显示），与 AAV-761 原始问题无关。AAV-771 的修复已经完成并通过测试，但不解决原始 "incentive 变 0" 的 bug。

## 可能未覆盖的场景

1. **Portfolio vs Single 模式**: `perReserveInputs` 在 Portfolio 模式下传递 `totalSupplyUsd`/`totalBorrowUsd`，Single 模式下为 undefined。两种路径的 `walletSupplyUsd` 推导可能不同。
2. **`buildIncentiveCurrent` 返回 0**: 当 `walletSupplyUsd > 0` 但 Merit campaign 不活跃或 `forecastMeritAprPercent` 返回 ≤0 时。
3. **`supplyAfterIncentiveRaw` 经过 `Math.min` 后变 0**: 当 `supplyAfterIncentiveRaw > supplyCurrentIncentive` 时取 `supplyCurrentIncentive`，但如果 `supplyCurrentIncentive` 本身为 0…
4. **ReservesTable 中的其他显示逻辑**: 除了 `getDisplaySupplyIncentive`，可能还有其他路径（如 Portfolio 面板、Mobile 行）有独立的显示逻辑。