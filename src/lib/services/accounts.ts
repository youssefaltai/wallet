/**
 * Account service.
 *
 * "Accounts" in the user-facing sense are rows in the unified accounts table
 * with type = 'asset' or 'liability'. The same table also holds expense/income
 * categories and equity accounts, but this service only deals with the
 * asset/liability slice.
 *
 * Balances are computed on the fly from journal_lines — nothing is stored.
 */

import { db } from "@/lib/db";
import { accounts, goals } from "@/lib/db/schema";
import type { ledgerAccountType } from "@/lib/db/schema";
import { eq, and, notInArray, or } from "drizzle-orm";
import { getAccountBalances, type Tx } from "./ledger";
import { toMajorUnits, formatMoney } from "./money";

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
}

export async function createAccount(input: CreateAccountInput, tx?: Tx) {
  const conn = tx ?? db;
  const [account] = await conn
    .insert(accounts)
    .values({
      userId: input.userId,
      name: input.name,
      type: input.type,
      institution: input.institution ?? null,
    })
    .returning();
  return account;
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
  tx: Tx = db,
) {
  const [inserted] = await tx
    .insert(accounts)
    .values({ userId, name, type })
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
  isActive: boolean;
  balance: number; // major units
  balanceFormatted: string;
}

/** Get a single asset/liability account for a user with computed balance. */
export async function getAccountWithBalance(
  accountId: string,
  userId: string,
  currency = "USD",
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
    isActive: account.isActive,
    balance: toMajorUnits(displayBalance),
    balanceFormatted: formatMoney(displayBalance, currency),
  };
}

/**
 * Get all asset/liability accounts for a user with computed balances.
 * Excludes accounts that back a savings goal (those are hidden from normal views).
 */
export async function getAccountsWithBalances(
  userId: string,
  currency = "USD",
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
      isActive: a.isActive,
      balance: toMajorUnits(displayBalance),
      balanceFormatted: formatMoney(displayBalance, currency),
    };
  });
}
