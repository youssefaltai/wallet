---
name: audit-typescript
description: Audit TypeScript usage for type safety, strictness, and quality.
---

# TypeScript Quality Audit

## Steps

1. Read tsconfig.json for strictness settings
2. Grep for `any` type usage — list every instance with file:line
3. Grep for `@ts-ignore` and `@ts-expect-error` comments
4. Grep for type assertions (`as X`) — categorize as safe/unsafe
5. Grep for non-null assertions (`!`) — categorize as justified/dangerous
6. Grep for `as unknown as` double-cast patterns
7. Look for `Record<string, unknown>` that could be more specific
8. Check for missing return type annotations on exported functions
9. Look for inline type annotations that should be named interfaces
10. Check for FormData.get() cast to string without null checks

## Report Format

| Category | Count | Severity |
|----------|-------|----------|
| `any` usage | N | ... |
| Unsafe `as` casts | N | ... |
| Non-null assertions | N | ... |

Each finding: file:line, code snippet, risk level, recommendation.
