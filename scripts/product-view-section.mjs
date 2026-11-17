#!/usr/bin/env node
/**
 * Render the `## 产品视角` section the final report opens with (AAV-1389).
 *
 * Adopted from inside-china-ai `scripts/product-view-section.mjs`, with one
 * change: this repo tracks work in Linear, so the delivery record is a Linear
 * comment rather than a GitHub issue comment. Everything else — the marker, the
 * three-sentence gate on the quoted section, the source marker that travels with
 * a paste, the exit codes — is their contract unchanged.
 *
 * Why a renderer at all: §9 step 8 asks the same three sentences on two gated
 * surfaces (PR body, delivery record). The final report is chat text, so CI has
 * no input to judge it. Policing a third surface would only move the skipping
 * somewhere less visible; instead the report quotes a section that already
 * passed the gate, so it cannot say something different from what the ticket
 * says — it is not saying anything of its own.
 *
 * Quoting is not vouching: the gate checks shape, not truth, so the quoted text
 * stays untrusted. The source marker names where it came from, so a paste never
 * reads as the agent's own claim.
 *
 * What it is not: a gate. It renders, and it refuses to print a section the gate
 * would reject. An agent that forgets to run it produces a report missing the
 * whole section — visible to the reader — rather than a plausible one written
 * from memory.
 *
 * Contract:
 *
 *   node scripts/product-view-section.mjs AAV-1234
 *     stdout: source marker, `## 产品视角`, and the section body, to paste verbatim
 *     stderr: provenance (`source=comment:<id>`) or the reason it rendered nothing
 *     exit 0 = rendered, 1 = nothing compliant to quote, 2 = bad usage
 *
 * Credentials: `LINEAR_API_KEY` from the environment, else the local MCP config
 * at `.codeartsdoer/mcp/mcp_settings.json` (untracked; this is a local
 * close-out tool, not a CI job — CI cannot reach the ticket anyway).
 */
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateCommentProductView, extractSection } from './check-product-view.mjs';

/** The heading the report opens with; the gate accepts the English spelling too. */
const HEADING = '## 产品视角';

/** What a closing comment must open with to count as a delivery record. */
const RECORD_MARKER = /^(?:交付记录|Delivery record)/m;

const API_URL = 'https://api.linear.app/graphql';

const QUERY = `query ProductViewIssue($identifier: String!) {
  issue(id: $identifier) {
    identifier
    comments(first: 100) {
      nodes { id body createdAt }
    }
  }
}`;

/** How to fix the failure, quoted in every message so it needs no doc lookup. */
const FIX = 'post the delivery record (marker `交付记录` plus a `## 产品视角` section) and render again';

function defaultConfigPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.codeartsdoer/mcp/mcp_settings.json');
}

/**
 * @param {{env?: Record<string, string|undefined>, configPath?: string}} [options]
 * @returns {string|null}
 */
export function resolveApiKey({ env = process.env, configPath = defaultConfigPath() } = {}) {
  if (env.LINEAR_API_KEY) return env.LINEAR_API_KEY;
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    return config?.mcpServers?.linear?.env?.LINEAR_API_KEY ?? null;
  } catch {
    return null;
  }
}

/**
 * Load the issue and its comments from Linear. Kept separate from the selection
 * logic so tests can inject a loader instead of reaching the network.
 *
 * @param {string} identifier - `AAV-1234`
 * @param {{apiKey?: string|null, fetchImpl?: typeof fetch}} [options]
 * @returns {Promise<{identifier: string, comments: Array<{id: string, body: string, createdAt: string}>}>}
 */
export async function loadLinearIssue(identifier, { apiKey = resolveApiKey(), fetchImpl = fetch } = {}) {
  if (!apiKey) {
    throw new Error('no Linear API key — set LINEAR_API_KEY or provide .codeartsdoer/mcp/mcp_settings.json');
  }
  const response = await fetchImpl(API_URL, {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { identifier } }),
  });
  if (!response.ok) throw new Error(`Linear returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((entry) => entry.message).join('; '));
  }
  const issue = payload.data?.issue;
  if (!issue) throw new Error(`Linear has no issue ${identifier}`);
  return { identifier: issue.identifier ?? identifier, comments: issue.comments?.nodes ?? [] };
}

/**
 * The text the report pastes: the section, preceded by a marker naming where it
 * came from. The marker is an HTML comment, which `stripHtmlComments` removes, so
 * it never changes how the gate counts the section it wraps.
 *
 * @param {string} body
 * @param {string} provenance - `comment:<id>`
 * @returns {string}
 */
function render(body, provenance) {
  return `<!-- product-view: source=${provenance} (quoted from the ticket) -->\n${HEADING}\n\n${extractSection(body)}\n`;
}

/**
 * @typedef {{ok: true, text: string, source: {kind: 'comment', id: string}} |
 *   {ok: false, reason: string}} SectionResult
 */

/**
 * @param {object} options
 * @param {string} options.identifier - Linear issue identifier (`AAV-1234`)
 * @param {(identifier: string) => Promise<{identifier: string, comments: Array<{id: string, body: string, createdAt: string}>}>} [options.loadIssue]
 * @returns {Promise<SectionResult>}
 */
export async function renderProductViewSection({ identifier, loadIssue = loadLinearIssue } = {}) {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(String(identifier ?? ''))) {
    throw new Error('expected a Linear issue identifier such as AAV-1234');
  }

  const issue = await loadIssue(identifier);

  // Newest first: a ticket accumulates records across sessions, and the section
  // the report must quote is the one the latest delivery earned. Records only —
  // a comment without the marker is not a delivery record, however it is shaped.
  const records = [...issue.comments]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .filter((comment) => RECORD_MARKER.test(comment.body ?? ''));

  const rejections = [];
  for (const comment of records) {
    const verdict = evaluateCommentProductView(comment.body ?? '');
    if (!verdict.ok) {
      rejections.push(`${comment.id}: ${verdict.reason}`);
      continue;
    }
    return {
      ok: true,
      text: render(comment.body, `comment:${comment.id}`),
      source: { kind: 'comment', id: comment.id },
    };
  }

  const inspected =
    records.length === 0
      ? 'no comment carries the `交付记录` marker'
      : `${records.length} record comment(s), none compliant — ${[...new Set(rejections)].join('; ')}`;
  return {
    ok: false,
    reason: `no compliant \`## 产品视角\` section on ${identifier}: ${inspected} — ${FIX}`,
  };
}

/**
 * Parse argv: exactly one Linear identifier, no flags.
 *
 * @param {string[]} argv
 * @returns {string}
 */
export function parseArgs(argv) {
  for (const arg of argv) {
    if (arg.startsWith('-')) throw new Error(`unknown flag ${arg}`);
  }
  if (argv.length !== 1) throw new Error(`expected exactly one issue identifier, got ${argv.length}`);
  const identifier = argv[0];
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(identifier)) {
    throw new Error(`expected a Linear issue identifier such as AAV-1234, got ${identifier}`);
  }
  return identifier;
}

// `import.meta.url` is realpath-resolved while `argv[1]` keeps the link it was
// typed as, so both must be resolved before comparing: a raw `===` reads a
// symlinked path (macOS `/tmp`, a linked worktree) as an import and exits 0
// having printed nothing.
const invokedDirectly = Boolean(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const USAGE = 'usage: node scripts/product-view-section.mjs <AAV-1234>';
  let identifier;
  try {
    identifier = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    process.exit(2);
  }

  let result;
  try {
    result = await renderProductViewSection({ identifier });
  } catch (error) {
    // Linear unreachable, key missing, issue not found — never a reason to print
    // a partial section.
    console.error(`[product-view] could not read ${identifier}: ${error.message}`);
    process.exit(1);
  }

  if (!result.ok) {
    console.error(`[product-view] ${result.reason}`);
    process.exit(1);
  }

  // Provenance goes to stderr so the stdout pasted into the report stays pure
  // markdown — a reader of the chat sees the ticket's words, not a tool banner.
  process.stderr.write(`[product-view] source=${result.source.id}\n`);
  process.stdout.write(result.text);
}
