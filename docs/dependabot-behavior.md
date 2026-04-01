# Dependabot Behavior (Canonical Summary)

This document is intentionally short. It points to canonical policy sources and avoids duplicating workflow details.

## Current policy

- **npm routine update PRs:** disabled via `.github/dependabot.yml` (`open-pull-requests-limit: 0`).
- **GitHub Actions routine update PRs:** enabled weekly with limit `5` for pinned third-party action SHA bumps.
- **Security updates:** controlled separately in GitHub repository settings (`Code security and analysis`).

## Canonical sources

- Config source of truth: [`.github/dependabot.yml`](../.github/dependabot.yml)
- PR merge strategy and batching: [`docs/PR_ANALYSIS.md`](./PR_ANALYSIS.md)
- React peer dependency safety: [`docs/conventions/peer-dependency-guard.md`](./conventions/peer-dependency-guard.md)

## Operational notes

- Prefer routine dependency policy changes in `.github/dependabot.yml`, not here.
- If policy and this summary disagree, treat `.github/dependabot.yml` as authoritative.
