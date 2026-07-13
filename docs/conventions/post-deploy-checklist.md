# Post-Deploy Checklist

> 每次生产部署（main → Vercel production）后执行此 checklist，确保线上健康。
> Staging 部署可选执行，但重大变更发布前建议跑一遍。

## 自动化检查（CI 已覆盖）

以下由 `deployment-smoke-test.yml` 自动执行，确认 CI green 即可：

- [ ] **Vercel 部署 READY** — commit SHA 对应的 deployment 状态为 READY
- [ ] **自定义域名可达** — `https://aaveapy.com` 返回 HTTP 200，`#root` 元素存在
- [ ] **Deploy SHA 匹配** — `<meta name="aaveapy-deploy-sha">` 内容与 push SHA 一致
- [ ] **后端 API 可达** — `https://api.aaveapy.com/api/markets` 返回 HTTP 200，reserves ≥ 50

> 若 CI 失败，auto-rollback 会自动回退到上一个 READY deployment 并创建 GitHub Issue。
> 回退后需手动 `vercel promote` 或 re-enable auto-assign。

## 手动验证（上线后必做）

### 1. 前端功能冒烟

在浏览器中访问 `https://aaveapy.com`，逐项确认：

- [ ] **页面加载** — 白屏时间 ≤ 3s，无 console 错误（框架 warning 可忽略）
- [ ] **Markets 数据** — ReservesTable 正常渲染，APY/APR 数值显示，排序切换正常
- [ ] **链选择** — 切换 chain 后数据刷新，无空表或 stale 数据残留
- [ ] **Rate 模式切换** — APY ↔ APR toggle 工作正常，数值即时更新
- [ ] **Simulation** — 展开 reserve row，输入 supply/borrow 金额，模拟值实时计算
- [ ] **Portfolio 模式** — 连接钱包或 Watch address `0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314`，仓位数据正确显示
- [ ] **Incentive 展开** — Merit/Merkl/Brevis 激励 breakdown 正常展开，APR 与 total 一致
- [ ] **移动端** — 390×844 viewport 下布局正常，无溢出/截断/触控目标 < 44px

### 2. API 合约验证

- [ ] **Live schema test** — `npx vitest run src/lib/apiSchemas.live.test.ts` 通过
- [ ] **关键字段存在** — `reserveId`、supply/borrow APY、incentive 数组均存在
- [ ] **百分数不变量** — API 返回的收益率字段仍为百分数（`2.07` = 2.07%，不是 `0.0207`）

### 3. SEO / Meta

- [ ] **OG tags** — 页面 `<title>` 和 `<meta property="og:*">` 正确渲染
- [ ] **SEO 代理** — `/seo/*` 路径可访问（Supabase Edge Function 正常）
- [ ] **OpenAPI spec** — `/openapi.json` 可访问且版本匹配

### 4. 安全与隐私

- [ ] **无泄露** — 页面源码和 JS bundle 中不含 API key/secret/token
- [ ] **.env 未追踪** — `git ls-files | grep '\.env'` 仅返回 `.env.example`
- [ ] **CSP / Headers** — 浏览器 DevTools Network tab 检查响应头，无异常

### 5. 分支同步

- [ ] **main ↔ dev** — `git log --oneline main..dev` 和 `git log --oneline dev..main` 无意外差异
- [ ] **dev ↔ lovable** — 同上，确认同步状态

## 性能基线（可选但推荐）

- [ ] **Lighthouse** — Performance ≥ 85，Accessibility ≥ 90
- [ ] **FCP** — First Contentful Paint ≤ 1.5s
- [ ] **Bundle size** — `npm run build` 后 dist 总大小与上次部署相比无异常增长（>10% 需排查）

## 回滚决策

若发现问题：

| 严重度 | 动作 |
|--------|------|
| 白屏 / 数据全空 / API 500 | 立即回滚：Vercel Dashboard → Promote last good deployment |
| 单链数据缺失 / 显示异常 | 评估影响范围，hotfix 分支修复 |
| 样式偏移 / 非阻断 bug | 记录 Issue，排期修复 |

回滚后：
1. 确认 `aaveapy.com` 恢复正常（deploy SHA 回到旧 commit）
2. 在 hotfix 分支修复根因
3. 修复合并后重新部署

## 相关文档

| 文档 | 路径 |
|------|------|
| 部署冒烟测试 | `docs/conventions/vercel-deployment-smoke-test.md` |
| API 合约检查 | `docs/conventions/api-contract-checklist.md` |
| 前端回归检查 | `docs/conventions/frontend-regression-checklist.md` |
| API Base URLs | `docs/conventions/api-base-urls.md` |
| 安全 Runbook | `SECURITY.md` |
