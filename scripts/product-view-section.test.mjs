#!/usr/bin/env node
/**
 * Spec for the Linear renderer (AAV-1389).
 *
 * The loader is injected, so these cases never leave the process — and a trap on
 * `fetch` asserts that, which is the same rule AAV-1335 pinned for the scripts
 * suite: a unit test that reaches the network is a gate that fails on one machine
 * and passes on another.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs, renderProductViewSection } from './product-view-section.mjs';

const SECTION = `## 产品视角

- 原本要解决什么用户可见问题：产品的交付汇报从不提用户能感知什么。
- 用户现在看到什么变化：每次交付以三句产品视角开头，缺席即视为未完成。
- 没有变的行为或边界：票的状态流转与实现细节的写法不变。
`;

const RECORD = `交付记录\n\n${SECTION}`;

/** Two records, newest second in `createdAt` order, plus chatter that is not a record. */
function issueWith(comments) {
  return async (identifier) => ({ identifier, comments });
}

describe('renderProductViewSection', () => {
  it('quotes the newest compliant record and names its source', async () => {
    const result = await renderProductViewSection({
      identifier: 'AAV-1389',
      loadIssue: issueWith([
        { id: 'old', body: `交付记录\n\n修好了。`, createdAt: '2026-11-16T10:00:00Z' },
        { id: 'new', body: RECORD, createdAt: '2026-11-16T12:00:00Z' },
        { id: 'note', body: '随口一句，不是交付记录', createdAt: '2026-11-16T13:00:00Z' },
      ]),
    });

    assert.equal(result.ok, true);
    assert.equal(result.source.id, 'new');
    assert.match(result.text, /<!-- product-view: source=comment:new/);
    assert.match(result.text, /^## 产品视角/m);
    assert.match(result.text, /产品的交付汇报从不提用户能感知什么/);
  });

  it('refuses a record whose section is too thin, and says why', async () => {
    const result = await renderProductViewSection({
      identifier: 'AAV-1389',
      loadIssue: issueWith([{ id: 'thin', body: '交付记录\n\n修好了。', createdAt: '2026-11-16T12:00:00Z' }]),
    });

    assert.equal(result.ok, false);
    assert.match(result.reason, /thin/);
    assert.match(result.reason, /post the delivery record/);
  });

  it('refuses when no comment carries the record marker', async () => {
    const result = await renderProductViewSection({
      identifier: 'AAV-1389',
      loadIssue: issueWith([{ id: 'chat', body: SECTION, createdAt: '2026-11-16T12:00:00Z' }]),
    });

    assert.equal(result.ok, false);
    assert.match(result.reason, /no comment carries the `交付记录` marker/);
  });

  it('rejects a malformed identifier', async () => {
    await assert.rejects(
      () => renderProductViewSection({ identifier: '1389', loadIssue: issueWith([]) }),
      /Linear issue identifier/,
    );
  });
});

describe('parseArgs', () => {
  it('accepts one identifier', () => {
    assert.equal(parseArgs(['AAV-1389']), 'AAV-1389');
  });

  it('rejects flags and extra arguments', () => {
    assert.throws(() => parseArgs(['--repo', 'x']), /unknown flag/);
    assert.throws(() => parseArgs(['AAV-1389', 'AAV-1335']), /exactly one/);
    assert.throws(() => parseArgs(['1389']), /Linear issue identifier/);
  });
});

describe('hermeticity', () => {
  it('renders with an injected loader without touching the network', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = () => {
      calls += 1;
      throw new Error('network is trapped in this suite');
    };
    try {
      const result = await renderProductViewSection({
        identifier: 'AAV-1389',
        loadIssue: issueWith([{ id: 'ok', body: RECORD, createdAt: '2026-11-16T12:00:00Z' }]),
      });
      assert.equal(result.ok, true);
    } finally {
      globalThis.fetch = original;
    }
    assert.equal(calls, 0);
  });
});
