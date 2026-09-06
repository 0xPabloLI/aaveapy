import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';

const SRC_DIR = resolve(__dirname, '..');
const CJK_REGEX = /[\u4e00-\u9fff]/;
const JSX_TEXT_RE = />\s*([^<{]*[\u4e00-\u9fff][^<{]*)\s*</;
const STRING_LITERAL_RE = /['"`]([^'"`]*[\u4e00-\u9fff][^'"`]*)['"`]/g;

const EXCLUDE_DIRS = new Set(['test', '__tests__']);
const EXCLUDE_SUFFIXES = ['.test.ts', '.test.tsx', '.stories.tsx', '.d.ts'];
// Localized landing pages whose CJK content is intentional (target-market copy).
const EXCLUDE_FILES = new Set(['./pages/AaveApyZH.tsx', './pages/AaveApyJA.tsx']);

function globSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(resolve(SRC_DIR, dir))) {
    const full = resolve(SRC_DIR, dir, entry);
    const rel = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry)) results.push(...globSourceFiles(rel));
    } else if (
      (extname(entry) === '.ts' || extname(entry) === '.tsx') &&
      !EXCLUDE_SUFFIXES.some((s) => entry.endsWith(s)) &&
      !EXCLUDE_FILES.has(rel)
    ) {
      results.push(rel);
    }
  }
  return results;
}

const ALL_FILES = globSourceFiles('.');

interface ChineseHit {
  file: string;
  line: number;
  text: string;
}

function findVisibleChinese(content: string, filePath: string): ChineseHit[] {
  const hits: ChineseHit[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*') || line.trimStart().startsWith('/*')) {
      continue;
    }

    const jsxMatch = line.match(JSX_TEXT_RE);
    if (jsxMatch && CJK_REGEX.test(jsxMatch[1])) {
      hits.push({ file: filePath, line: lineNum, text: jsxMatch[1].trim() });
      continue;
    }

    let strMatch: RegExpExecArray | null;
    STRING_LITERAL_RE.lastIndex = 0;
    while ((strMatch = STRING_LITERAL_RE.exec(line)) !== null) {
      if (CJK_REGEX.test(strMatch[1])) {
        const prev = lines[i - 1]?.trim() ?? '';
        const isComment = prev.startsWith('//') || prev.startsWith('*');
        if (!isComment) {
          hits.push({ file: filePath, line: lineNum, text: strMatch[1].trim() });
        }
      }
    }
  }

  return hits;
}

const allHits: ChineseHit[] = [];
for (const rel of ALL_FILES) {
  const content = readFileSync(resolve(SRC_DIR, rel), 'utf8');
  allHits.push(...findVisibleChinese(content, rel));
}

describe('no-chinese-visible', () => {
  it('should have no user-visible Chinese characters in frontend source', () => {
    if (allHits.length > 0) {
      const details = allHits
        .map((h) => `  ${h.file}:${h.line} → "${h.text}"`)
        .join('\n');
      expect.fail(
        `Found user-visible Chinese in frontend source:\n${details}\n\nReplace with English or add to exclusion list.`,
      );
    }
    expect(allHits).toHaveLength(0);
  });
});
