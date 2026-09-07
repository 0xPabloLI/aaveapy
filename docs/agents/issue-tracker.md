# Issue Tracker: Linear

Issues are tracked in **Linear** using the Linear MCP tools. Backend-agnostic contract (triage lifecycle, cognitive offload, wayfinding) comes from the agent-harness core; this file adds the Linear-specific operations.

## Team

- **Team name**: Aaveapy
- **Team key**: AAV
- **Team ID**: 8aded493-39e5-4d78-a24d-e81e7882ed00

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
- 远端 tracker 写入（创建、编辑、label、关闭）是 consequential external action，需要用户对当次动作授权；未授权时停在本地草稿，不得声称 tracker 已更新。

## Triage 生命周期（core 契约）

- 每个新 issue 进入 `needs-triage`；
- 澄清后进入 `ready-for-agent`（完全指定 + 有验收标准 + Agent 可独立执行）或 `ready-for-human`；
- 等待报告者补充信息 → `needs-info`；
- 拒绝项 → `wontfix`（关闭时必须附解释；完成项不得用 `wontfix`）；
- 关闭已完成的 issue：保留 category label（如 `bug`/`enhancement`），移除所有 state label。

## Session 认知卸载（core 契约）

tracker 是 session 的外部记忆：fresh session 必须能只从 durable sources 重建全部状态——绝不依赖对话。session 结束前，工作产出的每种状态都有唯一卸载 home：

| 产出状态 | Home | 完成标准 |
| --- | --- | --- |
| Per-issue 交付记录（commits、测试、live evidence、遗留项） | issue 关闭评论 | 没见过该 session 的读者能仅凭评论恢复或审计这项工作 |
| Roadmap 状态（tier、wave、blockers、labels） | repo 内 roadmap 文档 | tracker open list 与文档表一致 |
| Session 叙事（跑了什么、按什么顺序） | roadmap 文档的 inventory 行 | 下个 session 的「Last inventory」是最新一行并指明 frontier |
| 超出单任务存活期的用户决策与约束 | roadmap 文档 inventory | 下个 session 不再重复问已决策的问题 |

## Wayfinding（Linear 版）

- **Map issue**: label `wayfinder:map`, body follows wayfinder map template (Destination, Notes, Decisions so far, Not yet specified, Out of scope)
- **Child tickets**: sub-issues of the map issue, each carrying a `wayfinder:<type>` label (`research`, `prototype`, `grilling`, `task`)
- **Blocking edges**: use Linear's native issue dependencies (blocks/blocked by)
- **Frontier query**: open, unblocked (no blockers or all blockers closed), unassigned issues
- **Claim**: assign the ticket to the dev driving the map before starting work
- **Resolve**: post answer as a comment, close the issue, append context pointer to map's Decisions-so-far

## 已知坑（来自实战）

- **不信 Linear sub_issues 聚合状态**：`get_issue(sub_issues: true)` 返回的状态可能是缓存/快照，与单条 `get_issue(id)` 结果不一致。必须逐条单查确认。
