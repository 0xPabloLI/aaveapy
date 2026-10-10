# AAV-1331: architecture-guard 的 FS 遍历成本 —— 记忆化扫描，避免全量并行下的假红

指针：实现在 `src/test/architecture-guard.test.ts`。本文记录为什么是「记忆化」而不是「放宽 timeout」、边界在哪。

## 起因

全量 `npm test` 下 6 例撞 vitest 默认 5s 超时，pre-commit 因此假红、阻断提交：

```
FAIL src/test/architecture-guard.test.ts > ... > no consumer imports <module> symbols via formatters (star import)   ×5
FAIL src/test/architecture-guard.test.ts > ... > lib files must not import from hooks
Error: Test timed out in 5000ms.
```

同一文件单独跑是绿的（323 passed / 15s / rc=0），CI 最近一次 `npm test` 也是 success ⇒ 与代码逻辑无关，是「单例成本 × 慢环境」：本仓的多 agent 沙箱里 vitest 起 195 个 worker（日志原文 `195 workers spawned · ~5.5s startup each`）、FS 经 broker 拦截。

## 根因

每个用例各自重走一遍 `src/` 树并重读全部文件：

- `globTsFiles(dir)` 递归 `readdirSync` + `statSync`，**无缓存**；`readFile(path)` 每次 `readFileSync`，**无缓存**。
- 5 个 star-import 用例**各调 3 次** `globTsFiles`（lib / components / hooks）并对全部文件 `readFile`；`lib→hook` 用例再走一遍 lib。⇒ 同一棵树走 6+ 次、同一批文件读 5+ 次。
- 只有 `COMPONENT_FILES` 被提到模块作用域。

## 规则与不变量

1. **扫描记忆化**：`globTsFiles(dir)` 按目录缓存，重复调用返回**同一实例**；`readFile(path)` 按路径缓存。清单与内容语义不变——只改「算几次」。
2. **遍历与读取都移出 per-test 预算**：`components` / `lib` / `hooks` 三份清单在模块导入时算好（顶层 const），并在导入期把这三份清单里的文件各读一遍（预热缓存）——用例体内不再触发遍历，也不再触发首次读取。fixture 加载不是测试逻辑，记在某个用例的 5s 预算里就会把成本转嫁给「恰好第一个用到它的那条用例」（实测：只做记忆化时，5 条 star-import 里只有**第一条**红，后四条命中热缓存全绿）。
3. **契约有锚**：两条新断言钉住「重复调用同一实例」与「顶层清单即缓存实例」——改前必红（`toBe` 会以两条不同实例失败）。
4. **不删测试换绿**：`architecture-guard.test.ts` 用例数不减少（323 passed → 325 passed，增量正是上面两条断言）。

## 已知覆盖边界

- 只消掉「重复扫描」这一族成本。用例内对**全部文件**跑正则的 CPU 成本仍在（每个用例数百次匹配），在更慢的环境里理论上仍可能逼近 5s。本票**不放宽 `testTimeout`、不改 vitest 全局配置**；若将来复现，走「一次遍历 + 共享数据 + 多断言」的 fixture 形态（AAV-1331 候选 2）。
- 缓存是**进程内**的，`isolate: true` 下不跨测试文件共享——对本文件足够（热点全在文件内），也不承诺惠及其它文件。
- 假设运行期 `src/` 不变：该文件只读，不写 fixture、不建临时目录。

## Section 1: Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `src/test/architecture-guard.test.ts` | `globTsFiles` / `readFile` 加缓存；`COMPONENT_FILES` / `LIB_FILES` / `HOOK_FILES` 提到模块作用域；新增 2 条缓存契约断言 | Low | 只改「读几次」，不改「读什么」；既有断言一条未动，用例集合只增不减 |

## Section 2: Behavioral Scenarios

| # | Scenario | Expected Behavior | Risk | Evidence |
|---|----------|-------------------|------|----------|
| 1 | 重复调用 `globTsFiles(dir)` | 返回同一实例（遍历只发生一次） | High（无缓存＝每次全树遍历，正是本票根因） | automated test |
| 2 | 顶层 `COMPONENT_FILES` / `LIB_FILES` / `HOOK_FILES` | 即缓存实例 | Medium | automated test |
| 3 | 5 条 star-import 用例的判定结果 | 与改前逐条一致（同清单、同内容） | High（缓存键若按部分目录/子路径缓存会串数据） | automated test ＋ 全量 `npm test` 0 failed |
| 4 | `lib→hook` 方向用例的判定结果 | 与改前一致 | High | 同上 |
| 5 | 用例数 | 不减少（323 → 325 passed） | High（删/跳用例换绿是本票红线） | `vitest` 计数 |
| 6 | 首次读取的成本归属 | 不落在任何单条用例的 5s 预算里（导入期预热） | High（只做记忆化时，成本由「第一条用到 lib 的用例」独吞 → 实测正是它超时） | runtime-real-data ＋ automated test |
| 7 | 全量 `npm test`（本环境，195 worker 并行） | 由 6 failed 变 0 failed | High | runtime-real-data |
| 8 | 单文件耗时（本机） | 下降（15s → 7s） | Low | runtime |
| 9 | CI（正常 runner） | 行为不变 | Medium | 改前 CI `npm test` success；用例集合只增不减 |

## Tickets

**单一 tracer bullet，不拆分。** 「读几次」与「读什么」必须同一次改动自洽：只加缓存而不改调用点，仍会在用例体内触发 6 次 glob，只是每次命中缓存——中间态的收益与意图不符，没有独立可交付性。

## 证据

`npx vitest run src/test/architecture-guard.test.ts`：

| 阶段 | 结果 |
|------|------|
| 只加缓存契约断言、未加缓存（单文件） | **1 failed** / 323 passed / 6 todo → `expected [ …(N) ] to be [ …(N) ]`（两条不同实例） |
| 加缓存 + 顶层清单（单文件） | **0 failed** / 325 passed / 6 todo，耗时 15s → **7s** |
| 同上，全量 `npm test`（本环境） | 6 failed → **1 failed** / 4097 passed；剩下那条恰是**第一条** star-import 用例——它独吞了 lib 的首次读取 ⇒ 导出下一条不变量 |
| 再加导入期预热 | 见 AAV-1331 交付记录评论（唯一权威源，本文件不复写） |

## 未纳入本改动（如实记录）

- 不动 `vite.config.ts` 的 vitest 全局配置（`testTimeout` / `maxWorkers` / `isolate`）。
- 不覆盖该文件之外的慢用例；本环境里 `npm test` 之外的慢面另有 AAV-1329（e2e 等待对象）与 AAV-1330（pre-push 失败传播）。
