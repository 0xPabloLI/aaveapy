# Spec: FCP 优化 — 非首屏 chunk 延迟加载

> Round 1 (commit 9c4fc66b) + Round 2 (本 spec)。Round 1 完成了 AaveProviders lazy / modulePreload 白名单 / vendor-blockchain 拆分,但**未达成核心目标**:entry 仍静态引入 vendor-blockchain,且 `fallback=null` 阻塞整个 UI 首绘。Round 2 修复这两点。

## Problem Statement

aaveapy.com 的 First Contentful Paint (FCP) 当前为 **3,336ms**,Google 标准为 < 1.8s (好) / 1.8–3.0s (需改进) / > 3.0s (差)。目标是优化到 2.5s 以内。

根因(Round 2 修正后):`App.tsx` 同步导入 `wagmiConfig`(`@/lib/wagmi/config`)并同步渲染 `WagmiProvider` + `RainbowKitProvider`,导致 viem/wagmi/ox/rainbowkit(**~417 KB gzip 的 `vendor-blockchain` chunk**)仍在 entry 的静态依赖图上,首绘前必须下载+解析+执行。同时现有 `Suspense fallback={null}` 包裹整个 UI 子树,使首绘还要串行等待 AaveProviders chunk——违反了 Round 1 spec 场景矩阵中"chunk 加载中主页面正常渲染"的承诺。

构建产物实测(Round 1 之后):entry chunk `index-*.js` 存在 `from"./vendor-blockchain-*.js"` 静态 import;首屏 chunk 集(entry 38KB + 白名单 251KB + vendor-blockchain 417KB)≈ **707 KB gzip**,大于优化前基线 510 KB,且 vendor-blockchain 被排除出 modulepreload 后从并行下载退化为 entry 执行后串行发现。

## Solution

将钱包层(WagmiProvider + RainbowKitProvider)整体下沉到 lazy 边界,UI 壳(ThemeProvider / QueryClientProvider / TooltipProvider / Toasters)保持同步渲染,首绘路径只包含真正首屏需要的代码:

1. **WalletProviders lazy chunk**:新建 provider 组件(wagmi + rainbowkit + styles.css),在 App 中 lazy 加载并包裹路由子树,fallback 用 `LoadingState`(非 null,避免中间白屏)。
2. **AaveProviders 保持嵌套 lazy**:为未来 context-shim 保留 seam,内层 fallback 同样用 `LoadingState`。
3. **modulepreload 白名单语义修正**:白名单 = "内容渲染前必需的 chunk"(提前下载、延后执行),加入 vendor-blockchain / vendor-aave / WalletProviders / AaveProviders——只下载不执行,不阻塞首绘,但让内容更早到达。
4. **build-time 结果性守卫**:新增 Vite plugin 遍历 entry chunk 的静态 import 闭包,发现 vendor-blockchain / vendor-aave 可达即 fail build。配置级断言(守卫测试)已证明不足以防止此类回归。

## User Stories

1. 作为访客,我希望页面在 2.5s 内显示首批内容(LoadingState),这样我不用面对白屏等待
2. 作为访客,我希望在钱包未连接时就能浏览 reserves 表格和 Top Opportunities,这样我可以快速查看利率
3. 作为访客,我希望钱包/SDK chunk 在后台下载时不阻塞界面绘制,这样首屏体验是渐进的而非全有或全无
4. 作为访客,我希望 chunk 加载失败时看到明确的错误界面并可重试,而不是白屏
5. 作为连接钱包的用户,我希望连接时 SDK 已就绪,这样操作不额外等待
6. 作为 Watch mode 用户,我希望输入地址后仓位数据正常加载,这样不用装钱包也能查仓位
7. 作为开发者,我希望 build 在 entry 重新引入重型依赖时直接失败,这样回归在 CI 阶段被拦截而非上线后靠测速发现
8. 作为开发者,我希望守卫测试与实际加载语义一致,这样测试绿就真的代表 FCP 路径干净

## Implementation Decisions

### Round 1 决策(保留)

- **ID-1**: AaveProviders lazy 加载,`Suspense` 包裹,`SdkErrorBoundary` 兜底
- **ID-2/ID-5**: `build.modulePreload: false`,自定义 `selectiveModulePreloadPlugin` 按白名单注入 modulepreload
- **ID-3**: manualChunks 将 viem/wagmi/@wagmi/rainbowkit 归入 `vendor-blockchain`
- **ID-4**: Cloudflare Dashboard 操作(prefetch_preload / html minify)——运维项,未验证执行状态

### Round 2 决策(本次)

- **ID-6 钱包层下移**:新建 `WalletProviders` 组件(WagmiProvider + RainbowKitProvider + rainbowkit styles.css),App 中 `lazy()` 加载,包裹 BrowserRouter/Routes 子树。App.tsx 同步层只保留无钱包依赖的 provider(ThemeProvider / QueryClientProvider / TooltipProvider / Toaster / Sonner / SdkErrorBoundary)。`Analytics` / `SpeedInsights` 移出懒层。前提事实(已验证):所有 wagmi/rainbowkit/SDK 消费者(WalletButton、useWallet、useWatchModeConnect、SDK hooks)都只在 lazy 路由子树内使用;Header 仅由 Index 渲染。
- **ID-7 fallback 语义**:两层 lazy 边界(钱包层、SDK 层)的 fallback 统一用 `LoadingState`。`null` fallback 会在两阶段之间产生白屏窗口;同组件 fallback 保证视觉连续。
- **ID-8 modulepreload 白名单扩充**:加入 `vendor-blockchain`、`vendor-aave`、`WalletProviders`、`AaveProviders` 前缀。语义从"仅首屏"改为"内容渲染前必需"(下载提前、执行延后,modulepreload 不执行代码,不影响 FCP)。这些 chunk 每次页面加载都会被 dynamic import,提前下载严格更优。
- **ID-9 build-time 结果性守卫**:新增 `assertFirstPaintChunksPlugin`:在 `generateBundle` 中定位 entry chunk,沿**静态** `imports` 边传递遍历闭包,若 `vendor-blockchain` / `vendor-aave` chunk 可达则 throw 使 build 失败。dynamicImports 不算(合法的 lazy 路径)。依赖 rolldown bundle 对象与 rollup 的 `imports`/`dynamicImports` 字段兼容(实现时以实际 build 验证)。
- **ID-10 守卫测试语义更新**:现有断言"白名单不含 vendor-blockchain/vendor-aave"随 ID-8 失效,改为:App.tsx 不得同步 import wagmi / @rainbow-me/rainbowkit / @/lib/wagmi/config(含 side-effect import 形态);白名单必须包含 wallet chunks(与 ID-9 互补:配置形态 + 加载结果双保险)。
- **ID-11 manualChunks → 原生 advancedChunks(实施中发现的根因级问题)**:rolldown 的 manualChunks 模拟会把共享模块拼接进不相关 chunk——实测 `clsx`、`@tanstack/query-core`、react-dom 片段、react-remove-scroll 等被粘进 vendor-blockchain(sourcemap 确认),导致任何 `cn()` 调用点(含全部同步首屏 UI)静态可达重型 chunk,**仅改 App.tsx 无法修复**。迁移到 rolldown 原生 `advancedChunks` 正则分组后分区正确。配套:删除 manualChunks 函数;clsx 运行时内联进 `cn()`(type-only import 保持类型单一来源)作为防回归纵深。

### 架构决策记录(Grill 结论)

- **方案选型**:lazy 钱包层(方案 A)vs context-shim 重构(方案 B)。选 A:UI 即时渲染带来的收益不足以抵消 B 的改动面(useWallet 及 6+ 消费者、WalletButton 降级态、context 热切换边界)。代价:纯 landing 页内容也需等 wallet chunk——但 TokenIcon/utils 等公共模块静态引 viem,多数内容页的 lazy 图无论如何都会拉 vendor-blockchain,实际增量成本很小。
- **AaveProviders 保持嵌套 lazy 而非合并**:合并会让 SDK chunk 与钱包层成为同一 chunk,未来若做 SDK context-shim 失去独立 seam;当前两者都加入 preload,时间成本相同。

## Testing Decisions

- **测试 seam**(按高度):
  1. **build 产物图**:`assertFirstPaintChunksPlugin` 在 build 阶段断言 entry 静态闭包排除重型 chunk(最高 seam,结果性)。
  2. **源码级守卫**:`architecture-guard.test.ts` 正则断言 App.tsx 的 import 形态(既有 seam,先 red 后 green)。
  3. **运行时**:Playwright(dev server + preview build)验证 LoadingState → dashboard 渐进渲染、无白屏、无 console error。
- 好的测试只断言外部可见行为:entry 闭包内容、App.tsx 对外 import 形态、运行时渲染序列;不断言内部实现细节(如 Suspense 嵌套顺序)。
- Prior art:`src/test/architecture-guard.test.ts` 的 FCP describe 块(Round 1 已建立源码断言模式)。

## Scenario & Risk Verification Matrix

> 按 `docs/conventions/scenario-enumeration-checklist.md` 穷举;数值精度/跨系统键/多实体/DeFi 专项类不涉及本改动。矩阵行 = TDD 测试用例。

| # | 场景 | 输入状态 | 期望 | 风险维度 |
|---|------|---------|------|---------|
| S1 | 首访,钱包未连接,网络正常 | 无 address | LoadingState 在 entry+白名单(~290KB)下载执行后立即绘制;vendor-blockchain/vendor-aave 并行下载延后执行;dashboard 随后渲染;SDK hooks `enabled: false` | 状态转换 |
| S2 | WalletProviders chunk 加载中 | 边界 suspend | 显示 LoadingState,无白屏 | 状态转换 |
| S3 | AaveProviders chunk 加载中(钱包层已就绪) | 内层边界 suspend | 继续显示 LoadingState(同组件,无闪烁) | 状态转换 |
| S4 | WalletProviders chunk 加载失败 | 网络错误 | SdkErrorBoundary 错误 UI,retry 后恢复 | 失败/降级 |
| S5 | AaveProviders chunk 加载失败 | 网络错误 | 同 S4(外层 boundary 捕获) | 失败/降级 |
| S6 | 钱包连接后 | address 存在 | SDK hooks 正常执行(契约:Index 子树始终渲染于 wallet context 内) | 跨 Step 契约 |
| S7 | Watch mode 输入地址 | watch address | 同 S6;useWatchModeConnect 在 wallet context 内可用 | 跨 Step 契约 |
| S8 | dev server HMR | 懒边界热更 | lazy import 正常热更新,不 crash | CI/CD |
| S9 | build:entry 静态闭包可达性 | npm run build | 闭包含 vendor-blockchain/vendor-aave → build fail(fail-fast) | CI/CD |
| S10 | build:白名单注入 | npm run build | index.html modulepreload 包含 wallet chunks;下载并行,不执行 | CI/CD |
| S11 | 路由 chunk 先于 wallet chunk 就绪 | 并发下载 | 无 hooks crash——所有 wagmi 消费者在边界内 | 跨 Step 契约 |
| S12 | 守卫测试与配置同步 | CI | 更新后的源码断言(无 wagmi 同步 import)+ 白名单必须含 wallet chunks 全绿 | CI/CD |

## Out of Scope

- Context-shim 重构(方案 B)——钱包状态自有 context 默认态、UI 完全不等 chunk;留待后续独立 spec
- AaveProvider 层 context-shim——SDK hooks 的 enabled 前提重构
- Cloudflare Dashboard 配置(ID-4)——运维操作
- vendor-aave chunk 内部拆分——@aave/react 内部结构不可控
- `verify-preview.mjs`(生产冒烟脚本)——非本次引入

## Further Notes

- 基线 FCP:3,336ms。目标:≤ 2,500ms。Round 1 后未部署未实测,FCP 现状未知。
- 产物量化(Round 2 完成):首屏路径(entry + 白名单)**~260 KB gzip**(Round 1 build 实测 707 KB,原始基线 510 KB);内容阶段 4 个 chunk(~646 KB)经 modulepreload t0 并行下载、延后执行。
- 运行时验证(preview build + staging API,1.6 Mbps 节流):LoadingState 骨架 ~150ms 首绘 → 数据内容 ~3.6s;钱包上下文正常;阻断 wallet/SDK chunk 请求 → SdkErrorBoundary + Retry 降级成立;dev:staging 下 20 行数据 + 无 console error。S9 负路径已验证:守卫插件在修复前的构建上两次真实 fail 并打印 import 链。
- S7(Watch mode)依赖钱包上下文架构已验证("View address" 入口在 context 内渲染);提交行为由既有 e2e 覆盖。
- 部署验证(待执行):push → staging → 复测 FCP,对比 3,336ms 基线。
- 遗留:Round 1 的守卫测试断言"白名单不含 blockchain"与本 spec ID-8 冲突,已在同一 commit 内按 ID-10 更新(先改测试 = red)。
- 已知无害噪音:本地 preview 下 `/_vercel/insights|speed-insights/script.js` 404(仅 Vercel 环境存在)。
