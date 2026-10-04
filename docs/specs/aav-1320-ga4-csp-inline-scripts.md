# AAV-1320 — GA4 在生产被自家 CSP 拦死：consent 内联块 + gtag.js 放行 + 构建期 hash 校验

> Status: implemented 2026-09-28 · Issue: [AAV-1320](https://linear.app/aaveapy/issue/AAV-1320) · Type: deployment config + build gate（可观测性）

## 背景与根因

生产 `vercel.json` 的 CSP `script-src 'self' 'wasm-unsafe-eval' https://static.cloudflareinsights.com` 既无 Google origin 也无任何 `'sha256-…'`/nonce，导致**两类脚本被拦**：

1. **`index.html` 的 consent default-deny 内联块**（GA Consent Mode v2 前置）→ `dataLayer` 里永远没有 `['consent','default',…]`。用户点 Allow 后 `initAnalytics`（`gtag.ts`）自行兜底创建 gtag stub 并注入 gtag.js——**在无默认拒绝同意态下运行**，隐私姿态比"全拦"更差（评论区硬约束 #1）。
2. **gtag.js**（`https://www.googletagmanager.com/gtag/js`）→ GA4 自 09-14 引入起生产零上报。

生产上其实还有**第三类被拦的内联脚本，本票未覆盖**：Cloudflare 自动注入的 Web Analytics beacon bootstrap（`index.html` 末尾，非本仓代码）。它带每次请求都变的 `r`/`t` 参数，**hash 钉不住**，另案 AAV-1327。下次改 `vercel.json` 的 CSP 前先去看那张票，别把它当新发现。

### 本地复现证据（2026-09-28，dist + vercel.json CSP 头模拟 + Playwright 干净 profile）

| 现象 | 证据 |
|---|---|
| consent 块被拦 | `securitypolicyviolation` event: `script-src-elem / inline / line 18`；Chrome 报 hash `sha256-QS+AkrDdcmDPvM2bc7VNqnJ18T0jsS9z+0xpEs869cs=` 与本地对 dist/index.html 脚本原始字节计算的 sha256 **逐字一致**（hash 契约成立） |
| 点 Allow 后仍不上报 | gtag.js 请求发出但被拦；`dataLayer[0]` = `["js",…]`，**无 consent default**；`window.gtag` 是 initAnalytics 兜底 stub 而非 index.html 定义的 Consent stub |
| 主题脚本（next-themes 0.4.6，553B，`nonce=""`） | **静默被拦**（无 violation 事件、内容不执行——classList spy 判定）；DOM 上的 class 由 React effect 应用。CSR 架构下该脚本由 React 挂载期渲染，本就无法在首绘前运行，CSP 修复前后无功能差异 → **不放行**（放行无收益纯扩权限） |
| ld+json 结构化数据 | data block 不受 `script-src` 约束（0 violation）→ 校验器必须排除 |
| eval 被拦（既有） | `script-src / eval / vendor-forms` chunk——与上游 relist 无关，非本票引入，不做 `unsafe-eval` 放松，另记 follow-up |

### 为什么必须构建期校验（评论区硬约束 #2）

hash 随脚本内容漂移；且**内联脚本集合跨依赖升级不稳定**：main（vite 8.1.4）构建把 modulepreload polyfill 内联进 HTML（评论实测 921B），lovable（vite 8.2.2）构建则放入 entry chunk（本次实测）。没有机制守着，下次依赖升级/脚本改动会再次静默失效。

## 设计

1. **`vercel.json` CSP 放行**（最小权限，不引入 nonce——Vercel 静态托管无法 per-request 注入 nonce；不用 `unsafe-inline`）：
   - `+ 'sha256-QS+AkrDdcmDPvM2bc7VNqnJ18T0jsS9z+0xpEs869cs='`（consent default-deny 块）
   - `+ https://www.googletagmanager.com`（gtag.js）
   - `+ https://*.google-analytics.com`（GA 子域脚本兜底，collect 走 fetch/beacon 已被 `connect-src https:` 覆盖）
2. **构建期校验门 `scripts/check-csp-inline-scripts.mjs`**（接在 `npm run build` 末尾，覆盖 Vercel 构建 / `ci:remote` / 本地）：
   - 从 `vercel.json` 提取 CSP `script-src` 指令 token 集；
   - 从 `dist/index.html` 提取**可执行**内联脚本（无 `src`；type 缺省或 `module`/JS mime；**排除** `application/ld+json`、`importmap` 等 data block）；
   - 对脚本**原始字节**算 sha256-base64，逐个断言 `'sha256-…'` ∈ script-src；
   - 断言 `googletagmanager.com` origin ∈ script-src（GA 回归守卫）；
   - 任一失败 → 构建 fail loud，错误信息含应加入的完整 token。
3. consent 注入链路（`consent.ts` / `ConsentBanner` / `gtag.ts`）**零改动**（评论区已核实行为正确）。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `vercel.json` | `script-src` 追加 1 hash + 2 origin | Low | 只放宽到点名脚本/域；其余指令零改动 |
| `scripts/check-csp-inline-scripts.mjs`（新） | 构建门校验器 | Low | 纯读取校验，不产出 |
| `scripts/check-csp-inline-scripts.test.mjs`（新） | node --test 单测（矩阵 1–8 行） | Low | 挂进既有 `npm test` 的 `scripts/**/*.test.mjs` 通道 |
| `package.json` | `build` 追加 `&& node scripts/check-csp-inline-scripts.mjs` | Medium | Vercel/ci:remote/本地三路径同时生效；fail 即断部署 |

**风险判定依据**：
- 修改是否影响现有功能？— CSP 只在生产/preview（Vercel 头）生效，本地 dev 无此头；放行集合是点名式的，未放松其余指令。
- 下游消费者？— `pageAnalytics.ts` / `consent.ts` / `gtag.ts` 零改动，运行时行为由放行后自然恢复。
- 最坏后果？— 校验器误报 → 构建红灯（可见、可修，不会带病上线）；校验器漏报 → 行为退回现状（不至于更糟）。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| 1 | dist 内全部可执行内联脚本 hash 已入 script-src | 校验器 exit 0 | High | automated test（happy path fixture） | 构建门 |
| 2 | 内联脚本内容漂移（改了 index.html 脚本未更新 vercel.json） | 校验器 exit 非 0，报出缺失的 `sha256-…` token | High | automated test（drift fixture） | 构建门 |
| 3 | 构建器升级使 polyfill 重新内联（`type="module"` 内联出现） | 校验器 exit 非 0（module 计入可执行集） | High | automated test（module fixture） | 构建门 |
| 4 | `application/ld+json` data block 存在 | 不要求 hash，exit 0 | Medium | automated test（ld+json fixture） | 校验器排除 data block |
| 5 | script-src 缺 `googletagmanager.com`（GA 回归） | 校验器 exit 非 0 | High | automated test | 构建门 |
| 6 | `dist/index.html` 不存在（校验器在 build 前误跑） | exit 非 0，fail loud | Medium | automated test | 接在 build 末尾 + 显式报错 |
| 7 | `vercel.json` 无 CSP 头/文件缺失 | exit 非 0，fail loud | Medium | automated test | 显式报错 |
| 8 | hash 算法契约：同一内容 checker hash === Chrome violation 报告 hash | 逐字一致（原始 UTF-8 字节、无空白归一化） | High | 已知向量锚定（`QS+Akr…69cs=`）+ 修复后 runtime 0 violation | 用实测 hash 做锚定向量 |
| 9 | 运行时·未同意（干净 profile） | `dataLayer[0]` = `['consent','default',{analytics_storage:'denied',…}]`；0 条 GA 网络请求；consent 块 0 violation | High | runtime probe（本地 CSP 模拟，修复后） | 上线后生产复验 |
| 10 | 运行时·点 Allow | gtag.js 请求 200；`g/collect` page_view 出现 | High | runtime probe | GA4 realtime 佐证（生产） |
| 11 | 运行时·点 Decline | 0 条 GA 网络请求（gtag.js 不注入） | High | runtime probe | — |
| 12 | 运行时·历史已同意回访 | 自动注入 gtag.js 且 200 | Medium | runtime probe（预置 localStorage granted） | — |
| 13 | 修复后整体 violation 面 | consent 块与 gtag.js 相关 violation = 0（既有 vendor-forms eval 除外，不在本票范围） | High | runtime probe | follow-up 记录 |
| 14 | 主题脚本（next-themes）保持被拦 | 无放行；主题功能不回归（React effect 应用 class） | Low | runtime probe（classList 正常）+ spec 记录 | 若未来该脚本获得首绘职责需重新评估 |
| 15 | 验证门 | lint + test + build（含新校验门）+ typecheck 全绿 | Medium | CI gate | — |
| 16 | 部署门 | vercel.json 改动走 lovable → dev → main；preview 阶段实测 CSP 头与 gtag 上报 | Medium | runtime-real-data（上线流程，需用户参与合并/晋升） | PR preview 实测 |

## Tickets（tracer-bullet 依赖边）

- **T1**（red）：`scripts/check-csp-inline-scripts.test.mjs` 写矩阵 1–8 行用例 → 对当前 repo 状态跑出 red（vercel.json 尚无 hash/origin，天然证明缺陷存在）
- **T2**（green）：实现 `scripts/check-csp-inline-scripts.mjs` → 单测 green；接进 `npm run build`，对当前 dist 跑出 **真实 red**（矩阵 8 锚定向量）
- **T3**（green）：`vercel.json` CSP 放行 → 构建门对 dist green（矩阵 1）
- **T4**：runtime probe 举证矩阵 9–14（本地 CSP 模拟），lint/test/typecheck/build 全绿（矩阵 15）+ code review + commit
- **T5**：docs 登记 + Linear 交付记录；部署门（矩阵 16）走标准上线流程，preview/prod 实测后由用户确认

依赖边：T1 → T2 → T3 → T4 → T5。

## Verification Evidence

**构建门（2026-09-28 本地）**
- T1 red：18 用例先行，模块未实现 → fail。
- T2 真实 red：`node scripts/check-csp-inline-scripts.mjs` 对当时 vercel.json 报 3 条 violation（缺 consent hash + 缺 2 origin），hash 与 Chrome violation 报告逐字一致。
- T3 green：vercel.json 修复后 gate 通过；`npm run build` 末尾自动执行通过。
- Code review（双轴）后补：`src` 检测防 `data-src=` 误判、malformed vercel.json 友好报错、CLI 可选路径参数 + exit-code subprocess 测试（22 用例全绿）。

**运行时 probe（dist + vercel.json CSP 头模拟 + Playwright 干净 profile）**

| 路径 | violation 事件 | dataLayer[0] | GA 网络请求 |
|---|---|---|---|
| 干净 profile + 点 Allow | 仅 1（既有 vendor-forms eval，票外） | `['consent','default',{analytics_storage:'denied',…}]`（arguments object） | gtag.js **200** + `g/collect` POST ✓ |
| 预置 declined | 仅 1（同上） | 同上 | **0 条** ✓ |
| 预置 granted 回访 | 仅 1（同上） | 同上 | gtag.js **200** + collect（`gcs=G100`）✓ |

观察（不阻塞）：点 Allow 后首个 collect ping 带 `gcs=G101`（consent update 与首 ping 的 GA 侧竞态），预置 granted 路径为 `gcs=G100`——既有 Consent Mode 行为，与本 CSP 修复无关。

**部署门（矩阵 #16，2026-09-28 preview 实测）**

PR #692（lovable → dev）的 Vercel preview，CDP Chrome（专用 profile 含 Vercel SSO 登录态）+ 本地 SOCKS5 代理访问（本机裸连 vercel.app 不可达）：

| 检查项 | 结果 |
|---|---|
| CSP 响应头 | `script-src 'self' 'wasm-unsafe-eval' 'sha256-QS+Akr…69cs=' https://www.googletagmanager.com https://*.google-analytics.com https://static.cloudflareinsights.com` ✓ |
| 部署一致性 | `aaveapy-deploy-sha` = `f16da8a5`（对齐 PR head）✓ |
| consent 内联块 | DOM 枚举比对 hash：`covered=YES`（修复前该块被拦）✓ |
| `dataLayer[0]` | `['consent','default',{analytics_storage:'denied',…}]` ✓ |
| 预置 declined | GA 网络请求 **0 条** ✓ |
| 预置 granted 回访 | `gtag/js` 200 + `google-analytics.com/g/collect` 204 ✓ |
| 站点自身 CSP violation | 2 个：next-themes 主题脚本（矩阵 #14，有意不放行）+ vendor chunk eval（票外既有）。其余 1074 条来自专用 profile 的 Chrome 扩展（`chrome-extension://`），与站点无关 |
| 主题功能 | 暗色仿真下 `html class="dark"` 正常（class 由 React effect 应用）✓ |

**CI 反馈修复**：CodeQL `js/bad-tag-filter` 三连（同一正则逐层暴露 HTML 边角）：① 缺 `i` flag（`<SCRIPT>` 大写静默漏检）→ `999ac53f`；② `</script >` 结束标签内含空白 → `f7708c9b`；③ `</script\t\n foo="bar">` 属性式垃圾 → 终版改为 `<\/script[^>]*>`（忠实 HTML 分词器语义：元素终止于 `</script` 后首个 `>`，`[^>]*` 恰为该语义），25 单测全绿。测试侧 URL `includes` 判定同步改 `Set.has` 精确匹配。

## Out of scope

- **vendor-forms chunk 的 eval 被拦**（既有行为，非本票引入）：**排查结论 = 良性降级，无需修复**。该 chunk 内只有一处 `Function(`，形如 `try { Function(''), !0 } catch { return !1 }`——Ajv 特征的能力探测（同一函数带 `jitless` 选项与 `navigator.userAgent.includes('Cloudflare')` 判断），用于检测运行环境是否支持 JIT。CSP 拦截后 `catch` 返回 false，Ajv 退回 non-JIT 解释模式：正确性不变，仅性能路径不同。故不引入 `unsafe-eval`。
- **next-themes 主题脚本放行**：CSR 下该脚本无首绘职责，放行无收益；若未来改为 SSG/SSR 需重新评估（矩阵 14）。
- **GTM 容器迁移 / nonce 化 CSP**：静态托管限制下收益不足。
- **consent 链路重构**：评论区已核实注入逻辑正确，本票只恢复其运行前提。
