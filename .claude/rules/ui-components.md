---
paths:
  - "src/app/(app)/**"
  - "src/components/**"
  - "src/hooks/**"
---

# UI & Component Rules

Rules for React components, Next.js App Router patterns, and UI conventions in this codebase.

## Dashboard is Read-Only

The dashboard (`src/app/(app)/dashboard/`) is a summary view only. It must never contain:
- Mutation buttons (Quick Fund, Quick Pay, Add, Edit, Delete, etc.)
- Dialogs or forms that modify data
- Any action that triggers a server action or API write

Mutations belong on the dedicated resource pages: `accounts/`, `goals/`, `budgets/`, `transactions/`. If you need to add an action button, put it there — not on the dashboard card.

This is a product decision made explicitly by the user. Do not add mutation UI to dashboard regardless of how convenient it seems.

## Server vs Client Component Boundaries

- **Server Components** (no `"use client"` directive): can import from `src/lib/db/`, `src/lib/services/`, `src/lib/auth.ts`. Use for data fetching.
- **Client Components** (`"use client"` at top): must never import from `src/lib/db/`, `src/lib/services/`, or `src/lib/auth.ts`. Any data they need must be passed as props from a parent Server Component.

Importing DB or service modules in a Client Component leaks server-only code to the browser bundle. TypeScript may not catch this — the Next.js compiler will, but only at build time.

## cachedAuth() in Server Components and Actions

Always use `cachedAuth()` (the React `cache()` wrapper in `src/lib/auth.ts`) instead of the raw `auth()` function in:
- Server Components
- Server Actions (`src/app/(app)/actions.ts`)

Raw `auth()` re-validates the session on every call. `cachedAuth()` deduplicates across the render tree. Using raw `auth()` is a performance bug.

```typescript
// ✓ Correct
import { cachedAuth } from '@/lib/auth'
const session = await cachedAuth()

// ✗ Wrong — re-validates every call
import { auth } from '@/lib/auth'
const session = await auth()
```

## useEffect Data Fetch Cleanup

Every `useEffect` that starts a fetch must return a cleanup function with `AbortController`:

```typescript
useEffect(() => {
  const controller = new AbortController()
  fetch('/api/...', { signal: controller.signal })
    .then(...)
    .catch(err => { if (err.name !== 'AbortError') console.error(err) })
  return () => controller.abort()
}, [dependency])
```

Missing cleanup causes state updates on unmounted components and wasted requests when the user navigates away.

## Parallel Data Fetching in Server Components

When a Server Component needs multiple independent pieces of data, fetch them in parallel:

```typescript
// ✓ Correct — parallel
const [accounts, goals] = await Promise.all([
  getAccounts(db, userId),
  getGoals(db, userId),
])

// ✗ Wrong — sequential, twice as slow
const accounts = await getAccounts(db, userId)
const goals = await getGoals(db, userId)
```

Only serialize awaits when the second fetch depends on the first result.

## Tool Card Components

AI tool result cards live in `src/components/chat/tool-cards/`. Each card:
- Receives the typed tool result as props
- Is purely presentational — no data fetching, no mutations
- Should handle the error state (`result.error`) gracefully
- Must not call server actions or API routes directly
