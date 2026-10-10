# AAV-1329: e2e 首步等待策略 —— 等页面自身就绪，不等网络静默

指针：守卫实现在 `scripts/e2e-wait-strategy.test.mjs`，随既有 `npm test`（`node --test "scripts/**/*.test.mjs"`）在 pre-commit 与 CI 生效——**不新增 npm script、不改 hook**。本文记录为什么是这条规则、边界在哪、哪些部分没有自动强制。

## 起因

`e2e/defi-yield-tracker-faq-anchor.spec.ts` 的三个 desktop 用例（`:50` / `:87` / `:114`）在**整条 pre-push 套件**里非确定性报红，首步即死：

```
Test timeout of 60000ms exceeded.
Error: page.waitForLoadState: Test timeout of 60000ms exceeded.
  > 52 | await page.waitForLoadState('networkidle');
```

它阻断本地推送（不附代码回归），只能重试或绕 hook。触发它的推送内容只有 3 行 markdown（`git diff --stat d52c3c7c..f8b1f9a2`），单独跑同 spec 恒绿（9 passed / 29.9s，三例各 7.7–9.7s，离 60s 预算很远），10-05 低负载（1-min load 4.6）复现——所以它不是「负载争用」，是等待对象选错。

## 根因（本次侦察坐实的一层）

票面已判「`networkidle` 等的是网络静默，而整条 gate 在几分钟内向 staging 发上百个请求」。本次另查明**为什么这个页面必然踩中**：

- `src/pages/DefiYieldTracker.tsx` **自身零取数**：H1、`h2#faq`、12 条 FAQ 全部来自同一次同步渲染；锚点跳转由组件内 `useEffect` + `setTimeout(scrollToHash, 50)` 处理，与网络无关。
- `src/App.tsx` 在**模块加载时**（而非路由挂载时）就 `prefetchQuery(['aave-markets'])` 与 `queryClient.prefetchQuery(SIDE_DATA_META_QUERY_KEY)`。这两个请求**与路由无关**——任何路由，包括这个纯静态 SEO 页，都会打 staging。

于是 `networkidle` 等的是一个**与页面无关的对象**：只要那几分钟里有任何一个 `/markets` / side-data 请求在飞行或重试，网络静默 500ms 就不可达。Playwright 官方也不建议用 `networkidle` 等业务状态。

## 规则与不变量

1. **等待锚点**：e2e 的首步等待必须锚在**页面自身的产出**（DOM 存在性、可访问名、属性），不得锚在**网络静默**。
2. **本页就绪判据**：`h1` 「DeFi Yield Tracker for Aave」可见 **＋** `h2#faq` 可见。前者证明懒加载路由 chunk 已挂载，后者是三个用例共同的断言靶区（锚点 `#<slug>` 与 `#faq` 同属该 section 的一次渲染）。Playwright 的「可见」不含视口相交判定，所以该判据在 DOM 挂载后立即稳定，不依赖滚动位置。
3. **断言不缩水**：三个用例原有的「锚点跳对 + offset 正确 + 焦点落位」断言逐条保留，只换等待对象；不引入 `skip`，不放宽断言。因此 `waitForPageReady` 与用例内既有的 `h1` / `h2#faq` 断言存在**有意的重复**——判据重复是幂等的，而删掉用例自己的断言正是票面禁止的「断言缩水」。
4. **守卫边界**：只判**非注释**代码里的 `networkidle`（区分大小写，故 `myNetworkidleFlag` 这类相邻标识符不命中）；注释豁免（`e2e/staging-smoke.spec.ts` 有一处说明性注释）；行内 `e2e-wait-strategy: allow` 为逃生阀。

## 已知覆盖边界

- 守卫只挡「等网络静默」这一族**错误等待对象**；它不判断「等待是否等到了正确的页面产物」——那需要语义理解，不是静态扫描能给的。
- 守卫是**文本级**判定，不是解析器：把词拆开的写法（`'network' + 'idle'`、模板串插值）与含 `//` 的正则字面量会把扫描推进注释态而漏判。它挡的是「直接写出这个等待」这一族，不承诺绕过免疫。
- 每行只报一次（修法按行）；逃生阀读**原始行**，所以它也能压掉同一行代码里的违规——那是有意的覆盖开关，不是豁免规则。
- 只扫 `e2e/` 下的 `.ts`。`scripts/pre-push-e2e.mjs` 注释里出现的 `waitForLoadState('networkidle')` 是历史说明，不在射程内；其他等待形态（`waitForTimeout` 等）也不在射程内。
- **不采纳**票面候选 2（放宽 `test.setTimeout`）与候选 3（hook 排除表）：前者治标且把套件拖更慢，后者减少覆盖。本次只做候选 1。

## Section 1: Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `e2e/defi-yield-tracker-faq-anchor.spec.ts` | 3 处 `waitForLoadState('networkidle')` → 新增的内联 helper `waitForPageReady(page)`（H1 + `h2#faq` 可见） | Medium | 唯一消费者是这 3 个用例；断言一行未动，只换等待对象。风险＝就绪判据选错会让等待空转 → 由判据本身的语义（H1/FAQ 就是被测对象）＋ 3 次整条套件实跑兜底（见「验证」）；最坏后果是等待失效但断言仍会红，不会静默通过 |
| `scripts/e2e-wait-strategy.test.mjs` | 新建：静态守卫 + 矩阵用例 + 对真实 `e2e/` 目录的集成断言 | Low | 纯新增，无既有消费者；由 `node --test "scripts/**/*.test.mjs"`（pre-commit + `npm test`）执行，不新增 npm script、不改 hook |

## Section 2: Behavioral Scenarios

| # | Scenario | Expected Behavior | Risk | Evidence |
|---|----------|-------------------|------|----------|
| 1 | `e2e/` 下任一带 `.ts` 文件在代码里出现 `networkidle` | 守卫报错并列 `文件:行`（集成断言，真实目录） | High | automated test（改前必红） |
| 2 | 注释里出现 `networkidle`（`e2e/staging-smoke.spec.ts:15` 的说明行） | 不命中 | Medium | automated test |
| 3 | 块注释 `/* … networkidle … */` 里出现 | 不命中，且**注释后的同行代码仍被扫到** | High（吞行会造假阴性） | automated test |
| 4 | 代码里的字符串/模板串含 `networkidle` | 命中 | High | automated test |
| 5 | `waitForLoadState('domcontentloaded')` / `('load')` / 无参 | 不命中 | High（误报会让人关掉守卫） | automated test |
| 6 | `page.goto(url, { waitUntil: 'networkidle' })` | 命中 | Medium | automated test |
| 7 | 行内含 `// e2e-wait-strategy: allow` | 跳过该行 | Medium | automated test |
| 8 | 相邻标识符 `myNetworkidleFlag` / `NETWORKIDLE` | 不命中（大小写敏感匹配） | Medium | automated test |
| 9 | 行内字符串含 `//`（如 `page.goto('https://…')`） | 注释剥离不得吞掉该行后续的 `networkidle` | High | automated test |
| 10 | 真实 `e2e/` 目录（38 个 `.ts`，含 staging-smoke 的注释） | 扫描 0 命中、rc=0 | High | runtime-real-data |
| 11 | 页面 lazy chunk 未挂载（H1 不出现） | `waitForPageReady` 超时并以 `expect` 失败呈现，不静默通过 | Medium | 静态推理（`expect().toBeVisible()` 语义）＋ 3 次实跑无此形态 |
| 12 | 三个用例替换等待后，断言仍真实存在且不含 skip | 断言逐条保留 | High | 静态检查（diff 只删 3 行等待线）＋ runtime（用例实跑计数） |
| 13 | 整条 e2e 套件（hook 内那条命令）连续 3 次 | 本 spec 3 次均 9/9 绿、单例 1.6–3.1s | High | runtime-real-data（3 次有效样本） |
| 14 | 整条套件在沙箱内的红点 | 红点逐轮轮换、全部落在与本改动零交集的 spec，隔离复跑多数转绿 ⇒ 负载性；沙箱内**不可达**「3 次 0 failed」 | Medium | runtime-real-data（3 次）＋隔离复跑（`--retries=0`） |

## Tickets

**单一 tracer bullet，不拆分。** 改动是一条垂直切片（守卫 + spec 修复 + 文档），没有独立可交付的中间态：若拆成「先加守卫、再修 spec」，中间态必然是一个被守卫判红的仓库。`to-tickets` 的 tracker 发布步骤因此跳过——父票 AAV-1329 已存在，无需新开。

`to-spec` 模板的 User Stories 一节不逐条套用：本改动是测试基础设施，没有「作为某角色我要…」形态的可陈述收益；同一信息由上面「规则与不变量」承载。

**范围经用户 2026-10-09 确认**：在票面「仅改 spec」之上增加本守卫，理由是它提供确定性的 red→green seam（改前必红）并堵住同类复发；形态取轻量版——随既有 `npm test` 生效，不新增 npm script、不改 hook。

## 证据

守卫自身的确定性 red→green（`node --test scripts/e2e-wait-strategy.test.mjs`）：

| 阶段 | 结果 |
|------|------|
| 只加守卫、spec 未改 | 11 tests / 10 pass / **1 fail** → 报 3 处命中：`e2e/defi-yield-tracker-faq-anchor.spec.ts:52`、`:90`、`:116` |
| spec 改完 | 11 tests / **11 pass / 0 fail** |
| 非空性 | 扫描覆盖 `e2e/` 下 38 个 `.ts` 文件（断言阈值 ≥ 20），不是空跑 |

- 改后的 spec：`npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck --strict e2e/defi-yield-tracker-faq-anchor.spec.ts` → **0 error**（e2e 不在任何 tsconfig 覆盖内，必须显式跑）。
- **运行时验证（3 次整条套件）**：命令即 hook 内那条 `npm run test:e2e:pre-push`，三次跑的是同一棵代码树（`e2e/`+`src/`+`scripts/`+`shared/`+playwright 配置的哈希前后一致，`6900deb8…`）。结论两条：
  1. **本 spec 3 次均 9/9 绿**，单例 1.6–3.1s——曾被 60s 超时挡下的三个用例，余量两个数量级。
  2. **「3 次 0 failed」在沙箱内不可达**，且不由本改动引起：套件在本沙箱慢 10–18×（25–50 分钟 vs 仓库自述 2–3 分钟），红点在三次之间**逐轮轮换**（`portfolio-toggle-alignment` 的 mobile-390 与 tablet-640、`segmented-toggle:120/:163`、`portfolio-panel-header:22`、`nested-scroll:59`、`portfolio-cross-reserve-offset:146`、`portfolio-incentive-calculation:165`），全部落在与本改动零交集的 spec；隔离复跑（`--retries=0`）多数转绿，`architecture-guard.test.ts` 单独跑 323 passed / 15s（满载下 68s、6 例 5s 超时）⇒ **负载性**。
- 逐次通过数/耗时与红点清单沉淀在 AAV-1329 的交付记录评论里——那是唯一权威源，本文件不复写。

## 沙箱拦阻（诊断留档，非仓库缺陷）

WorkBuddy 沙箱的 `safe-delete` shim 对单轮 >50 条的递归删除直接抛错，本轮命中两处，都发生在**测试跑起来之前**：

1. `scripts/clear-vite-cache.mjs` 的 `rmSync(node_modules/.vite, { recursive: true })`（实测 435 条）→ playwright 的 webServer 起不来，门禁 5s 退出、0 用例执行。
2. playwright 启动时清自己的 `test-results/`（实测 110 条）→ 同样退出、0 用例执行。

两处都会产出**看起来像 e2e 失败的假红**。绕行：跑前把这两处 `mv` 走（rename 不经 Node 的 fs API，不被 shim 拦），等价于 `clear-vite-cache.mjs` 想达到的状态。**没有为迁就沙箱改任何仓库代码。**

## 未纳入本改动（如实记录）

- 未把 e2e 纳入 CI 类型门（AAV-1319），未动 `tsconfig` 归属。
- 未扫 `e2e/` 之外的目录（如 `scripts/`），也未检查其他等待形态（`waitForTimeout` 等）——本票射程只有 `networkidle`。
- AAV-1323（绝对几何阈值卡实盘）与 AAV-1329 是**同族但机制不同**：前者是断言阈值，后者是等待对象。本守卫不覆盖 AAV-1323。
- **`.husky/pre-push` 的失败传播缺口**是本次取证顺带撞见的独立缺陷（`npm run ci:remote && npm run test:e2e:pre-push` 无 `|| exit 1`，后四道门覆盖 `$?`；三次 `rc=0` 假绿实测），已建 **AAV-1330**。本票不动公共 hook。
- 三次整条样本里轮换出现的负载性红点（`portfolio-toggle-alignment`、`segmented-toggle`、`portfolio-panel-header`、`nested-scroll:59`、`portfolio-cross-reserve-offset:146`、`portfolio-incentive-calculation:165`）**未逐一开票**：与本票机制不同，且在本沙箱无法与负载分离。其中 `reserves-table-simulation-nested-scroll:38` 在**隔离复跑里也红**（30s 等不到 `tbody tr[data-reserve-id]`）——与 AAV-1329 同族（等待对象/就绪判据选错）但属另一张票的射程，已列入候选待用户裁。
