# main Branch Protection (5 层防御)

main 是生产分支，直接面向用户。以下 5 层机制性保护确保恶意代码无法自动合并到 main：

## Layer 1: Bot PR 不 auto-merge 到 main
- `token-icon-sync.yml`、`hardcode-sync.yml`、`ci.yml` (openapi-sync) 的 labels 字段使用条件表达式：`${{ target != 'main' && 'automerge' || '' }}`
- 只有 `lovable`/`dev` 分支的 bot PR 会获得 `automerge` label；main 的 bot PR 必须人工 review

## Layer 2: Branch Protection + CODEOWNERS
- main 分支规则：`required_approving_review_count=0`（solo developer，可自行 merge）、`require_code_owner_reviews=true`、`enforce_admins=true`
- 注意：solo developer 无法 self-approve PR，所以 `required_approving_review_count=0`。保护来自 Layer 1（bot PR 不 auto-merge 到 main）+ `enforce_admins`（禁止直接 push）
- `.github/CODEOWNERS` 覆盖关键路径：链接（`poolExplorerLinks.ts`、`aaveLinks.ts`）、地址（`hardcode.ts`）、API schema（`openapi.json`、`generated/`）、钱包（`useWallet*.ts`、`wagmi/`）、CI 定义（`.github/workflows/`）
- 即使 bot PR 的 CI 全部通过，也必须经过 code owner approval 才能合并

## Layer 3: Content Security CI Check
- `content-security-check` CI job 运行 `scripts/check-external-urls.ts`
- 扫描所有非测试源文件中的 `https://` URL，与白名单比对
- 任何未知域名（如钓鱼 explorer 域名）会导致 CI 失败
- 白名单维护：在 `scripts/check-external-urls.ts` 的 `WHITELIST` Set 中增减

## Layer 4: Commit Signature Verification (手动启用)
- GitHub Settings → Branches → main → "Require signed commits"
- ⚠️ 此设置无法通过 REST API 或 GraphQL 编程修改，必须在 repo UI 手动启用
- 启用后，即使攻击者拿到 write 权限，没有 GPG 签名也无法直接 push 到 main

## Layer 5: Branch Flow Guard (CI required check)
- `.github/workflows/branch-flow-guard.yml` — 任何 `→ main` 的 PR，如果 head branch 不是 `dev`（且不在 bot sync 例外列表中），CI check `branch-flow-guard` 会 fail
- `branch-flow-guard` 已加入 main 的 required status checks，阻止非 `dev → main` PR 的合并
- **根因**：solo developer 的 `required_approving_review_count=0` 意味着用户可以 self-merge 任何 CI 通过的 PR。Layer 1 只阻止 bot auto-merge，不阻止手动 merge。Layer 5 通过 CI check 机制性阻止 `lovable → main` 等非标准流程的 PR 被合并
- **启用步骤**：push workflow → 等 CI 运行一次 → 在 GitHub Settings → Branches → main required checks 中添加 `branch-flow-guard`
- **Bot sync 例外**：`bot/hardcode-sync-*` 和 `bot/token-icon-sync-*` 分支可以绕过 branch-flow-guard 直接向 main 开 PR。这些是低风险的资产/地址/图标同步更新，仍然通过所有其他 CI 检查。Layer 1（不加 automerge label）+ Layer 4（required_signatures）确保这些 PR 仍需在 GitHub UI 手动合并
