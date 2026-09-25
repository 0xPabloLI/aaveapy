#!/usr/bin/env node
// Post-processor for openapi-zod-client output.
//
// Raw codegen emits two patterns that fail tsc under zod ^4 + strict TS
// (AAV-1298: the openapi-sync bot overwrites the hand-stabilized
// src/generated/api/schemas.ts on every run, then husky typecheck blocks it):
//
//   1. Recursive schemas (spec has 1 self-ref: MarketsResponse). Raw output:
//        type X = X;
//        const X: z.ZodType<X> = z.lazy(() => X);   // TS2456 circular alias
//      Patched form matches the checked-in stabilized file:
//        const X: z.ZodTypeAny = z.lazy(() => X);
//
//   2. additionalProperties → single-arg z.record(...). zod v4 requires a
//      key argument (TS2554 "Expected 2-3 arguments, but got 1"). OpenAPI
//      object keys are always strings → inject `z.string(), `.
//
// Unknown patterns are left untouched — pre-commit typecheck stays the gate
// (fail-closed). When openapi-zod-client is fixed/upgraded, both transforms
// become no-ops and this script can be retired.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_TARGET = path.join(REPO_ROOT, 'src/generated/api/schemas.ts');

// `type X = X;` + `const X: z.ZodType<X> = z.lazy(() => X);` — line-anchored
// so a matching text inside a string literal never fires.
const RECURSIVE_ALIAS =
  /^[ \t]*type (\w+) = \1;[ \t]*\n(?:[ \t]*\n)?[ \t]*const \1: z\.ZodType<\1> = z\.lazy\(\(\) => \1\);[ \t]*$/gm;

export function patchGeneratedSchemas(source) {
  const changes = [];
  let code = source.replace(RECURSIVE_ALIAS, (_match, name) => {
    changes.push(`recursive alias → z.ZodTypeAny: ${name}`);
    return `const ${name}: z.ZodTypeAny = z.lazy(() => ${name});`;
  });
  code = fixSingleArgZRecord(code, changes);
  return { code, changed: code !== source, changes };
}

// Index of the char that closes the paren opened right before `start`,
// tracking nesting and string literals. -1 when unbalanced.
function findCloseParen(code, start) {
  let depth = 1;
  let quote = null;
  for (let i = start; i < code.length; i++) {
    const ch = code[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Indices of every needle occurrence outside string literals.
function* findOutsideStrings(code, needle) {
  let quote = null;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (code.startsWith(needle, i)) {
      yield i;
      i += needle.length - 1;
    }
  }
}

// Number of arguments of the call spanning [start, close), where start is the
// first char after the opening paren. Counts top-level separators; a trailing
// comma does not add an argument (`f(a,)` is one argument).
function countTopLevelArgs(code, start, close) {
  let depth = 1;
  let quote = null;
  let commas = 0;
  let lastMeaningful = '';
  for (let i = start; i < close; i++) {
    const ch = code[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      lastMeaningful = ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      lastMeaningful = ch;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      lastMeaningful = ch;
    } else if (ch === ',' && depth === 1) {
      commas++;
      lastMeaningful = ch;
    } else if (!/\s/.test(ch)) {
      lastMeaningful = ch;
    }
  }
  return lastMeaningful === ',' ? commas : commas + 1;
}

function fixSingleArgZRecord(code, changes) {
  const NEEDLE = 'z.record(';
  let out = '';
  let copied = 0;
  for (const at of findOutsideStrings(code, NEEDLE)) {
    const argStart = at + NEEDLE.length;
    const close = findCloseParen(code, argStart);
    if (close === -1) continue; // unbalanced spot — skip it, keep scanning
    if (countTopLevelArgs(code, argStart, close) === 1) {
      out += code.slice(copied, argStart) + 'z.string(), ';
      copied = argStart;
      changes.push(`z.record key arg injected @${at}`);
    }
    // keep scanning inside args (nested records)
  }
  return out + code.slice(copied);
}

export function patchSchemaFile(filePath = DEFAULT_TARGET) {
  const original = readFileSync(filePath, 'utf8');
  const { code, changed, changes } = patchGeneratedSchemas(original);
  if (changed) writeFileSync(filePath, code);
  return { changed, changes };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const { changed, changes } = patchSchemaFile(process.argv[2]);
  if (changed) {
    console.log(`patch-generated-schemas: ${changes.length} fix(es):`);
    for (const change of changes) console.log(`  - ${change}`);
  } else {
    console.log('patch-generated-schemas: no changes needed');
  }
}
