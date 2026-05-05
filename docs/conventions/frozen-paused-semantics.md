# Frozen / Paused 语义对比（V3 vs V4）

本文档记录 Aave V3 和 V4 中 `isFrozen` 和 `isPaused` 标志的精确语义差异，
作为 [FrozenStatusBadge](../../src/components/dashboard/FrozenStatusBadge.tsx) 组件的设计参考。

---

## 一、V3 语义

来源：[Aave V3 Pool Configurator Docs](https://aave.com/docs/aave-v3/smart-contracts/pool-configurator)

### `isFrozen`（冻结）

管理权限：Risk Admin / Pool Admin

| 操作 | 状态 |
|------|------|
| Supply（存款） | ❌ 禁止 |
| Borrow（借款） | ❌ 禁止 |
| Repay（还款） | ✅ 允许 |
| Withdraw（取款） | ✅ 允许 |
| Liquidate（清算） | ✅ 允许 |
| Rate Rebalance（利率再平衡） | ✅ 允许 |

> V3.1+ 冻结时 LTV 自动设为 0，不影响用户 Health Factor（Liquidation Threshold 不变）。

### `isPaused`（暂停）

管理权限：Emergency Admin / Pool Admin

| 操作 | 状态 |
|------|------|
| Supply（存款） | ❌ 禁止 |
| Borrow（借款） | ❌ 禁止 |
| Repay（还款） | ❌ 禁止 |
| Withdraw（取款） | ❌ 禁止 |
| Liquidate（清算） | ❌ 禁止 |
| aToken Transfers（aToken 转账） | ❌ 禁止 |

---

## 二、V4 语义

来源：[aave-v4 GitHub Issue #453](https://github.com/aave/aave-v4/issues/453)、[ChainSecurity Audit Report](https://reports.chainsecurity.com/Aave/ChainSecurity_AaveLabs_AaveV4_Audit.pdf)

V4 采用 **Hub & Spoke** 架构，标志分为两层：

### Hub 层面（per asset）

| 标志 | 语义 |
|------|------|
| `active` | 与 `paused` 互为互补（`active === !paused`） |
| `paused` | 禁止 add / remove / draw / restore（影响 Hub 流动性） |
| `frozen` | 禁止 add / draw，但允许 remove / restore |

> Hub 层 flags 不影响 `refreshPremiumDebt` 和 `settlePremiumDebt`。

### Spoke 层面（per reserve）

用户直接交互层，这是 UI 主要关注的部分。

#### `isFrozen`（冻结）

| 操作 | 状态 |
|------|------|
| Supply（存款） | ❌ 禁止 |
| Borrow（借款） | ❌ 禁止 |
| setUsingAsCollateral（设为抵押品） | ❌ 禁止 |
| Withdraw（取款） | ✅ 允许 |
| Repay（还款） | ✅ 允许 |
| liquidationCall（清算） | ✅ 允许 |

> V4 冻结时 collateralFactor 设为 0（动态生效，可能影响 Health Factor，与 V3 行为不同）。

#### `isPaused`（暂停）

| 操作 | 状态 |
|------|------|
| Supply（存款） | ❌ 禁止 |
| Borrow（借款） | ❌ 禁止 |
| Withdraw（取款） | ❌ 禁止 |
| Repay（还款） | ❌ 禁止 |
| liquidationCall（清算） | ❌ 禁止 |
| setUsingAsCollateral（设为抵押品） | ❌ 禁止 |

#### 其他 Spoke 标志

| 标志 | 语义 |
|------|------|
| `active` | 与 `paused` 互为互补 |
| `borrowable` | 为 false 时禁止 borrow |
| `collateral` | 为 false 时禁止 setUsingAsCollateral |

---

## 三、V3 vs V4 差异要点

| 维度 | V3 | V4 |
|------|------|------|
| 架构 | 单层 Pool | Hub + Spoke 双层 |
| Frozen 禁止项 | supply, borrow | supply, borrow, **setUsingAsCollateral** |
| Frozen 允许项 | repay, withdraw, liquidate, **rate-rebalance** | withdraw, repay, liquidationCall |
| Paused 禁止项 | supply, borrow, repay, withdraw, liquidate, **aToken transfer** | supply, borrow, repay, withdraw, liquidationCall, **setUsingAsCollateral** |
| 冻结对 HF 影响 | LTV=0，HF 不变 | collateralFactor=0，HF 可能受影响 |
| 额外标志 | 无 | borrowable, collateral, active（互补 paused） |
| 动态风险配置 | 不支持 | 支持（新参数只对新仓位生效） |

---

## 四、UI 文案策略

UI 文案采用 **最大公约数** 策略：只描述两个版本中行为一致的核心操作，
避免让普通用户困惑于版本差异。详细差异见本文档。

如需展示版本差异化信息，可考虑在 `FrozenStatusBadge` 中增加 `protocolVersion` 参数。

### 当前文案

**Frozen:**
> deposits and borrows are temporarily disabled, but existing positions can
> still be repaid, withdrawn, and liquidated.

**Paused:**
> all reserve actions (deposit, borrow, repay, withdraw, liquidations, and
> aToken transfers) are halted.
