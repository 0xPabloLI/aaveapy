# Handoff: 钱包仓位系统（Wallet Position System）

> 最后更新: 2026-06-02 | 本文档是钱包仓位系统的唯一入口文档，后续 bug 和改进请参照此文档。

## 架构概览

```
用户钱包地址
  ├── SDK 首选路径
  │   ├── V3: @aave/react-v3 useUserSupplies/useUserBorrows
  │   └── V4: @aave/react useUserSupplies/useUserBorrows
  │       ↓ enrichV3/V4*Positions → 加 spokeAddress/hubName/hubNames
  │       ↓ sdkPositionConverter → composeReserveId → resolvePositionMetaByReserveId
  │       ↓ WalletPosition[]
  │
  ├── Onchain Fallback (SDK 失败时)
  │   ├── V3: aaveV3UserClient (viem multicall)
  │   └── V4: aaveV4UserClient (viem multicall)
  │       ↓ onchainPositionConverter → (chainId, tokenAddress) lookup
  │       ↓ WalletPosition[]
  │
  └── useWalletAutoImport
      ↓ convertWalletPositionsToPortfolio
      ↓ portfolioActions.importPositions
      ↓ PortfolioPanel 渲染
```

## Reserve 匹配策略（核心）

### 问题
前端需要将 user position 匹配到后端 `/markets` 返回的 Reserve，获取 price/symbol/APY 等 meta。

### 后端 reserveId 格式
- **V3**: `{chainId}:{poolAddress}:{tokenAddress}`
- **V4**: `{chainId}:{poolAddress}:{tokenAddress}:{hubName}`（hubName = Core/Plus/Prime）
- 所有地址组件 lowercase

### 三级查找路径

| 优先级 | 策略 | 条件 | 精度 |
|--------|------|------|------|
| 1 | `composeReserveId` 精确查找 | 有 spokeAddress + hubNames 遍历 | ✅ 唯一匹配 |
| 2 | `(chainId, tokenAddress)` fallback | 无 spokeAddress | ⚠️ 同链同币种多 pool 时可能歧义 |
| 3 | Orphan | 两路均未命中 | reserveId=undefined, tokenPrice=0 |

### 关键发现
1. **SDK `reserve.id` 是 Base64 编码的 opaque ID**，不等于后端 reserveId，不能用于 Map.get
2. **V3 Ethereum mainnet 有 4 个不同 poolAddress 都有 USDC**——`(chainId, tokenAddress)` 不够精确
3. **V4 多 hubName**：当前遍历 `connectedHubs` 尝试每个 hubName 在 reserveMap 中匹配

### 歧义检测
`buildReserveLookupByChainAndToken` 构建时标记 `_ambiguousFallback=true`，fallback 命中时 `console.warn` 输出歧义信息。

## Watch Mode

- 入口：Header / PortfolioPanel 的 `WalletButton` 中的 "View address" 按钮
- Hook: `useWatchModeConnect` → 调用 wagmi `connect({ connector: watchModeConnector })`
- 地址输入：`WatchAddressInput`（支持 0x 地址 + ENS 解析）
- 与真实钱包互斥：同一时刻只有一个 active account
- **AAV-643 fix（2026-06-08，状态：已闭环）**: Watch Mode 已激活时用户再提交一次地址（页面刷新后 wagmi 从 localStorage 自动恢复 connector 是典型触发场景）需要主动 invalidate positions cache。`setWatchAddress` 同地址 no-op，wagmi 不会发 'change' 事件，否则 positions 静默卡住。详见 [`useWatchModeConnect.ts`](../../src/hooks/useWatchModeConnect.ts) 注释与 `useWatchModeConnect.test.ts` 回归测试。
  - **方案**：`useWatchModeConnect` 在 isReentry 路径上 `bumpRefetch('watch-reentry')` → `refetchEvent` 抽象统一刷新信号 → `useUserPositionsSdk` 订阅 `subscribeRefetch` 后 (a) `queryClient.invalidateQueries` RQ fallback key (b) `gapFallbackQuery.refetch()` (c) `v3Client.refreshQueryWhere` / `v4Client.refreshQueryWhere` 传入 `UserSuppliesQuery` / `UserBorrowsQuery` 文档 + 谓词匹配当前 `address`。详见 ADR-0015。
  - **覆盖路径**：RQ fallback key `['user-positions-onchain-fallback', address, v3SdkFailed, v4SdkFailed]`、gap fallback、urql V3 + V4 全覆盖（生产主路径）。三路径与 F5 / Refresh 按钮共用同一个 `refetchEvent` 通道。

## 钱包自动导入

- `useWalletAutoImport`：`isConnected` + `address` 变化时自动触发
- 用 `lastImportedAddress` ref 去重（lowercase 地址比较）
- 钱包切换地址 → 重新 import
- 同地址不同 checksum 大小写 → 不重新 import

## Merkl Rewards

- Hook: `useUserClaimableRewardsSdk`（V4 SDK `useUserClaimableRewards`）
- UI: PortfolioPanel 内 `claimableRewards` 渲染
- 数据层: `merklUserClient.ts`

## 软删除（Soft Delete）

- `walletValue / currentValue / hidden` 三值追踪
- 三态图标：🟢 synced / 🟡 modified / ⚪ manual
- Hidden 仓位：灰行 + 沉底 + EyeOff + 点击恢复
- Resync 时 hidden 仓位 → 强制 unhidden

## 降级策略

- V3 SDK 挂 → V3 走 viem；V4 SDK 挂 → V4 走 viem；各自独立
- `DegradedResult`: success / partial / error
- Partial 时 toast.warning 提示 SDK 降级

## 关键文件索引

### 数据层
| 文件 | 职责 |
|------|------|
| `src/lib/reserveKey.ts` | composeReserveId, buildReserveMap, buildReserveLookupByChainAndToken |
| `src/lib/userData/userPositionMapper.ts` | resolvePositionMeta, resolvePositionMetaByReserveId, WalletPosition 类型 |
| `src/lib/userData/sdkPositionConverter.ts` | SDK position → WalletPosition 转换（双 map 查找） |
| `src/lib/userData/onchainPositionConverter.ts` | Onchain position → WalletPosition 转换 |
| `src/hooks/useUserPositionsSdk.ts` | SDK hooks + enrich 函数 + fallback 编排 |
| `src/hooks/useWalletAutoImport.ts` | 自动导入逻辑 |
| `src/lib/walletPositionToPortfolio.ts` | WalletPosition → PortfolioPosition 转换 |

### UI 层
| 文件 | 职责 |
|------|------|
| `src/components/dashboard/WalletButton.tsx` | 连接/断开/View address 按钮 |
| `src/components/dashboard/WatchAddressInput.tsx` | 地址输入 + ENS 解析 |
| `src/components/dashboard/PortfolioPanel.tsx` | Portfolio 管理 + 仓位列表 + Merkl rewards |
| `src/components/dashboard/Header.tsx` | Header + WalletButton 集成 |
| `src/hooks/useWatchModeConnect.ts` | Watch mode 连接逻辑 |
| `src/hooks/useWallet.ts` | 钱包状态（address, isConnected, isWatchMode） |

### 类型
| 文件 | 关键类型 |
|------|---------|
| `src/types/aave.ts` | ReserveWithSpread (reserveId, chainId, tokenAddress, marketName) |
| `src/types/portfolio.ts` | PortfolioPosition, PortfolioState |
| `src/lib/userData/userPositionMapper.ts` | WalletPosition, PositionMeta |

## 已知限制

1. **Onchain fallback 无法区分多 pool**：`onchainPositionConverter.ts` 用 `(chainId, tokenAddress)` 查找，V3 多 pool 同币种会匹配到第一个 reserve（fallback 命中时 `console.warn` 歧义提醒）
2. **enrich 函数依赖 SDK 内部结构**：SDK 升级可能破坏 enrich 的字段提取

## 教训

1. **绝不能用测试 fixture 的硬编码值推断真实 API 格式** — 必须直接调 staging API 验证
2. **SDK `reserve.id` 不等于后端 reserveId** — 它是 Base64 编码的复合 ID
3. **V3 多 pool 同币种** — Ethereum mainnet 有 4 个不同 poolAddress 都有 USDC

## Issue 状态总结

| Issue | 标题 | 状态 | 说明 |
|-------|------|------|------|
| AAV-66 | 连接钱包 + Merkl 资格 | ✅ Done | Phase 1 |
| AAV-67 | 读取自己的portfolio | ✅ Done | 被 Epic 覆盖，拆解到各 Phase |
| AAV-68 | 读取 net lending/borrow | ✅ Done | AAV-62 子任务 |
| AAV-69 | 读取 Merkl dashboard 数据 | ✅ Done | Phase 2，Merkl rewards 已实现 |
| AAV-80 | 个人 position/liquidity | ✅ Done | Phase 4，展示已实现 |
| AAV-62 | 支持导入现有portfolio | ❌ Canceled | 手动导入按钮不做，用自动导入替代 |
| AAV-488 | WatchMode 入口不可用 | ✅ Done | Header 已传 onWatchSubmit，WalletButton 自定义渲染已提供入口 |
| AAV-641 | Watch mode 地址刷新后消失且无法重输 (中文 original) | ⛔ Canceled | 与 AAV-643 是同一 bug 的两份报告（641 早 11 分钟创建，描述几乎逐字相同），fix 实际在 [AAV-643](https://linear.app/aaveapy/issue/AAV-643) 上完成（commit `9198da23` + `28618fee`）。Linear MCP 缺 `duplicateOf` 字段，改用 Canceled state；closing comment 引用 AAV-643 + AAV-679。 |
| AAV-643 | Watch Mode 重复提交地址 positions 不刷新 | ✅ Done | 2026-06-08, fix 实际在 AAV-643 上完成（commit `9198da23` + `28618fee`）。**2026-06-08 follow-up (AAV-697, AAV-679) 已完成**：A. `useUserPositions` 死代码已删除 (AAV-697)，生产 urql 主路径通过 `refetchEvent` 抽象 (`src/lib/userData/refetchEvent.ts`) + `useUserPositionsSdk` 中订阅 `subscribeRefetch` 并调用 `v3Client.refreshQueryWhere` / `v4Client.refreshQueryWhere` 实现统一刷新（F5 / Refresh 按钮 / Watch Mode re-submit），B. `useWatchModeConnect` 在 re-entry 分支 `bumpRefetch('watch-reentry')`。详见 ADR-0015。 |
| AAV-679 | urql 主路径未刷新（AAV-643 follow-up） | ✅ Done (S4) | S1-S3 通过 `refetchEvent` 抽象统一刷新信号源；S4 集成 urql refetch：`useUserPositionsSdk` 订阅 `subscribeRefetch` 后调用 V3/V4 AaveClient 的 `refreshQueryWhere`，传入 `UserSuppliesQuery` / `UserBorrowsQuery` 文档 + 谓词匹配当前 `address`。V3 文档通过 Vite alias `@aave/react-v3/graphql-queries` 解决嵌套 `node_modules` 路径。E2E 跟踪 → [AAV-699](https://linear.app/aaveapy/issue/AAV-699)。 |
| AAV-697 | 删除死代码 useUserPositions | ✅ Done | `src/hooks/useUserPositions.ts` + `useUserPositions.test.ts` 已删除；`WalletLoadState` type 改由 `useUserPositionsSdk` 导出（被 `ReservesTable.tsx` / `PortfolioPanel.tsx` / `useWalletAutoImport.ts` 等引用）。Archive 索引同步移除该文件。 |
| AAV-597 | PRD: classifyRpcError 集成 RPC rotation | ✅ Done | ADR-0004 follow-up, per-URL error-type metrics |
| AAV-598 | TDD: catch 路径集成测试 | ✅ Done | 3 个 catch path 测试 (network/contract/unknown) |
| AAV-599 | 实现: catch 块集成 + 删 TODO | ✅ Done | rpcResilience.ts catch 块调用 classifyRpcError |
| AAV-600 | 更新 ADR-0004 Consequences | ✅ Done | 反映集成完成 |
| deriveV3AssetsByChain | — | ✅ Done | 函数 + 测试已删除 |

## 关联文档

- `docs/archive/2026-06-02-reserveId-matching.md` — reserveId 匹配详细设计（已归档）
- `docs/archive/2026-06-02-wallet-merkl-portfolio-epic.md` — 完整 epic 里程碑（已归档）
- `docs/archive/2026-06-02-wallet-merkl-portfolio-plan.md` — 原始 plan（已归档）
- `CONTEXT.md` — 领域术语 + 教训 (LL1, LL2)
