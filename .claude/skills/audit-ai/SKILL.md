---
name: audit-ai
description: Audit AI/LLM integration for security, error handling, tool quality, and cost management.
---

# AI Integration Audit

## Steps

1. Read all files in src/lib/ai/ and src/components/chat/
2. Read the chat API route
3. Check for prompt injection vulnerabilities (user content in system prompt)
4. Check all tool definitions for proper Zod validation (min/max bounds, regex)
5. Check all tool execute functions for try-catch error handling
6. Look for hardcoded model names that should be configurable
7. Check streaming handling for timeouts and error propagation
8. Verify tool output is validated before rendering in UI
9. Check for token/cost management (tracking, limits, quotas)
10. Look for security issues in how memories are stored and injected

## Report Categories

- **Security**: Prompt injection, data exposure, unsafe rendering
- **Validation**: Missing input bounds, type safety gaps
- **Error Handling**: Unhandled failures, silent errors
- **Cost/Performance**: Token waste, missing caching, no rate limits
- **Architecture**: Hardcoded values, missing abstractions
