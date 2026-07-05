# Merkl Position Cap (maxDeposit) Implementation Handoff

## 背景

Merkl API 的 AAVE_NET_LENDING campaign 在 Celo 上出现了带 `computeMethod: "maxDeposit"` 的 campaign，
其 `computeSettings.maxDeposit` 字段限制了 per-user 的最大存入量，语义等同于 Merit/Brevis 的 `positionCap`。

当前状态：Merkl breakdown **没有** `positionCap` 字段，Merit 和 Brevis 有。

---

## 1. HookType 解码

### 官方来源

Merkl 有公开的 schema 端点，包含完整的 HookType 枚举：

- **Schema 端点**: `https://api.merkl.xyz/v4/schemas/hookType`
- **Schema Explorer**: https://developers.merkl.xyz/resources/schemas
- **完整参考文档**: 后端仓库 `docs/api/merkl-hooktype-and-compute-score-method.md`

### 采样中出现的 hookType（官方 key 对照）

| hookType | 官方 key | 官方 description | 关键字段 | 出现次数(采样) | 与 maxDeposit 配对 |
|----------|----------|-----------------|----------|---------------|-------------------|
| 2 | ELIGIBILITY | Only allow users who have held a minimum amount of a token on a chain for a specified amount of time | `eligibilityTokenAddress`, `eligibilityTokenThreshold`, `eligibilityDuration` | 4 | 无 |
| 4 | **SANCTIONED** | **Exclude addresses flagged by the U.S. Office of Foreign Assets Control (OFAC)** | `registryAddress`, `registryChainId` | 1 | 无 |
| 7 | APIBOOST | Apply a reward boost to addresses based on a score from an API | `url`, `headers`, `boostingFunction`, `defaultBoost`, `sendScores` | 61 | 无 |
| 9 | REFERRALPROGRAM | Set extra rewards for users who refer to your campaign and their invitees | `key`, `boostForInvited`, `boostForReferrer`, `valueForBoost*`, `cumulativeBoost` | 31 | 无 |
| 10 | WORLDCHAINID | Only allow verified humans with a World ID to earn rewards | `WorldIDAddressBook`, `AddressBookChainId` | 1 | **有** |
| 14 | **BORROW_BL** | **Exclude addresses that have borrowed from the specified lending protocol markets** | `borrowBytesLike`, `protocol`, `computeChainId` | 8 | 无 |
| 16 | **COINBASE_ATTESTATION** | **Restrict rewards to addresses holding a valid Coinbase verification attestation** | `schemaUid`, `attestationIndexerAddress`, `chainId` | 2 | 无 |
| 18 | **WHITELIST_CAMPAIGN** | **Only addresses that are recipients of specified campaigns are eligible** | `bytesLike`, `protocol`, `computeChainId` | 6 | 无 |
| 20 | SELF_VERIFICATION | Restrict rewards to addresses verified according to the Self.xyz verification policy | `verificationId`, `verifierAddress`, `verifierChainId` | 2 | **有** |
| 22 | WHITELIST_ADDRESSES | Provide a list of addresses | `addresses` | 1 | 无 |
| 27 | BLACKLIST_KEY_VALUE_STORE | Provide one or more named key-value stores. Addresses present in any of them are excluded | `keys` | 2 | 无 |

### 旧版推断纠误

本节早期版本基于字段名推断，**3 个 hookType 语义推断有误**：

| hookType | 旧推断（错误） | 官方 key（正确） |
|---|---|---|
| 4 | "Registry（链上注册表验证）" | **SANCTIONED** — OFAC 制裁过滤 |
| 16 | "Attestation（链上 attestation 验证，EAS）" | **COINBASE_ATTESTATION** — Coinbase 验证，非通用 EAS |
| 18 | "Protocol Position（跨链协议仓位验证）" | **WHITELIST_CAMPAIGN** — 按 campaign 收件人白名单 |

此外旧版遗漏了约 17 种 hookType（0/1/3/5/6/8/11/12/13/15/17/19/21/23/24/25/26/28/29/30），完整列表见后端仓库参考文档。

### 对我们代码有实际影响的 hookType

**目前无。** 原因：

- hookType=20（SELF_VERIFICATION / Self.xyz）的 `verificationId`/`verifierAddress` 信息，前端不需要消费——Merkl 链下引擎处理 verification 逻辑，API 返回的 `campaignApr` 已经是 post-verification 的值。
- hookType=10（WORLDCHAINID）同理。
- hookType=7（APIBOOST）的 boosting 在 Merkl 端完成，`campaignApr` 已包含 boost 效果。
- hookType=2（ELIGIBILITY）的 `eligibilityTokenThreshold` 可能对用户有用（"需要持有 X token 才能获得奖励"），但目前量太少（4/400）且 UI 优先级不够，暂不处理。
- hookType=27（BLACKLIST_KEY_VALUE_STORE）的 robinhood-blacklist 已通过 `whitelistOnly` + `campaignAccessStatuses` 机制覆盖。
- hookType=4（SANCTIONED）是 OFAC 制裁过滤，Merkl 端处理，前端无需介入。

**结论**：hookType 数据目前仅供参考，不写入 breakdown 字段，不驱动前端逻辑。
如果未来 Merkl 扩展 verification hook 到更多链/campaign，可以再考虑暴露 `hasVerificationHook` 布尔字段供 UI 显示。

---

## 2. maxDeposit → positionCap 方案

### 数据来源

```
campaign.params.computeScoreParameters.computeMethod === "maxDeposit"
  → campaign.params.computeScoreParameters.computeSettings.maxDeposit: string
```

`maxDeposit` 是 token 原生精度字符串，需换算为 USD：

```
positionCapUsd = Number(maxDeposit) / 10^underlyingDecimals × tokenPrice
```

### 后端改动

1. **`packages/aave-shared-contracts/src/index.ts`** — `MerklCampaignBreakdown` 加 `positionCap?: number`

2. **Merkl fetcher** — 构建 breakdown 时：
   - 检查 `campaign.params.computeScoreParameters.computeMethod === "maxDeposit"`
   - 如果是，提取 `computeSettings.maxDeposit`
   - 用 `params.tokens[0].underlyingDecimals` 除以 10^decimals 得到 token 数量
   - 乘以 token price 得到 USD 值
   - 写入 `breakdown.positionCap`

3. **OpenAPI schema** — `merklBreakdown` 加 `positionCap`

**Q2 回答**：token price 是 reserve token（underlying token）的 price，后端 Merkl fetcher 构建 breakdown 时一定有——
因为后端需要 price 来计算 `campaignApr`、`latestTvl` 等所有 USD 字段。不可能没有。

### 前端改动

4. **`src/shared/market-contract/schemas.ts`** — `MerklCampaignBreakdownSchema` 加 `positionCap: z.number().optional()`

5. **`src/lib/rateSimulationCalculator.ts`** — Merkl forecast 路径加入 position cap 处理：
   - 在 `buildMerklCampaignDetails` 中，检查 breakdown.positionCap
   - 调用已有的 `applyPositionCapToForecastResult`
   - 传入 `isCombineCap` 标志

6. **`src/lib/merklForecast.ts`** — `forecastMerklApr` 中加入 position cap 后处理（类似 `meritForecast.ts` 的做法）

### isCombineCap 语义

**Q5 回答**：

| isCombineCap | 含义 | 对应场景 | positionCap 限制的量 |
|---|---|---|---|
| `false`（默认） | **单侧 cap** — 只限制一个 side 的 position | Merit self breakdown | supply 或 borrow 独立计算 |
| `true` | **combine cap** — supply+borrow 共享一个 cap 额度 | Brevis sharedCap | `eligibleUsd = min(positionUsd, capUsd)` 后，另一侧从 cap 中扣减已用额度 |

代码中 `computeIncentiveAdjustToUsd`（`portfolioCapWarnings.ts:183`）：
- `isCombineCap=false` → 直接返回 `positionCapUsd`
- `isCombineCap=true` → 返回 `max(positionCapUsd - otherSideUsd, 0)`，即扣减对侧已占用的额度

**Merkl 的 maxDeposit 是 net position cap，不是 combine cap**：
- `AAVE_NET_LENDING` 类型本身就是 supply - borrow 的净值
- `maxDeposit` 限制的是 net lending position（supply 减 borrow 后的净值）
- 这和 combine cap（supply+borrow 共享额度）完全不同
- 因此 `isCombineCap = false`
- 但调用 `applyPositionCapToForecastResult` 时，`positionUsd` 应传 **net position**（supplyUsd - borrowUsd），而非 supplyUsd

### Q3 回答：rateSimulationCalculator 是否区分 source？

**是的，仍然区分 source。** `sourceDispatch` 是一个 `Record<SourceKey, ...>` 分发表（行 1288-1328），
merit/merkl/brevis 各有独立的 `sumCurrent`/`sumAfter`/`buildDetails` 实现。

但 position cap 的后处理是**跨 source 共享**的——`applyPositionCapToForecastResult` 和 `applyPositionCap`
是通用函数，Merit 和 Brevis 都调用同一套逻辑。Merkl 加入后也是调用同一套，不需要新建函数。

### 文档更新

7. **`docs/TERMINOLOGY.md`** — Cap Types 表更新：
   - `Position cap` 行的 Source 列加入 Merkl：`meritForecast.ts`, `merklForecast.ts` → `applyPositionCapToForecastResult`
   - 不限定 source 名称（Q6 要求）

8. **`docs/prd/merit-unify-merkl-format.md`** — 差异表更新：
   - Position cap 行 Merkl 列从 "None" 改为 "Has `positionCap` (from `maxDeposit`)"
   - 加注释：Merkl 的 maxDeposit 是 net position cap（isCombineCap=true），与 Merit 的 supply-only cap 语义不同

---

## 3. 实例验证

### Celo USDT (chainId=42220)

| Campaign | computeMethod | maxDeposit | positionCapUsd | hooks |
|----------|--------------|------------|----------------|-------|
| 17611930781702527868 | genericTimeWeighted | 无 | 无 | [] |
| 12800258515658363414 | **maxDeposit** | "1000000000" | 1000 USDT | [hookType=20, verifier=0x6234...] |

### Celo WETH (chainId=42220)

| Campaign | computeMethod | maxDeposit | positionCapUsd | hooks |
|----------|--------------|------------|----------------|-------|
| 15681924849185486732 | **maxDeposit** | "20150000000000000000" | 20.15 WETH | [hookType=20, verifier=0x6234...] |

### Chain 480 (ERC20LOGPROCESSOR)

| Campaign | computeMethod | maxDeposit | positionCapUsd | hooks |
|----------|--------------|------------|----------------|-------|
| 1368150588519341350 | **maxDeposit** | "1000000000000000000000" | 1000 token | [hookType=10, WorldID] |

---

## 4. computeMethod 全枚举

| computeMethod | 占比 | computeSettings | 用途 |
|---|---|---|---|
| `genericTimeWeighted` | ~95% | 无 | 常规按时间加权计分 |
| `maxDeposit` | <1% | `{maxDeposit: string}` | 限制 per-user 最大存入量 = position cap |
| （缺失/NONE） | ~5% | 无 | 部分 campaign 无此字段 |

---

## 5. 风险与注意事项

1. **maxDeposit 是稀有模式**（3/400），但 Merkl 正在向更多链扩展 verification hook，未来可能增多
2. **hookType 和 maxDeposit 在 API 层面无强制配对关系**——理论上可以有 `maxDeposit` 无 hook，或有 hook 无 `maxDeposit`。
   以 `computeMethod === "maxDeposit"` 作为唯一判断条件，不依赖 hookType
3. **Merkl 没有公开 API 文档**，`computeScoreParameters` 结构可能随版本变更。
   positionCap 是 optional 字段，拿不到就是 undefined，不会崩溃
4. **net position vs combine cap**：Merkl AAVE_NET_LENDING 的 maxDeposit 限制的是 net supply（supply - borrow），
   传 `isCombineCap=false`，但 `positionUsd` 传 net position 而非 supply。如果未来 Merkl 在非 AAVE_NET_LENDING 类型上也加 maxDeposit，
   需要重新评估 positionUsd 的语义
5. **WETH 的 positionCapUsd 是 20.15 WETH × WETH price**——后端需要实时 price 换算，
   不能硬编码 token price
