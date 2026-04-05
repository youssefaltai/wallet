---
paths:
  - "src/app/(app)/actions.ts"
---

# Server Actions Rules

`src/app/(app)/actions.ts` is the single file containing all Next.js Server Actions. It is a large, high-traffic file — read it fully before making any change.

## Auth Pattern

Every server action must use `cachedAuth()` (not raw `auth()`) and validate the session before any data access:

```typescript
'use server'

import { cachedAuth } from '@/lib/auth'

export async function myAction(formData: FormData) {
  const session = await cachedAuth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  const userId = session.user.id

  // ... call services
}
```

Never use raw `auth()` — it re-validates on every call. `cachedAuth()` is deduplicated within a single render/request tree.

## Call Services, Not DB

Server actions must never query the database directly. All data access goes through `src/lib/services/`:

```typescript
// ✓ Correct
const accounts = await getAccounts(db, userId)

// ✗ Wrong — direct DB access
const accounts = await db.select().from(schema.accounts).where(...)
```

## Financial Invariants

Any server action that touches money (accounts, transactions, goals, budgets) must follow all rules in `.claude/rules/financial-invariants.md`. In particular:
- Balance changes go through `ledger.ts` via service functions
- Never call `db.update(accounts)` or `db.insert(journalLines)` directly

## Error Handling

Server actions that are called from forms should use Next.js's `useActionState` / previous state pattern. Throw for unrecoverable errors (auth failure), return error shapes for validation failures:

```typescript
export async function createAccountAction(
  prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  try {
    const session = await cachedAuth()
    if (!session?.user?.id) return { error: 'Unauthorized' }
    // ...
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Something went wrong' }
  }
}
```

## Revalidation

After mutations, revalidate the correct Next.js cache paths:

```typescript
import { revalidatePath } from 'next/cache'

revalidatePath('/accounts')        // specific page
revalidatePath('/', 'layout')      // entire app (use sparingly)
```

Only revalidate paths that actually display the mutated data. Over-revalidating causes unnecessary cache misses.

## Keep Actions Thin

Server actions are entry points, not business logic. They should:
1. Authenticate
2. Parse and validate input
3. Call a service function
4. Revalidate + return

Business logic belongs in `src/lib/services/`, not in `actions.ts`.
