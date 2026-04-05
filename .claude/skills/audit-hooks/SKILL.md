---
name: audit-hooks
description: Audit React hooks and state management patterns for correctness, performance, and consistency.
---

# Hooks & State Management Audit

## Steps

1. Read all files in src/hooks/
2. Check if custom hooks are actually used (grep for imports)
3. Look for stale closure issues (refs not synced, missing deps)
4. Check for missing loading/error states in data-fetching components
5. Look for unnecessary re-renders from bad state patterns
6. Check for missing AbortController on fetch-in-useEffect patterns
7. Analyze cache invalidation patterns (router.refresh, revalidatePath, manual state updates)
8. Look for state that should be URL-based (tabs, filters, pagination)
9. Check for fetch-without-error-handling patterns
10. Look for redundant state updates (optimistic update + router.refresh)

## Per-Component Report

- **State Variables**: What state it manages
- **Data Flow**: How data enters and exits
- **Issues**: Stale closures, missing error handling, etc.

Conclude with common anti-patterns and architecture recommendations.
