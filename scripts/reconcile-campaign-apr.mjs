#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { DEFAULT_STAGING_API_BASE } from './lib/default-api-bases.mjs';

const DEFAULT_TOLERANCE_PP = 0.0001;
const execFileAsync = promisify(execFile);

function safeNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseArgs(argv) {
  let outputPath = process.env.APR_RECON_OUTPUT || null;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--output' || arg === '-o') {
      outputPath = argv[i + 1] || null;
      i += 1;
    }
  }
  return { outputPath };
}

function classifyRow(row, tolerance) {
  if (!row.hasBasicInputs) {
    return {
      category: 'needs-data-check',
      reason: row.missingReason,
      match: false,
      projectedAprPercent: null,
    };
  }

  if (row.pointsMode) {
    return {
      category: 'plain-match',
      reason: 'points-mode',
      match: true,
      projectedAprPercent: row.impliedAprPercent,
    };
  }

  if (row.campaignType === 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE') {
    if (row.aprCapPercent === null) {
      return {
        category: 'needs-data-check',
        reason: 'max-missing-aprCap',
        match: false,
        projectedAprPercent: null,
      };
    }
    const requiredDaily = row.requiredDaily ?? row.plannedDaily;
    const aprCapDecimal = row.aprCapPercent / 100;
    const aprBasedDaily = (row.latestTvl * aprCapDecimal) / 365;
    const dailyRewards = Math.min(requiredDaily, aprBasedDaily);
    const projectedAprPercent = (dailyRewards * 365) / row.latestTvl * 100;
    const diff = Math.abs(projectedAprPercent - row.campaignApr);
    return {
      category: 'capped-required',
      reason: 'max-branch',
      match: diff <= tolerance,
      projectedAprPercent,
      diff,
    };
  }

  if (row.campaignType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE') {
    if (row.aprCapPercent === null || row.remainingBudget === null) {
      return {
        category: 'needs-data-check',
        reason: 'fix-missing-aprCap-or-budget',
        match: false,
        projectedAprPercent: null,
      };
    }
    const aprCapDecimal = row.aprCapPercent / 100;
    const aprBasedDaily = (row.latestTvl * aprCapDecimal) / 365;
    const dailyRewards = Math.min(aprBasedDaily, row.remainingBudget);
    const projectedAprPercent = (dailyRewards * 365) / row.latestTvl * 100;
    const diff = Math.abs(projectedAprPercent - row.campaignApr);
    return {
      category: 'capped-required',
      reason: 'fix-branch',
      match: diff <= tolerance,
      projectedAprPercent,
      diff,
    };
  }

  const diff = Math.abs(row.impliedAprPercent - row.campaignApr);
  return {
    category: diff <= tolerance ? 'plain-match' : 'needs-data-check',
    reason: diff <= tolerance ? 'plain-formula' : 'plain-diff-exceeds-tolerance',
    match: diff <= tolerance,
    projectedAprPercent: row.impliedAprPercent,
    diff,
  };
}

function toPercent(n) {
  if (!Number.isFinite(n)) return 'n/a';
  return `${n.toFixed(9)}%`;
}

function toPp(n) {
  if (!Number.isFinite(n)) return 'n/a';
  return `${n >= 0 ? '+' : ''}${n.toFixed(9)}pp`;
}

async function fetchJsonWithCurlFallback(url) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch {
    const { stdout } = await execFileAsync('curl', ['-sS', url], { maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(stdout);
  }
}

async function main() {
  const { outputPath } = parseArgs(process.argv);
  const base = (process.env.APR_RECON_API_BASE || DEFAULT_STAGING_API_BASE).replace(/\/$/, '');
  const tolerance = safeNumber(process.env.APR_RECON_TOLERANCE_PP) ?? DEFAULT_TOLERANCE_PP;

  const [markets, sideData] = await Promise.all([
    fetchJsonWithCurlFallback(`${base}/markets`),
    fetchJsonWithCurlFallback(`${base}/meta/side-data`),
  ]);
  const forecastMap = new Map(
    (((sideData.forecast || {}).items) || []).map((x) => [String(x.campaignId), x]),
  );

  const rows = [];
  const keys = ['merklSupplys', 'merklBorrows', 'merklHolds'];

  for (const reserve of markets.reserves || []) {
    for (const key of keys) {
      const side = key === 'merklSupplys' ? 'supply' : key === 'merklBorrows' ? 'borrow' : 'hold';
      for (const group of reserve[key] || []) {
        for (const breakdown of group.breakdowns || []) {
          const campaignId = String(breakdown.campaignId ?? '');
          if (!campaignId) continue;
          const forecast = forecastMap.get(campaignId) || null;

          const plannedDaily = safeNumber(breakdown.plannedDaily);
          const latestTvl = safeNumber(breakdown.latestTvl);
          const campaignApr = safeNumber(breakdown.campaignApr);
          const aprCapPercent = safeNumber(breakdown.aprCap);
          const totalBudget = safeNumber(breakdown.totalBudget);
          const distributedSoFar = safeNumber(forecast?.distributedSoFar);
          const requiredDaily = safeNumber(forecast?.requiredDaily);
          const points = safeNumber(breakdown.pointsPerThousandUsd);
          const pointsMode = (campaignApr ?? 0) === 0 && (points ?? 0) > 0;

          const missing = [];
          if (campaignApr === null) missing.push('campaignApr');
          if (plannedDaily === null) missing.push('plannedDaily');
          if (latestTvl === null) missing.push('latestTvl');
          if (latestTvl !== null && latestTvl <= 0) missing.push('latestTvl<=0');
          const hasBasicInputs = missing.length === 0;

          const impliedAprPercent =
            hasBasicInputs ? (plannedDaily * 365) / latestTvl * 100 : Number.NaN;
          const remainingBudget =
            totalBudget !== null && distributedSoFar !== null
              ? Math.max(totalBudget - distributedSoFar, 0)
              : null;

          const row = {
            campaignId,
            chainName: reserve.chainName,
            marketName: reserve.marketName,
            tokenSymbol: reserve.tokenSymbol,
            side,
            campaignType: breakdown.campaignType || null,
            campaignApr,
            plannedDaily,
            requiredDaily,
            latestTvl,
            aprCapPercent,
            totalBudget,
            distributedSoFar,
            remainingBudget,
            pointsMode,
            hasBasicInputs,
            missingReason: missing.join(','),
            impliedAprPercent,
          };

          const result = classifyRow(row, tolerance);
          rows.push({
            ...row,
            ...result,
            diffFromCampaignApr:
              result.projectedAprPercent === null || campaignApr === null
                ? null
                : result.projectedAprPercent - campaignApr,
          });
        }
      }
    }
  }

  const totals = {
    all: rows.length,
    plainMatch: rows.filter((r) => r.category === 'plain-match').length,
    cappedRequired: rows.filter((r) => r.category === 'capped-required').length,
    needsDataCheck: rows.filter((r) => r.category === 'needs-data-check').length,
    matched: rows.filter((r) => r.match).length,
  };

  const notMatched = rows
    .filter((r) => r.match === false)
    .sort((a, b) => {
      const da = Math.abs(a.diffFromCampaignApr ?? Number.POSITIVE_INFINITY);
      const db = Math.abs(b.diffFromCampaignApr ?? Number.POSITIVE_INFINITY);
      return db - da;
    });

  const summary = {
    base,
    tolerancePercentPoint: tolerance,
    snapshotLastUpdated: markets.snapshot?.lastUpdated ?? null,
    generatedAt: new Date().toISOString(),
    totals,
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log('\nTop not-matched rows (up to 20):');
  for (const r of notMatched.slice(0, 20)) {
    console.log(
      [
        `campaignId=${r.campaignId}`,
        `type=${r.campaignType ?? 'n/a'}`,
        `category=${r.category}`,
        `reason=${r.reason}`,
        `${r.chainName} ${r.tokenSymbol} ${r.side}`,
        `campaignApr=${toPercent(r.campaignApr)}`,
        `projectedApr=${toPercent(r.projectedAprPercent)}`,
        `diff=${toPp(r.diffFromCampaignApr)}`,
      ].join(' | '),
    );
  }

  if (outputPath) {
    const lines = [];
    lines.push('# Campaign APR Reconciliation Report');
    lines.push('');
    lines.push(`- Generated at: ${summary.generatedAt}`);
    lines.push(`- API base: ${summary.base}`);
    lines.push(`- Snapshot lastUpdated: ${summary.snapshotLastUpdated ?? 'n/a'}`);
    lines.push(`- Tolerance: ${summary.tolerancePercentPoint}pp`);
    lines.push('');
    lines.push('## Totals');
    lines.push('');
    lines.push(`- all: ${totals.all}`);
    lines.push(`- plain-match: ${totals.plainMatch}`);
    lines.push(`- capped-required: ${totals.cappedRequired}`);
    lines.push(`- needs-data-check: ${totals.needsDataCheck}`);
    lines.push(`- matched: ${totals.matched}`);
    lines.push(`- not-matched: ${totals.all - totals.matched}`);
    lines.push('');
    lines.push('## Top not-matched rows');
    lines.push('');
    lines.push('| campaignId | chain | token | side | type | category | reason | campaignApr | projectedApr | diff |');
    lines.push('|---|---|---|---|---|---|---|---:|---:|---:|');
    for (const r of notMatched.slice(0, 50)) {
      lines.push(
        `| \`${r.campaignId}\` | ${r.chainName ?? 'n/a'} | ${r.tokenSymbol ?? 'n/a'} | ${r.side} | ${
          r.campaignType ?? 'n/a'
        } | ${r.category} | ${r.reason} | ${toPercent(r.campaignApr)} | ${toPercent(
          r.projectedAprPercent,
        )} | ${toPp(r.diffFromCampaignApr)} |`,
      );
    }
    lines.push('');
    await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
    console.log(`\nWrote markdown report to ${outputPath}`);
  }
}

main().catch((error) => {
  console.error('reconcile-campaign-apr failed:', error?.message ?? error);
  process.exit(1);
});
