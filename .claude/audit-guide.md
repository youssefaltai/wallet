# Wallet Codebase Audit Guide

This document instructs Claude Code on how to analyze and audit the Wallet codebase — a Next.js 14+ App Router SaaS personal finance app with double-entry bookkeeping, multi-currency support, and an AI assistant (Vercel AI SDK + OpenAI). It was produced by synthesizing four independent research/audit agents against the live codebase.

---

## Codebase Map

```
src/
  app/
    (app)/              # Protected routes — all require auth
      actions.ts        # All Server Actions live here
      dashboard/
      accounts/
      budgets/
      goals/
      transactions/     # Combined transaction list with filters
      expenses/         # Expense-specific view
      income/           # Income-specific view
      settings/
      chat/
    (auth)/             # Unauthenticated routes
    api/
      auth/             # [nextauth], signup, verify-email, send-verification, user-email
      chat/route.ts     # Core AI streaming endpoint
      conversations/
      settings/         # account, profile, chats, memories
  lib/
    ai/
      system-prompt.ts
      tools/
        financial-read.ts   # Query tools (get_accounts, get_net_worth, etc.)
        financial-write.ts  # Mutation tools (create_transaction, fund_goal, etc.)
        memory.ts           # Memory CRUD tools
        settings.ts         # Delete account/chats/memories tools
        amount-schemas.ts   # Shared Zod schemas for monetary amounts (import, don't duplicate)
    auth.ts             # NextAuth v5 config + cachedAuth()
    db/
      schema.ts         # Drizzle ORM schema (13 tables)
      migrations/       # SQL migration files
    services/           # Business logic — all DB access goes here
      accounts.ts
      budgets.ts
      categories.ts
      conversations.ts
      fx-rates.ts
      goals.ts
      ledger.ts         # Double-entry engine
      memories.ts
      money.ts          # toMinorUnits, toMajorUnits, formatMoney, convert
      transactions.ts
      users.ts
      email.ts
  components/
    chat/tool-cards/    # UI cards rendered for each AI tool result
    shared/             # Reusable form components
    settings/
    layout/
  hooks/
    use-cross-currency.ts
    use-chat-mutations.ts
```

---

## How to Audit This Codebase

### 1. Authentication & Authorization

**What to verify:**
- Every API route handler calls `auth()` at the very top before any logic.
- Every Server Action calls `getAuthUserId()` or `getAuthUser()` before any data access.
- The NextAuth `authorized` callback in `src/lib/auth.ts` (lines 64–83) handles route-level protection.
- Service functions always accept and use `userId` in their WHERE clauses.
- Ownership checks are done at the service layer, not just the API layer.

**Patterns to look for (bugs):**
- Route handler with `const session = auth()` missing `if (!session) return 401`
- Service functions that query by `id` only without `AND user_id = $userId`
- `as string` casts on JWT fields without runtime guards

### 2. Double-Entry Accounting Correctness

**What to verify:**
- Balances are always derived from `SUM(journal_lines.amount)` — never stored as a running column.
- `createJournalEntry()` enforces the zero-sum invariant (debits + credits = 0).
- All multi-step writes (create account + opening balance, fund goal, etc.) are wrapped in `db.transaction()`.
- The `Tx` type is propagated correctly through nested service calls.
- Idempotency keys prevent duplicate entries from AI tool retries.

**Patterns to look for (bugs):**
- Code that bypasses `createJournalEntry()` and inserts directly into `journal_lines`
- Missing `db.transaction()` around any operation that writes to multiple tables
- The TOCTOU pattern: `SELECT balance → compute → INSERT correction` without `SELECT FOR UPDATE`
- Goal backing account fetched without `userId` filter
- No DB-level `CHECK` constraint enforcing zero-sum per `journal_entry_id`

### 3. Multi-Currency & Money Handling

**What to verify:**
- All persistence uses `bigint` minor units — no floats ever stored.
- `toMinorUnits()` uses `Math.round()` after float arithmetic.
- `getMinorUnitFactor(currency)` is used consistently everywhere.
- Cross-currency writes require user-provided amounts (no silent auto-conversion).
- `canConvert()` / `tryConvert()` are used where rate absence is possible.

**Patterns to look for (bugs):**
- `amount * exchangeRate` without subsequent `toMinorUnits()` rounding
- Direct float storage in any DB column representing money
- `parseFloat` on user-provided amount strings without validation
- Currency codes accepted as raw strings without ISO 4217 validation

### 4. AI/LLM Integration

**What to verify:**
- AI tools close over `userId` from the session — the LLM cannot pass a different `userId`.
- Tool `execute()` functions always wrap in try/catch and return `{ success: false, error }` on failure.
- Zod schemas on tool inputs have explicit `.min()`, `.max()`, `.regex()` bounds.
- The `moneyInput` schema rejects zero and negative values.
- Memory content is escaped before injection into the system prompt.
- The streaming endpoint has rate limiting, max payload size, and max steps.

**Patterns to look for (bugs):**
- Tool input fields with `z.string().optional()` and no `.regex()` for date fields
- Tool input fields with `z.string().min(1)` missing (allows empty string updates)
- Idempotency keys accepted as free-form strings without UUID format enforcement
- `onFinish` callback errors logged but not tracked
- Memory XML injection via `<memory>` tag structure
- Destructive tools (delete_*) with no confirmation pattern
- `process.env.AI_MODEL || "fallback"` using `||` instead of `??`

### 5. API Routes

**What to verify:**
- Every HTTP method on every route has rate limiting where appropriate.
- All routes validate input (UUID format, type, length).
- Error responses use appropriate HTTP status codes.
- No route exposes stack traces to the client.

**Patterns to look for (bugs):**
- Route file where only `DELETE` has `rateLimit()` but `GET` does not
- `FormData.get("field") as string` without null check
- `as unknown as SomeType` double-cast bypassing type safety

### 6. Database Schema & Migrations

**What to verify:**
- Migration journal (`_journal.json`) entries match the actual SQL files.
- No two migration files share the same `NNNN_` prefix.
- No SQL files exist that are not tracked in the journal.
- All FK columns have corresponding indexes.
- Enum-like columns use PG enums or CHECK constraints exposed to TypeScript.

**Patterns to look for (bugs):**
- Duplicate migration prefix (e.g., two `0004_*` files)
- SQL files outside the journal (hand-written data migrations)
- FK columns with no index
- `text()` column with CHECK constraint instead of `pgEnum`

### 7. React & Next.js

**What to verify:**
- No DB imports leak into `"use client"` files.
- Server Components use `cachedAuth()` (the React `cache()` wrapper), not raw `auth()`.
- Server Actions use `cachedAuth()` too.
- `useEffect` hooks that fire fetches have `AbortController` cleanup.
- `Promise.all` is used for independent parallel data fetches in Server Components.

**Patterns to look for (bugs):**
- `useEffect(() => { fetch(...) }, [])` without `return () => controller.abort()`
- `import { auth } from "@/lib/auth"` in actions.ts instead of `cachedAuth`
- Sequential `await` calls in a Server Component that could be parallelized

### 8. TypeScript Quality

**What to verify:**
- `strict: true` is enabled in tsconfig.json.
- No `: any` type annotations.
- No `@ts-ignore` suppressions.
- JWT type extensions use module augmentation, not runtime casts.

**Patterns to look for (bugs):**
- `formData.get("x") as string` without `?? ""` or null check
- `token.someField as string` in auth callbacks
- `as unknown as SomeType` bypassing type safety

### 9. Performance

**What to verify:**
- Dashboard uses `Promise.all` for parallel fetches.
- Balance queries use `GROUP BY` with `inArray` batching, not per-row queries.
- List queries have `.limit()`.
- Hot-path columns have indexes.

**Patterns to look for (bugs):**
- Two separate SELECT queries that could be one JOIN
- Per-item DB lookups inside a loop (classic N+1)
- Missing index on FK column used in WHERE clauses

### 10. Security Misconfiguration

**What to verify:**
- CSP headers do not use `unsafe-inline` for scripts.
- Rate limiting exists on all write routes and on GET routes that could be scraped.
- Profile images are not stored as base64 blobs in the users table.

---

## Audit Checklist

When auditing any service file:
- [ ] Does every function scope its queries to `userId`?
- [ ] Are multi-step writes wrapped in `db.transaction()`?
- [ ] Are zero-sum invariants checked before inserting journal lines?
- [ ] Is there a SELECT before a conditional INSERT that needs `FOR UPDATE`?

When auditing any API route:
- [ ] Does every HTTP method check auth?
- [ ] Does every write method call `rateLimit()`?
- [ ] Does every GET that returns user data also call `rateLimit()`?
- [ ] Are all inputs validated (UUID, type, length)?

When auditing any AI tool:
- [ ] Are all date fields using `.regex(/^\d{4}-\d{2}-\d{2}$/)`?
- [ ] Are idempotency key fields using `.uuid()`?
- [ ] Does the `execute()` function close over `userId`?
- [ ] Does the `execute()` function wrap in try/catch and return structured error?

When auditing migrations:
- [ ] Does every SQL file appear in `_journal.json`?
- [ ] Are there any duplicate `NNNN_` prefixes?
- [ ] Does the latest snapshot match `schema.ts`?

---

## Known Open Issues

These are tracked in Linear. Check current state there before working in these areas.

### Overdraft prevention / TOCTOU race on balance checks

**Area:** `src/lib/services/goals.ts`, `src/lib/services/accounts.ts`, `src/lib/services/ledger.ts`

Any operation that reads a balance and then writes a journal entry based on it (fund goal, transfer, withdraw) is vulnerable to a TOCTOU race. Two concurrent requests can both pass the balance check and both commit, overdrawing the account.

**Fix:** Wrap the balance-check + journal-entry creation in a transaction with `SELECT FOR UPDATE` on the account row.

**Status:** RESOLVED (2026-04-09, WALLET-5). `getBalanceInTx()` in `goals.ts` and `transactions.ts` issues `SELECT id FROM accounts WHERE id = $accountId FOR UPDATE` to lock the account row first (PostgreSQL does not allow `FOR UPDATE` on aggregate queries), then computes the balance from `journal_lines` in a separate query. This serializes concurrent balance-check + debit operations on the same account. `withdrawFromGoal()` also received the same balance check + lock that `fundGoal()` had.

### `batchFundGoals()` uses cached FX rates on the write path

**File:** `src/lib/services/goals.ts` — `batchFundGoals()` function

This is the only remaining write-path use of cached exchange rates. It was explicitly left out of scope during the 2026-04-02 cross-currency fix pass.

**Fix:** Require per-item explicit amounts (source amount + credit amount) rather than auto-converting via cached rates.

**Status:** Not yet implemented. `batchFundGoals()` must not be exposed to users with multi-currency accounts until this is fixed.
