# Proposal Review

> 给出代码、架构、工具、服务、模型或流程修改建议前执行。目标是让建议可追溯、影响面完整，并区分事实与推断。
> 底本 `~/Documents/code/agent-harness/core/proposal-review.md`；本 repo 的适配点：影响面覆盖前后端契约链（后端 `aave-protocol-analysis` → 本仓 `src/shared/market-contract`），事实双源与本仓既有「外链事实必须实读」纪律同源。

## 1. 因果依据

每个「A 导致 B」的判断必须有可追溯证据：代码行、浏览器控制台/网络面板、运行日志、测试、spec 或官方文档。单一相关数据点不能直接推出代码层根因。

## 2. 影响面

提出改动前搜索：

- 定义与所有调用方（组件、hooks、`src/lib/**`）；
- 测试与 fixtures（`*.test.ts`、Playwright spec）；
- 文档、`docs/specs/`、ADR、Linear issue；
- 跨仓消费者：后端 `/api/markets` payload → `src/shared/market-contract/schemas.ts`（zod）→ 组件；改契约要同时核对后端 `src/types/index.ts` 与 `schema-fingerprint` mirror；
- 同一契约的其他副本（OpenAPI 生成物、`src/types/aave.ts`）。

列出 Modified Files Impact，并说明现有行为、下游消费者、最坏后果和验证方式。不能把未搜索到证据表述为「不受影响」。

## 3. 事实双源

影响设计选择的外部事实至少用两个独立来源验证。优先级：

1. 本地安装版本、源码、CLI、最小 smoke test；真实数据以 staging 站点与 staging API 的实际响应为准；
2. 官方文档、官方仓库、release 或定价页；
3. 网络讨论仅证明「有人报告过」，不能证明当前版本仍存在或已修复。

冲突时以本地源码和实际调用结果为准，并记录版本差异。定价、费率、资源分配必须以官方页或官方 CLI 为准。

操作程序见 `docs/conventions/fact-verification.md`。

## 4. 新工具准入

推荐引入新工具、框架或服务前检查：官方仓库是否 archived；引用其他 repo 时验证确有其物；最近 commit 与 release 日期；issue 活跃度；license 与商业限制；与现有工具重叠度（比较实现质量，不以「已有同类」直接否决）；最小本地 smoke test。archived 或超 6 个月无新 commit 的不推荐引入；有活跃 fork 需作为独立候选重做检查。

## 5. AI 模型参数

每个模型的参数只从其自己的 README / Model Card 官方示例出发，不跨模型复制。建议前：确认本地版本 → 读源码默认值 → 验证参数是否被覆盖 → 先跑官方基线再做单变量优化 → 记录质量/速度/内存/硬件。

## 6. 输出检查

建议至少包含：已验证事实、仍属假设的部分、推荐方案与被否决替代方案、修改影响面、验证计划、未解决风险。
