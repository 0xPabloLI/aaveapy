# Issue Tracker: Linear

Issues are tracked in **Linear** using the Linear MCP tools. Backend-agnostic contract (triage lifecycle, cognitive offload, wayfinding) comes from the agent-harness core; this file adds the Linear-specific operations.

## Team

- **Team name**: Aaveapy
- **Team key**: AAV
- **Team ID**: 8aded493-39e5-4d78-a24d-e81e7882ed00

## 连接配置（CodeArts 侧）

MCP server 配置在 `.codeartsdoer/mcp/mcp_settings.json`（server key `linear`，`LINEAR_API_KEY` 走 env 注入，包 `@hatcloud/linear-mcp`）。配置文件是连接的 source of truth——不在此重复 key/路径/版本等会漂移的值。

**工具名前缀**：CodeArts 实际工具名带 `linear_` 前缀（如 `linear_list_teams`、`linear_create_issue`）。下方 Workflow 章节及 core 契约中的 `mcp__linear_*` 写法是 agent-harness core 的通用约定；CodeArts 调用时去掉 `mcp__` 前缀。裸名（如 `list_teams`）会报 "not found" 并误判 server 连不上。

**连通性自检**：调用 `linear_list_teams`，应返回 team AAV（id 见上节）。一条命令同时验证连接、认证、team 配置。

## Workflow (Linear-specific)

- **Create issue**: `mcp__linear_create_issue` with `teamId`
- **List issues**: `mcp__linear_list_issues` filtered by `teamId`
- **Update issue**: `mcp__linear_update_issue` with `issueId`
- **Search issues**: `mcp__linear_search_issues` with `query`
- **Get issue**: `mcp__linear_get_issue` with `issueId`

## Conventions

- Always set `teamId` when creating issues.
- Set priority when creating: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low.
- Use labels for triage (see `triage-labels.md`).

## 通用契约（core 契约）

- **Create**：带 title、body、labels 创建。
- **List**：按 label / state / assignee 过滤查询，不从本文件缓存列表——tracker 是 source of truth，缓存会过期。
- **Update / Close**：label 变更、状态流转、关闭。
- **Issue body is write-once**：body 在建票时定稿，此后不改写——tracker 后端的编辑可能是整体替换（如 GitHub `PATCH` body），追加内容一律走评论；新证据给 open 票也走评论。append-only 从不覆写。
- **Read the comments before claiming**：body 单独不是票的全部状态——跨 session 证据、交付记录、用户决策都沉淀在评论里，漏读一条评论 = 重议一个已决策的问题。三条守卫让漏读**可判定而非靠记忆**：(a) **body 自己声明**——每张票 body 顶部固定告示块（见下节）；(b) **评论计数一查即得**——open 票非零计数即有正文外状态（后端 CLI 命令见文末 SLOT）；(c) **信号骑在列表查询输出里**——有新评论的 open 票自动带 unread 信号，triage 已跑的列表查询顺带暴露（信号可为纯约定或机器兜底，机制见文末 SLOT）。领取前全量读评论。
- **PRs as request surface**：默认 off（外部 PR 不当作 issue 分诊）。
- 远端 tracker 写入（创建、编辑、label、关闭）是 consequential external action，需要用户对当次动作授权；未授权时停在本地草稿，不得声称 tracker 已更新。

## Triage 生命周期（core 契约）

- 每个新 issue 进入 `needs-triage`；
- 澄清后进入 `ready-for-agent`（完全指定 + 有验收标准 + Agent 可独立执行）或 `ready-for-human`；
- 等待报告者补充信息 → `needs-info`；
- 拒绝项 → `wontfix`（关闭时必须附解释；完成项不得用 `wontfix`）；
- 关闭已完成的 issue：保留 category label（如 `bug`/`enhancement`），移除所有 state label。
- **认领前沿票前对齐模型/工具裁决史**：票面推荐的模型、工具或方案可能已被后续裁决降级或否决——triage 复核与开工前，到该名字的调研/决策文档查现行裁决（✅ 在用 / 备选 / ❌ 否决），不能只验证环境可行性（实测教训：模型线在开票后被用户裁决替换，triage 复核了环境可行性却没人重查模型线存续，准备工作全部走完后才被用户拦下）。

### Body notice（body 顶部固定告示块）

每张票 body 以固定块开头，建票时写一次、永不改写：

> **正文是创建时的规格（write-once，永不改写）。** 当前状态、跨 session 证据与交付记录都在评论里——读票必须带评论，只读正文会把已决策的问题重新问一遍。

所有票文本一致，告示块自身不会竞态。规则生效前创建的旧票没有告示块——对它们，守卫 (b)（评论计数）仍然适用。

**三条守卫的追溯性（显式区分）**：守卫 (a)（body 告示块）与守卫 (c)（unread 信号）**仅向前生效**——旧票没有告示块、历史评论不回填信号；守卫 (b)（评论计数）**全量追溯**——对任何存量票一查即得。不给存量票批量回填 unread 信号：回填会把「罕见且可动作」稀释成常态噪音，读者学会忽略它，机制退化为靠自觉。

> 历史注记：本契约的写侧/读侧规则**替代**一份已关闭的并行提案（该提案主张「评论必须回写正文」，与本契约 write-once 互斥，已在规则收敛时撤销）。后来者若在历史 PR/分支里遇到那条规则，以本契约为准，不要重新捡起。

## Session 认知卸载（core 契约）

tracker 是 session 的外部记忆：fresh session 必须能只从 durable sources 重建全部状态——绝不依赖对话。session 结束前，工作产出的每种状态都有唯一卸载 home，不允许停留在 conversation-only：

| 产出状态 | Home | 完成标准 |
| --- | --- | --- |
| Per-issue 交付记录（commits、测试、live evidence、发现的机制、遗留项） | issue 关闭评论，**以固定标记开头**（如 `交付记录` / `Delivery record`） | 没见过该 session 的读者能仅凭评论恢复或审计这项工作。标记是机器可检的唯一部分（关票无标记时 CI 提醒——可选装机器兜底，见文末 SLOT）；记录本身写给人类读 |
| Roadmap 状态（tier、wave、blockers、labels） | repo 内 roadmap 文档的 tier/wave 行 | tracker open list 与文档表一致 |
| Session 叙事（跑了什么、按什么顺序） | roadmap 文档的 inventory 行 + 试点日志 | 下个 session 的「Last inventory」是最新一行并指明 frontier |
| Commit 溯源 | Session-Id trailer + 试点日志登记 | `git log --all --format=...trailers` 能解析每个 session commit |
| 超出单任务存活期的用户决策与约束 | roadmap 文档 inventory，或 agent memory（跨任务偏好） | 下个 session 不再重复问已决策的问题 |

完成判据：想象一个同事新开终端接手——如果他还需要问任何 tracker 本可以回答的问题，卸载就不完整。

## Wayfinding（Linear 版）

- **Map issue**: label `wayfinder:map`, body follows wayfinder map template (Destination, Notes, Decisions so far, Not yet specified, Out of scope)
- **Child tickets**: sub-issues of the map issue, each carrying a `wayfinder:<type>` label (`research`, `prototype`, `grilling`, `task`)
- **Blocking edges**: use Linear's native issue dependencies (blocks/blocked by)
- **Frontier query**: open, unblocked (no blockers or all blockers closed), unassigned issues
- **Claim**: assign the ticket to the dev driving the map before starting work
- **Resolve**: post answer as a comment, close the issue, append context pointer to map's Decisions-so-far
- Fog 留在 map 的 Not yet specified，直到能写成决策问题；不创建含糊的占位 ticket。
- 雾空后合成 S2 Spec，不把 decision tickets 直接交给实施。

## SLOT：Linear 后端机制（对应 core 契约的守卫与标记）

- **评论计数查询**（守卫 b）：`mcp__linear_get_issue` 返回 `commentCount`，open 票非零即有正文外状态；`mcp__linear_list_issues` 列表也带计数。
- **unread 信号**（守卫 c）：Linear 原生 unread 状态，列表查询自动暴露——机器兜底（非纯约定）。
- **交付记录标记**：纯约定——关票评论以 `交付记录` / `Delivery record` 固定标记开头；未装 CI 自动校验关票无标记。
- **原生 sub-issue 支持**：Linear 支持，但聚合状态不可信（见「已知坑」）。

## 已知坑（来自实战）

- **不信 Linear sub_issues 聚合状态**：`get_issue(sub_issues: true)` 返回的状态可能是缓存/快照，与单条 `get_issue(id)` 结果不一致。必须逐条单查确认。
