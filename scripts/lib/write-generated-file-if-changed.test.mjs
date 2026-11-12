import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, it } from 'node:test';

import { writeGeneratedFileIfChanged } from './write-generated-file-if-changed.mjs';

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aaveapy-generated-file-'));
  tempDirs.push(dir);
  return dir;
}

describe('writeGeneratedFileIfChanged', () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes the file when it does not exist yet', () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'manifest.generated.ts');

    const didWrite = writeGeneratedFileIfChanged(filePath, 'export const value = 1;\n');

    assert.ok(didWrite);
    assert.equal(fs.readFileSync(filePath, 'utf8'), 'export const value = 1;\n');
  });

  it('does not rewrite the file when content is unchanged', async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'manifest.generated.ts');

    assert.ok(writeGeneratedFileIfChanged(filePath, 'export const value = 1;\n'));
    const before = fs.statSync(filePath).mtimeMs;

    await new Promise((resolve) => setTimeout(resolve, 20));

    const didWrite = writeGeneratedFileIfChanged(filePath, 'export const value = 1;\n');
    const after = fs.statSync(filePath).mtimeMs;

    assert.equal(didWrite, false);
    assert.equal(after, before);
  });

  it('rewrites the file when content changes', async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'manifest.generated.ts');

    assert.ok(writeGeneratedFileIfChanged(filePath, 'export const value = 1;\n'));
    const before = fs.statSync(filePath).mtimeMs;

    await new Promise((resolve) => setTimeout(resolve, 20));

    const didWrite = writeGeneratedFileIfChanged(filePath, 'export const value = 2;\n');
    const after = fs.statSync(filePath).mtimeMs;

    assert.ok(didWrite);
    assert.ok(after > before);
    assert.equal(fs.readFileSync(filePath, 'utf8'), 'export const value = 2;\n');
  });
});
