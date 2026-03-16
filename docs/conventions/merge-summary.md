# Merge Summary Convention (reusable)

> **Reuse**: This doc is written in project-agnostic language. You can copy it into any repo’s `docs/` or `docs/conventions/` and reference it from that project’s contributor/agent guidelines.

## Rule

**Every merge must have a written Summary.**

Applies to:

- Merging one branch into another (e.g. `main` → `dev`, or feature → `main`).
- Completing a merge after resolving conflicts (whether locally or via PR).

The summary is the single place where someone can see what was merged and how conflicts were decided, without re-running diffs or re-reading conflict hunks.

## Where to put the summary

Use at least one of:

- **Commit message body** (the paragraph below the subject line).
- **PR description** or a **follow-up comment** on the PR.

Prefer commit body when the merge is done locally; prefer PR description/comment when the merge is completed on the platform or reviewed there.

## What the summary should include

| Item | Description |
|------|--------------|
| **Branches** | Which branch was merged into which (e.g. `main` into `dev`). |
| **Conflicts** | If there were conflicts: which files had conflicts. |
| **Resolutions** | For each conflicted file: how it was resolved (e.g. “kept branch A”, “kept A for section X and B for section Y”, “regenerated from source of truth”). |
| **Follow-up** | Optional: any manual steps the reader might need (e.g. “run `npm install`”, “restore stash for files X, Y”). |

If there were no conflicts, a one-line summary (e.g. “Merged `main` into `dev`; no conflicts.”) is enough.

## Why

- **Traceability**: Future you or others can see why a given file looks the way it does after a merge.
- **Review**: Reviewers can sanity-check conflict resolution without replaying the merge.
- **Reuse**: The same habit works across repos and teams; no project-specific tooling required.

## Checklist (for agents / contributors)

When performing a merge:

1. [ ] Resolve conflicts (if any).
2. [ ] Write the summary (branches, conflicted files, resolution per file, optional follow-up).
3. [ ] Put the summary in the commit body and/or PR description/comment.
4. [ ] Commit (and push / complete the PR as usual).

## Minimal template

```
Merge: <source> → <target>

Conflicts: <list of files or "none">
- <file1>: <how resolved>
- <file2>: <how resolved>

Follow-up: <optional steps>
```
