# AAV-1362 — release-age 门禁的覆盖提示必须指向真实出口

> Status: implemented 2026-11-15 · **issue 仍 In Progress**（唯一未完成验收项 S8：2026-11-16 04:20 UTC 的真实 schedule 运行） · Issue: [AAV-1362](https://linear.app/aaveapy/issue/AAV-1362) · Type: CI gate messaging fix (supply-chain control)
> Scope: 只修失败提示与文档，不改门禁检测逻辑、默认 7 天窗口或安全控制出口。路线 A（移除 proactive bump）已由 `8830d062` 落地。

## 背景与根因

`scripts/check-dep-release-age.mjs` 在 direct dependency 的发布年龄不足 7 天时以 `exit 1` 阻断，并在失败提示里给出三条出口：

```
Options:
  - Wait 7 day(s) and re-run ...
  - Pin the previous known-good version
  - Override deliberately for this PR: MIN_RELEASE_AGE_DAYS=0 in the workflow dispatch,
    documented in the PR description ...
```

第三条指向一个**不存在的入口**：

* `.github/workflows/hardcode-sync.yml:4` 是裸 `workflow_dispatch:`，没有 `inputs:`；
* `.github/workflows/ci.yml` 的 `workflow_dispatch` 只有 `target_ref`；
* 全仓 `rg min_release_age_days` 在 workflows 里零命中，只有脚本读取 `process.env.MIN_RELEASE_AGE_DAYS`；
* `SECURITY.md` 同样复述了「`MIN_RELEASE_AGE_DAYS=0` via workflow dispatch」。

这不是主修复的回归，而是主修复暴露出来的第二层缺陷：`8830d062` 移除 Hardcode Sync 的 `npm update`（路线 A，bump 归 Renovate）之后，门禁不再被 sync 的 day-zero bump 触发；但任何一次真实的 direct dependency 阻断仍会告诉操作者走一条走不通的路。与 AAV-1294/AAV-1330/AAV-1349 同族：**出口不可达，却看起来像一条可执行的补救路径**。

### 时间线与证据

| 事实 | 证据 |
| --- | --- |
| 主修复在 `main` 上 | `8830d062` 随 #835 进入 `main`，merge `b9c30868`（2026-11-15 10:07 +0800） |
| 11-14 的 schedule 仍跑旧定义 | run `43590803422` 的 `headSha` 是 `524a9de7`（旧 `main`），main job 在第 11 步 `Create PR when hardcode changed` 失败；旧定义含 `Update address-book to latest` / `npm update` |
| 下一次 schedule 才会用新定义 | cron `20 4 * * *`（UTC）；下一次 2026-11-16 04:20 UTC 读取 `main` 的 `b9c30868` |
| 错误出口确实不存在 | `hardcode-sync.yml` 无 `inputs`；`ci.yml` 只有 `target_ref`；`rg min_release_age_days .github` 零命中 |
| 文档复述同一错误 | `SECURITY.md` 的 Minimum release age 段写「`MIN_RELEASE_AGE_DAYS=0` via workflow dispatch」 |

## 决策

用户拍板 **A**：保持已上线的「无 proactive bump」，不新增 `workflow_dispatch` 豁免输入。理由：

* sync 不再采纳 day-zero 版本，B 要解决的「sync 自己被门禁拦住」已经不存在；
* 新增 dispatch input 会扩大安全控制的出口，而当前没有消费者；
* 真正需要 day-zero 的例外应走「在运行门禁的环境里显式设 `MIN_RELEASE_AGE_DAYS=0` + 在 PR 里记录根因」，CI 侧例外则需要同 PR 审查 workflow 变更。

因此本次只做两件事：把失败提示改成真实可执行的说明；用测试钉住「提示不得承诺不存在的 workflow input」。

## 设计

### 单一提示来源

在既有的纯函数模块 `scripts/lib/dep-release-age-parse.mjs` 增加：

```js
export function formatReleaseAgeOverrideHint() {
  return [
    '  - Override deliberately for this PR: set MIN_RELEASE_AGE_DAYS=0 in the environment that runs the gate,',
    '    and document the root cause in the PR description. No workflow_dispatch input sets this value;',
    '    a CI-side exception requires a reviewed change to the workflow that invokes the gate.',
  ].join('\n');
}
```

`scripts/check-dep-release-age.mjs` 导入该函数并使用；提示不再由脚本手写。函数放在既有 helper 模块，避免为了两行文案引入新模块。

### 文档对齐

`SECURITY.md` 的 Minimum release age 段改为同一语义：显式环境覆盖 + PR 记录根因，并明确「默认 CI 没有 dispatch input」。不新增安全控制出口。

### 测试 seam

最高 seam 是 `formatReleaseAgeOverrideHint`（纯函数，已有 `src/test/depReleaseAge.test.ts` 覆盖同一模块）。静态契约用现有测试风格读取脚本、`SECURITY.md` 与 `.github/workflows/*.yml`，不引入 YAML 解析依赖。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `scripts/lib/dep-release-age-parse.mjs` | 新增导出的 `formatReleaseAgeOverrideHint()` | Low | 纯追加；不改变任何解析函数 |
| `scripts/lib/dep-release-age-parse.d.mts` | 声明 `formatReleaseAgeOverrideHint(): string` | Low | 纯追加类型声明；vitest 从 TS 导入 JS 模块所需 |
| `scripts/check-dep-release-age.mjs` | 用共享提示替换两条硬编码 `console.error` | Low | 只改失败文案；退出码、检测逻辑、默认 7 天窗口不变 |
| `src/test/depReleaseAge.test.ts` | 新增提示文本、脚本、文档与 workflow 契约测试 | Low | 测试 only；复用既有 vitest 文件 |
| `SECURITY.md` | 删除不存在的 dispatch 出口，改述环境变量覆盖 | Low | 文档 only；不改变策略本身 |
| `docs/specs/aav-1362-release-age-override-hint.md` | 新增本 spec | Low | 新文件 |
| `docs/DOCS-INDEX.md` | 登记本 spec | Low | 索引 only |
| `docs/issue-roadmap.md` | 更新 AAV-1362 状态与待验证项 | Low | 快照 only |
| `docs/lessons/infrastructure.md` | 记录「安全门提示必须指向真实出口」 | Low | 追加 lesson |
| `SESSION-BOARD.md` | 登记/注销本 session | Low | 协调 only |

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| S1 | 默认 7 天窗口下，direct dependency 太新，门禁阻断 | `exit 1`；提示给出 `MIN_RELEASE_AGE_DAYS=0` 的真实环境覆盖 + PR 根因记录；不承诺 dispatch input | 操作者按错误提示找不到出口 | runtime smoke（临时 git repo，`MIN_RELEASE_AGE_DAYS=100000` 强制阻断，真实 `npm view`）+ unit test | 提示由共享函数生成，测试断言含真实出口且不含旧短语 |
| S2 | transitive dependency 太新 | 仅 warning，`exit 0`；行为不变 | 误把 transitive 也阻断 | 既有代码路径；本次未改 | 不改分类逻辑 |
| S3 | `MIN_RELEASE_AGE_DAYS=0` 在运行环境里显式设置 | 门禁禁用，`exit 0`，打印禁用信息 | 误以为覆盖仍走 dispatch | `MIN_RELEASE_AGE_DAYS=0 npm run check:dep-age -- --staged` | 提示与 SECURITY.md 明确这是环境变量覆盖 |
| S4 | 没有 lockfile 变更 | 平凡通过，`exit 0` | 空 diff 被误报 | `npm run check:dep-age -- --staged` | 既有逻辑 |
| S5 | 未来有人给 workflow 增加 `min_release_age_days` input | 契约测试变红，强制同步更新提示/文档 | 提示再次与 workflow 能力漂移 | 静态测试扫描 `.github/workflows/*.yml` | 测试把「提示引用的出口」与「workflow 实际 input」绑在一起 |
| S6 | 人读 `SECURITY.md` | 不再出现「via workflow dispatch」；明确「无默认 dispatch input」 | 文档继续误导 | 静态测试读 `SECURITY.md` + `rg` | 与脚本提示同义 |
| S7 | CI 打印失败提示 | 不含不存在的 input 引用；操作者可执行 | 失败时浪费一轮排查 | 脚本源码静态测试 + S1 的 runtime 输出 | 共享提示 |
| S8 | 2026-11-16 的 schedule 运行 | 使用新 `main`（无 `npm update`），门禁不再被 sync 的 day-zero bump 触发；job 绿或失败原因与发布年龄无关 | 仍需真实运行验证 | 外部 GitHub Actions run（用户选择不手动 dispatch，等待 11-16） | 本轮保持 Linear In Progress，评论记录唯一待验证项 |

## Testing Decisions

**Seam.** `formatReleaseAgeOverrideHint()` 是纯函数，位于 `scripts/lib/dep-release-age-parse.mjs`。测试放在既有的 `src/test/depReleaseAge.test.ts`，与解析函数的测试同文件。

**Good test.** 只断言外部可观察行为：提示文本包含真实出口、不包含旧短语；脚本使用共享函数；`SECURITY.md` 不再复述不存在入口；workflow 里今天没有 `min_release_age_days` input。不断言 `console.error` 的调用次数或内部变量。

**Prior art.** `scripts/hook-failure-propagation.test.mjs` 读取 hook 源码执行真实门禁行；`scripts/workflow-graphql-fields.test.mjs` 扫描 workflow 源码；`src/test/depReleaseAge.test.ts` 已有 F 系列锁文件解析回归测试。

**Runtime smoke.** 在 `/tmp` 建一个最小 git repo，`package.json` 含 `left-pad@1.3.0`，lockfile 先提交、再把含 `node_modules/left-pad` 的版本 staged；用 `MIN_RELEASE_AGE_DAYS=100000` 强制走「太新」分支，真实调用 `npm view left-pad@1.3.0 time --json`，确认输出新提示且 `exit 1`。临时目录用后删除。

## Out of Scope

* 路线 B：给 `workflow_dispatch` 增加 `min_release_age_days` input。
* 修改默认 7 天窗口、transitive 分类、registry 查询失败时的 fail-open 行为。
* 手动 dispatch Hardcode Sync（用户选择等 11-16 的真实 schedule）。
* 把 e2e 加进必填检查（AAV-1349）。
* 在 11-16 运行前把 AAV-1362 标为 Done。

## Verification Evidence

### RED → GREEN

- 先写测试（`src/test/depReleaseAge.test.ts` 新增 `formatReleaseAgeOverrideHint` 组）：
  `npx vitest run src/test/depReleaseAge.test.ts` → **5 failed / 18 passed**。当时
  `scripts/lib/dep-release-age-parse.mjs` 还没有该导出，`npm run typecheck` 报
  **TS2305**（模块没有导出成员），补 `dep-release-age-parse.d.mts` 声明后消失。
- 实现后：`npx vitest run src/test/depReleaseAge.test.ts` → **23/23 passed**。
- 审查修复后（新增「workflow input 拼写」用例、收紧单一来源断言）：
  **24/24 passed**。

### Runtime smoke（真实 registry）

临时 git repo（`/tmp`，用后删除；复制本仓脚本与 helper），`package.json` 声明
`left-pad@1.3.0`，先提交不含该包块的 lockfile，再 stage 含
`node_modules/left-pad` 的 lockfile：

```bash
MIN_RELEASE_AGE_DAYS=100000 node scripts/check-dep-release-age.mjs --staged
```

输出（节选）并 `exit=1`：

```
Checking 1 adopted version(s) (1 direct, 0 transitive) for minimum release age of 100000 day(s)…
❌ Dependency release-age gate BLOCKED — direct dependencies younger than 100000 day(s):
   left-pad@1.3.0 — published 2018-04-09T01:10:45.796Z

Options:
  - Wait 100000 day(s) and re-run (preferred: let the supply-chain window close)
  - Pin the previous known-good version
  - Override deliberately for this PR: set MIN_RELEASE_AGE_DAYS=0 in the environment that runs the gate,
    and document the root cause in the PR description. No workflow_dispatch input sets this value;
    a CI-side exception requires a reviewed change to the workflow that invokes the gate.
```

正常路径与显式禁用：

```bash
npm run check:dep-age -- --staged
# No package-lock.json changes against base — release-age gate satisfied trivially.  (rc=0)

MIN_RELEASE_AGE_DAYS=0 npm run check:dep-age -- --staged
# MIN_RELEASE_AGE_DAYS=0 — release-age gate disabled.  (rc=0)
```

### Full local gate

`npm run ci:remote` → **exit 0**：

- Vitest: **190 files passed / 3 skipped**；**4253 tests passed / 14 skipped / 6 todo**。
- `node --test` scripts: **246 pass / 0 fail**。
- ESLint: **0 errors / 74 warnings**（均为既有 complexity 警告）。
- Build 与 `check-csp-inline-scripts`：通过。
- `npm audit --omit=dev --audit-level=high`：仍报 **11 high**，全部是既有的 zod 3
  链（`GHSA-mrhx-c7xc-m3w5`，AAV-1348 已按「无法真修」记录并豁免），本 diff 未改依赖。

`npm run typecheck` → clean；`npx prettier --check`（全部改动文件）→ clean；
`git diff --check` → clean。

### Not yet verified

- **S8**：2026-11-16 04:20 UTC 的真实 Hardcode Sync schedule 运行。用户选择不手动
  dispatch；AAV-1362 保持 In Progress，待该 run 绿后再关票。
- **pre-push**：本 spec 的证据记录于 commit 前；`.husky/pre-push` 在推送时执行
  （`ci:remote` + e2e + osv + semgrep + knip + dup），结果以推送日志为准。

## Further Notes

* `main` 上当前的 workflow 定义已经是 `8830d062` 之后的版本（矩阵 `[dev, main]`，无 `npm update`）。
* 11-14 的失败不代表新定义失败：run `43590803422` 的 `headSha` 是 `524a9de7`，旧定义仍在 main 上。
* Linear AAV-1362 的唯一未完成验收项是 S8；本轮交付评论会明确写出这一点，不提前关票。
