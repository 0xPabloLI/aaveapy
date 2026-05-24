# 联合方案 - 钱包连接 + Merkl 持仓 + Portfolio 导入

> **修订记录**
> - v4 (本版)：根据 AAV-66 后端已实现（合并进 side-data 字段 `/api/meta/side-data.campaignAccess`，见 [aav_66_plan.md](file:///Users/pabloli/Documents/code/aaveapy/docs/plans/linear-issues/aav_66_plan.md)）+ AAV-69 Linear 描述（明确前端直调 `/v4/users/{addr}/rewards`）修订：拆分用户级数据 vs campaign 元数据的获取路径；删除 `/v0/positions` beta；补 claim 流程。
> - v3：根据 owner 回答简化 —— Custom Connector = read-only watch mode；数据获取全部在前端；HF 延后；KV-store 不做。
> - v2：根据真实后端结构修订。
> - v1：初稿。

## 聚合 Issue

| Issue | 角色 | 状态变更 |
|-------|------|---------|
| AAV-66 | 前置：钱包连接（含 watch-only 地址输入）+ Merkl 资格 | 保留为子任务 |
| AAV-69 | 核心：前端直连 Merkl + Aave RPC 读用户数据 | 保留为子任务 |
| AAV-62 | 入口：Portfolio 导入（文件/钱包） | 保留为子任务，扩展支持钱包一键导入 |
| AAV-67 | 合并：读取自己的 Portfolio | **关闭**，被 AAV-69+62 联合覆盖 |
| AAV-80 | 展示层：个人 Position/Liquidity | 保留为子任务 |

## 0. 关键决策（已 owner 确认）

| # | 决策 | 影响 |
|---|------|------|
| 1 | **Custom Connector = "Watch Mode"** —— 用户直接输入地址（read-only），不依赖真实钱包 | 大幅简化签名/链切换/交易风险；Phase 1 不需要 wagmi 的 `signMessage` / `sendTransaction` |
| 2a | **用户级实时数据（AAV-69）= 前端直调 Merkl API** | 后端 `aave-protocol-analysis` 对 AAV-69 零改动；前端调 `/v4/users/{addr}/rewards` + viem `readContract` 调 Aave Pool。理由：rate limit per-user 独立、隐私、claim 直连 |
| 2b | **Campaign 元数据（AAV-66）= 后端 cron 聚合 + 前端消费 side-data** | v3→v4 修订：reserves 只暴露 `whitelistOnly` 布尔值，前端无法自算。后端已实现 `/api/meta/side-data.campaignAccess` 字段（合并进 side-data），详见 [aav_66_plan.md](file:///Users/pabloli/Documents/code/aaveapy/docs/plans/linear-issues/aav_66_plan.md) |
| 3 | Merkl 用户 rewards API 失败 → **报错** | AAV-69 用 `/v4/users/{addr}/rewards`（成熟，非 beta）；不做降级；删除 `/v0/positions` beta 调用计划 |
| 4 | **KV-store 黑名单 v1 不做** | 整体最优判断：增加 Merkl API key 外部依赖，多数 Aave campaign 用静态 `params.whitelist`；留作后续增强 |
| 5 | **支持链 = 网站当前支持的所有链** | wagmi config 的 `chains` 数组与 `/markets` 返回的 `chainId` 集合保持一致 |
| 6 | **HF 要，但延后** | 拆为 Phase 5，不阻塞 MVP |

## 1. 联合目标

用户通过 RainbowKit 连接真实钱包**或**直接输入地址（Watch Mode），一键读取自己在 Merkl 上的可领取奖励 + Aave 持仓，自动导入为 Portfolio positions，并在 Dashboard 展示个人 Position/Liquidity 汇总，同时根据 Merkl campaign 资格自动 opt-in 适用的白名单 campaign。

## 2. 数据流（全前端架构）

```
用户:
  ┌─ 选项 A: RainbowKit Connect Modal → 真实钱包签名连接
  └─ 选项 B: 输入地址框 → Watch Mode Custom Connector → 仅 address
       ↓
useAccount() → { address, chainId, isWatchMode }
       ↓
数据来源:
  ├─ useMerklCampaignAccess()  ← 来自 useSideDataMeta() 的 campaignAccess 字段（后端 cron）
  │     getUserCampaignStatus(address, campaignId) → 'allowed' | 'whitelist-blocked' | 'blacklisted'
  │     → 驱动 ReservesTable 准入标记 + usePortfolioToggle 的 whitelistMerklCampaignIds
  │
  └─ 并行（基于 reserves 已加载的 chainIds 集合，逐链 fan-out）:
       ├─ useUserMerklRewards(address, chainIds[])    ← 前端直调 Merkl
       │     GET https://api.merkl.xyz/v4/users/{address}/rewards?chainId=1,42161,...
       │     → 一次拿所有链的 amount/pending/claimed/proofs/breakdowns
       │
       └─ useAaveUserData(address, chainIds[])        ← viem multicall
             for each chainId: Pool.getUserAccountData + getUserReserveData (multicall)
             → 用本地 (chainId, tokenAddress) → reserveId 反查表回写 canonical reserveId
       ↓
聚合为 UserPosition[] → mapUserPositionsToPortfolioPositions
       ↓
预览 Modal (Merge / Replace / Append) → actions.addPosition() × N
       ↓
Portfolio 模拟 + 展示 Position/Liquidity 汇总
```

## 3. 分阶段实现

### Phase 1: 钱包连接 + Watch Mode + Merkl 资格 (AAV-66)

**新增依赖**：
- `@rainbow-me/rainbowkit@^2`
- `wagmi@^2`
- `viem@^2`
- `@tanstack/react-query@^5`（仓库当前无 React Query；需评估与现有 fetch hook 并存策略 —— 见 §10）

**前端新增**：

- **`src/lib/wagmi/chains.ts`（新增文件）** — 钱包支持链清单，**必须覆盖网站当前支持的所有链**。
  - 复用已存在的真理表 [src/lib/tokenPriceResolver.ts:30](file:///Users/pabloli/Documents/code/aaveapy/src/lib/tokenPriceResolver.ts#L30) 中的 `HARDCODED_PLATFORM_BY_CHAIN_ID`（21 条链）作为唯一对照。
  - **强烈建议**先把该 Record 提到共享文件（如 `src/lib/chains/supportedChainIds.ts`），让 `tokenPriceResolver` 和 wagmi config 共用，避免漂移。
  - 映射到 viem/chains 导出（viem@2.49.2 已覆盖 711 条链）：

  | chainId | 名称 | viem/chains 导出 | 备注 |
  |---|---|---|---|
  | 1 | Ethereum | `mainnet` | |
  | 10 | Optimism | `optimism` | |
  | 56 | BSC | `bsc` | |
  | 100 | Gnosis | `gnosis` | |
  | 137 | Polygon | `polygon` | |
  | 146 | Sonic | `sonic` | |
  | **196** | **X Layer** | `xLayer` | ✅ 必须包含 |
  | 250 | Fantom | `fantom` | |
  | 324 | zkSync Era | `zksync` | |
  | 1088 | Metis | `metis` | |
  | **1868** | **Soneium** | `soneium` | ✅ 必须包含 |
  | 4326 | MegaETH | `megaeth` | ✅ 已验证 viem 2.50.4 原生支持 |
  | 5000 | Mantle | `mantle` | |
  | 8453 | Base | `base` | ⚠️ 注意：viem 同时导出 `basePreconf`（preconfirmation 变体），用 `base` |
  | 9745 | Plasma | `plasma` | ✅ 已验证 viem 2.50.4 原生支持 |
  | 42161 | Arbitrum | `arbitrum` | |
  | 42220 | Celo | `celo` | |
  | 43114 | Avalanche | `avalanche` | |
  | **57073** | **Ink** | `ink` | ✅ 必须包含 |
  | 59144 | Linea | `linea` | |
  | 534352 | Scroll | `scroll` | |

  - **Spike 任务（Phase 1 启动前）**：实际安装 viem 后 `node -e "import('viem/chains').then(c => [196,1868,57073,4326,9745].forEach(id => console.log(id, Object.values(c).find(x => x?.id === id)?.name)))"` 确认 viem 真实导出情况；缺失的链用 `defineChain` 补齐。
  - 启动时用 reserves 实际返回的 chainId 集合校验：出现未声明 chainId → console.warn，避免静默漏链。
- `src/lib/wagmi/config.ts` — wagmi config（HTTP transports，可选 fallback RPC）
- `src/lib/wagmi/watchModeConnector.ts` — **核心 Custom Connector**：
  ```ts
  // 用 wagmi v2 的 createConnector API
  // - 不持有 provider，所有签名方法抛 "Watch mode is read-only"
  // - 暴露 `setWatchAddress(addr)` 让 UI 注入用户输入的地址
  // - 持久化到 localStorage (key: 'wagmi.watchAddress')
  // - icon + name 在 RainbowKit modal 里显示为 "View any address"
  ```
- `src/providers/Web3Provider.tsx` — `WagmiProvider` + `QueryClientProvider` + `RainbowKitProvider`，嵌入 [App.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/App.tsx) 根
- `src/hooks/useWallet.ts` — 薄封装：`{ address, chainId, isConnected, isWatchMode, connect, disconnect }`
- `src/components/dashboard/Header.tsx` 集成：
  - RainbowKit `<ConnectButton />` 用于真实钱包
  - 自定义 "Watch any address" 入口，弹窗输入地址 + 校验（viem `isAddress` + ENS 解析） → 调 `watchModeConnector.setWatchAddress()`
- **Campaign 资格判定 = 消费后端 side-data**（v3 → v4 修订）：
  - **不再**前端遍历 reserves 自行计算 —— 实测 reserves 只暴露 `whitelistOnly` 布尔值，不含原始地址数组，前端自算不可行
  - 后端已实现 side-data 字段 `GET /api/meta/side-data` → `payload.campaignAccess`，返回完整 `Record<campaignId, { chainId, whitelist[], blacklist[] }>`，~30KB gzip
  - 详细实现见 **[aav_66_plan.md](file:///Users/pabloli/Documents/code/aaveapy/docs/plans/linear-issues/aav_66_plan.md)** 子方案，涉及 6 个文件：
    - `src/types/aave.ts` — `MerklCampaignAccessPayload` 类型
    - `src/hooks/useSideDataMeta.ts` — 扩展响应类型 + 缓存写入
    - `src/lib/cache.ts` — `setCachedCampaignAccess` / `getCachedCampaignAccess`
    - `src/lib/apiSchemas.ts` — zod schema 校验
    - **`src/hooks/useMerklCampaignAccess.ts`（新增）** — `getUserCampaignStatus(addr, campaignId)` 返回 `'allowed' | 'whitelist-blocked' | 'blacklisted'`
    - `src/components/dashboard/ReservesTable.tsx` — Merkl breakdown 行显示准入标记
  - 与 [usePortfolioToggle.whitelistMerklCampaignIds](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/reserves-table/usePortfolioToggle.ts) 联动：根据每个 campaign 的 status 决定是否计入用户的有效 APR

**⚠️ 当前 dead code 状态**：
- `src/hooks/useCampaignAccess.ts` 调用后端不存在的独立端点 `/meta/campaign-access`，偏离本方案
- 该文件已标注为 dead code（JSDOC），**Phase 1 启动时应删除并按 aav_66_plan.md 重写为 `useMerklCampaignAccess.ts`**，从 `useSideDataMeta()` 返回的 `campaignAccess` 字段消费
- `src/types/aave.ts` 中的 `CampaignAccessEntry`/`CampaignAccessResponse` 类型也已标注 dead code，重写时同步清理

**关键事实更正**：
- Merkl whitelist/blacklist 是 **per-campaign**，不存在 "用户全局状态" 单 boolean
- 数据来源是**后端 side-data**（已 cron 聚合），不是前端自行 fetch Merkl API
- KV-store 动态黑名单 v1 不处理（决策 #4）；后端方案也只覆盖 `params.whitelist/blacklist` 静态字段

**Bundle 评估**：RainbowKit + wagmi + viem 约 +200KB gzip。需对照 `vite build` 输出确认 chunk 分裂阈值。

**验收**：
- 真实钱包：MetaMask / Coinbase Wallet 连接成功，Header 显示缩略地址 + ENS
- Watch Mode：输入 `0x...` 或 `vitalik.eth`，连接后所有 read-only 数据生效；任何签名调用立即抛 "Watch mode is read-only"
- Watch Mode 持久化：刷新页面后保留
- `useMerklCampaignAccess`（aav_66_plan.md）能正确判定连接地址在每个 campaign 的 status，UI 显示准入标记
- 切链 / 断开 / 重连流程不报错

### Phase 2: 用户数据 fetch (AAV-69)

**前端纯实现，零后端改动。**已在 Linear AAV-69 中明确方案 = 前端直调 Merkl API（理由：rate limit 按用户独立 / 隐私 / claim 流程更短 / 无需后端基础设施）。

**核心端点**（v3 → v4 修订：与 Linear 描述对齐，从 `/v4/claim` 改为 `/v4/users/{address}/rewards`）：

```
GET https://api.merkl.xyz/v4/users/{address}/rewards?chainId={chainIds}
```

- `chainIds` 多个用逗号分隔（如 `1,42161,8453`）—— **一次请求覆盖所有支持链**
- 返回：`amount`（已累计总额）、`pending`（待结算，~2h 更新，未上链不可 claim）、`claimed`（已领取）、`proofs`（merkle proof，claim 用）、`breakdowns`（按 campaign 归属明细）
- **可领取 = amount − claimed**
- 匿名限流：**10 req/s per user**（无需 API key；per-user 独立配额，不互相影响）
- 文档：https://developers.merkl.xyz/integrate-merkl/user-rewards

**新增文件**：

- `src/lib/userData/chainIdLookup.ts`：
  ```ts
  // 从已 fetch 的 reserves 构建：(chainId, lowercaseTokenAddress) → reserveId
  // 注意：这不是 "composite-key fallback for reserveId identity"
  //      （AGENTS.md 禁止的是当 reserveId 缺失时用 composite key 替代）
  // 这里是给 Merkl/Aave 返回的外部数据回写 canonical reserveId，结果仍是后端权威的 reserveId
  export function buildReserveIdLookup(reserves: ReserveWithSpread[]): Map<string, string>
  export function lookupReserveId(lookup, chainId, tokenAddress): string | null
  ```
- `src/lib/userData/merklUserClient.ts`：
  ```ts
  // 一次拿所有链的 rewards + proofs + breakdowns
  fetchUserMerklRewards(address, chainIds: number[]): Promise<MerklUserRewardsResponse>
  // 不再调 /v4/claim 或 /v0/positions beta —— /v4/users/{addr}/rewards 已包含所需全部信息
  ```
- `src/lib/userData/aaveUserClient.ts`：
  ```ts
  // viem multicall，从 reserves 拿 Pool 地址 + reserve list
  fetchAaveUserPositions(address, chainId, poolAddress, reserveAddresses): Promise<AaveUserPositionRaw[]>
  // 用 IPool.getUserReserveData 返回 currentATokenBalance / currentVariableDebt / usageAsCollateralEnabled
  ```
- `src/hooks/useUserPositions.ts` —— React Query hook：
  - `queryKey: ['user-positions', address, chainIdsSorted]`
  - 并行：1 个 Merkl rewards 调用（多链合并）+ N 个 Aave per-chain multicall
  - 聚合 + 回写 reserveId → `UserPosition[]`
  - 5min 缓存；地址变化自动失效
- `src/lib/userPositionMapper.ts`：纯函数 `mapUserPositionsToPortfolioPositions(positions, reserves) → PortfolioPosition[]`

**Claim 流程**（点击 "Claim rewards" 时）：
- Distributor 合约：`0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae`（大多数 EVM 链通用）
- ABI 来源：https://developers.merkl.xyz/images/distributor-abi.json（构建时下载到 `src/lib/abis/merklDistributor.json`）
- viem `writeContract` 调 `claim(users, tokens, amounts, proofs)`
- **Watch Mode 必须拦截**：调用前检查 `isWatchMode`，若是 → 提示 "Switch to a real wallet to claim"

**链选择策略**：从 `reserves` 提取 distinct chainIds，传入 Merkl `chainId` 参数；Aave per-chain 并行 fan-out，某链失败不阻塞其他。

**验收**：
- 连接钱包/输入地址后，前端能拉到 Merkl rewards（amount/pending/claimed/proofs/breakdowns）+ Aave 持仓
- `reserveId` 回写成功率 = 100%（如果 token 在 reserves 中存在）
- 链失败容错：mainnet OK + arbitrum 失败 → UI 显示部分数据 + 失败链 banner
- Claim 流程：真实钱包能成功执行 claim transaction；Watch Mode 弹提示

### Phase 3: Portfolio 导入入口 (AAV-62 扩展)

**在 AAV-62 文件导入主任务基础上新增"钱包导入"入口**：

- 复用/扩展 [PortfolioPanel.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/PortfolioPanel.tsx) 顶部 actions 区
- 新增 "Import from wallet" 按钮：
  - 未连接 → disabled + tooltip "Connect a wallet or watch an address first"
  - 已连接 → 点击 → `useUserPositions()` → **预览 Modal**
- 预览 Modal 字段：
  - 列表显示将导入的 N 条 positions（symbol、chain、side、USD）
  - 单选：
    - ☐ **Merge**（默认）：跳过同 reserveId+side 的重复
    - ☐ **Replace**：清空现有 portfolio.positions 后写入
    - ☐ **Append all**：追加，允许重复
  - 确认 → `actions.addPosition() × N`
- 文件导入逻辑（[portfolioImportParser](file:///Users/pabloli/Documents/code/aaveapy/src/lib) 等）保持 AAV-62 主任务原样

**钱包切换处理**：地址变化时不自动覆盖现有 portfolio，需用户显式点击 "Import from wallet" 重新触发。

**验收**：
- 文件导入和钱包导入两种入口共存
- 预览 Modal 三种模式正确执行
- Watch Mode 下钱包导入同样可用

### Phase 4: Position/Liquidity 展示 (AAV-80)

**前端新增 / 复用**：
- **复用** [PortfolioSummaryCard.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/PortfolioSummaryCard.tsx) + [PortfolioPanel.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/PortfolioPanel.tsx)，**不另建并行面板**
- 在 Portfolio 模式下，若已连接（含 Watch Mode），注入：
  - "Wallet" 标签条：连接源（real / watching）+ 缩略地址 + ENS
  - "Claimable Merkl Rewards" 区：来自 `useUserPositions` 的 claim 数据，按 token + chain 列出
- 集成入 [Index.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/pages/Index.tsx) 的 Portfolio 模式

**验收**：
- 连接后 Portfolio 自动显示个人 Position 汇总（数值与 `usePortfolioSimulation` 输出一致）
- Watch Mode 与真实钱包视觉一致，差别只在 "watching" 标签
- 未连接钱包时所有手动 Portfolio 功能保持现状不变（regression-free）

### Phase 5: 健康因子 HF (延后)

**决策 #6**：HF 是 must-have，但 v1 后做。

- 扩展 [PortfolioSummary](file:///Users/pabloli/Documents/code/aaveapy/src/types/portfolio.ts) 添加 `healthFactor?: number`
- 数据来源：viem 调 `Pool.getUserAccountData(address)` → `healthFactor` (1e18 wei)
- 显示位置：`PortfolioSummaryCard` 加 HF row（颜色阶梯：>2 green / 1.5-2 yellow / <1.5 red / <1.1 critical）
- 单独立 Linear issue，依赖 Phase 4 完成

## 4. 依赖关系

```
Phase 1 (AAV-66) ──→ Phase 2 (AAV-69) ──→ Phase 3 (AAV-62 扩展) ──→ Phase 4 (AAV-80) ──→ Phase 5 (HF, 延后)
  钱包连接+Watch       前端用户数据         钱包导入入口              展示层               健康因子
```

**可独立 ship 的里程碑**：
- Phase 1 ship：可连钱包 / 输入地址 → 资格反映在模拟器
- Phase 2 ship：技术 ready，UI 未暴露（dev tool 可见）
- Phase 3 ship：钱包导入 MVP 完整
- Phase 4 ship：Position/Liquidity 完整体验
- Phase 5 ship：HF 上线

**外部依赖**：
- Merkl `/v4/claim`（成熟）
- Merkl `/v4/users/{addr}/rewards`（成熟稳定，前端直调）
- 公共 RPC（mainnet/base/arbitrum 等）—— 需要在 wagmi config 配 fallback RPC 提升可靠性
- RainbowKit / wagmi v2 / viem v2 LTS 版本（用 context7 skill 确认）

## 5. 类型设计

### MerklCampaignAccess（后端 side-data 类型，前端消费）

详见 [aav_66_plan.md §4.1](file:///Users/pabloli/Documents/code/aaveapy/docs/plans/linear-issues/aav_66_plan.md)。前端使用：

```ts
// 来自 /api/meta/side-data 的 campaignAccess 字段
interface MerklCampaignAccessPayload {
  campaigns: Record<string, {
    chainId: number;
    whitelist: string[];   // 空数组 = 无白名单限制
    blacklist: string[];   // 空数组 = 无黑名单
  }>;
  updatedAt: string;
}

// useMerklCampaignAccess hook 返回
type CampaignAccessStatus = 'allowed' | 'whitelist-blocked' | 'blacklisted';

getUserCampaignStatus(addr: string, campaignId: string): CampaignAccessStatus;
```

### MerklUserRewards（AAV-69 前端直调 Merkl API 返回）

```ts
interface MerklUserRewards {
  // 来自 GET /v4/users/{address}/rewards?chainId=...
  rewards: Array<{
    chainId: number;
    rewards: Array<{
      token: { address: string; symbol: string; decimals: number; chainId: number };
      amount: string;        // 累计总额 (raw, 待 format)
      pending: string;       // 待结算 (~2h 更新)
      claimed: string;       // 已领取
      proofs: string[];      // merkle proof, claim 用
      breakdowns: Array<{
        campaignId: string;
        amount: string;
        reason: string;
      }>;
    }>;
  }>;
}
```

### UserPosition（前端聚合）

```ts
interface UserPosition {
  /** 通过 (chainId, tokenAddress) 反查得到的 canonical reserveId */
  reserveId: string;
  marketName: string;
  chainName: string;
  chainId: number;
  tokenSymbol: string;
  tokenAddress: string;
  side: 'supply' | 'borrow';
  amount: string;            // Token amount, decimal string
  amountUsd: number;
  isCollateral?: boolean;
  claimableMerklUsd?: number;
}

interface UserPositionsResult {
  address: string;
  positions: UserPosition[];
  /** Phase 5 加 */
  // healthFactor?: number;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  /** 每链 fetch 结果摘要 */
  perChain: Array<{
    chainId: number;
    chainName: string;
    aaveStatus: 'ok' | 'error';
    merklClaimStatus: 'ok' | 'error';
    merklPositionsStatus: 'ok' | 'error';
    errors?: string[];
  }>;
}
```

### 映射到 PortfolioPosition

```ts
function mapUserPositionToPortfolioPosition(
  pos: UserPosition,
  reserves: ReserveWithSpread[]
): PortfolioPosition | null {
  const reserve = reserves.find(r => r.reserveId === pos.reserveId);
  if (!reserve) return null;

  return {
    positionId: crypto.randomUUID(),
    reserveId: reserve.reserveId,
    marketName: pos.marketName,
    chainName: pos.chainName,
    tokenSymbol: pos.tokenSymbol,
    side: pos.side,
    amount: String(pos.amountUsd),
    inputMode: 'usd',
  };
}
```

## 6. 白名单联动

`MerklEligibility.whitelistedCampaignIds` 直接喂给 [usePortfolioToggle](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/reserves-table/usePortfolioToggle.ts) 已有的 `whitelistMerklCampaignIds: Set<string>`，无需新增数据结构。

`blacklistedCampaignIds` 不直接禁用 campaign（campaign 仍 active for 其他用户），而是用于在 UI 上对该用户**隐藏**这些 campaign 的 APR 贡献。需新增 `blacklistMerklCampaignIds: Set<string>` toggle 或扩展现有机制。

## 7. 安全与合规

- **Watch Mode 安全模型**：
  - 不持有 private key，不签任何交易
  - 输入框校验 viem `isAddress`，避免 invalid input
  - localStorage 持久化只存 address（字面值），不存任何 secret
  - UI 必须明显标注 "watching" / "view-only" 视觉差异，避免用户误以为已授权
- **真实钱包安全**：
  - 不要求任何 signMessage / sendTransaction（仅只读读链）
  - RainbowKit `coolMode` / `appInfo` 不存敏感信息
- **API 调用**：
  - Merkl API 是公开端点，无需 key
  - 公共 RPC：用 `wagmi` 默认 + 可选 Alchemy/Infura key（envar）做 fallback；key 不打进 bundle
- **CORS**：Merkl `api.merkl.xyz` 已配置 `Access-Control-Allow-Origin: *`（需上线前验证）

## 8. 复杂度评估

**Medium**（v2 是 Medium-High，简化后降一档）

简化原因：
- ✅ 后端零改动 —— 移除 "user-triggered fetch 例外" 决策需求
- ✅ Watch Mode 移除签名 / 链切换 / tx 复杂度
- ✅ HF 延后 —— Phase 1-4 不动 `PortfolioSummary` 类型
- ✅ KV-store 不做 —— 移除 Merkl 团队沟通依赖

剩余风险：
- ⚠️ React Query 是新依赖（评估见 §10）
- ✅ Merkl `/v4/users/{addr}/rewards` 成熟稳定，已 CORS 实测通过
- ⚠️ Bundle size +200KB —— 需 build 后实测
- ⚠️ 多链并行 fetch 错误处理 —— UI 设计要清晰展示部分失败状态

## 9. AAV-67 关闭

AAV-67 诉求（连钱包 → 读持仓 → 展示）被 Phase 1-4 完全覆盖。关闭前在 Linear @ AAV-67 reporter 确认。

## 10. 待办前置研究（非 blocker）

这些不阻塞动工，但 Phase 1 启动前的 spike：

1. **React Query 与现有 hooks 兼容性**：[useAaveMarkets](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useAaveMarkets.ts) / [useSideDataMeta](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useSideDataMeta.ts) 当前是手写 fetch + useState。引入 RQ 后建议：
   - 新增 user-data 相关 hooks 全部走 RQ
   - 旧 hooks 保持不动（避免大规模重构）
   - 两者通过 RQ `QueryClientProvider` 共存即可
2. **`viem/chains` 与网站支持链匹配** ✅ **已验证（viem 2.50.4，2026-05）**：
   - 网站现支持的 21 条链 viem 全部原生导出，无需 `defineChain`
   - 唯一注意点：chainId 8453 同时存在 `base` 和 `basePreconf`（preconfirmation 变体），用 `base`
   - 复现命令（如需重测新 viem 版本）：
     ```bash
     cd /tmp && mkdir -p viem-spike && cd viem-spike && npm i viem --silent
     node --input-type=module -e "
       import * as c from 'viem/chains';
       const want = [1,10,56,100,137,146,196,250,324,1088,1868,4326,5000,8453,9745,42161,42220,43114,57073,59144,534352];
       const byId = new Map();
       for (const [n,ch] of Object.entries(c)) if (ch?.id) byId.set(ch.id, n);
       want.forEach(id => console.log(id, byId.get(id) ?? 'MISSING'));
     "
     ```
3. **CORS 验证** ✅ **已验证 `/v4/claim` + `/v0/positions/*` + `/v4/users/{addr}/rewards`（2026-05）**：
   - 三个端点统一行为：HTTP 200/404 都正确返回 CORS 头（vitalik 地址 + chainId=1 实测 200）
   - **注意**：Merkl 不返回 `*`，而是**回显请求 Origin**（`access-control-allow-origin: https://aaveapy.com`），且 `access-control-allow-credentials: true`
   - 前端 `fetch` 调用必须用 `credentials: 'omit'`（默认），不要用 `'include'`，否则跨域 cookie 携带会失败
   - 复测命令：
     ```bash
     curl -sI -H "Origin: https://aaveapy.com" \
       "https://api.merkl.xyz/v4/users/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045/rewards?chainId=1" \
       | grep -iE "^(HTTP|access-control)"
     ```
4. **共享 chainId 真理表抽取**（重构子任务，建议 Phase 1 启动时一起做）：
   - 当前真理表在 [src/lib/tokenPriceResolver.ts:30](file:///Users/pabloli/Documents/code/aaveapy/src/lib/tokenPriceResolver.ts#L30) 的 `HARDCODED_PLATFORM_BY_CHAIN_ID`
   - 抽到新文件 `src/lib/chains/supportedChainIds.ts`，导出：
     ```ts
     export const SUPPORTED_CHAIN_IDS = [1, 10, 56, 100, 137, 146, 196, 250, 324, 1088, 1868, 4326, 5000, 8453, 9745, 42161, 42220, 43114, 57073, 59144, 534352] as const;
     export type SupportedChainId = typeof SUPPORTED_CHAIN_IDS[number];
     /** chainId → Coingecko platform slug（原 HARDCODED_PLATFORM_BY_CHAIN_ID） */
     export const COINGECKO_PLATFORM_BY_CHAIN_ID: Record<SupportedChainId, string> = { ... };
     /** chainId → 人类可读名 */
     export const CHAIN_NAME_BY_ID: Record<SupportedChainId, string> = { ... };
     ```
   - `tokenPriceResolver.ts` 改为 `import` 该 Record
   - 新增 `src/lib/wagmi/chains.ts` 也基于 `SUPPORTED_CHAIN_IDS` 构造 wagmi config
   - 收益：避免未来漂移；新加链只改一处
   - 风险：`tokenPriceResolver` 是热路径，需跑现有单测确认无回归

## 11. 执行建议

进入实现阶段时按以下顺序与并行策略推进：

### Step 0 — 并行预备工作（同一 PR / 多 agent 可分头）

| 任务 | 文件 | 负责范围 |
|---|---|---|
| **A. chainId 真理表抽取** | 新建 [src/lib/chains/supportedChainIds.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/chains/supportedChainIds.ts)；修 [src/lib/tokenPriceResolver.ts:30](file:///Users/pabloli/Documents/code/aaveapy/src/lib/tokenPriceResolver.ts#L30) 改 import | 见 §10 #4；改完跑 `npm test -- tokenPriceResolver` 确保无回归 |
| **B. 钱包栈依赖安装** | `package.json` 加 `@rainbow-me/rainbowkit`、`wagmi@^2`、`viem@^2`、`@tanstack/react-query@^5` | 用 context7 skill 拉最新 LTS；`npm i` 后跑 `npm run build` 看 bundle 增量 |
| **C. Web3Provider 骨架** | 新建 [src/lib/wagmi/chains.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/wagmi/chains.ts)、[src/lib/wagmi/config.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/wagmi/config.ts)、[src/providers/Web3Provider.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/providers/Web3Provider.tsx)；嵌入 [src/App.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/App.tsx) | 依赖 A、B 完成 |

A、B 完全独立，可并行；C 需等 A+B。

### Step 1 — Phase 1 (AAV-66)

按 §3 Phase 1 实现：
1. [src/lib/wagmi/watchModeConnector.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/wagmi/watchModeConnector.ts) — Watch Mode connector + 单测
2. [src/hooks/useWallet.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useWallet.ts) — 薄封装 + 单测
3. [src/components/dashboard/Header.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/Header.tsx) — 集成 `<ConnectButton />` + Watch 入口
4. [src/hooks/useMerklCampaignAccess.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/useMerklCampaignAccess.ts) — 按 [aav_66_plan.md §4.5](file:///Users/pabloli/Documents/code/aaveapy/docs/plans/linear-issues/aav_66_plan.md) 实现，从 `useSideDataMeta().campaignAccess` 消费 + 单测；同时删除 dead code `src/hooks/useCampaignAccess.ts`
5. 联动 [src/hooks/reserves-table/usePortfolioToggle.ts](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/reserves-table/usePortfolioToggle.ts) 的 `whitelistMerklCampaignIds`

**Phase 1 Definition of Done**：
- 验证 Gate（§11）4 项全绿
- 手测 Watch Mode：输入 `vitalik.eth` → 资格反映到 UI；输入随机地址 → 资格清空
- 手测真实钱包：MetaMask 连接 + 切链 + 断开

### Step 2 — Phase 2 (AAV-69)

按 §3 Phase 2 实现。**Phase 2 不暴露 UI**（数据层 ready 即可），便于独立 ship 与回归。

### Step 3 — Phase 3 (AAV-62 扩展)

依赖 Phase 2。AAV-62 的文件导入主任务**先于本 Epic** 完成；本 Epic 只在已有 PortfolioImport 入口旁加 "Import from wallet" 按钮 + 预览 Modal。

### Step 4 — Phase 4 (AAV-80)

依赖 Phase 3。**强制复用** [PortfolioPanel.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/PortfolioPanel.tsx) + [PortfolioSummaryCard.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/PortfolioSummaryCard.tsx)，禁止新建并行面板。

### Step 5 — Phase 5 (HF, 单独 Linear Issue)

新开 Linear issue，依赖 Phase 4 完成。扩展 [src/types/portfolio.ts](file:///Users/pabloli/Documents/code/aaveapy/src/types/portfolio.ts) 的 `PortfolioSummary` 加 `healthFactor?: number`。

### 多 agent 并行原则

- **Step 0 A / B** 可分两个 PR 并行（无文件冲突）
- **Step 0 C** 必须串行在 A+B 之后
- Phase 1-5 严格串行（前一个 Definition of Done 通过才进下一个）
- Phase 3 内部的"预览 Modal UI 重构" 与"导入逻辑"可拆 2 个 sub-agent 并行（前者改 [PortfolioPanel.tsx](file:///Users/pabloli/Documents/code/aaveapy/src/components/dashboard/PortfolioPanel.tsx)，后者改 [src/lib/userPositionMapper.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/userPositionMapper.ts)）

### Linear issue 拆解建议

| Linear Issue | Step | 估时 | 备注 |
|---|---|---|---|
| 新 sub-issue：chainId 真理表抽取 | Step 0 A | 2-4h | 重构，必须先做 |
| 新 sub-issue：钱包栈依赖 + bundle 评估 | Step 0 B | 2-4h | 含 bundle size 报告 |
| **AAV-66 前端** | Step 0 C + Step 1 | 1-2d | Web3Provider + Watch Mode + 消费 `/api/meta/side-data.campaignAccess`（后端已实现，见 [aav_66_plan.md](file:///Users/pabloli/Documents/code/aaveapy/docs/plans/linear-issues/aav_66_plan.md)） |
| AAV-69 | Step 2 | 1-2d | 前端直调 `/v4/users/{addr}/rewards` + Aave viem multicall + Claim 流程 |
| AAV-62（扩展部分） | Step 3 | 0.5-1d | AAV-62 主体已完成的前提下 |
| AAV-80 | Step 4 | 0.5-1d | 复用现有面板 |
| 新 sub-issue：HF | Step 5 | 0.5d | 延后 |

### 风险快查

| 风险 | 影响 | 缓解 |
|---|---|---|
| Bundle size +200KB 超阈值 | 警告 / 加载变慢 | Step 0 B 完成立即测；超阈值则用动态 import 把 RainbowKit 延迟加载 |
| React Query 与现有 hooks 行为冲突 | 数据不一致 | 严格按 §10 #1 隔离策略：新代码用 RQ，旧 hooks 不动 |
| Merkl `/v4/users/{addr}/rewards` schema 变更 | Phase 2 中断 | 在 [src/lib/userData/merklUserClient.ts](file:///Users/pabloli/Documents/code/aaveapy/src/lib/userData/merklUserClient.ts) 加 zod 校验；变更立即 throw |
| Watch Mode 被误用做交易 | 用户混淆 | UI 强制 "watching" 标签 + 任何签名 hook 抛 throw |
| 多链 fetch 部分失败 | UX 不清晰 | `UserPositionsResult.perChain[]` 明确每链状态，UI 显示失败链 banner |

## 12. 验证 Gate

每个 Phase 完成后必须：

```bash
npm run lint && npm test && npm run build && npx tsc --noEmit
```

另对照 [docs/conventions/frontend-regression-checklist.md](file:///Users/pabloli/Documents/code/aaveapy/docs/conventions/frontend-regression-checklist.md)。

新增的 hook / lib 必须有 co-located 单测（[reserves-table/](file:///Users/pabloli/Documents/code/aaveapy/src/hooks/reserves-table) 模式）：
- `useWallet.test.ts`
- `useMerklCampaignAccess.test.ts`（含 whitelist hit/miss、blacklist hit/miss、空数据 fallback）
- `useUserMerklRewards.test.ts`
- `useUserPositions.test.ts`
- `userPositionMapper.test.ts`
- `chainIdLookup.test.ts`
- `watchModeConnector.test.ts`
