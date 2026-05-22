# Aaveapy

Aave V3/V4 市场分析前端。领域术语锚定 Aave 协议原词；UI 侧别名见 `docs/TERMINOLOGY.md` 映射链。

## Interest Rate Model

**Liquidity Rate**:
协议内部的供应者收益率，以 ray (10^27) 定点数表示。UI 层转换为 `supplyAprPercent` / `supplyApyPercent`。
_Avoid_: Supply Rate（这是 UI 别名，领域层用 Liquidity Rate 跟协议走）

**Reserve Factor**:
协议从利息中抽取的费用比例，单位 bps（0–10000）。`reserveFactor = 1000` 即 10%。
_Avoid_: Protocol Fee

**Supply Usage Rate**:
供给利用率 = (总债务 + deficit) / 可用流动性。含 deficit，用于 Liquidity Rate 计算。
_Avoid_: Supply Utilization（同义但代码中不出现）

**Borrow Usage Rate**:
借款利用率 = 总债务 / 可用流动性。不含 deficit，用于外部展示。
_Avoid_: Borrow Utilization

**Optimal Usage Rate**:
两斜率模型中，第一段斜率到第二段斜率的转折点利用率。协议参数，ray 定点数。
_Avoid_: Optimal Utilization

## Incentive Programs

**Merkl Campaign**:
Merkl 协议分发的激励活动。按活动类型分三种：Dutch Auction（衰减拍卖）、MAX（APR 上限 + 追补）、FIX（固定 APR 预算）。
_Avoid_: Merkl Reward, Merkl Incentive

**Merit Program**:
Aave 官方的 Merit 激励项目。有 per-user deposit ceiling 和 self-cap 模型，独立于 Merkl Campaign。
_Avoid_: Merit Reward, Merit Incentive

**Brevis Incentive**:
Brevis 协议分发的激励。有 per-user reward ceiling 模型。
_Avoid_: Brevis Campaign, Brevis Program

**Tydro Points**:
仅 Merkl Campaign 的可选 points 路径产出的积分。转换公式：`points × pointToUsdRate × 36.5`。Merit / Brevis / 协议激励**不是** Tydro Points。
_Avoid_: Points（太泛）

## Limits

**Deposit Ceiling**:
Per-user 存款上限。Merit 自有模型中限制单个用户能存入的金额。
_Avoid_: Per-User Deposit Cap, Self Cap

**Reward Ceiling**:
Per-user 奖励上限。Brevis 模型中限制单个用户能获得的奖励金额。
_Avoid_: Per-User Reward Cap

**Supply Cap / Borrow Cap**:
Pool-wide 总量上限。Aave 协议参数，限制整个池子的存款/借款总量。与 Ceiling（per-user）是不同概念。
_Avoid_: Supply Ceiling, Borrow Ceiling（Ceiling 保留给 per-user 语义）

## Identity

**Reserve ID**:
单个字段作为 reserve 的 canonical key。代码中禁止用 `(underlyingAsset, chainId)` 组合作为 key 的 fallback 路径。
_Avoid_: Composite key, (underlyingAsset, chainId) pair

---

## Example Dialogue

> **Dev**: 为什么 `meritForecast.ts` 里有 deposit ceiling 而 `merklForecast.ts` 里没有？
>
> **Domain Expert**: 因为 Merit Program 给每个用户设了存款上限（Deposit Ceiling），超出就不算奖励。Merkl Campaign 不限单用户存款，它限的是整个 campaign 的预算。
>
> **Dev**: 那 `supplyCapUsd` 也是上限，跟 Deposit Ceiling 有什么区别？
>
> **Domain Expert**: Supply Cap 是 pool-wide 的——整个池子最多存这么多，Aave 协议参数。Deposit Ceiling 是 per-user 的——单个用户最多存这么多，Merit 自己的规则。两个完全不同的概念。
>
> **Dev**: 明白了。所以 ceiling 是 per-user，cap 是 pool-wide。
>
> **Domain Expert**: 对，这就是我们的命名约定。
