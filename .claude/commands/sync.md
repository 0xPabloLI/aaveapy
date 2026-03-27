---
name: sync
description: Sync local branch with remote (fetch, pull, push) and optional artifact sync
argument-hint: "[target: repo|artifacts-all|token-icons|reserve-patches|market-name-map|chain-icons]"
---

# Sync

Run synchronization safely with explicit verification and a clear report.

Default behavior: full **git** round-trip with remote (`repo` mode): bring remote changes in, then publish local commits out (**includes `git push`** when ahead of upstream).
Optional behavior: synchronize upstream-derived artifacts (`artifacts-*` modes).

## Workflow

### Step 1: Preflight checks

1. Validate repo state before syncing:
   - Run `git status --short` and note unrelated dirty files.
   - Do **not** revert or overwrite unrelated local edits.
   - In `repo` mode, if the working tree is dirty (tracked or untracked), create a temporary stash (`git stash push --include-untracked`) **before any inbound sync** and record the stash ref for later pop.
2. Resolve target from argument:
   - `repo` (default): sync local branch with remote tracking branch (inbound + outbound).
   - `artifacts-all`: run all artifact sync targets in safe order.
   - Specific artifact target: run only requested artifact target and verification.
3. If target is artifact-related, confirm scripts in `package.json`:
   - `sync-token-icons`
   - `sync:reserve-patches-upstream`
   - `sync:market-name-map-upstream`
   - `sync:chain-icons-upstream`

### Step 2: Execute sync

1. For `repo`:
   - Run `git fetch --all --prune`.
   - Confirm current branch and tracking branch.
   - Bring remote commits in with this deterministic order:
     1) If no divergence, run `git pull --ff-only`.
     2) If fast-forward is not possible, run `git pull --rebase`.
   - If a temporary stash was created, run `git stash pop` only after inbound sync succeeds; **stop for confirmation** on conflicts.
   - Publish local commits: after inbound sync succeeds and conflicts are resolved, if the branch is **ahead** of its upstream, run **`git push`**. If the branch is not ahead, skip push and report that remote already has your tip.
   - If push is rejected because remote advanced, run `git fetch --all --prune` and repeat the same inbound flow (including temporary stash handling when dirty) before pushing again.
   - If local history was rewritten (e.g. rebase of commits that were already on the remote), use **`git push --force-with-lease`** only when the user explicitly wants to overwrite the remote tip; otherwise stop and confirm.
2. For artifact targets, prefer npm scripts (single source of truth), not ad-hoc commands:
   - `token-icons` -> `npm run sync-token-icons`
   - `reserve-patches` -> `npm run sync:reserve-patches-upstream`
   - `market-name-map` -> `npm run sync:market-name-map-upstream`
   - `chain-icons` -> `npm run sync:chain-icons-upstream`
3. For `artifacts-all`, run sequentially in this order:
   1) reserve-patches
   2) market-name-map
   3) chain-icons
   4) token-icons

### Step 3: Verify integrity

1. For `repo`:
   - Run `git status --short --branch`.
   - Confirm branch is **not behind** its upstream; confirm **ahead is 0** after a successful push (or explain why push was skipped).
2. For artifact targets:
   - token icons: `npm run sync-token-icons -- --check`
   - reserve patches: run corresponding check script if available
   - market name map: run corresponding check script if available
   - chain icon map: run corresponding check script if available
3. For artifact targets, run repository validation:
   - `npm run lint`
   - If present, run CI parity script (for example `npm run ci:remote`).
4. Stop and report immediately if any command fails.

### Step 4: Review and summarize

1. Inspect changes:
   - `git status --short`
   - `git diff --name-only`
2. Provide a concise sync report:
   - Target(s) executed
   - Files changed
   - Checks run and pass/fail
   - Follow-up actions if blocked

## Output Format

Use this structure in the final output:

1. **Targets**
2. **Changed Files**
3. **Verification**
4. **Risks / Follow-ups**

## Constraints

<task>
Synchronize local repo with remote by default (fetch, pull, push when ahead); support explicit artifact synchronization when requested.
</task>

<requirements>
- In `repo` mode, use explicit git commands: `fetch`, inbound sync (`pull --ff-only` or user-directed rebase flow), then **`git push` when the branch is ahead of upstream**.
- In artifact modes, use only script-based sync/check commands defined by the repo.
- Keep operations deterministic and reproducible.
- Preserve unrelated user changes.
- Always provide a verification summary.
</requirements>

<constraints>
- Do not bypass git hooks or validation unless explicitly requested.
- Do not modify runtime behavior outside sync scope.
- Do not silently skip failed checks.
</constraints>

## Success Criteria

- [ ] Requested sync target completed.
- [ ] Relevant verification completed and reported.
- [ ] No unrelated files were modified intentionally.
- [ ] Final report clearly lists what changed and why.
