# Learned Lessons: Infrastructure & CI

Historical lessons from CI/CD, external API integration, and deployment. Extracted from AGENTS.md to keep it concise. Read when modifying CI workflows, external API integrations, or GitHub Actions.

## 外部 API 集成测试必须验证真实端点（chainDiscovery 404 根因）
- **Mock 测试无法发现"API URL 不存在"的问题**：`chainDiscovery.test.ts` mock 了 `fetch` 返回 `ok: true` + JSON，但真实的 `chainid.network/chains/{id}.json` 和 `chainlist.org/rpcs/{id}.json` 端点根本不存在（官方只有 bulk 端点 `chains.json` 和 `rpcs.json`）。所有链的单链 fetch 全部 404，mock 测试从未暴露这个问题。
- **外部 API 集成必须同时维护契约测试**：单元测试 mock fetch 是必要的（速度、隔离），但对第三方 API 的集成必须额外有契约测试（contract test）——在 CI 或手动触发时用真实 fetch 验证：(1) URL 是否可达；(2) 响应格式是否符合预期 schema；(3) CORS 是否允许浏览器端调用。契约测试不需要每次跑，但必须存在且可运行。
- **测试原则：Don't Mock What You Don't Own**：只 mock 自己控制的代码（内部函数、状态），不要 mock 第三方 API 的行为——因为你对它的假设可能是错的。对第三方 API，用 schema 验证（zod/Joi）替代 mock：真实响应必须满足 schema，mock 也必须满足同一 schema。
- **API URL 必须基于官方文档而非猜测**：`/chains/{id}.json` 这种路径模式看似合理但从未被官方文档确认。添加外部 API 集成时，必须先查官方文档确认端点存在，再写代码。
- **防御性编码：fetch 失败时区分"链不存在"和"API 不可达"**：404 可能意味着"链未收录"或"API 端点不存在"——两者语义不同但表现相同。当所有链都 404 时，应该怀疑是 API 本身的问题而非逐链问题。

## CI openapi-sync push rejected race condition (AAV-1034)
- **`git push` 前必须 `git pull --rebase`**：CI 中任何自动 commit+push 的 job，在 checkout 到 push 之间分支可能已有新 commit，直接 push 会被 rejected。`git pull --rebase origin ${{ github.ref_name }}` 确保 sync commit rebase 到最新 HEAD 后再 push。
- **openapi-check 和 openapi-sync 并行导致死循环**：check 先 fail，sync 后 push 但被 reject（因为新 commit 已推入），下次 CI 仍用旧 spec → check 又 fail。修复 rebase 后 push 成功，循环打破。
- **GitHub Actions `run: |` 块默认 `set -e`**：`git pull --rebase` 失败会停止执行，不会走到 `git push`，所以 rebase 冲突时不会 force push，安全性有保证。
- **`git pull --rebase` 前必须 stash unstaged changes**：npm scripts（如 `openapi:fetch` 触发的 `generate-icon-manifests + vitest`）会在工作目录产生未追踪文件，导致 rebase 失败。修复：`git stash --include-untracked` → `git pull --rebase` → `git stash pop || true`。

## Branch sync 状态是时间快照，不是绝对事实
- **报告 `ahead/behind` 前必须 `git fetch origin`**：`origin/*` 引用只是上次 fetch 时的快照，不代表远端当前状态。多人并行 + Dependabot + 自动化 sync（hardcode-sync、openapi-sync）的项目中，远端可能在几分钟内就有大量新 commit。
- **本地分支也可能被其他进程修改**：IDE auto-fetch、git hook、其他 session 的 push/pull 都可能移动本地分支指针。`git branch -vv` 显示的 ahead/behind 只反映上次 fetch 时的对比结果，不是实时状态。
- **结论应带限定语**：不要说"本地 ahead 4, behind 70"，而应说"截至本次 fetch，本地 ahead 4, behind 70"。状态随时可能变，绝对判断容易误导。
- **诊断 sync 问题时用 `git merge-base` 交叉验证**：`git log --oneline local..origin` 和 `git log --oneline origin..local` 配合 `git merge-base local origin` 才能看清真实分歧点，单看 ahead/behind 数字不够。

## ahead/behind 数字虚高：merge commit 导致 commit 数 ≠ 合并代价
- **`git branch -vv` 的 ahead/behind 是拓扑计数**：每个 merge commit 也算一个，所以频繁双向 sync（lovable↔dev）的项目中，behind 70 可能全是 merge commit，实际代码差距为零。
- **判断真实合并代价用 `git diff --stat`**：如果 `git diff A..B --stat` 无输出，说明文件内容完全一致，pull 只会产生一个空 merge commit，无冲突无代码变化。
- **`--no-merges` 过滤噪音**：`git log A..B --no-merges --oneline` 只显示实质 commit，去掉 merge commit 的虚高计数。
- **`git cherry` 检测等价 patch**：`git cherry A B` 标记哪些 commit 的改动已在对面存在（`+` = 新增，`-` = 等价已存在），适合判断哪些 commit 真正需要合并。
- **结论**：看到 ahead/behind 数字大时，先 `git diff --stat` 确认实际代码差异，再决定 pull/merge 策略，避免被 merge commit 历史误导。

## GitHub Variable → Secret 迁移必须更新所有引用 workflow（AAV-429）
- **迁移 GitHub Variable 到 Secret 时，必须 grep 所有 workflow 文件中的引用**：本次只改了 `ci.yml` 的 `vars.LIVE_TEST_API_BASE_CI` → `secrets.LIVE_TEST_API_BASE_CI`，漏改 `hardcode-sync.yml`，导致后者 fallback 到 staging-api 被 Cloudflare Bot Fight Mode 403 拦截，hardcode sync 连续失败。
- **`vars.` 引用已删除的 Variable 返回空字符串**：GitHub 不会报错，而是静默返回空，触发 fallback 逻辑。如果 fallback 指向被 Cloudflare 保护的域名，CI 就会 403 但不给出明确原因。
- **涉及 `LIVE_TEST_API_BASE_CI` 的 workflow**：`ci.yml`、`hardcode-sync.yml`。迁移时用 `grep -r 'vars\.LIVE_TEST_API_BASE_CI' .github/workflows/` 确认无遗漏。

## Vercel deployment READY ≠ custom domain 已指向（#435）
- **Vercel 部署 READY 后 custom domain 切换有延迟**：`aaveapy.com` 指向新部署需要 Vercel 内部 alias 更新流程，通常几秒到几十秒。CI 在 deployment READY 后立即 curl custom domain，可能仍拿到旧部署的 SHA。
- **Production 分支也需要 domain alias polling**：之前只有 staging/preview 分支在 SHA 不匹配时 polling 最多 300s，main 分支直接 fail。这导致 main 分支部署后如果 domain 切换慢于 CI 检查就会误报 smoke test failure。修复：所有分支统一 polling。
- **Vercel rollback API 响应格式因版本而异**：`POST /v1/projects/{id}/rollback/{uid}` 返回 2xx 但响应体不一定含 `jobId`/`status` 字段。严格匹配这两个字段会导致有效 rollback 被误判失败。修复：2xx + 无 `.error` 字段 = 成功。
- **Rollback 成功后 Vercel 可能禁用 domain auto-assign**：Vercel 文档提示 rollback 后 custom domain 不会自动指向新部署，需手动 `vercel promote` 或在项目设置中重新启用 auto-assign。

## rolldown manualChunks 模拟会把共享模块拼接进错误 chunk（FCP 优化根因）
- **现象**：manualChunks 模拟下，rolldown 把 `clsx`、`@tanstack/query-core`、react-dom 片段、react-remove-scroll 等共享模块拼接进与它们无关的 vendor-blockchain chunk（sourcemap 确认），使任何 `cn()` 调用点——即全部同步首屏 UI——静态可达重型 chunk，仅调整 App.tsx 的 import 无法修复。
- **修法**：rolldown-vite 用原生 `output.advancedChunks` 正则分组替代 manualChunks 函数，分组语义确定、逐模块匹配 `test` 正则。红线保留：React + ReactDOM 必须在同一 chunk（vendor-react），拆开会 crash。
- **结果级守卫优于配置级守卫**：断言配置形态（"规则存在"）挡不住 bundler 行为回归；必须断言产物本身——`assertFirstPaintChunksPlugin` 在 generateBundle 遍历 entry 的静态 import 闭包，触达重型 chunk 即 fail build 并打印 import 链，并对 `chunk.imports` 缺失 fail loud，防止守卫静默空转。
- **共享 util 依赖第三方包时加纵深**：`cn()` 内联 clsx 运行时（type-only import 保持类型单一来源），即使拼接行为回归，首屏路径也到不了区块链库。

## FCP 优化的边际收益递减停止点（Round 3 审查结论）
- **Desktop FCP 1.65s 达标后进一步优化 trade-off 不合理**：Round 1+2 把 Desktop FCP 从 3.3s 降到 1.65s（目标 2.5s），Round 3 潜在优化方向（lazy framer-motion、代码拆分 FaqSection、TS helpers 重构）总计收益 ~200-300ms，但每个方向都有 hydration mismatch、layout shift 或重构风险。
- **Mobile FCP 的瓶颈是网络不是 JS**：Lighthouse Mobile 5.8s 是 Slow 4G + CPU 4x throttling 极端条件下的结果，真实网络下会好得多；优化 JS 体积对 Mobile FCP 改善有限。
- **停止优化的决策框架**：(1) 目标是否已达成（Desktop 1.65s < 2.5s ✅）；(2) 进一步优化收益是否 > 风险（~200ms vs hydration 风险 ❌）；(3) 用户侧体验是否可接受（Mobile 真实网络待观测）。三条都满足时才值得继续。
- **后续监控**：生产环境 CrUX real-world 数据 p75 FCP；如果 Mobile FCP 在真实网络仍 > 3s 再考虑优化。

## peer 版本错位的方向不可自动判定（AAV-1301 两次回归）
- **`npm ls` 的 invalid 行指名的是被牵连的一方，不是该修的一方**：`eslint@9.39.4 invalid: "^10.0.0" from node_modules/@eslint/js` 读起来像 "eslint 太旧"，实际该修的是被升上去的 `@eslint/js`。任何从这行文本提取包名再 `install @latest` 的脚本都会朝反方向改 dependency，且改完仍 invalid。peer 冲突的对齐方向留给人判断。
- **`.npmrc` 的 `legacy-peer-deps=true` 让 install 不构成守卫**：CI 的 `npm ci` 同样读它，所以主版本错位的 lockfile 装得上、只在 `npm ls` 才暴——拦得住的只有显式跑 `npm ls` 的 job（`peer-dep-check`），别把 "npm ci 成功" 当 peer 一致的证据。
- **dependabot 的 `ignore` 只在默认分支生效**：配置文件从仓库默认分支读取，写进 dev 的规则要随 dev → main 发布流进 main 才生效；在那之前用 PR 评论 `@dependabot ignore this major version` 即时关闭同类 bump。
- **同一条通道会重复踩**：`@eslint/js` v10 进 dev → 回退（`0e85f4d7`）→ 同类 bump 又被合入。修完版本只在 PR 里留结论不够，把「暂缓升级」的裁定写进 issue 并在 dependabot 配置里落一道闸，才让下一个 session 有地方查到理由。

## DOM 环境升级会引入浏览器不产生的 rejection（happy-dom 20.12+ WAAPI）
- **换实现等于换缺陷面**：happy-dom 20.12 起才有 `Element.prototype.animate` / `lib/animation/`（20.9.0 完全没有，motion 走 JS 回退）。它在 `Animation` 构造函数里就创建 `finished`、`cancel()` 时用 AbortError reject；浏览器是访问时才懒创建，于是这份「被 reject 但无人 catch」的孤儿 promise 只在 happy-dom 出现，被 vitest 计成 run error——用例全绿、退出码 1。
- **补在状态变化的时机，不补在创建时机**：`play()` 会重建 `finished`（`if (playState === 'finished' || 'idle')`），所以 handler 要挂在 `cancel()` 前而不是只在 `animate()` 返回时补一次。
- **吞 rejection 的 shim 必须带正对照**：同环境放一条真实 `Promise.reject` 的用例，确认它仍然 exit 1，才能证明 shim 是窄口径而不是全局消音；验证完删掉临时用例。
- **本地 `npm ls` 不等于 CI 的 `peer-dep-check`**：npm 11 与 npm 10 对 `^0.x` 这类畸形 range 判定不同，本机在未修改的绿分支上也会报 `axios` / `vitest` invalid。以 CI 运行结果为准。

## osv-scanner 的豁免只在 `osv-scanner.toml`（不带点），且 `ignoreUntil` 会真的过期
- **本地门、非 CI 门**：osv-scanner 只在 `.husky/pre-push`（2026-09-06 由 `3b3fa47f`→`a07f2d2b`→`e27cd217` 分三步装成 BLOCKING，引用 #197 工具链）。CI 的 `security-audit` 是 `npm audit --omit=dev --audit-level=high` 且 `continue-on-error: true`。所以会出现「CI 全绿、所有人推不动」这种形态——排查推送失败时先看 hook，别看 PR checks。
- **文件名不能带点**：hook 跑裸命令 `osv-scanner --lockfile package-lock.json`，靠自动发现读 **`osv-scanner.toml`**。实测 `.osv-scanner.toml`（带点）完全不生效，洞照旧报。改名同时要改 hook 的 `--config`。
- **`ignoreUntil` 是真执行的时间闸**（需 RFC3339 带 T 与 Z，`2027-01-31` 这种裸日期会解析失败并**让整份配置加载失败**）。已实测两个方向：未来日期 → `No issues found`；过去日期 → 重新报该条。所以豁免不会永久沉默。
- **`[[IgnoredVulns]]` 之外没有 `PackageVulnerabilities`**：v2.5.1 对未知键是**整份配置拒绝加载**（`unknown keys in config file: ...`），不是忽略那一条。写错一个键名的后果是"豁免全废"，改完必须跑一次原样命令确认 `No issues found`。
- **上游没修复版时不要硬抬版本**：`braces 3.0.3`（GHSA-vfj7-8cjw-p6xm，dev-only 经 tailwind v3 的 chokidar/micromatch 传入）在 npm 上没有更高版本，OSV 的 ranges 只有 `last_affected` 没有 `fixed`。这类只能带理由+到期日地豁免，或换依赖链根治；对比 axios 1.18.1 有 1.20.0 可升，那条走 `overrides`（#710/#711）。**先查有没有 fixed 事件，再决定用哪种修法。**

## 修 CVE 与 ≥7 天冷却期会互相打架：`^` 会替你选一个「太新」的版本，而本地门拦不住它

- **OSV 库会自己变，锁文件不动也能让门从绿变红**：2026-11-10 一次推送被 osv 挡下（21 条 / 9 包），而 `git diff <base> -- package-lock.json` **为空**、上次成功推送是一个月前 ⇒ 与本次改动无关，是 OSV 库新增了通告。**判断「是不是我引入的」最快路径就是这条 diff**，别先怀疑自己的改动。
- **`npm audit fix` 只保证「修了漏洞」，不保证「够老」**：`^` range 在 `npm install` 时解析到**最新的匹配版**，而修复版往往刚发布不久。实测：`vite@8.2.4` 已 35 天，而 `"^8.2.2"` 会解析到 `8.2.6`（1.1 天）；`follow-redirects` 最新修复版 1.16.3 是 1.8 天，1.16.2 是 15.6 天。**解 osv 门时要显式挑一个既修漏洞又过冷却期的版本**，不能盲信 `audit fix` 的结果。
- **⚠️ `check-dep-release-age` 拦不住「已有包的版本变化」——别把冷却期政策的执行寄托在它身上**：`parseAddedLockEntries`（`scripts/lib/dep-release-age-parse.mjs`）原本只认**新增的锁文件块**——它要求 `+ "node_modules/x": {` 这一**块头本身就是新增行**，块头是 context 行时，后面那条 `+ "version": "8.2.4"` 因 `currentPackage` 为 `null` 被直接丢弃。实测一次含 7 个版本变化的升级（3 个 direct：`vite`/`happy-dom`/`zod`）：门只看到 2 条**全新包**（`deepmerge-ts`、`@isaacs/nonrecursive-glob-match`），7 个版本变化**全部漏检**，却照样打印「✅ All direct dependency versions are at least 7 day(s) old」。**已于 2026-11-11 修掉**（块头改为同时从 context 行追踪 + 遇 `@@`/`diff --git`/`index` 重置归属 + 非包块如根 `"": {` 清空归属，F 系列 6 例回归测试）；修后同一次升级门能看到 10 条（3 direct）。**教训是「门打印全绿」不等于「门检查过」**——给门写测试时要覆盖「块头不变、只改 version」这种最常见的真实形态。
- **该门只挡 direct、transitive 只 warn**（脚本内 `directNames` 分类，源码注释写明「transitive 由 osv + Socket 覆盖」）。注意 `directNames` 只取 `dependencies`/`optionalDependencies`/`devDependencies`——**`overrides` 里的包一律算 transitive**，所以 override 抬版本不会被它挡（实测 `follow-redirects`/`fast-uri`/`minimatch@10`/`@vanilla-extract/css` 均只 warn）。
- **`has unused ignores` 是信号不是噪音**：豁免条目的通告被 OSV 撤下/收窄后会变成死配置，每次推送都打印一行。本仓 `braces` 那条（GHSA-vfj7-8cjw-p6xm）已实测失效——`osv-scanner` 与 `api.osv.dev` 两个来源都确认 `braces@3.0.3` 不再被标记。**留着的风险是反向的**：若该通告将来重新发布，这条豁免会静默压住它直到 `ignoreUntil`。定期核对，别当它是背景噪音。
- **豁免 = 记账，不是修**：加 `[[IgnoredVulns]]` 时必须同时开票（本次 AAV-1348），并在 reason 里写清「为什么不能真修」的一手证据 + 到期后的根治路线。只写「无法修复」不算理由——要写清是**上游没有可用版本**（附版本对照表）、还是**强行抬版本会破坏什么**（附命中数，如两个钱包 SDK 的 9 + 57 处单参 `z.record()`）。

## e2e 发现逻辑必须复刻 UI 的**全部**渲染门——包括状态存在别的端点里的那些

- **现象**：`portfolio-incentive-calculation` / `portfolio-results-inline-delta` 两个 spec 在 CI（`6301e1cc`）与本地全量跑上稳定红、隔离跑却绿，看起来像 load-flake，实际是**确定性数据耦合**。
- **真根因与本条主题无关**：① `data-current` 在 `metric.current === null` 时不渲染 ⇒ `getAttribute` 阻塞到 120s 测试超时；② `$/day` 单元格断言用了严格正则，而单元格可以合法是 `—`（desktop）/ `–`（mobile）。**没有一条失败是 forecast 造成的**——本条的原始归因是错的，见下。
- **被推翻的归因（留作反例）**：本条曾断言「`/meta/side-data` 的 `forecast.errors` 里的 campaign 一律渲染 `—`，所以发现 predicate 必须把 errors 当排除信号」。**三重反证**：`forecastUnavailable` 只是驱动 `*` 标记的**标志**（`rateSimulationCalculator.ts` 声明、计数、汇总进 `forecastUnavailableCampaignCount`），**从不归零 APR**；`forecastMerklApr`（`merklForecast.ts`）在 `merged === null` 时返回 `currentApr` ⇒ campaign 照常贡献数值；`result.forecastErrors` 在测试之外**无人读取**。`—` 只在 `incentivePercent === 0` 时渲染。
- **真正的门是什么**：`checkForecastAvailability(campaignType, campaignId, merged, forecastStates)`（`src/lib/incentiveCaps.ts`）= `!campaignType ? false : (merged == null || !forecastStates?.[String(campaignId)])`，且只在 `isForecastRequiring`（`FORECAST_REQUIRING_CAMPAIGN_TYPES` = `FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE` / `MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE` / `TARGET_TOTAL_APR`）时被调用。**跳过这些 campaign 的真实理由是**：没有 forecast state 时 APR 不随仓位变化，梯级断言 `after > current` **永远不可能成立**——不是「UI 渲染 `—`」。
- **实现要点**：`forecast.items` 与 `forecast.errors` 的条目**都只带 `campaignId`、不带 type** ⇒ forecast-requiring 判断只能读 breakdown 上的 `campaignType`；发现侧读 **`forecast.items`**（可用集）而不是 `errors`（排除集），且**拉取失败时返回 `null` 表示「关掉这道门」**，而不是「排除一切」。
- **通用教训**：写「镜像 UI 门」的 predicate 时，**先读 UI 那个函数的真实语义**（返回值、调用条件、状态来自哪个端点），再决定 predicate 复刻什么；**别把「症状看起来相关」当成机制**。本次错误归因的代价是一份写进文档的假机制 + 一个会静默排除正常 reserve 的 gate。
- **别把「隔离绿、全量红」直接判成 load-flake**：先看失败是否落在**同一处断言 + 同一错误文本**上。本次三个失败里两个是确定性数据耦合（隔离跑也必红，我实测过），一个是真 load-flake（隔离跑绿）。
- **`getAttribute` 会等到测试超时**：React 对 `undefined` 属性不渲染，`locator('span[data-current]')` 在 `metric.current === null`（`PortfolioSimulationMetric` 类型上合法的状态）时永远解析不到元素，`getAttribute` 于是阻塞到 120s 测试超时、把一条本可 graceful skip 的用例变成 2 分钟的挂死。**取属性前先 `toBeAttached` 设个上限**，或改用 `expectValueOrSkip` 那类既有 helper。
- **并发重渲染会吞掉 click**：`click` 事件要求 mousedown 与 mouseup 落在同一元素上；场景输入触发重排时，两次之间行被重渲染 ⇒ 不触发 click、行不展开。修法是**只在未展开时点**的重试（`expect(...).toPass()`），因为「无条件重试点击」会把已展开的行再关掉。

## dependabot.yml 是「一处无效 = 整份不解析」，且重复条目只有 check-run 会告诉你

- **`ignore` 要求 `dependency-name` + `versions` 组合唯一**：写成两条相同条目，Dependabot 报 `The property '#/updates/0/ignore/1/versions' includes a duplicate`，结果是**整份配置不解析**——不是那一条被忽略，而是 npm 与 github-actions 两个生态一起停摆，连 security 更新都不开。
- **只有默认分支的那份真正生效，但破坏是从那里开始计时的**：非默认分支上的坏配置当下无害（Dependabot 不读它），一旦被 `→ main` 的发布流带进默认分支就全局失效。所以往 dev/lovable 写 dependabot 改动时，必须把它当成「等着被 ship 的定时炸弹」看，别用「现在还在红/绿」判断影响面。
- **验证信号只存在于 commit 的 check-run 里**：`.github/dependabot.yml` 那条校验不是必需检查、也不在 CI workflow 内，`gh pr checks` 的流水线全绿照样可能是无效配置。取证方式：`gh api repos/<r>/commits/<sha>/check-runs --jq '.check_runs[] | select(.conclusion=="failure")'`，正文在 `.output.summary`。写完 YAML 列表项要跑这一条，不能只看 lint。
- **改 YAML 列表项要整块替换**：同一次 session 里两次 Edit（第一次注释被截断、第二次只补注释）很容易把 `- dependency-name` 整块重新插进去而留下旧副本——本仓就因此把重复条目带进了 dev（`7f7b4a18`）。列表项的新增/改写一次成型，改完立刻 `grep -c dependency-name` 数一遍条数。



## happy-dom 的 `localStorage` 不走 `Storage.prototype`——spy 它等于什么都没测

- **症状**：`vi.spyOn(Storage.prototype, 'setItem')` 装好了、测试全绿，但**被测代码根本没被拦截**——测试通过却不证明任何事。
- **取证**：装 spy 前后都成立 `localStorage.setItem !== Storage.prototype.setItem`（而 `Object.getPrototypeOf(localStorage) === Storage.prototype` 却是 `true`、`hasOwnProperty(localStorage, 'setItem')` 是 `false`），直接调 `localStorage.setItem(...)` 也不命中 spy。实现里读到的 `storage.setItem` 与测试里 `Storage.prototype.setItem` 不是同一个函数对象。
- **正确写法**：要模拟「storage 抛错」，用 `vi.stubGlobal('localStorage', { getItem, setItem, removeItem })` 换掉全局——模块的默认参数 `storage: StorageLike = localStorage` 在**调用时**读全局，所以 stub 生效；`finally` 里 `vi.unstubAllGlobals()`。
- **通用教训**：**验证「测试能红」比验证「测试能绿」更重要**。任何 mock/spy 装完，先把实现改回缺陷态跑一遍确认它变红；本次正是靠「移除 try/catch 后测试仍然全绿」才发现 spy 是空转的。
