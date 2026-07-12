# Triage Workflow States

The triage skill uses Linear's **workflow states** (not labels) on the Aaveapy team (key: `AAV`).

## Workflow States

| State | Type | Triage Meaning |
|-------|------|----------------|
| **Backlog** | backlog | Known but deprioritized; needs re-evaluation before picking up |
| **Todo** | unstarted | Confirmed, queued for work |
| **Ready for agent** | unstarted | Fully specified, an AFK agent can pick up |
| **Needs Info** | unstarted | Waiting on reporter/owner for more information |
| **In Progress** | started | Currently being worked on |
| **In Review** | started | Under code review |
| **Done** | completed | Completed |
| **Duplicate** | duplicate | Duplicate of another issue |
| **Canceled** | canceled | Will not be actioned (replaces `wontfix`) |

## Triage Flow

```
New issue → Backlog (needs evaluation)
         → Needs Info (waiting for clarification)
         → Ready for agent (agent-pickable)
         → Canceled (won't fix)

Backlog + clarified → Ready for agent / Todo
Needs Info + stale (>3 months) → Canceled
Ready for agent + wrong priority → move to Backlog
```

## Conventions

- **Ready for agent** should only be used for issues that are: (1) fully specified with acceptance criteria, (2) have correct priority set, (3) are actionable by an agent without further human input.
- Low/No priority issues should NOT be in `Ready for agent` — move to `Backlog` instead.
- `Needs Info` issues stale for >3 months without updates should be moved to `Canceled`.
- `Canceled` replaces the old `wontfix` label concept.
- Backend-only issues are out of scope for frontend triage — leave them as-is.
