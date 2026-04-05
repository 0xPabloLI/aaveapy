---
name: merge
description: Merge current branch into remote main via GitHub PR (no local merge into main)
argument-hint: "[optional merge method: squash | merge | rebase — default: squash] [optional mode: remote-only] [optional base: default main]"
---

# merge

User-level copies stay in sync: **Cursor** `~/.cursor/commands/merge.md`, **Claude Code** `~/.claude/commands/merge.md`. In **any** Git repo: merge the current branch into the remote default branch (`main`) via GitHub PR + `gh pr merge`, not via local `git checkout main && git merge`.

Canonical **review-thread rules** (normative): `AGENTS.md` → **PR review threads: no cosmetic resolve (mandatory)**.

## PR review threads before `gh pr merge` (mandatory gate)

- List unresolved threads (e.g. `gh api graphql` query `reviewThreads { nodes { isResolved id } }` on the PR, or inspect the PR **Files changed** / **Conversations** UI).
- **Do not** call `resolveReviewThread` or otherwise mark threads resolved **only** to clear **“All comments must be resolved”** unless each thread meets `AGENTS.md` (fix on head, human-agreed disposition, or documented void/stale/duplicate).
- If substantive feedback remains unaddressed: **stop the merge**, implement commits or **ask the user** for explicit written disposition; never silent bulk-resolve by automation.

## Constraints

- **Do not** `git checkout main && git merge <branch>` locally for feature work.
- Prefer: push branch → PR targeting `main` → CI green → `gh pr merge` (or dashboard).
- Support **remote-only merge mode** (via explicit user instruction or argument `remote-only`): when merging existing remote PR state, local uncommitted changes **do not** block execution.
- If the user passed a merge method, honor it; otherwise default to **squash** unless they asked for a merge commit or rebase.
- **Do not** use `gh pr merge --delete-branch` in this workflow. Keep the remote head branch after merge unless the user explicitly asks to remove it.
- **After every successful merge into `main`**, run **Step 7** (remote verification + optional force-sync of `origin/$BRANCH` to `origin/main`), then **Step 8** (align **local** `$BRANCH` to `origin/$BRANCH` while preserving uncommitted files). Prefer remote automation when the repo provides it; command-side force-sync is mandatory fallback when automation fails.
- **Git safety:** Before `git stash` / `git checkout` / `git reset --hard` in Step 8, require **explicit user confirmation** in the conversation (see repo `AGENTS.md` → Git Safety Confirmation).

## Preconditions

1. Repository is a Git repo with `origin` pointing at GitHub (or the remote used for PRs).
2. `gh` CLI is installed and authenticated (`gh auth status`).
3. Current branch is not `main` (if it is, stop and explain they should use a feature branch or open a PR from another ref).

## Workflow

### Step 1: Gather context

From repo root: `git rev-parse --abbrev-ref HEAD`, `git status -sb`, `git remote -v`, `git rev-parse --abbrev-ref @{u} 2>/dev/null || true`.

- Record current branch as `BRANCH`.
- Uncommitted changes: default path—ask user to commit before push (do not bypass hooks); `remote-only`—do not push local WIP.

### Step 2: Ensure the remote branch exists

- Default: set upstream if missing (`git push -u origin "$BRANCH"`), else `git push origin "$BRANCH"`.
- Remote-only: do not push; use existing `origin/$BRANCH` + PR state.

### Step 3: Resolve or create the PR

- `gh pr list --head "$BRANCH" --state open --json number,state,baseRefName,headRefName,url` or `gh pr view "$BRANCH" --json ...`.
- If no open PR: `gh pr create --base main --head "$BRANCH" --title "..." --body "..."`.

### Step 4: CI and merge readiness

- `gh pr checks <PR_NUMBER>` or `--watch`.
- If checks fail, **do not merge**; report and fix or ask the user.

### Step 4b: Unresolved review threads (mandatory)

- Apply **PR review threads before `gh pr merge`** (above). If any substantive thread is open without a permitted resolution path, **do not** merge and **do not** cosmetic-resolve.

### Step 5: Merge on GitHub (remote main)

| Method | Flag |
|--------|------|
| squash | `--squash` (default) |
| merge | `--merge` |
| rebase | `--rebase` |

Example: `gh pr merge <PR_NUMBER> --squash`

### Step 6: Post-merge local sync (optional)

After merge, user may refresh local `main`: `git fetch origin main`, `git checkout main`, `git pull origin main`. Do **not** merge feature branches into local `main` as a substitute for Step 5.

### Step 7: Verify branch sync (required)

```bash
git fetch origin main "$BRANCH"
git rev-parse origin/main "origin/$BRANCH"
git diff origin/main "origin/$BRANCH"
```

Expect same SHA and empty diff.

**Race with `Sync dev with main` (when `$BRANCH` is `dev`):** After `gh pr merge`, that workflow runs asynchronously (often ~10–20s). A single immediate `fetch` can falsely show `origin/dev` behind `origin/main`. Before fallback:

1. **Poll refs** (preferred, no extra API coupling): up to **15** attempts, **3s** sleep between attempts — each time `git fetch origin main dev`, then compare `origin/main` and `origin/dev`. Stop when SHAs match.
2. Optionally, if a repo has `.github/workflows/sync-dev-with-main.yml`, **`gh run watch`** on the newest **Sync dev with main** run (from `gh run list --workflow "Sync dev with main" --limit 1 --json databaseId,status`) can be used instead of or after polling; treat `failure` / `cancelled` as automation not having aligned `dev`.
3. **Fallback** only if still mismatched after polling timeout **or** the sync workflow completed unsuccessfully:

`git push --force-with-lease origin "origin/main:refs/heads/$BRANCH"`

**When `$BRANCH` is not `dev`:** There is no `Sync dev with main` alignment; use a single fetch + compare. (After a **squash** merge, `origin/$BRANCH` and `origin/main` often differ until you reset or delete the head branch — do not force-sync a feature branch to `main` unless that is explicitly intended.)

### Step 8: Align local `$BRANCH` to remote (required after Step 7)

See full stash/checkout/reset procedure in the historical Cursor merge command; **must** obtain user confirmation before stash/checkout/reset per `AGENTS.md`.

## Success criteria

- [ ] Open PR targets `main`; checks pass (or user explicitly accepts documented risk).
- [ ] **`gh pr merge` completes**; default branch includes the change.
- [ ] **No cosmetic-only resolve:** threads are not marked resolved via `resolveReviewThread` / bulk UI resolve unless each satisfies `AGENTS.md` (fix on PR head, human-agreed disposition, or documented void/duplicate/stale).
- [ ] **Step 7:** `origin/main` and `origin/$BRANCH` share tip SHA; `git diff` empty.
- [ ] **Step 8:** Local alignment completed per user-approved stash/reset when needed.
