# AAV-761 整体 Handoff 文档

**Date:** 2026-06-11
**Linear:** AAV-761 (主线), AAV-770, AAV-771, AAV-780
**Status:** 三层修复已完成并 merge；Merit Deposit Ceiling Dilution（Shared Scenario + Portfolio Mode 均已修复）

---

## 1. 项目概述

AAV-761 修复 Simulation 模式下 incentive APR 计算的语义 bug：当 Portfolio/Simulation 模式下某 reserve 一侧有 delta input、另一侧没有时，未操作侧的 incentive after 显示 `0%`（错误），应显示 em dash `—`（正确）。

**核心问题**：`after=0` 与 `after=null` 在 `??` 运算符下行为迥异——`0 ?? fallback` → `0`（不 fallback），`null ?? fallback` → `fallback`。当 `hasInput=false` 时，after 必须为 `null`（表示"未参与模拟，使用 current 值"），不能为 `0`（表示"模拟后为 0%"）。

**范围**：
- 三层 hasInput 守卫修复
- Merit/Merkl/Brevis campaign detail row 的 after 语义统一
- Aggregate 层 `hasAnyInput` vs per-side 守卫的语义边界
- Merit Deposit Ceiling Dilution Bug 根因诊断（Shared Scenario + Portfolio Mode 双模式均已修复，详见 §6）

---

## 2. 三层修复架构

### Layer 1: Aggregate 层（保留跨侧影响）

**文件**: `src/lib/rateSimulationCalculator.ts`

6 处守卫使用 `hasAnyInput`（而非 per-side），保留跨侧影响：

| 位置 | 守卫 | 说明 |
|---|---|---|
| `supplyAfterSources` | `hasAnyInput` | supply after 聚合源 |
| `borrowAfterSources` | `hasAnyInput` | borrow after 聚合源 |
| `supplyAfterIncentiveRaw` | `hasAnyInput` | supply incentive after 原始值 |
| `borrowAfterIncentiveRaw` | `hasAnyInput` | borrow incentive after 原始值 |
| `supplyAfterIncentiveAprRaw` | `hasAnyInput` | supply incentive APR after 原始值 |
| `borrowAfterIncentiveAprRaw` | `hasAnyInput` | borrow incentive APR after 原始值 |

**设计理由**：如果改用 per-side 守卫（`hasSupplyInput`/`hasBorrowInput`），会切断跨侧影响。例如 Brevis 共享 cap 场景下，borrow 有 input 但 supply 没有，supply 侧的 after 仍可因 borrow input 而变化。用 `hasAnyInput` 保留跨侧影响，让消费端（Layer 2）做显示控制。

### Layer 2: Lane 层（per-side 显示控制）

**文件**: `src/lib/portfolioSimulator.ts`

Portfolio 消费端用 `lane.hasInput` 做二次守卫，实现 em dash 显示：

| 位置 | 守卫 | 说明 |
|---|---|---|
| `incentiveMetric.after` | `lane.hasInput` | 无 input → after=null → UI 显示 em dash |
| `usdPerDayMetric` | `lane.hasInput` | 无 input → 整个 metric 为 null |
| `nativePercent`/`incentivePercent` fallback | `lane.hasInput` | 控制 percent fallback |

**设计理由**：`SimulationLane.hasInput` 是 per-side 语义，正确反映"本侧是否有 delta input"。Aggregate 层用 `hasAnyInput` 保留跨侧影响，Lane 层用 `hasInput` 做显示控制——两层守卫各司其职。

**native vs incentive 不一致**：`nativeMetric` 无 hasInput 守卫（native rate 不依赖用户 input，由 utilization 变化决定），`incentiveMetric` 有守卫（incentive rate 依赖用户 position）。这是设计意图，不是 bug。

### Layer 3: Delta 层（null 语义）

**文件**: `src/lib/portfolioSimulator.ts`

当 `lane.hasInput=false` 时，`lane.deltaTotal`/`lane.deltaNative`/`lane.deltaIncentive` 为 `null`（而非 `0`）。

**语义规则**：delta=null 表示"未参与模拟，无 delta 概念"，delta=0 表示"参与模拟但变化为零"。与 after 语义一致。

### 语义规则汇总

| 场景 | after 值 | ?? 行为 | UI 显示 |
|---|---|---|---|
| hasInput=true, 计算结果=0 | `0` | `0 ?? current` → `0` | 0% |
| hasInput=true, 计算结果=5.2 | `5.2` | `5.2 ?? current` → `5.2` | 5.2% |
| hasInput=false | `null` | `null ?? current` → `current` | current 值 |
| hasInput=false（旧 bug） | `0` | `0 ?? current` → `0` | ~~0%（错误）~~ |

---

## 3. 提交历史（时间顺序）

| Commit | 说明 |
|---|---|
| `bd9e0459` | **Interim fix**: rateSimulationCalculator 3 处 `after=0` → `after=null`（Merit base/self、Merkl） |
| `1e39100e` | **portfolioSimulator**: hasInput 守卫 + toggle sign 交互统一 + native/incentive percent fallback |
| `114167df` | **Aggregate 层**: 6 处守卫改 `hasAnyInput` + Brevis defensive `else if (hasAnyInput)` 分支（AAV-770, AAV-771） |
| `394ba871` | **Lane 层**: per-side hasInput guard（AAV-770 layer-2） |
| `d1cbfe1c` | **Regression fix**: 恢复跨侧影响，aggregate 6 处守卫从 per-side 改回 `hasAnyInput` |
| `01e14b00` | **Delta 层**: lane delta is null when hasInput=false（AAV-761 layer-3） |
| `1f02c07f` | **Test fixture**: 替换为真实地址 |

---

## 4. Linear Issues

| Issue | 标题 | 状态 | 说明 |
|---|---|---|---|
| AAV-761 | Simulation after 语义修复（主线） | Done | 三层修复 + delta null 语义 |
| AAV-770 | Aggregate 层 + Lane 层 hasInput 守卫 | Done | Layer 1 + Layer 2 |
| AAV-771 | Brevis 缺少显式 hasAnyInput 分支 | Done | 防御性分支，功能靠初始 null 兜底 |
| AAV-780 | Merit Deposit Ceiling Dilution Bug | Closed（预期行为） | 用户确认稀释语义正确：position > Deposit Ceiling 后 APR 按比例下降是设计意图，非 bug |

---

## 5. 已知副作用/待解决

### 5.1 Brevis 与 Merit/Merkl 代码结构不一致（已解决）

Brevis 在 commit `114167df` 补上了 `else if (hasAnyInput)` 分支后，四个 campaign（Merit base/self、Merkl、Brevis）结构已统一：均用 `let after = null` 初始声明 + 显式 `else if (hasAnyInput) { after = null }` 分支。无遗留不一致。

### 5.2 Native vs Incentive After 不一致（设计意图）

同一行 native after 有值（2.5%），incentive after 为 null（em dash）。原因：native rate 不依赖用户 input，incentive rate 依赖。**这是正确的权衡**，不需要修改。

### 5.3 用户信息丢失（安全的权衡）

守卫阻止了未操作侧的 incentive after 显示。用户看不到"如果我同时在另一侧也操作了，incentive 会变成多少"。

**评估**：显示 `0%` 是错误的（误导用户以为 incentive 为零），显示 em dash 是正确的（表示"未模拟"）。如果用户想看预测，需要先输入 delta。**不需要修改**。

### 5.4 Brevis Forecast 分母问题（已否决）

> **已否决**：Brevis Reward Ceiling 限制的是累计 USD 奖励总额（perUserRewardCapUsd），不是 position 大小。与 Merit Deposit Ceiling（限制 position，外部源字段名 `selfCapUsd`）语义完全不同。Brevis 不需要 `totalPositionUsd` 参数。详见 `docs/handoff/AAV-761-interim-fix-analysis.md`。

---

## 6. Merit Deposit Ceiling Dilution Bug（已修复 — Shared Scenario + Portfolio Mode）

**详细 handoff**: `docs/handoff/merit-self-cap-dilution-bug.md`

### 6.1 问题描述

Celo USDT 的 Merit Deposit Ceiling incentive APR 被提前稀释——即使用户仓位未超过 Deposit Ceiling，incentive APR 也显示偏低的稀释值。问题同时存在于 Shared Scenario 和 Portfolio Mode，根因不同。

### 6.2 Phase 1: Shared Scenario — 变量语义混淆

**根因**：`reservePositions` 在 Shared Scenario 下存的是 shared simulation input，不是钱包已有仓位。`principalSupplyUsd` 变量名含"principal"暗示"已有本金"，实际值 = simulation input。导致 `totalPositionUsd = simulationInput + netInput` 产生 double-counting。

更深层原因：`principalSupplyUsd` 被 AAV-610 设计为"收益本金（含 delta 的有效仓位）"，在 AAV-675 被复用为"钱包已有仓位（不含 delta）"。同一变量承载两种互斥语义。

**修复**：`useRateSimulation.ts` 不再从 `reservePositions` 传入 `principalSupplyUsd`/`principalBorrowUsd`。下游 meritForecast 通过 `??` fallback 到 `depositUsd`。

### 6.3 Phase 2: Portfolio Mode — formula double-count + hook 未传参

**子问题 2a：formula double-count**

`principalSupplyUsd` 在 portfolio 下的值 = `group.supplyUsd` = `effectiveAmountUsd` = `walletValue + delta`（已是总仓位），但 calculator 公式又加了 `supplyNetInputUsd`：

```
supplyTotalPositionUsd = principalSupplyUsd + supplyNetInputUsd
                       = (wallet + delta) + delta
                       = wallet + 2*delta  ← double-count
```

同一问题存在于两处：
- `rateSimulationCalculator.ts` L894-900 (`buildIncentiveAfter`)
- `rateSimulationCalculator.ts` L1163-1171 (`buildRateSimulationResult`)

**修复**：`totalPositionUsd = principalUsd`（移除 `+ netInputUsd`）。因为 principal 已含 delta，不需要再加。

**子问题 2b：hook 路径未传参**

`useSharedRateSimulations` 虽然读了 `perReserve.supplyInput`/`borrowInput`，但从未读 `perReserve.principalSupplyUsd`/`principalBorrowUsd`。注释说"reads from perReserveInputs instead"但实际没实现。

**修复**：从 `perReserve?.principalSupplyUsd`/`principalBorrowUsd` 传入。

### 6.3 Phase 3: Portfolio Mode — incentive after false-zero（主 bug 根因）

**用户报 bug**（截图确认）：Supply side 有钱包仓位（$1,042）但 delta=0，Borrow side 输入 $1。Supply Incentive 显示 `0.00%`（错误），应 fallback 到当前值 `0.17%`。

**根因**：`buildRateSimulationResult` 中 `supplyAfterIncentive` 用 `hasAnyInput` 守卫（L1265）。当 borrow 有 input 时 `hasAnyInput=true`，所以 supply 侧的 incentive after 被计算：`buildIncentiveAfter` 用 `netInputUsd=0` forecast Merit/Merkl → 返回 0。结果 `supply.afterIncentive = 0`（不是 null）。`portfolioSimulator.ts` L226-228 用 `??` fallback：`0 ?? currentIncentive → 0`，UI 显示 `0.00%`。

**修复**：在 `supplyAfterIncentive`/`borrowAfterIncentive`/`supplyAfterIncentiveApr`/`borrowAfterIncentiveApr` 4 处增加 per-side 守卫。当 `hasSupplyInput=false` 时，`supplyAfterIncentive = null`（而非计算后的 0），让 `??` 正确 fallback 到 current。

**跨侧影响保留**：`afterNative` 仍用 `hasAnyInput` 守卫，保留对侧 input 通过 utilization 变化的跨侧影响。Incentive 用 per-side 守卫（依赖用户 position，无 input = 无模拟）。Native 和 Incentive 的守卫策略不同——这是正确的权衡。

### 6.4 Phase 4: `buildGroupMapFromSlots` + `buildPerReserveInputsFromEntries` 跳过 wallet-only positions（AAV-761 回归）

**用户报 bug**（截图确认）：WETH supply 有钱包仓位（$1,042）但 delta=0，borrow side 输入 $1。**两个界面**（Reserve Table + Portfolio Results Table）的 Supply Incentive 都显示 `0.00%`（错误）。

**根因**：两条计算路径都用了 `if (amountUsd <= 0) continue` 跳过 delta=0 的 side，导致 `totalSupplyUsd` 没有累加 wallet value。

**受影响的两条路径**：
1. **`buildGroupMapFromSlots`**（L126-127）— `simulatePortfolioFromEntries` 主路径，用于 Portfolio Results Table
2. **`buildPerReserveInputsFromEntries`**（L343-344）— `useSharedRateSimulations` 路径，用于 Reserve Table

两条路径都用了 `resolvePositionAmountUsd` 判断是否跳过，当 `amount=''` 但 `walletValue > 0` 时，该函数返回 0 → 整个 side 被跳过 → `totalSupplyUsd = 0`。

**后果**：`buildRateSimulationResult` 中 `totalSupplyUsd = 0`，calculator 层认为无 total position，incentive 计算受影响。

**修复**：两条路径统一改为：先判断 `hasUserInput`（`parseNumberInput(s.amount) > 0`）和 `hasWalletPosition`（`walletValue > 0`），两者都不满足才跳过。当 `hasWalletPosition` 但 `!hasUserInput` 时，`effectiveAmountUsd = walletValue`，`deltaUsd = 0`。

**文件**：`src/lib/portfolioSimulator.ts` `buildGroupMapFromSlots` (L117-161) 和 `buildPerReserveInputsFromEntries` (L326-394)

**测试**：新增 2 个测试用例（`portfolioSimulator.test.ts`）：
- `wallet position with empty amount: delta=0, totalSupplyUsd=walletValue`
- `wallet supply + borrow delta on same reserve: totalSupplyUsd and totalBorrowUsd both recorded`

### 6.5 修复总结

| Phase | 位置 | 修改 |
|---|---|---|
| 1 | `useRateSimulation.ts` L274-275 | 不再从 `reservePositions` 传 principal |
| 2a | `rateSimulationCalculator.ts` L894-900, L1163-1171 | `totalPositionUsd = principalUsd`（移除 `+ netInputUsd`） |
| 2b | `useRateSimulation.ts` L274-279 | 从 `perReserve` 读取 principal |
| 3 | `rateSimulationCalculator.ts` L1307-1318 | 4 处 per-side 守卫（incentive after） |
| 4 | `portfolioSimulator.ts` L341-372 | 不再跳过 wallet-only positions |

### 6.5 影响矩阵

| 模式 | 修复前 | 修复后 |
|---|---|---|
| Shared Scenario (hook) | `totalPositionUsd = 2× input`（double-count） | `totalPositionUsd = undefined` → fallback `depositUsd` |
| Portfolio (hook → ReservesTable) | `totalPositionUsd = undefined`（Phase 2b 未传参） | `totalPositionUsd = wallet + delta` |
| Portfolio (standalone → PortfolioPanel) | `totalPositionUsd = wallet + 2×delta`（Phase 2a double-count） | `totalPositionUsd = wallet + delta` |

### 6.6 统一性分析

Shared Scenario 和 Portfolio Mode 的数据流已通过 `perReserveInputs` 统一——两者都调用 `useSharedRateSimulations`，只是输入数据不同：

```typescript
// ReservesTable.tsx L266-283
const perReserveInputs = useMemo(
  () => (isPortfolioMode ? buildPerReserveInputsFromEntries(...) : undefined),
  [isPortfolioMode, ...]
);

const { simulationsById } = useSharedRateSimulations({
  supplyInput: isPortfolioMode ? '' : debouncedSharedSupplyInput,
  borrowInput: isPortfolioMode ? '' : debouncedSharedBorrowInput,
  perReserveInputs,  // ← 统一入口：Shared Scenario=undefined, Portfolio Mode=Map
});

// useRateSimulation.ts L235-237 — 统一的分发逻辑
const effectiveSupplyInput = perReserve?.supplyInput ?? supplyInput;
const principalSupplyUsd = perReserve?.principalSupplyUsd;  // undefined in Shared Scenario
```

**仍存在重复的路径**：`computeResultsFromGroups`（PortfolioPanel 独立路径）重复调用了 `buildRateSimulationResult`，而 hook 的 `simulationsById` 已经算好了相同结果。这个重复源于 PortfolioPanel 需要 per-slot 结果而非 per-reserve 结果，属于架构层面的取舍，短期内不值得重构。

### 6.7 相关 Lessons Learned

参见 `AGENTS.md` § "Learned Lessons: 单一变量承载多语义导致 double-count (AAV-761 merit-deposit-ceiling-dilution)"：
- 变量复用比命名错误更危险 —— 同一变量承载两种互斥语义
- 数据源语义必须显式文档化 —— `reservePositions` 名字暗示"仓位"但实际是 simulation input
- `X + Y` 计算必须覆盖 `X === Y` 的边界用例
- Calculator 层无法保护调用层传错误值 —— 参数名合约被调用侧绕过

---

## 7. Lessons Learned

### 7.1 Simulation `after` 语义（AAV-761）

- **`after=0` 与 `after=null` 语义不同，`??` 运算符下行为迥异**: `0 ?? fallback` → `0`（不 fallback），`null ?? fallback` → `fallback`。当 `hasInput=false` 时，after 必须为 `null`（表示"未参与模拟，使用 current 值"），不能为 `0`（表示"模拟后为 0%"）。
- **多层计算链路需逐层统一语义**: campaign row 层、`buildMetricsFromLane` 层、aggregate 层需一致使用 `hasInput` 分支，否则会出现某层 `after=null` 而另一层 `after=0` 的矛盾。修改某一层时必须检查上下游所有层级。
- **Portfolio Mode 传 delta 而非 total position，导致 hasInput 判断需特别小心**: `hasAnyInput` 为 true 不代表每个 side 都有 input——必须用 per-side `hasInput` 决定 per-side after 语义。
- **Per-campaign detail row 的 `else if (hasAnyInput)` 分支必须显式设 `after=null`**: Merit base/self、Merkl 三处原先设 `after=0`，导致 `pickScenarioValue` 不 fallback。

### 7.2 AAV-761 回归修复 — per-side 守卫 vs 跨侧影响

- **`hasSupplyInput`/`hasBorrowInput` 守卫切断跨侧影响（中间尝试，已回退）**: aggregate 层曾从 `hasAnyInput` 改为 per-side 守卫，导致 Shared Scenario 下无输入侧的 after 变为 null，UI 显示错误。修复：6 处守卫改回 `hasAnyInput`（当前最终状态见 §2 Layer 1）。
- **`SimulationLane.hasInput` 保持 per-side 不改**: Portfolio 消费端用 `lane.hasInput` 做二次守卫实现 em dash，per-side 语义正确。aggregate 层用 `hasAnyInput` 保留跨侧影响，消费端用 `hasInput` 做显示控制——两层守卫各司其职。
- **cross-side 测试断言不是 `after === current`**: 跨侧影响保留后，无输入侧的 after 值可以因对侧输入而变化，正确断言是 `after !== null`，而非 `after === current`。
- **`SimulationLane` 没有 `after`/`delta` 字段**: 只有 `afterTotal`/`deltaTotal`、`afterNative`/`deltaNative`、`afterIncentive`/`deltaIncentive`。

### 7.3 Portfolio Delta Input（前序 Lessons）

- **Controlled ↔ Uncontrolled 迁移风险**: `useNumberInput` → `useDebouncedInput` 迁移会引入双向同步反馈循环。
- **Delta 空语义 ≠ 空字符串**: clear delta 的正确语义是"使 delta=0"，即设 `amount = walletValue`。
- **Toggle sign 有 delta 时必须重算 amount**: sign 翻转后 effectiveUsd 变化，amount 必须同步重算。
- **Debounce 对 delta 输入有害**: 逐字输入时 debounce commit 不完整值，即时计算字段传 `debounceMs: 0`。
- **同一业务动作只允许一条语义路径**: 底层语义必须统一到同一个函数。
- **输入提交函数必须显式定义空值语义**: 空值是有意义的输入，不是"没有输入"。

---

## 8. 关键文件清单

### 核心修改文件

| 文件 | 修改内容 |
|---|---|
| `src/lib/rateSimulationCalculator.ts` | Merit/Merkl after=null 修复；Brevis defensive branch；aggregate 6 处 hasAnyInput 守卫 |
| `src/lib/portfolioSimulator.ts` | hasInput 守卫；delta null 语义；native/incentive percent fallback |
| `src/hooks/useRateSimulation.ts` | principalSupplyUsd/principalBorrowUsd 传入控制（Phase 1 不传, Phase 2b 从 perReserve 传）；effective input 计算 |
| `src/lib/meritForecast.ts` | positionForCap = totalPositionUsd ?? depositUsd（Deposit Ceiling Dilution 相关） |
| `src/lib/deltaCalculator.ts` | `computeDelta` → `effectiveAmountUsd` = wallet + delta（principal 语义来源） |

### 测试文件

| 文件 | 说明 |
|---|---|
| `src/lib/rateSimulationCalculator.test.ts` | 三层守卫 + 跨侧影响 + after=null 语义 + Shared Scenario deposit-ceiling 回归守卫 |
| `src/lib/portfolioSimulator.test.ts` | hasInput 守卫 + delta null 语义 |

### 相关文档

| 文件 | 说明 |
|---|---|
| `docs/handoff/merit-self-cap-dilution-bug.md` | Merit Deposit Ceiling 独立 handoff |
| `docs/handoff/AAV-761-interim-fix-analysis.md` | Interim fix 副作用分析 |
| `AGENTS.md` | Learned Lessons（3 个 AAV-761 相关 block） |

### 上游数据源

| 文件 | 说明 |
|---|---|
| `src/components/dashboard/ReservesTable.tsx` | reservePositions 构建（simulation input，非钱包仓位） |
| `src/hooks/useRateSimulation.ts` | principalSupplyUsd 赋值 |
| `src/lib/merklForecast.ts` | Merkl forecast |
| `src/lib/brevisForecast.ts` | Brevis forecast |