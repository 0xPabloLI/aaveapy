# Vercel Authentication CI Bypass Setup

## Problem

Vercel Authentication is enabled (`prod_deployment_urls_and_all_previews`), which means all `*.vercel.app` URLs (including preview deployments) require Vercel login. This causes CI smoke-test failures because it accesses deployment URLs without authentication.

## Solution

Use **Vercel Automation Bypass Secret** — an official Vercel feature for CI/CD automation that bypasses deployment protection.

## Setup Steps

### 1. Generate the Bypass Secret

Run the helper script (requires `VERCEL_TOKEN`):

```bash
# Option A: Export token and run script
export VERCEL_TOKEN=your_vercel_token
./scripts/generate-vercel-bypass-secret.sh

# Option B: Pass token inline
VERCEL_TOKEN=your_vercel_token ./scripts/generate-vercel-bypass-secret.sh
```

The script outputs a secret like:
```
VERCEL_AUTOMATION_BYPASS_SECRET
====
vpb_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
====
```

### 2. Add to GitHub Actions Secrets

Add the secret to your GitHub repository:

```bash
gh secret set VERCEL_AUTOMATION_BYPASS_SECRET
# Paste the secret when prompted
```

Or via GitHub UI:
1. Go to Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `VERCEL_AUTOMATION_BYPASS_SECRET`
4. Value: Paste the secret from step 1
5. Click "Add secret"

### 3. Verify CI Works

Push a commit or trigger the `deployment-smoke-test.yml` workflow manually. The "Check Vercel deployment URL" step should now pass with:
```
🔐 Using Vercel Automation Bypass (secret configured)
✅ Deployment URL accessible, deploy SHA matches push
```

## How It Works

- The `deployment-smoke-test.yml` workflow adds the bypass secret as an HTTP header:
  ```bash
  curl -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" ...
  ```
- Vercel recognizes this header and allows the request without authentication
- The secret is scoped to the project and can be rotated at any time

## E2E Tests

E2E tests are **not affected** because they run against a local preview server (`npm run preview:staging`), not Vercel deployment URLs.

## References

- [Vercel docs: Configure GitHub Actions for Preview Deployment Testing](https://vercel.com/docs/deployment-protection/automated-agent-access)
- [Vercel docs: Bypass Deployment Protection with Query Parameter](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
- [Vercel REST API: Update Protection Bypass](https://vercel.com/docs/rest-api/projects/update-protection-bypass-for-automation)