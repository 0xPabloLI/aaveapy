/**
 * Extract the GraphQL fields a workflow selects on `autoMergeRequest`.
 *
 * A GraphQL document with a field that doesn't exist on the type is rejected
 * *whole* — the mutation never runs. That is how a shipped sync workflow created
 * its PR but silently left auto-merge unset, so the selection set of every
 * auto-merge mutation in this repo is pinned here against the schema's real field
 * list.
 *
 * LEGAL_AUTO_MERGE_FIELDS comes from introspection, not memory:
 *   gh api graphql -f query='{ __type(name: "AutoMergeRequest") { fields { name } } }'
 * (observed 2026-10-10).
 */

export const LEGAL_AUTO_MERGE_FIELDS = [
  'authorEmail',
  'commitBody',
  'commitHeadline',
  'enabledAt',
  'enabledBy',
  'mergeMethod',
  'pullRequest',
];

/**
 * Every `autoMergeRequest { a b }` selection in `source`, as arrays of field names.
 * Brace depth is tracked so a nested selection set cannot be mistaken for the
 * outer one's fields.
 */
export function extractAutoMergeSelections(source) {
  const found = [];
  const re = /autoMergeRequest\s*\{/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    let depth = 0;
    let i = match.index + match[0].length - 1; // at the opening brace
    let body = '';
    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '{') {
        depth += 1;
        if (depth === 1) continue;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
      if (depth === 1) body += ch;
    }
    found.push(body.split(/[^A-Za-z_]+/).filter(Boolean));
  }
  return found;
}

/** Fields selected on autoMergeRequest that the schema does not define. */
export function findIllegalAutoMergeFields(source, legal = LEGAL_AUTO_MERGE_FIELDS) {
  const violations = [];
  for (const fields of extractAutoMergeSelections(source)) {
    for (const field of fields) {
      if (!legal.includes(field)) violations.push(field);
    }
  }
  return violations;
}
