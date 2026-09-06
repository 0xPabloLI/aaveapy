# Vercel deployment smoke test and rollback

Canonical workflow: [`.github/workflows/deployment-smoke-test.yml`](../../.github/workflows/deployment-smoke-test.yml).

## Triggers and environments

- Runs on **push** to `main`, `dev`, and `lovable`.
- **Production** (`main`): `SITE_URL` is the public site; Vercel target is `production`.
- **Staging** (`dev`): `SITE_URL` is `https://staging.aaveapy.com`; Vercel target is `preview`.
- **Preview** (`lovable`): No custom domain (`SITE_URL` is empty); Vercel target is `preview`. The `site_check` step is skipped; verification relies on `deploy_url_check` (Vercel preview URL) and `api_check` (staging API).

> **Note:** `lovable` has no bound custom domain in Vercel. Running the full `site_check` with custom-domain SHA verification would always fail, so it is skipped. The deployment URL check confirms the correct SHA is served on the preview URL.

## Secrets

Configure in the GitHub repository:

| Secret | Purpose |
| --- | --- |
| `VERCEL_TOKEN` | API token (smoke polling + rollback) |
| `VERCEL_PROJECT_ID` | Project ID |
| `VERCEL_TEAM_ID` | Optional; team scope for the token |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Bypass Vercel Authentication for CI curl requests (site_check + deploy_url_check) |

If `VERCEL_TOKEN` is missing, the smoke test and rollback steps **skip** (exit 0) with a log message.

If `VERCEL_AUTOMATION_BYPASS_SECRET` is missing, curl requests to Vercel-served URLs will receive the Vercel Authentication login page instead of the SPA, causing `site_check` and `deploy_url_check` failures. The workflow logs a warning but does not hard-fail on missing secret — the curl failure itself is the signal. See ADR-0029 for the full rationale.

### How the bypass works

Both `site_check` and `deploy_url_check` steps build curl args as a bash array, conditionally appending the bypass header:
```bash
CURL_ARGS=(-s -o /tmp/page.html -w "%{http_code}" --max-time 30 -L "$SITE_URL")
if [ -n "$VERCEL_BYPASS_SECRET" ]; then
  CURL_ARGS+=(-H "x-vercel-protection-bypass:$VERCEL_BYPASS_SECRET")
fi
curl "${CURL_ARGS[@]}"
```
Vercel recognises the `x-vercel-protection-bypass` header and skips the Authentication interstitial, returning the actual SPA HTML. Setup steps: `docs/setup-vercel-auth-bypass.md`.

> **Why array, not `$BYPASS_HEADER`?** When the secret is empty, the old `-L $BYPASS_HEADER "$URL"` pattern expands to `-L "" "$URL"`, and the empty string is silently dropped — but in some shell contexts it can cause `-s` to be interpreted as a flag, producing `command not found` errors. The array approach is robust regardless of secret state.

## Deploy SHA verification

Production builds inject a short-lived proof of which commit is live:

- Vite plugin in `vite.config.ts` adds `<meta name="aaveapy-deploy-sha" content="…">` to `index.html`, using `VERCEL_GIT_COMMIT_SHA` (or `GITHUB_SHA` / `CF_PAGES_COMMIT_SHA` when set).
- **`main`**: `site_check` requires production URL to serve `github.sha` immediately.
- **Staging branches (`dev`)**: `deploy_url_check` requires the Vercel deployment URL for this commit to serve `github.sha`. `site_check` on the custom domain **polls up to 5 minutes** when the alias lags behind a READY preview deployment.
- **Preview branches (`lovable`)**: `site_check` is **skipped** (no custom domain). `deploy_url_check` on the Vercel preview URL is the primary SHA verification.
- **`api_check`** calls `/api/markets` for diagnostics only; HTTP failures are warnings and do **not** fail the job. `lovable` uses the staging API.

## Failure notifications (GitHub Issues)

On smoke-test failure, the rollback job opens or updates a GitHub issue:

- Label: `smoke-test-failure`
- Title: `🚨 {production|staging} smoke test failed — deployment rolled back`
- **Dedup**: if an open issue with the same title exists, a new **comment** is appended (`## Repeat Trigger — {sha}`) instead of creating another issue.

Linear tickets with the same title are created separately (e.g. via integration); dedup on GitHub does not close Linear duplicates.

## Auto-rollback

- Runs only when the **smoke-test** job fails (`rollback` job, `if: failure()`).
- **Instant project rollback** (Vercel REST rollback) runs **only on `main`**. Preview/staging branches skip project rollback; the workflow logs a **manual recovery playbook** (promote last good preview / revert commit) and marks rollback as skipped in the issue.
- Rollback picks the **previous READY** deployment on the **same Git ref** as the failing push, excluding the current commit SHA.

### Git ref matching (important for maintainers)

GitHub exposes `github.ref_name` as a **short** branch name (e.g. `main`). Vercel deployment metadata often stores `meta.githubCommitRef` as a **full** ref (e.g. `refs/heads/main`). The workflow **normalizes** both sides in `jq` (strip a leading `refs/heads/` before comparing) so candidate selection does not silently find zero matches.

When editing rollback logic, **do not** compare these fields as raw strings without normalization.

## Auto-close on success

When smoke test passes, the `Auto-close stale smoke-test-failure issues on success` step automatically finds and closes any open issues labeled `smoke-test-failure` for the same environment (preview/staging/production). A comment with the successful run details is added before closing.

## Known failure modes and mitigations

| Failure type | Root cause | Mitigation |
| --- | --- | --- |
| **Deployment not found** (600s timeout) | Vercel cancels queued deployment when a newer push supersedes it (mirrors GitHub Actions concurrency cancel) | Timeout now exits 0 (non-fatal) — newer push's smoke test covers the deployment. Also increased API `limit` from 5 to 20 to avoid missing deployments during rapid push sequences. |
| **Missing deploy-sha meta** | Vercel Authentication interstitial returns HTTP 200 without SPA content | Configure `VERCEL_AUTOMATION_BYPASS_SECRET` (see Secrets section above) |
| **Shell syntax error** (`-s: command not found`) | Empty `BYPASS_HEADER` variable expands incorrectly in curl args | Replaced all `$BYPASS_HEADER` patterns with bash array approach (see How the bypass works) |

## Related docs

- [`api-base-urls.md`](./api-base-urls.md) — API URLs for apps and CI scripts (separate from this Vercel workflow).
- [ADR-0029](../adr/0029-vercel-auth-bypass-ci-access.md) — Vercel Authentication bypass + Railway direct URL decision record.
- [`setup-vercel-auth-bypass.md`](../setup-vercel-auth-bypass.md) — Step-by-step bypass secret generation guide.
