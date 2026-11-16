#!/usr/bin/env node
/**
 * Product-view gate (AAV-1389).
 *
 * `AGENTS.md` `## Session 结束验证` has always required a "product-view"
 * conclusion (what the issue originally had to solve / what the user now sees /
 * what did not change), and that line has always been un-checkable: no content
 * shape, no script, no gate. The AAV-1335 delivery proved the consequence —
 * nine steps ticked, `ci:remote` green, dev CI green, and the product-view
 * sentence simply absent.
 *
 * Adopted from inside-china-ai (`scripts/check-product-view.mjs`), which had
 * already learned that wording was never the problem, **blocking force** was.
 * This copy is the generic half: pure text, no dependency, no GitHub-specific
 * input. Only the renderer needed a local adapter (Linear instead of `gh`).
 *
 * The check is deliberately about presence and substance, not about truth: a
 * gate that cannot tell done from not-done just moves the skipping somewhere
 * less visible. Whether the three sentences are *true* stays with the Step 9
 * product-view conclusion, which a human reads.
 *
 * Contract (env in, exit code out — same shape as the other `scripts/` gates):
 *
 *   PR_BODY            full pull-request body
 *   PR_AUTHOR          pull_request.user.login
 *   PR_AUTHOR_TYPE     pull_request.user.type ("Bot" for app actors)
 *   PR_LABELS          comma-separated label names
 *   GITHUB_EVENT_NAME  defaults to "pull_request" (local runs have no event)
 *
 * Exit 0 = pass or exempt, exit 1 = fail with the reason and the three prompts.
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Accepted heading, Chinese first because that is what the template ships. */
const SECTION_RE = /^#{1,3}[ \t]+(?:产品视角|product[\s-]?view)[ \t]*$/im;

/** A unit shorter than this is a label, not a sentence. */
const MIN_UNIT_CHARS = 8;

/** §9 step 8 asks for three sentences. */
const MIN_UNITS = 3;

/**
 * The three roles, in the order §9 step 8 asks for them. Exported because the
 * closing ledger's reminders and escalations quote them: one wording, so the
 * prompt a failed gate prints and the prompt a closed issue receives cannot
 * drift into asking for different things.
 */
export const PRODUCT_VIEW_ROLES = [
  '原本要解决什么用户可见问题',
  '用户现在看到什么变化',
  '哪些行为或边界没有变（无用户可见变化时写明原因）',
];

/**
 * A template bullet left as `- 原本要解决的用户可见问题：` ends in a colon with
 * nothing after it. Without this rule, submitting the template verbatim would
 * satisfy the gate and the gate would be decorative.
 */
const PLACEHOLDER_TAIL_RE = /[：:]\s*$/;

/**
 * Stop patterns for `extractSection`, one per heading level the section heading
 * can have. Hardcoded rather than built from the matched level: a `RegExp`
 * assembled from a string trips `detect-non-literal-regexp` (Semgrep flags it as
 * a ReDoS surface), and the level is only ever 1-3 because SECTION_RE caps it.
 */
const SECTION_STOP = [
  null, // levels are 1-based
  /^#[ \t]/m, // this section is `#`, stop at the next `#`
  /^#{1,2}[ \t]/m, // `##`, stop at `#` or `##`
  /^#{1,3}[ \t]/m, // `###`, stop at `#`, `##` or `###`
];

/**
 * Template guidance lives in HTML comments. They are instructions to the author,
 * so they must not count as content when someone submits the template untouched.
 * @param {string} text
 * @returns {string}
 */
function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Pull one markdown section: the matched heading down to the next heading of the
 * same or a higher level (a deeper heading belongs to this section).
 * @param {string} body - full pull-request body
 * @returns {string|null} section body without the heading, or null when absent
 */
export function extractSection(body) {
  const text = stripHtmlComments(String(body ?? '')).replace(/\r\n/g, '\n');
  const match = SECTION_RE.exec(text);
  if (!match) return null;
  const level = match[0].match(/^#+/)[0].length;
  const rest = text.slice(match.index + match[0].length);
  const stop = SECTION_STOP[level].exec(rest);
  return (stop ? rest.slice(0, stop.index) : rest).trim();
}

/**
 * Content lines of a section: markdown decoration removed, short scraps and
 * unfilled template bullets dropped. The length floor also removes the bare
 * placeholder words ("todo", "n/a", "..."), which are all shorter than it.
 * @param {string} section
 * @returns {string[]}
 */
export function substantiveLines(section) {
  return String(section ?? '')
    .split('\n')
    .map((line) =>
      line
        .replace(/^[\s>]*/, '')
        .replace(/^(?:[-*+]|\d+[.)])[ \t]+/, '')
        .replace(/^\[[ xX]\][ \t]*/, '')
        .trim(),
    )
    .filter((line) => line.length >= MIN_UNIT_CHARS)
    .filter((line) => !PLACEHOLDER_TAIL_RE.test(line));
}

/**
 * Sentences in a block of text. Chinese and Latin terminators both count, so a
 * three-sentence paragraph passes just like a three-bullet list.
 * @param {string} text
 * @returns {number}
 */
export function countSentences(text) {
  return String(text ?? '')
    .split(/[。！？]+|[.!?](?=\s|$)/)
    .map((part) => part.trim())
    .filter((part) => part.length >= MIN_UNIT_CHARS).length;
}

/**
 * Substantive units in a section: the larger of its content lines and its
 * sentences, so either writing shape satisfies §9 step 8.
 * @param {string} section
 * @returns {number}
 */
export function countUnits(section) {
  const lines = substantiveLines(section);
  return Math.max(lines.length, countSentences(lines.join(' ')));
}

/**
 * Decide whether a pull request satisfies the product-view gate.
 *
 * @param {object} [input]
 * @param {string} [input.body] - pull-request body
 * @param {string} [input.author] - pull_request.user.login
 * @param {string} [input.authorType] - pull_request.user.type ("Bot" for app actors)
 * @param {string|string[]} [input.labels] - label names (comma-joined or array)
 * @param {string} [input.eventName] - GITHUB_EVENT_NAME
 * @returns {{ok: boolean, skipped: boolean, reason: string, units?: number}}
 */
export function evaluateProductView(input = {}) {
  const eventName = String(input.eventName ?? 'pull_request');
  const author = String(input.author ?? '');
  const authorType = String(input.authorType ?? '');
  const labels = Array.isArray(input.labels) ? input.labels : String(input.labels ?? '').split(',');

  // Exemptions each exist for a reason, not for convenience: a skipped run
  // states which rule skipped it, so an exemption can never masquerade as a pass
  // an author earned. Every exemption has to rest on something the PR author
  // cannot choose — see the note on branch names below.
  if (eventName !== 'pull_request') {
    return {
      ok: true,
      skipped: true,
      reason: `event "${eventName}" carries no pull-request body`,
    };
  }
  if (author.endsWith('[bot]')) {
    return { ok: true, skipped: true, reason: `author ${author} is a bot` };
  }
  // App actors do not reliably carry the `[bot]` login suffix: the same Renovate
  // PR is `renovate[bot]` in the event payload and `app/renovate` in `gh pr list`.
  // The account type is the durable signal, and it is GitHub's fact, not the
  // author's choice.
  if (authorType === 'Bot') {
    return { ok: true, skipped: true, reason: `author ${author} is a bot` };
  }
  // Deliberately no branch-name exemption. `pull_request.head.ref` is chosen by
  // the PR author, including on forks, so `release-please--*` would let anyone
  // opt out by naming a branch. release-please PRs are opened by a bot account
  // and are already covered by the author rule; `skip-product-view` is a label,
  // which only someone with write access can apply.
  const cleaned = labels.map((label) => label.trim()).filter(Boolean);
  if (cleaned.includes('skip-product-view')) {
    return {
      ok: true,
      skipped: true,
      reason: 'label skip-product-view',
    };
  }

  const body = String(input.body ?? '');
  if (!body.trim()) {
    return { ok: false, skipped: false, reason: 'the pull-request body is empty' };
  }

  const section = extractSection(body);
  if (section === null) {
    return {
      ok: false,
      skipped: false,
      reason: 'no product-view section (expected a `## 产品视角` or `## Product view` heading)',
    };
  }

  const units = countUnits(section);
  if (units < MIN_UNITS) {
    return {
      ok: false,
      skipped: false,
      units,
      reason: `the product-view section holds ${units} substantive unit(s), needs ${MIN_UNITS}`,
    };
  }
  return { ok: true, skipped: false, units, reason: `${units} substantive units` };
}

/**
 * The same three sentences, judged on a closing comment.
 *
 * A PR body is written before delivery, for a reviewer; the closing comment is
 * written after, for whoever reads the ticket later. #353 shipped the first and
 * skipped the second: the record carried a squash sha, a change list and test
 * evidence, the `交付记录` marker cleared `delivery-record-missing`, and the
 * ledger read as a complete delivery with no sentence about users. The marker
 * only proves a comment exists, so the content check has to sit beside it.
 *
 * There is no author or label exemption here on purpose. The PR gate exempts bot
 * authors and `skip-product-view`; both are choices an author could reach for to
 * opt out of the very surface this checks.
 *
 * @param {string} body - one comment body
 * @returns {{ok: boolean, units: number, reason: string}}
 */
export function evaluateCommentProductView(body) {
  const text = String(body ?? '');
  if (!text.trim()) return { ok: false, units: 0, reason: 'the comment body is empty' };
  const section = extractSection(text);
  if (section === null) {
    return {
      ok: false,
      units: 0,
      reason: 'no product-view section (expected a `## 产品视角` or `## Product view` heading)',
    };
  }
  const units = countUnits(section);
  if (units < MIN_UNITS) {
    return {
      ok: false,
      units,
      reason: `the product-view section holds ${units} substantive unit(s), needs ${MIN_UNITS}`,
    };
  }
  return { ok: true, units, reason: `${units} substantive units` };
}

const PROMPTS = PRODUCT_VIEW_ROLES;

/**
 * @param {{ok: boolean, skipped?: boolean, reason: string}} result
 */
function report(result) {
  const tag = result.skipped ? 'SKIP' : result.ok ? 'PASS' : 'FAIL';
  console.log(`[product-view] ${tag}: ${result.reason}`);
  if (result.ok) return;
  console.log('[product-view] add this to the pull-request body, three lines of substance:');
  for (const prompt of PROMPTS) console.log(`[product-view]   - ${prompt}：<这里是内容>`);
  console.log('[product-view] no user-visible change? say so in the third line instead of leaving it short,');
  console.log('[product-view] or label the PR `skip-product-view` when the change has no user surface.');
}

// `import.meta.url` is realpath-resolved while `argv[1]` keeps the link it was
// typed as, so the two must both be resolved before comparing: a raw `===` reads
// a symlinked path (macOS `/tmp`, `/var`, a linked worktree) as an import and
// exits 0 having done nothing.
const invokedDirectly = Boolean(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  // One CLI, for the PR body: that is the only surface a shell can supply. The
  // delivery-record comment is judged through `evaluateCommentProductView`,
  // imported by `scripts/product-view-section.mjs` — a `--comment` flag here
  // would be a second entry point nothing calls.
  const result = evaluateProductView({
    eventName: process.env.GITHUB_EVENT_NAME ?? 'pull_request',
    body: process.env.PR_BODY ?? '',
    author: process.env.PR_AUTHOR ?? '',
    authorType: process.env.PR_AUTHOR_TYPE ?? '',
    labels: process.env.PR_LABELS ?? '',
  });
  report(result);
  process.exit(result.ok ? 0 : 1);
}
