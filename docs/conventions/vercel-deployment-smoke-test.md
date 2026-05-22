# Vercel deployment smoke test and rollback

Canonical workflow: [`.github/workflows/deployment-smoke-test.yml`](../../.github/workflows/deployment-smoke-test.yml).

## Triggers and environments

- Runs on **push** to `main` and `dev`.
- **Production** (`main`): `SITE_URL` is the public site; Vercel target is `production`.
- **Staging** (`dev`): `SITE_URL` is `https://staging.aaveapy.com`; Vercel target is `preview`.

> **Note:** The `lovable` branch is excluded because `staging.aaveapy.com` is bound to the `dev` branch in Vercel. Running smoke tests from `lovable` would always fail the deploy-SHA check since the custom domain serves the `dev` deployment.

## Secrets

Configure in the GitHub repository:

| Secret | Purpose |
| --- | --- |
| `VERCEL_TOKEN` | API token (smoke polling + rollback) |
| `VERCEL_PROJECT_ID` | Project ID |
| `VERCEL_TEAM_ID` | Optional; team scope for the token |

If `VERCEL_TOKEN` is missing, the smoke test and rollback steps **skip** (exit 0) with a log message.

## Deploy SHA verification

Production builds inject a short-lived proof of which commit is live:

- Vite plugin in `vite.config.ts` adds `<meta name="aaveapy-deploy-sha" content="…">` to `index.html`, using `VERCEL_GIT_COMMIT_SHA` (or `GITHUB_SHA` / `CF_PAGES_COMMIT_SHA` when set).
- **`main`**: `site_check` requires `staging.aaveapy.com` / production URL to serve `github.sha` immediately.
- **Staging branches**: `deploy_url_check` requires the Vercel deployment URL for this commit to serve `github.sha`. `site_check` on the custom domain **polls up to 5 minutes** when the alias lags behind a READY preview deployment.
- **`api_check`** calls `/api/markets` for diagnostics only; HTTP failures are warnings and do **not** fail the job.

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

## Related docs

- [`api-base-urls.md`](./api-base-urls.md) — API URLs for apps and CI scripts (separate from this Vercel workflow).
