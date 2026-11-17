# AAV-1362 — Hardcode Sync 的机器人推送不得运行开发者本地 git hook

> Status: implemented 2026-11-17 · Issue: [AAV-1362](https://linear.app/aaveapy/issue/AAV-1362) · Type: CI workflow fix
> Scope: 只让 Hardcode Sync 自己的机器人提交/推送跳过 `.husky/pre-push`，不改 hook 本身、不改其他 workflow。
> 姊妹 spec：[`aav-1362-release-age-override-hint.md`](aav-1362-release-age-override-hint.md)（同一 ticket 的第二阶段根因：release-age 提示指向不存在的出口）。

## 背景与根因

`hardcode-sync.yml` 的 `Create PR when hardcode changed` 用 `peter-evans/create-pull-request` 在 runner 上 `git commit` + `git push`。runner 不是裸环境：`npm ci` 触发 `prepare`，husky 把 `core.hooksPath` 指到 `.husky/_`，于是**机器人的 push 会跑开发者的 pre-push 门**。

`.husky/pre-push` 做两件事：`ci:remote`（typecheck + lint + 全量 vitest + build + audit）与 `test:e2e:pre-push`（`scripts/pre-push-e2e.mjs`）。后者要求本机装有 Playwright chromium；runner 的 `~/.cache/ms-playwright` 是空的。AAV-1349 把「浏览器缺失 ⇒ 0 条测试也当失败」写成了硬阻断：

```
❌ [pre-push] BLOCKED: e2e gate CANNOT RUN — Playwright chromium is not installed.
   Reason: no Playwright browser cache at /home/runner/.cache/ms-playwright
   A 0-test browser run is not a pass — this gate blocks until browsers exist (AAV-1349).
husky - pre-push script failed (code 1)
error: failed to push some refs to 'https://github.com/0xPabloLI/aaveapy'
```

因此 schedule 一旦真的有资产要同步，就在第 10 步死掉——**门禁是给开发机的，机器人替它跑一遍只会把整个套件重跑一次然后失败**。

这不是回归，是同一 ticket 的**第三种结构性自相矛盾**：deep 两次修的分别是「自己拉的版本太新」（release-age 拦住 sync 自己）与「提示指向不存在的出口」；本条是「机器人推送被开发者本地门禁拦住」。

### 证据

| 事实 | 证据 |
| --- | --- |
| 失败发生在 `Create PR` 这一步 | run `43870754983`（2026-11-16T12:54:11Z，`schedule`）：`hardcode-sync (dev)` job `133310986515` step 10 `failure`；Round 1 sync/verify step 6/7 `success` |
| `main` 分支同一步是绿的 | 同一 run 的 `hardcode-sync (main)` job `133310986977` 全绿—— `main` 没有资产变更，PR 步骤空转，没有 push 也就没有 hook |
| 失败来自 pre-push 而非 git 本身 | job 日志 `gh api .../actions/jobs/133310986515/logs` 的末尾：`ci:remote` 的 vitest/audit 输出 → e2e 门 BLOCKED → `husky - pre-push script failed (code 1)` → `error: failed to push some refs` |
| 阻断条件是环境事实，不是代码 bug | `scripts/pre-push-e2e.mjs` 检查 `~/.cache/ms-playwright`；runner 上恒为空 |
| 11-15 的绿是「恰好没有 push」 | run `43711695827` success；11-16 一有变更即复现 ⇒ 修复前该 job 的通过与否取决于「今天有没有资产漂移」，不是取决于代码 |

## 决策

在 `Create PR when hardcode changed` 这一步加 `HUSKY: '0'`。husky 9 的 shim（`.husky/_/h`）在跑 hook 脚本前就 `[ "${HUSKY-}" = "0" ] && exit 0`，所以这是 husky 官方语义里的**显式关停**，而不是绕门禁的自定义手法。

理由：

* **作用域最小**：只作用于机器人这一步。开发者、其他 workflow、其他 hook 全部不变。
* **不弱化任何真实门禁**：这一步不是「开发者提交」，它前面已有 Round 1/2 的 `hardcode:sync` + `hardcode:verify` 作为本 job 的验证，PR 开出后还要过 CI 的 lint/build/测试。在 runner 里再跑一遍 `ci:remote` 是纯重复；跑 e2e 则与「重新生成硬编码资产」这个任务无关。
* **不装浏览器**：给 sync job 装 ~120 MB chromium 只为让 hook 的 e2e 门放行，是拿 4 分钟和一份新缓存换取零信息。

否决的方案：

| 方案 | 否决理由 |
| --- | --- |
| `git config --local core.hooksPath /dev/null` | 要成对恢复，且会影响该 job 后续步骤；`HUSKY=0` 是官方一层开关 |
| 让 `.husky/pre-push` 在 `CI=true` 时直接跳过 | 把「本地门禁」改成「CI 也永远不跑」，作用面扩到所有 CI 推送；本票只需要一个 bot 的一步 |
| 给该 job 装 Playwright 浏览器 | 为误差为零的重复验证付出体积/时长，且 e2e 全套与该 job 的产物无关 |
| `git push --no-verify` | 该 action 没有暴露 push 参数（`action.yml` 无 `git-push-args`），只能从 action 内部改，不可行 |

## 设计

```yaml
      - name: Create PR when hardcode changed
        id: cpr
        env:
          HAS_GAPS: ...
          GAP_SUMMARY: ...
          # 机器人提交/推送不跑本地 hook：pre-push 的 ci:remote + e2e 需要开发机，
          # runner 没有 Playwright 浏览器（AAV-1349 起硬阻断，run 43870754983）。
          HUSKY: '0'
        uses: peter-evans/create-pull-request@...
```

守卫测试 `scripts/hardcode-sync-hook-guard.test.mjs` 钉住三件事：该步骤仍带 `HUSKY: '0'`；该步骤仍是真正 commit/push 的 action；PR 仍被 verify 回合门控。测试随既有 `npm test` 的 `node --test "scripts/**/*.test.mjs"` 执行，不新增 hook 或脚本入口。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| S1 | schedule 有资产漂移 ⇒ 走 Create PR 步骤 | 机器人的 commit/push 不触发 pre-push，步骤绿 | 又回到「每天红」 | run `43870754983` 为红侧基线；修复后由真实运行验证 | 守卫测试断言 `HUSKY: '0'` |
| S2 | 有人清理 workflow 时删掉这行 env | 守卫测试变红 | 静默恢复每日红 | `node --test scripts/hardcode-sync-hook-guard.test.mjs` 的 S1 用例 | 测试即文档 |
| S3 | 开发者本机 `git push` | 仍跑 `ci:remote` + e2e 门（浏览器缺失仍 BLOCKED） | 误以为 hook 被全局关停 | 修复只改 workflow 的 step env，`.husky/pre-push` 未改 | 作用域最小 |
| S4 | `main` 分支无资产变更 | PR 步骤空转、job 绿（行为不变） | 误判修法多余 | 11-16 的 `hardcode-sync (main)` 已绿 | 不改 `if:` 条件 |
| S5 | verify 回合失败 | PR 步骤不运行，job 由最后的失败步骤收口 | 用 HUSKY 绕过了「脚本本身失败」 | PR 步骤 `if:` 仍要求某一轮 verify `passed == 'true'`；守卫 S5 断言该门在 | 只关 hook，不关验证 |
| S6 | 有人把 `HUSKY: '0'` 写成 `0`（数字）或 `'1'` | 守卫测试红 | YAML 类型漂移让 husky 不认 | 守卫 S4 用例同时断言未加引号的 `0` 与 `'1'` 都不算通过 | 断言的模式要求带引号的 `'0'` |
| S7 | `peter-evans/create-pull-request` 被替换成别的 action | 守卫 S2 红，迫使人重新判断新 action 的 push 路径 | 新 action 可能自带 `--no-verify` 或又跑 hook | 守卫断言 `uses: peter-evans/create-pull-request@` 与既有 commit-message | 契约测试 |
| S8 | 同仓其他会 push 的 workflow（`ci-auto-remediation` / `token-icon-sync` / `ci` / `sync-dev-with-main`） | 本次不改；`ci.yml` 甚至有意生成 manifest 去满足 pre-commit（AAV-1298） | 它们可能在下次触发时撞同一个门 | 未在本票验证 | 记在 Out of Scope，需要时按同一手法单独评估 |

## Testing Decisions

**Seam.** workflow YAML 是唯一被测对象：`stepBlock(source, name)` 切出该步骤的文本块，`bypassesLocalHooks(block)` 是纯谓词。同文件既有先例：`scripts/ci-workflow-spec-references.test.mjs` 直接读 `.github/workflows/*.yml`。

**Good test.** 只断言外部可见契约（步骤里写了 `HUSKY: '0'`、仍是哪个 action、PR 仍被 verify 门控），并用 mutation 控制证明谓词会红。不断言注释文案、不断言 env 顺序。

**Runtime smoke.** 在仓库里直接执行 husky 的 hook 入口，验证 shim 语义而非猜测：

```bash
HUSKY=0 .husky/_/pre-push; echo $?   # → 0，且无 ci:remote / e2e 输出
```

## Out of Scope

* 改 `.husky/pre-push` 本身，或给其他 workflow 加同类 env。
* 给 sync job 安装 Playwright 浏览器 / 在 sync job 里跑 e2e。
* AAV-1349 的 e2e 门语义（浏览器缺失仍阻断）。
* `hardcode-sync.yml` 的触发面、matrix、`report-failure` 行为。

## Verification Evidence

### 静态与单元

* `node --test scripts/hardcode-sync-hook-guard.test.mjs` → **5/5 passed**（S1–S5）。
* `node --test "scripts/**/*.test.mjs"` → **315 passed / 0 failed**（76 suites）。
* YAML 解析（`YAML.parse`）后该步骤的 `env.HUSKY` 读回 `"0"`（字符串，不是数字）。
* `npx prettier --check` 对改动文件全绿；`eslint` 不覆盖 `scripts/*.test.mjs`（仓库既有 ignore）。

### Runtime smoke（临时仓库，复刻 runner 的失败形态）

`/tmp` 下建一个 bare remote + work 仓库，把真实的 `.husky/pre-push` 复制进去，`ci:remote` 打桩成成功、`test:e2e:pre-push` 打桩成 runner 上的同一句 `BLOCKED: e2e gate CANNOT RUN — Playwright chromium is not installed`（`exit 1`），`core.hooksPath=.husky/_`：

```
=== 1) 默认（模拟 runner，浏览器缺失）===
❌ [pre-push] BLOCKED: e2e gate CANNOT RUN — Playwright chromium is not installed.
❌ [pre-push] BLOCKED: ci:remote 或 e2e 失败 — 修根因，不要绕 hook。
error: failed to push some refs to '../remote.git'
default exit=1

=== 2) HUSKY=0 ===
husky0 exit=0

=== 远端 refs ===
25088b48e697921ef69d8519d12e44688303fbdb	refs/heads/test2
```

即：同一份 hook、同一个仓库，只差 `HUSKY=0` ⇒ 从 `exit 1` 变为 `exit 0` 且 ref 真的落到远端。临时目录用后删除。

### 已推送

* `c64674d5` — workflow 修复 + 守卫测试；`3790f77d` — 本 spec 与文档。
* `origin/dev` 已是 `3790f77d`；远端文件 `.github/workflows/hardcode-sync.yml@dev` 第 133 行是 `Create PR when hardcode changed`、第 152 行是 `HUSKY: '0'`。

### 真实运行（owner 授权后手动 dispatch）

`gh workflow run hardcode-sync.yml --ref dev` → run **`44026720906`**（2026-11-17），conclusion **success**：

| job | step 6 Round 1 sync | step 7 Round 1 verify | step 10 Create PR | step 11 approve + auto-merge |
| --- | --- | --- | --- | --- |
| `hardcode-sync (dev)` | success | success | **success** | **success** |
| `hardcode-sync (main)` | success | success | success（无变更，空转） | skipped |
| `report-failure` | — | — | 整个 job skipped | — |

产物是 PR **#850**（`bot/hardcode-sync-dev` → `dev`，`chore(hardcode): sync hardcoded assets and mappings`）——即 `git push` 真的落到了 GitHub，而不是「没有变更所以绿」。这正是 11-16 被 `.husky/pre-push` 拦死的那条路径。

