# Handoff: Wallet + Merkl + Portfolio Import

## 决议

1. **连钱包 = 自动导入**（不需要 Import 按钮）
2. **不需要用户确认** — 永远静默 merge + toast（决议 #12）
3. **RainbowKit** 用于 wallet connection（决议 #11）
4. **链上仓位 inputMode = 'usd'**（USD 估值）
5. **Merge 冲突策略 = 替换（链上为准）**：同 token 同 side → 替换为链上值
6. **Undo 不可行**：时序问题，import 后用户又改了值，Undo 回到哪个状态？
7. **重新 import = 覆盖为链上值**
8. **Soft delete（方案 A+沉底）**：钱包同步仓位删除 → 原位变灰+自动沉底+点击行恢复（一步操作）；纯手动仓位删除 → 真删。EyeOff icon + "hidden" 标签
9. **Wallet Sync 按钮**：自定义 UI（RainbowKit 不提供），钱包已连时可见（未连时隐藏），放在地址旁，仅 icon（RefreshCw）无文字
10. **不做 PWA 自动 sync**：切回 tab 时不自动 sync，可加非侵入式提示（正式版考虑）
11. **0 仓位 vs SDK 失败必须区分**：0 仓位 = 确定性结果（绿色确认），SDK 失败 = 不确定性（橙色警告 + 重试）
12. **UI 文本全英文**：Connect / Disconnect / Restore / Hidden / Retry 等可见标签一律英文
13. **场景 9a 拆为 9a1 + 9a2**：9a1 = 空 Simulator + 0仓位（绿条）；9a2 = 已有手动仓位 + 0仓位（绿条 + 手动仓位保留）
14. **Hidden 灰行显示钱包标识**：soft delete 的灰行仍需显示🟢/🟡图标
15. **Resync 时 hidden 仓位 → 强制 unhidden**
16. **0 仓位提示 ~5s 后自动消失**
17. **SDK 失败提示持久显示**
18. **Wallet Sync ≠ Market Data Refresh**：两个不同概念，交叉触发（决议 #25）
19. **切回 tab / 刷新页面 = 同时更新两者**
20. **Sync 按钮状态设计规范**：idle / loading / has-update 遵循同一视觉规范
21. **Hidden 标识位置移到行末**：顺序 `[🟢/🟡 Wallet → EyeOff]`
22. ~~Sync 按钮具体状态规范~~：已被 #23 取代
23. **Sync has-update 视觉语言统一为 freshness dot**
24. **Manual 仓位列对齐**：不可见占位符 `w-3.5 h-3.5 shrink-0` + `aria-hidden`
25. **两个 Refresh 按钮保留，交叉触发**：各带独立 freshness dot，仅 icon 无文字
26. **Orphan 仓位可见但 simulate 灰掉**

## ReservesTable 准入标记设计决策

1. **行级 indicator**：不加 — 维持现状
2. **useCampaignAccess 与 whitelistMerklCampaignIds 联动**：静默覆盖 — 不修改用户手动勾选的 Set，计算激励值时强制 excluded
3. **提示形式**：灰显 + tooltip 顶部警告条
4. **代码接入点**：修改 `isMerklWhitelistBreakdownIncluded` — 加 `campaignAccessStatus` 参数

## Merge 语义

| 场景 | 语义 | 举例 |
|------|------|------|
| 同 token 同 side | **替换**为链上值 | 已有 USDC supply $2000 → import $5000 → 变 $5000 |
| 同 token 不同 side | 直接加缺失 side | 已有 USDC supply → import 含 USDC borrow → 加 borrow 行 |
| 全新 token | 直接加入 | 已有 USDC → import WETH → 加 WETH 行 |
| 链上没有但 Simulator 有 | 保留不动 | Simulator 有 DAI → 链上没有 → DAI 不变 |
| 找不到 reserveId | orphan：可见但 simulate 区域灰掉 | rETH 不在 reserves → 仓位可见，APY/奖励等灰 |

## 双值追踪模型

- `walletValue: number | null` — 钱包同步的链上值
- `currentValue: number` — Simulator 当前值
- `hidden: boolean` — soft delete 标记

三态视觉：🟢 synced（Wallet emerald）、🟡 modified（Wallet amber + dot）、⚪ manual（invisible placeholder `size-3.5`）

Minus 按钮条件逻辑：wallet 来源 → toggleHidden；manual 来源 → 真删 remove

## 11 个场景（全部验证通过 ✅）

场景 1-9b 全部 PASS（含 merge 逻辑、三态图标、soft delete 沉底+恢复、re-sync 覆盖、0仓位/SDK失败区分）。

## 已完成（按里程碑）

### M1: Watch Mode UI ✅
- `WatchAddressInput.tsx` + test
- `WalletButton.tsx` + test
- Header 集成
- watchModeConnector (wagmi v3 createConnector)

### M2: Portfolio Simulation Soft Delete ✅
- 双值追踪模型（walletValue / currentValue / hidden）
- Soft delete A+沉底（灰+沉底+EyeOff+点击恢复）
- 三态图标（🟢🟡⚪）
- Wallet Sync 按钮（仅 icon RefreshCw）
- 11 场景 Playwright 验证

### M3: ReservesTable 准入标记 ✅
- `isMerklWhitelistBreakdownIncluded` 加 `campaignAccessStatus` 第三参数 + 3 测试
- `IncentiveCalculationOptions` 加 `campaignAccessStatuses` 字段
- 全调用点更新（~22 处）：incentiveAggregation / rateSimulationCalculator / merklCampaigns / IncentiveTooltip
- IncentiveTooltip 警告条 UI：`hasIneligibleCampaigns` useMemo + 顶部警告条
- prop 透传链：ReservesTableTooltipOverlay → TopOpportunities → ReservesTable → **pages/Index.tsx**
- Index.tsx：`useCampaignAccess()` hook 调用 + `campaignAccessStatuses` 传给 `<ReservesTable>` + `<TopOpportunities>`
- 验证门全通过：tsc ✅ / test 2113 passed ✅ / build ✅

### M4: 旧 prototype 清理 ✅
- 删除 PortfolioImportModalProto.tsx + PortfolioImportProto.tsx + App.tsx 引用/路由

## 剩余待做（按优先级）

| # | Item | 依赖 | 备注 |
|---|------|------|------|
| 1 | **chainIdLookup.ts** — reserveId 回写反查表 + 单测 | M3 | 准入标记需要 chainId↔reserveId 映射 |
| 2 | **PortfolioImportModal** — 连钱包=自动导入，静默 merge + toast | M2 | 需 mergePositions / importPositions |
| 3 | **Merkl Rewards 展示区** — merklUserClient + UI | M1 | 需 Merkl SDK 用户奖励查询 |
| 4 | **SDK 首选路径** | M3 | 延后 |

## 关键文件索引

### 准入标记相关（M3）
- `src/hooks/useCampaignAccess.ts` (69行) — `getUserCampaignStatus()` + `useCampaignAccess()` hook
- `src/hooks/useCampaignAccess.test.ts` (61行) — 8 测试
- `src/lib/merklWhitelist.ts` — `isMerklWhitelistBreakdownIncluded(campaignId, whitelistSet, campaignAccessStatus)`
- `src/lib/merklWhitelist.test.ts` — 3 campaignAccessStatus 测试
- `src/lib/incentiveAggregation.ts` — `IncentiveCalculationOptions.campaignAccessStatuses`
- `src/lib/rateSimulationCalculator.ts` — 全签名+调用点已更新
- `src/lib/merklCampaigns.ts` — 签名+调用点+config 接口已更新
- `src/components/dashboard/IncentiveTooltip.tsx` — `hasIneligibleCampaigns` useMemo + 警告条
- `src/components/dashboard/ReservesTableTooltipOverlay.tsx` — `campaignAccessStatuses` prop + 透传
- `src/components/dashboard/TopOpportunities.tsx` — `campaignAccessStatuses` prop + 两处 IncentiveTooltip 透传
- `src/components/dashboard/ReservesTable.tsx` — `campaignAccessStatuses` prop + 两处 TooltipOverlay 透传
- `src/pages/Index.tsx` — `useCampaignAccess()` hook + prop 传递

### Portfolio 相关（M2）
- `src/types/portfolio.ts` — PortfolioPosition / PortfolioPositionResult / PortfolioSummary / PortfolioSnapshot / PortfolioState
- `src/hooks/usePortfolioSimulation.ts` — addPosition / removePosition / updateAmount / updateInputMode
- `src/lib/portfolioCalculator.ts`
- `src/components/dashboard/PortfolioPanel.tsx` / `PortfolioTokenRow.tsx`

### Watch Mode 相关（M1）
- `src/components/dashboard/WatchAddressInput.tsx` + test
- `src/components/dashboard/WalletButton.tsx` + test
- `src/components/dashboard/Header.tsx`

### 类型
- `src/types/aave.ts` — CampaignAccessEntry / CampaignAccessPayload / CampaignAccessStatus (`'allowed' | 'whitelist-blocked' | 'blacklisted'`)

## 关键约束

- `reserveId` 是 required canonical identity，不加 composite-key fallback
- `// Desktop` 注释不能删除（6 个 visual-gap 测试依赖）
- 组件测试需要 `// @vitest-environment happy-dom` pragma
- 前端不能硬编码私人 RPC key
- 前后端不抽共享包
- Hidden 仓位样式：`opacity-40 border-border/20 bg-muted/5` + `line-through`
- Wallet Sync 按钮：仅 icon（RefreshCw）无文字

## 依赖状态

- wagmi / viem / rainbowkit **已安装** ✅
- 项目：React + TypeScript + Vite + npm

## Prototype 文件

- `src/components/prototype/PortfolioMergeProto.tsx` — 核心 prototype（merge 策略 + 三态 + soft delete + Sync 按钮）
- `src/pages/PortfolioMergeProto.tsx` — 场景演示页面
- `src/components/prototype/PrototypeSwitcher.tsx` — 浮动切换 bar
- **访问 URL**：`http://localhost:8080/prototype/portfolio-merge?scenario=1` （scenario 参数 1-9b）

## 主文档

- `docs/plans/linear-issues/aav_epic_wallet_merkl_portfolio_plan.md` (1082行) — 完整 plan
- `docs/design/frontend-interaction-guardrails.md` (L292-323) — Merkl whitelist-only campaigns 行为规则
