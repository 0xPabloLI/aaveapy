# Handoff: Vercel Authentication breaks CI smoke-test + E2E

> **Status**: ✅ RESOLVED
> **Solution**: Implemented `VERCEL_AUTOMATION_BYPASS_SECRET` approach
> **Commit**: `ci: add Vercel Authentication bypass for smoke-test`
> **See also**: `docs/setup-vercel-auth-bypass.md`

## Problem

PR #519 (lovable → main) has `smoke-test` failure and E2E tests may also fail.

**Root cause**: Vercel Authentication was enabled via Vercel MCP:
```
ssoProtection: { enabled: true, deploymentType: "prod_deployment_urls_and_all_previews" }
```

This means all `*.vercel.app` preview URLs now require Vercel login. The CI smoke-test and E2E tests access these preview URLs without authentication, so they get a Vercel login interstitial page instead of the actual app.

## Evidence

smoke-test log:
```
🔗 Checking Vercel deployment URL (https://aave-protocol-explorer-r939dn43j-...vercel.app)...
HTTP status: 200
❌ Deployment URL missing aaveapy-deploy-sha meta
```

HTTP 200 because Vercel returns a 200 with a login/redirect page, not the actual app HTML.

## What needs fixing

### CI workflow: `.github/workflows/ci.yml`

The `smoke-test` job and `e2e-desktop`/`e2e-mobile` jobs need to handle Vercel Authentication.

### Possible solutions

1. **Use Vercel shareable URL bypass** (recommended):
   - In the CI workflow, after Vercel deploys, use `vercel` CLI or Vercel API to generate a shareable bypass URL
   - Pass this URL to smoke-test and E2E tests instead of the raw `*.vercel.app` URL
   - Shareable URLs have format: `https://<deployment>.vercel.app/?_vercel_share=<token>`
   - Expires in ~23 hours, sufficient for CI

2. **Use deployment-specific env variable**:
   - Vercel sets `VERCEL_URL` env var during build
   - CI can use the Vercel API to create a shareable link for that deployment

3. **Disable Vercel Authentication for CI deployments**:
   - Not possible — Vercel Authentication applies to all deployments of the configured type
   - Can't selectively disable for CI

4. **Use production URL for smoke-test**:
   - Check `aaveapy.com` instead of preview URL
   - But this doesn't verify the PR's specific deployment

## How to generate shareable URL via Vercel API

```bash
# Get deployment URL from Vercel
DEPLOY_URL=$(vercel env ls --json | jq -r '...')
# Or from GitHub Actions: use the Vercel deployment URL from the deploy step

# Create shareable URL via API
curl -X POST "https://api.vercel.com/v6/deployments/$DEPLOY_ID/access" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"teamId": "team_nL4bmoEAVyVCzIn6her0vz7B"}'
# Returns: { "url": "https://.../?_vercel_share=..." }
```

Or via Vercel MCP tool: `get_access_to_vercel_url(url=<deployment_url>)`

## Files to modify

1. `.github/workflows/ci.yml` — `smoke-test` job: add shareable URL generation step
2. `.github/workflows/ci.yml` — `e2e-desktop`/`e2e-mobile` jobs: pass shareable URL as `BASE_URL` env
3. May need to add `VERCEL_TOKEN` secret to the repo (for API calls) or use the `vercel` CLI with stored auth

## Vercel project info

- Project ID: `prj_vs0UPjeN0vNdKSZHYWBR1RJgJLzY`
- Team ID: `team_nL4bmoEAVyVCzIn6her0vz7B`
- Project name: `aave-protocol-explorer`
- Custom domain: `aaveapy.com` (public, no auth)
- Vercel Authentication: `prod_deployment_urls_and_all_previews` (preview + prod vercel.app URLs need login)

## PR #519 status

- **mergeable**: MERGEABLE (no conflicts)
- **All required checks**: PASS
- **smoke-test**: FAIL (not a required check, doesn't block merge)
- **e2e-desktop (2/2)**: was in_progress at handoff time
- **e2e-mobile (2/2)**: was in_progress at handoff time

The PR can be merged even with smoke-test failing (it's not a required check). The fix is for future PRs.

## Session context

This session implemented comprehensive main branch protection:
- Layer 1: Bot PR not auto-merge to main (workflow labels)
- Layer 2: Branch protection + CODEOWNERS (`required_approving_review_count=0`, solo dev)
- Layer 3: content-security-check CI (two-tier URL whitelist in `scripts/check-external-urls.ts`)
- Layer 4: Required signed commits (enabled in GitHub UI)
- CSP + Security headers in `vercel.json`
- Stale bot PR cleanup workflow
- Vercel Authentication (via Vercel MCP API)
- `AGENTS.md` documentation for all layers

All changes are on `lovable` branch, PR #519 targets `main`.

## Resolution (Completed)

### Chosen Solution

Used **Vercel Automation Bypass Secret** (`VERCEL_AUTOMATION_BYPASS_SECRET`) approach:

1. Modified `.github/workflows/deployment-smoke-test.yml`:
   - Added conditional `x-vercel-protection-bypass` header when secret is configured
   - Added clear error message when secret is missing
   - Added detection for Vercel Authentication page (fails with helpful message)
   - Workflow continues to work even without secret (warns but doesn't block)

2. Added `scripts/generate-vercel-bypass-secret.sh`:
   - Helper script to generate bypass secret via Vercel REST API
   - Requires `VERCEL_TOKEN` environment variable
   - Outputs secret with setup instructions

3. Added `docs/setup-vercel-auth-bypass.md`:
   - Complete setup guide with step-by-step instructions
   - References to Vercel documentation
   - Clear explanation of why E2E tests are unaffected

### Why This Approach

- Official Vercel-recommended method for CI/CD automation
- Simple one-time setup (generate secret → add as GitHub secret)
- No per-deployment API calls needed
- Works for all deployment types
- E2E tests unaffected (they run against local preview server)

### Next Steps for User

1. Generate the bypass secret:
   ```bash
   export VERCEL_TOKEN=your_vercel_token
   ./scripts/generate-vercel-bypass-secret.sh
   ```

2. Add to GitHub Actions secrets:
   ```bash
   gh secret set VERCEL_AUTOMATION_BYPASS_SECRET
   # Paste the secret when prompted
   ```

3. Verify CI works: push a commit or trigger the workflow manually

### Commit

- Commit message: `ci: add Vercel Authentication bypass for smoke-test`
- Branch: `lovable`
- Pushed: Yes
