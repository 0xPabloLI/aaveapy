import { DEFAULT_STAGING_API_BASE } from './lib/default-api-bases.mjs';

/**
 * One-off / CI-helper: fetch live /markets and compare Merit Base APR
 * (reserve TVL anchor vs last-round implied TVL) using the same math as meritForecast.ts.
 *
 * Usage: node scripts/compare-merit-forecast-paths.mjs
 * Env:   MERIT_COMPARE_API_BASE (default staging; set to production or Railway URL when needed)
 *        MERIT_COMPARE_DEPOSIT_USD (default 100000)
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseBoundary(value, boundary) {
  if (!value) return null;
  if (DATE_ONLY.test(value)) {
    const normalized =
      boundary === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
    const t = Date.parse(normalized);
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function isMeritActive(startDate, endDate, nowMs = Date.now()) {
  const startMs = parseBoundary(startDate, 'start');
  if (startMs === null || nowMs < startMs) return false;
  const endMs = parseBoundary(endDate, 'end');
  if (endMs === null) return false;
  return nowMs <= endMs;
}

function cycleDays(startDate, endDate) {
  const startMs = parseBoundary(startDate, 'start');
  const endMs = parseBoundary(endDate, 'end');
  if (startMs === null || endMs === null || endMs <= startMs) return null;
  const days = (endMs - startMs) / 1000 / 86400;
  return Number.isFinite(days) && days > 0 ? days : null;
}

function aprAfterMeritBaseAnchor(anchorTvlUsd, baseAprPercent, depositUsd) {
  if (!(anchorTvlUsd > 0) || !(baseAprPercent > 0) || !(depositUsd > 0)) return null;
  const daily = (anchorTvlUsd * (baseAprPercent / 100)) / 365;
  const hypo = anchorTvlUsd + depositUsd;
  return (daily * 365) / hypo;
}

function aprAfterMeritBaseLastRound(lastRoundRewardUsd, cycleDaysVal, baseAprPercent, depositUsd) {
  if (
    !(lastRoundRewardUsd > 0) ||
    !(cycleDaysVal > 0) ||
    !(baseAprPercent > 0) ||
    !(depositUsd > 0)
  ) {
    return null;
  }
  const daily = lastRoundRewardUsd / cycleDaysVal;
  const impliedTvl = (daily * 365 * 100) / baseAprPercent;
  if (!(impliedTvl > 0)) return null;
  const hypo = impliedTvl + depositUsd;
  return (daily * 365) / hypo;
}

function pct(dec) {
  if (dec === null || !Number.isFinite(dec)) return 'n/a';
  return (dec * 100).toFixed(4) + '%';
}

function bpDelta(anchorDec, lastDec) {
  if (anchorDec === null || lastDec === null || !Number.isFinite(anchorDec) || !Number.isFinite(lastDec)) {
    return null;
  }
  return (lastDec - anchorDec) * 10000;
}

const API_BASE = process.env.MERIT_COMPARE_API_BASE || DEFAULT_STAGING_API_BASE;
const DEPOSIT = Number(process.env.MERIT_COMPARE_DEPOSIT_USD || '100000');

const res = await fetch(`${API_BASE}/markets`);
if (!res.ok) {
  console.error('Fetch failed', res.status, API_BASE);
  process.exit(1);
}
const data = await res.json();
const reserves = data.reserves;
if (!Array.isArray(reserves)) {
  console.error('No reserves[] in response');
  process.exit(1);
}

const rows = [];
for (const r of reserves) {
  const supplyMerits = r.meritSupplys;
  const borrowMerits = r.meritBorrows;
  const chunks = [];
  if (Array.isArray(supplyMerits)) {
    chunks.push({ merits: supplyMerits, anchor: r.reserveSizeUsd, side: 'supply' });
  }
  if (Array.isArray(borrowMerits)) {
    const u = r.utilizationPct;
    const anchorBorrow =
      typeof r.reserveSizeUsd === 'number' &&
      typeof u === 'number' &&
      Number.isFinite(u) &&
      u >= 0
        ? r.reserveSizeUsd * (u / 100)
        : undefined;
    chunks.push({ merits: borrowMerits, anchor: anchorBorrow, side: 'borrow' });
  }
  for (const { merits, anchor, side } of chunks) {
    if (!Array.isArray(merits)) continue;
    for (const m of merits) {
      if (!m || typeof m.apr !== 'number' || m.apr <= 0) continue;
      if (!isMeritActive(m.startDate, m.endDate)) continue;
      const lr = m.lastRoundRewardUsd;
      if (!(typeof lr === 'number' && lr > 0)) continue;
      const cd = cycleDays(m.startDate, m.endDate);
      if (cd === null) continue;
      if (!(typeof anchor === 'number' && anchor > 0)) continue;

      const aDec = aprAfterMeritBaseAnchor(anchor, m.apr, DEPOSIT);
      const lDec = aprAfterMeritBaseLastRound(lr, cd, m.apr, DEPOSIT);
      if (aDec === null || lDec === null) continue;

      const dBp = bpDelta(aDec, lDec);
      rows.push({
        key: `${r.chainName} / ${r.marketName} / ${r.tokenSymbol} (${side})`,
        name: m.name || '',
        aprHeadline: m.apr,
        anchorTvlUsd: anchor,
        lastRoundUsd: lr,
        cycleDays: cd,
        impliedTvlFromLastRound: (lr / cd) * 365 * (100 / m.apr),
        anchorAprAfter: aDec,
        lastRoundAprAfter: lDec,
        deltaBp: dBp,
      });
    }
  }
}

rows.sort((x, y) => Math.abs(y.deltaBp) - Math.abs(x.deltaBp));

console.log(
  JSON.stringify(
    {
      api: API_BASE,
      depositUsd: DEPOSIT,
      comparedRows: rows.length,
      snapshotLastUpdated: data.snapshot?.lastUpdated,
    },
    null,
    2,
  ),
);
console.log('\nTop divergences (|bp|), simulated APR after +$' + DEPOSIT.toLocaleString() + ' deposit:\n');
console.log(
  '| reserve | headline Base APR | anchor TVL $ | implied TVL from last round | anchor APR after | last-round APR after | delta (bp) |',
);
console.log('|---|--:|--:|--:|--:|--:|--:|');
for (const row of rows.slice(0, 25)) {
  console.log(
    [
      row.key.replace(/\|/g, ' '),
      row.aprHeadline.toFixed(2),
      Math.round(row.anchorTvlUsd).toLocaleString(),
      Math.round(row.impliedTvlFromLastRound).toLocaleString(),
      pct(row.anchorAprAfter),
      pct(row.lastRoundAprAfter),
      row.deltaBp === null ? 'n/a' : row.deltaBp.toFixed(2),
    ].join(' | '),
  );
}

if (rows.length === 0) {
  console.log('\n(No rows with active Merit Base + reserveSizeUsd + lastRoundRewardUsd + valid cycle.)');
} else {
  const abs = rows.map((r) => Math.abs(r.deltaBp));
  const max = Math.max(...abs);
  const mean = abs.reduce((s, x) => s + x, 0) / abs.length;
  console.log('\nSummary: max |delta| = ' + max.toFixed(2) + ' bp, mean |delta| = ' + mean.toFixed(2) + ' bp');
}
