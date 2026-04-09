#!/bin/bash
# post-edit-db-guard.sh
# Fires after editing files that should NOT contain direct DB access.
# Warns immediately if db.select/insert/update/delete calls are found outside
# the service layer (src/lib/services/).
# Receives tool event JSON via stdin.

INPUT=$(cat)

FILE=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', d)
    print(ti.get('file_path', ''))
except:
    print('')
" 2>/dev/null)

# Only check files outside the service layer that could contain stray DB access
# Target: API routes, server actions, app route pages/layouts, components, hooks, AI tools
if [[ "$FILE" =~ src/app/api/.*\.(ts|tsx)$ ]] || \
   [[ "$FILE" =~ src/app/[(]app[)]/.*\.(ts|tsx)$ ]] || \
   [[ "$FILE" =~ src/components/.*\.(ts|tsx)$ ]] || \
   [[ "$FILE" =~ src/hooks/.*\.(ts|tsx)$ ]] || \
   [[ "$FILE" =~ src/lib/ai/tools/.*\.(ts|tsx)$ ]]; then

    # Check for direct DB query calls (not in services)
    VIOLATIONS=$(grep -nE \
        'db\.(select|insert|update|delete|query|transaction|execute)\b' \
        "$FILE" 2>/dev/null)

    if [ -n "$VIOLATIONS" ]; then
        echo ""
        echo "=== Direct DB access detected outside service layer ==="
        echo "File: $FILE"
        echo ""
        echo "Violations:"
        echo "$VIOLATIONS" | sed 's/^/  /'
        echo ""
        echo "All DB access must go through src/lib/services/."
        echo "See .claude/rules/services.md and .claude/rules/financial-invariants.md"
        echo "========================================================"
        echo ""
    fi
fi
