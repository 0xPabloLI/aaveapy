---
name: sync
description: Sync repo data/assets/config with upstream and verify consistency
argument-hint: "[target: all|token-icons|reserve-patches|market-name-map|chain-icons]"
---

# Sync

Run the repository synchronization workflow safely and consistently, with verification and a clear report.

Use this command when you need to update local synced artifacts from upstream scripts and ensure no contract drift is introduced.

## Workflow

### Step 1: Preflight checks

1. Validate repo state before syncing:
   - Run `git status --short` and note unrelated dirty files.
   - Do **not** revert or overwrite unrelated local edits.
2. Confirm available sync/check scripts in `package.json`:
   - `sync-token-icons`
   - `sync:reserve-patches-upstream`
   - `sync:market-name-map-upstream`
   - `sync:chain-icons-upstream`
3. Resolve target from argument:
   - `all` (default): run all sync targets in a safe order.
   - Specific target: run only requested target and its verification.

### Step 2: Execute sync

1. Prefer npm scripts (single source of truth), not ad-hoc commands.
2. Execute target scripts:
   - `token-icons` -> `npm run sync-token-icons`
   - `reserve-patches` -> `npm run sync:reserve-patches-upstream`
   - `market-name-map` -> `npm run sync:market-name-map-upstream`
   - `chain-icons` -> `npm run sync:chain-icons-upstream`
3. For `all`, run sequentially in this order:
   1) reserve-patches
   2) market-name-map
   3) chain-icons
   4) token-icons

### Step 3: Verify integrity

1. Run target-specific checks after sync:
   - token icons: `npm run sync-token-icons -- --check`
   - reserve patches: run corresponding check script if available
   - market name map: run corresponding check script if available
   - chain icon map: run corresponding check script if available
2. Run repository validation:
   - `npm run lint`
   - If present, run CI parity script (for example `npm run ci:remote`).
3. Stop and report immediately if any command fails.

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
Synchronize upstream-derived repository artifacts with explicit verification.
</task>

<requirements>
- Use only script-based sync/check commands defined by the repo.
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

- [ ] Requested sync target(s) completed.
- [ ] Relevant checks completed and reported.
- [ ] No unrelated files were modified intentionally.
- [ ] Final report clearly lists what changed and why.
