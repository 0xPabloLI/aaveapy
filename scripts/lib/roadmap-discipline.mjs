/**
 * Roadmap discipline — pure parsers behind `scripts/roadmap-discipline.test.mjs`.
 *
 * Why this exists: `docs/issue-roadmap.md` grew to 105KB because the only rule
 * about its size was a sentence ("keep it concise"). 2026-11-17 拆出 archive 之后，
 * 剩下的风险是三条：inventory 行重新写长、分组标题的计数与表行漂移、Done 票
 * 又混回 Active 区。规则写在 markdown 里执行不了，所以每条都变成可断言的数字。
 */

/** `> **Last inventory**: …` — the only inventory line allowed to stay in the roadmap. */
export const INVENTORY_PREFIX = '> **Last inventory**: ';
/** Budget: round + ticket + one-line verdict, PR/squash sha, product gate, frontier. */
export const INVENTORY_BUDGET = 600;
/** Recently Completed is a rolling window, not a second ledger. */
export const RECENTLY_COMPLETED_BUDGET = 30;

const SECTION_ACTIVE = '## Active Linear Issues';
const SECTION_NEXT = '## Backlog Projects';
const SECTION_RECENT = '## Recently Completed';
const SECTION_RULES = '## 维护规则';

/** Slice between two `## ` headings (start inclusive, end exclusive). */
export function sliceSection(markdown, startHeading, endHeading) {
  const a = markdown.indexOf(startHeading);
  if (a === -1) return null;
  const b = endHeading ? markdown.indexOf(endHeading, a) : -1;
  return b === -1 ? markdown.slice(a) : markdown.slice(a, b);
}

function lines(markdown) {
  return markdown.split('\n');
}

/** The `Last inventory` lines present in a document. */
export function findInventoryLines(markdown) {
  return lines(markdown).filter((line) => line.startsWith(INVENTORY_PREFIX));
}

/** '### Needs Info（7）' → { title, declared } */
export function parseGroupHeading(heading) {
  const match = /^###\s+(.+?)（(\d+)）\s*$/.exec(heading.trim());
  if (!match) return null;
  return { title: match[1].trim(), declared: Number(match[2]) };
}

/** Ticket ids in `| AAV-123 |` rows, in file order. */
export function extractTicketIds(text) {
  const ids = [];
  for (const line of lines(text)) {
    const match = /^\|\s*(AAV-\d+)/.exec(line);
    if (match) ids.push(match[1]);
  }
  return ids;
}

/**
 * Groups in the Active section with their declared vs actual row counts.
 * Declared count is the number in the heading; actual is the number of `| AAV-` rows
 * beneath it, which is exactly the pair that drifts when someone edits by hand.
 */
export function parseActiveGroups(markdown) {
  const section = sliceSection(markdown, SECTION_ACTIVE, SECTION_NEXT);
  if (section === null) return [];
  const groups = [];
  let current = null;
  for (const line of lines(section)) {
    if (line.startsWith('### ')) {
      const heading = parseGroupHeading(line);
      current = heading ? { ...heading, rows: [] } : null;
      if (current) groups.push(current);
      continue;
    }
    if (line.startsWith('## ')) {
      current = null;
      continue;
    }
    if (!current) continue;
    const match = /^\|\s*(AAV-\d+)/.exec(line);
    if (match) current.rows.push(match[1]);
  }
  return groups;
}

/** Ticket ids listed in Recently Completed. */
export function parseRecentlyCompleted(markdown) {
  const section = sliceSection(markdown, SECTION_RECENT, SECTION_RULES);
  return section === null ? [] : extractTicketIds(section);
}

/** Relative archive targets linked from the document, e.g. `./archive/x.md`. */
export function extractArchiveLinks(markdown) {
  const links = new Set();
  for (const match of markdown.matchAll(/\]\((\.\/archive\/[^)]+)\)/g)) {
    links.add(match[1]);
  }
  return [...links];
}

/** Every check that can fail, as data — so tests can drive it without touching files. */
export function auditRoadmap(markdown) {
  const problems = [];

  const inventories = findInventoryLines(markdown);
  if (inventories.length !== 1) {
    problems.push(`expected exactly 1 Last inventory line, found ${inventories.length}`);
  }
  for (const line of inventories) {
    if (line.length > INVENTORY_BUDGET) {
      problems.push(`Last inventory is ${line.length} chars, budget is ${INVENTORY_BUDGET}`);
    }
  }

  const groups = parseActiveGroups(markdown);
  for (const group of groups) {
    if (group.rows.length !== group.declared) {
      problems.push(`group 「${group.title}」 declares ${group.declared}, has ${group.rows.length} rows`);
    }
  }

  const activeIds = groups.flatMap((group) => group.rows);
  const duplicates = activeIds.filter((id, index) => activeIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    problems.push(`duplicate rows in Active: ${[...new Set(duplicates)].join(', ')}`);
  }

  const completed = parseRecentlyCompleted(markdown);
  const overlap = activeIds.filter((id) => completed.includes(id));
  if (overlap.length > 0) {
    problems.push(`listed as both open and completed: ${overlap.join(', ')}`);
  }
  if (completed.length > RECENTLY_COMPLETED_BUDGET) {
    problems.push(`Recently Completed has ${completed.length} rows, budget is ${RECENTLY_COMPLETED_BUDGET}`);
  }

  return problems;
}
