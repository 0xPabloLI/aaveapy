# 联合方案 - 钱包连接 + Merkl 持仓 + Portfolio 导入

## 聚合 Issue

| Issue | 角色 | 状态变更 |
|-------|------|---------|
| AAV-66 | 前置：钱包连接 + Merkl 白/黑名单 | 保留为子任务 |
| AAV-69 | 核心：Merkl Dashboard 数据读取 | 保留为子任务 |
| AAV-62 | 入口：Portfolio 导入（文件/钱包） | 保留为子任务，扩展支持钱包一键导入 |
| AAV-67 | 合并：读取自己的 Portfolio | **关闭**，被 AAV-69+62 联合覆盖 |
| AAV-80 | 展示层：个人 Position/Liquidity | 保留为子任务 |

## 1. 联合目标

用户连接钱包后，一键读取自己在 Merkl/Aave 上的持仓数据，自动导入为 Portfolio positions，并在 Dashboard 展示个人 Position/Liquidity 汇总。

## 2. 数据流

```
用户点击"连接钱包"
  → useWallet() → address
    → 并行请求:
      ├─ GET /api/user/merkl-status?address=0x... → { isWhitelisted, isBlacklisted }
      │   → 初始化 whitelistMerklCampaignIds
      └─ GET /api/user/positions?address=0x... → UserPosition[]
          → 映射为 PortfolioPosition[]
          → actions.addPosition() × N
          → Portfolio 模拟自动更新
          → 展示 Position/Liquidity 汇总
```

## 3. 分阶段实现

### Phase 1: 钱包连接 + Merkl 状态 (AAV-66)

**前端新增**:
- `src/hooks/useWallet.ts` — 钱包连接状态管理（address, chainId, connect, disconnect）
- `src/components/Header/WalletConnect.tsx` — 连接/断开按钮 + 地址显示
- `src/hooks/useMerklStatus.ts` — 调用后端接口获取白/黑名单状态

**后端新增**:
- `GET /api/user/merkl-status?address=0x...` → `{ isWhitelisted, isBlacklisted }`

**钱包库选型**: wagmi v2 + viem（轻量、TypeScript 原生、EIP-6963 多钱包发现）

**验收**:
- 连接 MetaMask/Coinbase Wallet 成功，显示缩略地址
- 白/黑名单状态正确展示

### Phase 2: Merkl Dashboard 数据 + 用户持仓 (AAV-69)

**后端新增**:
- 扩展 `src/merkl-api.ts` — 调用 Merkl Dashboard API，按 address 获取用户持仓
- `GET /api/user/positions?address=0x...` → `UserPosition[]`
  - 每条包含: reserveId, marketName, chainName, tokenSymbol, tokenAddress, side, amount, amountUsd, isCollateral
- 数据缓存策略: 按地址缓存 60s，避免频繁链上查询

**前端新增**:
- `src/hooks/useUserPositions.ts` — React Query hook 调用 /api/user/positions
- `src/lib/userPositionMapper.ts` — 纯函数: `mapUserPositionsToPortfolioPositions(positions, reserves) → PortfolioPosition[]`

**关键映射逻辑**:
- Merkl 返回的 token address + chain → 匹配 `reserves[].reserveId`（按 tokenAddress + chainId 唯一匹配）
- side: Merkl position type → 'supply' | 'borrow'
- amount: 直接使用 Merkl 的持仓金额

**验收**:
- 后端能成功调用 Merkl Dashboard API 并按地址返回持仓
- 前端能将持仓数据映射为 PortfolioPosition

### Phase 3: Portfolio 导入入口 (AAV-62 扩展)

**在原 AAV-62 基础上新增"钱包导入"入口**:

- `src/components/dashboard/PortfolioImport.tsx` 扩展:
  - 原有: 文件上传/粘贴（JSON/CSV）
  - 新增: "从钱包导入"按钮（需钱包已连接）
  - 点击后调用 `useUserPositions` → `mapUserPositionsToPortfolioPositions` → 预览 → 确认 → `addPosition() × N`
- `src/lib/portfolioImportParser.ts` — 保持原有文件解析逻辑不变

**验收**:
- 文件导入和钱包导入两种入口均可使用
- 钱包导入前可预览，确认后写入 Portfolio

### Phase 4: Position/Liquidity 展示 (AAV-80)

**前端新增**:
- `src/components/dashboard/UserPositionsPanel.tsx` — 个人持仓汇总面板
  - 总资产价值、总负债价值、净流动性、健康因子
  - 各资产明细列表（supply/borrow/collateral）
- 集成到 Dashboard 的 Portfolio 模式下

**验收**:
- 连接钱包后 Dashboard 显示个人 Position/Liquidity 汇总
- 数据与 Portfolio 模拟结果一致

## 4. 依赖关系

```
Phase 1 (AAV-66) ──→ Phase 2 (AAV-69) ──→ Phase 3 (AAV-62 扩展) ──→ Phase 4 (AAV-80)
  钱包连接             持仓数据获取         钱包导入入口              展示层
```

外部依赖:
- Merkl Dashboard API 稳定性
- wagmi v2 + viem 依赖
- 后端 onchainDataService 扩展

## 5. 类型设计

### UserPosition（后端返回）

```ts
interface UserPosition {
  reserveId: string;
  marketName: string;
  chainName: string;
  chainId: number;
  tokenSymbol: string;
  tokenAddress: string;
  side: 'supply' | 'borrow';
  amount: string;        // 原始金额（wei 或格式化）
  amountUsd: number;     // USD 估值
  isCollateral?: boolean;
}
```

### MerklStatus（后端返回）

```ts
interface MerklStatus {
  isWhitelisted: boolean;
  isBlacklisted: boolean;
  whitelistedCampaignIds?: string[];  // 该地址可见的白名单 campaign
}
```

### 映射到 PortfolioPosition

```ts
function mapUserPositionToPortfolioPosition(
  pos: UserPosition,
  reserves: ReserveWithSpread[]
): PortfolioPosition | null {
  // 按 tokenAddress + chainId 匹配 reserve
  const reserve = reserves.find(r =>
    r.tokenAddress.toLowerCase() === pos.tokenAddress.toLowerCase()
    && r.chainId === pos.chainId
  );
  if (!reserve) return null;  // 跳过不匹配的

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

AAV-66 的 `MerklStatus.whitelistedCampaignIds` 直接影响 Portfolio 模拟结果:
- 用户被标记为白名单 → 自动 opt-in 对应 campaign，初始化 `whitelistMerklCampaignIds`
- 用户被标记为黑名单 → 禁用相关 campaign 的 APR 计算

这通过 `usePortfolioToggle` 中已有的 `whitelistMerklCampaignIds: Set<string>` 机制实现，无需新增数据结构。

## 7. 安全审查要点

- 钱包地址仅用于查询，不签名任何交易（只读模式）
- 后端 `/api/user/positions` 需 rate limiting（按 IP + address）
- Merkl API key 不暴露到前端
- 用户地址本地存储需用户明确 opt-in
- `whitelistedCampaignIds` 来源为后端权威数据，前端不可篡改

## 8. 复杂度评估

**Medium-High**

理由：4 个阶段串行依赖，涉及钱包库集成（新依赖）、后端 API 新增（2 个端点）、Merkl 第三方 API 集成、数据映射逻辑、Portfolio 扩展。但每个阶段内部复杂度可控，且现有 Portfolio 基础设施完备。

## 9. AAV-67 关闭理由

AAV-67（读取自己的 Portfolio）的核心诉求是"连接钱包 → 读取用户持仓 → 展示"。该诉求已被联合方案完全覆盖:
- 钱包连接 → Phase 1 (AAV-66)
- 读取持仓 → Phase 2 (AAV-69)
- 导入 Portfolio → Phase 3 (AAV-62)
- 展示 → Phase 4 (AAV-80)

无需单独实现，关闭避免重复工作。
