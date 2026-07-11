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
