# PRD: TARGET_TOTAL_APR 前端适配

**日期**: 2026-06-16
**父 Issue**: AAV-833
**状态**: Design Approved
**后端依赖**: 全部已就绪（P0 + P1 已部署）

---

## 1. 背景

3 个 Merkl TARGET_TOTAL_APR campaign 已出现在 API 中，但前端零适配。当前代码将 TARGET_TOTAL_APR 的 `aprCap`（= targetAPR，总 APR 目标）误当作 Merkl 实付上限，导致 APR 高估。

### 后端已完成

- `campaignType: "TARGET_TOTAL_APR"` 已在 API 输出
- `aprCap` = targetAPR 原始值（总 APR 目标）
- `campaignApr` = 后端已转换为 Merkl 实付 APR（APR→APY→减 nativeAPY→APR）
- `budgetBoundMode` 已透传（MAX_APR / FIX_APR）
- FIX_APR 模式下 `plannedDaily` 已正确 omit

---

## 2. 核心概念

### 2.1 aprCap 语义差异

| campaignType | aprCap 含义 | campaignApr 含义 |
|---|---|---|
| MAX | Merkl 实付上限 | Merkl 实付 APR（直接用） |
| FIX | Merkl 实付固定值 | Merkl 实付 APR（直接用） |
| **TARGET_TOTAL_APR** | **总 APR 目标 (targetAPR)** | **Merkl 实付 APR（后端已算）** |
| DUTCH_AUCTION | 无 | budget_rate / TVL × 365 |

### 2.2 三个正交维度

| 维度 | 字段 | 语义 |
|---|---|---|
| 一级分类 | `campaignType` | APR cap 语义 + 计算逻辑族 |
| 二级分类 | `distributionMethod` | Aave lending 不需要区分 |
| budget 行为 | `budgetBoundMode` | budget 用尽后的 fallback 策略 |

### 2.3 两种 budgetBoundMode 的 dilutive 行为

| budgetBoundMode | budget 充足 | budget 不足 |
|---|---|---|
| `MAX_APR` | `effectiveAprCap = max(aprCap - nativeAPY, 0)` | APR 被 TVL 稀释降到 effectiveAprCap 以下 |
| `FIX_APR` | `effectiveAprCap = max(aprCap - nativeAPY, 0)` | campaign 提前结束（fixRewardableDays） |

两者复用现有 MAX/FIX 子逻辑，仅 `aprCap` 替换为 `effectiveAprCap`。

---

## 3. 设计决策

### D1: nativeApyPercent 参数只影响 TARGET_TOTAL_APR

`MerklForecastState` 新增可选字段 `nativeApyPercent?: number`，仅 TARGET_TOTAL_APR 分支使用。MAX/FIX/DUTCH 不读取此字段，零影响。

### D2: decimal 转换统一在 forecastWithTVL 内部

`mergeForecastState` 透传 `nativeApyPercent`（percent points，不转换）。`forecastWithTVL` 内部 TARGET_TOTAL_APR 路径做 APR↔APY 转换后减法，与后端公式一致：

```
targetApyPercent = convertAprToApy(aprCap × 100)    // APR decimal → percent → APY percent
effectiveApyPercent = max(targetApyPercent - nativeApyPercent, 0)
effectiveAprCap = convertApyToApr(effectiveApyPercent) / 100  // APY percent → APR percent → decimal
// 然后用 effectiveAprCap 走现有 MAX/FIX 子逻辑
```

**为什么不在 mergeForecastState 统一转换**：`aprCap` 的 ÷100 是通用转换（所有类型都做），`nativeApyPercent` 的转换是 TARGET_TOTAL_APR 特有的（需要 APR↔APY 复利转换，不是简单的 ÷100）。两者语义不同，分开处理更清晰。

### D3: forecastBreakdownApr 新增可选 nativeApyPercent 参数

B 类路径（inputUsd>0）**经过** `forecastBreakdownApr`（经 `buildMerklCampaignDetails` 调用），而非独立调 `mergeForecastState + forecastWithTVL`。

`forecastBreakdownApr` 新增可选参数 `nativeApyPercent?: number`，透传给 `mergeForecastState`，再透传到 `MerklForecastState`，最终由 `forecastWithTVL` 内部 TARGET_TOTAL_APR 分支使用。可选参数向后兼容，MAX/FIX/DUTCH 不传此参数，零影响。

A 类路径（inputUsd=0）天然正确：
- `campaignApr > 0` → 直接返回（后端已算好实付 APR）
- `campaignApr = 0` → 返回 0（nativeAPY ≥ targetAPR，确实无 incentive），不走 forecastWithTVL fallback

### D4: forecastWithTVL 新增 TARGET_TOTAL_APR 第 4 条路径

在 DUTCH → FIX → MAX 之前（或之后，作为独立分支）拦截 TARGET_TOTAL_APR：

```typescript
if (campaignType === 'TARGET_TOTAL_APR') {
  const nativeApy = state.nativeApyPercent ?? 0;
  const targetApy = convertAprToApy(safe(state.aprCap ?? 0) * 100);
  const effectiveApy = Math.max(targetApy - nativeApy, 0);
  const effectiveAprCap = convertApyToApr(effectiveApy) / 100;

  // 根据 budgetBoundMode 委托给 MAX 或 FIX 子逻辑
  if (state.budgetBoundMode === 'FIX_APR') {
    // → FIX 子逻辑（用 effectiveAprCap 替代 aprCap）
  } else {
    // → MAX 子逻辑（用 effectiveAprCap 替代 aprCap）
  }
}
```

### D5: nativeApyPercent 沿调用链透传

`nativeApyPercent` 是 reserve 级别数据（`reserve.supplyApy` / `reserve.borrowApy`），不是 campaign breakdown 级别。透传路径：

```
buildMerklCampaignDetails(nativeApyPercent)
  → forecastBreakdownApr(nativeApyPercent)
    → mergeForecastState(nativeApyPercent)
      → MerklForecastState.nativeApyPercent
        → forecastWithTVL 读取
```

在 `buildRateSimulationResult` 中：
- A 类（current）：`nativeApyPercent = reserve.supplyApy ?? 0`（supply 侧）或 `reserve.borrowApy ?? 0`（borrow 侧）
- B 类（after）：`nativeApyPercent = supplyAfterNative ?? reserve.supplyApy ?? 0`（after 值随 utilization 变化）

### D6: budgetBoundMode 加入前端类型和 schema

`MerklCampaignBreakdown` 和 Zod schema 新增 `budgetBoundMode?: string`。

### D7: FORECAST_REQUIRING_CAMPAIGN_TYPES 加入 TARGET_TOTAL_APR

使 `collectActiveCampaignIds` 能正确收集 TARGET_TOTAL_APR campaign。

### D8: cap note 复用 MAX/FIX 逻辑

`buildMerklCampaignDetails` 中 cap note 条件扩展：
- `campaignType === 'TARGET_TOTAL_APR' && budgetBoundMode === 'MAX_APR'` → 复用 MAX capNote（"APR capped for low TVL"）
- `campaignType === 'TARGET_TOTAL_APR' && budgetBoundMode === 'FIX_APR'` → 复用 FIX capNote（"~Nd earn"）

### D9: Incentive Tooltip 三段拆分

TARGET_TOTAL_APR 的 Merkl campaign row 新增一行 message：
```
Target 4.7% = Native 3% + Merkl 1.7%
```

数据来源（前端已有，不需要后端新增）：
- `aprCap`（= targetAPR，总 APR 目标）— 来自 breakdown
- `reserve.supplyApy` / `reserve.borrowApy`（nativeAPY）— 来自 reserve
- `campaignApr`（Merkl 实付 APR）— 来自 breakdown

### D10: forecastBreakdownApr 对 TARGET_TOTAL_APR + campaignApr=0 的处理

```typescript
// 在 getMerklBreakdownApr 返回 0 后，forecastBreakdownApr 的 headline 分支
// 当前逻辑：currentApr === 0 → 走 forecastWithTVL fallback
// TARGET_TOTAL_APR 修正：campaignApr=0 意味着确实无 incentive，不应走 fallback
// 性能优化：短路返回 0，避免不必要的 forecastWithTVL 计算
// 注：即使走 fallback，forecastWithTVL 的 TARGET_TOTAL_APR 分支
//     当 effectiveAprCap=0 时也自然返回 0，所以这不是正确性修复而是性能优化
if (currentApr <= 0 && breakdown.campaignType === 'TARGET_TOTAL_APR') {
  return 0;  // nativeAPY ≥ targetAPR, 确实无 incentive
}
```

---

## 4. 需要修改的文件

| 文件 | 改动 | 风险 |
|---|---|---|
| `src/lib/merklForecast.ts` | `MerklForecastState` 新增 `nativeApyPercent` + `budgetBoundMode`；`mergeForecastState` 新增 `nativeApyPercent` 可选参数透传；`forecastWithTVL` 新增 TARGET_TOTAL_APR 路径；`forecastBreakdownApr` 新增 `nativeApyPercent` 可选参数透传 + 处理 campaignApr=0 | 高 |
| `src/lib/rateSimulationCalculator.ts` | `buildMerklCampaignDetails` 新增 `nativeApyPercent` 参数；`FORECAST_REQUIRING_CAMPAIGN_TYPES` 加入 TARGET_TOTAL_APR；cap note 条件扩展 | 高 |
| `src/types/aave.ts` | `MerklCampaignBreakdown` 新增 `budgetBoundMode?: string` | 低 |
| `src/shared/market-contract/schemas.ts` | Zod schema 新增 `budgetBoundMode: z.string().optional()` | 低 |
| `src/components/dashboard/IncentiveTooltip.tsx` | TARGET_TOTAL_APR 三段拆分 message | 中 |
| `CONTEXT.md` | 更新 Merkl Campaign 表格中 TARGET_TOTAL_APR 的描述 | 低 |
| `docs/adr/0002-rate-simulation-ab-categorization.md` | 修正 A 类字段描述 | 低 |

---

## 5. 实施顺序

### Phase 1: 类型 + 计算

1. `MerklCampaignBreakdown` + Zod schema 新增 `budgetBoundMode`
2. `MerklForecastState` 新增 `nativeApyPercent` + `budgetBoundMode`
3. `mergeForecastState` 透传新字段
4. `forecastWithTVL` 新增 TARGET_TOTAL_APR 第 4 条路径
5. `forecastBreakdownApr` 处理 campaignApr=0
6. `buildMerklCampaignDetails` 新增 `nativeApyPercent` 参数
7. `FORECAST_REQUIRING_CAMPAIGN_TYPES` 加入 TARGET_TOTAL_APR
8. cap note 条件扩展

### Phase 2: UI

9. IncentiveTooltip 三段拆分

### Phase 3: 文档

10. CONTEXT.md 更新
11. ADR-0002 修正

---

## 6. 测试策略

### TDD 优先级

| 测试 | 优先级 | 场景 |
|---|---|---|
| `forecastWithTVL` TARGET_TOTAL_APR + MAX_APR | P0 | effectiveAprCap 计算 + dilution |
| `forecastWithTVL` TARGET_TOTAL_APR + FIX_APR | P0 | effectiveAprCap 计算 + fixRewardableDays |
| `forecastWithTVL` TARGET_TOTAL_APR + nativeAPY > targetAPR | P0 | effectiveAprCap = 0 |
| `forecastBreakdownApr` TARGET_TOTAL_APR + campaignApr=0 | P0 | 返回 0 不走 fallback |
| `mergeForecastState` 透传 nativeApyPercent | P1 | |
| `buildMerklCampaignDetails` TARGET_TOTAL_APR | P1 | cap note / after / delta |
| IncentiveTooltip 三段拆分 | P2 | |
| Zod schema budgetBoundMode 解析 | P2 | |

### 真实数据验证

3 个活跃 campaign 的预期值：

| campaignId | reserve | targetAPR | nativeAPY | 预期 campaignApr(实付) |
|---|---|---|---|---|
| 13116567236794890552 | 4326:0x7e32...c28 | 4.7% | ~3% | ~1.7% |
| 12662496063613214537 | 1:0x973a...e29:0xcca8...6c9 | 5.83% | varies | varies |
| 8647796357084493685 | 1:0x6540...1dc:0xcca8...6c9 | 7.7% | varies | varies |

---

## 7. 不做的事情

| 项目 | 原因 |
|---|---|
| `rawDistributionMethod` | Aave lending 只有 AAVE_NET_APR / AAVE_V4_NET_APR，公式相同 |
| `vaultAPR` | Merkl API 不提供，后端无法透传 |
| `merklOppAPR` | 需聚合同 reserve 上其他 opportunity，当前未实现 |
| `spreadCap` | 仅 ERC4626_SPREAD_CAPPED 需要，已从后端类型中移除 |
| ERC4626 5 种子类型 | 全部 vault-based，后端无法获取 vaultAPR |

---

## 8. Grill 决策记录

| # | 决策 | 理由 |
|---|---|---|
| 1 | nativeApyPercent 只影响 TARGET_TOTAL_APR 分支 | MAX/FIX 的 aprCap 是实付上限，不需要减 nativeAPY |
| 2 | APR↔APY 转换在 forecastWithTVL 内部做 | 与后端公式一致，mergeForecastState 只透传不转换 |
| 3 | nativeApyPercent 沿完整调用链透传（forecastBreakdownApr + mergeForecastState 均新增可选参数） | nativeApyPercent 是 reserve 级数据，不在 breakdown 中；可选参数向后兼容 |
| 4 | campaignApr=0 时直接返回 0 不走 fallback | TARGET_TOTAL_APR 的 campaignApr=0 是"确实无 incentive"，不是"数据缺失" |
| 5 | scenario 下用 afterNativeAPY | nativeAPY 随 utilization 变化，simulation 应反映实时值 |
| 6 | effectiveAprCap 走现有 MAX/FIX 子逻辑 | 不重复造轮子，TARGET_TOTAL_APR 的 dilutive 行为与 MAX/FIX 同族 |
| 7 | D3 修正：B 类路径经过 forecastBreakdownApr | 代码验证 buildMerklCampaignDetails 通过 forecastBreakdownApr 调用 forecastWithTVL |

---

## 9. 共享文档

- `aaveapy-doc/handoff-target-total-apr-frontend.md` — 后端已完成状态 + API 格式
- `aaveapy-doc/merkl-distribution-types.md` — 4 大 Family + 7 种子类型 + budget-bound mode + APR 公式
- `docs/handoff/target-total-apr-frontend-handoff.md` — 前端 handoff（本 PRD 前身）
- Merkl 官方文档 — https://docs.merkl.xyz/merkl-mechanisms/distributions
- Merkl Schema API — https://api.merkl.xyz/v4/schemas/distributionMethod
