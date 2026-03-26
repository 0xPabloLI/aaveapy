---
name: docs
description: Deduplicate, prune outdated content, and merge overlapping docs
argument-hint: "[scope or paths, optional: output doc path]"
---

# Docs

Deduplicate overlapping documentation, remove outdated sections, and merge fragmented knowledge into a single authoritative structure.

Implement documentation deduplication, deprecation cleanup, and merge following these steps:

## Workflow

### Step 1: Scope and inventory

1. Identify target docs from the provided scope/path arguments.
2. Build an inventory table for each document including:
   - Purpose and audience
   - Last meaningful update
   - Canonicality (source of truth vs derivative)
   - Overlap candidates
3. If no scope is provided, default to `docs/**/*.md` plus top-level product docs such as `README.md`.

### Step 2: Detect duplicates and stale content

1. Search for semantically duplicated sections (same policy, same API contract, same workflow).
2. Mark stale statements (deprecated commands, outdated architecture, superseded conventions).
3. Classify each overlap using one action only:
   - `keep` (authoritative, current)
   - `merge` (valuable but fragmented)
   - `drop` (obsolete or duplicate)

### Step 3: Define canonical structure

1. Propose a target structure before editing:
   - Primary canonical document(s)
   - Section mapping from old -> new location
   - Redirect notes for renamed/moved docs
2. Preserve high-signal details and examples; remove repetitive narrative.
3. Ensure each key topic has exactly one canonical home.

### Step 4: Execute merge and cleanup

1. Apply edits atomically:
   - Merge unique content into canonical docs
   - Replace removed sections with short pointers when needed
   - Delete only files confirmed obsolete
2. Keep style consistent with existing repo documentation conventions.
3. Update internal links and cross-references after all moves.

### Step 5: Validate and report

1. Verify no broken markdown links in touched docs.
2. Run project lint/doc checks if available.
3. Produce a concise change report:
   - Files merged
   - Files removed
   - Canonical docs created/updated
   - Open follow-ups (if any)

## Constraints

<task>
Focus only on documentation deduplication, deprecation cleanup, and content merging.
</task>

<requirements>
- Prefer minimal, high-signal docs.
- Keep one source of truth per topic.
- Preserve critical technical details and edge cases.
- Keep historical context only when it affects current decisions.
</requirements>

<constraints>
- Do not change application runtime code unless strictly necessary for link/reference integrity.
- Do not invent undocumented behaviors.
- Do not remove content without either merging it or explicitly classifying it as obsolete.
</constraints>

## Success Criteria

- [ ] Duplicate sections are removed or merged.
- [ ] Outdated content is pruned or clearly marked.
- [ ] Each topic has one canonical document location.
- [ ] Internal links and references are valid.
- [ ] Final report lists what was merged, removed, and retained.
