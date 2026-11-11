import { describe, expect, it } from 'vitest';
import {
  parseAddedLockEntries,
  dedupeEntries,
  resolvePublishTime,
  isAtLeastDaysOld,
} from '../../scripts/lib/dep-release-age-parse.mjs';

describe('parseAddedLockEntries', () => {
  it('parses an added dependency block', () => {
    const diff = [
      'diff --git a/package-lock.json b/package-lock.json',
      '+    "node_modules/lodash": {',
      '+      "version": "4.17.21",',
      '+      "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",',
      '+      "integrity": "sha512-…",',
      '+    },',
    ].join('\n');
    expect(parseAddedLockEntries(diff)).toEqual([{ name: 'lodash', version: '4.17.21' }]);
  });

  it('parses a changed version as the added block it rewrites', () => {
    const diff = [
      '     "node_modules/react": {',
      '-      "version": "19.1.0",',
      '+    "node_modules/react": {',
      '+      "version": "19.2.0",',
      '+    },',
    ].join('\n');
    expect(parseAddedLockEntries(diff)).toEqual([{ name: 'react', version: '19.2.0' }]);
  });

  it('parses nested transitive blocks with leaf name', () => {
    const diff = [
      '+    "node_modules/@vitest/coverage-v8/node_modules/pretty-format": {',
      '+      "version": "4.1.11",',
      '+    },',
    ].join('\n');
    expect(parseAddedLockEntries(diff)).toEqual([{ name: 'pretty-format', version: '4.1.11' }]);
  });

  it('collects multiple added packages', () => {
    const diff = [
      '+    "node_modules/@scope/pkg-a": {',
      '+      "version": "1.0.0",',
      '+    },',
      '+    "node_modules/pkg-b": {',
      '+      "version": "2.3.4-alpha.1",',
      '+    },',
    ].join('\n');
    expect(parseAddedLockEntries(diff)).toEqual([
      { name: '@scope/pkg-a', version: '1.0.0' },
      { name: 'pkg-b', version: '2.3.4-alpha.1' },
    ]);
  });

  it('ignores removed blocks', () => {
    const diff = ['-    "node_modules/removed-pkg": {', '-      "version": "0.1.0",', '-    },'].join('\n');
    expect(parseAddedLockEntries(diff)).toEqual([]);
  });

  it('parses an in-place upgrade whose block header stays a context line', () => {
    // The real shape of `npm install <pkg>@<newer>`: the header is unchanged, so
    // it is emitted as a context line and only the version/resolved/integrity
    // lines are added. Regression: this used to yield [] and the release-age
    // gate never saw version bumps of existing packages at all.
    const diff = [
      'diff --git a/package-lock.json b/package-lock.json',
      '@@ -3100,9 +3100,9 @@',
      '     "node_modules/vite": {',
      '-      "version": "8.2.2",',
      '-      "resolved": "https://registry.npmjs.org/vite/-/vite-8.2.2.tgz",',
      '-      "integrity": "sha512-old",',
      '+      "version": "8.2.4",',
      '+      "resolved": "https://registry.npmjs.org/vite/-/vite-8.2.4.tgz",',
      '+      "integrity": "sha512-new",',
      '       "dev": true,',
    ].join('\n');
    expect(parseAddedLockEntries(diff)).toEqual([{ name: 'vite', version: '8.2.4' }]);
  });

  it('parses several in-place upgrades in one hunk', () => {
    const diff = [
      '@@ -10,6 +10,6 @@',
      '     "node_modules/happy-dom": {',
      '-      "version": "20.14.5",',
      '+      "version": "21.0.4",',
      '     },',
      '     "node_modules/zod": {',
      '-      "version": "4.3.6",',
      '+      "version": "4.6.7",',
      '     },',
    ].join('\n');
    expect(parseAddedLockEntries(diff)).toEqual([
      { name: 'happy-dom', version: '21.0.4' },
      { name: 'zod', version: '4.6.7' },
    ]);
  });

  it('does not carry a header across a hunk boundary', () => {
    const diff = [
      '@@ -10,4 +10,4 @@',
      '     "node_modules/alpha": {',
      '-      "integrity": "sha512-old",',
      '+      "integrity": "sha512-new",',
      '@@ -900,4 +900,4 @@',
      '+      "version": "9.9.9",',
    ].join('\n');
    expect(parseAddedLockEntries(diff)).toEqual([]);
  });

  it('does not attribute a version line to a removed header', () => {
    const diff = [
      '-    "node_modules/gone": {',
      '-      "version": "0.1.0",',
      '-    },',
      '+      "version": "9.9.9",',
    ].join('\n');
    expect(parseAddedLockEntries(diff)).toEqual([]);
  });

  it('drops attribution at a non-package block such as the root entry', () => {
    const diff = [
      '     "node_modules/alpha": {',
      '       "version": "1.0.0",',
      '     "": {',
      '-      "version": "1.0.0",',
      '+      "version": "1.1.0",',
    ].join('\n');
    expect(parseAddedLockEntries(diff)).toEqual([]);
  });

  it('returns empty for an empty diff', () => {
    expect(parseAddedLockEntries('')).toEqual([]);
  });
});

describe('dedupeEntries', () => {
  it('keeps first occurrence per name@version', () => {
    expect(
      dedupeEntries([
        { name: 'a', version: '1' },
        { name: 'a', version: '1' },
        { name: 'a', version: '2' },
      ]),
    ).toEqual([
      { name: 'a', version: '1' },
      { name: 'a', version: '2' },
    ]);
  });
});

describe('resolvePublishTime', () => {
  it('resolves exact version', () => {
    const t = resolvePublishTime({ '4.17.21': '2021-02-20T00:00:00.000Z' }, '4.17.21');
    expect(t?.toISOString()).toBe('2021-02-20T00:00:00.000Z');
  });

  it('resolves version ignoring build metadata', () => {
    const t = resolvePublishTime({ '1.0.0-alpha.1': '2024-01-01T00:00:00.000Z' }, '1.0.0-alpha.1+build.5');
    expect(t?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('returns null when unknown', () => {
    expect(resolvePublishTime({}, '9.9.9')).toBeNull();
  });
});

describe('isAtLeastDaysOld', () => {
  const now = new Date('2026-09-14T12:00:00.000Z');

  it('passes when exactly the threshold old', () => {
    const publish = new Date('2026-09-07T12:00:00.000Z');
    expect(isAtLeastDaysOld(publish, now, 7)).toBe(true);
  });

  it('fails when younger than threshold', () => {
    const publish = new Date('2026-09-13T23:59:59.000Z');
    expect(isAtLeastDaysOld(publish, now, 7)).toBe(false);
  });

  it('passes for old releases', () => {
    expect(isAtLeastDaysOld(new Date('2021-02-20T00:00:00.000Z'), now, 7)).toBe(true);
  });
});
