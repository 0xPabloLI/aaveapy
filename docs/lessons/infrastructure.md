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
