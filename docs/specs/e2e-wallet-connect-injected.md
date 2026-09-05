# Spec: E2E 真实钱包连接测试（mock EIP-1193 injected connector）

> Status: ready-for-agent · Created: 2026-09-05 · Source: session 决策（用户确认开工）
>
> 背景：现有 wallet 家族 e2e（`wallet-reconnect-after-refresh` / `watch-resubmit-refresh`）只覆盖 watch mode 与"Connect 弹窗能打开"，**没有任何测试走过真正的 injected 钱包连接生命周期**。本 spec 新增一条全离线、确定性的 E2E 测试填补该空白。

## Problem Statement

进阶 DeFi 用户点击 Connect 连接钱包（MetaMask 等 injected 钱包）是产品最核心的入口链路，但目前该链路（RainbowKit 弹窗选择 → wagmi injected connector → 连接态 → 持久化 → 断开）没有任何自动化回归保障。现有 wallet 测试依赖 watch mode（查看地址），绕过了 connector connect 流程；且依赖真实 Aave API，只能在本地跑。

## Solution

通过 Playwright `addInitScript` 在页面脚本执行前注入一个 mock EIP-1193 provider（`window.ethereum`），让 wagmi 的 `injected()` connector 探测到"MetaMask 存在"，从而以确定性方式走完真实连接 UI 链路——无需浏览器扩展、无需油猴、无需真实网络。

## User Stories

1. As a 回归测试消费者, I want 一条覆盖 injected 钱包"连接 → 连接态 → 刷新重连 → 断开"完整生命周期的 E2E 测试, so that 对连接链路的改动（wagmi/RainbowKit 升级、WalletButton 重构）有机制性防回归。
2. As a CI 维护者, I want 该测试全离线且确定性（不 skip CI）, so that CI 能无条件守护连接链路而不引入 flaky。
3. As a 后续签名类测试的作者, I want mock EIP-1193 注入代码放在独立共享 helper, so that 未来需要测试签名/交易场景时可直接复用并扩展。
4. As a 开发者, I want 测试断言基于用户可见行为（按钮 aria-label、弹窗可见性）而非内部实现, so that 重构不破坏测试。

## Implementation Decisions

1. **注入 seam**：`page.addInitScript` 在任何页面脚本前用 `Object.defineProperty(window, 'ethereum', …)` 定义 mock EIP-1193 provider。每次 navigation 都会重新执行 → mock 必须幂等（先检查 `window.ethereum` 是否已定义）。
2. **Mock provider 能力集**（对齐 wagmi 3.6.16 injected connector 探测逻辑，蓝本为 `watchModeConnector.ts` 的 provider）：
   - **EIP-6963 发现**（实施期发现的关键机制）：仅定义 `window.ethereum` 不够——RainbowKit 2.x 弹窗列表依赖 EIP-6963 多钱包发现。mock 必须监听 `eip6963:requestProvider` 并广播 `eip6963:announceProvider`（`info.rdns: 'io.metamask'` + provider）
   - **授权状态机**（mock 内部，`sessionStorage` 持久化——同一标签页 reload 仍在、新上下文重置，对应真实钱包的按站点授权）：`eth_accounts` 在授权前返回 `[]`（这决定 wagmi 冷启动 `isAuthorized` 为 false、不自动连接）；`eth_requestAccounts` / `wallet_requestPermissions` 授权并返回 checksum 合法的 `WATCH_ADDRESS`（wagmi 用 `getAddress()` 校验）
   - `eth_chainId` → `'0x1'`（hex）；`net_version` → `'1'`
   - `wallet_revokePermissions` → 清除授权并返回 null（disconnect 路径调用）
   - `wallet_switchEthereumChain` / `wallet_addEthereumChain` → 返回 null
   - `isMetaMask: true`（让探测识别为 MetaMask 品牌）
   - `on` / `removeListener` 事件 API（EIP-1193 事件契约）
3. **GraphQL 拦截**：新 spec 内联自己的 `mockAaveGraphql`（覆盖 api.aave.com / api.staging.aave.com / api.v3.aave.com），与现有两个 spec 的内联模式一致。**不**顺带抽共享 helper（T5 遗留单独 ticket）。
4. **共享 helper 文件**：新建 `e2e/eip1193-mock.ts` 导出注入函数（仿 `test-wallets.ts` 先例），spec 引用；返回注册 Promise 供 await 保证时序。
5. **CI 策略**：不加 `test.skip(!!process.env.CI)`——与现有 wallet 家族的唯一差异点，也是本测试的核心价值。测试注册到 desktop（chromium）project；mobile project 经 `testIgnore` 排除（理由见 Revision Record R2）。
6. **断言锚点**（均为既有 UI 契约）：
   - 未连接：`Connect wallet` 按钮可见
   - RainbowKit 弹窗：heading 匹配 `/Connect Wallet|Connect a Wallet/i`；injected 选项用宽松 regex `/MetaMask|Browser Wallet|Injected/i`（显示名运行时取决于探测结果）
   - 已连接：头部按钮 aria-label `Wallet 0x…`（`WalletButton.tsx` 的 aria-label 契约，区别于 watch mode 的 `Viewing 0x…`）
   - 断开：回到 `Connect wallet` 可见，且 `Wallet 0x…` 不可见
   - mock 幂等：生命周期测试全程监听 `pageerror`，reload 重复注入不得抛错

## Testing Decisions

- **只测外部行为**：按钮可见性/aria-label/弹窗交互/localStorage 持久化结果，不断言 wagmi 内部状态结构。
- **测试模块**：仅新增 1 个 E2E spec + 1 个共享 mock helper；不改动任何生产代码。
- **先例**：`wallet-reconnect-after-refresh.spec.ts`（wallet 控件等待、双布局容错、GraphQL 拦截）、`docs/conventions/wallet-js-injection-testing.md`（注入时机、re-injection 守卫、竞态等待模式）。
- **验证顺序**：本地跑通新 spec（desktop project，含 `--repeat-each` 稳定性检查）→ 4 项 CI gate（lint/test/build/tsc，确认未破坏现有代码）→ commit。

## Scenario Matrix

| # | 场景 | 输入状态 | 消费者A 期望（UI: WalletButton/RainbowKit） | 消费者B 期望（wagmi store/injected connector） | 必须一致的原因 |
|---|------|---------|---------------------------------------------|----------------------------------------------|----------------|
| 1 | 无 provider 冷启动 | 不注入 `window.ethereum` | Connect 按钮可见、弹窗可开（已有 spec 覆盖，矩阵标注即可） | injected 不可授权，store 无 connected 态 | 无钱包环境是真实用户常态 |
| 2 | 有 provider 未授权冷启动 | 注入 mock，无已授权会话 | 页面加载后仍显示 Connect（不自动连接） | `eth_accounts` 为空 → `isAuthorized()` false，不触发自动重连 | 已授权与否决定冷启动行为 |
| 3 | UI 首次连接 | 点击 Connect → 弹窗选 injected | 头部按钮 aria-label 变为 `Wallet 0x…` | `wagmi.store` 持久化 injected 连接会话 | UI 态与持久化态必须同步 |
| 4 | 连接后刷新重连 | mock 仍注入（addInitScript 每次导航重跑），reload | 头部仍显示 `Wallet 0x…`，无 Connect | 自动重连走 `eth_accounts`（授权由 mock 的 sessionStorage 会话维持，对应真实钱包的按站点授权） | 重连不依赖用户再授权 |
| 5 | mock 幂等重复注入 | reload 时 init script 再次执行 | 无异常、无 React 崩溃（`pageerror` 断言为空） | `window.ethereum` 只定义一次，第二次执行跳过 | 重复 defineProperty 会抛 TypeError 破坏页面 |
| 6 | Disconnect | 点击断开 | Connect 按钮回归，`Wallet 0x…` 不可见 | store 连接态清除；`wallet_revokePermissions` 被调用并清除 mock 授权 | 断开必须同时清 UI 与持久化 |
| 7 | 连接后持仓查询不挂死 | 连接触发 Aave GraphQL 请求 | UI 不因网络 hang 卡死 | 请求被 route fulfill（`{ data: {} }`），不发真实网络 | 测试确定性依赖离线 mock |

矩阵行 2/3/4/5/6/7 = 本 spec 的测试用例；行 1 已由 `wallet-reconnect-after-refresh.spec.ts` 覆盖，不重复实现。

## Out of Scope

- 签名/交易流程测试（`personal_sign`、`wallet_sendTransaction`）——当前产品无此链路
- 持仓导入数据正确性（watch mode 测试已覆盖；连接态导入属后续需求）
- `mockAaveGraphql` 抽共享 helper（T5 遗留，单独 ticket）
- WalletConnect / 其他 connector 的连接测试
- 真实钱包扩展（CDP / Chrome extension）方案

## Further Notes

- RainbowKit 2.2.11 对 wagmi 3.6.16 的 peer range 不匹配是既有事实，本测试恰好能守护这对组合在 injected 路径上的实际行为。
- 弹窗内 injected 选项显示名（MetaMask vs Browser Wallet）取决于运行时探测，断言用宽松 regex，不锚定具体文案。

## Revision Record

- **R1（2026-09-05，实施期）**：仅定义 `window.ethereum` 时 RainbowKit 弹窗列表为空；wallet 列表实际依赖 EIP-6963 发现。已补入 Decision 2。
- **R2（2026-09-05，实施期）**：RainbowKit 移动端弹窗（`MobileOptions`）只渲染经其 `wallets` prop 注册的钱包，而应用未配置该 prop → **移动端连接弹窗对真实用户同样为空**（既有产品行为，非本测试引入）。生命周期测试因此 desktop-only（经 `playwright.config.ts` 的 mobile-chromium `testIgnore`，沿用 reserves-table-simulation 先例），待产品决策（如配置 `wallets` prop）后可移除该排除项。此发现已口头报告用户，是否开 Linear issue 待定。
