/**
 * Workflow ↔ Playwright spec-file contracts (AAV-1334).
 *
 * Context: the `generate-snapshots` job kept referencing two visual specs after
 * `7c48ae01` deleted them. Because the job was `workflow_dispatch`-only, push/PR
 * CI skipped it and stayed green while every manual dispatch failed with
 * "No tests found". These pure helpers let `npm test` check the reference set.
 *
 * Deliberately no YAML parser: `js-yaml` is only a transitive dependency, and the
 * commands we care about are single lines (or `\` continuations) under `run:`.
 */

const PLAYWRIGHT_TEST_LINE =
  /^\s*(?:-\s*)?(?:run:\s*)?(?:(?:npx|npm|pnpx|yarn|pnpm|bunx?)\s+(?:(?:exec|dlx)\s+)?)?playwright\s+test\b/;
const SPEC_FILE = /\.(?:spec|test)\.tsx?$/;
const UPDATE_SNAPSHOTS_FLAG = /(?:^|\s)(?:--update-snapshots(?:=\S+)?|-u)(?=\s|$)/;

/**
 * Playwright options whose value is the next argv token. Without this, a filter
 * value like `--grep "e2e/deleted.spec.ts"` would masquerade as a file reference.
 */
const VALUE_FLAGS = new Set([
  '--grep',
  '-g',
  '--grep-invert',
  '-G',
  '--project',
  '--config',
  '-c',
  '--shard',
  '--reporter',
  '--workers',
  '-j',
  '--timeout',
  '--retries',
  '--max-failures',
  '--output',
  '--trace',
  '--video',
  '--screenshot',
  '--test-list',
]);

function joinContinuations(lines, startIndex) {
  let command = lines[startIndex].trim();
  let index = startIndex;
  while (/\\\s*$/.test(command) && index + 1 < lines.length) {
    command = `${command.replace(/\\\s*$/, ' ')} ${lines[(index += 1)].trim()}`;
  }
  return { command, endIndex: index };
}

function stripQuotes(token) {
  return token.replace(/[;\\]+$/, '').replace(/^['"]+|['"]+$/g, '');
}

/**
 * Every `playwright test` invocation in a workflow source, including common
 * package-manager prefixes (`npx`, `yarn`, `pnpm exec`, …). `playwright install`
 * and comment lines are not commands.
 *
 * @param {string} source
 * @returns {{ line: number, command: string }[]}
 */
export function extractPlaywrightTestCommands(source) {
  const lines = String(source).replace(/\r\n/g, '\n').split('\n');
  const commands = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*#/.test(line) || !PLAYWRIGHT_TEST_LINE.test(line)) continue;
    const { command, endIndex } = joinContinuations(lines, index);
    commands.push({ line: index + 1, command });
    index = endIndex;
  }
  return commands;
}

/**
 * Explicit spec-file arguments in a Playwright command, in argument order.
 * Whole-suite invocations (`--project`, `--shard`, …) return an empty list.
 *
 * @param {string} command
 * @returns {string[]}
 */
export function extractSpecPaths(command) {
  const tokens = String(command)
    .split(/\s+/)
    .map(stripQuotes)
    .filter((token) => token.length > 0);
  const specPaths = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith('-')) {
      if (VALUE_FLAGS.has(token)) index += 1;
      continue;
    }
    if (SPEC_FILE.test(token)) specPaths.push(token.replace(/^\.\//, ''));
  }
  return specPaths;
}

function forEachCommand(workflows, visit) {
  for (const [workflow, source] of Object.entries(workflows)) {
    for (const { command } of extractPlaywrightTestCommands(source)) visit(workflow, command);
  }
}

/**
 * @param {Record<string, string>} workflows
 * @param {(specPath: string) => boolean} exists
 * @returns {{ workflow: string, command: string, path: string }[]}
 */
export function findMissingWorkflowSpecPaths(workflows, exists) {
  const violations = [];
  forEachCommand(workflows, (workflow, command) => {
    for (const specPath of extractSpecPaths(command)) {
      // Globs cannot prove a file was deleted; they are out of this guard.
      if (/[*?[\]]/.test(specPath)) continue;
      if (!exists(specPath)) violations.push({ workflow, command, path: specPath });
    }
  });
  return violations;
}

/**
 * Commands that write pixel baselines. The e2e boundary doc retires that route,
 * so a workflow asking for it is drift, not a test run.
 *
 * @param {Record<string, string>} workflows
 * @returns {{ workflow: string, command: string }[]}
 */
export function findSnapshotUpdateCommands(workflows) {
  const violations = [];
  forEachCommand(workflows, (workflow, command) => {
    if (UPDATE_SNAPSHOTS_FLAG.test(command)) violations.push({ workflow, command });
  });
  return violations;
}
