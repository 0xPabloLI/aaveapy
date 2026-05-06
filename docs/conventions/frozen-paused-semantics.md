Frozen / Paused 语义对比（V3 vs V4）

本文档记录 Aave V3 和 V4 中 `isFrozen`、`isPaused` 和 `borrowingEnabled` 标志的精确语义差异，
作为 [FrozenStatusBadge](../../src/components/dashboard/FrozenStatusBadge.tsx) 组件的设计参考。

***

## 一、V3 语义

来源：[Aave V3 ValidationLogic.sol 源码分析](https://github.com/aave-dao/aave-v3-origin/blob/main/src/contracts/protocol/libraries/logic/ValidationLogic.sol)，当前分析版本：**V3.6.0**（`package.json: "version": "3.6.0"`）

### 四个标志总览

V3 的 `ReserveConfiguration.getFlags()` 返回四个独立标志：

```solidity
function getFlags() returns (bool isActive, bool isFrozen, bool borrowingEnabled, bool isPaused)
```

| 标志                 | 作用                            | 关掉后能做什么           |
| ------------------ | ----------------------------- | ----------------------- |
| `isActive`         | 储备池是否激活/存在                    | 仅 aToken 转账可用（其余全部禁止） |
| `isFrozen`         | 禁止新资金流入和新借款                   | **仅供给和借款被禁**，其余操作均可用  |
| `borrowingEnabled` | 是否允许借款（仅非 eMode 用户）           | 仅借款被禁，其余操作不受影响        |
| `isPaused`         | 紧急暂停全部操作（最严厉上限）               | 所有操作全禁止                  |

### `isActive`（激活）

最低层开关，未激活时资产不存在于协议中。

**校验规则**：几乎所有函数都强制要求 `isActive == true`，唯一例外是 `validateTransfer()`（aToken 转账），它只检查 `isPaused`。

### `isFrozen`（冻结）

管理权限：Risk Admin / Pool Admin

**校验源码**：
- `validateSupply()` — 完整解构 `(isActive, isFrozen, , isPaused)` → `require(!isFrozen)`
- `validateBorrow()` — 完整解构 `(isActive, isFrozen, borrowingEnabled, isPaused)` → `require(!isFrozen)`
- `validateSetUseReserveAsCollateral()` — **故意跳过**：`(isActive, , , isPaused)`（两个空逗号跳过 isFrozen 和 borrowingEnabled）

| 操作                                    | 状态   | 源码逻辑                                                                  |
| ------------------------------------- | ---- | --------------------------------------------------------------------- |
| Supply（存款）                            | ❌ 禁止 | `validateSupply()` 显式校验 `!isFrozen`                                  |
| Borrow（借款）                            | ❌ 禁止 | `validateBorrow()` 显式校验 `!isFrozen`                                  |
| setUsingAsCollateral（设为抵押品）            | ✅ 允许 | `validateSetUseReserveAsCollateral()` 用空逗号跳过 isFrozen               |
| Repay（还款）                             | ✅ 允许 | `validateRepay()` 只取 isActive + isPaused                               |
| Withdraw（取款）                           | ✅ 允许 | `validateWithdraw()` 只取 isActive + isPaused                            |
| aToken Transfer（aToken 转账）            | ✅ 允许 | `validateTransfer()` 只校验 isPaused（连 isActive 都不查）                     |
| Liquidate（清算）                          | ✅ 允许 | `validateLiquidationCall()` 对双方都只取 isActive + isPaused，不校验 isFrozen |

> **关键设计意图**：Frozen 目的是阻止「新资金流入」（supply）和「新借款」（borrow），
> 但不影响用户用已有余额管理仓位（设为抵押品、转账、还款、取款、被清算），
> 给用户在资产冻结后仍能保护仓位的灵活性。
>
> V3.6 冻结时 LTV 自动设为 0，不影响用户 Health Factor（Liquidation Threshold 不变）。

### `borrowingEnabled`（借款开关）

**仅影响 borrow 操作**，且只在用户**不在 eMode** 时生效。

源码逻辑（`validateBorrow()`）：
```solidity
if (params.userEModeCategory != 0) {
    // eMode 中：由 category.borrowableBitmap 决定能否借
    require(EModeConfiguration.isReserveEnabledOnBitmap(...), Errors.NotBorrowableInEMode());
} else {
    // 非 eMode 中：由 borrowingEnabled 决定能否借
    require(vars.borrowingEnabled, Errors.BorrowingNotEnabled());
}
```

| 用户状态         | borrow 判断依据                            |
| ------------- | -------------------------------------- |
| 在 eMode 中     | eMode category 的 `borrowableBitmap`    |
| 不在 eMode 中    | 该标志 `borrowingEnabled`                |

> 即使 `borrowingEnabled = true`，如果 `isFrozen = true` 或 `isPaused = true`，
> 仍然不能 borrow（更高优先级标志拦截）。

### `isPaused`（暂停）

管理权限：Emergency Admin / Pool Admin

**最严厉的运行时开关**。V3 中几乎所有函数都强制要求 `!isPaused`，
它是所有 validate 函数的最高优先级校验之一。

| 操作                                     | 状态   |
| -------------------------------------- | ---- |
| Supply（存款）                             | ❌ 禁止 |
| Borrow（借款）                             | ❌ 禁止 |
| Repay（还款）                              | ❌ 禁止 |
| Withdraw（取款）                            | ❌ 禁止 |
| Liquidate（清算）                           | ❌ 禁止 |
| setUsingAsCollateral（设为抵押品）             | ❌ 禁止 |
| aToken Transfers（aToken 转账）            | ❌ 禁止 |

> `validateTransfer()` 是 V3 中唯一不在校验层检查 isActive 的函数：
> ```solidity
> function validateTransfer(DataTypes.ReserveData storage reserve) internal view {
>     require(!reserve.configuration.getPaused(), Errors.ReservePaused());
> }
> ```

### V3 四标志 × 七操作的完整矩阵

基于对 `ValidationLogic.sol` 全部 7 处 `getFlags()` 调用的逐行分析：

| 操作 \ 标志              | isActive | isFrozen | borrowingEnabled | isPaused |
| -------------------- | -------- | -------- | ---------------- | -------- |
| supply               | ✅ 必须    | ✅ 阻止    | —                | ✅ 阻止    |
| withdraw             | ✅ 必须    | ❌ 不管    | —                | ✅ 阻止    |
| borrow               | ✅ 必须    | ✅ 阻止    | ✅ *(仅非eMode)*   | ✅ 阻止    |
| repay                | ✅ 必须    | ❌ 不管    | —                | ✅ 阻止    |
| setCollateral        | ✅ 必须    | ❌ 不管    | —                | ✅ 阻止    |
| transfer（aToken 转账） | ❌ 不管    | ❌ 不管    | —                | ✅ 阻止    |
| liquidation          | ✅ 必须    | ❌ 不管    | —                | ✅ 阻止    |

✅ 必须 = 必须满足条件（active=true，其余=false）
❌ 不管 = 不检查该标志
— = 不涉及此标志

> **UI 实现注意**：判断 `setCollateral` 是否可用时，需要**三标志联合判断**：
> `active=true && paused=false` → 可用（frozen 不拦）。
> 若只根据 frozen/paused 判断而忽略 active，`active=false` 的资产会漏过禁用逻辑。

***

## 二、V4 语义

来源：[aave-v4 GitHub Issue #453](https://github.com/aave/aave-v4/issues/453)、[ChainSecurity Audit Report](https://reports.chainsecurity.com/Aave/ChainSecurity_AaveLabs_AaveV4_Audit.pdf)

V4 采用 **Hub & Spoke** 架构，标志分为两层：

### Hub 层面（per asset）

| 标志       | 语义                                           |
| -------- | -------------------------------------------- |
| `active` | 与 `paused` 互为互补（`active === !paused`）        |
| `paused` | 禁止 add / remove / draw / restore（影响 Hub 流动性） |
| `frozen` | 禁止 add / draw，但允许 remove / restore           |

> Hub 层 flags 不影响 `refreshPremiumDebt` 和 `settlePremiumDebt`。

### Spoke 层面（per reserve）

用户直接交互层，这是 UI 主要关注的部分。

#### `isFrozen`（冻结）

| 操作                          | 状态   |
| --------------------------- | ---- |
| Supply（存款）                  | ❌ 禁止 |
| Borrow（借款）                  | ❌ 禁止 |
| setUsingAsCollateral（设为抵押品） | ❌ 禁止 |
| Withdraw（取款）                | ✅ 允许 |
| Repay（还款）                   | ✅ 允许 |
| liquidationCall（清算）         | ✅ 允许 |

> V4 冻结时 collateralFactor 设为 0（动态生效，可能影响 Health Factor，与 V3 行为不同）。

#### `isPaused`（暂停）

| 操作                          | 状态   |
| --------------------------- | ---- |
| Supply（存款）                  | ❌ 禁止 |
| Borrow（借款）                  | ❌ 禁止 |
| Withdraw（取款）                | ❌ 禁止 |
| Repay（还款）                   | ❌ 禁止 |
| liquidationCall（清算）         | ❌ 禁止 |
| setUsingAsCollateral（设为抵押品） | ❌ 禁止 |

#### 其他 Spoke 标志

| 标志           | 语义                               |
| ------------ | -------------------------------- |
| `active`     | 与 `paused` 互为互补                  |
| `borrowable` | 为 false 时禁止 borrow               |
| `collateral` | 为 false 时禁止 setUsingAsCollateral |

***

## 三、V3 vs V4 差异要点

| 维度              | V3                                                              | V4                                                                         |
| --------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 架构              | 单层 Pool                                                         | Hub + Spoke 双层                                                             |
| **Frozen 禁止 setCollateral** | ❌ **不禁止**（`validateSetUseReserveAsCollateral` 故意跳过 isFrozen 检查） | ✅ **禁止**（这是 V3 vs V4 的**关键行为差异**）                                           |
| Frozen 禁止项       | supply, borrow                                                  | supply, borrow, **setUsingAsCollateral**                                   |
| Frozen 允许项       | repay, withdraw, liquidate, **setUsingAsCollateral**, aToken transfer | withdraw, repay, liquidationCall                                           |
| Paused 禁止项       | supply, borrow, repay, withdraw, liquidate, **setUsingAsCollateral**, aToken transfer | supply, borrow, repay, withdraw, liquidationCall, **setUsingAsCollateral** |
| 冻结对 HF 影响        | LTV=0，HF 不变                                                     | collateralFactor=0，HF 可能受影响                                                |
| borrowingEnabled | ✅ 存在（非 eMode 时控制 borrow）                                         | ❌ V4 无此标志，用 `borrowable` + `collateral` 替代                                |
| 额外标志            | `borrowingEnabled`（仅 borrow 校验）                                  | `borrowable`, `collateral`, `active`（互补 paused）                            |
| 动态风险配置          | 不支持                                                             | 支持（新参数只对新仓位生效）                                                               |

> **最重要的 V3 vs V4 行为差异**：V3 中 Frozen 资产仍然可以设为抵押品——
> 这是源码级确认的设计意图（`getFlags()` 返回值在 `validateSetUseReserveAsCollateral` 中刻意跳过 isFrozen）。
> V4 中此操作被明确禁止。

***

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

| 状态              | 图标               | 颜色            | 语义         |
| --------------- | ---------------- | ------------- | ---------- |
| Frozen（仅）       | ❄️ `Snowflake`   | `sky-500` 蓝   | 中度限制，可退出   |
| Paused          | ⏸️ `PauseCircle` | `ds-text-paused` 橙 | 紧急停机，全锁死   |
| Frozen + Paused | ❄️ ⏸️ 并列         | 各用各的色         | 两种独立标志同时展示 |

### 4.3 行/卡片背景色

| 状态                 | 桌面端行背景                  | 移动端卡片背景                 |
| ------------------ | ----------------------- | ----------------------- |
| 无状态                | 默认                      | 默认                      |
| Frozen（仅）          | `ds-bg-sky-500-8` 蓝底    | `ds-bg-sky-500-8` 蓝底    |
| Paused（含同时 Frozen） | `ds-bg-paused` 橙底 | `ds-bg-paused` 橙底 |

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
- Paused 显示 ⏸️ `PauseCircle` / `bg-[rgb(var(--ds-paused-rgb))]`
- Frozen 显示 ❄️ emoji / `bg-sky-500`

### 4.5 设计取舍

- **图标不带自身背景**：去掉 `bg-sky-500/10` / `bg-[rgb(var(--ds-paused-rgb)/0.1)]` 药丸底色，
  行背景已经传达状态信息，裸 icon 更干净
- **两者同时存在时并排展示**：Frozen 和 Paused 是独立语义，不应互相覆盖
- **Tooltip 始终完整展示**：点击后同时列出 Frozen 和 Paused 的说明文案
- **不区分 V3/V4 版本**：当前对两个版本使用相同规则（最大公约数 + tooltip 补全），
  如需版本差异化展示，可给 `FrozenStatusBadge` 增加 `protocolVersion` 参数
