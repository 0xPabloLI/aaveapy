#!/usr/bin/env bash
# Generate Vercel Automation Bypass Secret for CI/CD
# This script calls Vercel REST API to generate a protection bypass secret
# that allows CI/CD automation to bypass Vercel Authentication.

set -euo pipefail

# Vercel project configuration
PROJECT_ID="prj_vs0UPjeN0vNdKSZHYWBR1RJgJLzY"
TEAM_ID="team_nL4bmoEAVyVCzIn6her0vz7B"

# Check for VERCEL_TOKEN
if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "❌ VERCEL_TOKEN environment variable not set"
  echo ""
  echo "Usage:"
  echo "  export VERCEL_TOKEN=your_vercel_token"
  echo "  $0"
  echo ""
  echo "Get your token from: https://vercel.com/account/tokens"
  exit 1
fi

echo "🔐 Generating Vercel Automation Bypass Secret..."
echo "   Project ID: $PROJECT_ID"
echo "   Team ID: $TEAM_ID"
echo ""

# Build API URL
TEAM_PARAM="?teamId=${TEAM_ID}"
API_URL="https://api.vercel.com/v1/projects/${PROJECT_ID}/protection-bypass${TEAM_PARAM}"

# Generate the bypass secret
echo "Calling Vercel API: ${API_URL}"
RESPONSE=$(curl -sS \
  -X PATCH \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"generate":{}}' \
  "$API_URL")

# Extract the secret from the response
PROTECTION_BYPASS_SECRET=$(echo "$RESPONSE" | jq -r '.protectionBypass.secret // empty')

if [ -z "$PROTECTION_BYPASS_SECRET" ]; then
  echo "❌ Failed to generate bypass secret"
  echo "API response:"
  echo "$RESPONSE" | jq .
  exit 1
fi

echo ""
echo "✅ Bypass secret generated successfully!"
echo ""
echo "================================================"
echo "  VERCEL_AUTOMATION_BYPASS_SECRET"
echo "================================================"
echo "$PROTECTION_BYPASS_SECRET"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Add this secret to GitHub Actions:"
echo "     gh secret set VERCEL_AUTOMATION_BYPASS_SECRET"
echo "  2. Paste the secret above when prompted"
echo "  3. The CI workflow will now bypass Vercel Authentication"
echo ""
echo "Note: Keep this secret confidential. It grants access to"
echo "      protected deployments for this Vercel project."