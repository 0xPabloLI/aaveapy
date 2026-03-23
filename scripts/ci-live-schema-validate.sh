#!/usr/bin/env bash
# Used by GitHub Actions (live-schema jobs). See docs/conventions/ci-live-schema-cloudflare.md
set -euo pipefail

max_attempts=2
delay_seconds=15

node scripts/probe-live-api.mjs
probe=$?

if [ "$probe" -eq 2 ] && [ "${LIVE_TESTS_SKIP_WHEN_CHALLENGE:-false}" = "true" ]; then
  echo "::warning::Live API returned a Cloudflare challenge page — skipping schema tests. Configure Cloudflare per docs/conventions/ci-live-schema-cloudflare.md, or set LIVE_TESTS_SKIP_WHEN_CHALLENGE=false to fail the job until the API is reachable."
  exit 0
fi

if [ "$probe" -ne 0 ]; then
  echo "::error::Live API probe failed (exit code $probe). See docs/conventions/ci-live-schema-cloudflare.md"
  exit 1
fi

attempt=1
set +e
while [ "$attempt" -le "$max_attempts" ]; do
  echo "Live schema validation attempt $attempt/$max_attempts"
  npx vitest run src/lib/apiSchemas.live.test.ts
  status=$?

  if [ "$status" -eq 0 ]; then
    exit 0
  fi

  if [ "$attempt" -lt "$max_attempts" ]; then
    echo "::warning::Live schema validation failed on attempt $attempt/$max_attempts; retrying in ${delay_seconds}s"
    sleep "$delay_seconds"
  fi

  attempt=$((attempt + 1))
done

echo "::error::Live schema validation failed after $max_attempts attempts"
exit "$status"
