---
paths:
  - "src/lib/services/**"
---

# Service Layer Rules

Rules for writing and modifying service functions in `src/lib/services/`.

## What the Service Layer Is

The service layer is the only place where database access happens. No query lives in API routes, server actions, or AI tools. Every function in this directory receives a `db` instance and a `userId`.

## Function Signature Pattern

```typescript
export async function doSomething(
  db: PostgresJsDatabase,
  userId: string,
  params: { ... }
): Promise<Result> {
  // 1. Validate ownership of any referenced entities
  // 2. Execute business logic
  // 3. Return typed result
}
```

## Rules

> **Financial invariants** (ledger, zero-sum, FX rates, overdraft prevention, append-only entries) are defined in `.claude/rules/financial-invariants.md`. Both rule files are loaded together when editing services — consult that file for the full set.

**1. userId is always the second parameter.** Every function that touches user data takes `userId` as its second positional argument. This makes it visually obvious when a function is missing auth scoping.

**2. Validate ownership before operating.** When a function operates on a resource (account, goal, budget), fetch it first and verify `resource.userId === userId`. Don't rely on the caller to have done this.

**3. Transactions for multi-step operations.** Any operation that writes to multiple tables must use `db.transaction()`. If one step fails, all steps roll back.

```typescript
await db.transaction(async (tx) => {
  await createJournalEntry(tx, { ... })
  await updateGoalStatus(tx, userId, goalId, { ... })
})
```

**4. Return domain objects, not raw DB rows.** Convert amounts with `toMajorUnits()` before returning. Services should return values in the same units they'd display to a user.

**5. Soft-delete on financial records.** Journal entries use `deletedAt`. Never hard-delete a journal entry. Use `isNull(journalEntries.deletedAt)` in all queries that list entries.

**6. No business logic in `ledger.ts`.** `ledger.ts` is a pure engine — it creates entries and computes balances. The logic of WHAT to debit and credit belongs in the calling service (accounts.ts, goals.ts, transactions.ts, etc.).

## Error Handling

Service functions should throw errors with descriptive messages. The caller (API route or AI tool) handles the error display.

```typescript
throw new Error('Account not found or does not belong to this user')
throw new Error('Insufficient balance for this withdrawal')
```

Don't return null/undefined for "not found" cases when the caller has passed a supposedly-valid ID — throw.
