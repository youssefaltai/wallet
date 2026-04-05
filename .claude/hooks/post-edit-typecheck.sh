#!/bin/bash
# Runs TypeScript type-check and ESLint after editing .ts/.tsx source files.
# Receives tool event JSON via stdin.

INPUT=$(cat)

# Extract file_path from the tool_input JSON
FILE=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', d)
    print(ti.get('file_path', ''))
except:
    print('')
" 2>/dev/null)

# Only run for TypeScript source/test files; skip .d.ts
if [[ "$FILE" =~ /(src|tests)/.*\.(ts|tsx)$ ]] && [[ ! "$FILE" =~ \.d\.ts$ ]]; then
    cd "$CLAUDE_PROJECT_DIR"

    # TypeScript full compile
    TS_OUTPUT=$(pnpm tsc --noEmit 2>&1)
    TS_EXIT=$?
    if [ $TS_EXIT -ne 0 ] && [ -n "$TS_OUTPUT" ]; then
        echo "=== TypeScript errors after editing $(basename "$FILE") ==="
        echo "$TS_OUTPUT" | tail -30
        echo "============================================================"
    fi

    # ESLint on the specific file (fast — single file only)
    LINT_OUTPUT=$(pnpm exec eslint "$FILE" 2>&1)
    LINT_EXIT=$?
    if [ $LINT_EXIT -ne 0 ] && [ -n "$LINT_OUTPUT" ]; then
        echo "=== ESLint issues in $(basename "$FILE") ==="
        echo "$LINT_OUTPUT"
        echo "============================================================"
    fi
fi
