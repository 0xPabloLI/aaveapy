# AAV-761 Interim Fix 副作用分析 — Handoff

**Date:** 2026-06-10
**Issue:** Linear AAV-761
**Scope:** 仅分析 interim fix 的副作用；deeper fix 不在本 session 范围

---

## 背景

AAV-761 的核心问题是：当 Portfolio 模式下某 reserve 一侧有 delta input、另一侧没有时，未操作侧的 incentive after 会显示 `0%` 而非 em dash（`—`）。Interim fix 将 `0` 改为 `null`，使 UI 正确显示 em dash。

## Interim Fix 共 2 个 Commit、5 处修改

### Commit 1: `bd9e0459` — rateSimulationCalculator.ts（3 处）

| 位置 | Fix 前 | Fix 后 | 行号 |
|---|---|---|---|
| Merit base | `else if (hasAnyInput) { baseAfter = 0 }` | `else if (hasAnyInput) { baseAfter = null }` | L641-642 |
| Merit self | `else if (hasAnyInput) { selfAfter = 0 }` | `else if (hasAnyInput) { selfAfter = null }` | L688-689 |
| Merkl | `else if (hasAnyInput) { after = 0 }` | `else if (hasAnyInput) { after = null }` | L770-772 |

### Commit 2: `1e39100e` — portfolioSimulator.ts（2 类）

| 位置 | Fix 前 | Fix 后 |
|---|---|---|
| incentiveMetric/totalMetric | `after: lane.afterIncentive` | `after: lane.hasInput ? lane.afterIncentive : null` |
| usdPerDayMetric | `computePositionUsdPerDay(...)` | `lane.hasInput ? computePositionUsdPerDay(...) : null` |

此外还修改了 `computeResultsFromGroups` 中 `nativePercent`/`incentivePercent` 的 fallback 逻辑，加入 `hasInput` 守卫。

---

## 核心问答

### Q1: 没有输入的 reserve 为什么会触发 rateSimulationCalculator 和 portfolioSimulator？

**`hasAnyInput` 是 per-reserve 变量**，不是跨 reserve 的。

调用链路：
1. `simulatePortfolioFromEntries` 遍历所有未隐藏、未 orphan 且 `amountUsd > 0` 的 reserves（**不要求有 delta input**）
2. Per-reserve 调用 `buildRateSimulationResult`，传入 `supplyInput = String(supplyDeltaUsd)`
3. `hasAnyInput = hasSupplyInput || hasBorrowInput`，per-reserve 计算
4. 当某侧 delta=0 但另一侧 delta>0 时，`hasAnyInput = true` 但本侧 `inputUsd = 0`

**数字场景**：Portfolio 中 USDC 有 $1k supply delta、$0 borrow delta → USDC borrow 侧 `hasAnyInput = true` 但 `inputUsd = 0`，触发 `else if (hasAnyInput)` 分支。

跨 reserve 的间接影响由 `supplyAfterSources` (L1345-1377) 的 `hasAnyInput` 守卫控制。当 Reserve B 的 `hasAnyInput = false` 时，`supplyAfterSources = null`，根本不计算 after，间接影响被隐藏。

### Q2: Interim fix 是否导致间接影响被忽略？

**不是 interim fix 导致的**。间接影响被隐藏是 `supplyAfterSources` 的 `hasAnyInput` 守卫的既有行为，interim fix 没有改变这个守卫。

Interim fix 改变的是**同一 reserve 另一侧**的显示语义：`after = 0`（错误显示 0%）→ `after = null`（正确显示 em dash）。

### Q3: Deeper fix 完成后，interim fix 是否还需要？

**需要分情况**：

| 位置 | Deeper fix 后是否还需要 |
|---|---|
| `rateSimulationCalculator` 的 3 处 `after = null` | **需要保留**，但可考虑删除 `else if (hasAnyInput)` 分支本身。Deeper fix 解决的是"有 input 时 after 计算错误"，不是"无 input 时 after 语义"。当 `inputUsd = 0 && hasAnyInput = true` 时，after 应为 null（未参与模拟），deeper fix 不会改变这个语义。 |
| `portfolioSimulator` 的 hasInput 守卫 | **需要保留**。这是 `buildMetricsFromLane` 的正确行为：当 lane 没有 input 时，不应显示 after 值。Deeper fix 不影响这个 UI 层守卫。 |

**注意**：如果 deeper fix 修改了 `hasAnyInput` 的语义（例如改为跨 reserve 的），则需要重新评估 interim fix 的分支条件。但目前 deeper fix 的范围（Brevis forecast 分母问题）不涉及 `hasAnyInput` 定义。

### Q4: Brevis 为什么不需要 interim fix？

**Brevis 从来没有 `else if (hasAnyInput) { after = 0 }` 分支**（git history 确认）。它只有 `if (inputUsd > 0)` 入口，`inputUsd = 0` 时 `after` 保持初始值 `null`。所以 Brevis 天然不会出现"无 input 显示 0%"的问题。

Merit/Merkl 在 interim fix 前有 `else if (hasAnyInput) { after = 0 }`，这是导致 bug 的直接原因。

---

## 3 个副作用

### 副作用 1: Brevis 与 Merit/Merkl 代码结构不一致

Brevis 无 `else if (hasAnyInput)` 分支，Merit/Merkl 有。虽然运行时行为现在一致（都是 after=null），但代码风格不统一。

**建议**：统一为 Brevis 的模式——删除 `else if (hasAnyInput)` 分支，让 `after` 保持初始 `null`。这更简洁且语义更清晰（"无 input = 不参与模拟 = after 未定义"）。

### 副作用 2: 同一行 native vs incentive after 不一致

`nativeMetric` 无 hasInput 守卫（`portfolioSimulator` L76-78：`after: lane.afterNative`），`incentiveMetric` 有守卫（L80-84：`after: lane.hasInput ? lane.afterIncentive : null`）。

**数字场景**：USDC 有 supply delta $1k，无 borrow delta → borrow 侧 native after = 2.5%（有值），incentive after = `—`（null），total after = `—`（null）。

**评估**：这是**设计意图**。Native rate 不依赖用户 input（它由 utilization 变化决定），incentive rate 依赖用户 position。所以 native 有值、incentive 无值是语义正确的。

### 副作用 3: 用户信息丢失

守卫阻止了未操作侧的 incentive after 显示。用户看不到"如果我同时在 borrow 侧也操作了，incentive 会变成多少"。

**评估**：这是**安全的权衡**。显示 `0%` 是错误的（误导用户以为 incentive 为零），显示 em dash 是正确的（表示"未模拟"）。如果用户想看 borrow 侧的预测，需要先输入 borrow delta。

---

## Deeper Fix 关键发现（供后续 session）

### ~~Brevis forecast 分母问题~~ — 已否决

> **勘误 (2026-06-10)**：以下分析有误。Brevis per-user reward cap 限制的是**累计 USD 奖励总额**（perUserRewardCapUsd），不是 position 大小。与 Merit self-cap（Deposit Ceiling，限制 position）语义完全不同。Brevis 不需要 `totalPositionUsd` 参数。

<details>
<summary>原始错误分析（已否决，保留供参考）</summary>

**文件**: `src/lib/brevisForecast.ts` L46-72

`forecastBrevisAprPercent` 的分母用的是增量 `depositUsd`/`combinedDepositUsd`，而非 `totalPositionUsd`（已有持仓+增量）。

**对比**：
- Merit SELF_CAP: `positionForCap = totalPositionUsd ?? depositUsd`（`meritForecast.ts` L186，已正确）
- Brevis: 无 `totalPositionUsd` 参数，分母只用增量

**修复方案**：给 `forecastBrevisAprPercent` 和 `forecastBrevisDetailed` 加 `totalPositionUsd` 参数，分母改为 `totalPositionUsd ?? depositUsd`。

### 调用链路

```
buildBrevisCampaignDetails (rateSimulationCalculator.ts:793)
  → forecastBrevisAprPercent (brevisForecast.ts:46)  ← 缺 totalPositionUsd
  → forecastBrevisDetailed (brevisForecast.ts:83)    ← 同上
```

`buildBrevisCampaignDetails` 已有 `inputUsd` 参数，但缺少 `totalPositionUsd`。需要从上游 `buildRateSimulationResult` 传入（上游 L982 处已有 `supplyInputUsd`/`borrowInputUsd`，可计算 `totalPositionUsd = walletValue + inputUsd`）。

</details>

### AAV-770: aggregate 层 supplyAfterSources/borrowAfterSources 守卫错误

**已修复** (2026-06-10)。`supplyAfterSources` 条件从 `hasAnyInput` 改为 `hasSupplyInput`，`borrowAfterSources` 从 `hasAnyInput` 改为 `hasBorrowInput`。否则 borrow-only 场景下 supplyAfterSources 为全 0 而非 null。

### AAV-771: Brevis 缺少显式 hasAnyInput 分支

**已修复** (2026-06-10)。`buildBrevisCampaignDetails` 添加 `else if (hasAnyInput) { after = null; }`，与 Merit/Merkl 模式一致。功能上靠初始值 `let after = null` 兜底已正确，但显式分支更防御性。

---

## 验证 Checkpoint

- ✅ Git history 确认：interim fix 前 Merit/Merkl 有 `after = 0`（非 null），interim fix 改为 `null` 是正确修复
- ✅ Git history 确认：Brevis 从来没有 `else if (hasAnyInput) { after = 0 }` 分支
- ✅ `hasAnyInput` 是 per-reserve 变量（L1010-1012），不是跨 reserve
- ✅ Interim fix 不涉及跨 reserve 间接影响（由 `supplyAfterSources` 的 `hasAnyInput` 守卫控制）
- ✅ Deeper fix（Brevis forecast 分母）与 interim fix 语义正交，不冲突
