# AAV-1334 删除 dispatch-only `generate-snapshots` 死 job

## Problem Statement

手动触发 `ci.yml`（`workflow_dispatch`）时，`generate-snapshots` job 必定失败：

```
Error: No tests found.
```

它引用的 `e2e/segmented-toggle-visual.spec.ts` 与 `e2e/portfolio-panel-header-visual.spec.ts`
已在 `7c48ae01`（refactor(e2e): tighten suite boundaries and make watch flow deterministic）
中被删除/改名，但 job 没有同步清理。该 job 带
`if: github.event_name == 'workflow_dispatch'`，push/PR 触发的 CI 永远跳过它，
所以日常门禁全绿，只有人工 dispatch 时才会看到一条恒红的假失败。

删掉这两个 spec 的原因不是偶然：`docs/conventions/e2e-testing-boundary.md`
明确把 pixel screenshot baselines 列为越界项（macOS 渲染差异、CI 里被 skip、
无法区分真实回归与字体/抗锯齿漂移），替代物是 geometry / computed-style 断言。
仓内已无任何 `*-visual.spec.ts`，也没有 `e2e/*-snapshots/` 目录。

## Solution

1. 从 `.github/workflows/ci.yml` 删除整个 `generate-snapshots` job。
2. 加一条静态守卫：扫描 `.github/workflows/*.yml` 中所有 `playwright test`
   调用，任何显式引用的 spec 文件必须存在；同时禁止 workflow 传
   `--update-snapshots`（pixel baseline 路线已废弃）。守卫随 `npm test` 的
   `node --test "scripts/**/*.test.mjs"` 生效，不新增 npm script、不改 hook。
3. 订正两处仍指向被删 spec 的活文档指针。

## Implementation Decisions

- **删除而非重定向**：保留手动生成 baseline 的能力没有意义——仓内没有
  visual spec，且边界文档已否决该路线。票面「二选一」选方向 1。
- **守卫放在 scripts 层，不新增 CI job**：与 AAV-1319（`e2e-static-gate`）、
  AAV-1329（`e2e-wait-strategy`）、AAV-1349（`e2e-browser-gate`）同型：
  纯函数 + `node:test` 契约测试，随既有 `npm test` 执行。零新增长期 CI 成本。
- **守卫覆盖所有 workflow，不只 `ci.yml`**：这类漂移可能发生在任何
  workflow；扫描目录而不是写死文件名。
- **只判显式路径**：`playwright test --project=… --shard=…`（跑整个套件）
  没有路径参数，不应误报；含 `*` 的 glob 不做存在性判定（当前无人使用，
  且「glob 匹配 0 个文件」与「文件被删」是两种问题）。
- **禁止 `--update-snapshots`**：这是死 job 的直接机制，且与边界文档冲突。
  `-u` 一并识别。
- **不引入 YAML 解析依赖**：`js-yaml` 只是传递依赖；守卫用行级扫描 +
  续行拼接（`\` 结尾）即可覆盖现有与可预见的命令形态。YAML 语法本身由
  GitHub Actions 与本地一次性解析验证，不写进守卫。
- **清点消费者**：`linux-screenshot-baselines` artifact 无任何消费者；
  `generate-snapshots` 不在 `dev` 或 `main` 的 required status checks 里
  （实测 `gh api .../branches/dev/protection` 与 `main/protection`）。
- **文档指针订正属于本票**：两处文档把已删除的 spec 当作现行验证路径，
  与 job 同源（同一批 visual spec 退役）。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` | 删除 `generate-snapshots` job（diff 30 行） | Medium | CI 配置改动。该 job 只在 `workflow_dispatch` 运行，无下游消费者、不在 branch protection 的 required checks 中。验证：删除后其余 job 键集合与命令逐行对比不变；YAML 一次性解析通过；再次 dispatch 时该 job 不再出现。最坏后果：若有人依赖该 artifact，会得到 404——实测仓内无消费者。 |
| `scripts/lib/workflow-playwright-specs.mjs` | 新增纯函数：提取 `playwright test` 命令、提取显式 spec 路径、找缺失路径、找 `--update-snapshots` | Low | 纯新增，无既有消费者。 |
| `scripts/ci-workflow-spec-references.test.mjs` | 新增契约/行为守卫（正对照 + 真实 workflow 扫描） | Low | 纯新增；随 `npm test` 执行。 |
| `docs/conventions/frontend-regression-checklist.md` | 把已删的 `segmented-toggle-visual.spec.ts` 指到实际存在的 geometry spec；把「用 `toHaveScreenshot`」那条改成 geometry/computed-style | Low | 文档订正，无运行时影响；与 `e2e-testing-boundary.md` 的 pixel-baseline 政策对齐。 |
| `docs/design/portfolio-panel-spacing.md` | 把已删的 `portfolio-panel-header-visual.spec.ts` 指到实际存在的 geometry spec | Low | 文档订正，无运行时影响。 |
| `docs/specs/aav-1334-remove-dead-generate-snapshots-job.md` | 新增本 spec | Low | 纯新增。 |
| `docs/DOCS-INDEX.md` | 登记 spec | Low | 纯追加。 |
| `docs/issue-roadmap.md` | 第十五轮 inventory + AAV-1334 状态 | Low | 快照更新。 |

## Behavioral Scenarios（Scenario & Risk Verification Matrix）

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| S1 | 原样恢复被删的 job（两个已删 spec 路径） | 守卫报出两条 missing path，测试红 | High | automated test：`findMissingWorkflowSpecPaths` 对原始命令 fixture 的正对照 | 守卫以「文件必须存在」为判据，不靠 job 名 |
| S2 | 当前 `ci.yml` 不再包含 `generate-snapshots` job | 该 job 键不存在；`linux-screenshot-baselines` 不再产生 | High | automated test：真实 workflow 扫描 + `rg` 静态检查 | 直接断言 job 键不存在（本票的回归钉） |
| S3 | push/PR 触发的 CI 行为 | 与改动前完全一致：e2e desktop/mobile 分片、lint、build 等 job 命令不变 | High | static check：改动前后 job 键与命令 diff；runtime：push 后 CI run | 只删 dispatch-only job，不碰其他 job |
| S4 | `playwright test --project=chromium --shard=1/2`（无显式路径） | 不产生 missing-path 违规 | Medium | automated test：整套件命令 fixture | 只对显式 `.spec.ts` token 做存在性判定 |
| S5 | `npx playwright install --with-deps chromium` | 不被当作 test 命令 | Medium | automated test | 命令提取只匹配 `playwright test` |
| S6 | 多个 spec / 引号包裹 / 注释行 / shell 续行 | 每个显式路径都被提取；注释与续行不丢命令 | Medium | automated test（4 个 fixture） | 行级扫描 + 续行拼接 + 去引号 |
| S7 | 未来新增 workflow 引用不存在的 spec | 守卫在 `npm test` 层直接红，不依赖 GitHub 才暴露 | High | automated test：任意 workflow fixture | 扫描目录而非写死文件名 |
| S8 | workflow 传 `--update-snapshots`（含 `=all` 模式与 `-u`） | 守卫红，提示 pixel baseline 已退役 | High | automated test：原始死 job 命令 + `=all` + `-u` fixture | 与边界文档同一条政策 |
| S9 | 守卫本身空转（正则写错/目录读不到） | 真实树必须至少扫到 2 条 `playwright test` 命令且 ≥10 个 workflow 文件；少于阈值即红 | High | automated test：扫描计数断言 + 死 job fixture 正对照（真实树当前没有显式 spec 路径，fixture 是负载断言） | 防空转阈值 + 正对照 fixture |
| S10 | glob spec（`e2e/*.spec.ts`） | 不做存在性判定，不误报 | Low | automated test | 只判显式路径；glob 行为写进注释 |
| S11 | 删除后 `ci.yml` 仍是合法 YAML、job 图无悬挂 `needs` | 解析成功；无 `needs: generate-snapshots` | High | runtime smoke：一次性 YAML 解析 + `rg needs` | 删除前确认无 `needs` 引用 |
| S12 | 分支保护 | `dev`/`main` 的 required checks 不含 `generate-snapshots` | Medium | runtime-real-data：`gh api branches/{dev,main}/protection` | 删除不会改变 required checks |
| S13 | 活文档仍指向被删 spec | 两处活文档指针改到实际存在的 geometry spec；`rg` 在 `docs/conventions` 与 `docs/design` 不再命中 `*-visual.spec.ts` | Medium | static check：范围化 `rg` + 文档 diff | 同批订正；archive/plans/handoff 属历史材料，明确 out of scope |
| S14 | 手动 dispatch `ci.yml` | 所有 job 绿（`generate-snapshots` 不再存在） | High | runtime-real-data：推送后 `gh workflow run ci.yml --ref dev` 的 run 结果 | 若 dispatch 受权限/代理限制，如实记录未执行 |

## Testing Decisions

- **Seam**：纯函数 `extractPlaywrightTestCommands` / `extractSpecPaths` /
  `findMissingWorkflowSpecPaths` / `findSnapshotUpdateCommands`；
  集成断言读真实 `.github/workflows/` 目录。没有新 seam。
- **Prior art**：`scripts/e2e-static-gate.test.mjs`（配置契约 + 行为负控）、
  `scripts/automation-branch-guard.test.mjs`（从 workflow 源码抽真实脚本执行）。
- **先红后绿**：先加守卫测试，对当前树跑 → 必须因两个已删 spec 红；
  再删 job → 同一测试转绿。红/绿用同一条命令，避免「测试只证明跑过」。
- **Mutation**：删掉 `findMissingWorkflowSpecPaths` 里的 `exists` 判定，
  S1/S7 必须红；去掉 `--update-snapshots` 判定，S8 必须红。
- 不测试 YAML 库行为；YAML 合法性用一次性 runtime smoke 验证。

## Tickets（tracer bullet）

1. **T1 — 守卫先红**：新增纯函数 + `scripts/ci-workflow-spec-references.test.mjs`；
   对当前树运行，S1/S2/S8 因死 job 红。无 blocker。
2. **T2 — 删 job 转绿**：删除 `generate-snapshots`；重跑同一守卫，S1–S11 绿。
   Blocked by T1（先证明守卫能抓到该 bug）。
3. **T3 — 文档与登记**：订正两处活文档指针 + spec/DOCS-INDEX/roadmap。
   Blocked by T2（需要最终的 job 状态作为证据）。

## Out of Scope

- 恢复任何 screenshot baseline 能力（边界文档已否决）。
- 把守卫扩成通用 workflow linter（YAML schema、action pin、权限检查）。
- 修正 `docs/handoff-playwright-flaky-fixes.md`、`docs/archive/`、`docs/plans/` 等历史材料中的旧 spec 名。
- 修 `e2e/segmented-toggle.spec.ts` 内部的 per-platform `test.skip`（违反 AGENTS.md 的
  「禁止按 platform 互斥 skip」）。这是既有问题，本票只订正文档指针，不重写该 spec。
- 其他 workflow 的 dispatch-only job 审计（本次只处理 `generate-snapshots`；
  守卫会在未来同类漂移时兜底）。
- 把 e2e 提为 required check（AAV-1349 已判定需单独拍板）。

## Verification Evidence

**先红（删 job 前，`node --test scripts/ci-workflow-spec-references.test.mjs`）**：
12 条用例中 3 条红，全部命中真实 `ci.yml`：

- `the real workflow tree has no missing spec references` → 报出
  `e2e/segmented-toggle-visual.spec.ts` 与 `e2e/portfolio-panel-header-visual.spec.ts`；
- `the real workflow tree never writes pixel baselines` → 报出原命令的
  `--update-snapshots`；
- `the dead dispatch-only job is gone from ci.yml` → `generate-snapshots` 仍在。

**后绿**：删除 job 后同一命令 **14/14 pass**（新增 2 条 review follow-up 用例：
`--grep` 选项值不得当路径、`pnpm exec` 前缀必须识别）。

**Mutation**：

| Mutation（当时 12 条用例） | 结果 |
| --- | --- |
| `if (!exists(specPath))` → `if (false && …)` | 1 红：`reports both deleted visual specs from the historical job (S1, S7)` |
| `if (UPDATE_SNAPSHOTS_FLAG.test(command))` → `if (false)` | 1 红：`reports --update-snapshots and -u (S8)` |

**YAML / job 图（一次性 runtime smoke，js-yaml 仅作本地验证）**：

```
jobs: peer-dep-check, socket-firewall, lint, build, e2e-desktop, e2e-mobile,
live-schema-validation, live-simulation-validation, content-security-check,
repo-policy, openapi-check, security-audit, openapi-sync
has generate-snapshots: false
needs edges: [["openapi-sync",["openapi-check"]]]
```

`git show HEAD:.github/workflows/ci.yml` 与工作区的 job 键排序 diff 只有一行：
`< generate-snapshots`。

**分支保护（`gh api`，2026-11-16）**：

- `dev` required checks：`lint`, `build`, `peer-dep-check`；
- `main` required checks：`lint`, `build`, `Analyze (javascript-typescript)`,
  `peer-dep-check`, `security-audit`, `CodeQL`, `Socket Security: Project Report`,
  `Socket Security: Pull Request Alerts`, `content-security-check`,
  `branch-flow-guard`。
- 两者都不含 `generate-snapshots`，删除不会改变 required checks。

**门禁**：

- `npm run typecheck` → rc=0；
- `npm run lint` → 0 errors / 74 warnings（与基线一致）；
- `npx vitest run` → **4405 passed / 14 skipped / 6 todo**；
- `npm test` 的 scripts 段 → **284 passed / 67 suites**（含本票 14 条）；
- `npm run ci:remote` → exit 0（`npm audit` 仍报 11 high，既有 zod/@reown 链，
  脚本按设计只警告）；
- Prettier `--check` 对全部改动文件通过。

**文档指针**：

- `docs/conventions` + `docs/design` 范围内不再命中
  `*visual.spec.ts`；两处活指针已改为 `e2e/segmented-toggle.spec.ts` 与
  `e2e/portfolio-panel-header.spec.ts`，两者均存在。
- `docs/handoff-playwright-flaky-fixes.md`、`docs/archive/`、`docs/plans/`
  仍含历史 spec 名，按 Out of Scope 保留。

**未执行**：推送后的 `gh workflow run ci.yml --ref dev`（票面 S14 /
验收条件 1）。该动作会写远端 workflow run，需显式授权；本地已用 YAML 解析、
job 键 diff 与守卫覆盖其失败机制。
