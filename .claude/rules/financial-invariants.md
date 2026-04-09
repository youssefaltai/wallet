---
paths:
  - "src/lib/services/**"
  - "src/lib/ai/tools/**"
  - "src/app/(app)/actions.ts"
  - "src/app/api/**"
---

# Financial Invariants

These rules apply to every change in services, AI tools, server actions, and API routes. Violating any of them is a correctness bug, regardless of how the rest of the code looks.

## 1. All balance mutations go through ledger.ts

`src/lib/services/ledger.ts` is the single source of truth for all money movement. Never insert into `journalLines` or update account balances directly from services or tools.

```
✓  await createJournalEntry(db, { ... lines })
✗  await db.insert(journalLines).values(...)
✗  await db.update(accounts).set({ balance: newBalance })
```

## 2. Every journal entry must be zero-sum

The sum of all debit amounts must equal the sum of all credit amounts within a single journal entry. This is enforced at application layer (no DB-level CHECK constraint yet — tracked as a known open issue in `.claude/audit-guide.md`).

Before creating any journal entry with custom lines, verify:
```typescript
const debits = lines.filter(l => l.type === 'debit').reduce((s, l) => s + l.amount, 0n)
const credits = lines.filter(l => l.type === 'credit').reduce((s, l) => s + l.amount, 0n)
assert(debits === credits, 'Journal entry must be zero-sum')
```

## 3. No cached FX rates on write operations

`src/lib/services/fx-rates.ts` cached rates are for read-side aggregation ONLY (dashboards, net worth, summaries). They must never be used to determine how much to debit or credit in a transaction.

For any cross-currency write, the user must explicitly provide at least 2 of 3 values:
- `amount` (source currency)
- `creditAmount` (target currency)
- `exchangeRate`

If all 3 are provided, derive the rate from the two amounts and ignore the provided rate.

```
✓  record expense with user-provided amount in their account currency
✗  auto-convert using today's cached FX rate to fill in a missing amount
```

**Known exception (unresolved):** `batchFundGoals()` in `src/lib/services/goals.ts` still uses cached FX rates on the write path. This was intentionally left out of scope during the 2026-04-02 cross-currency fix pass. It must be fixed before batch goal funding is exposed to users with multi-currency accounts.

## 4. Integer minor units in the database

All monetary amounts are stored as integers representing the smallest currency unit (cents for USD/EGP, pence for GBP, etc.).

```
✓  500  // $5.00 stored as 500 cents
✗  5.00 // never store floats in the database
```

Convert at service boundaries only:
```typescript
import { toMinorUnits, toMajorUnits } from '@/lib/services/money'

// Tool input → DB: toMinorUnits(amount, currency)
// DB → display/AI: toMajorUnits(amount, currency)
```

Do not do arithmetic on major units. Do not mix major and minor units in the same calculation.

## 5. Journal entries are append-only

Correcting a transaction means:
1. Create a reversal entry (mirror of the original with swapped debit/credit)
2. Create a new entry with the correct values

Never call `deleteJournalEntry` unless explicitly cleaning up an error state before the transaction is visible to the user. The `deletedAt` soft-delete is for hiding entries from the UI, not for financial corrections.

## 6. Every query must scope to userId

Every service function receives a `userId` parameter. Every query that touches user data must include a `WHERE userId = $userId` condition (or equivalent `eq(table.userId, userId)` in Drizzle).

There are no shared accounts, shared goals, or shared budgets. Every row belongs to exactly one user.

```typescript
✓  where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
✗  where(eq(accounts.id, accountId))  // no userId filter — authorization hole
```

## 7. Overdraft prevention

For goal funding and transfers between accounts: verify the source account has sufficient balance BEFORE creating the journal entry, using a SELECT FOR UPDATE to prevent TOCTOU races.

`getBalanceInTx()` in both `goals.ts` and `transactions.ts` implements this correctly. It must be used for any new code that checks a balance and then debits it.

```typescript
// Inside db.transaction():
const balance = await getBalanceInTx(tx, accountId); // locks account row FOR UPDATE, then reads balance
if (balance - debitAmount < 0n) throw new Error("Insufficient balance");
await createJournalEntry(userId, date, desc, null, lines, tx); // commits while lock held
```

`getBalanceInTx()` uses `SELECT id FROM accounts WHERE id = $accountId FOR UPDATE` to lock the account row first (PostgreSQL does not allow `FOR UPDATE` on aggregate queries), then computes the balance from `journal_lines` in a separate query. The lock is released when the surrounding `db.transaction()` commits or rolls back.

## 8. Destructive AI operations require confirmation

Before executing any AI tool that deletes financial records (`delete_transaction`, `delete_goal`, etc.), the system prompt instructs the AI to confirm with the user. When writing new destructive tools, follow the same pattern: confirm intent before executing.
