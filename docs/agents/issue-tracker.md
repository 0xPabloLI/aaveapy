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

## Conventions

- Always set `teamId` when creating issues.
- Use labels for triage (see `triage-labels.md`).
- Set priority when creating: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low.
