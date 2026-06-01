# Handoff: Wallet User Position → Reserve 匹配

## 核心问题

前端需要将 SDK 一次性获取的所有 user position 匹配到后端 `/markets` 返回的对应 Reserve。

**关键发现：后端 reserveId 真实格式是 `{chainId}:{poolAddress}:{tokenAddress}`（如 `1:0x8787...:0x1111...`），不是之前错误假设的 `{marketName}-{tokenAddress}`。**

这一发现来自直接 curl staging API (`https://staging-api.aaveapy.com/api/markets`)，而非测试 fixture。

## 当前状态

### 已完成但有缺陷的代码

以下文件基于**错误的 reserveId 格式假设**（`{marketName}-{tokenAddress}`）实现，需要修正：

- `src/lib/reserveKey.ts` — `composeReserveId(marketName, tokenAddress)` 格式错误；`buildReserveMap` 用 `reserve.reserveId.trim()` 做 key 这部分是对的
- `src/lib/userData/onchainPositionConverter.ts` — 第 34、59 行用 `composeReserveId()` 组 key 查 Map，格式与后端不匹配
- `src/lib/userData/sdkPositionConverter.ts` — 用 `reserve.id` 做 Map.get，**这条路径可能是对的**，因为 SDK 的 `reserve.id` 应该就是后端 reserveId
- `src/lib/userData/userPositionMapper.ts` — `resolvePositionMeta(reserveId, reserveMap)` 签名本身没问题，问题在调用方传入的 reserveId 格式

### 已正确实现的部分

- `buildReserveMap` 直接用 `r.reserveId.trim()` 做 key — 正确
- SDK converter 用 `supply.reserve.id` / `borrow.reserve.id` — 需要确认 SDK 的 `.id` 是否就是后端 reserveId
- `ReserveWithSpread.reserveId` 字段从 API 拿到的是真实格式 — 正确
- V3UserPosition 新增 marketName 字段 — 仍需要
- deriveV3AssetsByMarket — 仍需要

### 用户明确说的问题

1. **SDK 优先**：V3/V4 都是优先从 SDK 拿 user position，不是 onchain
2. **一次性获取**：user position 是一次性全量获取，不是一个 market 一个 market 地获取
3. **尚未讨论 onchain**：当前应聚焦 SDK 路径的匹配逻辑
4. **composeReserveId 格式假设错误**：不能从测试 fixture 推断真实格式

## 后端真实数据（来自 staging API）

```
reserveId                                              | marketName              | tokenAddress
1:0x8787...:0x1111...                                 | AaveV3Ethereum         | 0x1111...
1:0x0aa9...:0x853d...                                 | AaveV3EthereumEtherFi  | 0x853d...
1:0x4e03...:0x40d1...                                 | AaveV3EthereumLido     | 0x40d1...
1:0xae05...:0x1741...                                 | AaveV3EthereumHorizon  | 0x1741...
42161:0x794a...:0xba5d...                             | AaveV3Arbitrum         | 0xba5d...
```

格式：`{chainId}:{poolAddress}:{tokenAddress}`

## 需要解决的关键问题

### 1. SDK `reserve.id` 是否等于后端 reserveId？

SDK position 里 `supply.reserve.id` / `borrow.reserve.id` 的值是什么格式？如果是后端 reserveId，那 SDK converter 路径直接 Map.get 就行。

### 2. 如何从 SDK user position 唯一匹配到 Reserve？

SDK 一次性返回所有 market 的 positions。匹配 key 需要能区分同链不同 market 的同名资产（如 Ethereum 上 4 个 V3 market 都有 USDC）。

可能的匹配方式：
- 如果 SDK position 自带 `reserve.id`（= 后端 reserveId）→ 直接 Map.get，最简单
- 如果没有，需要从 `(marketName, tokenAddress)` 或 `(chainId, poolAddress, tokenAddress)` 查找

### 3. composeReserveId 该怎么改？

**不要猜测格式**。两种选择：
- 删掉它，改为从 ReserveWithSpread 中查找（如建 `Map<marketName:tokenAddress, ReserveWithSpread>`）
- 保留但改用真实格式组合（需 chainId + poolAddress + tokenAddress），但前提是链上/onchain 数据有 poolAddress

## 教训

**绝不能用测试 fixture 的硬编码值推断真实 API 格式**。测试里的 `AaveV3Celo-0x1234` 只是占位值，不代表真实格式。以后确认格式必须：
1. 直接调真实/staging API 验证
2. 或从后端代码/schema 文档确认
3. 或从 `apiSchemas.ts` 的 Zod schema 解析确认（看是否有 transform/normalize 逻辑）

## 相关文件

### 类型/Schema
- `src/types/aave.ts:117` — `reserveId: string` 带注释 "Canonical backend reserve key"
- `src/types/aave.ts:106-130` — ReserveWithSpread 完整定义

### SDK Converter（核心关注）
- `src/lib/userData/sdkPositionConverter.ts`
- `src/hooks/useUserPositionsSdk.ts`

### Onchain Converter（暂不关注）
- `src/lib/userData/onchainPositionConverter.ts`
- `src/hooks/useUserPositions.ts`

### 已修改的文件列表
- `src/lib/reserveKey.ts`
- `src/lib/userData/userPositionMapper.ts`
- `src/lib/userData/onchainPositionConverter.ts`
- `src/lib/userData/sdkPositionConverter.ts`
- `src/lib/userData/aaveV3UserClient.ts`
- `src/lib/deriveOnchainConfig.ts`
- `src/hooks/useUserPositions.ts`
- `src/hooks/useUserPositionsSdk.ts`
- `src/pages/Index.tsx`
- 对应的测试文件

### 文档
- `docs/handoff-wallet-merkl-portfolio.md` — 原始设计文档

## 建议的 Session 流程

1. **先确认 SDK `reserve.id` 的真实值** — 看代码或跑真实数据
2. **基于确认结果决定匹配策略** — 不要猜测
3. **修复 composeReserveId / 查找逻辑** — 用真实格式
4. **更新测试** — fixture 使用真实格式
5. **验证** — lint + test + build + tsc

## Suggested Skills

- `grill-with-docs` — 继续设计决策的 grill
- `verification-before-completion` — 改完后验证
- `tdd` — 补测试
