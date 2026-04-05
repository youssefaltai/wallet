#!/bin/bash
# generate-gh-app-token.sh
# Generates a GitHub App installation token so PRs appear as created by the bot.
#
# Required vars (set in .env.local):
#   CLAUDE_GH_APP_CLIENT_ID        — GitHub App Client ID (e.g. Iv23liXXXXXXXXXX)
#   CLAUDE_GH_APP_PRIVATE_KEY_PATH — Absolute path to the downloaded .pem private key
#   CLAUDE_GH_APP_INSTALLATION_ID  — Installation ID (from github.com/settings/installations/XXXXX)
#
# Outputs the installation token to stdout. Errors go to stderr.
# Returns exit code 0 on success, non-zero on failure.
#
# SETUP (one-time, done by the user):
#   1. github.com → Settings → Developer Settings → GitHub Apps → New GitHub App
#      - Name: Claude (shows as "Claude[bot]" on PRs)
#      - Webhook: disabled
#      - Permissions: Pull requests=Write, Contents=Write
#      - Install on: this repository
#   2. Save the App's Client ID as CLAUDE_GH_APP_CLIENT_ID in .env.local
#   3. Generate + download a private key (.pem), save path as CLAUDE_GH_APP_PRIVATE_KEY_PATH
#   4. After installing the app, get the installation ID from the URL and save as CLAUDE_GH_APP_INSTALLATION_ID

set -euo pipefail

# Load CLAUDE_GH_APP_* vars from .env.local if not already in environment
ENV_FILE="${CLAUDE_PROJECT_DIR:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)}/.env.local"
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line; do
    if [[ "$line" =~ ^(CLAUDE_GH_APP_[A-Z_]+)=(.+)$ ]]; then
      export "${BASH_REMATCH[1]}=${BASH_REMATCH[2]}"
    fi
  done < "$ENV_FILE"
fi

# Validate
CLIENT_ID="${CLAUDE_GH_APP_CLIENT_ID:-}"
KEY_PATH="${CLAUDE_GH_APP_PRIVATE_KEY_PATH:-}"
INSTALL_ID="${CLAUDE_GH_APP_INSTALLATION_ID:-}"

if [ -z "$CLIENT_ID" ] || [ -z "$KEY_PATH" ] || [ -z "$INSTALL_ID" ]; then
  echo "GitHub App not configured. Set CLAUDE_GH_APP_CLIENT_ID, CLAUDE_GH_APP_PRIVATE_KEY_PATH, and CLAUDE_GH_APP_INSTALLATION_ID in .env.local" >&2
  exit 1
fi

if [ ! -f "$KEY_PATH" ]; then
  echo "Private key not found: $KEY_PATH" >&2
  exit 1
fi

# Build JWT: header.payload.signature (RS256)
now=$(date +%s)
iat=$((now - 60))   # allow 60s clock skew
exp=$((now + 600))  # 10 minutes

b64enc() { openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n'; }

header=$(printf '{"typ":"JWT","alg":"RS256"}' | b64enc)
payload=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$iat" "$exp" "$CLIENT_ID" | b64enc)
header_payload="${header}.${payload}"
signature=$(printf '%s' "$header_payload" | openssl dgst -sha256 -sign "$KEY_PATH" | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
JWT="${header_payload}.${signature}"

# Exchange JWT for a 1-hour installation token
TOKEN=$(curl -s -X POST \
  -H "Authorization: Bearer ${JWT}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/app/installations/${INSTALL_ID}/access_tokens" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('token','') or ''); sys.exit(0 if d.get('token') else 1)")

printf '%s' "$TOKEN"
