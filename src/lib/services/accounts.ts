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
import { accounts, goals } from "@/lib/db/schema";
import type { ledgerAccountType } from "@/lib/db/schema";
import { eq, and, notInArray, or } from "drizzle-orm";
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
 */
export async function getOrCreateAccount(
  userId: string,
  name: string,
  type: LedgerAccountType,
  currency: string,
  tx: Tx = db,
) {
  const [inserted] = await tx
    .insert(accounts)
    .values({ userId, name, type, currency })
    .onConflictDoNothing()
    .returning();

  if (inserted) return inserted;

  const [existing] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.name, name)))
    .limit(1);

  return existing!;
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
