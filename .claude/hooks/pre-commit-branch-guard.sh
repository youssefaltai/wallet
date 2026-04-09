#!/bin/bash
# pre-commit-branch-guard.sh
# Blocks `git commit` when the current branch is `main`.
# The only exception: committing .claude/ config files (the /evolve workflow).
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

# Guard 1: Block force-push to main (command must start with "git push")
if [[ "$COMMAND" == git\ push* ]]; then
    # Check for --force or -f flag AND "main" anywhere in the command
    HAS_FORCE=false
    HAS_MAIN=false
    [[ "$COMMAND" == *"--force"* || "$COMMAND" == *" -f"* || "$COMMAND" == *" -f "* ]] && HAS_FORCE=true
    [[ "$COMMAND" =~ (^|[[:space:]])main([[:space:]]|$) ]] && HAS_MAIN=true

    if $HAS_FORCE && $HAS_MAIN; then
        echo "ERROR: Force-pushing to main is not allowed."
        echo ""
        echo "If you need to update main, use a PR and squash merge."
        echo "The only exception is /evolve commits, which use regular (non-force) pushes."
        exit 2
    fi
fi

# Only act on git commit commands for the remaining checks
if [[ "$COMMAND" != git\ commit* ]]; then
    exit 0
fi

# Check current branch
BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" branch --show-current 2>/dev/null)

if [ "$BRANCH" = "main" ]; then
    # Check if the staged files are exclusively .claude/ files (the /evolve exception)
    STAGED=$(git -C "$CLAUDE_PROJECT_DIR" diff --cached --name-only 2>/dev/null)
    NON_CLAUDE=$(echo "$STAGED" | grep -v '^\.claude/' | grep -v '^AGENTS\.md$' | grep -v '^CLAUDE\.md$')

    if [ -n "$NON_CLAUDE" ]; then
        echo "ERROR: Attempting to commit product code directly to main."
        echo ""
        echo "Staged non-.claude files:"
        echo "$NON_CLAUDE" | sed 's/^/  /'
        echo ""
        echo "Create a branch first: git checkout -b {type}/WALLET-XX-description"
        echo "Only .claude/ config files, AGENTS.md, and CLAUDE.md may be committed directly to main."
        exit 2
    fi
fi

exit 0
