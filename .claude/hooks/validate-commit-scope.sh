#!/bin/bash
# validate-commit-scope.sh
# Fires before Bash tool calls — filters to git commit commands only.
# Silent when commit is clean (single domain or config-only).
# Warns when staged files span unrelated domains.
# Receives tool event JSON via stdin.

INPUT=$(cat)

# Extract the command being run
COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', d)
    print(ti.get('command', ''))
except:
    print('')
" 2>/dev/null)

# Only act on git commit commands
if [[ "$COMMAND" != git\ commit* ]]; then
    exit 0
fi

BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" branch --show-current 2>/dev/null)
STAGED=$(git -C "$CLAUDE_PROJECT_DIR" diff --cached --name-only 2>/dev/null)

if [ -z "$STAGED" ]; then
    exit 0
fi

# Extract branch purpose from branch name (everything after the type/WALLET-XX- prefix)
BRANCH_PURPOSE=$(echo "$BRANCH" | sed -E 's|^[a-z]+/WALLET-[0-9]+-(.+)$|\1|' | tr '-' ' ')

# Domain detection — map file paths to concern labels
DOMAINS=()

has_domain() {
    echo "$STAGED" | grep -q "$1" && DOMAINS+=("$2")
}

has_domain '^src/lib/db/\|^src/lib/db/migrations/' "database"
has_domain '^src/lib/services/' "service-layer"
has_domain '^src/lib/ai/tools/' "ai-tools"
has_domain '^src/app/api/' "api-routes"
has_domain '^src/app/(app)/' "ui"
has_domain '^src/components/' "ui"
has_domain '^src/hooks/' "ui"
has_domain '^src/app/(auth)/' "auth"
has_domain '^\.claude/\|^AGENTS\.md$\|^CLAUDE\.md$' "config"

# Deduplicate domains array
UNIQUE_DOMAINS=($(printf '%s\n' "${DOMAINS[@]}" | sort -u))
DOMAIN_COUNT=${#UNIQUE_DOMAINS[@]}

# Silent for clean commits — only speak when there's a problem
# Config-only commits: always fine, stay silent
if [ "$DOMAIN_COUNT" -eq 1 ] && [[ "${UNIQUE_DOMAINS[0]}" == "config" ]]; then
    exit 0
fi

# Single-domain commit: silent — no news is good news
if [ "$DOMAIN_COUNT" -le 1 ]; then
    exit 0
fi

# Multi-domain: warn and ask Claude to verify intent
echo ""
echo "=== Commit scope warning ==="
echo "Branch: $BRANCH"
if [ -n "$BRANCH_PURPOSE" ] && [ "$BRANCH_PURPOSE" != "$BRANCH" ]; then
    echo "Purpose: $BRANCH_PURPOSE"
fi
echo "Domains in this commit ($DOMAIN_COUNT): ${UNIQUE_DOMAINS[*]}"
echo ""
echo "Ask: do ALL staged files serve the same goal ('$BRANCH_PURPOSE')?"
echo "  - If YES: proceed — multi-layer changes for one feature are fine."
echo "  - If NO:  unstage the unrelated files, commit separately, or use /split-pr."
echo ""
echo "Staged files:"
echo "$STAGED" | sed 's/^/  /'
echo "============================"
echo ""

exit 0
