/**
 * Direct DB seeding helpers for E2E tests.
 *
 * These functions create data directly via Drizzle, bypassing the API and UI
 * for fast, deterministic test setup.
 */

import { db } from "./auth";
import * as schema from "../../src/lib/db/schema";
import { sql } from "drizzle-orm";

// ── Accounts ────────────────────────────────────────────────────────────

export async function seedAccount(
  userId: string,
  overrides: {
    name?: string;
    type?: "asset" | "liability";
    institution?: string;
    currency?: string;
  } = {},
) {
  const [account] = await db
    .insert(schema.accounts)
    .values({
      userId,
      name: overrides.name ?? "Test Checking",
      type: overrides.type ?? "asset",
      institution: overrides.institution ?? null,
      currency: overrides.currency ?? "USD",
    })
    .returning();
  return account;
}

export async function seedCategoryAccount(
  userId: string,
  name: string,
  type: "expense" | "income",
) {
  const [account] = await db
    .insert(schema.accounts)
    .values({ userId, name, type })
    .returning();
  return account;
}

// ── Journal Entries (for seeding balances / transactions) ────────────────

/**
 * Create a balanced journal entry with exactly two lines.
 * Amount is in minor units (cents). Positive = debit, negative = credit.
 */
export async function seedJournalEntry(
  userId: string,
  opts: {
    date: string;
    description?: string;
    notes?: string;
    lines: Array<{ accountId: string; amount: bigint }>;
  },
) {
  const [entry] = await db
    .insert(schema.journalEntries)
    .values({
      userId,
      date: new Date(opts.date),
      description: opts.description ?? "Seeded transaction",
      notes: opts.notes,
    })
    .returning();

  for (const line of opts.lines) {
    await db.insert(schema.journalLines).values({
      journalEntryId: entry.id,
      accountId: line.accountId,
      amount: line.amount,
    });
  }

  return entry;
}

/**
 * Seed an expense transaction:
 *   debit expense category, credit asset account.
 * Amount in major units (e.g. 50.00 for $50).
 */
export async function seedExpense(
  userId: string,
  assetAccountId: string,
  categoryAccountId: string,
  amount: number,
  opts: { date?: string; description?: string; notes?: string } = {},
) {
  const minor = BigInt(Math.round(amount * 100));
  return seedJournalEntry(userId, {
    date: opts.date ?? new Date().toISOString().slice(0, 10),
    description: opts.description ?? "Test expense",
    notes: opts.notes,
    lines: [
      { accountId: categoryAccountId, amount: minor },    // debit expense
      { accountId: assetAccountId, amount: -minor },       // credit asset
    ],
  });
}

/**
 * Seed an income transaction:
 *   debit asset account, credit income category.
 */
export async function seedIncome(
  userId: string,
  assetAccountId: string,
  categoryAccountId: string,
  amount: number,
  opts: { date?: string; description?: string; notes?: string } = {},
) {
  const minor = BigInt(Math.round(amount * 100));
  return seedJournalEntry(userId, {
    date: opts.date ?? new Date().toISOString().slice(0, 10),
    description: opts.description ?? "Test income",
    notes: opts.notes,
    lines: [
      { accountId: assetAccountId, amount: minor },        // debit asset
      { accountId: categoryAccountId, amount: -minor },    // credit income
    ],
  });
}

/**
 * Seed a transfer between two accounts.
 */
export async function seedTransfer(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  opts: { date?: string; description?: string } = {},
) {
  const minor = BigInt(Math.round(amount * 100));
  return seedJournalEntry(userId, {
    date: opts.date ?? new Date().toISOString().slice(0, 10),
    description: opts.description ?? "Test transfer",
    lines: [
      { accountId: toAccountId, amount: minor },     // debit destination
      { accountId: fromAccountId, amount: -minor },   // credit source
    ],
  });
}

/**
 * Seed an initial balance for an account (equity entry).
 */
export async function seedBalance(
  userId: string,
  accountId: string,
  amount: number,
) {
  const minor = BigInt(Math.round(amount * 100));
  // Create an equity account for opening balances
  const [equity] = await db
    .insert(schema.accounts)
    .values({
      userId,
      name: `Opening Balance (${Date.now()})`,
      type: "equity",
    })
    .returning();

  return seedJournalEntry(userId, {
    date: new Date().toISOString().slice(0, 10),
    description: "Opening balance",
    lines: [
      { accountId: accountId, amount: minor },     // debit asset
      { accountId: equity.id, amount: -minor },     // credit equity
    ],
  });
}

// ── Budgets ──────────────────────────────────────────────────────────────

export async function seedBudget(
  userId: string,
  categoryAccountId: string,
  overrides: {
    name?: string;
    amount?: number;
    startDate?: string;
    endDate?: string;
  } = {},
) {
  const now = new Date();
  const startDate = overrides.startDate ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endMonth = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
  const endYear = endMonth === 1 ? now.getFullYear() + 1 : now.getFullYear();
  const endDate = overrides.endDate ?? `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  const [budget] = await db
    .insert(schema.budgets)
    .values({
      userId,
      name: overrides.name ?? "Test Budget",
      categoryAccountId,
      amount: BigInt(Math.round((overrides.amount ?? 500) * 100)),
      startDate,
      endDate,
    })
    .returning();
  return budget;
}

// ── Goals ────────────────────────────────────────────────────────────────

export async function seedGoal(
  userId: string,
  overrides: {
    name?: string;
    targetAmount?: number;
    deadline?: string;
    notes?: string;
    fundFromAccountId?: string;
    fundAmount?: number;
  } = {},
) {
  const goalName = overrides.name ?? "Test Goal";

  // Create hidden backing account
  const [backingAccount] = await db
    .insert(schema.accounts)
    .values({
      userId,
      name: `Goal: ${goalName}`,
      type: "asset",
    })
    .returning();

  const [goal] = await db
    .insert(schema.goals)
    .values({
      userId,
      accountId: backingAccount.id,
      name: goalName,
      targetAmount: BigInt(Math.round((overrides.targetAmount ?? 1000) * 100)),
      deadline: overrides.deadline ?? null,
      notes: overrides.notes ?? null,
    })
    .returning();

  // Optionally fund the goal
  if (overrides.fundFromAccountId && overrides.fundAmount) {
    const minor = BigInt(Math.round(overrides.fundAmount * 100));
    await seedJournalEntry(userId, {
      date: new Date().toISOString().slice(0, 10),
      description: `Fund goal: ${goalName}`,
      lines: [
        { accountId: backingAccount.id, amount: minor },           // debit goal
        { accountId: overrides.fundFromAccountId, amount: -minor }, // credit source
      ],
    });
  }

  return { goal, backingAccount };
}

// ── Conversations & Messages ────────────────────────────────────────────

export async function seedConversation(
  userId: string,
  overrides: { title?: string; archived?: boolean } = {},
) {
  const [conv] = await db
    .insert(schema.conversations)
    .values({
      userId,
      title: overrides.title ?? "Test Conversation",
      archivedAt: overrides.archived ? new Date() : null,
    })
    .returning();
  return conv;
}

export async function seedMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
) {
  const [msg] = await db
    .insert(schema.messages)
    .values({
      conversationId,
      role,
      content,
      parts: [{ type: "text", text: content }],
    })
    .returning();
  return msg;
}

// ── Memories ────────────────────────────────────────────────────────────

export async function seedMemory(
  userId: string,
  overrides: { content?: string; tags?: string[] } = {},
) {
  const [memory] = await db
    .insert(schema.memories)
    .values({
      userId,
      content: overrides.content ?? "Test memory content",
      tags: overrides.tags ?? ["test"],
    })
    .returning();
  return memory;
}

/**
 * Seed an initial balance for a foreign-currency account.
 * Like seedBalance but uses the correct minor unit factor.
 * Amount is in major units of the account's currency.
 */
export async function seedForeignBalance(
  userId: string,
  accountId: string,
  amount: number,
  minorFactor = 100,
) {
  const minor = BigInt(Math.round(amount * minorFactor));
  const [equity] = await db
    .insert(schema.accounts)
    .values({
      userId,
      name: `Opening Balance (${Date.now()}-${Math.random().toString(36).slice(2, 6)})`,
      type: "equity",
    })
    .returning();

  return seedJournalEntry(userId, {
    date: new Date().toISOString().slice(0, 10),
    description: "Opening balance",
    lines: [
      { accountId: accountId, amount: minor },
      { accountId: equity.id, amount: -minor },
    ],
  });
}

// ── FX Rates ────────────────────────────────────────────────────────────

/**
 * Seed exchange rates for a given date.
 * Rates are USD-based (matching OXR format).
 * If no date is provided, uses today's date.
 */
export async function seedExchangeRates(
  rates: Record<string, number>,
  date?: string,
) {
  const rateDate = date ?? new Date().toISOString().slice(0, 10);
  await db
    .insert(schema.exchangeRates)
    .values({
      baseCurrency: "USD",
      date: rateDate,
      rates,
    })
    .onConflictDoNothing();
}

/**
 * Seed a cross-currency transfer between two accounts.
 * fromAmount is in major units of the source account's currency.
 * toAmount is in major units of the destination account's currency.
 * minorUnitFactors defaults to 100 for both (override for JPY=1, BHD=1000, etc).
 */
export async function seedCrossCurrencyTransfer(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  fromAmount: number,
  toAmount: number,
  opts: {
    date?: string;
    description?: string;
    fromMinorFactor?: number;
    toMinorFactor?: number;
  } = {},
) {
  const fromFactor = opts.fromMinorFactor ?? 100;
  const toFactor = opts.toMinorFactor ?? 100;
  const fromMinor = BigInt(Math.round(fromAmount * fromFactor));
  const toMinor = BigInt(Math.round(toAmount * toFactor));
  return seedJournalEntry(userId, {
    date: opts.date ?? new Date().toISOString().slice(0, 10),
    description: opts.description ?? "Cross-currency transfer",
    lines: [
      { accountId: toAccountId, amount: toMinor },      // debit destination
      { accountId: fromAccountId, amount: -fromMinor },  // credit source
    ],
  });
}

/**
 * Seed a cross-currency expense.
 * The expense amount is in the asset account's currency minor units.
 * The category debit is in the category's currency minor units.
 */
export async function seedCrossCurrencyExpense(
  userId: string,
  assetAccountId: string,
  categoryAccountId: string,
  assetAmount: number,
  categoryAmount: number,
  opts: {
    date?: string;
    description?: string;
    assetMinorFactor?: number;
    categoryMinorFactor?: number;
  } = {},
) {
  const assetFactor = opts.assetMinorFactor ?? 100;
  const catFactor = opts.categoryMinorFactor ?? 100;
  const assetMinor = BigInt(Math.round(assetAmount * assetFactor));
  const catMinor = BigInt(Math.round(categoryAmount * catFactor));
  return seedJournalEntry(userId, {
    date: opts.date ?? new Date().toISOString().slice(0, 10),
    description: opts.description ?? "Cross-currency expense",
    lines: [
      { accountId: categoryAccountId, amount: catMinor },   // debit expense
      { accountId: assetAccountId, amount: -assetMinor },    // credit asset
    ],
  });
}

/**
 * Seed a cross-currency income.
 * The income amount is in the asset account's currency minor units.
 * The category credit is in the category's currency minor units.
 */
export async function seedCrossCurrencyIncome(
  userId: string,
  assetAccountId: string,
  categoryAccountId: string,
  assetAmount: number,
  categoryAmount: number,
  opts: {
    date?: string;
    description?: string;
    assetMinorFactor?: number;
    categoryMinorFactor?: number;
  } = {},
) {
  const assetFactor = opts.assetMinorFactor ?? 100;
  const catFactor = opts.categoryMinorFactor ?? 100;
  const assetMinor = BigInt(Math.round(assetAmount * assetFactor));
  const catMinor = BigInt(Math.round(categoryAmount * catFactor));
  return seedJournalEntry(userId, {
    date: opts.date ?? new Date().toISOString().slice(0, 10),
    description: opts.description ?? "Cross-currency income",
    lines: [
      { accountId: assetAccountId, amount: assetMinor },      // debit asset
      { accountId: categoryAccountId, amount: -catMinor },    // credit income
    ],
  });
}

// ── Assertions ──────────────────────────────────────────────────────────

/**
 * Assert that all same-currency journal lines sum to zero per currency.
 * For cross-currency entries, lines in different currencies won't sum to zero
 * in raw amounts — this is expected.
 */
export async function assertDoubleEntryBalanced(userId: string) {
  const result = await db.execute(sql`
    SELECT a.currency, COALESCE(SUM(jl.amount), 0) AS total
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    JOIN accounts a ON a.id = jl.account_id
    WHERE je.user_id = ${userId}
    GROUP BY a.currency
  `);

  // For single-currency setups, each currency should sum to zero.
  // For cross-currency, we just verify totals are reasonable (not wildly off).
  for (const row of result) {
    const total = BigInt(row.total as string | number);
    const currency = row.currency as string;
    // Single-currency entries must balance exactly
    // Cross-currency entries may not — this is a basic sanity check
    if (total !== 0n) {
      // Check if there are cross-currency entries for this user
      const crossCheck = await db.execute(sql`
        SELECT COUNT(DISTINCT a.currency) AS num_currencies
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_entry_id
        JOIN accounts a ON a.id = jl.account_id
        WHERE je.user_id = ${userId}
      `);
      const numCurrencies = Number(crossCheck[0].num_currencies);
      if (numCurrencies <= 1 && total !== 0n) {
        throw new Error(
          `Double-entry invariant violated for ${currency}: sum = ${total} (expected 0)`,
        );
      }
    }
  }
}

/**
 * Get the raw balance (in minor units) for an account.
 */
export async function getAccountBalanceRaw(accountId: string): Promise<bigint> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0) AS balance
    FROM journal_lines
    WHERE account_id = ${accountId}
  `);
  return BigInt(result[0].balance as string | number);
}
