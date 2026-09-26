# Triage Labels

The triage skill uses five canonical roles. Label strings match role names.

## Category Labels

| Label         | Meaning                    |
| ------------- | -------------------------- |
| `bug`         | Something is broken        |
| `enhancement` | New feature or improvement |

## State Labels

| Label             | Meaning                                  |
| ----------------- | ---------------------------------------- |
| `needs-triage`    | Maintainer needs to evaluate             |
| `needs-info`      | Waiting on reporter for more information |
| `ready-for-agent` | Fully specified, ready for an AFK agent  |
| `ready-for-human` | Needs human implementation               |
| `wontfix`         | Will not be actioned                     |

## Triage Flow

```
New issue → needs-triage (needs evaluation)
          → needs-info (waiting on clarification)
          → ready-for-agent (agent-pickable)
          → wontfix (won't fix)

needs-triage + clarified → ready-for-agent / ready-for-human
needs-info + reporter replies → needs-triage
```

## Linear workspace 实存词表

上两表定义的是**契约角色**（语义与流转规范），不是实存 label 清单。Linear 里实际存在哪些 label 字符串，以 `linear__get_issue_labels` 查询为准，本文不缓存实存清单——环境是 source of truth，缓存必漂移。

已知缺口（2026-09-26 实查快照，会过期）：实存 19 个 label 中与契约同名的只有 `enhancement` 和 `ready-for-agent`；`bug`/`needs-triage`/`needs-info`/`ready-for-human`/`wontfix` 均不存在；实存侧另有 `ci-failure`、`documentation`、`dependencies`、`done`、`done-candidate`、`auto-reverted`、`repo:frontend`/`repo:backend` 等契约未收的 label。

落地规则：建票时在**实存**词表里选最贴近契约角色的 label（CI/e2e 问题 → `ci-failure`，范围 → `repo:*`）；契约角色无实存对应时，新票默认 Backlog 状态等人工 triage，映射决策写进票评论。wayfinding 的 `wayfinder:*` label 同样不在实存词表，首次使用前需先创建。

## Conventions

- Every triaged issue carries exactly one category label and one state label.
- `ready-for-agent` requires: (1) fully specified with acceptance criteria, (2) correct priority, (3) actionable by an agent without further human input.
- `wontfix` issues should be closed with an explanation comment.
- Closing a completed issue: keep its category label, remove all state labels. `wontfix` is for rejected items only.
