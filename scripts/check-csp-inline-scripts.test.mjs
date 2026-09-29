#!/usr/bin/env node
// AAV-1320 — build-gate tests for scripts/check-csp-inline-scripts.mjs
// Matrix rows: docs/specs/aav-1320-ga4-csp-inline-scripts.md #1–#8
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractScriptSrcTokens, extractInlineScripts, sha256Base64, checkCsp } from './lib/csp-inline-scripts.mjs';
import { runCheck } from './check-csp-inline-scripts.mjs';

// Spec row #8 anchor vector: exact bytes of the consent default-deny block in
// dist/index.html (leading whitespace included) and the hash Chrome itself
// reported via securitypolicyviolation on production build d39ad25f.
const CONSENT_BLOCK_CONTENT =
  "\n      window.dataLayer = window.dataLayer || [];\n      function gtag() {\n        dataLayer.push(arguments);\n      }\n      gtag('consent', 'default', {\n        analytics_storage: 'denied',\n        ad_storage: 'denied',\n        ad_user_data: 'denied',\n        ad_personalization: 'denied',\n      });\n    ";
const CONSENT_BLOCK_HASH = 'sha256-QS+AkrDdcmDPvM2bc7VNqnJ18T0jsS9z+0xpEs869cs=';

const REQUIRED_ORIGINS = ['https://www.googletagmanager.com', 'https://*.google-analytics.com'];

function cspWith(...tokens) {
  return `default-src 'self'; script-src 'self' 'wasm-unsafe-eval' ${tokens.join(' ')}; connect-src 'self' https: wss:;`;
}

function vercelJsonWith(csp) {
  return JSON.stringify({
    rewrites: [{ source: '/(.*)', destination: '/index.html' }],
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ],
  });
}

describe('sha256Base64', () => {
  it('matches the hash Chrome reported for the consent block (byte-exact contract, row #8)', () => {
    assert.equal(sha256Base64(CONSENT_BLOCK_CONTENT), CONSENT_BLOCK_HASH);
  });

  it('is whitespace-sensitive (leading/trailing bytes change the hash)', () => {
    assert.notEqual(sha256Base64(CONSENT_BLOCK_CONTENT.trim()), CONSENT_BLOCK_HASH);
  });
});

describe('extractScriptSrcTokens', () => {
  it('extracts the script-src directive tokens from a CSP value', () => {
    const tokens = extractScriptSrcTokens(cspWith("'self'", `'${CONSENT_BLOCK_HASH}'`, ...REQUIRED_ORIGINS));
    const tokenSet = new Set(tokens);
    assert.ok(tokenSet.has("'self'"));
    assert.ok(tokenSet.has(`'${CONSENT_BLOCK_HASH}'`)); // hash-sources are quoted in CSP
    for (const origin of REQUIRED_ORIGINS) {
      assert.ok(tokenSet.has(origin), `expected token ${origin} in ${JSON.stringify(tokens)}`);
    }
  });

  it('returns null when the CSP has no script-src directive', () => {
    assert.equal(extractScriptSrcTokens("default-src 'self'; connect-src 'self'"), null);
  });
});

describe('extractInlineScripts', () => {
  it('returns executable inline scripts (no type attribute)', () => {
    const scripts = extractInlineScripts('<html><body><script>console.log(1)</script></body></html>');
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].content, 'console.log(1)');
  });

  it('includes inline module scripts (polyfill can come back inline after a bundler upgrade, row #3)', () => {
    const scripts = extractInlineScripts('<script type="module">import "x";</script>');
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].content, 'import "x";');
  });

  it('excludes data blocks like application/ld+json (row #4)', () => {
    const scripts = extractInlineScripts(
      '<script type="application/ld+json">{"@context":"https://schema.org"}</script><script>real()</script>',
    );
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].content, 'real()');
  });

  it('excludes other non-JS data block types (importmap, speculationrules)', () => {
    const scripts = extractInlineScripts(
      '<script type="importmap">{"imports":{}}</script><script type="speculationrules">{}</script>',
    );
    assert.equal(scripts.length, 0);
  });

  it('excludes external scripts (they are covered by script-src origins, not hashes)', () => {
    const scripts = extractInlineScripts('<script type="module" crossorigin src="/assets/index-abc.js"></script>');
    assert.equal(scripts.length, 0);
  });

  it('does not mistake data-src-style attributes for an external src (silent-skip guard)', () => {
    const scripts = extractInlineScripts('<script data-src="x">inline()</script>');
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].content, 'inline()');
  });

  it('matches upper-case tags (HTML tag names are case-insensitive)', () => {
    const scripts = extractInlineScripts('<SCRIPT>upper()</SCRIPT>');
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].content, 'upper()');
  });

  it('matches end tags containing whitespace (</script > is valid HTML)', () => {
    const scripts = extractInlineScripts('<script>spaced()</script >');
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].content, 'spaced()');
  });

  it('matches end tags with attribute-like garbage (element closes at first >)', () => {
    const scripts = extractInlineScripts('<script>g()</script\t\n foo="bar">trailing');
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].content, 'g()');
  });
});

describe('checkCsp', () => {
  it('passes when every inline script hash and the GA origins are in script-src (row #1)', () => {
    const html = `<html><head><script>${CONSENT_BLOCK_CONTENT}</script></head><body></body></html>`;
    const result = checkCsp({
      cspValue: cspWith(`'${CONSENT_BLOCK_HASH}'`, ...REQUIRED_ORIGINS),
      html,
      requiredOrigins: REQUIRED_ORIGINS,
    });
    assert.deepEqual(result.violations, []);
    assert.equal(result.ok, true);
  });

  it('fails with the missing sha256 token when an inline script drifts (row #2)', () => {
    const html = `<html><head><script>${CONSENT_BLOCK_CONTENT}</script></head><body></body></html>`;
    const result = checkCsp({
      cspValue: cspWith('sha256-stalehash=', ...REQUIRED_ORIGINS),
      html,
      requiredOrigins: REQUIRED_ORIGINS,
    });
    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
    assert.match(result.violations[0], /sha256-QS\+AkrDdcmDPvM2bc7VNqnJ18T0jsS9z\+0xpEs869cs=/);
    assert.match(result.violations[0], /vercel\.json/);
  });

  it('fails when an inline module script is not covered (row #3)', () => {
    const html = '<html><head><script type="module">polyfill()</script></head></html>';
    const result = checkCsp({
      cspValue: cspWith(...REQUIRED_ORIGINS),
      html,
      requiredOrigins: REQUIRED_ORIGINS,
    });
    assert.equal(result.ok, false);
    assert.match(result.violations[0], /sha256-/);
  });

  it('does not require hashes for ld+json data blocks (row #4)', () => {
    const html =
      '<html><head><script type="application/ld+json">{"@type":"WebSite"}</script></head><body></body></html>';
    const result = checkCsp({
      cspValue: cspWith(...REQUIRED_ORIGINS),
      html,
      requiredOrigins: REQUIRED_ORIGINS,
    });
    assert.equal(result.ok, true);
  });

  it('fails when a required origin is missing from script-src (row #5)', () => {
    const html = '<html><head></head><body></body></html>';
    const result = checkCsp({
      cspValue: cspWith('https://www.googletagmanager.com'),
      html,
      requiredOrigins: REQUIRED_ORIGINS,
    });
    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
    assert.match(result.violations[0], /google-analytics\.com/);
  });
});

describe('runCheck (file-level wiring, rows #6/#7)', () => {
  function makeRepo({
    vercel = vercelJsonWith(cspWith(`'${CONSENT_BLOCK_HASH}'`, ...REQUIRED_ORIGINS)),
    html = null,
  } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'aav1320-'));
    writeFileSync(join(dir, 'vercel.json'), vercel);
    if (html !== null) writeFileSync(join(dir, 'index.html'), html);
    return { dir, vercelPath: join(dir, 'vercel.json'), htmlPath: join(dir, 'index.html') };
  }

  const validHtml = `<html><head><script>${CONSENT_BLOCK_CONTENT}</script></head><body></body></html>`;

  it('passes on a consistent vercel.json + dist/index.html pair', () => {
    const { vercelPath, htmlPath } = makeRepo({
      vercel: vercelJsonWith(cspWith(`'${CONSENT_BLOCK_HASH}'`, ...REQUIRED_ORIGINS)),
      html: validHtml,
    });
    const result = runCheck({ vercelJsonPath: vercelPath, htmlPath });
    assert.equal(result.ok, true);
  });

  it('fails loud when dist/index.html is missing (row #6)', () => {
    const { vercelPath, htmlPath } = makeRepo({ html: null });
    const result = runCheck({ vercelJsonPath: vercelPath, htmlPath });
    assert.equal(result.ok, false);
    assert.match(result.violations[0], /index\.html/);
  });

  it('fails loud when vercel.json has no CSP header (row #7)', () => {
    const { vercelPath, htmlPath } = makeRepo({
      vercel: JSON.stringify({ headers: [{ source: '/(.*)', headers: [{ key: 'X-Foo', value: 'bar' }] }] }),
      html: validHtml,
    });
    const result = runCheck({ vercelJsonPath: vercelPath, htmlPath });
    assert.equal(result.ok, false);
    assert.match(result.violations[0], /Content-Security-Policy/);
  });

  it('fails loud when vercel.json is missing entirely (row #7)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aav1320-'));
    const result = runCheck({ vercelJsonPath: join(dir, 'vercel.json'), htmlPath: join(dir, 'index.html') });
    assert.equal(result.ok, false);
    assert.match(result.violations.join('\n'), /vercel\.json|index\.html/);
  });

  it('fails loud with a friendly message when vercel.json is malformed JSON (row #7)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aav1320-'));
    writeFileSync(join(dir, 'vercel.json'), '{ not json');
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    const result = runCheck({ vercelJsonPath: join(dir, 'vercel.json'), htmlPath: join(dir, 'index.html') });
    assert.equal(result.ok, false);
    assert.match(result.violations[0], /not valid JSON/);
  });
});

describe('CLI exit-code contract (rows #6/#7)', () => {
  const cliPath = join(import.meta.dirname, 'check-csp-inline-scripts.mjs');

  it('exits 0 on a consistent fixture pair', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aav1320-'));
    writeFileSync(join(dir, 'vercel.json'), vercelJsonWith(cspWith(`'${CONSENT_BLOCK_HASH}'`, ...REQUIRED_ORIGINS)));
    writeFileSync(join(dir, 'index.html'), `<html><head><script>${CONSENT_BLOCK_CONTENT}</script></head></html>`);
    const r = spawnSync(process.execPath, [cliPath, join(dir, 'vercel.json'), join(dir, 'index.html')]);
    assert.equal(r.status, 0, r.stderr.toString());
    assert.match(r.stdout.toString(), /\[check-csp\]/);
  });

  it('exits 1 and prints actionable guidance when the artifact is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aav1320-'));
    writeFileSync(join(dir, 'vercel.json'), vercelJsonWith(cspWith(`'${CONSENT_BLOCK_HASH}'`, ...REQUIRED_ORIGINS)));
    const r = spawnSync(process.execPath, [cliPath, join(dir, 'vercel.json'), join(dir, 'missing.html')]);
    assert.equal(r.status, 1);
    assert.match(r.stderr.toString(), /\[check-csp\] CSP inline-script gate FAILED/);
    assert.match(r.stderr.toString(), /missing\.html/);
  });
});
