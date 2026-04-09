# Deployment Smoke Test and Rollback

A pattern for verifying deployments automatically and rolling back on failure.

## Overview

After each deployment to a target environment, run an automated smoke test that verifies the deployed site is serving the expected commit. If the smoke test fails, trigger an automatic rollback to the previous known-good deployment.

## Triggers

- Run on **push** to deployment branches (e.g. `main`, `dev`, `staging`).
- Map each branch to its environment (production, staging, preview).

## Required Secrets

| Secret | Purpose |
|--------|---------|
| Platform API token | Smoke polling + rollback API calls |
| Project ID | Identify which project to roll back |
| Team/org ID | Optional; scope for the token |

If the API token is missing, smoke test and rollback steps should **skip gracefully** (exit 0 with a log message).

## Deploy SHA Verification

Inject a proof of which commit is live into the build output:

- Build plugin adds `<meta name="deploy-sha" content="...">` to the HTML, using the CI commit SHA.
- The smoke test checks that this value matches the expected commit SHA for the current run.
- If mismatched, the deployment is not serving the expected code → fail.

## Auto-Rollback Pattern

- Runs only when the smoke test job **fails**.
- **Production only**: preview/staging branches should NOT trigger project-level rollback (wrong target).
- Rollback picks the **previous successful deployment** on the **same Git ref**, excluding the current commit SHA.

### Git ref normalization

CI systems expose branch names in different formats (e.g. `main` vs `refs/heads/main`). When comparing Git refs for rollback candidate selection, **always normalize** both sides (strip `refs/heads/` prefix) before comparing.

## Checklist for new projects

- [ ] Add deploy SHA injection to the build pipeline
- [ ] Configure smoke test workflow with platform API credentials
- [ ] Test rollback in a non-production environment first
- [ ] Verify ref normalization handles your CI's ref format
- [ ] Confirm graceful skip when credentials are missing
