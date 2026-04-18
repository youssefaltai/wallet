#!/bin/bash
# session-start.sh
# Loads project context at the start of every Claude session.
# Output: JSON with additionalContext for Claude's session start.
# Also detects concurrent Claude sessions in the same cwd and warns loudly.

# Read hook input from stdin (JSON). We need session_id to exclude ourselves
# when scanning for sibling sessions.
HOOK_INPUT=$(cat)
SESSION_ID=$(echo "$HOOK_INPUT" | python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d.get('session_id', ''))
except Exception:
    print('')
" 2>/dev/null)

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
RECENT_COMMITS=$(git log --oneline -5 2>/dev/null || echo "(none)")
UNCOMMITTED=$(git diff --name-only HEAD 2>/dev/null | head -20)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | head -10)

# Concurrent-session detection: a sibling .jsonl touched in the last 3 minutes
# inside the same project-scoped session dir means another Claude is alive here.
# Each Claude session writes to ~/.claude/projects/<encoded-cwd>/<session-id>.jsonl.
PROJECT_SESSION_DIR="$HOME/.claude/projects/$(echo "$CLAUDE_PROJECT_DIR" | sed 's|/|-|g')"
CONCURRENT_WARNING=""
if [ -n "$SESSION_ID" ] && [ -d "$PROJECT_SESSION_DIR" ]; then
    SIBLINGS=$(find "$PROJECT_SESSION_DIR" -maxdepth 1 -name "*.jsonl" -mmin -3 2>/dev/null \
        | grep -v "/${SESSION_ID}\.jsonl$" \
        | head -5)
    if [ -n "$SIBLINGS" ]; then
        SIBLING_COUNT=$(echo "$SIBLINGS" | wc -l | tr -d ' ')
        CONCURRENT_WARNING="

⚠️  CONCURRENT CLAUDE SESSION DETECTED — $SIBLING_COUNT other session(s) active in this cwd within the last 3 minutes:
$(echo "$SIBLINGS" | sed 's|.*/|    |; s|\.jsonl$||')

  Running two Claude sessions in the same working directory causes git collisions:
  one session's \`git checkout\` auto-stashes the other's work onto the wrong branch.
  This already happened once (see Linear WALLET-41).

  Before ANY git command (checkout, branch, stash, commit):
  1. Verify in your terminal tabs whether the sibling session is actually alive.
  2. If you need parallel work, use a worktree — do NOT share this cwd:
       git worktree add ../wallet-WALLET-XX -b {type}/WALLET-XX-description main
       cd ../wallet-WALLET-XX
  3. If the sibling is stale/finished, you can proceed — but treat every
     git operation as potentially colliding until the sibling's .jsonl stops
     updating."
    fi
else
    # Fail-visible: if we can't identify our session (empty stdin, malformed
    # JSON, or the hook input schema changed), detection is silently useless.
    # Emit a soft advisory so the user knows to treat git operations as
    # potentially colliding until they've visually confirmed they're alone.
    CONCURRENT_WARNING="

ℹ️  CONCURRENT-SESSION DETECTION UNAVAILABLE — could not read session_id from hook input.
  This session may or may not be the only Claude running in $CLAUDE_PROJECT_DIR.
  Before any \`git checkout\` / \`git stash\`, confirm visually that no other
  Claude terminal tabs are active in this cwd, or use a worktree for safety:
    git worktree add ../wallet-WALLET-XX -b {type}/WALLET-XX-description main"
fi

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

Linear: before starting new work, call \`list_issues\` filtered to 'In Progress' state to see active branches, and 'In Review' to see open PRs needing attention.
===============================${CONCURRENT_WARNING}"

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
