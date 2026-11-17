#!/usr/bin/env node
/**
 * Guard: `docs/issue-roadmap.md` stays an index instead of growing back into a ledger.
 *
 * 105KB → 26KB on 2026-11-17 came from moving 24 inventory rounds and 26 closed rows
 * into `docs/archive/`. A one-off cleanup would regress within two rounds unless the
 * three failure modes are checkable, which is what this file does:
 *
 *   1. the inventory line grows past its 4-carrier / 600-char budget;
 *   2. a group heading's declared count drifts from the rows under it;
 *   3. a Done ticket reappears in the Active section (or a row is duplicated).
 *
 * Every assertion is on the real file plus a constructed negative control, so a
 * passing run means the rule was evaluated, not that nobody edited the file.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import {
  INVENTORY_BUDGET,
  RECENTLY_COMPLETED_BUDGET,
  auditRoadmap,
  extractArchiveLinks,
  findInventoryLines,
  parseActiveGroups,
  parseGroupHeading,
  parseRecentlyCompleted,
} from './lib/roadmap-discipline.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const ROADMAP_PATH = join(ROOT, 'docs', 'issue-roadmap.md');
const roadmap = readFileSync(ROADMAP_PATH, 'utf8');

describe('docs/issue-roadmap.md discipline', () => {
  it('keeps the inventory line inside its budget', () => {
    const inventories = findInventoryLines(roadmap);
    assert.equal(inventories.length, 1, 'exactly one Last inventory line may live in the roadmap');
    assert.ok(
      inventories[0].length <= INVENTORY_BUDGET,
      `Last inventory is ${inventories[0].length} chars, budget is ${INVENTORY_BUDGET}`,
    );
  });

  it('declares the same count as the rows it governs', () => {
    const groups = parseActiveGroups(roadmap);
    assert.ok(groups.length > 0, 'Active section must have at least one状态 group');
    for (const group of groups) {
      assert.equal(
        group.rows.length,
        group.declared,
        `group 「${group.title}」 declares ${group.declared}, has ${group.rows.length}`,
      );
    }
  });

  it('lists every open ticket exactly once', () => {
    const ids = parseActiveGroups(roadmap).flatMap((group) => group.rows);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ticket ids in Active section');
  });

  it('never lists a completed ticket as open', () => {
    const active = parseActiveGroups(roadmap).flatMap((group) => group.rows);
    const completed = parseRecentlyCompleted(roadmap);
    const overlap = active.filter((id) => completed.includes(id));
    assert.deepEqual(overlap, [], 'ticket is both open and completed');
  });

  it('keeps Recently Completed a rolling window', () => {
    assert.ok(
      parseRecentlyCompleted(roadmap).length <= RECENTLY_COMPLETED_BUDGET,
      `Recently Completed exceeded ${RECENTLY_COMPLETED_BUDGET} rows —下沉进 archive`,
    );
  });

  it('links only archive files that exist', () => {
    const links = extractArchiveLinks(roadmap);
    assert.ok(links.length > 0, 'the inventory history must stay discoverable from the roadmap');
    for (const link of links) {
      const target = join(dirname(ROADMAP_PATH), link);
      assert.ok(existsSync(target), `archive link does not resolve: ${link}`);
    }
  });
});

describe('auditRoadmap catches the regressions it exists for', () => {
  const healthy = `## 当前状态

> **Last inventory**: 2026-11-17（R24：一句话结论。frontier：AAV-1356。）

## Active Linear Issues

### Todo（2）

| Linear | Priority | Title |
| --- | --- | --- |
| AAV-1 | Low | 甲 |
| AAV-2 | Low | 乙 |

## Recently Completed

| Linear | Title | Closed |
| --- | --- | --- |
| AAV-3 | 丙 | 2026-11-17 |

## 维护规则

- 规则。
`;

  it('passes a healthy document', () => {
    assert.deepEqual(auditRoadmap(healthy), []);
  });

  it('flags an inventory line over budget', () => {
    const bloated = healthy.replace(
      '> **Last inventory**: 2026-11-17（R24：一句话结论。frontier：AAV-1356。）',
      `> **Last inventory**: ${'x'.repeat(INVENTORY_BUDGET + 10)}`,
    );
    assert.match(auditRoadmap(bloated).join('\n'), /budget is 600/);
  });

  it('flags a heading count that drifted from its rows', () => {
    const drifted = healthy.replace('### Todo（2）', '### Todo（3）');
    assert.match(auditRoadmap(drifted).join('\n'), /declares 3, has 2 rows/);
  });

  it('flags a Done ticket that came back to the Active section', () => {
    const regression = healthy.replace('| AAV-2 | Low | 乙 |', '| AAV-3 | Low | 丙 |');
    assert.match(auditRoadmap(regression).join('\n'), /both open and completed/);
  });

  it('flags a duplicated row', () => {
    const duplicated = healthy.replace('| AAV-2 | Low | 乙 |', '| AAV-1 | Low | 乙 |');
    assert.match(auditRoadmap(duplicated).join('\n'), /duplicate rows in Active: AAV-1/);
  });

  it('flags a second inventory line sneaking back in', () => {
    const stacked = healthy.replace(
      '## Active Linear Issues',
      '> **Last inventory**: 2026-11-18（R25：又写了一轮。）\n\n## Active Linear Issues',
    );
    assert.match(auditRoadmap(stacked).join('\n'), /expected exactly 1/);
  });
});

describe('parsers', () => {
  it('reads a group heading with a full-width paren count', () => {
    assert.deepEqual(parseGroupHeading('### Ready for agent（9）'), {
      title: 'Ready for agent',
      declared: 9,
    });
    assert.equal(parseGroupHeading('### 无计数的标题'), null);
  });
});
