# Spec: openapi-sync Bot PR 收敛到 dev + codegen 产物自修复

**Status**: Approved（方向来自 AAV-1298 issue 评论，2026-09-24 用户审查；三分支规范见 docs/archive/2026-09-24-hardcode-sync-resilience.md §3）
**Date**: 2026-09-24
**关联**: AAV-1298 / GitHub #670
**类型**: bug（CI failure）/ CI 流程

## Problem Statement

push 到 `lovable` 检出 spec drift 后，`ci.yml` 的 `openapi-sync` job 尝试直接在 lovable 上建 bot PR，违反「bot PR 只对 dev」的三分支规范；且建 PR 提交时 husky pre-commit typecheck 必挂，job 恒红（#670 两条失败评论，run 35980786598）。本地复现（拉真实 spec + codegen + tsc）确认三层根因：

1. **分支路由违规**：job 条件为 `(push || schedule) && github.ref_name != 'main'`，`base: ${{ github.ref_name }}` → 任意非 main 分支（含 lovable）检测到 drift 都建 PR。
2. **codegen 原始产物不可编译**：zod `^4.3.6` 下 openapi-zod-client 对递归 schema（spec 中 MarketsResponse 自引用 1 处）产出 `type X = X;` + `const X: z.ZodType<X> = z.lazy(...)`（TS2456 类型别名循环引用）；对 `additionalProperties` 产出单参 `z.record(...)`（zod v4 要求 key+value 两参，TS2554）。入库的 `schemas.ts` 是修补过的版本，bot 每次重跑 codegen 都被坏产物覆盖 → pre-commit typecheck 拦下 → 建失败。09:23 失败 run 中 `ApiMeritCampaign*` 缺失是后端部署中间态的瞬时 spec 所致，现已自愈；两个结构性错误在任何 spec 版本下都复现。
3. **CI 缺生成物**：`chainIconManifest.generated.ts` / `tokenIconManifest.generated.ts` 不入库（由 `scripts/generate-icon-manifests.mjs` 在 dev/build/test 时生成），sync job 未生成 → pre-commit typecheck 报 3 个 TS2307（连带 `preloadUtils.ts` TS7006）。

PAT 权限排除：失败发生在 pre-commit 阶段（本地 commit 流程内），未触及远端推送，非权限问题。

## Solution

### F1: ci.yml — bot PR 收敛到 dev

`openapi-sync` job：

- 条件改为 `(github.event_name == 'push' && github.ref_name == 'dev') || github.event_name == 'schedule'`（保留 `always()` 与 `drift == 'true'` 门禁）→ lovable/其他分支只做 openapi-check 只读报警，不再建 PR
- Checkout `ref: dev` 固定（push-to-dev 时等价；schedule 时修正——schedule 跑在 main ref 上，原 `ref_name` 写法会让 schedule 永远跳过，注释里宣称的「daily schedule safety net」实际失效）
- `base: dev` 固定；`branch` 命名不变（run_id 唯一）
- labels 固定 `automerge` + `openapi-sync`（job 已 dev-only，`ref_name != 'main'` 条件在 schedule 下恒 false 会错误丢掉 automerge）
- title/body 去掉 `${{ github.ref_name }}`（schedule 下会误导性地显示 main）
- job 注释指明 dev-only 约定及其规范出处

openapi-check job 顶部注释同步更新（sync PR 目标为 dev）。

### F2: schema:codegen 链内自修复

新建 `scripts/lib/patch-generated-schemas.mjs`（导出纯函数 + direct-run 守卫，AAV-1297 先例），两个变换、恰好覆盖两个已知坏模式：

- **递归别名**：`type X = X;` + `const X: z.ZodType<X> = z.lazy(() => X);` → 删 type 行，const 改为 `const X: z.ZodTypeAny = z.lazy(() => X);`（与入库修补版一致）
- **z.record 单参**：`z.record(<单参数，括号平衡扫描>)` → 注入 `z.string(), ` 作 key 参数（OpenAPI additionalProperties 的 key 恒为 string）

package.json 接线：`schema:codegen` 链尾追加 `&& node scripts/lib/patch-generated-schemas.mjs`。所有消费方（CI sync job、`schema:check`、本地开发）统一获得可编译产物。格式权威源 = codegen+patch 原始输出：`src/generated/` 在 `.prettierignore` 中（有意豁免），eslint recommended 无 styling 规则不会改写 → 产物格式确定，无 drift 时 `schema:check` 与入库文件零 diff，检查恢复可判定性（旧入库文件的 prettier 风格与管线输出不一致，`schema:check` 在本任务前已不可判定；首个同步 PR 落地后恢复）。

幂等与不掩盖：pattern 不匹配时输出原样、不写文件；未知坏模式（未来新形态）不被 patcher 触碰，pre-commit typecheck 照样红 → job 失败 → ci-failure-alert 既有路径，fail-closed。

### F3: sync job 生成 icon manifests

`Create spec sync PR` step 前新增 step：`node scripts/generate-icon-manifests.mjs`（不入库，仅为 pre-commit typecheck 提供模块）。

### 不变量

- openapi-check 全分支只读报警（continue-on-error warning），行为不变
- PAT 缺失兜底（GITHUB_TOKEN + warning + workflow_dispatch fallback CI）不变
- drift=false / changed=false 时空转跳过，不建空 PR

## Out of Scope

- `hardcode-sync.yml` 三分支矩阵收敛到 dev（roadmap 实施顺序第 3 步「发布节奏 + bot 收敛」，独立任务；本次只动 openapi-sync）
- openapi-zod-client 升级 / zod 降级（patcher 确定性覆盖当前两个坏模式，工具升级后自然 no-op）
- 后端 spec 递归 schema 的消除（z.lazy 是合法语义，修补版已按此处理）

## Scenario & Risk Verification

### Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| .github/workflows/ci.yml | sync job 条件/checkout/base/labels 收敛到 dev；新增 manifest 生成 step | Medium | bot PR 路由变化；下游 automerge/close-stale-bot-prs 对 dev bot PR 已有 hardcode-sync 先例。最坏后果：PR 建不出 → job 红 → ci-failure-alert，不比现状差 |
| package.json | `schema:codegen` 链尾追加 patcher（prettier 不加入链：`src/generated/` 在 `.prettierignore` 中有意豁免，格式权威源 = codegen+patch 输出） | Medium | 三处消费方统一；patcher 崩溃则 codegen 失败（fail-closed，alert 可见）。node:test 守卫防静默移除 |
| scripts/lib/patch-generated-schemas.mjs | 新建（纯函数 + direct-run 守卫） | Low | 无既有消费者 |
| scripts/patch-generated-schemas.test.mjs | 新建（node:test，位于 scripts/ 根——与 chain-slug.test.mjs 惯例一致：测试在 scripts/ 根、实现在 scripts/lib/） | Low | 无 |
| src/generated/api/README.md | Regeneration 说明补 patcher 一行 | Low | 文档同步 |

### Behavioral Scenarios

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| 1 | push 到 lovable + drift（#670 现场复现） | openapi-sync job 不运行；仅 openapi-check 只读 warning | High | static review（YAML 条件）+ runtime（合并后下次 push 观察绿色） | 收敛后 lovable 无 bot 写路径 |
| 2 | push 到 dev + drift | sync job 运行：checkout dev、PR base=dev、labels 含 automerge+openapi-sync | Medium | static review + runtime-real-data（下次真实 drift） | PAT 先例：hardcode-sync 对 dev 建 PR 正常 |
| 3 | schedule（ref=main）+ drift | sync job 运行：checkout dev、PR → dev，每日安全网真正生效 | Medium | static review + runtime（次日 schedule 观察） | schedule 修复前该路径从未运行过，属纯新增行为 |
| 4 | push dev / 无 drift 或 changed=false | job 空转跳过，不建空 PR | Low | static review（既有门禁不变） | — |
| 5 | codegen 产出含两个已知坏模式（当前真实 spec 即是） | patcher 修复后 `npx tsc --noEmit` 通过 | High | automated test（两个变换各一测）+ runtime-real-data（本地复现→修复→tsc 绿） | 失败现场即测试夹具来源 |
| 6 | codegen 产出含未知新坏模式 | patcher 不触碰，typecheck 红 → job 失败告警 | Medium | runtime-real-data（本地复现已证明 typecheck 是有效闸门） | fail-closed；PR body 的 ⚠️ 保留 |
| 7 | patcher 输入无匹配（已是好代码 / 未来工具修复） | 输出原样、不写文件（幂等 + 无 mtime 噪音） | Low | automated test（no-op 用例） | 幂等性用例 |
| 8 | 多个递归别名 / 多个单参 z.record | 全部修复（逐处扫描，非首处） | Low | automated test（多命中用例） | — |
| 9 | 有人从 `schema:codegen` 链里移除 patcher | node:test 守卫断言 script 含 patcher 调用，测试红 | Low | automated test（清单漂移守卫，AAV-1296 先例） | — |
| 10 | push-dev 与 schedule 同日双跑 | 分支名含 run_id 唯一；后跑者 changed=false 时空转 | Low | static review | — |
| 11 | 无 spec drift 时本地 `schema:check` | codegen+patch 输出与入库文件零 diff | Medium | runtime-real-data（本地执行验证） | 恢复 schema:check 可判定性 |
