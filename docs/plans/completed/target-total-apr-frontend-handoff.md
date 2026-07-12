# TARGET_TOTAL_APR 前端 Handoff

**日期**: 2026-06-14
**父 Issue**: AAV-833
**后端状态**: P0 已部署（commit `46fbd5a`），P1（budgetBoundMode 透传 + Pick 列表重构）进行中
**后端 handoff**: `aave-protocol-analysis/aaveapy-doc/handoff-target-total-apr-frontend.md`

---

## 依赖

| 依赖项 | 状态 | 说明 |
|---|---|---|
| API 输出 `campaignType: "TARGET_TOTAL_APR"` | ✅ 已可用 | 后端 P0 已部署 |
| API 输出 `aprCap`（= targetAPR） | ✅ 已可用 | 后端 P0 已部署 |
| API 输出 `budgetBoundMode` | ✅ 已可用 | 后端 P1 已完成（2026-06-15） |
| API 输出 FIX_APR 时省略 `plannedDaily` | ✅ 已可用 | 后端 P1 field rules 动态化 |

---

## 1. 概念

### 1.1 TARGET_TOTAL_APR 的 aprCap 语义

| campaignType | aprCap 含义 | 前端计算 merklActualAPR |
|---|---|---|
| MAX | Merkl 实付上限 | `min(aprCap, budget_rate / TVL × 365)` |
| FIX | Merkl 实付固定值 | `aprCap` |
| **TARGET_TOTAL_APR** | **总 APR 目标** | **`max(aprCap - nativeAPR, 0)`** |
| DUTCH_AUCTION | 无 cap | `budget_rate / TVL × 365` |

**关键区别**：TARGET_TOTAL_APR 的 `aprCap` 是"用户应得的总 APR"，不是"Merkl 支付的部分"。前端需自行减去 nativeAPR 得到 Merkl 实付部分。

### 1.2 三个正交维度

| 维度 | 字段 | 语义 | 前端用途 |
|---|---|---|---|
| 一级分类 | `campaignType` | APR cap 语义 + 计算逻辑族 | 选择 APR 计算方式 |
| 二级分类 | `distributionMethod` | 具体公式（被减数来源） | Aave lending 不需要区分 |
| budget 行为 | `budgetBoundMode` | budget 用尽后的 fallback 策略 | simulation 模式选择 |

### 1.3 Aave lending 场景

只有 `AAVE_NET_APR` 和 `AAVE_V4_NET_APR` 两种 distributionMethod，公式完全相同：`max(targetAPR - nativeAPR, 0)`。`campaignType = TARGET_TOTAL_APR` 足以区分计算逻辑，不需要 `rawDistributionMethod`。

ERC4626 系列（5 种）全部是 vault-based，后端无法获取 vaultAPR，短期不处理。映射表保留（防御性），前端不需要处理。

---

## 2. 前端核心变更

### 2.1 APR 计算

**文件**: `src/lib/merklForecast.ts`

Aave lending 场景下，公式只有一种：

```
merklActualAPR = max(aprCap - nativeAPR, 0)
```

- `aprCap` = API 返回的 `aprCap` 字段（= targetAPR，总 APR 目标）
- `nativeAPR` = reserve 自身的 supplyApy / borrowApy
- 根据 side 区分：supply 侧取 `supplyApy`，borrow 侧取 `borrowApy`
- 不需要 `rawDistributionMethod`、`vaultAPR`、`merklOppAPR` 等额外字段

**实现建议**：在 `forecastWithTVL` 内新增 TARGET_TOTAL_APR 路径，内部计算 `effectiveAprCap = max(aprCap - nativeAPR, 0)`，然后根据 `budgetBoundMode` 委托给现有 MAX 或 FIX 子逻辑。

结构参考：
```
if (isTargetTotalApr) {
  effectiveAprCap = max(aprCap - nativeAPR, 0);
  if (budgetBoundMode === 'FIX_APR') → FIX 子逻辑（用 effectiveAprCap）
  else → MAX 子逻辑（用 effectiveAprCap）
}
```

**不做预转换**：nativeAPR（supplyApy/borrowApy）随 utilization 变化而变化，预转换一次后 nativeAPR 变了但转换后的 aprCap 不会更新。必须每次计算时实时做。

### 2.2 forecastWithTVL 修改

**文件**: `src/lib/merklForecast.ts`

当前 `forecastWithTVL`（:57-129）有 3 条路径：DUTCH → FIX → MAX。TARGET_TOTAL_APR 需要新增为第 4 条路径（或在 FIX/MAX 之前拦截）。

关键点：
- 需要传入 `nativeAPR`（或让调用方传入 side 信息）
- 根据 `budgetBoundMode` 选择子逻辑
- MAX_APR：dilutive fallback（APR 被 TVL 稀释降到 target 以下）
- FIX_APR：early-end fallback（campaign 提前结束，算 `fixRewardableDays`）

### 2.3 Incentive Tooltip 展示

**文件**: `src/components/` 相关组件

TARGET_TOTAL_APR 的 tooltip 展示完整拆分：

```
Target 4.7% = Native 3% + Merkl 1.7%
```

- 主 APR 列展示 Merkl 实付部分（1.7%），与其他 campaignType 一致
- Tooltip 展示总 APR 目标 + nativeAPR + merklActualAPR 三段拆分

### 2.4 budgetBoundMode 对 simulation 的影响

**依赖后端 P1 透传 `budgetBoundMode`**

| budgetBoundMode | budget 充足时 | budget 不足时 | simulation |
|---|---|---|---|
| `MAX_APR` | `max(aprCap - nativeAPR, 0)` | APR 被 TVL 稀释降到 target 以下 | 复用现有 MAX 子逻辑 |
| `FIX_APR` | `max(aprCap - nativeAPR, 0)` | campaign 提前结束 | 复用现有 FIX 子逻辑（fixRewardableDays） |

当前 3 个活跃 campaign 的 budgetBoundMode 全部是 `MAX_APR`。

---

## 3. 当前 Aave 活跃的 TARGET_TOTAL_APR Campaign

| campaignId | distributionMethod | reserve | side | targetAPR (aprCap) | budgetBoundMode |
|---|---|---|---|---|---|
| 13116567236794890552 | AAVE_NET_APR | 4326:0x7e32...c28 | supply | 4.7% | MAX_APR |
| 12662496063613214537 | AAVE_V4_NET_APR | 1:0x973a...e29:0xcca8...6c9 | supply | 5.83% | MAX_APR |
| 8647796357084493685 | AAVE_V4_NET_APR | 1:0x6540...1dc:0xcca8...6c9 | supply | 7.7% | MAX_APR |

全部是 supply 侧，budgetBoundMode 全部为 MAX_APR。borrow 侧暂无活跃 campaign。

---

## 4. borrow 侧注意事项

当前无 borrow 侧 TARGET_TOTAL_APR campaign。如果未来出现，公式推断为 `max(aprCap - nativeAPR, 0)`（与 supply 对称），但未经实证。前端实现时应覆盖 borrow 路径（取 `borrowApy` 作为 nativeAPR），但标记为"基于推断，待实证"。

---

## 5. 不需要处理的项目

| 字段 | 原因 |
|---|---|
| `spreadCap` | 仅 ERC4626_SPREAD_CAPPED 需要，已从后端类型中移除。文档记录 vault 模式预留 |
| `rawDistributionMethod` | Aave lending 场景只有 AAVE_NET_APR / AAVE_V4_NET_APR，公式相同 |
| `vaultAPR` | Merkl API 不提供，后端无法透传 |
| `merklOppAPR` | 需聚合同 reserve 上其他 opportunity，当前未实现 |
| ERC4626 5 种子类型 | 全部 vault-based，后端无法获取 vaultAPR，短期不可做 |

---

## 6. 实施顺序建议

1. **P0（可立即开始）**: 新增 TARGET_TOTAL_APR APR 计算（`max(aprCap - nativeAPR, 0)`），区分 supply/borrow side，tooltip 完整拆分展示
2. **P1（等后端透传 budgetBoundMode）**: `forecastWithTVL` 新增 TARGET_TOTAL_APR 路径，根据 budgetBoundMode 委托 MAX/FIX 子逻辑
3. **P2（defer）**: ERC4626 子类型支持（需要 vaultAPR 数据源，当前不可用）

---

## 7. 共享文档

- **`aaveapy-doc/merkl-distribution-types.md`** — 4 大 Family + 7 种子类型 + budget-bound mode + APR 公式 + dilutive 示例
- **`docs/adr/0024-merkl-campaign-type-multi-level-mapping.md`**（后端仓库）— 映射表 + APR cap 语义差异
- **Merkl 官方文档** — https://docs.merkl.xyz/merkl-mechanisms/distributions
- **Merkl Schema API** — https://api.merkl.xyz/v4/schemas/distributionMethod
