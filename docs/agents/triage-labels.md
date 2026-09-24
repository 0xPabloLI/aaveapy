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

## Conventions

- Every triaged issue carries exactly one category label and one state label.
- `ready-for-agent` requires: (1) fully specified with acceptance criteria, (2) correct priority, (3) actionable by an agent without further human input.
- `wontfix` issues should be closed with an explanation comment.
- Closing a completed issue: keep its category label, remove all state labels. `wontfix` is for rejected items only.
