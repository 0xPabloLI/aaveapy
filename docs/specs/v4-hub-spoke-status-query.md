# V4 Hub/Spoke 状态查询方法

本文档记录如何通过 Aave V4 SDK (`api.aave.com/graphql`) 查询 Hub 和 Spoke 层的状态字段，
以及它们与合约存储的对照关系。

---

## 一、两层架构的两个 `active` 字段

V4 的 Hub & Spoke 架构中有**两个不同层级、不同含义的 `active` 字段**，容易混淆：

| 字段 | 类型 | 层级 | 存储 | 含义 |
|---|---|---|---|---|
| `ReserveStatus.active` | Reserve | Spoke 层 | **indexer 计算**（链上无此 bit） | 该 reserve 是否在 Spoke 上已配置且未被 paused |
| `HubSpokeConfig.active` | Hub-Spoke | Hub 层 | **链上存储** `SpokeData.active` | Spoke 是否被 Hub 允许执行任何操作 |

两者**不是同一个东西**，查询方式也不同。

---

## 二、ReserveStatus.active（Spoke 层）

### 查询入口

通过 `reserves()` action 返回，每个 reserve 包含：

```json
{
  "status": {
    "__typename": "ReserveStatus",
    "frozen": false,
    "paused": false,
    "active": true
  }
}
```

### 真实数据验证

以 2026-05-07 的实际 SDK 返回数据（全部 reserve，含 2 个 frozen 状态）验证公式：

#### 正常 reserve（全部）：`frozen=false, paused=false → active=true` ✓

#### Frozen reserve 反例：

```
frozen: true, paused: false → active: true   ← 关键反例
```

这**直接否证**了 `active = !paused && !frozen`。

### 结论

`ReserveStatus.active` **不是** `!paused && !frozen`。

最可能的计算公式是 `active = !paused`（即 `active` 仅反映 pause 状态），
但无 `paused=true` 的数据无法 100% 验证。该字段由 `api.aave.com` indexer 服务端计算，
SDK 源码中无 resolver 实现。

**建议**：前端判断 reserve 是否「可用」时，应直接使用 `canSupply`/`canBorrow`/`canUseAsCollateral`
等计算字段，而不应自行组合 `active && !frozen`。

---

## 三、HubSpokeConfig.active 和 halted（Hub 层）

### 合约端

[IHub.SpokeData](https://github.com/aave/aave-v4/blob/main/src/hub/interfaces/IHub.sol#L77-L91)：

```solidity
struct SpokeData {
    uint120 drawnShares;
    uint120 premiumShares;
    int200 premiumOffsetRay;
    uint120 addedShares;
    uint40 addCap;
    uint40 drawCap;
    uint24 riskPremiumThreshold;
    bool active;   // "True if the Spoke is allowed to perform any action"
    bool halted;   // "True if the Spoke is prevented from actions that instantly update liquidity"
    uint200 deficitRay;
}
```

Hub._updateSpokeConfig 可修改 active 和 halted，_addSpoke 初始化为 `active: true, halted: false`。

### SDK 查询

GraphQL 查询：

```graphql
query HubSpokeConfigs($hubId: HubId!, $spokeId: SpokeId!) {
  hubSpokeConfigs(request: { hubId: $hubId, spokeId: $spokeId }) {
    __typename
    hub { name address }
    spoke { name address }
    asset { underlying { info { symbol name } } }
    supplyCap { amount { onChainValue } exchangeRate { value } }
    borrowCap { amount { onChainValue } exchangeRate { value } }
    active
    halted
    riskPremiumThreshold { value normalized }
  }
}
```

### 实际返回示例（2026-05-07，Ethereum Mainnet）

```json
{
  "hubSpokeConfigs": [
    {
      "__typename": "HubSpokeConfig",
      "hub": {
        "name": "Core",
        "address": "0xCca852Bc40e560adC3b1Cc58CA5b55638ce826c9"
      },
      "spoke": {
        "name": "Main",
        "address": "0x94e7A5dCbE816e498b89aB752661904E2F56c485"
      },
      "asset": {
        "underlying": { "info": { "symbol": "WETH", "name": "Wrapped Ether" } }
      },
      "active": true,
      "halted": false
    }
    // ...每个 (hub, spoke, asset) 三元组一条记录
  ]
}
```

当前 (Core, Main) 上所有 14 个 asset 的返回值均为 `active: true, halted: false`。

### 参数格式

`hubId` / `spokeId` 格式：`base64(chainId::contractAddress)`

示例：
- hubId: `"MTo6MHhDY2E4NTJCYzQwZTU2MGFkQzNiMUNjNThDQTViNTU2MzhjZTgyNmM5"` (1::0xCca8...)
- spokeId: `"MTo6MHg5NGU3QTVkQ2JFODE2ZTQ5OGI4OWFCNzUyNjYxOTA0RTJGNTZjNDg1"` (1::0x94e7...)

可通过 `hubs()` 和 `spokes()` 查询获得。

### SDK 四层访问

| 层 | API | 说明 |
|---|---|---|
| Fragment | `HubSpokeConfigFragment` | gql.tada 类型化字段片段 |
| Query | `HubSpokeConfigsQuery` | GraphQL 查询定义 |
| Action | `hubSpokeConfigs(client, { hubId, spokeId })` | 命令式调用 |
| Hook | `useHubSpokeConfigs({ hubId, spokeId })` | React 声明式 |

**注意**：当前发布的 `@aave/client-v4@4.1.1` 不包含 `hubSpokeConfigs` action（仅 SDK 源码 monorepo 中有定义）。
如需使用，可直调 GraphQL API 或升级到后续版本。

### 语义说明

| 字段 | true 含义 | false 含义 | 影响范围 |
|---|---|---|---|
| `active` | Spoke 可正常操作 | **所有** Hub 操作被拒绝 | add/remove/draw/restore/reportDeficit/refreshPremium/payFeeShares/transferShares |
| `halted` | 流动性即时变更被阻止 | 仅阻止流动性操作 | add/remove/draw/restore/transferShares（deficit/fee/premium 继续） |

`active` 和 `halted` 是**独立标志**，并非互补。一个 spoke 可以 `active=true, halted=true`。

---

## 四、Reserve 级别 canXxx 字段

这些是 indexer 计算字段，同为 `reserves()` 返回，非合约直接存储：

| 字段 | 含义 | 判定条件（推测） |
|---|---|---|
| `canSupply` | 当前可否存款 | `hub.active && !hub.halted && !spoke.paused && …` |
| `canBorrow` | 当前可否借款 | `hub.active && !hub.halted && !spoke.paused && !frozen && borrowable && …` |
| `canUseAsCollateral` | 当前可否作抵押品 | `collateralFactor > 0 && !paused && …` |
| `canSwapFrom` | 当前可否从此 reserve swap | indexer 多条件综合 |

这些字段挂载在 `Reserve` 类型上（非 `ReserveUserState`），无用户上下文时即反映 reserve 自身可用性；
有用户上下文时额外考虑用户级限制（余额、cap 等）。

---

## 五、Position Manager 权限

### 授权机制

Position Manager **不能越过用户直接操纵其资产**。必须两步：

1. **治理激活**：`restricted` 角色调用 `updatePositionManager(pm, true)` 设置 `config.active = true`
2. **用户授权**：用户调用 `setUserPositionManager(pm, true)` 设置 `config.approval[user] = true`

([_isPositionManager](https://github.com/aave/aave-v4/blob/main/src/spoke/Spoke.sol#L909-L913) 要求两者同时为 true)

用户授权方式：
- `setUserPositionManager(pm, true)` — 直接授权
- `setUserPositionManagersWithSig(params, sig)` — EIP-712 签名批量授权
- PM 可通过 `renouncePositionManagerRole(user)` 主动放弃授权

### 可执行操作

| 操作 | 函数 | 说明 |
|---|---|---|
| Supply | `supply(reserveId, amount, onBehalfOf)` | 用 msg.sender 的资金替用户存款 |
| Withdraw | `withdraw(reserveId, amount, onBehalfOf)` | 替用户取款到 msg.sender |
| Borrow | `borrow(reserveId, amount, onBehalfOf)` | 替用户借款到 msg.sender |
| Repay | `repay(reserveId, amount, onBehalfOf)` | 用 msg.sender 的资金替用户还款 |
| 抵押品 | `setUsingAsCollateral(reserveId, bool, onBehalfOf)` | 替用户启用/禁用抵押品 |
| 风险溢价 | `updateUserRiskPremium(onBehalfOf)` | 替用户刷新风险溢价 |
| 动态配置 | `updateUserDynamicConfig(onBehalfOf)` | 替用户更新动态配置 |

> 清算 (`liquidationCall`) 不需要 PM 权限，任何人可调用。
