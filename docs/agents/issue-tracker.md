# Issue Tracker: Linear

Issues are tracked in **Linear** using the Linear MCP tools.

## Team

- **Team name**: Aaveapy
- **Team key**: AAV
- **Team ID**: 8aded493-39e5-4d78-a24d-e81e7882ed00

## Workflow

- **Create issue**: `mcp__linear_create_issue` with `teamId`
- **List issues**: `mcp__linear_list_issues` filtered by `teamId`
- **Update issue**: `mcp__linear_update_issue` with `issueId`
- **Search issues**: `mcp__linear_search_issues` with `query`
- **Get issue**: `mcp__linear_get_issue` with `issueId`

## Wayfinding operations

Wayfinder maps use Linear issues with the following conventions:

- **Map issue**: label `wayfinder:map`, body follows wayfinder map template (Destination, Notes, Decisions so far, Not yet specified, Out of scope)
- **Child tickets**: sub-issues of the map issue, each carrying a `wayfinder:<type>` label (`research`, `prototype`, `grilling`, `task`)
- **Blocking edges**: use Linear's native issue dependencies (blocks/blocked by)
- **Frontier query**: open, unblocked (no blockers or all blockers closed), unassigned issues
- **Claim**: assign the ticket to the dev driving the map before starting work
- **Resolve**: post answer as a comment, close the issue, append context pointer to map's Decisions-so-far

## Conventions

- Always set `teamId` when creating issues.
- Use labels for triage (see `triage-labels.md`).
- Set priority when creating: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low.
