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

## 四、UI 实现规范

### 4.1 文案策略

UI 文案采用 **最大公约数** 策略：只描述两个版本中行为一致的核心操作，
避免让普通用户困惑于版本差异。详细差异见本文档。

**Frozen:**
> deposits and borrows are temporarily disabled, but existing positions can
> still be repaid, withdrawn, and liquidated.

**Paused:**
> all reserve actions (deposit, borrow, repay, withdraw, liquidations)
> are halted.

### 4.2 图标与颜色

| 状态 | 图标 | 颜色 | 语义 |
|------|------|------|------|
| Frozen（仅） | ❄️ `Snowflake` | `sky-500` 蓝 | 中度限制，可退出 |
| Paused | ⏸️ `PauseCircle` | `amber-500` 橙 | 紧急停机，全锁死 |
| Frozen + Paused | ❄️ ⏸️ 并列 | 各用各的色 | 两种独立标志同时展示 |

### 4.3 行/卡片背景色

| 状态 | 桌面端行背景 | 移动端卡片背景 |
|------|------------|-------------|
| 无状态 | 默认 | 默认 |
| Frozen（仅） | `ds-bg-sky-500-8` 蓝底 | `ds-bg-sky-500-8` 蓝底 |
| Paused（含同时 Frozen） | `ds-bg-amber-500-10` 橙底 | `ds-bg-amber-500-10` 橙底 |

> 同时 Frozen + Paused 时，背景色取 Paused（更严重状态覆盖），
> 因为 Paused 完全包含 Frozen 的语义范围。

### 4.4 图标位置

**桌面端：**
```
🪙 TokenIcon   ❄/⏸   syrupUSDT   ↗ 菜单
```

状态图标位于 TokenIcon 和资产名称之间，作为资产的属性修饰。

**移动端：**
- TokenIcon 左上角叠加小圆点指示器
- Paused 显示 ⏸️ `PauseCircle` / `bg-amber-500`
- Frozen 显示 ❄️ emoji / `bg-sky-500`

### 4.5 设计取舍

- **图标不带自身背景**：去掉 `bg-sky-500/10` / `bg-amber-500/10` 药丸底色，
  行背景已经传达状态信息，裸 icon 更干净
- **两者同时存在时并排展示**：Frozen 和 Paused 是独立语义，不应互相覆盖
- **Tooltip 始终完整展示**：点击后同时列出 Frozen 和 Paused 的说明文案
- **不区分 V3/V4 版本**：当前对两个版本使用相同规则（最大公约数 + tooltip 补全），
  如需版本差异化展示，可给 `FrozenStatusBadge` 增加 `protocolVersion` 参数
