#!/bin/bash
# post-edit-system-prompt-check.sh
# Fires after editing src/lib/ai/system-prompt.ts.
# The system prompt MUST remain static across all users and requests —
# dynamic content breaks Anthropic prompt caching and increases token costs.

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

# Only check system-prompt.ts
if [[ "$FILE" != *"src/lib/ai/system-prompt.ts"* ]]; then
    exit 0
fi

VIOLATIONS=""

# 1. Template literal expressions — dynamic content injected at runtime
DYNAMIC=$(grep -n '\${' "$FILE" 2>/dev/null | grep -v '^\s*//' | grep -v '^\s*\*')
if [ -n "$DYNAMIC" ]; then
    VIOLATIONS="${VIOLATIONS}\n[DYNAMIC CONTENT] Template literal expressions found:\n$(echo "$DYNAMIC" | sed 's/^/  /')\n"
fi

# 2. Date/time calls — timestamps vary per request, breaking cache
DATES=$(grep -nE '(new Date|Date\.now|Date\.UTC)\(' "$FILE" 2>/dev/null)
if [ -n "$DATES" ]; then
    VIOLATIONS="${VIOLATIONS}\n[DATE CALL] Date construction detected (non-deterministic):\n$(echo "$DATES" | sed 's/^/  /')\n"
fi

# 3. User/session data references — must never appear in the static prompt
USER_DATA=$(grep -nE '(userId|user\.id|session\.user|currentUser|req\.)' "$FILE" 2>/dev/null)
if [ -n "$USER_DATA" ]; then
    VIOLATIONS="${VIOLATIONS}\n[USER DATA] User-specific references detected:\n$(echo "$USER_DATA" | sed 's/^/  /')\n"
fi

# 4. process.env used with || fallback — masks missing config, prefer ??
OR_FALLBACK=$(grep -nE 'process\.env\.[A-Z_]+\s*\|\|' "$FILE" 2>/dev/null)
if [ -n "$OR_FALLBACK" ]; then
    VIOLATIONS="${VIOLATIONS}\n[ENV FALLBACK] Use ?? instead of || for env vars (strict null check):\n$(echo "$OR_FALLBACK" | sed 's/^/  /')\n"
fi

if [ -n "$VIOLATIONS" ]; then
    echo ""
    echo "=== system-prompt.ts must remain STATIC for prompt caching ==="
    echo "File: $FILE"
    echo ""
    printf "%b" "$VIOLATIONS"
    echo "Dynamic content breaks Anthropic cache hits and increases cost."
    echo "Inject user context via memory tool results, not the system prompt."
    echo "See .claude/rules/ai-tools.md — System Prompt Rules."
    echo "=============================================================="
    echo ""
fi
