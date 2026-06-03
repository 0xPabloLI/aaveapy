# 开发方案 - AAV-66 前端：消费 Merkl Campaign Access Side Data

> **Status: Done** — 实现完成，`campaignAccessStatuses` 已连线。
> **后端方案**：`aave-protocol-analysis/docs/plans/linear-issues/aav_66_plan.md`

## 1. 概述

AAV-66 的后端部分已在 side-data 端点 `/api/meta/side-data` 中增加了 `campaignAccess` 字段，提供 Merkl campaign 的 whitelist/blacklist 地址数组。本文档覆盖前端消费侧的实现。

### 与 Epic 方案的关系

Epic 方案（`aav_epic_wallet_merkl_portfolio_plan.md`）Phase 1 中 `useMerklEligibility` 原设计为从前端直读 reserves 中的 campaign params。现改为**从后端 side-data 获取**，理由：

1. 后端已聚合完整 whitelist/blacklist 数据，前端无需自行从 Merkl API 提取
2. Side-data 有 cron 刷新 + 缓存，前端消费更稳定
3. Reserves payload 中不包含完整地址数组（仅有 `whitelistOnly` 布尔值），直读不可行

## 2. Repo 信息

| 项 | 值 |
|---|---|
| GitHub | [`0xPabloLI/aaveapy`](https://github.com/0xPabloLI/aaveapy) |
| 本地路径 | `/Users/pabloli/Documents/code/aaveapy` |

## 3. 数据源

**端点**：`GET /api/meta/side-data` → `payload.campaignAccess`

```ts
interface CampaignAccessPayload {
  campaigns: Record<string, {
    chainId: number;
    whitelist: string[];   // 空数组 = 无白名单限制
    blacklist: string[];   // 空数组 = 无黑名单
  }>;
  updatedAt: string;       // ISO timestamp
}
```

- Key 为 `campaignId`（string）
- 只包含有 whitelist 或 blacklist 的 campaign（两者都为空的不出现在响应中）
- Payload ~30KB gzipped

## 4. 实现方案

### 4.1 类型定义

**文件**：`src/types/aave.ts`

新增：

```ts
export interface MerklCampaignAccessEntry {
  chainId: number;
  whitelist: string[];
  blacklist: string[];
}

export interface MerklCampaignAccessPayload {
  campaigns: Record<string, MerklCampaignAccessEntry>;
  updatedAt: string;
}
```

### 4.2 Side Data 响应类型扩展

**文件**：`src/hooks/useSideDataMeta.ts`

`SideDataMetaResponse` 接口增加：

```ts
campaignAccess?: MerklCampaignAccessPayload;
```

`fetchSideDataMeta` 中增加缓存逻辑：

```ts
if (parsed.campaignAccess) {
  setCachedCampaignAccess(parsed.campaignAccess);
}
```

### 4.3 缓存层

**文件**：`src/lib/cache.ts`

新增：

```ts
export function setCachedCampaignAccess(data: MerklCampaignAccessPayload): void { ... }
export function getCachedCampaignAccess(): MerklCampaignAccessPayload | null { ... }
```

### 4.4 Zod Schema

**文件**：`src/lib/apiSchemas.ts`

`SideDataMetaResponseSchema` 增加 `campaignAccess` 字段校验：

```ts
campaignAccess: z.object({
  campaigns: z.record(z.object({
    chainId: z.number(),
    whitelist: z.array(z.string()),
    blacklist: z.array(z.string()),
  })),
  updatedAt: z.string(),
}).optional(),
```

### 4.5 Campaign Access Hook

**新增文件**：`src/hooks/useMerklCampaignAccess.ts`

```ts
export type CampaignAccessStatus = 'allowed' | 'whitelist-blocked' | 'blacklisted';

export function getUserCampaignStatus(
  userAddress: string,
  campaignId: string,
  access: MerklCampaignAccessPayload | null
): CampaignAccessStatus {
  if (!access) return 'allowed';
  const entry = access.campaigns[campaignId];
  if (!entry) return 'allowed'; // 无名单数据 = 公开 campaign
  const addr = userAddress.toLowerCase();
  if (entry.whitelist.length > 0) {
    return entry.whitelist.some(a => a.toLowerCase() === addr)
      ? 'allowed' : 'whitelist-blocked';
  }
  if (entry.blacklist.some(a => a.toLowerCase() === addr)) return 'blacklisted';
  return 'allowed';
}

export function useMerklCampaignAccess(): {
  data: MerklCampaignAccessPayload | null;
  getUserStatus: (userAddress: string, campaignId: string) => CampaignAccessStatus;
} {
  const access = getCachedCampaignAccess();
  return {
    data: access,
    getUserStatus: (addr, campaignId) => getUserCampaignStatus(addr, campaignId, access),
  };
}
```

### 4.6 UI 集成

**文件**：`src/components/dashboard/ReservesTable.tsx`

Merkl breakdown 行渲染时：
- 读取 `useMerklCampaignAccess()` + `useWallet()` 的 address
- 对每个 Merkl campaign breakdown 调用 `getUserStatus(address, campaignId)`
- `whitelist-blocked` 或 `blacklisted` 状态时显示对应标记（样式待设计）

## 5. 修改清单

| 文件（相对 repo root） | 改动类型 | 改动说明 |
|---|---|---|
| `src/types/aave.ts` | 修改 | +`MerklCampaignAccessEntry` / `MerklCampaignAccessPayload` 类型 |
| `src/hooks/useSideDataMeta.ts` | 修改 | `SideDataMetaResponse` 增加 `campaignAccess`，`fetchSideDataMeta` 缓存 |
| `src/lib/cache.ts` | 修改 | +`setCachedCampaignAccess` / `getCachedCampaignAccess` |
| `src/lib/apiSchemas.ts` | 修改 | `SideDataMetaResponseSchema` 增加 `campaignAccess` zod schema |
| `src/hooks/useMerklCampaignAccess.ts` | **新增** | `getUserCampaignStatus` + `useMerklCampaignAccess` hook |
| `src/components/dashboard/ReservesTable.tsx` | 修改 | Merkl breakdown 行显示准入状态标记 |

**6 个文件**（1 新增 + 5 修改）。

## 6. 依赖关系

```
后端 campaignAccess side-data 就绪（已部署）
        ↓
前端 type + cache + schema（4.1–4.4）
        ↓
前端 useMerklCampaignAccess hook（4.5）
        ↓
前端 UI 集成（4.6，依赖钱包 hook 就位）
```

- 4.1–4.5 可在钱包连接之前实现（hook 接受 address 参数，不依赖 wagmi）
- 4.6 需要 `useWallet()` 的 `address` 可用，依赖 AAV-66 epic Phase 1 的钱包连接实现

## 7. 验证

- `npm run lint && npm test && npm run build && npx tsc --noEmit`
- 手测：调用 `/api/meta/side-data` 确认 `campaignAccess` 字段存在
- 单测：`useMerklCampaignAccess.test.ts` — 覆盖 whitelist hit/miss、blacklist hit/miss、空数据 fallback

## 8. 实现与计划的分歧

实际实现与以上计划有以下差异：

| 计划 | 实际 |
|---|---|
| `useMerklCampaignAccess.ts`（新文件） | `useCampaignAccess.ts`（文件名简化） |
| Hook 从 `cache.ts` 直读 | Hook 通过 `useSideDataMeta()` (React Query) 消费 |
| Hook 返回 `{ data, getUserStatus }` | Hook 返回 `{ campaigns, campaignAccessStatuses, getUserStatus, ... }`，通过 `useMemo` 计算 `campaignAccessStatuses: Record<campaignId, CampaignAccessStatus>` |
| UI 集成在 `ReservesTable.tsx` 逐行调用 | 集成在 `Index.tsx`，一次性计算 `campaignAccessStatuses` 后传给 `ReservesTable`、`IncentiveTooltip`、`TopOpportunities` 等组件 |
| 无 `computeCampaignAccessStatuses` 纯函数 | 导出 `computeCampaignAccessStatuses()` 用于批量计算和测试 |

**连线流程**：

```
useWallet() → walletAddress
       ↓
useCampaignAccess(walletAddress) → useMemo: computeCampaignAccessStatuses(address, campaigns)
       ↓
campaignAccessStatuses: Record<campaignId, 'allowed' | 'whitelist-blocked' | 'blacklisted'>
       ↓
isMerklWhitelistBreakdownIncluded(breakdown, whitelistMerklCampaignIds, campaignAccessStatus)
       ↓
'blacklisted' / 'whitelist-blocked' → 排除该 campaign 的 APR 贡献
```
