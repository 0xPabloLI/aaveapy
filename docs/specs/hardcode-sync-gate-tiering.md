# Spec: Hardcode Sync 门禁分级 — 解除「全或无」单点故障

**Status**: Approved（2026-09-24，3 项决策经用户确认）
**Date**: 2026-09-24
**关联**: AAV-1296 / GitHub #667、前置 AAV-1297（已交付，产物被本任务消费）、#629 / AAV-1284（前车）
**类型**: enhancement（CI hardcode sync 韧性）
**前置阅读**: docs/archive/2026-09-24-hardcode-sync-resilience.md、docs/specs/chain-icon-map-auto-sync.md（AAV-1297）

## Problem Statement

`hardcode:verify` 是 9 个子命令的 `&&` 链，任一失败全链断：结构性错误（上游不可得、解析失败）与数据缺口（条目缺失、mismatch、文件缺失）共用 exit 1，verify fail → 不建 PR（`hardcode-sync.yml` Create PR step 条件）→ 整条同步瘫痪（#629 卡死 14 天）。`hardcode:sync` 的 8 子命令 `&&` 链有同样问题：中部 fail 连坐后续步骤。

AAV-1297 交付后 registry↔map 缺口可被 sync `--write` 自动修复，但当未来出现 sync 修不了的新缺口时，同步仍会被一个缺口连坐全部资产。需要门禁分级：结构性错误阻塞建 PR，数据缺口降级为 advisory（warning + PR 打标）。

## Solution

### 退出码协议（跨 step 契约，本 spec 核心契约）

所有 hardcode check 脚本统一三级退出码：

| Exit code | 语义 | 判定 | 下游行为 |
|---|---|---|---|
| `0` | clean | 结构健康、无缺口 | 正常 |
| `2` | **data gap** | 结构健康，但存在待人工补齐项（条目缺失、mismatch、文件缺失） | 不阻塞，打 warning |
| 其他非零（含 `1`、signal、spawn 失败） | **critical** | 结构性错误：上游不可得、解析 0 条、格式坏、manifest 生成失败 | 阻塞建 PR，触发两轮重试 + report-failure |

约定：**fail-closed**——未按协议发信号的失败（脚本崩溃、signal、未知退出码）一律归 critical。

### hardcode chain runner（verify + sync 共用）

新建 `scripts/hardcode-chain-runner.mjs`：

- 用法：`node scripts/hardcode-chain-runner.mjs <sync|verify> [--github-output]`
- 内置两条子命令清单（唯一来源；替代 package.json 中的 `&&` 链），顺序与现状一致
- 逐个 spawn（`shell: true`，继承 env）,**不短路**，跑完全部后聚合：
  - 任一 critical → 汇总输出，exit 1
  - 有 gap 无 critical → 输出 gap 清单 + `::warning::`，exit 0
  - 全 clean → exit 0
- `--github-output`：向 `$GITHUB_OUTPUT` append `has_gaps=<true|false>` 与 `gap_summary<<EOF ... EOF`（多行 heredoc 格式）；文件不存在时（本地）跳过写入不报错
- package.json：`hardcode:sync` / `hardcode:verify` 改指向 runner

清单漂移守卫：单测断言清单中每个 `npm run <x>` 引用的 script 名都存在于 package.json scripts。

### check 脚本退出码迁移（8 个）

数据缺口分支 `exit(1)` → `exit(2)`；结构性分支（解析 0 条、`main().catch`）保持 `exit(1)`：

| 脚本 | gap → exit(2) | critical 保持 exit(1) |
|---|---|---|
| check-hardcode-icons.mjs | missing iconSymbol icons | catch |
| check-reserve-patches-upstream.mjs | hasDrift（missing keys / SYMBOL_MAP drift） | parse 0 条 ×2、catch |
| check-market-name-map-upstream.mjs | mapping mismatch | parse 0 条 ×2、catch |
| check-chain-icon-map-upstream.mjs | mapping 缺失、asset 缺失（白名单外）、registry↔map mismatch | parse 0 条 ×2、catch |
| check-coingecko-platform-map-upstream.mjs | platform mismatch | parse 0 条/空 ×2、catch |
| sync-token-icons.mjs（--check） | 可同步图标缺失 | all-endpoints-exhausted、其他 catch、parse 失败 |
| check-pool-addresses-upstream.mjs | pool 地址不一致 | 上游加载/解析失败、catch |
| check-chain-registry-upstream.mjs | 不动（已是 advisory，永不 exit 1） | — |

静态守卫测试：node:test 遍历 8 个脚本源码，断言各自包含 `process.exit(2)`（gap 分支迁移完成）——防回退。

### pending-chain-ids.json 白名单（逃生通道）

- 新建 `scripts/data/pending-chain-ids.json`（`[]`），对齐 `pending-chain-icon-bases.json` 机制
- `check-chain-icon-map-upstream.mjs` 的 registry↔map 校验：白名单内的 chainId 允许不在 map（console.warn，不计 gap）；白名单外仍计 gap
- 定位：sync 自动占位（AAV-1297 L4 兜底）失效时的人工放行通道，默认空表 = 行为同现状
- 脚本加 direct-run 守卫（AAV-1297 先例）+ 导出纯函数（`loadPendingChainIds` / registry 对齐判定）供 node:test 注入

### hardcode-sync.yml 消费 gap 信号

- verify round1/round2 step 加 `--github-output`（runner 经 env 拿 `$GITHUB_OUTPUT`）
- 两轮触发条件不变（critical 才重试；gap-only exit 0 不触发 round 2——sync 输入未变，重跑无意义）
- Create PR step 条件不变（passed == 'true'，gap-only 已是 pass）
- PR labels 追加：最后一轮 verify 的 `has_gaps == 'true'` → `incomplete-asset`（dev 分支 automerge + incomplete-asset 可共存：dev 是 staging，占位资产可自动合并；main 无 automerge）
- PR body 追加 gap_summary 段落
- report-failure job（critical 才触发，不变）追加 stale 升级：open 的 verify-failed issue 创建 > 3 天且无 `stale-hardcode` label → addLabels + createComment

### 不变量

- drift-check workflow 不动：逐个 step 跑 check 脚本，exit 2 仍非零 → 红（其职责就是暴露 drift，语义正确）
- token-icon-sync workflow 不动（跑 sync-token-icons 非 --check 模式）
- report-failure 的聚合/建 issue 逻辑不变
- 各 check 脚本的非退出码行为（判定逻辑、输出格式）不变
- runner 失败聚合不改变 workflow 的两轮状态机与 job fail 条件

## Test Seams

- **runner**（`scripts/hardcode-chain-runner.test.mjs`，node:test）：注入 fake `package.json` 内容与 fake spawn（child_process 依赖注入），覆盖退出码协议矩阵、清单存在性守卫、GITHUB_OUTPUT 写入格式、本地无 GITHUB_OUTPUT 容错。挂入既有 `node --test scripts/`（AAV-1297 已接 npm test）
- **check-chain-icon-map-upstream.mjs**（`scripts/check-chain-icon-map-upstream.test.mjs`）：direct-run 守卫 + 导出纯函数注入测试（白名单命中/未命中、空表、解析）
- **退出码静态守卫**：并入 runner 测试文件（遍历 8 脚本断言含 `process.exit(2)`）
- workflow 改动无本地 seam：static review + human acceptance（合并后 CI 观察）

## User Stories

1. As a 维护者, I want verify 的数据缺口不再阻塞 bot PR, so that 单个补不齐的缺口不连坐其他全部资产的同步。
2. As a 维护者, I want PR 带 incomplete-asset 标签和 gap 清单, so that 我能一眼识别哪些 PR 含待人工补齐项。
3. As a 维护者, I want sync 链中部失败不连坐后续步骤, so that 单点故障不放大。
4. As a 维护者, I want 突发情况下能把特定 chainId 放进白名单放行, so that 有不挂死 CI 同步的逃生通道。
5. As a 维护者, I want verify-failed issue 超 3 天未处理自动打标升级, so that #629 类 14 天无人处理不再发生。

## Implementation Decisions

1. **runner 清单内置硬编码**（非解析 package.json `&&` 链）：清单唯一来源移入 runner，无解析歧义；npm script 引用存在性由单测守卫。
2. **退出码协议选 exit 2 表达 gap**（而非 stdout 标记解析）：跨 step 契约用进程退出码表达最可靠，stdout 解析脆弱；npm run 与 spawn(shell:true) 均透传退出码。
3. **gap-only 不触发 round 2**：round 2 是给瞬时故障（上游 fetch 失败）的二次机会；gap 是确定性缺口，sync 输入未变重跑无意义。
4. **白名单只加在 registry↔map 校验**（不加在 mapping/asset 校验）：mapping/asset 缺失已有各自的修复路径（sync --write / pending-icon-bases），registry↔map 是 AAV-1297 新增校验且其自动修复依赖 registry import 成功——唯一无既有逃生门的检查点。
5. **标签名 `incomplete-asset`**（用户确认）；**告警升级阈值 3 天**、label `stale-hardcode`（用户确认最小版纳入）。
6. **sync 与 verify 共用 runner**（用户确认一并 runner 化）：同一协议、同一聚合逻辑，两份清单一个执行器。

## Scenario & Risk Verification Matrix

### Section 1: Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `scripts/hardcode-chain-runner.mjs` | 新建：清单执行器 + 聚合判定 + GITHUB_OUTPUT 输出 | Low | 纯新增模块；唯一消费者是 package.json 两个入口与 workflow steps |
| `package.json` | `hardcode:sync`/`hardcode:verify` 改指向 runner | Medium | 即修复目标本身；drift-check/token-icon-sync 不引用这两个入口（已核实 workflow grep），最坏后果 = verify 行为错 → CI 报警 |
| 8 个 check 脚本 | gap 分支 exit 1→2 | Medium | 判定逻辑与输出不变，仅退出码分级；下游 = runner（消费 0/2/其他三级）与 drift-check（非零即红，语义不变）；最坏后果 = 分级标错 → 该阻塞的没阻塞（fail-closed 原则下宁可错杀 critical，迁移清单逐脚本人工核对） |
| `check-chain-icon-map-upstream.mjs` | 额外：direct-run 守卫 + 导出纯函数 + pending 白名单 | Medium | 白名单默认空表 = 行为同现状；导出函数只增不改既有 main 流程 |
| `.github/workflows/hardcode-sync.yml` | PR labels/body 消费 has_gaps + report-failure stale 升级 | Medium | PR 创建条件与两轮状态机不动；labels 拼接沿用既有空字符串先例；stale 逻辑仅在 critical 触发的 job 内运行 |
| `scripts/data/pending-chain-ids.json` | 新建 `[]` | Low | 纯新增；加载失败 fail-fast（对齐 overrides 表先例） |

### Section 2: Behavioral Scenarios

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| 1 | verify 全 clean | runner 跑完全部 9 子命令，exit 0，无 warning | Low | automated test（fake spawn 全 0） | — |
| 2 | 单个 check gap（exit 2） | runner 继续跑完剩余全部，exit 0 + `::warning::` + has_gaps=true | High | automated test（fake spawn 混合 0/2） | 本任务核心目标；fail-open 仅限 gap |
| 3 | gap + critical 混合 | 全部跑完，exit 1（critical 赢），gap 仍全部列出 | High | automated test | fail-closed：不确定失败一律 critical |
| 4 | critical only | exit 1 → workflow 两轮重试 → 仍 critical → job fail + report-failure issue | Medium | automated test（协议层）+ static review（workflow 状态机不动） | 现状语义保持 |
| 5 | round1 critical → round2 通过 | PR 正常创建（现状） | Low | static review（workflow 条件未改） | — |
| 6 | round1 gap-only | 不触发 round2，直接建 PR | Medium | automated test（runner exit 0）+ static review | 决策 3 |
| 7 | sync 链中部 fail | 后续步骤继续跑，runner exit 1（critical）+ 汇总列出 | Medium | automated test | 解除连坐；workflow 现有 `::warning::`（sync step）不依赖 exit code 细分 |
| 8 | 清单引用的 npm script 不存在 | spawn 失败 → critical；单测守卫断言清单↔package.json 对齐 | Medium | automated test（存在性守卫） | 防改名断链 |
| 9 | 未知退出码（如 137/signal） | 归 critical | High | automated test | fail-closed |
| 10 | 本地跑带 `--github-output` 但 GITHUB_OUTPUT 未设 | 跳过写入，不 crash，stdout 照常 | Low | automated test | — |
| 11 | pending-chain-ids 空表 | registry mismatch 仍计 gap（行为同现状） | Low | automated test | — |
| 12 | pending-chain-ids 命中部分 chainId | 命中的降为 console.warn 不计 gap；未命中的仍 gap | Medium | automated test | — |
| 13 | drift-check workflow | 逐 step 跑 check，exit 2 仍非零 → 红，语义不变 | Low | static review（不引用 runner/verify 链） | — |
| 14 | npm run / spawn(shell:true) 退出码透传 | 子进程 exit 2 → runner 收到 2 | Medium | automated test（fake spawn）+ runtime smoke（真实 npm run） | — |
| 15 | gap_summary 多行写 GITHUB_OUTPUT | heredoc EOF 格式合法，PR body 渲染正常 | Low | automated test（输出格式断言）+ human acceptance（CI 实跑 PR 观察） | — |
| 16 | dev 分支 gap PR：automerge + incomplete-asset 共存 | automerge 仍合并（dev=staging 可接受） | Low | human acceptance | 决策 5 |
| 17 | verify-failed issue open > 3 天 | report-failure 触发时 addLabels(`stale-hardcode`) + comment；< 3 天无动作；已有 label 不重复 | Medium | static review（workflow 脚本无本地 seam）+ human acceptance | 阈值 3 天 |
| 18 | report-failure 聚合/建 issue 逻辑 | 不变（仅 critical job fail 触发） | Low | static review | — |
| 19 | 8 脚本 gap 分支迁移完整性 | 每个脚本源码含 `process.exit(2)`；结构性分支保持 exit(1) | Medium | automated test（静态守卫遍历脚本） | 防回退/漏改 |
| 20 | 真实端到端 clean 环境 | 本地 `npm run hardcode:verify` exit 0（当前工作区 clean） | Low | runtime smoke | — |
| 21 | check-chain-icons 白名单加载失败（JSON 坏） | fail-fast exit 1（critical） | Low | automated test | 对齐 overrides 表先例 |
| 22 | token-icon-sync workflow | 不动，跑 sync 非 --check | Low | static review | — |

## Out of Scope

- e2e flaky 修复（AAV-1299 独立 issue）
- drift-check workflow 的任何改动
- check 脚本判定逻辑/输出格式重构
- 告警升级的非最小版（多渠道通知、逐评论升级梯度）
- pending-chain-ids 用于 mapping/asset 校验
- 后端仓库侧改动
- 本地 address-book lock 升级

## Further Notes

- 现状事实链（2026-09-24 核实）：`hardcode:verify` 9 子命令、`hardcode:sync` 8 子命令、drift-check 逐 step 调 check（不引用 verify 链）、`check:chain-registry-upstream` 已 advisory、`sync:chain-icons-upstream` 已带 `--write`（AAV-1297）。
- exit(1) 保留语义的迁移核对以「结构性 = 无法确认产出健康度」为判准，逐脚本分支在 T2 实施时二次核对。
- AAV-1297 遗留 nit（insertEntries lastIndexOf、applySvgPlans 风格）不在本任务范围。

## 实施验证记录（2026-09-24）

- 门禁四件套通过：lint（0 errors）/ test（vitest + scripts node:test 全绿）/ build / tsc。
- Runtime smoke（本地真实跑）：① `hardcode:verify` 9/9 全跑不短路，真实既有漂移（coingecko map + token icons 2 个 gap）→ gap-only exit 0 + `::warning::`（场景 1/2/14/20 证据，旧机制下这两个 gap 会瘫痪整条同步）；② `hardcode:sync` 8/8 全跑 exit 0，gap 被自动修复（tokenPriceResolver.ts +1 行真实 sync 产出，属 bot PR 日常工作内容）；③ 复跑 `hardcode:verify` 收敛全绿 exit 0（sync→verify 闭环，场景 1）。
- Code review（双轴）修复：`GAP_SUMMARY` 表达式与 `HAS_GAPS` 同源化（round2.has_gaps=='true' 判定，消除 round2 clean 时回落 round1 残值的隐患——注：GH 表达式非空字符串为 truthy，HAS_GAPS 原表达式语义正确）；`formatGithubOutput` 去冗余 hasGaps 参数（内部派生）；补 CHAINS↔package.json 清单存在性单测。
- 实施偏离登记：① direct-run 守卫（check-chain-icon-map-upstream）由「测试 import 成功且无网络副作用」隐式覆盖，不设专门用例（与 AAV-1297 先例一致）；② `loadPendingChainIds` 接受数字字符串（宽容解析，测试固化）；③ 场景 8 的「spawn 失败→critical」之外，runner 增加运行前置守卫（清单引用不存在 → fail-fast exit 1），协议语义不变；④ 白名单为双向豁免（「registry 有 map 无」与「map 有 registry 无」同权）——对齐判定语义按 chainId 整体豁免，比单向更一致，spec L64 字面按此理解。
