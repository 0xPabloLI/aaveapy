/**
 * Pure logic for the CSP inline-script build gate (AAV-1320).
 *
 * Contract: Chrome hashes an inline script's raw text content (the bytes
 * between the open tag's `>` and `</script>`) as UTF-8, no whitespace
 * normalization. The hash must therefore be computed over the exact same
 * bytes — anchored by a known vector in check-csp-inline-scripts.test.mjs
 * (hash reported by Chrome via securitypolicyviolation on build d39ad25f).
 *
 * Executable inline scripts = no `src` attribute AND a missing/executable
 * `type` (`module` or a JavaScript MIME). Anything else (`application/ld+json`,
 * `importmap`, `speculationrules`, …) is a data block and is not governed by
 * `script-src`.
 */

import { createHash } from 'node:crypto';

const EXECUTABLE_TYPES = new Set(['module', 'text/javascript', 'application/javascript']);

// `i` flag: HTML tag names are case-insensitive (`<SCRIPT>` is valid), and a
// case-sensitive match would silently skip an inline script — leaving it
// unhashed while the gate still reported success.
// End tag `</script[^>]*>`: browsers close the element at the first `>` after
// `</script`, so whitespace or attribute-like garbage (`</script foo>`) must
// be consumed — a narrower pattern truncates the captured content and hashes
// the wrong bytes (CodeQL js/bad-tag-filter flagged exactly those variants).
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script[^>]*>/gi;
// `\s` prefix so `data-src=` / `form-src=` don't read as external-src markers
// (a false external match would silently skip an executable inline script).
const HAS_SRC_RE = /(?:^|\s)src\s*=/i;

export function sha256Base64(content) {
  return `sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}`;
}

export function extractScriptSrcTokens(cspValue) {
  const directives = cspValue
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean);
  for (const directive of directives) {
    const [name, ...tokens] = directive.split(/\s+/);
    if (name.toLowerCase() === 'script-src') return tokens;
  }
  return null;
}

export function extractInlineScripts(html) {
  const scripts = [];
  for (const match of html.matchAll(SCRIPT_RE)) {
    const attrs = match[1];
    const content = match[2];
    if (HAS_SRC_RE.test(attrs)) continue;
    const typeMatch = attrs.match(/\btype\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const type = (typeMatch ? (typeMatch[2] ?? typeMatch[3] ?? typeMatch[4] ?? '') : '').trim().toLowerCase();
    if (type !== '' && !EXECUTABLE_TYPES.has(type)) continue; // data block
    scripts.push({ content, type });
  }
  return scripts;
}

/**
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function checkCsp({ cspValue, html, requiredOrigins }) {
  const violations = [];
  const tokens = extractScriptSrcTokens(cspValue);
  if (tokens === null) {
    return {
      ok: false,
      violations: [
        'Content-Security-Policy header has no script-src directive — cannot verify inline script coverage.',
      ],
    };
  }
  const tokenSet = new Set(tokens);

  const inlineScripts = extractInlineScripts(html);
  for (let i = 0; i < inlineScripts.length; i++) {
    const hash = sha256Base64(inlineScripts[i].content);
    // CSP hash-sources are quoted: 'sha256-…' (quotes are part of the token).
    if (!tokenSet.has(`'${hash}'`)) {
      violations.push(
        `Inline script #${i + 1} (${inlineScripts[i].type || 'classic'}) is not allowed by script-src. ` +
          `Add '${hash}' to the script-src directive in vercel.json.`,
      );
    }
  }

  for (const origin of requiredOrigins) {
    if (!tokenSet.has(origin)) {
      violations.push(`Required script origin '${origin}' is missing from script-src in vercel.json.`);
    }
  }

  return { ok: violations.length === 0, violations };
}
