#!/bin/bash
# session-start.sh
# Loads project context at the start of every Claude session.
# Output: JSON with additionalContext for Claude's session start.

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
RECENT_COMMITS=$(git log --oneline -5 2>/dev/null || echo "(none)")
UNCOMMITTED=$(git diff --name-only HEAD 2>/dev/null | head -20)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | head -10)

# Check migration state
SQL_COUNT=$(find src/lib/db/migrations -name "*.sql" 2>/dev/null | wc -l | tr -d ' ')
JOURNAL_COUNT=$(python3 -c "
import json
try:
    d = json.load(open('src/lib/db/migrations/meta/_journal.json'))
    print(len(d.get('entries', [])))
except:
    print('?')
" 2>/dev/null)

if [ "$SQL_COUNT" != "$JOURNAL_COUNT" ] && [ "$JOURNAL_COUNT" != "?" ]; then
    MIGRATION_STATUS="⚠️  UNAPPLIED MIGRATION: $SQL_COUNT SQL files but only $JOURNAL_COUNT journal entries"
else
    MIGRATION_STATUS="✓ $SQL_COUNT migrations applied"
fi

# Build context string
CONTEXT="=== Wallet Session Context ===
Branch: $BRANCH

Recent commits:
$RECENT_COMMITS

Changed files (uncommitted):
${UNCOMMITTED:-  (none)}

Untracked files:
${UNTRACKED:-  (none)}

Database migrations: $MIGRATION_STATUS

Open PRs:
$(gh pr list --limit 5 2>/dev/null || echo "  (no GitHub remote configured)")

Linear: use \`list_issues\` filtered by 'In Progress' state to see active work before starting.
==============================="

# Output as JSON for Claude to receive as additionalContext
python3 -c "
import json, sys
context = sys.argv[1]
print(json.dumps({
    'hookSpecificOutput': {
        'hookEventName': 'SessionStart',
        'additionalContext': context
    }
}))
" "$CONTEXT"
