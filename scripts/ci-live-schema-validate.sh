#!/usr/bin/env bash
# CI: probe staging API then run live schema tests. See docs/conventions/ci-live-schema-cloudflare.md
set -euo pipefail

max_attempts=2
delay_seconds=15

set +e
node scripts/probe-live-api.mjs
probe=$?
set -e

if [ "$probe" -eq 2 ]; then
  echo "::error::Staging API returned a Cloudflare challenge (403). Relax WAF only for staging-api.aaveapy.com + /api/* — see docs/conventions/ci-live-schema-cloudflare.md"
  exit 1
fi

if [ "$probe" -ne 0 ]; then
  echo "::error::Live API probe failed (exit $probe). See docs/conventions/ci-live-schema-cloudflare.md"
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
