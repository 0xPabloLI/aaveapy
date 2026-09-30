# Branch Protection（main 5 层防御 + lovable 直推分级 + dev 必需检查）

main 是生产分支，直接面向用户。以下 5 层机制性保护确保恶意代码无法自动合并到 main：

## Layer 1: Bot PR 不 auto-merge 到 main
- `token-icon-sync.yml`、`hardcode-sync.yml`、`ci.yml` (openapi-sync) 的 labels 字段使用条件表达式：`${{ target != 'main' && 'automerge' || '' }}`
- 只有 `lovable`/`dev` 分支的 bot PR 会获得 `automerge` label；main 的 bot PR 必须人工 review

## Layer 2: Branch Protection + CODEOWNERS
- main 分支规则：`required_approving_review_count=0`（solo developer，可自行 merge）、`require_code_owner_reviews=false`、`enforce_admins=true`
- 注意：solo developer 无法 self-approve PR，所以 `required_approving_review_count=0`。保护来自 Layer 1（bot PR 不 auto-merge 到 main）+ `enforce_admins`（禁止直接 push）
- `.github/CODEOWNERS` 覆盖关键路径：链接（`poolExplorerLinks.ts`、`aaveLinks.ts`）、地址（`hardcode.ts`）、API schema（`openapi.json`、`generated/`）、钱包（`useWallet*.ts`、`wagmi/`）、CI 定义（`.github/workflows/`）
- 现状：`.github/CODEOWNERS` 仅作高危路径清单，code owner review **未强制**（`require_code_owner_reviews=false`）。bot PR 的"人工 review + 手动合并"由 Layer 1 保证（main 不发 automerge label）
- 若未来启用 `require_code_owner_reviews=true`：solo 作者触及 owned 路径的 PR 无法 self-approve（`enforce_admins=true` 下 admin 也无 bypass），dev→main 流程会死锁——启用前需先解决死锁（如第二账号做 reviewer）

## Layer 3: Content Security CI Check
- `content-security-check` CI job 运行 `scripts/check-external-urls.ts`
- 扫描所有非测试源文件中的 `https://` URL，与白名单比对
- 任何未知域名（如钓鱼 explorer 域名）会导致 CI 失败
- 白名单维护：在 `scripts/check-external-urls.ts` 的 `WHITELIST` Set 中增减

## Layer 4: Commit Signature Verification (手动启用)
- GitHub Settings → Branches → main → "Require signed commits"
- ⚠️ 此设置无法通过 REST API 或 GraphQL 编程修改，必须在 repo UI 手动启用
- 启用后，即使攻击者拿到 write 权限，没有 GPG 签名也无法直接 push 到 main
- **当前状态：未启用**（main 与 lovable 均 `required_signatures=false`）。未启用期间直推防线由 Layer 2 的 `enforce_admins=true` 独立承担；其他层引用本层时必须先核对此状态

## Layer 5: Branch Flow Guard (CI required check)
- `.github/workflows/branch-flow-guard.yml` — 任何 `→ main` 的 PR，如果 head branch 不是 `dev`（且不在 bot sync 例外列表中），CI check `branch-flow-guard` 会 fail
- `branch-flow-guard` 已加入 main 的 required status checks，阻止非 `dev → main` PR 的合并
- **根因**：solo developer 的 `required_approving_review_count=0` 意味着用户可以 self-merge 任何 CI 通过的 PR。Layer 1 只阻止 bot auto-merge，不阻止手动 merge。Layer 5 通过 CI check 机制性阻止 `lovable → main` 等非标准流程的 PR 被合并
- **启用步骤**：push workflow → 等 CI 运行一次 → 在 GitHub Settings → Branches → main required checks 中添加 `branch-flow-guard`
- **Bot sync 例外**：`bot/hardcode-sync-*` 和 `bot/token-icon-sync-*` 分支可以绕过 branch-flow-guard 直接向 main 开 PR。这些是低风险的资产/地址/图标同步更新，仍然通过所有其他 CI 检查。Layer 1（main 不发 automerge label，automerge workflow 因此不会自动合并）确保这些 PR 仍需在 GitHub UI 人工 review + 手动合并

## lovable 直推分级：admin bypass 是有意决策

`lovable` 与 main 相反：classic branch protection 配 4 个 required checks（lint / build / peer-dep-check / security-audit）+ `enforce_admins: false`。admin 直推会绕过 checks 拦截，push 后 checks 才开始跑——这是集成分支的分级设计，不是配置疏忽，不要当 bug 去"修"。

**为什么**：required checks 与直接 push 机制上不兼容——直推产生新 SHA，checks 只能后置，二者取一。lovable 是集成分支，选速度（直推）；main 是生产分支，选严格（`enforce_admins=true`，一切走 PR，见 Layer 2）。这个取舍由两层补偿控制撑住：

1. **Shift-left**：pre-push hook 已在本地前置 `ci:remote`（lint/build/test/audit）+ osv/semgrep/knip/dup——远端 4 个 checks 中 lint / build / security-audit 已有本地等价物，peer-dep-check（`npm ci` 后再跑 `npm ls --all` 找 invalid）是唯一仅远端的 gate。
2. **生产端隔离**：lovable 上的未验证 commit 流不到生产——Layer 5 branch-flow-guard 只放行 `dev → main`。

**直推后的约定**：watch checks 直到收敛，红了就 revert 或 fix-forward 补修——bypass 授权的是"checks 后置"，checks 全绿仍是 commit 落地的标准。修改此分级时先改本节（决策 home），再动 GitHub 设置，保持文档与实际配置一致。

## dev 必需检查：peer-dep-check 于 2026-09-29 补入

dev 原本只 required `lint` + `build`。`peer-dep-check` 会跑、会红，但**不在必需列表里就挡不住 automerge**——这就是 #653（`@eslint/js` 10 对 `eslint` 9 的主版本错位）能带着红检查合进 dev、让 dev 连红的机制（首次 `7e6b46be`→`0e85f4d7`，二次 `20e7c23b`→#697；决策与证据见 AAV-1301）。

现 required = `lint` / `build` / `peer-dep-check`，`strict=true`，`enforce_admins` 仍 false。

- **改这一项走子端点**，不要重传整份保护配置：`gh api -X PUT repos/0xPabloLI/aaveapy/branches/dev/protection/required_status_checks/contexts -f 'contexts[]=lint' -f 'contexts[]=build' -f 'contexts[]=peer-dep-check'`。回滚即把数组改回 `lint` / `build`。
- **为什么这一项非补不可**：根 `.npmrc` 的 `legacy-peer-deps=true` 让主版本错位的 lockfile 照样装得上（wagmi@3 + rainbowkit 的已知不兼容正依赖它，拆 `.npmrc` 会让所有人 `npm ci` 失败）。于是 install 成功不构成 peer 一致的证据，`npm ls` 那道 check 是唯一拦截点。

