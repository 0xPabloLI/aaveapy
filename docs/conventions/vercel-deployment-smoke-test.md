# Vercel deployment smoke test and rollback

Canonical workflow: [`.github/workflows/deployment-smoke-test.yml`](../../.github/workflows/deployment-smoke-test.yml).

## Triggers and environments

- Runs on **push** to `main` and `dev`.
- **Production** (`main`): `SITE_URL` is the public site; Vercel target is `production`.
- **Staging** (`dev`): `SITE_URL` is staging; Vercel target is `preview`.

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
- The workflow checks that this value matches `github.sha` for the run, so the smoke test fails if the site is not serving the expected deployment.

## Auto-rollback

- Runs only when the **smoke-test** job fails (`rollback` job, `if: failure()`).
- **Instant project rollback** (Vercel REST rollback) runs **only on `main`**. Preview/staging branches do not call project rollback (unsafe / wrong target); the workflow logs a skip and opens an issue with a “skipped” status.
- Rollback picks the **previous READY** deployment on the **same Git ref** as the failing push, excluding the current commit SHA.

### Git ref matching (important for maintainers)

GitHub exposes `github.ref_name` as a **short** branch name (e.g. `main`). Vercel deployment metadata often stores `meta.githubCommitRef` as a **full** ref (e.g. `refs/heads/main`). The workflow **normalizes** both sides in `jq` (strip a leading `refs/heads/` before comparing) so candidate selection does not silently find zero matches.

When editing rollback logic, **do not** compare these fields as raw strings without normalization.

## Related docs

- [`api-base-urls.md`](./api-base-urls.md) — API URLs for apps and CI scripts (separate from this Vercel workflow).
