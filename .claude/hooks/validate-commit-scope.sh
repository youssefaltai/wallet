#!/bin/bash
# validate-commit-scope.sh
# Fires after Bash tool calls that include "git commit".
# Warns when staged files span unrelated domains, helping catch mixed-concern commits.
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

# Print branch context reminder
echo ""
echo "--- Commit scope check ---"
echo "Branch: $BRANCH"
if [ -n "$BRANCH_PURPOSE" ] && [ "$BRANCH_PURPOSE" != "$BRANCH" ]; then
    echo "Purpose (from branch name): $BRANCH_PURPOSE"
fi
echo "Domains touched in this commit: ${UNIQUE_DOMAINS[*]:-unknown}"

# Warn if multiple unrelated domains are present
# Exception: config-only commits are always fine
if [ "$DOMAIN_COUNT" -gt 1 ]; then
    # Check if it's purely config
    if [ "$DOMAIN_COUNT" -eq 1 ] && [[ "${UNIQUE_DOMAINS[0]}" == "config" ]]; then
        echo "Config-only commit — OK."
    else
        echo ""
        echo "WARNING: This commit touches $DOMAIN_COUNT domains: ${UNIQUE_DOMAINS[*]}"
        echo ""
        echo "Ask: do ALL staged files serve the same goal ('$BRANCH_PURPOSE')?"
        echo "  - If YES: proceed — multi-layer changes for one feature are fine."
        echo "  - If NO:  unstage the unrelated files, commit separately, or use /split-pr."
        echo ""
        echo "Staged files:"
        echo "$STAGED" | sed 's/^/  /'
    fi
fi

echo "--------------------------"
echo ""

exit 0
