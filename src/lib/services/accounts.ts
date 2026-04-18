/**
 * Account service.
 *
 * "Accounts" in the user-facing sense are rows in the unified accounts table
 * with type = 'asset' or 'liability'. The same table also holds expense/income
 * categories and equity accounts, but this service only deals with the
 * asset/liability slice.
 *
 * Balances are computed on the fly from journal_lines — nothing is stored.
 * Each account has its own currency. For aggregation across currencies,
 * callers use the FX service to convert to the user's base currency.
 */

import { db } from "@/lib/db";
import { accounts, goals, journalLines, journalEntries } from "@/lib/db/schema";
import type { ledgerAccountType } from "@/lib/db/schema";
import { eq, and, notInArray, or, sql, isNull } from "drizzle-orm";
import { getAccountBalances, createJournalEntry, type Tx } from "./ledger";
import { toMajorUnits, toMinorUnits, formatMoney } from "./money";

type LedgerAccountType = (typeof ledgerAccountType.enumValues)[number];

/** The two account types visible to users. */
export type AccountType = "asset" | "liability";

/** Check whether an account type string is a liability. */
export function isLiability(type: string): boolean {
  return type === "liability";
}

export interface CreateAccountInput {
  userId: string;
  name: string;
  type: AccountType;
  institution?: string;
  currency?: string; // ISO 4217, defaults to user's base currency (caller provides)
  initialBalance?: number; // major units; if > 0, creates an opening balance via equity
}

const OPENING_BALANCE_EQUITY = "Opening Balance Equity";

async function getOrCreateEquityAccount(
  userId: string,
  currency: string,
  tx: Tx,
) {
  return getOrCreateAccount(userId, OPENING_BALANCE_EQUITY, "equity", currency, tx);
}

export async function createAccount(input: CreateAccountInput, tx?: Tx) {
  const currency = input.currency ?? "USD";
  const hasInitialBalance = input.initialBalance != null && input.initialBalance > 0;

  if (!hasInitialBalance) {
    // Simple path: just create the account
    const conn = tx ?? db;
    const [account] = await conn
      .insert(accounts)
      .values({
        userId: input.userId,
        name: input.name,
        type: input.type,
        institution: input.institution ?? null,
        currency,
      })
      .returning();
    return account;
  }

  // With initial balance: wrap in transaction for atomicity
  const run = async (conn: Tx) => {
    const [account] = await conn
      .insert(accounts)
      .values({
        userId: input.userId,
        name: input.name,
        type: input.type,
        institution: input.institution ?? null,
        currency,
      })
      .returning();

    const equityAccount = await getOrCreateEquityAccount(input.userId, currency, conn);
    const amount = toMinorUnits(input.initialBalance!, currency);

    // Asset: debit the new account (increase), credit equity (increase)
    // Liability: debit equity (decrease), credit the new account (increase)
    const lines =
      input.type === "asset"
        ? [
            { accountId: account.id, amount, currency },
            { accountId: equityAccount.id, amount: -amount, currency },
          ]
        : [
            { accountId: equityAccount.id, amount, currency },
            { accountId: account.id, amount: -amount, currency },
          ];

    await createJournalEntry(
      input.userId,
      new Date().toISOString(),
      "Opening balance",
      null,
      lines,
      conn,
    );

    return account;
  };

  return tx ? run(tx) : db.transaction(run);
}

// ── Batch ────────────────────────────────────────────────────────────────

/**
 * Create multiple accounts in a single DB transaction (all-or-nothing).
 * Supports mixed asset/liability types with initial balances.
 */
export async function batchCreateAccounts(
  inputs: CreateAccountInput[],
): Promise<{ count: number }> {
  if (inputs.length === 0) throw new Error("No accounts to create");
  if (inputs.length > 20) throw new Error("Maximum 20 accounts per batch");

  return db.transaction(async (tx) => {
    for (let i = 0; i < inputs.length; i++) {
      try {
        await createAccount(inputs[i], tx);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Operation failed";
        throw new Error(`Item ${i}: ${msg}`);
      }
    }
    return { count: inputs.length };
  });
}

export async function updateAccount(
  accountId: string,
  userId: string,
  updates: {
    name?: string;
    type?: AccountType;
    institution?: string;
    isActive?: boolean;
  },
) {
  const [updated] = await db
    .update(accounts)
    .set(updates)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .returning();
  if (!updated) throw new Error("Account not found");
  return updated;
}

/**
 * Find or create an account by (userId, name).
 * Used by the categories service to idempotently ensure a category account exists.
 * The unique constraint is on (userId, name), so type is only used on insert.
 * If the account already exists with a different currency, its currency is updated.
 */
export async function getOrCreateAccount(
  userId: string,
  name: string,
  type: LedgerAccountType,
  currency: string,
  tx: Tx = db,
) {
  const [upserted] = await tx
    .insert(accounts)
    .values({ userId, name, type, currency })
    .onConflictDoUpdate({
      target: [accounts.userId, accounts.name],
      set: { currency },
    })
    .returning();

  if (!upserted) throw new Error(`Failed to find or create account: ${name}`);
  return upserted;
}

/**
 * Move a specific amount between an account and Opening Balance Equity.
 *
 * "into_account": equity → account (increases account balance)
 * "from_account": account → equity (decreases account balance)
 *
 * Useful for recording pre-existing transactions (those that happened before
 * the app was set up) without permanently altering the account's current balance:
 *   1. equityTransfer(accountId, amount, "into_account")  — temporarily add the amount back
 *   2. record_expense(amount, accountId)                  — record the actual expense
 *   Net effect: account balance unchanged, expense appears in the books.
 */
export async function equityTransfer(
  accountId: string,
  userId: string,
  amount: number, // major units, positive
  direction: "into_account" | "from_account",
  date: string,
  notes?: string | null,
): Promise<AccountWithBalance> {
  await db.transaction(async (tx: Tx) => {
    const [account] = await tx
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!account) throw new Error("Account not found");

    const minor = toMinorUnits(amount, account.currency);
    const equity = await getOrCreateEquityAccount(userId, account.currency, tx);

    const lines =
      direction === "into_account"
        ? [
            { accountId: account.id, amount: minor, currency: account.currency },
            { accountId: equity.id, amount: -minor, currency: account.currency },
          ]
        : [
            { accountId: equity.id, amount: minor, currency: account.currency },
            { accountId: account.id, amount: -minor, currency: account.currency },
          ];

    await createJournalEntry(userId, date, "Equity transfer", notes ?? null, lines, tx);
  });

  const result = await getAccountWithBalance(accountId, userId);
  if (!result) throw new Error("Account not found after equity transfer");
  return result;
}

/**
 * Correct an account's recorded balance to match reality.
 * Posts a correcting journal entry against "Opening Balance Equity" —
 * does not create a fake income/expense transaction.
 */
export async function adjustAccountBalance(
  accountId: string,
  userId: string,
  newDisplayBalance: number,
): Promise<AccountWithBalance> {
  const run = async (tx: Tx) => {
    // Lock the row immediately so concurrent adjustments on the same account
    // serialize — the second caller blocks here until the first commits.
    const [account] = await tx
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.userId, userId),
          or(eq(accounts.type, "asset"), eq(accounts.type, "liability")),
        ),
      )
      .for("update")
      .limit(1);

    if (!account) throw new Error("Account not found");

    // Read balance inside the transaction so the result reflects any journal
    // lines written by the transaction that just released the row lock above.
    const [balanceRow] = await tx
      .select({ balance: sql<string>`COALESCE(SUM(${journalLines.amount}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(and(eq(journalLines.accountId, accountId), isNull(journalEntries.deletedAt)));
    const currentRaw = BigInt(balanceRow?.balance ?? "0");

    const newRaw = isLiability(account.type)
      ? -toMinorUnits(newDisplayBalance, account.currency)
      : toMinorUnits(newDisplayBalance, account.currency);

    const delta = newRaw - currentRaw;
    if (delta === 0n) return; // no-op

    const equityAccount = await getOrCreateEquityAccount(userId, account.currency, tx);

    // delta > 0: debit account, credit equity
    // delta < 0: debit equity, credit account
    const lines =
      delta > 0n
        ? [
            { accountId: account.id, amount: delta, currency: account.currency },
            { accountId: equityAccount.id, amount: -delta, currency: account.currency },
          ]
        : [
            { accountId: equityAccount.id, amount: -delta, currency: account.currency },
            { accountId: account.id, amount: delta, currency: account.currency },
          ];

    await createJournalEntry(
      userId,
      new Date().toISOString(),
      "Balance adjustment",
      null,
      lines,
      tx,
    );
  };

  await db.transaction(run);

  const result = await getAccountWithBalance(accountId, userId);
  if (!result) throw new Error("Account not found after adjustment");
  return result;
}

export interface AccountWithBalance {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  currency: string;
  isActive: boolean;
  balance: number; // major units in account's native currency
  balanceFormatted: string; // formatted in account's native currency
}

/** Get a single asset/liability account for a user with computed balance. */
export async function getAccountWithBalance(
  accountId: string,
  userId: string,
  _currency = "USD", // kept for backward compat; balance is now in native currency
): Promise<AccountWithBalance | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        or(eq(accounts.type, "asset"), eq(accounts.type, "liability")),
      ),
    )
    .limit(1);

  if (!account) return null;

  const balances = await getAccountBalances([account.id]);
  const rawBalance = balances.get(account.id) ?? 0n;
  const displayBalance = isLiability(account.type) ? -rawBalance : rawBalance;

  return {
    id: account.id,
    name: account.name,
    type: account.type,
    institution: account.institution,
    currency: account.currency,
    isActive: account.isActive,
    balance: toMajorUnits(displayBalance, account.currency),
    balanceFormatted: formatMoney(displayBalance, account.currency),
  };
}

/**
 * Get all asset/liability accounts for a user with computed balances.
 * Excludes accounts that back a savings goal (those are hidden from normal views).
 * Balances are in each account's native currency.
 */
export async function getAccountsWithBalances(
  userId: string,
  _currency = "USD", // kept for backward compat
): Promise<AccountWithBalance[]> {
  const goalAccountIds = db
    .select({ id: goals.accountId })
    .from(goals)
    .where(eq(goals.userId, userId));

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        or(eq(accounts.type, "asset"), eq(accounts.type, "liability")),
        notInArray(accounts.id, goalAccountIds),
      ),
    )
    .orderBy(accounts.name);

  if (userAccounts.length === 0) return [];

  const balances = await getAccountBalances(userAccounts.map((a) => a.id));

  return userAccounts.map((a) => {
    const rawBalance = balances.get(a.id) ?? 0n;
    const displayBalance = isLiability(a.type) ? -rawBalance : rawBalance;
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      institution: a.institution,
      currency: a.currency,
      isActive: a.isActive,
      balance: toMajorUnits(displayBalance, a.currency),
      balanceFormatted: formatMoney(displayBalance, a.currency),
    };
  });
}
