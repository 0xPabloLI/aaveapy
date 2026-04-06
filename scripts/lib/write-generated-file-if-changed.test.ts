import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { writeGeneratedFileIfChanged } from './write-generated-file-if-changed.mjs';

const tempDirs: string[] = [];

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

    expect(didWrite).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('export const value = 1;\n');
  });

  it('does not rewrite the file when content is unchanged', async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'manifest.generated.ts');

    expect(writeGeneratedFileIfChanged(filePath, 'export const value = 1;\n')).toBe(true);
    const before = fs.statSync(filePath).mtimeMs;

    await new Promise((resolve) => setTimeout(resolve, 20));

    const didWrite = writeGeneratedFileIfChanged(filePath, 'export const value = 1;\n');
    const after = fs.statSync(filePath).mtimeMs;

    expect(didWrite).toBe(false);
    expect(after).toBe(before);
  });

  it('rewrites the file when content changes', async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, 'manifest.generated.ts');

    expect(writeGeneratedFileIfChanged(filePath, 'export const value = 1;\n')).toBe(true);
    const before = fs.statSync(filePath).mtimeMs;

    await new Promise((resolve) => setTimeout(resolve, 20));

    const didWrite = writeGeneratedFileIfChanged(filePath, 'export const value = 2;\n');
    const after = fs.statSync(filePath).mtimeMs;

    expect(didWrite).toBe(true);
    expect(after).toBeGreaterThan(before);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('export const value = 2;\n');
  });
});
