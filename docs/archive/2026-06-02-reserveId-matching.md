# Handoff: Wallet User Position → Reserve 精确匹配（方案A实现完成）

## 核心问题

前端需要将 SDK 一次性获取的所有 user position 精确匹配到后端 `/markets` 返回的对应 Reserve（通过 `reserveId`），以获取 price、symbol 等 meta 信息。

## 解决方案（方案A — 已实现）

从 SDK 数据构造 reserveId 字符串，然后 `Map.get(reserveId)` 精确查找，fallback 到 `(chainId, tokenAddress)` 查找。

### 后端 reserveId 真实格式（从 staging API 验证）

- **V3**: `{chainId}:{poolAddress}:{tokenAddress}`
- **V4**: `{chainId}:{poolAddress}:{tokenAddress}:{hubName}`（hubName 取值为 `Core` / `Plus` / `Prime`）
- 所有地址组件统一 lowercase
- V3 Ethereum mainnet 有 4 个不同 poolAddress 都有 USDC，证明 `(chainId, tokenAddress)` 二元组匹配不够精确

### SDK 数据结构关键字段

- **V4** (`@aave/react`): `position.reserve.spoke.address` → poolAddress；`position.reserve.spoke.chain.chainId` → chainId；`position.reserve.underlyingAsset.address` → tokenAddress；`position.reserve.spoke.connectedHubs[].hub.name` → hubName
- **V3** (`@aave/react-v3`): `position.market.address` → poolAddress；`position.market.chain.chainId` → chainId；`position.currency.address` → tokenAddress；V3 无 HubName 概念
- **重要**: SDK `reserve.id` 是 Base64 编码的 ReserveId，**不等于**后端 reserveId，不能直接用于 Map.get

## 已完成的修改

### 1. `src/lib/reserveKey.ts` — 新增 `composeReserveId()`

```ts
composeReserveId(chainId, poolAddress, tokenAddress, hubName?) → string | undefined
```
- V3 格式: `{chainId}:{poolAddress.toLowerCase()}:{tokenAddress.toLowerCase()}`
- V4 格式: 额外拼接 `:{hubName}`
- 任一必需参数缺失返回 undefined

### 2. `src/lib/userData/userPositionMapper.ts` — 新增 `resolvePositionMetaByReserveId()`

```ts
resolvePositionMetaByReserveId(composedId?, chainId, tokenAddress, reserveMap, chainTokenLookupMap) → PositionMeta
```
- 优先用 composedId 精确查找 reserveMap
- 找不到则 fallback 到 `(chainId, tokenAddress)` 查 chainTokenLookupMap
- 都找不到返回 orphan meta（reserveId=undefined, tokenPrice=0）

### 3. `src/lib/userData/sdkPositionConverter.ts` — 接口 + 转换逻辑改用 reserveId 精确查找

- `SdkSupplyPosition.reserve` 加 `poolAddress?: `0x${string}`` 和 `hubName?: string`
- `SdkBorrowPosition.reserve` 同上
- 转换函数签名改为 `(positions, reserveMap, chainTokenLookupMap, source)` 双 map
- 转换逻辑: 先 `composeReserveId(chainId, poolAddress, asset, hubName)` → 再 `resolvePositionMetaByReserveId()`
- re-export `buildReserveMap`

### 4. `src/hooks/useUserPositionsSdk.ts` — 数据提取层 + 双 map 构建

- 新增 `enrichV3SupplyPositions` / `enrichV3BorrowPositions`：从 `market.address` 提取 poolAddress
- 新增 `enrichV4SupplyPositions` / `enrichV4BorrowPositions`：从 `reserve.spoke.address` 提取 poolAddress，从 `reserve.spoke.connectedHubs[0].hub.name` 提取 hubName
- 构建 `sdkReserveMap` (by reserveId) + `sdkLookupMap` (by chainId:tokenAddress) 双 map
- V3/V4 数据传入 converter 前先经 enrich 函数

### 5. 测试

- `src/lib/reserveKey.test.ts` — 22 tests（含 composeReserveId 的 V3/V4 格式、lowercase、undefined、hubName 段数）
- `src/lib/userData/userPositionMapper.test.ts` — 23 tests（含 resolvePositionMetaByReserveId 的精确匹配、同币种不同 pool 区分、V4 hubName、fallback、orphan）
- `src/lib/userData/sdkPositionConverter.test.ts` — 6 tests（适配双 map 签名、poolAddress/hubName fixture、V4 hubName 匹配、fallback、orphan）

## 验证 Gate

✅ lint (0 errors) ✅ test (2212 passed) ✅ build ✅ tsc --noEmit

## 已知限制

1. **onchain converter 路径未修改**：`onchainPositionConverter.ts` 仍用 chainTokenKey 查找，fallback 命中时有 `console.warn` 歧义提醒。

## 已修复（code review 后）

- **V4 多 hubName**：✅ 现遍历 `hubNames[]` 尝试每个 hubName 在 reserveMap 中匹配
- **enrich 中 reserve.id 一致性**：✅ V3 用 `composeReserveId` 构造，V4 标注为 opaque
- **chainToken fallback 歧义检测**：✅ `_ambiguousFallback` 标记 + `console.warn`

## 教训

1. **绝不能用测试 fixture 的硬编码值推断真实 API 格式** — 必须直接调 staging API 验证
2. **SDK `reserve.id` 不等于后端 reserveId** — 它是 Base64 编码的复合 ID，不能直接用于 Map.get
3. **V3 多 pool 同币种** — Ethereum mainnet 有 4 个不同 poolAddress 都有 USDC，`(chainId, tokenAddress)` 二元组不够精确

## 相关文件

- `src/lib/reserveKey.ts` / `.test.ts`
- `src/lib/userData/userPositionMapper.ts` / `.test.ts`
- `src/lib/userData/sdkPositionConverter.ts` / `.test.ts`
- `src/hooks/useUserPositionsSdk.ts`
- `src/lib/userData/onchainPositionConverter.ts` (未修改，参考)
- `src/types/aave.ts` (ReserveWithSpread 类型定义)
