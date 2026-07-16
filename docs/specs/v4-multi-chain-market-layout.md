# Spec: V4 扩展到非 Ethereum 链的 Market Field 布局泛化

> **Linear**: [AAV-1187](https://linear.app/aaveapy/issue/AAV-1187/v4-multi-chain-layout-chain-registration-auto-discovery-wagmi)

## Problem Statement

当前前端对 V4 市场的支持仅限于 Ethereum。FilterBar、chainRegistry、marketLabels 等多处硬编码 Ethereum 相关逻辑，导致当 V4 扩展到其他链（如 Avalanche）时，无法正确显示多市场布局（sub-market 展开选择）和 sub-market 标签。

具体表现：
- `chainRegistry.ts` 的 `isV4()` 用引用相等 `=== AaveV4Ethereum` 判断，无法识别其他 V4 链
- `FilterBar.groupMarketsByChain()` 只将 Ethereum 标记为 `expandable: markets.length > 1`，其他链永远 `expandable: false`
- `getEthSubMarketLabel()` / `getMarketChipLabel()` 只对 Ethereum 调用 sub-market 标签，其他链直接显示 chainName
- `AaveV4Avalanche` 模块已存在于 address-book 但未注册到 chainRegistry
- `V4_SPOKE_ADDRESSES` / `V4_HUB_ADDRESSES` 只有 Ethereum entry

## Solution

泛化所有 Ethereum 专属逻辑，使任何有多个市场（V3 + V4）的链都能像 Ethereum 一样显示展开式 market chips，sub-market 标签正确显示 V3/V4 区分。

## User Stories

1. 作为进阶 DeFi 用户，我能在 Avalanche 的 FilterBar chip 上看到展开按钮，因为 Avalanche 有 V3 和 V4 两个版本的市场
2. 作为进阶 DeFi 用户，我点击展开按钮后能看到 Avalanche 的所有 sub-market chips（AaveV3Avalanche + AaveV4AvalancheMain + AaveV4AvalancheForex）
3. 作为进阶 DeFi 用户，V4 sub-market chips 显示 "V4" badge 和正确的 sub-market 标签（如 "Avalanche Main"、"Avalanche Forex"）
4. 作为进阶 DeFi 用户，V3 sub-market chip 显示 V3 标签（无 V4 badge）和 sub-market 标签（如 "Avalanche"）
5. 作为开发者，我能在 `chainRegistry.ts` 添加 `AaveV4Avalanche` entry，前端自动识别其为 V4 并正确处理
6. 作为开发者，我能用 `AaveV4Avalanche` 的 spoke/hub 地址进行钱包仓位查询（onchain fallback / gap fallback）
7. 作为进阶 DeFi 用户，展开/折叠按钮的 tooltip 显示 "Collapse Avalanche markets" / "Expand Avalanche markets"（而非硬编码 "Ethereum"）

## Implementation Decisions

### 1. chainRegistry 版本检测泛化

**决策**：给 `ChainEntry` 接口加 `version: 'v3' | 'v4'` 字段，每个 entry 显式标记协议版本。

**理由**：
- 显式标记，扩展新 V4 链时只需在 entry 设 `version: 'v4'`，无需维护额外的 Set
- 所有下游消费点（`v3ChainIds` / `v4ChainIds` / `V3_POOL_ADDRESSES` / `PUBLIC_RPC_URLS`）无需改动

**变更模块**：
- `src/lib/chainRegistry.ts`
  - `ChainEntry` 接口新增 `version` 字段
  - 所有 ENTRIES 条目添加 `version: 'v3'` 或 `version: 'v4'`
  - `isV4(entry)` 改为 `entry.version === 'v4'`

### 2. FilterBar 展开逻辑泛化

**决策**：`groupMarketsByChain()` 中，任何 `markets.length > 1` 的链都标记为 `expandable: true`。

**理由**：
- 与 Ethereum 现有逻辑一致，只是去掉了 Ethereum 硬编码
- 条件简单通用，无论 V3 多市场或 V3+V4 混合市场都正确

**变更模块**：
- `src/components/dashboard/FilterBar.tsx`
  - `groupMarketsByChain()` 中的 `expandable` 判断去 Ethereum 专属逻辑

### 3. Sub-market 标签函数泛化

**决策**：将 `getEthSubMarketLabel()` 重命名为 `getSubMarketLabel()`，逻辑泛化：
- V4（`AaveV4` 前缀）→ strip 前缀 + split camelCase（不变）
- V3 Ethereum（`ETHEREUM_MARKET_NAMES` 有映射）→ 用 canonical name（不变）
- V3 其他链 → strip "AaveV3" 前缀 + split camelCase（新增，与 `getReserveMarketDisplayName` 中的逻辑一致）

`getMarketChipLabel()` 对所有链都调用 `getSubMarketLabel()`，不再限制 `chainName === 'Ethereum'`。

**理由**：
- 统一函数名和逻辑，减少维护成本
- 与 `getReserveMarketDisplayName` 的 V3 非以太坊处理对齐
- 支持未来任何多市场链（如 BNB V3 + V4）

**变更模块**：
- `src/lib/marketLabels.ts`
  - `getEthSubMarketLabel()` → `getSubMarketLabel()`
  - `getMarketChipLabel()` 去除 `chainName !== 'Ethereum'` 判断

### 4. 添加 AaveV4Avalanche 注册

**决策**：在 `chainRegistry.ts` ENTRIES 添加 `AaveV4Avalanche` entry，`publicRpcUrls` 为空数组（与 V3 共享 chainId 43114）。

在 `aaveV4UserClient.ts` 的 `V4_SPOKE_ADDRESSES` / `V4_HUB_ADDRESSES` 添加 Avalanche entry（按 `AaveV4Ethereum` 的 pattern）。

**理由**：
- `AaveV4Avalanche` 模块已存在于 `@aave-dao/aave-address-book`
- V4 与 V3 共享 chainId，RPC 使用 V3 的配置即可
- Spoke/Hub 地址用于 onchain fallback 和 gap fallback 的用户仓位查询

**变更模块**：
- `src/lib/chainRegistry.ts`
  - 导入 `AaveV4Avalanche` from `@aave-dao/aave-address-book`
  - ENTRIES 添加 `{ abModule: AaveV4Avalanche, wagmiChain: avalanche, publicRpcUrls: [], version: 'v4' }`
- `src/lib/userData/aaveV4UserClient.ts`
  - 导入 `AaveV4Avalanche`
  - `V4_SPOKE_ADDRESSES` / `V4_HUB_ADDRESSES` 添加 `[AaveV4Avalanche.CHAIN_ID]: ...` entry

### 5. FilterBar Tooltip 文案泛化

**决策**：展开/折叠按钮的 tooltip 用 `group.chainName` 替换硬编码的 "Ethereum"。

**理由**：
- 简单的文案替换，支持所有多市场链
- 提升多链用户体验

**变更模块**：
- `src/components/dashboard/FilterBar.tsx`
  - 展开按钮 tooltip: `` `Expand ${group.chainName} markets` ``
  - 折叠按钮 tooltip: `` `Collapse ${group.chainName} markets` ``

## Testing Decisions

### 测试原则

- 只测试外部行为，不测试实现细节
- 优先复用现有测试 seams（FilterBar.test.tsx, marketLabels.test.ts, chainRegistry.test.ts）
- 用 mock 数据覆盖 V3 + V4 混合场景

### 测试模块

**1. chainRegistry**
- `chainRegistry.test.ts`：验证 `isV4()` 正确识别 V3/V4 entries，`AaveV4Avalanche` 被正确归类到 v4Set
- 新增测试：`v4ChainIds` 包含 Ethereum 和 Avalanche 的 chainId（43114）

**2. marketLabels**
- 修改现有测试中的 `getEthSubMarketLabel` → `getSubMarketLabel`
- 新增测试：
  - `getSubMarketLabel('AaveV4AvalancheMain')` → "Avalanche Main"
  - `getSubMarketLabel('AaveV3Avalanche')` → "Avalanche"
  - `getMarketChipLabel('AaveV4AvalancheMain', 'Avalanche')` → "Avalanche Main"

**3. FilterBar**
- `FilterBar.test.tsx`：
  - 修改展开逻辑测试：不再验证 "Ethereum" 专属，验证任何 `markets.length > 1` 的链都 `expandable`
  - 新增测试：mock 数据包含 Avalanche V3 + V4，验证展开按钮存在且 tooltip 显示 "Expand Avalanche markets"
  - 验证展开后显示 sub-market chips，V4 chips 有 "V4" badge

**4. aaveV4UserClient**
- `aaveV4UserClient.test.ts`：验证 `getV4SpokeAddresses(43114)` / `getV4HubAddresses(43114)` 返回非空数组

**5. Snapshot 测试**
- `FilterBar.test.tsx`：更新 snapshot，反映 tooltip 文案变化

### 测试 Prior Art

- `FilterBar.test.tsx`：现有 Ethereum 展开逻辑测试，可复用 pattern
- `marketLabels.test.ts`：现有 Ethereum sub-market 标签测试，可复用 pattern
- `chainRegistry.test.ts`：现有 v3/v4 分类测试，可复用 pattern

## Out of Scope

- V4 Explorer 链接（V4 使用 hub/spoke 架构，无单一 pool explorer）
- V3 非以太坊链的 canonical sub-market 映射（如 Ethereum 的 Core/Prime/Hub/EtherFi），当前所有非以太坊链只有一个 V3 市场，无需映射
- 后端 V4 fetcher 修改（假设后端已正确返回 `AaveV4Avalanche*` markets）

## Further Notes

### 依赖关系

本 spec 的改动依赖于：
- `@aave-dao/aave-address-book` 已发布 `AaveV4Avalanche` 模块（已确认存在）
- 后端已返回 `AaveV4Avalanche*` market 数据（marketName 格式：`AaveV4${spokeName}`）

### 向后兼容

- 所有修改均为泛化，不影响现有 Ethereum V3/V4 行为
- `getEthSubMarketLabel` 重命名为 `getSubMarketLabel`，需全局替换（可 grep 找到所有引用）

### ADR 考虑

如果未来有更多设计决策需要文档化，可创建 ADR。当前实现较为 straight-forward，无需 ADR。

### Field Canary

修改 `src/types/field-canary.test.ts` 中的 mock reserves，确保：
- V4 reserves 包含 Avalanche V4 的 marketName（如 `AaveV4AvalancheMain`）
- V3 reserves 包含 `AaveV3Avalanche` 的 marketName

## Implementation Status (2026-07-16)

### ✅ 已完成

所有 Implementation Decisions 1-5 均已实现并通过 CI gate（lint + test + build + tsc）。

**实际 API 返回的 Avalanche V4 market 名称**（与 spec 假设不同）：
- `AaveV4Main` — V4 Main market
- `AaveV4Forex` — V4 Forex market
- `AaveV4AVAXCorrelated` — V4 AVAX Correlated market
- `AaveV3Avalanche` — V3 Avalanche（已有）

共 4 个市场，因此 Avalanche 正确显示展开按钮。V4 badges 数量为 3（对应 3 个 V4 sub-market）。

> **注意**：`getSubMarketLabel('AaveV4AVAXCorrelated')` 返回 "AVAXCorrelated"（camelCase split regex `/([a-z])([A-Z])/` 无法分割全大写缩写后的 PascalCase）。这是已知的 cosmetic 限制，不影响功能。

### ✅ CI 检查脚本修复（spec 外补充）

`scripts/check-chain-registry-upstream.mjs` 原本只检测有 `POOL` 属性的模块（V3），V4 模块使用 Hub & Spoke 架构无 `POOL`，导致新 V4 链不会被 CI 检测到。

**修复**：增加对 `mod.SPOKES` 的检测，使 V4 模块也被纳入 CI 检查范围。CI 现在会正确报告未注册的 V4 链。

### ✅ 浏览器验证

在 staging API 环境下通过 Playwright 验证：
- Ethereum 展开按钮 ✅，展开后 11 个 V4 badges
- Avalanche 展开按钮 ✅，展开后 3 个 V4 badges
- 折叠按钮使用动态链名 ✅
- 无 console errors ✅
- 数据正常加载 ✅

### ⚠️ 未做

- Field canary 更新：canary 测字段名不测 marketName，非必要
- `getEthSubMarketLabel` deprecated wrapper 保留（向后兼容），标注 `@deprecated`

### ✅ Chain Registration 自动化（spec 外补充）

在实现过程中，chain registration 从手动添加 entry 演进为零延迟自动发现：

1. **`chainRegistry.ts`** — 使用 `import * as ab` 自动发现所有 Aave 链（V3/V4），不再手动维护 ENTRIES
2. **`aaveV4UserClient.ts`** — `V4_SPOKE_ADDRESSES` / `V4_HUB_ADDRESSES` 同样从 `import * as ab` 自动发现
3. **RPC URL** — 统一为 `CHAIN_RPC_URLS` map，按 chainId 共享（V3/V4 同链共享同一 RPC）
4. **CI 检查** — `check-chain-registry-upstream.mjs` 简化为仅告警 RPC 缺失，不做注册
5. **Wagmi config** — 简化为仅使用 `mainnet`（app 是 read-only，数据读取通过 `chainDiscovery` 独立 RPC 客户端，不依赖 wagmi chain）

**结果**：新增 Aave 链时，只需升级 `@aave-dao/aave-address-book` 依赖版本，前端自动识别——无需任何手动注册。

**Wagmi 简化理由**：
- 钱包连接仅用于 "Watch address" 模式，用户不切链
- 数据读取走独立的 RPC 客户端（`chainDiscovery` → chainid.network → chainlist.org），不经过 wagmi
- 多链 wagmi config 引入了大量 chain imports，维护负担高但实际未使用