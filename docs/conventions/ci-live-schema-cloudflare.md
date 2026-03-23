# CI Live Schema Tests vs Cloudflare（推荐改法清单）

`src/lib/apiSchemas.live.test.ts` 在 CI 里会请求 **staging 真实 API**（默认 `https://staging-api.aaveapy.com/api`）。若域名前有 **Cloudflare**，GitHub Actions 的出口 IP 常被当成机器人，返回 **403** 和 **HTML 挑战页**（标题 *Just a moment...*），而不是 JSON —— 测试会失败，**与前端/schema 代码是否正确无关**。

本文给出 **Cloudflare 侧** 与 **仓库侧（workflow / 测试策略）** 的推荐组合；落实后应把「跳过挑战」仅作为过渡，**长期仍应对 API 放行合法自动化流量**。

---

## A. Cloudflare 侧（优先，治本）

按侵入性从低到高排列；可组合使用。

| 优先级 | 做法 | 说明 |
|--------|------|------|
| **A1** | **路径级 WAF / Security**：对 `staging-api.*` 的 `/api/*` **降低** *Security Level* 或关闭 *Bot Fight Mode*（仅该路径/子域） | 最小改动；注意只作用于 staging，不要误伤生产。 |
| **A2** | **WAF Custom Rule — Allow**：匹配 `Hostname` = `staging-api.aaveapy.com` **且** `URI Path` starts with `/api/` **且** `User Agent` contains `GitHub-Actions`（或你们约定的 header）→ **Skip** / **Allow** | UA 可伪造，**不要单独依赖**；可与 A3 组合。 |
| **A3** | **IP Access / WAF — GitHub Actions 网段**：定期拉取 [GitHub Meta API](https://api.github.com/meta) 里 `actions` 的 CIDR，在 Cloudflare **IP Access Rules** 或 **WAF** 中对 staging 的 `/api/*` **Allow** | 网段会变，需 **每月或自动化同步**（Terraform / 定时脚本）。 |
| **A4** | **Cloudflare Access（Zero Trust）**：为 `/api/*` 配置 **Service Token**，CI 在 `fetch` 里带 `CF-Access-Client-Id` / `CF-Access-Client-Secret`（存 GitHub **Secrets**） | 适合已用 Access 的团队；需在测试里读取 env 并加 header（见下文扩展点）。 |
| **A5** | **独立子域不经 CDN**：API 直连源站（或仅 DNS 橙云关闭） | 架构变动大；安全与证书需单独评估。 |

**不推荐**：仅靠「把 Security 全站降到最低」—— 扩大攻击面。

**验证**：在任意机器上模拟 CI：

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -A "GitHub-Actions-Example" \
  "https://staging-api.aaveapy.com/api/markets"
```

应返回 **200** 且 body 为 JSON（可先 `| head -c 200` 看是否 HTML）。

---

## B. 仓库侧 — Workflow / 测试策略（治标 + 过渡）

| 策略 | 说明 |
|------|------|
| **B1 — 探测再跑** | `scripts/probe-live-api.mjs` 先请求 `/markets`：若 **200** 再跑 `vitest`；若识别为 **Cloudflare 挑战页** 且开启跳过模式，则 **warning 并成功退出**（避免 `main` 长期红）。 |
| **B2 — 定时补跑** | `.github/workflows/live-schema-validation.yml` 仅含 live 测试 + `schedule`（如每周一），与全量 `CI` 解耦；Cloudflare 放行后仍可作为 **回归哨兵**。 |
| **B3 — 手动触发** | `workflow_dispatch` 在修复 Cloudflare 后人工点跑，确认绿。 |
| **B4 — 严格模式** | 设置 `LIVE_TESTS_SKIP_WHEN_CHALLENGE=false`（或未设置）且不在「跳过」逻辑中：探测到挑战则 **失败**，强制修复 A 段。 |

**环境变量（GitHub Actions）**

| 变量 | 含义 |
|------|------|
| `LIVE_TESTS_SKIP_WHEN_CHALLENGE` | 设为 `true` 时：探测到 Cloudflare 挑战则 **跳过** vitest 并 **job 成功**（带 `::warning::`）。设为 `false` 或未设：与 `false` 行为以 workflow 注释为准。 |
| `LIVE_TEST_API_BASE` | 与本地 `test:live` 一致，默认 staging `/api`。 |

落实 A 段后，建议把 **`LIVE_TESTS_SKIP_WHEN_CHALLENGE` 改为 `false`** 或删除，让 CI **真跑** live schema。

---

## C. 若使用 Cloudflare Access Service Token（扩展）

1. 在 Zero Trust 为 staging API 路径创建 **Service Auth**。
2. 在 GitHub **Repository secrets** 写入 `CF_ACCESS_CLIENT_ID`、`CF_ACCESS_CLIENT_SECRET`。
3. 在 `apiSchemas.live.test.ts` 的 `fetch` 上增加（需单独 PR）：

   ```ts
   headers: {
     'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID ?? '',
     'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET ?? '',
   }
   ```

4. Workflow 里对 `live-schema-validation` job `env` 传入上述 secrets（仅 **not fork** 时）。

---

## D. 相关文件

| 文件 | 作用 |
|------|------|
| `scripts/probe-live-api.mjs` | 探测 live API 是否可达 / 是否被 Cloudflare 拦截 |
| `src/lib/apiSchemas.live.helpers.ts` | `isLikelyCloudflareChallenge()` |
| `.github/workflows/ci.yml` | `main` push 上的 `live-schema-validation` job |
| `.github/workflows/live-schema-validation.yml` | 定时 / 手动仅跑 live schema |
| `docs/conventions/api-contract-checklist.md` | API 契约总清单（含 live 测试说明） |

---

## E. 故障排查速查

| 现象 | 可能原因 |
|------|----------|
| 403 + HTML + *Just a moment...* | Cloudflare 挑战；走 **A** 或临时 **B1 跳过** |
| 5xx / timeout | 源站或网络；非 WAF 文案问题 |
| 200 但 vitest 仍失败 | **真·schema 漂移**；按 `api-contract-checklist.md` 更新 `apiSchemas.ts` |
