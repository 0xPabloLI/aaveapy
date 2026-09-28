# Spec: 修复移动端 Connect 弹窗为空（RainbowKit wallets 注入）

> Status: ready-for-agent · Created: 2026-09-25 · Source: [AAV-1282](https://linear.app/aaveapy/issue/AAV-1282)（High / Todo，roadmap frontier）
>
> 正文是创建时的规格（write-once，永不改写）。实施记录与交付证据沉淀在 Linear issue 评论。

## Problem Statement

移动端（mobile-chromium / 真机）点击 Connect 打开 RainbowKit 弹窗后钱包列表恒为空，injected 钱包无法连接。根因（`e2e-wallet-connect-injected.md` R2 + RainbowKit dist 实证）：

- **MobileOptions** 渲染 `useWalletConnectors().filter(w => w.isRainbowKitConnector).filter(w => w.ready)` —— 只认 `connectorsForWallets` 创建的、带 `rkDetails.isRainbowKitConnector` 标记的 connector。
- **DesktopOptions** 走 EIP-6963 merge 路径（`isEIP6963Connector` 排除 RK connector，按 rdns 去重），普通 wagmi connector 也能显示 —— 桌面端因此一直正常。
- 应用 wagmi config（`src/lib/wagmi/config.ts`）用裸 `injected()` / `walletConnect()`，不带 `rkDetails` → 移动端列表恒空。

**关键 API 修正**：票面初始方向写的是"给 RainbowKitProvider 配 wallets prop"，但该 prop 在 RainbowKit 2.0 已移除（2.2.11 的 `RainbowKitProviderProps` 无 `wallets` 字段，已实证）。2.x 的正道是**用 `connectorsForWallets` 创建 wagmi connectors**——与 roadmap 审查结论（"在 WalletProviders 图内动态配置 wallets，不入首屏 entry bundle"）同一意图。

## Solution

`src/lib/wagmi/config.ts`：connectors 从 `[injected(), walletConnect({ projectId }), watchModeConnector()]` 改为 `connectorsForWallets` 产物 + `watchModeConnector()`。wallet 工厂来自**本地模块 `src/lib/wagmi/rainbowKitWallets.ts`**（不用 `@rainbow-me/rainbowkit/wallets` barrel，原因见 Revision Record R1）：

```ts
const walletModalConnectors = connectorsForWallets(
  [{ groupName: 'Recommended', wallets: [injectedWallet, walletConnectWallet] }],
  { projectId: WALLETCONNECT_PROJECT_ID, appName: 'AaveAPY' },
);
// createConfig({ connectors: [...walletModalConnectors, watchModeConnector()] })
```

- `injectedWallet`（id `injected`，显示名 Browser Wallet）↔ 现有 `injected()`；`walletConnectWallet` ↔ 现有 `walletConnect()`。底层仍是同一批 wagmi connector 工厂，`rkDetails` 是纯标记叠加。
- 两个工厂均无 `installed` 字段 → `ready = installed ?? true`，移动端恒显示（与桌面 EIP-6963 条目 `ready: true` 对齐）。
- `walletConnectWallet` 会额外产出一个 `isWalletConnectModalConnector: true` 的孪生 connector，弹窗列表自动过滤，仅用于 WC modal 路径。
- `playwright.config.ts`：移除 mobile-chromium 对 `wallet-connect-injected.spec.ts` 的 `testIgnore`（验收 2；spec 双端跑通即守卫）。

## Implementation Decisions

1. **wallets 范围 = 票面的 injected + walletConnect**，不引入品牌钱包条目（metaMaskWallet 等）——保持与现状弹窗内容 1:1 对齐，修 bug 不改钱包目录。
2. **`connectorsForWallets` 放在 `config.ts`**（provider 层调用方不变）：config.ts 在 lazy 图内，`@rainbow-me` 按 vite `advancedChunks` 规则全部落入 `vendor-blockchain`；`assertFirstPaintChunksPlugin` 在 entry 静态可达时 fail-loud。FCP 不变量由机制守卫，无需新的运行时代码。
3. **`WALLETCONNECT_PROJECT_ID` 占位值保持不动**：真实 projectId 须由用户从 WalletConnect Cloud 获取，不用猜测值填充（仓库偏好）。WC 连接不可用是既有事实，见 Known Limitations。
4. **`appName` 用品牌名 `AaveAPY`**（AGENTS.md 品牌规则），仅进 WC metadata。
5. watchModeConnector 保持普通 connector：两个弹窗都不渲染无 `rkDetails` 且非 EIP-6963 的 connector（与现状一致），watch mode 走自己的 UI 路径（`useWatchModeConnect` 按 `id === 'watchMode'` 查找）。
6. wagmi `reconnect` 不按持久化 uid 匹配，而是遍历 `config.connectors` 逐个 `getProvider()` + `isAuthorized()` 尝试重连（`@wagmi/core/actions/reconnect.js` 实证）→ connector 数组变更无会话迁移风险。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `src/lib/wagmi/config.ts` | connectors 换成 `connectorsForWallets` 产物 | Medium | 核心钱包路径。底层 connector 与现状同源（injected/walletConnect），rkDetails 纯叠加；桌面列表、重连、watch mode、断开均有自动化证据（见矩阵） |
| `src/lib/wagmi/rainbowKitWallets.ts` | 新建本地 wallet 工厂（RK 2.2.11 dist 语义镜像） | Medium | 只依赖公开导出（`connectorsForWallets`/`Wallet` 类型/wagmi connectors）；镜像逻辑对照 dist 源码逐行核对；config.test rkDetails 契约守护其产出 |
| `playwright.config.ts` | 移除一条 `testIgnore` | Low | 纯解禁，无生产代码影响；e2e 双端跑通即验证 |
| `src/lib/wagmi/config.test.ts` | 追加 rkDetails 契约断言 | Low | 纯追加测试 |

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| 1 | 移动端首次连接（mock MetaMask provider） | 弹窗列出 Browser Wallet（+WalletConnect）；点 Browser Wallet → 头部 `Wallet 0x…` | High（核心修复） | automated test（e2e mobile project 生命周期用例，先 red 后 green） | — |
| 2 | 移动端连接后刷新重连 | reload 后自动恢复 `Wallet 0x…`，无需再授权 | High | 同上 e2e reload 段 | wagmi reconnect 逐 connector isAuthorized |
| 3 | 移动端断开 | 回到 `Connect wallet`，`Wallet 0x…` 不可见 | Medium | 同上 e2e disconnect 段 | — |
| 4 | 桌面端弹窗不回归、条目不重复 | injected 条目可见且唯一；行为与改动前等价 | Medium | automated test（desktop e2e 既有断言）+ static check（`isEIP6963Connector` 排除 RK connector，无重复源） | — |
| 5 | watch mode 全链路 | setWatchAddress / connect / 重连不受 connector 列表变化影响 | Medium | automated test（既有 watch-mode e2e）+ unit（config.test 断言 watchMode id 存在） | — |
| 6 | 无 provider 冷启动（移动/桌面） | 不自动连接，显示断开态 | Low | automated test（e2e cold-start 用例，随 testIgnore 移除开始跑 mobile） | — |
| 7 | rkDetails 契约（生产 connector 不变量） | 弹窗可见 connector 均带 `rkDetails.isRainbowKitConnector: true`；watchMode 除外且有意为之 | Medium | automated test（config.test.ts，TDD red→green） | 架构级防回归：将来增删 connector 须显式处理该断言 |
| 8 | FCP 不回归 | 钱包代码（含本地 wallet 工厂与 `@rainbow-me` 模块）不进 entry chunk 静态图 | Medium | static/build check（`assertFirstPaintChunksPlugin` fail-loud + 架构守卫测试） | — |
| 9 | 既有持久化会话跨版本升级 | 旧 `wagmi.store` 会话不阻塞启动；reconnect 语义按 connector 而非 uid | Low | static evidence（reconnect 源码行为，Implementation Decision 6）+ e2e reload 场景 | 极端失配表现为一次手动重连，可自愈 |

## Known Limitations（不阻塞验收，交付记录须携带）

- `WALLETCONNECT_PROJECT_ID = 'aaveapy-wallet'` 是占位值：改动前 WC connector 存在于 config 但不出现在弹窗；改动后移动/桌面弹窗都会出现 WalletConnect 条目，点击后 WC relay 阶段会失败。修复需真实 projectId（用户侧决策），不影响本票 injected 验收。
- 无 provider 环境点击 Browser Wallet：wagmi injected connect 报错，弹窗显示错误态（与桌面改动前行为等价）。

## Out of Scope

- 真实 WalletConnect projectId 申请与 WC 链路测试
- 品牌钱包条目（MetaMask/Rainbow/Coinbase 等专属入口）与钱包目录重设计
- 签名/交易链路测试（产品无此链路）
- `mockAaveGraphql` 抽共享 helper（T5 遗留，独立 ticket）

## Tickets

- **T1（TDD）**：config.test.ts 追加 rkDetails 契约断言（red）→ config.ts 切换 `connectorsForWallets`（green）→ refactor 检查。
- **T2**：playwright.config.ts 移除 mobile `testIgnore`，`wallet-connect-injected.spec.ts` 双端跑通（矩阵 #1-#4、#6）。
- **T3**：验证门禁 4 项（lint/test/build/tsc，build 内含 FCP 守卫）→ commit。

## Revision Record

- **R1（2026-09-25，实施期）**：`@rainbow-me/rainbowkit/wallets` barrel 在本仓库不可用——barrel 内 `geminiWallet` 静态 `import { gemini } from 'wagmi/connectors'`，而 @wagmi/connectors 8.0.15（wagmi 3.6.16 所带）已无该导出；rolldown build 与 Vitest 双双硬失败（"Missing export"，已实测）。Solution 改为本地工厂模块 `src/lib/wagmi/rainbowKitWallets.ts`：对照 RK 2.2.11 dist 逐行镜像 `injectedWallet` / `walletConnectWallet`（含 provider 检测、WC 实例共享、node 环境 mock），只用主入口公开导出（`connectorsForWallets` + `Wallet` 类型，无 gemini 引用）。图标 data URI 沿用 RK 原版，视觉不变。
