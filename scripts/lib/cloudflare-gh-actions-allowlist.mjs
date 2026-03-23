export const GITHUB_ACTIONS_RULE_NOTE_PREFIX = 'GitHub Actions egress allowlist';

function sortStrings(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function normalizeCidrs(cidrs) {
  return sortStrings(
    [...new Set(cidrs.map((cidr) => cidr.trim()).filter(Boolean))],
  );
}

function isManagedAllowlistRule(rule) {
  return (
    rule?.mode === 'whitelist' &&
    rule?.configuration?.target === 'ip_range' &&
    typeof rule?.configuration?.value === 'string' &&
    typeof rule?.notes === 'string' &&
    rule.notes.startsWith(GITHUB_ACTIONS_RULE_NOTE_PREFIX)
  );
}

export function planGithubActionsAllowlistSync({ desiredCidrs, existingRules }) {
  const normalizedDesired = normalizeCidrs(desiredCidrs);
  const managedRules = existingRules.filter(isManagedAllowlistRule);
  const existingManagedCidrs = new Set(
    managedRules.map((rule) => rule.configuration.value),
  );
  const desiredCidrsSet = new Set(normalizedDesired);

  const toCreate = normalizedDesired.filter((cidr) => !existingManagedCidrs.has(cidr));
  const toDelete = managedRules
    .filter((rule) => !desiredCidrsSet.has(rule.configuration.value))
    .map((rule) => ({
      cidr: rule.configuration.value,
      id: rule.id,
    }));

  return {
    toCreate,
    toDelete: sortStrings(toDelete.map((rule) => JSON.stringify(rule))).map((rule) =>
      JSON.parse(rule),
    ),
  };
}
