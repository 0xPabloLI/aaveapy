# ADR-0029: Vercel Authentication bypass for CI access

## Status

Accepted (2026-08-06)

## Context

Vercel Authentication (`ssoProtection: { enabled: true, deploymentType: "prod_deployment_urls_and_all_previews" }`) was enabled on the Vercel project to prevent unauthorised access to staging and preview deployments. This blocks all requests without a Vercel login session — including CI automation (curl in `deployment-smoke-test.yml`, Playwright in `ci.yml`).

Two independent CI access problems resulted:

1. **Smoke test (`deployment-smoke-test.yml`)**: curl requests to `staging.aaveapy.com` and `*.vercel.app` received the Vercel login page (HTTP 200, but no `#root` element), causing `site_check` and `deploy_url_check` failures.

2. **E2E tests (`ci.yml`)**: Playwright's built app called `staging-api.aaveapy.com` at runtime; Cloudflare WAF (sitting in front of the public domain) returned 403 to GitHub Actions IPs. Additionally, `e2e/test-reserves.ts` fetched the staging API at module load for dynamic reserve discovery — also blocked.

## Decision

Use two complementary bypass strategies, each targeting the correct interception layer:

### 1. Vercel Authentication bypass (frontend pages)

Use Vercel's official **Automation Bypass Secret** (`VERCEL_AUTOMATION_BYPASS_SECRET`):

- Generate via `scripts/generate-vercel-bypass-secret.sh` (calls Vercel REST API).
- Store as a GitHub Actions encrypted secret.
- Inject as HTTP header in all curl calls that hit Vercel-served URLs:
  ```
  curl -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" ...
  ```
- Applied to both `site_check` (custom domain) and `deploy_url_check` (preview URL) steps in `deployment-smoke-test.yml`.
- When the secret is absent, the workflow logs a warning and continues (graceful degradation).

### 2. Railway direct URL (backend API)

Use the `LIVE_TEST_API_BASE_CI` GitHub secret (Railway internal URL) to route CI API traffic directly to Railway, bypassing Cloudflare entirely:

- CI E2E jobs (`e2e-desktop`, `e2e-mobile`) inject `VITE_API_BASE_URL` from the secret.
- `build:staging` and `preview:staging` npm scripts use `${VITE_API_BASE_URL:-default}` shell expansion so the CI override is respected.
- `e2e/test-reserves.ts` reads `process.env.VITE_API_BASE_URL` for its module-load fetch.
- Local development is unaffected (falls back to `staging-api.aaveapy.com`).

This approach was already used by `live-schema-validation`, `openapi-check`, `hardcode-sync`, and `token-icon-sync` jobs — E2E was the last gap.

## Consequences

### Positive

- CI smoke test and E2E tests pass reliably without Vercel Authentication or Cloudflare interference.
- No per-deployment API calls needed (bypass secret is project-scoped, does not expire).
- Local development workflow unchanged.
- Graceful degradation when secrets are not configured (warnings, not hard failures for smoke test).

### Negative

- Two GitHub secrets must be maintained (`VERCEL_AUTOMATION_BYPASS_SECRET`, `LIVE_TEST_API_BASE_CI`). If either expires or is rotated, CI will fail until updated.
- The bypass secret is stored in plaintext inside the workflow YAML expression (`${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}`); GitHub masks it in logs, but the workflow file itself is in the repo.

## Alternatives Considered

### Vercel shareable URLs (per-deployment)

Generate a `?_vercel_share=<token>` URL for each deployment via Vercel API. Expires in ~23 hours. Requires a per-deployment API call in CI. Rejected — adds complexity and latency for no benefit over the static bypass secret.

### Disable Vercel Authentication

Rejected. Staging protection is a deliberate security measure. Disabling it would expose unreleased features and staging data to anyone who guesses the URL.

### Cloudflare IP allow-list for GitHub Actions

Rejected. GitHub Actions uses thousands of rotating exit IPs across many ranges. Maintaining an allow-list is fragile and scales poorly. Documented in `docs/conventions/ci-live-schema-cloudflare.md`.

## Related

- `docs/conventions/vercel-deployment-smoke-test.md` — smoke test workflow reference
- `docs/conventions/api-base-urls.md` — API URL resolution for all layers
- `docs/conventions/ci-live-schema-cloudflare.md` — Cloudflare WAF bypass strategy (Railway direct URL)
- `docs/setup-vercel-auth-bypass.md` — step-by-step bypass secret setup guide
- AGENTS.md § "main Branch Protection" — Layer 3 (content-security-check) and Vercel Authentication
