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

| 标志                 | 作用                  | 关掉后能做什么               |
| ------------------ | ------------------- | --------------------- |
| `isActive`         | 储备池是否激活/存在          | 仅 aToken 转账可用（其余全部禁止） |
| `isFrozen`         | 禁止新资金流入和新借款         | **仅供给和借款被禁**，其余操作均可用  |
| `borrowingEnabled` | 是否允许借款（仅非 eMode 用户） | 仅借款被禁，其余操作不受影响        |
| `isPaused`         | 紧急暂停全部操作（最严厉上限）     | 所有操作全禁止               |

### `isActive`（激活）

最低层开关，未激活时资产不存在于协议中。

**校验规则**：几乎所有函数都强制要求 `isActive == true`，唯一例外是 `validateTransfer()`（aToken 转账），它只检查 `isPaused`。

### `isFrozen`（冻结）

管理权限：Risk Admin / Pool Admin

**校验源码**：

- `validateSupply()` — 完整解构 `(isActive, isFrozen, , isPaused)` → `require(!isFrozen)`
- `validateBorrow()` — 完整解构 `(isActive, isFrozen, borrowingEnabled, isPaused)` → `require(!isFrozen)`
- `validateSetUseReserveAsCollateral()` — **故意跳过**：`(isActive, , , isPaused)`（两个空逗号跳过 isFrozen 和 borrowingEnabled）

| 操作                          | 状态   | 源码逻辑                                                                |
| --------------------------- | ---- | ------------------------------------------------------------------- |
| Supply（存款）                  | ❌ 禁止 | `validateSupply()` 显式校验 `!isFrozen`                                 |
| Borrow（借款）                  | ❌ 禁止 | `validateBorrow()` 显式校验 `!isFrozen`                                 |
| setUsingAsCollateral（设为抵押品） | ✅ 允许 | `validateSetUseReserveAsCollateral()` 用空逗号跳过 isFrozen               |
| Repay（还款）                   | ✅ 允许 | `validateRepay()` 只取 isActive + isPaused                            |
| Withdraw（取款）                | ✅ 允许 | `validateWithdraw()` 只取 isActive + isPaused                         |
| aToken Transfer（aToken 转账）  | ✅ 允许 | `validateTransfer()` 只校验 isPaused（连 isActive 都不查）                   |
| Liquidate（清算）               | ✅ 允许 | `validateLiquidationCall()` 对双方都只取 isActive + isPaused，不校验 isFrozen |

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

| 用户状态       | borrow 判断依据                         |
| ---------- | ----------------------------------- |
| 在 eMode 中  | eMode category 的 `borrowableBitmap` |
| 不在 eMode 中 | 该标志 `borrowingEnabled`              |

> 即使 `borrowingEnabled = true`，如果 `isFrozen = true` 或 `isPaused = true`，
> 仍然不能 borrow（更高优先级标志拦截）。

### `isPaused`（暂停）

管理权限：Emergency Admin / Pool Admin

**最严厉的运行时开关**。V3 中几乎所有函数都强制要求 `!isPaused`，
它是所有 validate 函数的最高优先级校验之一。

| 操作                          | 状态   |
| --------------------------- | ---- |
| Supply（存款）                  | ❌ 禁止 |
| Borrow（借款）                  | ❌ 禁止 |
| Repay（还款）                   | ❌ 禁止 |
| Withdraw（取款）                | ❌ 禁止 |
| Liquidate（清算）               | ❌ 禁止 |
| setUsingAsCollateral（设为抵押品） | ❌ 禁止 |
| aToken Transfers（aToken 转账） | ❌ 禁止 |

> `validateTransfer()` 是 V3 中唯一不在校验层检查 isActive 的函数：
>
> ```solidity
> function validateTransfer(DataTypes.ReserveData storage reserve) internal view {
>     require(!reserve.configuration.getPaused(), Errors.ReservePaused());
> }
> ```

### V3 四标志 × 七操作的完整矩阵

基于对 `ValidationLogic.sol` 全部 7 处 `getFlags()` 调用的逐行分析：

| 操作 \ 标志             | isActive | isFrozen | borrowingEnabled | isPaused |
| ------------------- | -------- | -------- | ---------------- | -------- |
| supply              | ✅ 必须     | ✅ 阻止     | —                | ✅ 阻止     |
| withdraw            | ✅ 必须     | ❌ 不管     | —                | ✅ 阻止     |
| borrow              | ✅ 必须     | ✅ 阻止     | ✅ *(仅非eMode)*    | ✅ 阻止     |
| repay               | ✅ 必须     | ❌ 不管     | —                | ✅ 阻止     |
| setCollateral       | ✅ 必须     | ❌ 不管     | —                | ✅ 阻止     |
| transfer（aToken 转账） | ❌ 不管     | ❌ 不管     | —                | ✅ 阻止     |
| liquidation         | ✅ 必须     | ❌ 不管     | —                | ✅ 阻止     |

✅ 必须 = 必须满足条件（active=true，其余=false）
❌ 不管 = 不检查该标志
— = 不涉及此标志

> **UI 实现注意**：判断 `setCollateral` 是否可用时，需要**三标志联合判断**：
> `active=true && paused=false` → 可用（frozen 不拦）。
> 若只根据 frozen/paused 判断而忽略 active，`active=false` 的资产会漏过禁用逻辑。

***

## 二、V4 语义

来源：[aave-v4 源码](https://github.com/aave/aave-v4)，基于对 `Spoke.sol`、`LiquidationLogic.sol`、`Hub.sol`、`ReserveFlagsMap.sol`、`SpokeConfigurator.sol` 的逐行分析。

V4 采用 **Hub & Spoke** 双层架构，标志分布在两个层级，各自独立控制。

### Hub 层面（per spoke per asset）

Hub 的 `SpokeData` 结构体包含两个独立的布尔标志（**注意：Hub 层没有 frozen/paused 概念**）：

| 标志       | 语义                                                               |
| -------- | ---------------------------------------------------------------- |
| `active` | Spoke 是否可执行任何操作。`active=false` 时所有 Hub 操作均被拒绝                    |
| `halted` | Spoke 是否被暂停流动性变更。`halted=true` 时禁止 add / remove / draw / restore |

> `active` 和 `halted` 是**两个独立标志**，**并非互补关系**。一个 Spoke 可以同时是 `active=true, halted=true`。

**Hub 校验逻辑**（源码 `Hub.sol`）：

| Hub 操作           | `active` | `halted` | 说明                            |
| ---------------- | -------- | -------- | ----------------------------- |
| `add`（供给）        | ✅ 必须     | ✅ 阻止     | 即 Spoke supply → Hub add      |
| `remove`（移除）     | ✅ 必须     | ✅ 阻止     | 即 Spoke withdraw → Hub remove |
| `draw`（提取）       | ✅ 必须     | ✅ 阻止     | 即 Spoke borrow → Hub draw     |
| `restore`（归还）    | ✅ 必须     | ✅ 阻止     | 即 Spoke repay → Hub restore   |
| `reportDeficit`  | ✅ 必须     | ❌ 不管     | 坏账上报不受 halted 影响              |
| `refreshPremium` | ✅ 必须     | ❌ 不管     | premium 刷新不受 halted 影响        |
| `payFeeShares`   | ✅ 必须     | ❌ 不管     | 清算费用分配不受 halted 影响            |
| `transferShares` | ✅ 必须     | ✅ 阻止     | 双方 Spoke 都需 active 且非 halted  |

### Spoke 层面（per reserve）

用户直接交互层，**这是 UI 主要关注的部分**。

Spoke 的 `ReserveFlagsMap` 用一个 `uint8` 位图存储四个独立标志（源码 `ReserveFlagsMap.sol`）：

| 标志                     | 位掩码    | 语义                                 |
| ---------------------- | ------ | ---------------------------------- |
| `paused`               | `0x01` | 紧急暂停，所有用户操作均被禁止                    |
| `frozen`               | `0x02` | 冻结新活动，禁止新资金流入和新借款                  |
| `borrowable`           | `0x04` | 是否允许借款（取代 V3 的 `borrowingEnabled`） |
| `receiveSharesEnabled` | `0x08` | 清算时清算人是否可以接收抵押品份额（V4 新增，无 V3 对应物）  |

> **V4 没有** **`isActive`** **标志在 Spoke 层**——与 V3 不同，Spoke reserve 的「是否存在」通过 `_reserves.get(reserveId)`（检查 `hub != address(0)`）或 `reserveId < _reserveCount` 隐式检查，不需要单独的 active 标志。

#### `frozen`（冻结）

管理权限：通过 `SpokeConfigurator.updateFrozen()` / `freezeReserve()` / `freezeAllReserves()` 设置（`restricted` 权限）

**校验源码**（`Spoke.sol`）：

```solidity
function _validateSupply(ReserveFlags flags) internal pure {
    require(!flags.paused(), ReservePaused());
    require(!flags.frozen(), ReserveFrozen());
}

function _validateBorrow(ReserveFlags flags) internal pure {
    require(!flags.paused(), ReservePaused());
    require(!flags.frozen(), ReserveFrozen());
    require(flags.borrowable(), ReserveNotBorrowable());
}

function _validateSetUsingAsCollateral(..., bool usingAsCollateral) internal view {
    require(!flags.paused(), ReservePaused());
    if (usingAsCollateral) {
        // 仅「启用」抵押品时检查 frozen，「禁用」不检查
        require(!flags.frozen(), ReserveFrozen());
    }
}
```

| 操作                                   | 状态   | 源码逻辑                                                              |
| ------------------------------------ | ---- | ----------------------------------------------------------------- |
| Supply（存款）                           | ❌ 禁止 | `_validateSupply()` 显式校验 `!frozen`                                |
| Borrow（借款）                           | ❌ 禁止 | `_validateBorrow()` 显式校验 `!frozen`                                |
| setUsingAsCollateral **启用**          | ❌ 禁止 | `_validateSetUsingAsCollateral()` 仅在 `usingAsCollateral=true` 时校验 |
| setUsingAsCollateral **禁用**          | ✅ 允许 | frozen 分支只在启用时触发，禁用不检查                                            |
| Withdraw（取款）                         | ✅ 允许 | `_validateWithdraw()` 只检查 `paused`                                |
| Repay（还款）                            | ✅ 允许 | `_validateRepay()` 只检查 `paused`                                   |
| liquidationCall（清算）                  | ✅ 允许 | `_validateLiquidationCall()` 只检查 `paused`                         |
| liquidationCall + receiveShares=true | ❌ 禁止 | 额外要求 `!frozen && receiveSharesEnabled`                            |

> **关键设计意图**：Frozen 阻止「新资金流入」和「新借款」，同时阻止新的抵押品启用（与 V3 不同），
> 但允许用户退出：取款、还款、禁用抵押品、被清算（只是不能以 shares 方式接收清算收益）。
>
> V4 frozen 时 collateralFactor 通过 DynamicReserveConfig 管理，可以独立于 frozen 设为 0——
> 与 V3 的 LTV=0 自动联动不同，V4 需要单独操作。

#### `paused`（暂停）

管理权限：通过 `SpokeConfigurator.updatePaused()` / `pauseReserve()` / `pauseAllReserves()` 设置（`restricted` 权限）

**最严厉的运行时开关**。所有 Spoke 用户操作的 validate 函数都以 `require(!flags.paused())` 开头。

| 操作                             | 状态   |
| ------------------------------ | ---- |
| Supply（存款）                     | ❌ 禁止 |
| Borrow（借款）                     | ❌ 禁止 |
| Withdraw（取款）                   | ❌ 禁止 |
| Repay（还款）                      | ❌ 禁止 |
| liquidationCall（清算）            | ❌ 禁止 |
| setUsingAsCollateral（启用/禁用抵押品） | ❌ 禁止 |

> 源码确认：`_validateLiquidationCall()` 对**双方** reserve（抵押品和债务）都检查 `!paused()`。

#### `borrowable`（借款开关）

仅影响 borrow 操作。源码逻辑直接明了：`_validateBorrow()` 中 `require(flags.borrowable(), ReserveNotBorrowable())`。

| `borrowable` 值 | borrow 是否允许                   |
| -------------- | ----------------------------- |
| `true`         | 允许（仍需满足 `!paused && !frozen`） |
| `false`        | 禁止                            |

> V4 不区分 eMode/非 eMode，`borrowable` 对所有用户统一生效。
> 取代了 V3 的 `borrowingEnabled` + eMode `borrowableBitmap` 的双重逻辑。

#### `receiveSharesEnabled`（清算份额接收开关）

V4 新增标志，仅在 liquidationCall 的 `receiveShares=true` 路径中检查。

源码（`LiquidationLogic._validateLiquidationCall()`）：

```solidity
if (params.receiveShares) {
    require(
        !params.collateralReserveFlags.frozen() &&
            params.collateralReserveFlags.receiveSharesEnabled(),
        ISpoke.CannotReceiveShares()
    );
}
```

| 场景                                       | 结果                          |
| ---------------------------------------- | --------------------------- |
| receiveShares=false                      | 不检查此标志                      |
| receiveShares=true && !frozen && enabled | ✅ 允许                        |
| receiveShares=true && frozen             | ❌ 禁止（`CannotReceiveShares`） |
| receiveShares=true && !enabled           | ❌ 禁止（`CannotReceiveShares`） |

### V4 四标志 × 七操作的完整矩阵

基于对 `Spoke.sol` 全部 validate 函数的逐行分析：

| 操作 \ 标志                         | paused | frozen | borrowable | receiveSharesEnabled |
| ------------------------------- | ------ | ------ | ---------- | -------------------- |
| supply                          | ✅ 阻止   | ✅ 阻止   | —          | —                    |
| withdraw                        | ✅ 阻止   | ❌ 不管   | —          | —                    |
| borrow                          | ✅ 阻止   | ✅ 阻止   | ✅ 必须 true  | —                    |
| repay                           | ✅ 阻止   | ❌ 不管   | —          | —                    |
| setCollateral（启用）               | ✅ 阻止   | ✅ 阻止   | —          | —                    |
| setCollateral（禁用）               | ✅ 阻止   | ❌ 不管   | —          | —                    |
| liquidationCall                 | ✅ 阻止   | ❌ 不管   | —          | —                    |
| liquidationCall + receiveShares | ✅ 阻止   | ✅ 阻止\* | —          | ✅ 必须 true            |

✅ 阻止 = 该标志处于限制状态时阻止操作（如 `paused=true`、`frozen=true`、`borrowable=false`）
❌ 不管 = 不检查该标志
— = 不涉及此标志
\* = 仅影响清算人是否可接收 shares，不影响清算本身

> V4 没有 V3 的 `isActive` 标志和 `aToken transfer` 操作。
> V4 的 reserve 存在性通过 `_reserves.get(reserveId)` 或 `reserveId < _reserveCount` 隐式检查（revert on not listed）。

***

## 三、V3 vs V4 差异要点

### 3.1 架构差异

| 维度      | V3                                                  | V4                                          |
| ------- | --------------------------------------------------- | ------------------------------------------- |
| 架构      | 单层 Pool                                             | Hub + Spoke 双层                              |
| 标志存放位置  | Pool.ReserveConfiguration（单一 bitmap）                | Spoke.ReserveFlagsMap + Hub.SpokeData（分层独立） |
| 运行时开关数量 | 4 个（isActive, isFrozen, borrowingEnabled, isPaused） | Spoke 4 个 + Hub 2 个（见下文）                    |

### 3.2 标志映射关系

| V3 标志              | V4 对应物                                       | 变化说明                                                  |
| ------------------ | -------------------------------------------- | ----------------------------------------------------- |
| `isActive`         | Spoke 层无对应物；Hub 层 `SpokeData.active`         | V4 reserve 存在性通过 `_reserves.get()` / ID 范围隐式检查，不需独立标志 |
| `isFrozen`         | Spoke `ReserveFlagsMap.frozen`               | 语义收紧：额外禁止启用抵押品                                        |
| `borrowingEnabled` | Spoke `ReserveFlagsMap.borrowable`           | 去掉 eMode 豁免逻辑，对所有用户统一生效                               |
| `isPaused`         | Spoke `ReserveFlagsMap.paused`               | 语义基本一致                                                |
| *(无)*              | Hub `SpokeData.active`                       | V4 新增：Hub 层 Spoke 级总开关                                |
| *(无)*              | Hub `SpokeData.halted`                       | V4 新增：Hub 层 Spoke 级暂停流动性变更                            |
| *(无)*              | Spoke `ReserveFlagsMap.receiveSharesEnabled` | V4 新增：控制清算时是否可接收 shares                               |

### 3.3 Frozen 行为差异（**最关键差异**）

| 操作                        | V3 Frozen   | V4 Frozen       | 差异          |
| ------------------------- | ----------- | --------------- | ----------- |
| Supply                    | ❌ 禁止        | ❌ 禁止            | 一致          |
| Borrow                    | ❌ 禁止        | ❌ 禁止            | 一致          |
| Withdraw                  | ✅ 允许        | ✅ 允许            | 一致          |
| Repay                     | ✅ 允许        | ✅ 允许            | 一致          |
| Liquidation               | ✅ 允许        | ✅ 允许            | 一致          |
| **setCollateral 启用**      | **✅ 允许**    | **❌ 禁止**        | ⚠️ **关键差异** |
| **setCollateral 禁用**      | **✅ 允许**    | **✅ 允许**        | 一致          |
| aToken Transfer           | ✅ 允许        | *(V4 无此操作)*     | 架构差异        |
| Liquidation receiveShares | *(V3 无此概念)* | ❌ 禁止（需 !frozen） | V4 新增       |

> **最重要的行为差异**：V3 中 Frozen 资产仍然可以**启用**为抵押品——
> 这是源码级确认的设计意图（`getFlags()` 返回值在 `validateSetUseReserveAsCollateral` 中刻意跳过 isFrozen）。
> V4 中**启用**抵押品被明确禁止，但**禁用**仍然允许（给用户退出路径）。

### 3.4 Paused 行为差异

| 操作              | V3 Paused | V4 Paused   | 差异   |
| --------------- | --------- | ----------- | ---- |
| Supply          | ❌ 禁止      | ❌ 禁止        | 一致   |
| Borrow          | ❌ 禁止      | ❌ 禁止        | 一致   |
| Withdraw        | ❌ 禁止      | ❌ 禁止        | 一致   |
| Repay           | ❌ 禁止      | ❌ 禁止        | 一致   |
| Liquidation     | ❌ 禁止      | ❌ 禁止        | 一致   |
| setCollateral   | ❌ 禁止      | ❌ 禁止        | 一致   |
| aToken Transfer | ❌ 禁止      | *(V4 无此操作)* | 架构差异 |

> Paused 语义在 V3 和 V4 间高度一致，都是最严格的全禁开关。

### 3.5 Borrow 控制差异

| 维度          | V3                                                       | V4                           |
| ----------- | -------------------------------------------------------- | ---------------------------- |
| 标志名称        | `borrowingEnabled`                                       | `borrowable`                 |
| eMode 豁免    | ✅ 在 eMode 中 `borrowingEnabled` 不检查，改用 `borrowableBitmap` | ❌ 无豁免，`borrowable` 对所有用户统一生效 |
| 与 frozen 关系 | frozen 优先级更高（frozen=true 时即使 borrowingEnabled=true 也不能借） | 同理，frozen 优先级更高              |

### 3.6 其他差异

| 维度         | V3                                            | V4                                                          |
| ---------- | --------------------------------------------- | ----------------------------------------------------------- |
| 冻结对 HF 影响  | LTV 自动设为 0，Liquidation Threshold 不变 → HF 不受影响 | collateralFactor 通过 DynamicReserveConfig 独立管理，需单独操作         |
| 动态风险配置     | 不支持                                           | 支持（`DynamicReserveConfig` 按 key 版本化，新配置只对新仓位生效）             |
| Hub 层流动性控制 | *(不适用)*                                       | `SpokeData.active` + `halted` 控制 Hub 层操作                    |
| aToken 转账  | 独立操作，只检查 `isPaused`（连 `isActive` 都不查）         | V4 无 aToken，位置（position）直接由 Spoke 管理                        |
| 清算时接收方式    | 清算人直接获得底层资产或 aToken                           | 清算人可选 receiveShares（受 `frozen` + `receiveSharesEnabled` 约束） |

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
| Paused          | ⏸️ `PauseCircle` | `amber-500` 橙 | 紧急停机，全锁死   |
| Frozen + Paused | ❄️ ⏸️ 并列         | 各用各的色         | 两种独立标志同时展示 |

### 4.3 行/卡片背景色

| 状态                 | 桌面端行背景                  | 移动端卡片背景                 |
| ------------------ | ----------------------- | ----------------------- |
| 无状态                | 默认                      | 默认                      |
| Frozen（仅）          | `ds-bg-sky-500-8` 蓝底    | `ds-bg-sky-500-8` 蓝底    |
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

### 4.6 端侧有意差异

- **移动端 disabled 提示文字作为空位占位**：当 supply/borrow 被禁用且无激励
  时，移动端卡片内显示 `Supply unavailable` / `Borrow unavailable` 文字。桌
  面端对应位置留空。这不是文案遗漏，而是移动端卡片布局的视觉填空策略，避免
  卡片在该区域出现明显空白。
- **文案统一用 `unavailable`**：Supply/Borrow disabled 状态统一使用
  `unavailable` 一词（`Supply unavailable` / `Borrow unavailable`），不一
  端一处用 `disabled` 另一处用 `unavailable`。

### 4.7 Disabled 状态文字可读性（强制性）

当 reserve 因 flag（paused / frozen / supplyDisabled / borrowDisabled）变灰时，
**文字必须保持可读**，不能因为状态指示而牺牲信息获取。

#### 主表格行（DesktopReserveRow）和移动端 Hero APY（MobileReserveCard）

| 位置 | 正常状态 | Disabled 状态（保留颜色语义，只降低强度） |
|------|----------|---------------|
| Supply APY 主值 | `ds-text-emerald-500` | `text-emerald-500/50` |
| Supply Native APY | `ds-text-emerald-500-70` | `text-emerald-500/40` |
| Supply 激励按钮 | `ds-bg-emerald-500-10 ds-text-emerald-500-70` | `bg-emerald-500/10 text-emerald-500/50` |
| Borrow APY 主值 | `ds-text-brand-cyan` | `text-cyan-500/50` |
| Borrow Native APY | `ds-text-brand-cyan-70` | `text-cyan-500/40` |
| Borrow 激励按钮 | `ds-bg-brand-cyan-10 ds-text-brand-cyan-70` | `bg-cyan-500/10 text-cyan-500/50` |

> **保留颜色语义**：disabled 不意味着丢掉颜色身份。Supply 仍然是绿色系、
> Borrow 仍然是青色系，只是降低不透明度来表示「不可操作」。
> **禁止使用 `text-secondary`** 作为 disabled 的数值文字颜色：暗色模式下
> `text-secondary = hsl(220, 8%, 35%)` 几乎不可读。

#### 展开 Simulation 面板（SimulationSubRow）

| 元素 | 正常 | Disabled（亮色 / 暗色） | 原因 |
|------|------|------|------|
| Section 整列 opacity（桌面 `renderTable`） | `''` | `opacity-75` / `dark:opacity-60` | 暗色模式下透明度衰减感知弱，需加强 |
| Section 整列 opacity（紧凑 Grid `renderCompactLayout`） | `''` | `opacity-75 dark:opacity-60`（per-cell via `cellBgClass`） | 与桌面等值，逐 cell 应用因 `display: contents` 不可绘制 |
| Section 标题 disabled | `accentClass` | `text-muted-foreground` | 提示文字，不是数据值，用中性灰即可 |

> 桌面 `renderTable` 版用 `group-data-[disabled]:opacity-75 dark:group-data-[disabled]:opacity-60`，
> 紧凑 Grid 版在 `renderCompactLayout` 中计算 `supplySectionClass` / `borrowSectionClass`（等值），
> 通过 `renderCompactGridRow` 的 `cellBgClass` 逐 cell 应用。两者值一致。

> **Grid 布局关键约束**：`renderCompactGridRow` 中 `data-disabled` 必须与 `group` 放在
> **同一元素**上（同为 label cell `<div>`），否则 `group-data-[disabled]:text-muted-foreground`
> 不会生效。禁止将 `data-disabled` 放在 `display: contents` 的 row wrapper 上。

#### 设计原则

1. **Disabled ≠ Invisible**：用户仍需查看当前 APY/APR 数值来做决策对比。
2. **保留颜色语义**：数值类的 disabled 用半透明彩色（`emerald/cyan/50%`），
   而非中性灰，保持用户对 supply=绿 / borrow=青 的颜色直觉。
3. **提示文字用中性色**：Section 标题的「Supply unavailable」等文案不是
   数据值而是状态提示，用 `text-muted-foreground` 中性灰即可。
4. **暗色模式 opacity 需加强**：透明度衰减在暗背景下感知弱（黑底 + 30% 透明 ≈ 变化微妙），
   用 `dark:opacity-60` 在暗色模式下额外降低 10% 透明度，保证视觉差异。
5. **端侧一致**：桌面端和移动端的 disabled 数值颜色规则完全一致。`text-secondary`
   在任何端侧、任何模式下都不得用于 disabled 状态的数值显示。

