# 开发方案 - AAV-68 Merkl 跨 Reserve Net Lending/Borrow 收益扣减

## 1. Issue 概述

Merkl 对 Aave 的许多 opportunity 使用 net position 机制，奖励仅对净头寸发放。
例如：supply USDT0 但同时 borrow USDT0/USDe/GHO 时，Merkl engine 只对 `supply - borrow` 的净值计发奖励。
当前前端仅实现了**同 reserve 内**的 net position 抵消（`meritMerklNetPosition` 开关），未处理**跨 reserve** 的情况。
本 Issue 要在读取用户 portfolio 时，识别哪些 Merkl campaign 是 net lending/borrowing 类型、其抵消规则是什么，
并据此扣减（或折算）显示给用户的激励 APR。

## 2. Merkl API 实地调研结果（2026-05-20，520 个 opportunities 全量拉取）

### 2.1 三个数据源对比

Merkl `/v4/opportunities` 返回的数据中，net lending/borrowing 信息分布在**三个位置**：

| 数据源 | 结构化程度 | 覆盖率 | 示例 |
|--------|-----------|--------|------|
| `type` 字段 | ✅ 完全结构化 | 14/520 = 2.7%（仅 Aave/Dolomite/Neverland/Vena） | `AAVE_NET_LENDING`, `AAVE_NET_BORROWING`, `DOLOMITE_NET_LENDING` |
| `tokens[]` 字段 | ⚠️ 半结构化 | 仅 Mantle 链 Aave 包含 debt token（1/14） | Mantle GHO 的 `variableDebtManUSDe`, `variableDebtManGHO` 等 |
| `description` 字段 | ❌ 自然语言 | 14/14 NET type 都有，另 1 个 MULTILOG_DUTCH 也有 | `"USDT0 supply minus USDT0, USDe, GHO borrows"` |

**结论：`type` 字段是可靠的标识，但抵消 token 列表只能从 `description` 解析（`tokens` 不稳定）。**

### 2.2 Aave 16 个 opportunities 全量分类（非 Aave 协议不在本 Issue 范围）

#### 类别 A：`type` 显式标注 NET（7 个）——**本 Issue 核心**

| # | Chain | Name | type | 抵消规则（description） |
|---|-------|------|------|------------------------|
| 1 | MegaETH | Lend USDm on Aave | AAVE_NET_LENDING | USDm supply - USDm borrows（同 token） |
| 2 | Ethereum | Lend RLUSD on Aave Horizon | AAVE_NET_LENDING | RLUSD supply - RLUSD borrows（同 token） |
| 3 | Plasma | Lend USDT0 on Aave | AAVE_NET_LENDING | **USDT0 supply - USDT0, USDe, GHO borrows（跨 token）** |
| 4 | Plasma | Lend GHO on Aave | AAVE_NET_LENDING | **GHO supply - GHO, USDT0, USDe borrows（跨 token）** |
| 5 | Mantle | Lend GHO on Aave | AAVE_NET_LENDING | **GHO supply - GHO, USDT0, USDC, USDe borrows（跨 token）** |
| 6 | Plasma | Borrow GHO on Aave | AAVE_NET_BORROWING | **GHO borrow - GHO, USDT0, USDe supplies（跨 token）** |
| 7 | Mantle | Borrow GHO on Aave | AAVE_NET_BORROWING | **GHO borrow - GHO, USDe, USDT0, USDC supplies（跨 token）** |

#### 类别 B：`type` 不含 NET 但 description 隐含 net 约束（2 个）——**需纳入本 Issue**

| # | Chain | Name | type | 约束分析 |
|---|-------|------|------|---------|
| 1 | Ethereum | Lend USDtb on Aave | AAVE_SUPPLY | **实质是 net lending**：desc 写 "Borrowers of USDtb on any Ethereum-based market or protocol are not eligible"。行为等同于 USDtb supply minus USDtb borrows。抵消范围甚至更广（跨协议），但至少包含同 Aave market 的 borrow。应按 AAVE_NET_LENDING 同等处理。 |
| 2 | Ethereum | Borrow USDC from Aave Horizon market | MULTILOG_DUTCH | **实质是 net borrowing**：desc 写 "borrowing & lending the same asset will earn rewards based only on the difference"。抵消规则：USDC borrow minus USDC supply（同 token）。 |

#### 类别 C：Ethena Looping（4 个）——**排除，不在本 Issue 范围**

| # | Name | type | 约束 |
|---|------|------|------|
| 1 | Lend USDe on Aave (looping required) | AAVE_SUPPLY | 必须 borrow USDT0/USDm + health factor < 2.5 |
| 2 | Lend sUSDe and USDe on Aave (looping required) Plasma | MULTILOG_DUTCH | 必须 borrow USDC/USDT + HF<2.5 + multi-token min |
| 3 | Lend sUSDe and USDe on Aave (looping required) Ethereum | MULTILOG_DUTCH | 必须 borrow USDC/USDT/USDS + HF<2.5 + multi-token min |
| 4 | Lend sUSDe and USDe on Aave (looping required) Mantle | MULTILOG_DUTCH | 必须 borrow USDC/USDT + HF<2.5 + multi-token min |

#### 类别 D：其他非 net 约束（3 个）——**不在本 Issue 范围**

| # | Name | type | 约束 |
|---|------|------|------|
| 1 | Borrow USDT0 from Aave on Plasma | MULTILOG_DUTCH | 纯 borrow 奖励，无 net 约束（其 borrow 金额会被 #3 USDT0 net lending 的抵消列表影响，但自身无约束） |
| 2 | Lend sUSDe, USDe on Aave (Mantle) | MULTILOG_DUTCH | Multi-token min：取 sUSDe/USDe supply 较小值 |
| 3 | Hold Wrapped Aave Plasma USDT0 | ERC20_MAPPING | Hold 类激励，无 net position 概念 |

**Aave 汇总**：16 个 opportunities 中，7 个类别 A + 2 个类别 B = **9 个需要 net 抵消处理**，4 个 looping 排除，3 个其他约束不在本 Issue 范围。

### 2.3 `tokens` 字段分析——能否直接获取结构化抵消列表？

| Opportunity | tokens 数量 | 含 debt token？ | debt token 抵消列表 vs description | 结论 |
|-------------|-----------|----------------|-----------------------------------|------|
| Mantle Lend GHO | 6 | ✅ 4个 debt token | `variableDebtManUSDe/GHO/USDT0/USDC` → 完美匹配 description "GHO,USDT0,USDC,USDe" | **唯一完全匹配** |
| Plasma Lend USDT0 | 2 | ❌ | 仅有 aToken+underlying | 不匹配 |
| Plasma Lend GHO | 2 | ❌ | 仅有 underlying+aToken | 不匹配 |
| Plasma Borrow GHO | 2 | ❌ (仅有自己 debt) | `variableDebtPlaGHO` 只对应 GHO，缺 USDT0/USDe | 不匹配 |
| 其他 10 个 | 1-2 | ❌ | 无 debt token | 不匹配 |

**结论：`tokens` 字段不可靠——仅 Mantle 链恰好包含了 debt token 列表，其他链都没有。抵消 token 列表只能从 `description` 解析。**

### 2.4 抵消 Token 列表提取策略

**三组数据源的可靠性对比**（16 个 Aave opportunities 全量验证，含 1 个 Mantle Lend USDC 非 net opportunity）：

| 数据源 | AAVE_NET_* (7个) | 隐含 net (2个) | 非 net (7个) |
|--------|-----------------|---------------|-------------|
| `type` 字段 | ✅ 直接标识 | ❌ 未标注 | ❌ 未标注 |
| `campaigns[].params.tokens` | ✅ 全部有，与 desc 完全一致 | ❌ 全部无 | ❌ 全部无 |
| `opportunity.tokens` | ⚠️ 仅 Mantle 链完整，其余缺 debt token | ❌ 无 | ❌ 无 |
| `description` 正则 | ✅ 格式统一 | ⚠️ 可解析但措辞可能变 | ✅ 不匹配 |

**分层检测策略**（详见 4.1.2）：

1. **Layer 1 type 判断**：type 含 `NET_LENDING`/`NET_BORROWING` → 从 `campaigns[].params.tokens` 提取结构化抵消列表（所有参数齐全，最可靠）
2. **Layer 2 规则缓存**：opportunity ID → NetRule 的持久化缓存，命中直接返回
3. **Layer 3 LLM 运行时分析**：未缓存的新 opportunity → LLM 分析 → 结果写入缓存 → 以后不再调 LLM

## 3. 当前代码库现状

| 维度 | 状态 |
|------|------|
| 同 reserve net position 抵消 | ✅ `useRateSimulation.ts:1125-1138`，`meritMerklNetPosition` 开关 |
| Merkl opportunity type 透传 | ❌ 后端不传 `opportunity.type`，前端 `MerklOpportunityGroup` 无此字段 |
| 跨 reserve 抵消 token 列表 | ❌ 后端不传抵消规则 |
| APR 折算链路 | ✅ 已有 `eligibilityRatio` + `incentiveCeilings.ts` ceiling 效应体系 |
| Cap warning UI | ✅ 可复用 `ds-bg-warning-row` + `AlertTriangle` + Tooltip |
| `campaignType` 字段 | ✅ 已有 `MerklCampaignBreakdown.campaignType`（如 `DUTCH_AUCTION`），但这是**分布类型**而非**opportunity 类型**，两者正交 |

## 4. 实现方案

### 4.1 后端（aave-protocol-analysis）

#### 4.1.1 Merkl Opportunity Type 透传

- **修改文件**：
  - `src/merkl-api.ts`：从 Merkl `/v4/opportunities` 读取每个 opportunity 的 `type` 和 `description` 字段
  - `src/index.ts`：将 `type` + `description` 关联到对应 reserve 的 Merkl incentive group 数据中
  - `src/services/marketsApiSerialize.ts`：MerklOpportunityGroup 序列化时增加 `opportunityType` 字段
- **逻辑**：
  - 提取 `type`（如 `AAVE_NET_LENDING`、`AAVE_NET_BORROWING`、`DOLOMITE_NET_LENDING`、`AAVE_SUPPLY`、`MULTILOG_DUTCH`）
  - 透传给前端

#### 4.1.2 抵消 Token 列表解析（分层检测 + 结构化提取）

- **修改文件**：
  - 新增 `src/services/merklNetPositionParser.ts`
- **逻辑**：Layer 1 结构化提取 → Layer 2 规则缓存命中 → Layer 3 LLM 运行时分析（首次缓存，后续直接用缓存）

```ts
async function detectNetPositionConstraint(opp: MerklRawOpportunity): NetPositionConstraint | null {
  const { type, id } = opp;

  // Layer 1: type 含 NET → 结构化提取（所有参数都有，最可靠）
  if (type.includes('NET_LENDING'))
    return { sourceSide: 'supply', ...extractOffsetTokens(opp) };
  if (type.includes('NET_BORROWING'))
    return { sourceSide: 'borrow', ...extractOffsetTokens(opp) };

  // Layer 2: 约束缓存命中（opportunity ID → NetPositionConstraint，持久化存储）
  const cached = await constraintCache.get(id);
  if (cached !== undefined) return cached;  // 命中（null 也缓存，表示"非 net"）

  // Layer 3: LLM 运行时分析（未缓存的新 opportunity，只调一次）
  const constraint = await llmAnalyzeOpportunity(opp);
  await constraintCache.set(id, constraint);  // 缓存结果，以后不再调 LLM
  return constraint;
}
```

**Layer 1 的 `extractOffsetTokens`**：优先从 `campaigns[].params.tokens` 提取结构化抵消列表（AAVE_NET_LENDING 的 offset 在 debtToken 侧，AAVE_NET_BORROWING 的 offset 在 aToken 侧），降级到 description 正则解析。实测 campaign.params.tokens 与 description 在所有 7 个 NET type opportunity 上**完全一致**。提取结果（token symbol/address）→ 拼接 `{chainId}:{poolAddress}:{tokenAddress}` → 得到 `offsetReserveIds`。若某 offset token 不在当前 Aave 市场中（无法构造 reserveId），跳过该 token。

**Layer 2 规则缓存**：`netPositionConstraint` 存储在 `incentive_details` JSONB 内部的每个 merkl opportunity 对象中（字段名 `netPositionConstraint`），随 incentive_details 持久化。不新建表、不区分 volatile/invariant。opportunity ID 为缓存 key，null 值也缓存（表示"该 opportunity 非 net，无需处理"）。opportunity 下线后缓存随 incentive_details 自然清理。

**Layer 3 LLM 运行时分析器**：
- 输入：opportunity 的 `type`、`description`、`tokens`、`action`
- LLM 提示词：分析该 opportunity 是否有 net lending/borrowing 约束，如果有则输出 `{ sourceSide, offsetTokens }`，否则输出 `null`
- 输出：`NetPositionConstraint | null`
- **只对每个 opportunity ID 调一次**——结果持久化到规则缓存
- 同一 opportunity 后续请求直接走 Layer 2 缓存

```ts
async function llmAnalyzeOpportunity(opp: MerklRawOpportunity): Promise<NetPositionConstraint | null> {
  const prompt = `Analyze this Merkl opportunity for net lending/borrowing constraints:
type: ${opp.type}
action: ${opp.action}
description: ${opp.description}
tokens: ${opp.tokens.map(t => t.symbol).join(', ')}

Does this opportunity have a net lending or net borrowing constraint?
If yes, return JSON: { "sourceSide": "supply"|"borrow", "offsetTokenSymbols": ["Y1","Y2"] }
If no, return JSON: null`;
  // 后端拿到 offsetTokenSymbols 后，映射为 offsetReserveIds（跳过不在市场中的 token）

  const result = await callLLM(prompt);
  return parseLLMResult(result);
}
```

#### 4.1.3 LLM Client 设计

- **新增文件**：`src/services/merklLlmClient.ts`
- **API 配置**：
  - Base URL：`https://key.bigsong.site/v1`（OpenAI compatible）
  - API key：环境变量 `MERKL_LLM_API_KEY`（**不硬编码**）
  - 模型：`gpt-4o-mini`（默认，便宜快速）
- **Fallback 策略**：按序尝试 12 个模型，单个最多重试 2 次，总超时 60s，全部失败缓存 null

```ts
const LLM_FALLBACK_MODELS = [
  // 稳定（3/3 成功率）
  'claude-haiku-4.5',      // 6s, 便宜
  'claude-sonnet-4.6',     // 6s, 中价
  'grok-4.20-fast',        // 8.5s, 便宜 (需 SSE 解析)
  'gpt-5.4',               // 9.5s, 较贵
  'qwen3.5-397b',          // 11s, 便宜
  // 偶尔成功（成功过一次即入选）
  'deepseek-v4-flash',     // 11s, 不稳定
  'kimi-k2.6',             // 10s, 不稳定 (需 markdown-wrapped JSON 宽松解析)
  'deepseek-v4-pro',       // 7.4s, 首轮成功过
  'gpt-5.2',               // 10s, 首轮成功过
  'qwen3.5-397b-a17b',     // 10s, 首轮成功过
  'openrouter/free',       // 免费, 首轮 3/5
  'nemotron-3-super-120b', // 10s, noisy 输出
];
```

- **特殊解析**：
  - `grok-4.20-fast`：返回 SSE streaming 格式，需逐行解析 `data: {...}` 行提取 content
  - `kimi-k2.6`：返回 markdown-wrapped JSON（\`\`\`json ... \`\`\`），需宽松解析
- **不可用模型**（已测试排除）：deepseek-v4-pro (EMPTY), kimi-k2.5 (EMPTY), grok-4.20/agent/beta/expert/reasoning (rate limit), glm-5/5.1, gemma-4/4-31b/4-31b-it, minimax-m2.5/m2.7, step-3.5-flash, ling-2.6-1t, nano-banana/pro, 所有 image 模型
- **API 稳定性注意**：该 API 会限速/封 key，大量并发测试会触发"无效的令牌"，需控制请求频率

### 4.3 NetRule 存储方案

**决策：netPositionConstraint 存在 `incentive_details` JSONB 内部，不新建表。**

- `incentive_details` 是已有的 JSONB 列，存储每个 reserve 的 incentive 分组数据
  - 每个 merkl opportunity 对象内新增 `netPositionConstraint` 字段：
   ```json
   {
     "merkl": [{
       "opportunityId": "123456",
       "opportunityType": "AAVE_NET_LENDING",
       "netPositionConstraint": {
         "sourceSide": "supply",
         "offsetReserveIds": ["1:0xPool:0xUsdt0", "1:0xPool:0xUsde", "1:0xPool:0xGho"]
       },
       // ... 其他字段
     }]
   }
   ```
  - **offsetReserveIds 存 reserveId 而非 symbol**：前端有 `Map<reserveId, Reserve>` 可直接查找，零额外映射
  - **offset token 不在当前 Aave 市场中则跳过**：无法构造 reserveId → 存了也没法用 → 宁可忽略也不崩溃
- 不区分 volatile/invariant：Layer 1 结构化提取的结果和 Layer 3 LLM 分析的结果统一存同一个字段
- 缓存生命周期：随 `incentive_details` 的 content-hash change detection 自然管理——opportunity 不变就不重写
- 读取：Layer 2 缓存命中时直接从 `incentive_details` 中对应 opportunity 的 `netPositionConstraint` 读取
- 写入：Layer 3 LLM 分析完成后，将结果写入 opportunity 对象的 `netPositionConstraint` 字段，随 incentive_details 一起 persist

### 4.4 实现清单

#### 后端（B）

| ID | 任务 | 文件 | 依赖 |
|----|------|------|------|
| B1 | opportunityType + description 透传 | `merkl-api.ts`, `marketsApiSerialize.ts` | 无 |
| B2 | Layer 1 结构化提取 (extractOffsetTokens) | 新增 `merklNetPositionParser.ts` | B1 |
| B3 | LLM client (fallback 12 模型 + SSE/markdown 解析) | 新增 `merklLlmClient.ts` | 无 |
| B4 | detectNetPositionConstraint 三层检测 + netPositionConstraint 写入 incentive_details | `merklNetPositionParser.ts`, `merkl-api.ts` | B2, B3 |

#### 前端（F）

| ID | 任务 | 文件 | 依赖 |
|----|------|------|------|
| F1 | 类型扩展 + field-canary + zod schema | `aave.ts`, `schemas.ts`, `field-canary.test.ts` | B4 |
| F2 | 跨 reserve 抵消计算逻辑 + 单测 | 新增 `netLendingCrossReserve.ts`, 改 `useRateSimulation.ts` | F1 |
| F3 | ceiling 效应集成 | `incentiveCeilings.ts` | F2 |
| F4 | UI 展示 (SimulationSubRow) | `SimulationSubRow.tsx` | F3 |

#### 文档（D）

| ID | 任务 | 文件 |
|----|------|------|
| D1 | 方案文档定稿 | `aav_68_plan.md` |
| D2 | API 合约变更记录 | `docs/conventions/api-contract-checklist.md` |

### 4.2 前端（aaveapy）

#### 4.2.1 类型扩展

- **修改文件**：
  - `src/types/aave.ts`：`MerklOpportunityGroup` 增加：
    ```ts
    opportunityType?: string;  // 'AAVE_NET_LENDING' | 'AAVE_NET_BORROWING' | 'DOLOMITE_NET_LENDING' | 'AAVE_SUPPLY' | ...
    netPositionConstraint?: {
      sourceSide: 'supply' | 'borrow';  // 被奖励的侧
      offsetReserveIds: string[];        // 抵消侧 reserveId 列表（后端已完成 symbol→reserveId 映射）
    } | null;
    ```
  - `src/shared/market-contract/schemas.ts`：对应 zod schema 增加可选字段
  - `src/types/field-canary.test.ts`：增加 `opportunityType`、`netPositionConstraint`、`sourceSide`、`offsetReserveIds` 字段名

#### 4.2.2 跨 Reserve Net Lending/Borrowing 抵消计算

- **修改文件**：
  - `src/hooks/useRateSimulation.ts`：在现有 `meritMerklNetPosition` 逻辑基础上，增加跨 reserve 抵消路径
  - 新增 `src/lib/netLendingCrossReserve.ts`：跨 reserve 抵消计算逻辑 + 单测
- **逻辑**：
  - 对每个 Merkl incentive group，检查 `netPositionConstraint`：
    - `sourceSide === 'supply'`：`netEligible = max(supplyUsd - Σ(borrowUsd for reserveId in offsetReserveIds), 0)`
    - `sourceSide === 'borrow'`：`netEligible = max(borrowUsd - Σ(supplyUsd for reserveId in offsetReserveIds), 0)`
    - 无 constraint：不抵消（走原有逻辑）
  - 如果 `netPositionConstraint` 存在，按规则中的 `offsetReserveIds` 从 `Map<reserveId, Reserve>` 查找用户对应头寸（O(1) 查找，零映射成本）
  - 如果 `offsetReserveIds` 中某 reserveId 不在当前市场 Map 中，跳过该 reserve（不计入抵消）
  - 如果 `netPositionConstraint` 为 null（解析失败），fallback 到同 reserve 抵消
  - `eligibilityRatio = netEligible / grossEligible`（复用现有折算链路）
  - 生成 ceiling 效应：`buildNetLendingCrossReserveEffect()`（复用 `incentiveCeilings.ts`）

#### 4.2.3 UI 展示

- **修改文件**：
  - `src/components/dashboard/SimulationSubRow.tsx`：展示跨 reserve net lending/borrowing 抵消提示
- **逻辑**：
  - 复用现有 `AlertTriangle` + Tooltip 模式
  - Net Lending 提示：`"Net eligible $40 of $100 (USDT0 supply minus USDT0+USDe+GHO borrows)"`
  - Net Borrowing 提示：`"Net eligible $60 of $100 (GHO borrow minus GHO+USDT0+USDe supplies)"`
  - 与现有 `buildNetEligibilityNote` 格式对齐

## 5. 实施顺序

```
B1 (opportunityType + description 透传)
  → B2 (Layer 1 结构化提取)
  → B3 (LLM client) ────┐
  → B4 (三层检测 + netRule 写入) ← B2, B3
    → F1 (类型扩展 + field-canary)
      → F2 (跨 reserve 抵消计算 + 单测)
        → F3 (ceiling 效应集成)
          → F4 (UI 展示)
```

**先改后端**——前端无法凭空获取 `AAVE_NET_LENDING` 标识和抵消规则。B1/B3 可并行，B4 依赖 B2+B3 完成后串联。

## 6. 依赖关系

- 依赖后端 Merkl API 集成（当前已有 `merkl-api.ts` 基础）
- **不依赖 AAV-69**（AAV-69 是 Merkl Dashboard 数据读取，与本 Issue 的 opportunity type 透传正交）
- 依赖用户 portfolio 读取（当前已有 `usePortfolioSimulation` 基础）

## 7. 验收标准

- 后端 `GET /api/markets` 返回的 MerklOpportunityGroup 包含 `opportunityType` 字段
- 对含 `NET` 的 type 或 description 隐含 net 约束的，后端返回 `netPositionConstraint`（含 sourceSide + offsetReserveIds）
- 前端对 `AAVE_NET_LENDING` / borrower exclusion 类型按跨 reserve 规则折算 APR
- 前端对 `AAVE_NET_BORROWING` / MULTILOG_DUTCH net borrowing 类型按跨 reserve 规则折算 APR
- 用户 supply USDT0 + borrow USDe 时，USDT0 的 Merkl APR 按净值折算而非全额
- 用户 borrow GHO + supply USDT0 时，GHO borrow 的 Merkl APR 按净值折算
- 用户 supply USDtb + borrow USDtb 时，USDtb 的 Merkl APR 按净值折算（borrower exclusion）
- 用户 borrow USDC + supply USDC on Horizon 时，USDC borrow 的 Merkl APR 按净值折算
- SimulationSubRow 展示跨 reserve net lending/borrowing 抵消提示
- 单测覆盖：description 解析（4 种格式）、跨 reserve 净额计算、eligibilityRatio 折算
- 降级：解析失败时 fallback 到同 reserve 抵消，不 crash

## 8. 复杂度评估

**Medium**

- 后端：中等改动（透传 2 字段 + 三层检测 + LLM client 12 模型 fallback + netRule 写入 incentive_details），LLM client 是新增复杂度但逻辑清晰
- 前端：中等改动（类型扩展 + 跨 reserve 抵消计算 + UI），可复用现有 `eligibilityRatio` + ceiling 体系
- 最大风险：
  1. Merkl `description` 文本格式可能变化 → Layer 1 结构化提取 + LLM fallback 双保险
  2. LLM API 不稳定 → 12 模型 fallback + null 缓存降级
  3. `campaigns[].params.tokens` 格式未来可能变 → 有 description 正则降级

## 9. 遗留项（不在本 Issue 范围，但需记录）

| 约束类型 | 示例 | 原因 |
|---------|------|------|
| Ethena looping | Lend USDe (must borrow USDT0/USDm + HF<2.5) | 需要链上 health factor 读取，复杂度高 |
| Multi-token min | Lend sUSDe+USDe on Mantle (min of two positions) | 需要跨 reserve 取 min，与 net position 逻辑不同 |
| Borrow USDT0 from Aave on Plasma | 纯 borrow 奖励，无 net 约束 | 自身无约束，其 borrow 金额会被 USDT0 net lending 抵消列表影响 |

## 10. 术语决策记录（经 grill-with-docs 审问确认）

| # | 决策 | 理由 |
|---|------|------|
| Q1 | **Net Position Constraint**（非 Net Rule / Net Lending Rule） | Merkl opportunity 自身的 eligibility 约束：只有 net position 部分才 eligible |
| Q2 | **`netPositionConstraint`** 字段名（非 `netLendingRule`） | 一个字段同时覆盖 lending 和 borrowing |
| Q3 | **`sourceSide: 'supply' \| 'borrow'`**（删除 `direction`） | 直接声明哪侧被奖励，前端零映射 |
| Q4 | **删除 `sourceToken`** | 可从 opportunity 所在 reserve 推导，冗余 |
| Q5 | **保留 `opportunityType` 透传** | 成本极低，调试价值高，未来 Ethena looping 需要按 type 分支 |
| Q6 | **`offsetReserveIds: string[]`**（非 `offsetTokens: string[]`） | 存 reserveId 而非 symbol，前端 `Map<reserveId, Reserve>` 直接查找，零额外映射 |
| Q7 | **offset token 不在 Aave 市场中 → 跳过** | 无法构造 reserveId → 存了也没法用 → 宁可忽略也不崩溃 |

## 11. 前端实现进度

| 任务 | 状态 | 说明 |
|------|------|------|
| F1 类型扩展 + field-canary + zod schema | ✅ 完成 | CampaignGroup 类型、NetPositionConstraint 接口、field-canary 13/13 |
| F2 跨 reserve 抵消计算逻辑 + 单测 | ✅ 完成 | netLendingCrossReserve.ts、campaignGroups.ts、5 测试通过 |
| F3 ceiling 效应集成 | ✅ 完成 | incentiveCeilings.ts 新增 buildCrossReserveNetEligibilityNote、useRateSimulation.ts 闭包+守卫、3 测试通过 |
| F4 UI 展示 (SimulationSubRow) | ✅ 完成 | capNote 已被 SimulationSubRow 自动渲染，无需额外改动 |
| D1 方案文档定稿 | ✅ 完成 | 本文档 |

## 12. Bug 修复记录

### Bug 1：`pruneMerklGroup()` 遗漏 `netPositionConstraint`

- **根因**：`packages/aave-fetcher/src/incentive-prune.ts` L40-48 显式构造新对象时未包含 `netPositionConstraint`
- **修复**：添加 `...(g.netPositionConstraint !== undefined ? { netPositionConstraint: g.netPositionConstraint } : {})` — 用 `!== undefined` 而非 truthy，因为 `null` 表示"检测过但无约束"
- **验证**：API 返回 13/25 个 merkl group 含 `netPositionConstraint`

### Bug 2：`extractOffsetTokenAddresses` 使用 `.address` 而非 `.underlyingToken`

- **根因**：`merkl-api.ts` 中提取 offset token 地址时使用了 aToken/vToken 地址
- **修复**：改为提取 `.underlyingToken`（底层 token 地址）
- **验证**：491/491 全匹配 reserveLookup

### Bug 3：`extractNetPositionConstraint()` 跳过自身 token 导致同 token 抵消丢失

- **根因**：`merkl-api.ts` L1219 `if (addrLower === sourceAddrLower) continue;` 无条件跳过自身 token
- **语义**：`AAVE_NET_LENDING` 意味着 "supply X minus borrow X"，自身永远是 offset。跳过自身只适用于跨 token offset 场景
- **受影响**：4 个 `AAVE_NET_LENDING` opportunity 全部丢失 constraint：
  - MegaETH USDm, Ethereum RLUSD, Ink WETH, Ink kBTC
- **修复**：仅对非 `AAVE_NET_*` 类型跳过自身（`if (!isNetType && addrLower === sourceAddrLower) continue;`）
- **测试**：3 个新增测试 + 1 个更新测试，84/84 全绿
- **commit**：`6c51361 fix(merkl): include self token as offset for AAVE_NET_* types (Bug3)`

## 13. 验证结果（2026-05-23）

| 验证项 | 结果 |
|--------|------|
| 后端 API netPositionConstraint | 13/25 merkl group 含字段 ✓ |
| 前端单元测试 | 1686 passed ✓ |
| 前端 tsc + lint + build | 全通过 ✓ |
| Playwright e2e | 6/6 passed ✓ |
| 后端 tsc | 通过 ✓ |
