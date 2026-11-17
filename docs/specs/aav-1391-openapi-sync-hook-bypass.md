# AAV-1391 — 机器人 PR 推送不得运行开发者本地 git hook

> Status: implemented 2026-11-17 · Issue: [AAV-1391](https://linear.app/aaveapy/issue/AAV-1391) · Type: CI workflow fix
> Scope: 所有 `peter-evans/create-pull-request` 步骤加 step-scoped `HUSKY: '0'`；不改 `.husky/pre-push`、不改开发者或其他 workflow 的行为。
> 姊妹 spec：[`aav-1362-hardcode-sync-hook-bypass.md`](aav-1362-hardcode-sync-hook-bypass.md)（首个实例：hardcode-sync 的机器人推送）。

## 背景与根因

`npm ci` 触发 `prepare`（`npx husky && node scripts/husky-hooks-path.mjs`），runner 的工作树因此带着 `.husky/pre-push`。CI 里的机器人 PR 步骤用 `peter-evans/create-pull-request` 在 runner 上 `git commit` + `git push`，git 会跑这个 hook；hook 先跑 `ci:remote`（typecheck/lint/vitest/build/audit），再跑 `test:e2e:pre-push`。后者要求本机装有 Playwright chromium，runner 的 `~/.cache/ms-playwright` 恒为空；AAV-1349 把「浏览器缺失 ⇒ 0 条测试也当失败」写成硬阻断：

```
❌ [pre-push] BLOCKED: e2e gate CANNOT RUN — Playwright chromium is not installed.
   Reason: no Playwright browser cache at /home/runner/.cache/ms-playwright
husky - pre-push script failed (code 1)
error: failed to push some refs to 'https://github.com/0xPabloLI/aaveapy'
```

AAV-1362 已为 hardcode-sync 修掉同一问题（step 级 `HUSKY: '0'`）。本票是同一结构缺陷在 `openapi-sync` 的复发：2026-11-16 起后端 spec 持续漂移，`dev` 每次 push 都让 `openapi-sync` 真正执行并在「Create spec sync PR」的 push 处失败——`AAV-1390`（🔥 Dev CI failure）因此积累了 11 条连红记录（`2d45c91` → `a76b6ad`）。

**2026-11-17 15:35 的 `8fe76047` 已按同一决策修掉 openapi-sync**，并由真实运行验证：run `44040361980` 在 dev 上开出 `bot/openapi-sync-44040361980` → PR #852（07:40Z 创建、07:41Z 合并），后续 dev CI run `44046072307`（`06245b83`）全绿。本变更收口同一不变量的剩余两处（`token-icon-sync` / `ci-auto-remediation`）并加统一守卫，防止第四处复发；`ci.yml` 的 env 块沿用 `8fe76047` 的写法，不重复引入。

### 证据

| 事实 | 证据 |
| --- | --- |
| 失败发生在「Create spec sync PR」的 push | run `43867040116`（首红，`2d45c91`）与 run `44039789059`（最新红，`a76b6ad`）的日志尾部：`husky - pre-push script failed (code 1)` → `failed to push some refs` |
| 阻断条件是环境事实，不是业务失败 | 同一 run 的 `openapi-check` 已输出 `drift=true`；`openapi-sync` 的 fetch/codegen/diff 全部 success，死点只在 push |
| 「以前没红」是判据没触发 | job 的 `if:` 要求 `needs.openapi-check.outputs.drift == 'true'`；无漂移时 job 直接 skipped |
| openapi-sync 修复已被真实运行验证 | `8fe76047` → run `44040361980` 成功开出 PR #852（07:40Z），PR 07:41Z 合并；dev CI run `44046072307` success |
| 同族潜伏存在 | `token-icon-sync`（schedule，dev+main matrix）与 `ci-auto-remediation`（`workflow_run`）同样 `npm ci` + `create-pull-request`，且没有 `HUSKY: '0'`；它们只是在「今天恰好有变更」时才会撞上同一堵墙 |
| 机器人步骤的验证不依赖 pre-push | `openapi-sync` 有 drift 判据与前序 fetch/codegen；`token-icon-sync` 有 sync 步骤；`ci-auto-remediation` 有 `ci:auto-fix` + 自有 validate 回合；PR 开出后仍走 CI 的 lint/build/测试 |

## 决策

**给每个 `peter-evans/create-pull-request` 步骤加 step-scoped `HUSKY: '0'`（openapi-sync 已由 `8fe76047` 落地），并用一条守卫测试枚举全部此类步骤。**

husky 9 的 shim（`.husky/_/h`）在跑 hook 脚本前执行 `[ "${HUSKY-}" = "0" ] && exit 0`——这是 husky 官方语义里的显式关停，不是自定义绕门禁手法。作用域只到「机器人提交/推送」这一步：开发者、其他 workflow、其他 hook 全部不变。

理由：

* **作用域最小且一次收口**：四个机器人 PR 步骤同构（hardcode-sync 已有），一处守卫枚举全部，避免第四处再犯。
* **不弱化任何真实门禁**：这些步骤不是开发者提交；各自有产物校验，PR 开出后还要过 CI。runner 里再跑一遍 `ci:remote` 是纯重复，跑 e2e 与产物无关。
* **不装浏览器**：为让 hook 放行而装 ~120 MB chromium，只为零信息的重复验证。

否决的方案：

| 方案 | 否决理由 |
| --- | --- |
| `E2E_SKIP=1` | 仍会跑一遍 `ci:remote` 再开 e2e 的 deliberate-skip 出口；语义是「跳过 e2e」而非「机器人推送不该跑开发者门禁」，且要求每个 push 点各自记得设 env |
| `git config --local core.hooksPath /dev/null` | 要成对恢复，且影响该 job 后续步骤；`HUSKY=0` 是官方一层开关 |
| 让 `.husky/pre-push` 在 CI 中跳过 | 把本地门禁改成「CI 永远不跑」，作用面扩到所有 CI 推送 |
| 给 job 装 Playwright 浏览器 | 体积/时长换零信息，且 e2e 全套与这些产物无关 |
| `git push --no-verify` | action 未暴露 push 参数，不可行 |

## 设计

四个 step 各加一段带注释的 env（注释解释「为什么必须在这里关」）：

| Workflow | Step | 产物 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `Create spec sync PR`（`openapi-sync` job） | OpenAPI spec + generated schemas |
| `.github/workflows/token-icon-sync.yml` | `Create PR when icons changed` | token icon assets |
| `.github/workflows/ci-auto-remediation.yml` | `Create remediation PR` | dependency remediation |
| `.github/workflows/hardcode-sync.yml` | `Create PR when hardcode changed`（AAV-1362 已加） | hardcoded assets |

```yaml
        env:
          # 机器人提交/推送不跑开发者本地 hook：`.husky/pre-push` 的 ci:remote +
          # e2e 门需要装有 Playwright 的开发机，runner 恒为空（AAV-1349 起硬阻断；
          # openapi-sync 现场 run 44039789059，AAV-1362/AAV-1391）。
          HUSKY: '0'
```

守卫测试 `scripts/bot-push-hook-guard.test.mjs`（`node:test`，随既有 `npm test` 的 `node --test "scripts/**/*.test.mjs"` 执行，不新增 npm script / hook）：

* 枚举 `.github/workflows/*.yml` 中所有 `uses: peter-evans/create-pull-request@` 的步骤块；
* 每个步骤块必须带带引号的 `HUSKY: '0'`（step 级）；
* 枚举条数必须等于 action 出现次数（防止 block 解析漏步骤而假绿）；
* `HUSKY:` 只允许出现在这类步骤块内（防止有人把开关提到 job/workflow 级，扩大作用面）；
* `.husky/pre-push` 仍保留 `ci:remote` + `test:e2e:pre-push`（开发者门禁未被改）；
* mutation 控制：删掉某一步的 `HUSKY` 行 / 改成未加引号的 `0` 或 `'1'`，谓词必须为 false。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| S1 | `dev` push 且 spec 漂移 ⇒ openapi-sync 真跑 | 机器人 push 不触发 pre-push，PR 步骤绿 | 每次 spec 漂移都带一个红 job（AAV-1390 连红） | 红侧基线 run `44039789059`；修复后 run `44040361980` 真实开出 PR #852 | 守卫 T1 + 实跑 |
| S2 | `dev` push 且无漂移 | job 仍 skipped（行为不变） | 误以为守卫能覆盖 skip 场景 | job `if:` 未改 | 不动 `if:` |
| S3 | schedule 触发 openapi-sync | 同一步 step env 生效 | schedule 与 push 路径不一致 | step env 与触发方式无关 | 守卫对 `ci.yml` 全文枚举 |
| S4 | token-icon-sync 有 icon 变更 | push 绕过 hook（潜伏修复） | 同族继续每天红 | 该 step 此前无 `HUSKY` | T1 |
| S5 | ci-auto-remediation 产出修复 | push 绕过 hook（潜伏修复） | 依赖自动修复永远开不出 PR | 该 step 此前无 `HUSKY` | T1 |
| S6 | hardcode-sync 已有 `HUSKY: '0'` | 仍通过既有守卫与本守卫 | 新守卫与旧守卫重复冲突 | `scripts/hardcode-sync-hook-guard.test.mjs` | 两守卫并存，互不修改 |
| S7 | 开发者本机 `git push` | 仍跑 `ci:remote` + e2e 门 | 误以为 hook 被全局关停 | `.husky/pre-push` 未改 | T4 |
| S8 | 有人删掉某一步的 `HUSKY` | 守卫变红 | 静默恢复红 job | mutation 控制 | T3 |
| S9 | `HUSKY: 0`（未加引号）或 `'1'` | 守卫变红（husky 只认 `"0"` 字符串） | YAML 类型漂移让开关失效 | 谓词只认 `'0'` | T3 |
| S10 | 把 `HUSKY` 提到 job/workflow 级 | 守卫变红（作用面扩大到该 job 其他步骤） | 局部跳过退化为整 job 关 hook | 作用域断言 | T5 |
| S11 | `create-pull-request` 被替换成别的 action | 枚举条数 ≠ action 次数 ⇒ 红 | 新 action 的 push 路径不再被检查 | 计数断言 | T6 |
| S12 | 新增一个带 `create-pull-request` 的 workflow 但漏了 env | 守卫变红 | 第四处复发 | 全目录枚举 | T1 |
| S13 | 机器人步骤自身的验证被绕过 | 各 job 的判据仍在（drift/verify/skip-check/changed） | 「只关 hook」被误读为「不做验证」 | 各 workflow 的 `if:` 未改 | 守卫 T2 断言步骤名与 action 不变 |
| S14 | YAML 缩进/步骤重排 | 枚举不静默漏块 | 解析器只看缩进导致假绿 | 计数 = action 出现次数 | T6 |

## Modified Files Impact

| File | Change |
| --- | --- |
| `.github/workflows/ci.yml` | openapi-sync 的 `Create spec sync PR` 加 step env（已由 `8fe76047` 落地；合并保留其注释） |
| `.github/workflows/token-icon-sync.yml` | `Create PR when icons changed` 加 step env |
| `.github/workflows/ci-auto-remediation.yml` | `Create remediation PR` 加 step env |
| `scripts/bot-push-hook-guard.test.mjs` | 新增统一守卫（T1–T6） |
| `docs/DOCS-INDEX.md` / `docs/issue-roadmap.md` / `SESSION-BOARD.md` | 登记与状态 |

## Testing Decisions

* 守卫是纯文本契约测试（读 workflow 源码），与 `hardcode-sync-hook-guard.test.mjs` 同一先例：只断言外部可观察的 workflow 形状，不测 YAML 解析实现。
* 运行方式：`node --test scripts/bot-push-hook-guard.test.mjs`（随 `npm test` 的 scripts glob 生效）。
* 红 → 绿：先写守卫（三处缺 env ⇒ 红），再加 env（绿）；mutation 控制验证谓词不是恒真。

## Out of Scope

* 不改 `.husky/pre-push`、不弱化开发者门禁。
* 不改各 bot job 的触发条件、产物逻辑、PR 验证链路。
* 不处理 bot PR 的 automerge / review thread 策略。
* 不重写 AAV-1362 的既有守卫。

## Further Notes

* `AAV-1390`（🔥 Dev CI failure: openapi-sync）是本票的症状票。openapi-sync 的真实运行已在 `8fe76047` 后转绿（run `44040361980` → PR #852；dev CI run `44046072307` success），可在本变更合并后一并关闭。
* 若未来新增机器人 PR 步骤，守卫会强制它带 `HUSKY: '0'`——这是有意为之的「第四处不再犯」。
