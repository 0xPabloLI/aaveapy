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
- **AAV-643 fix（2026-06-08，状态：PARTIAL）**: Watch Mode 已激活时用户再提交一次地址（页面刷新后 wagmi 从 localStorage 自动恢复 connector 是典型触发场景）需要主动 invalidate positions cache。`setWatchAddress` 同地址 no-op，wagmi 不会发 'change' 事件，否则 positions 静默卡住。详见 [`useWatchModeConnect.ts`](../../src/hooks/useWatchModeConnect.ts) 注释与 `useWatchModeConnect.test.ts` 回归测试。
  - **已修（React Query fallback 路径）**：`useWatchModeConnect` 在 isReentry 路径上 `queryClient.invalidateQueries({ queryKey: ['user-positions', address] })` + 回归测试覆盖同地址/异地址。
  - **未修（生产主路径）⚠**：上一步 invalidate 的 key `['user-positions', address]` 来自 [`useUserPositions.ts:82`](../../src/hooks/useUserPositions.ts#L82)，但 `useUserPositions` hook 函数本身在 `src/pages/Index.tsx:292` 等生产路径**没有任何 import**（只有 `WalletLoadState` 这个 type 被引用），是死代码。生产真实数据源是 [`useUserPositionsSdk`](../../src/hooks/useUserPositionsSdk.ts#L179)，走 `@aave/react` / `@aave/react-v3` 的 urql hooks（`useUserSupplies/Borrows`），不走 React Query；RQ 上挂着的 key 实际是 `['user-positions-onchain-fallback', address, v3SdkFailed, v4SdkFailed]`（仅在 SDK 失败时启用，[`useUserPositionsSdk.ts:224`](../../src/hooks/useUserPositionsSdk.ts#L224)）。
  - **影响**：re-submit 同一地址时，React Query 路径会 refetch（但没有 observer，cache 写了没人读），urql 主路径 cache **完全不动**，所以用户实际看到的 positions 仍然 stale。回归测试通过了（mock 了 RQ）但生产行为未修复。
  - **Follow-up**：已开 [AAV-679](https://linear.app/aaveapy/issue/AAV-679) 跟踪 urql 生产路径。三个方向（urql refetch / key 依赖 / `location.reload()` 兜底）见 AAV-679 描述。Linear MCP 工具集缺少 `list_issue_statuses`，AAV-643 的状态机切换需要 reviewer 在 Linear UI 上点 Done；本 session 内的可关工作以 closing comment 形式落档。

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
| `src/hooks/useUserPositions.ts` | Onchain fallback hook |
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
| AAV-643 | Watch Mode 重复提交地址 positions 不刷新 | ⚠ Closed PARTIAL | 2026-06-08, RQ fallback 路径已修（`useWatchModeConnect` isReentry 分支 invalidate `['user-positions', address]`），**生产主路径未修** — `useUserPositions` 是死代码，生产走 `useUserPositionsSdk`/urql，cache key 不匹配；状态机已发 closing comment，**待 reviewer 在 Linear UI 上点 Done**（MCP 工具缺 `list_states`）；follow-up → [AAV-679](https://linear.app/aaveapy/issue/AAV-679) (推荐 c. `location.reload()` 兜底) |
| AAV-489 | 审查测试 fixture 真实性 | ✅ Done | |
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
