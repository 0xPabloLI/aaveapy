#!/usr/bin/env node
/**
 * Spec for the pure product-view checker (AAV-1389).
 *
 * The checker is the generic half copied from inside-china-ai: same three
 * prompts, same "shape not truth" boundary. These cases pin the behaviour the
 * PR gate relies on, so a future edit cannot quietly widen or narrow it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PRODUCT_VIEW_ROLES,
  countUnits,
  evaluateCommentProductView,
  evaluateProductView,
  extractSection,
} from './check-product-view.mjs';

const COMPLETE = `## 产品视角

- 原本要解决什么用户可见问题：储备行展开后无法再次收起，用户被困在模拟子行里。
- 用户现在看到什么变化：再次点击同一行即收起，交互与其它可展开行一致。
- 没有变的行为或边界：单次模拟的展开状态与滚动定位保持原样。

## 附录
`;

describe('extractSection', () => {
  it('accepts the Chinese heading and stops at the next same-level heading', () => {
    const section = extractSection(COMPLETE);
    assert.match(section, /储备行展开后无法再次收起/);
    assert.doesNotMatch(section, /附录/);
  });

  it('accepts the English heading spelling', () => {
    const section = extractSection('## Product view\n\n- one line long enough to count\n');
    assert.equal(section, '- one line long enough to count');
  });

  it('returns null when no heading is present', () => {
    assert.equal(extractSection('## Summary\n\n- something\n'), null);
  });
});

describe('countUnits', () => {
  it('counts three substantive bullets as three units', () => {
    assert.equal(countUnits(COMPLETE.split('## 附录')[0].replace('## 产品视角', '')), 3);
  });

  it('counts a three-sentence paragraph written without bullets', () => {
    const paragraph = '原本储备行展开后无法收起。现在再次点击同一行就会收起。单次模拟的展开状态没有变。';
    assert.ok(countUnits(paragraph) >= 3);
  });

  it('drops unfilled template bullets, so a pasted template is not substance', () => {
    const template = PRODUCT_VIEW_ROLES.map((role) => `- ${role}：`).join('\n');
    assert.equal(countUnits(template), 0);
  });
});

describe('evaluateProductView (PR body)', () => {
  it('passes a complete section', () => {
    const result = evaluateProductView({ body: COMPLETE, author: '0xPabloLI' });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, false);
  });

  it('fails a body without the section', () => {
    const result = evaluateProductView({ body: '## Summary\n\n- fix a thing\n' });
    assert.equal(result.ok, false);
    assert.match(result.reason, /no product-view section/);
  });

  it('fails a section that holds fewer than three substantive units', () => {
    const result = evaluateProductView({ body: '## 产品视角\n\n- 修好了\n' });
    assert.equal(result.ok, false);
    assert.match(result.reason, /needs 3/);
  });

  it('fails a section left as the shipped template', () => {
    const template = `## 产品视角\n\n${PRODUCT_VIEW_ROLES.map((role) => `- ${role}：`).join('\n')}\n`;
    const result = evaluateProductView({ body: template });
    assert.equal(result.ok, false);
  });

  it('exempts a bot author and says which rule did it', () => {
    const result = evaluateProductView({ body: '', author: 'renovate[bot]' });
    assert.deepEqual([result.ok, result.skipped], [true, true]);
    assert.match(result.reason, /is a bot/);
  });

  it('exempts an app actor whose login lacks the [bot] suffix, via the account type', () => {
    const result = evaluateProductView({ body: '', author: 'app/renovate', authorType: 'Bot' });
    assert.deepEqual([result.ok, result.skipped], [true, true]);
    assert.match(result.reason, /is a bot/);
  });

  it('exempts the label and says so', () => {
    const result = evaluateProductView({ body: '', author: '0xPabloLI', labels: ['skip-product-view'] });
    assert.deepEqual([result.ok, result.skipped], [true, true]);
    assert.match(result.reason, /label skip-product-view/);
  });

  it('skips non-pull-request events rather than failing on a missing body', () => {
    const result = evaluateProductView({ body: '', eventName: 'push' });
    assert.deepEqual([result.ok, result.skipped], [true, true]);
  });
});

describe('evaluateCommentProductView (delivery record)', () => {
  it('passes a complete section', () => {
    assert.equal(evaluateCommentProductView(`交付记录\n\n${COMPLETE}`).ok, true);
  });

  it('has no author or label exemption: a comment either carries the section or fails', () => {
    const result = evaluateCommentProductView('交付记录\n\n修好了，测试全绿。');
    assert.equal(result.ok, false);
  });
});
