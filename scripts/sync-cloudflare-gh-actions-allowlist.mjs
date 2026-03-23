#!/usr/bin/env node

import {
  GITHUB_ACTIONS_RULE_NOTE_PREFIX,
  normalizeCidrs,
  planGithubActionsAllowlistSync,
} from './lib/cloudflare-gh-actions-allowlist.mjs';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
  };
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = data ? JSON.stringify(data) : await res.text();
    throw new Error(`Request failed for ${url}: ${res.status} ${res.statusText}\n${detail}`);
  }

  return data;
}

async function fetchCloudflareJson(url, init) {
  const data = await fetchJson(url, init);

  if (!data?.success) {
    throw new Error(`Cloudflare API reported failure for ${url}\n${JSON.stringify(data)}`);
  }

  return data;
}

async function fetchGithubActionsCidrs() {
  const meta = await fetchJson('https://api.github.com/meta', {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aaveapy-cloudflare-gh-actions-allowlist-sync',
    },
  });

  return normalizeCidrs(meta.actions ?? []);
}

async function listZoneAccessRules({ token, zoneId }) {
  const allRules = [];
  let page = 1;

  while (true) {
    const data = await fetchCloudflareJson(
      `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    allRules.push(...data.result);

    const totalPages = data.result_info?.total_pages ?? page;
    if (page >= totalPages) break;
    page += 1;
  }

  return allRules;
}

async function createZoneAccessRule({ token, zoneId, cidr }) {
  return fetchCloudflareJson(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      configuration: {
        target: 'ip_range',
        value: cidr,
      },
      mode: 'whitelist',
      notes: `${GITHUB_ACTIONS_RULE_NOTE_PREFIX} (managed)`,
    }),
  });
}

async function deleteZoneAccessRule({ token, zoneId, ruleId }) {
  return fetchCloudflareJson(
    `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules/${ruleId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  const token = getRequiredEnv('CLOUDFLARE_API_TOKEN');
  const zoneId = getRequiredEnv('CLOUDFLARE_ZONE_ID');

  const [desiredCidrs, existingRules] = await Promise.all([
    fetchGithubActionsCidrs(),
    listZoneAccessRules({ token, zoneId }),
  ]);

  const plan = planGithubActionsAllowlistSync({
    desiredCidrs,
    existingRules,
  });

  console.log(
    JSON.stringify(
      {
        apply,
        desiredCidrsCount: desiredCidrs.length,
        existingRulesCount: existingRules.length,
        notePrefix: GITHUB_ACTIONS_RULE_NOTE_PREFIX,
        toCreate: plan.toCreate,
        toDelete: plan.toDelete,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to create/delete Cloudflare IP Access Rules.');
    return;
  }

  for (const cidr of plan.toCreate) {
    console.log(`Creating allow rule for ${cidr}`);
    await createZoneAccessRule({ token, zoneId, cidr });
  }

  for (const rule of plan.toDelete) {
    console.log(`Deleting stale allow rule ${rule.id} (${rule.cidr})`);
    await deleteZoneAccessRule({ token, zoneId, ruleId: rule.id });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
