# Tickets: FCP 优化 — 非首屏 chunk 延迟加载（已归档）

> AAV-1279 Round 2 的 tracer-bullet tickets,全部完成。规范行为见 `docs/specs/fcp-optimization.md`。

---

# 01 — 钱包层下移 lazy 边界(ID-6/ID-7)

**What to build:** 访客打开页面时,首绘不再等待 wagmi/rainbowkit/SDK 代码:新建 WalletProviders 组件(WagmiProvider + RainbowKitProvider + rainbowkit styles),在 App 中 lazy 加载并包裹路由子树;两层 lazy 边界(钱包层、AaveProviders)fallback 统一用 LoadingState,消除 null fallback 造成的白屏窗口。钱包功能(连接、Watch mode、SDK hooks)行为不变。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] S12a(red→green):守卫测试断言 App.tsx 不同步 import wagmi / @rainbow-me/rainbowkit / @/lib/wagmi/config
- [ ] S2:WalletProviders chunk 加载中显示 LoadingState,无白屏
- [ ] S3:AaveProviders chunk 加载中继续显示 LoadingState(同组件,无闪烁)
- [ ] S6/S7:钱包连接与 Watch mode 行为不变(消费者仍在 wallet context 内)
- [ ] S8:dev server HMR 正常

---

# 02 — modulepreload 白名单扩充 + build 闭包守卫(ID-8/ID-9/ID-10)

**What to build:** build 阶段自动保证首绘路径干净:modulepreload 白名单加入 wallet chunks(下载提前、执行延后,不影响 FCP);新增 Vite plugin 遍历 entry chunk 静态 import 闭包,发现 vendor-blockchain / vendor-aave 可达即 fail build;守卫测试的"白名单不含 blockchain"旧断言更新为新语义。

**Blocked by:** 01 — 钱包层下移 lazy 边界(白名单语义与闭包断言都依赖新结构;旧结构下闭包守卫必然 fail)。

**Status:** ready-for-agent

- [ ] S12b:更新后的守卫断言(白名单必须含 wallet chunks)green
- [ ] S9:npm run build 时 entry 静态闭包含 vendor-blockchain/vendor-aave → build fail(可临时构造验证后还原)
- [ ] S10:dist/index.html modulepreload 包含 vendor-blockchain/vendor-aave/WalletProviders/AaveProviders
- [ ] build 产物量化:首屏 chunk 集 gzip 总量对比 Round 1 的 ~707KB

---

# 03 — 全量验证与入库

**What to build:** 全部验证通过后入库:validation gate 四项(lint/test/build/tsc)全绿;Playwright 运行时验证 S1–S5(dev + preview build);amend Round 1 commit(同任务修复,未 push),message 更新为最终实际行为。

**Blocked by:** 01、02。

**Status:** ready-for-agent

- [ ] S1:LoadingState 先绘制(不等 417KB wallet chunk),dashboard 随后渲染,无 console error
- [ ] S4/S5:chunk 加载失败 → 错误 UI 可重试
- [ ] validation gate:lint / test / build / tsc 全绿
- [ ] amend commit 完成,message 反映最终行为

