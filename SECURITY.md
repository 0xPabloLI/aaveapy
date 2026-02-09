# Security Policy

## Supported Versions

This repository currently maintains the latest `main` branch for security fixes.

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** open a public issue.

- Contact: **0xpablo.li@proton.me**
- Include: impact, reproduction steps, affected commit/version, and proof-of-concept if available.
- Response target: initial response within **72 hours**.

## Public Release Security Runbook

Use this checklist before converting the repository to public visibility.

### 1) Secret rotation first (mandatory)

If any credential was ever committed (even briefly), rotate it first:

- API keys
- Access tokens
- Service account secrets
- Webhook secrets

> Rewriting history is **not** a substitute for credential rotation.

### 2) Enable GitHub security features

In **Settings → Security**:

- Enable **Secret scanning**
- Enable **Push protection**
- Enable **Dependabot alerts**
- Enable **Dependabot security updates**

### 3) Protect main branch

In **Settings → Branches**:

- Require pull request before merge
- Require status checks to pass
- Restrict force pushes
- Restrict direct pushes to `main`

### 4) Verify repository hygiene

- Keep `.env` and secret files in `.gitignore`
- Keep only `.env.example` tracked
- Ensure no private endpoints or credentials in docs/scripts

### 5) If secrets were exposed: history cleanup workflow

1. Rotate affected credentials immediately.
2. Rewrite git history (`git filter-repo` or BFG) to remove leaked files/strings.
3. Force push cleaned history.
4. Invalidate old clones/forks where possible and notify collaborators to reclone.
5. Contact GitHub Support for cache/index cleanup if needed.

## PR and History Deletion FAQ

- Closed/merged GitHub PRs generally cannot be fully deleted from normal repository UI controls.
- You can edit PR descriptions, remove sensitive comments, and lock conversations.
- Git history can be rewritten, but previously cloned/forked copies may still retain old data.

## Local verification commands

```bash
# 1) Quick secret keyword scan (heuristic)
rg -n "(AKIA|AIza|BEGIN RSA|PRIVATE KEY|TOKEN|SECRET|PASSWORD|SENTRY_DSN|VITE_.*KEY)" -g'!*dist/*'

# 2) Check tracked env files
git ls-files | rg "^\.env"

# 3) Ensure sensitive env files are ignored
git check-ignore -v .env .env.local .env.production
```
