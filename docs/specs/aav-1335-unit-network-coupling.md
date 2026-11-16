# AAV-1335 — unit/script 测试的真实出网耦合：实证 + 防复发守卫

> Status: implemented 2026-11-16 · Issue: [AAV-1335](https://linear.app/aaveapy/issue/AAV-1335) · Type: test hermeticity (non-functional)
> Scope: 不改脚本行为、不改 `main()` 的下载/合并/写盘语义，只补 ① 断网实证 ② 防复发守卫 ③ 文档红线。

## 背景

票面（2026-10-12 记录）：`scripts/sync-reserve-patches-upstream.test.mjs` 在一次 pre-push 里跑了 **46s** 后失败，日志含 `upstream download failed after 2 attempts (cloudflare blocked)`；同日另一次运行同套件全绿。定性为 unit 层网络耦合（违反「Vitest/单测层必须确定性」的红线）。

### 本轮核查的结论：根因已被修掉，票停在「无人验证」

| 事实 | 证据 |
| --- | --- |
| 真实出网点是**模块导入副作用**，不是测试自己发请求 | `scripts/sync-reserve-patches-upstream.mjs` 的 `main()` 原本在模块顶层调用；测试文件只 import 纯函数 |
| 该副作用已于 2026-11-10 修掉 | `7a64abc2` 增加 `const isDirectRun = …; if (isDirectRun) { main().catch(…) }`，并在注释里写明「测试导入即真跑」的后果 |
| 票仍在 Backlog、零评论 | Linear AAV-1335，`state=Backlog`，`commentCount=0` |
| 当前测试文件零出网字面量 | `grep -n "fetch\|https\|axios\|download\|raw.githubusercontent"` 只命中两处 `fetchIconSymbolAndName`（函数名，非网络） |

⇒ 本票不是「再修一次」，而是：**证明现在确实不出网**，并**让这条修复不能被静默删掉**（删掉后只有断网机器才会红，正常机器上一片绿）。

## 设计

### 1. 行为守卫（新测试文件）

`scripts/sync-reserve-patches-upstream.hermetic.test.mjs`：在**导入模块之前**把出网 API 全部换成记录+抛错的陷阱，再动态 `import()`：

- 陷阱覆盖 `globalThis.fetch`、`http.request`、`https.request`、`dns.lookup`、`dns.promises.lookup`、`net.connect`、`net.Socket.prototype.connect`；
- 断言导入与纯函数调用期间 **attempts 为空**（不是「没报错」，是「没尝试」）；
- 断言 `isDirectRun` 门仍在、`main().catch` 只有一处且位于门内；
- 断言 `fetchWithTimeout(` 的每一处调用都位于 `async function main()` 之后。

为什么用行为而不是只读源码：删掉门之后，模块一导入就会真的拉 `raw.githubusercontent.com`；在联网机器上它会「成功」，源码文本检查也可能被注释里的同名字符串糊弄。陷阱把「成功但不对」变成确定性红灯。

### 2. 文档红线

`docs/conventions/e2e-testing-boundary.md` 增一节，把「unit/script 测试不出网 + 副作用收进 `isDirectRun` 门后」写成可执行的形态，并指向本守卫。票面 AC 第三条要求「boundary doc 如无 unit 网络红线条款，补一行」。

## Modified Files Impact

| 文件 | 修改内容 | 风险 | 评估 |
| --- | --- | --- | --- |
| `scripts/sync-reserve-patches-upstream.hermetic.test.mjs` | 新增 3 条守卫测试 | Low | 纯新增测试；随既有 `node --test "scripts/**/*.test.mjs"` 生效，不新增 npm script / hook |
| `docs/conventions/e2e-testing-boundary.md` | 新增「unit/script 测试是 hermetic 的」一节 | Low | 文档 only |
| `docs/specs/aav-1335-unit-network-coupling.md` | 新增本 spec | Low | 新文件 |
| `docs/DOCS-INDEX.md` | 登记本 spec | Low | 索引 only |
| `docs/issue-roadmap.md` | 第 17 轮 inventory + 前端 issue 表状态 | Low | 快照 only |
| `SESSION-BOARD.md` | 登记/注销本 session | Low | 协调 only |

生产脚本 `sync-reserve-patches-upstream.mjs` **未改**（第 2、3 条静态断言依赖它保持现状）。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| S1 | 导入 `sync-reserve-patches-upstream.mjs` | 零出网尝试；导出纯函数可用 | 模块导入副作用回归（原 46s 红） | 陷阱下 `import()`，attempts=[] | 行为守卫，删门即红 |
| S2 | 使用导出的纯函数（`applyUnderlyingAssetMapMerge`） | 零出网尝试，合并结果正确 | 有人把下载挪进 helper | 同上，同时断言 `addedCount=1` | 同一用例覆盖 |
| S3 | 有人删掉 `if (isDirectRun)` 门 | 守卫红 | 只有断网机器才会暴露 | 静态断言 `guardIndex > 0` | 静态 + S1 双保险 |
| S4 | 有人新增第二处 `main()` 调用（门外的裸调用） | 守卫红 | 门外调用绕过门 | `main().catch` 出现次数必须为 1 | 计数断言 |
| S5 | 有人在模块顶层调用 `fetchWithTimeout` | 守卫红 | 同 S1 | 每处调用索引必须 > `async function main()` | 位置断言 |
| S6 | 上游下载失败 / Cloudflare 拦截 | 只影响直接运行脚本（CI 的 Hardcode Sync），不影响单测 | 把 CI 网络故障当成单测回归排查 | `main()` 仅 `isDirectRun` 下执行 | 与 `7a64abc2` 同一结构 |
| S7 | 断网 / 坏代理环境下跑该套件 | 全绿 | 票面原始症状 | 陷阱全拦截下 3/3 绿 | 本守卫自身即断网模拟 |
| S8 | 套件耗时 | < 5s（票面 AC） | 46s 级耗时回归 | 实测 0.16s wall / 65ms test 时长 | 无出网即无超时来源 |
| S9 | 测试文件里出现真实出网字面量 | 无 | 未来有人直接在测试里 `fetch` | `grep` 仅命中 `fetchIconSymbolAndName` | 票面 AC 第二条按此口径核对 |

## Testing Decisions

**Seam.** 模块边界本身就是 seam：导入动作 + 导出的纯函数。陷阱装在 `globalThis` / `node:net|http|https|dns`，不改被测模块，也不 mock 具体 URL。

**Good test.** 断言外部可观察事实：有没有发生出网尝试、`main()` 是否被调用、调用位置是否在门内。不断言 `console.log` 文案、不断言下载重试次数。

**Prior art.** `scripts/hook-failure-propagation.test.mjs` 起子进程真跑门禁并做负对照；`scripts/ci-workflow-spec-references.test.mjs` 扫描源码做静态契约；`e2e/browserProxy.ts` 的 wiring guard 用「两处都调同一函数」钉接线。

**Mutation 验证（本轮实做）.** 把模块复制成 `scripts/__mutant_aav1335.mjs` 并去掉 `isDirectRun` 门（保留裸 `main();`），用同一套陷阱探针导入：

```
ATTEMPTS: ["fetch(https://raw.githubusercontent.com/aave/interface/main/src/ui-config/reservePatch)"]
probe_rc=7
guard_index -1  → 静态断言同时红
```

证明守卫咬住的是真实回归形态，而不是空跑；探针文件用后已删除。

## Verification Evidence

### 断网实证（改造前就成立，本轮第一次量出来）

```bash
node --test scripts/sync-reserve-patches-upstream.test.mjs      # 17 pass / 0 fail，wall 0.16s
NODE_OPTIONS="--import=/tmp/aav1335/no-net.mjs" node --test …    # 17 pass / 0 fail，日志 0 条 [no-net]
```

`no-net.mjs` 同时拦 `fetch` / `http.request` / `https.request` / `dns.lookup` / `dns.promises.lookup` / `net.connect` / `net.Socket.prototype.connect`；一次都没被触发。

### 新守卫

```bash
node --test scripts/sync-reserve-patches-upstream.hermetic.test.mjs
# tests 3 / pass 3 / fail 0 / duration 64ms
```

先红一次：第三条断言最初写成「期望 2 处 `fetchWithTimeout(`（含 import 说明符）」，实测只有 1 处 ⇒ 断言红，改为「每处调用都必须在 `main()` 之后」后转绿。该红是断言口径写错，不是代码问题。

### 门禁

见下方交付记录（`npm test` / `typecheck` / `lint` / `build` / `ci:remote` / pre-push）。

## Out of Scope

* 给其它 `scripts/*.test.mjs` 逐个做同类审计（本票只收被点名的那一个；发现了再单开）。
* 为「需要真实上游」的场景建显式集成测试框架（目前没有消费者：脚本本身由 Hardcode Sync 在 CI 里跑）。
* 改 `fetchWithTimeout` 的重试次数/超时。

## Further Notes

* 该缺陷的教训与 `docs/lessons/infrastructure.md` 里「有测试文件 ≠ 测试在跑」同源：**副作用放在模块顶层时，测试导入就等于执行生产流程**，而失败只在没有网络的机器上出现。
* `main()` 里的写盘（`reservePatches.ts` / `tokenSymbolMap.ts`）与下载同一层：守卫同时保护「测试运行篡改源文件」这条路径。
